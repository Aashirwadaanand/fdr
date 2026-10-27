import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { z } from 'zod';
import { getDatabase } from '../db/database';
import { fdrService } from '../services/fdrService';
import { authenticateToken, requireRole, enforceInstitutionScope, AuthenticatedRequest } from '../auth/middleware';
import { extractionAdapter } from '../adapters/extraction/extractionAdapter';
import { storageAdapter } from '../adapters/storage/storageAdapter';
import { ruleEngine } from '../rules/ruleEngine';
import { auditLogger } from '../audit/auditLogger';
import { clock } from '../clock/clock';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }); // 15MB limit

// 1. Central repository query
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();

  let targetInstitutionId = req.query.institution_id as string | undefined;

  // INSTITUTION_OFFICER can strictly only query their own institution
  if (req.user?.role === 'INSTITUTION_OFFICER') {
    targetInstitutionId = req.user.institution_id || undefined;
  }

  const result = fdrService.getFdrs(db, {
    institution_id: targetInstitutionId,
    issuing_bank: req.query.issuing_bank as string | undefined,
    status: req.query.status as string | undefined,
    trust_level: req.query.trust_level as string | undefined,
    maturity_from: req.query.maturity_from as string | undefined,
    maturity_to: req.query.maturity_to as string | undefined,
    search: req.query.search as string | undefined,
    sort_by: req.query.sort_by as string | undefined,
    sort_order: (req.query.sort_order as 'ASC' | 'DESC') || 'DESC',
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  });

  res.json(result);
});

// 2. Extraction preview (for intake form side-by-side comparison)
router.post('/extract-preview', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    let result;
    if (req.file) {
      result = await extractionAdapter.extractFromBuffer(req.file.buffer, req.file.mimetype);
    } else if (req.body.text) {
      result = await extractionAdapter.extractFromText(req.body.text);
    } else {
      return res.status(400).json({ error: 'Please upload a document file or provide raw text to extract' });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Extraction failed', details: err.message });
  }
});

// 3. Detail page retrieval
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const detail = fdrService.getFdrById(db, req.params.id);

  if (!detail) {
    return res.status(404).json({ error: 'FDR record not found' });
  }

  // Enforce institution boundary
  if (!enforceInstitutionScope(detail.fdr.institution_id, req, res)) {
    return;
  }

  res.json(detail);
});

// 4. Create new FDR (Intake)
const createFdrSchema = z.object({
  institution_id: z.string().min(1, 'Institution is required'),
  fdr_number: z.string().min(1, 'FDR Reference Number is required'),
  issuing_bank: z.string().min(1, 'Issuing Bank is required'),
  branch_name: z.string().optional(),
  ifsc_code: z.string().optional(),
  account_number_masked: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date format: YYYY-MM-DD'),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Maturity date format: YYYY-MM-DD'),
  interest_rate: z.number().optional(),
  purpose: z.string().optional(),
  replaces_fdr_id: z.string().optional(),
  trust_level: z.enum(['DECLARED', 'DOCUMENT_EXTRACTED', 'BANK_CONFIRMED']).optional(),
  status: z.enum(['SUBMITTED', 'UNDER_SCRUTINY', 'VERIFIED', 'ACTIVE', 'EXPIRING', 'MATURED', 'RENEWED', 'RELEASED']).optional(),
  extracted_data: z.record(z.any()).optional(),
});

router.post('/', authenticateToken, requireRole('INSTITUTION_OFFICER', 'SCRUTINY_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();

  // If user is institution officer, lock institution_id to their own
  const targetInstitutionId = req.user?.role === 'INSTITUTION_OFFICER' 
    ? req.user.institution_id! 
    : req.body.institution_id;

  const validation = createFdrSchema.safeParse({
    ...req.body,
    institution_id: targetInstitutionId,
  });

  if (!validation.success) {
    return res.status(400).json({ error: 'Validation Error', details: validation.error.errors });
  }

  const fdrDetail = fdrService.createFdr(
    db,
    validation.data,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role }
  );

  res.status(201).json(fdrDetail);
});

// 5. Lifecycle status transition
const transitionSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_SCRUTINY', 'VERIFIED', 'ACTIVE', 'EXPIRING', 'MATURED', 'RENEWED', 'RELEASED']),
  note: z.string().optional(),
});

router.patch('/:id/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const fdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(req.params.id) as any;
  if (!fdr) return res.status(404).json({ error: 'FDR not found' });

  if (!enforceInstitutionScope(fdr.institution_id, req, res)) return;

  const result = transitionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid status', details: result.error.errors });
  }

  try {
    const updated = fdrService.updateStatus(
      db,
      req.params.id,
      result.data.status,
      { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
      result.data.note
    );
    res.json(updated);
  } catch (err: any) {
    res.status(422).json({ error: 'Invalid Transition', message: err.message });
  }
});

// 6. Upload certificate document
router.post('/:id/documents', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File upload required' });
  }

  const db = getDatabase();
  const fdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(req.params.id) as any;
  if (!fdr) return res.status(404).json({ error: 'FDR not found' });

  if (!enforceInstitutionScope(fdr.institution_id, req, res)) return;

  try {
    // 1. Save document via storage adapter
    const stored = await storageAdapter.saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    // 2. Perform OCR extraction
    const extraction = await extractionAdapter.extractFromBuffer(req.file.buffer, req.file.mimetype);

    // 3. Determine version number
    const lastVersion = db.prepare('SELECT MAX(version) as max_v FROM fdr_documents WHERE fdr_id = ?').get(fdr.id) as { max_v: number | null };
    const version = (lastVersion?.max_v || 0) + 1;

    const docId = 'doc_' + crypto.randomUUID();
    const nowIso = clock.now().toISOString();

    db.prepare(`
      INSERT INTO fdr_documents (
        id, fdr_id, version, filename, original_name, mime_type, file_size,
        sha256_hash, storage_path, extracted_data, uploaded_by, uploaded_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId,
      fdr.id,
      version,
      stored.filename,
      stored.originalName,
      stored.mimeType,
      stored.size,
      stored.sha256Hash,
      stored.storagePath,
      JSON.stringify(extraction),
      req.user!.id,
      nowIso
    );

    // Elevate trust level to DOCUMENT_EXTRACTED if previously DECLARED
    if (fdr.trust_level === 'DECLARED') {
      db.prepare("UPDATE fdrs SET trust_level = 'DOCUMENT_EXTRACTED', updated_at = ? WHERE id = ?").run(nowIso, fdr.id);
    }

    // Refresh flags
    const refreshedFdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(fdr.id) as any;
    ruleEngine.syncFdrFlags(db, refreshedFdr);

    // Audit log
    auditLogger.log(
      db,
      { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
      'DOCUMENT_UPLOADED',
      { type: 'FDR_DOCUMENT', id: docId },
      {
        fdr_id: fdr.id,
        filename: stored.originalName,
        sha256_hash: stored.sha256Hash,
        version,
      }
    );

    res.status(201).json({
      id: docId,
      version,
      filename: stored.filename,
      original_name: stored.originalName,
      sha256_hash: stored.sha256Hash,
      extraction,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process document', details: err.message });
  }
});

// 7. Add scrutiny observation
const observationSchema = z.object({
  note: z.string().min(5, 'Observation note must be at least 5 characters'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

router.post('/:id/observations', authenticateToken, requireRole('SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const fdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(req.params.id) as any;
  if (!fdr) return res.status(404).json({ error: 'FDR not found' });

  const result = observationSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation Error', details: result.error.errors });
  }

  const id = 'obs_' + crypto.randomUUID();
  const nowIso = clock.now().toISOString();

  db.prepare(`
    INSERT INTO observations (id, fdr_id, author_id, author_name, author_role, note, severity, is_resolved, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    fdr.id,
    req.user!.id,
    req.user!.full_name,
    req.user!.role,
    result.data.note,
    result.data.severity,
    nowIso
  );

  auditLogger.log(
    db,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
    'OBSERVATION_ADDED',
    { type: 'OBSERVATION', id },
    { fdr_id: fdr.id, note: result.data.note, severity: result.data.severity }
  );

  res.status(201).json({ id, message: 'Observation recorded successfully' });
});

// 8. Resolve observation
router.patch('/:id/observations/:obsId/resolve', authenticateToken, requireRole('SCRUTINY_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const nowIso = clock.now().toISOString();

  const update = db.prepare(`
    UPDATE observations
    SET is_resolved = 1, resolved_at = ?, resolved_by = ?
    WHERE id = ? AND fdr_id = ?
  `).run(nowIso, req.user!.id, req.params.obsId, req.params.id);

  if (update.changes === 0) {
    return res.status(404).json({ error: 'Observation not found' });
  }

  auditLogger.log(
    db,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
    'OBSERVATION_RESOLVED',
    { type: 'OBSERVATION', id: req.params.obsId },
    { fdr_id: req.params.id }
  );

  res.json({ message: 'Observation marked resolved' });
});

export default router;
