import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDatabase } from '../db/database';
import { verificationRegistry } from '../adapters/verification/bankVerificationAdapters';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { auditLogger } from '../audit/auditLogger';
import { clock } from '../clock/clock';
import { ruleEngine } from '../rules/ruleEngine';

const router = Router();

// 1. List available verification adapters
router.get('/adapters', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  const adapters = verificationRegistry.getAll().map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    isEnabled: a.isEnabled,
    isSimulated: a.id !== 'live_bank_api',
  }));
  res.json(adapters);
});

// 2. Trigger bank verification
const verifySchema = z.object({
  fdr_id: z.string().min(1, 'FDR ID is required'),
  adapter_id: z.string().min(1, 'Adapter ID is required'),
  additionalEvidence: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

router.post('/verify', authenticateToken, requireRole('SCRUTINY_OFFICER', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const validation = verifySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Validation Error', details: validation.error.errors });
  }

  const { fdr_id, adapter_id, additionalEvidence, notes } = validation.data;
  const db = getDatabase();

  const fdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(fdr_id) as any;
  if (!fdr) {
    return res.status(404).json({ error: 'FDR record not found' });
  }

  const adapter = verificationRegistry.get(adapter_id);
  if (!adapter) {
    return res.status(400).json({ error: `Unknown verification adapter '${adapter_id}'` });
  }

  if (!adapter.isEnabled) {
    return res.status(400).json({
      error: 'Adapter Disabled',
      message: `${adapter.name} is disabled. Live banking integration requires regulatory RBI SFMS authorization.`,
    });
  }

  try {
    const verificationResult = await adapter.verify(
      {
        fdr_number: fdr.fdr_number,
        issuing_bank: fdr.issuing_bank,
        amount: fdr.amount,
        issue_date: fdr.issue_date,
        maturity_date: fdr.maturity_date,
        account_number_masked: fdr.account_number_masked,
      },
      additionalEvidence
    );

    const recordId = 'ver_' + crypto.randomUUID();
    const nowIso = clock.now().toISOString();

    // Store verification record
    db.prepare(`
      INSERT INTO verification_records (
        id, fdr_id, adapter_name, verification_type, result, evidence_payload, verified_by, notes, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordId,
      fdr.id,
      adapter.name,
      adapter_id,
      verificationResult.status,
      JSON.stringify(verificationResult.evidencePayload),
      req.user!.id,
      notes || verificationResult.notes,
      nowIso
    );

    // If verification succeeded with MATCH, promote trust level to BANK_CONFIRMED!
    let updatedTrustLevel = fdr.trust_level;
    let updatedStatus = fdr.status;

    if (verificationResult.status === 'MATCH') {
      updatedTrustLevel = 'BANK_CONFIRMED';
      if (fdr.status === 'UNDER_SCRUTINY' || fdr.status === 'SUBMITTED') {
        updatedStatus = 'VERIFIED';
      }

      db.prepare(`
        UPDATE fdrs
        SET trust_level = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(updatedTrustLevel, updatedStatus, nowIso, fdr.id);
    }

    // Refresh rule flags
    const refreshedFdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(fdr.id) as any;
    ruleEngine.syncFdrFlags(db, refreshedFdr);

    // Write to audit log
    auditLogger.log(
      db,
      { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
      'BANK_VERIFICATION_PERFORMED',
      { type: 'VERIFICATION_RECORD', id: recordId },
      {
        fdr_id: fdr.id,
        adapter_id,
        adapter_name: adapter.name,
        result: verificationResult.status,
        promoted_trust_level: updatedTrustLevel,
        updated_status: updatedStatus,
        evidence: verificationResult.evidencePayload,
      }
    );

    res.json({
      verificationRecordId: recordId,
      result: verificationResult,
      updatedFdr: {
        id: fdr.id,
        trust_level: updatedTrustLevel,
        status: updatedStatus,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Verification execution failed', details: err.message });
  }
});

export default router;
