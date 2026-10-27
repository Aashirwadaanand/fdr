import { Router, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { auditLogger } from '../audit/auditLogger';
import { ruleEngine } from '../rules/ruleEngine';
import { clock } from '../clock/clock';

const router = Router();

// 1. Get all rule configs
router.get('/', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const rules = db.prepare('SELECT * FROM rule_configs ORDER BY id ASC').all();
  res.json(rules);
});

// 2. Admin: toggle or update rule configuration
const updateRuleSchema = z.object({
  is_enabled: z.boolean().optional(),
  severity: z.enum(['INFO', 'WARNING', 'HIGH', 'CRITICAL']).optional(),
  parameters: z.record(z.any()).optional(),
});

router.patch('/:ruleCode', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const validation = updateRuleSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Validation Error', details: validation.error.errors });
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM rule_configs WHERE rule_code = ?').get(req.params.ruleCode) as any;
  if (!existing) {
    return res.status(404).json({ error: `Rule '${req.params.ruleCode}' not found` });
  }

  const isEnabled = validation.data.is_enabled !== undefined ? (validation.data.is_enabled ? 1 : 0) : existing.is_enabled;
  const severity = validation.data.severity || existing.severity;
  const parameters = validation.data.parameters ? JSON.stringify(validation.data.parameters) : existing.parameters;
  const nowIso = clock.now().toISOString();

  db.prepare(`
    UPDATE rule_configs
    SET is_enabled = ?, severity = ?, parameters = ?, updated_at = ?
    WHERE rule_code = ?
  `).run(isEnabled, severity, parameters, nowIso, req.params.ruleCode);

  auditLogger.log(
    db,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
    'RULE_CONFIG_UPDATED',
    { type: 'RULE_CONFIG', id: req.params.ruleCode },
    {
      rule_code: req.params.ruleCode,
      is_enabled: isEnabled === 1,
      severity,
      parameters,
    }
  );

  const updated = db.prepare('SELECT * FROM rule_configs WHERE rule_code = ?').get(req.params.ruleCode);
  res.json(updated);
});

// 3. Re-evaluate all FDRs and refresh flags
router.post('/evaluate-all', authenticateToken, requireRole('ADMIN', 'SCRUTINY_OFFICER'), (_req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const fdrs = db.prepare('SELECT * FROM fdrs').all() as any[];

  let totalFlags = 0;
  for (const f of fdrs) {
    const flags = ruleEngine.syncFdrFlags(db, f);
    totalFlags += flags.length;
  }

  res.json({
    message: `Rule engine scan complete across ${fdrs.length} FDR records.`,
    totalFdrsScanned: fdrs.length,
    totalFlagsGenerated: totalFlags,
    scanTimestamp: clock.now().toISOString(),
  });
});

export default router;
