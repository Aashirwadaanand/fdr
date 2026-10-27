import { Router, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/database';
import { releaseService } from '../services/releaseService';
import { authenticateToken, requireRole, enforceInstitutionScope, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

// 1. Get all release requests
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const status = req.query.status as string | undefined;
  const requests = releaseService.getAllRequests(db, status);

  // If institution officer, only return own institution's requests
  if (req.user!.role === 'INSTITUTION_OFFICER') {
    const filtered = requests.filter((r: any) => r.institution_id === req.user!.institution_id);
    return res.json(filtered);
  }

  res.json(requests);
});

// 2. Check eligibility checklist for an FDR
router.get('/eligibility/:fdrId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const fdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(req.params.fdrId) as any;
  if (!fdr) return res.status(404).json({ error: 'FDR not found' });

  if (!enforceInstitutionScope(fdr.institution_id, req, res)) return;

  const checklist = releaseService.evaluateEligibility(db, req.params.fdrId);
  res.json(checklist);
});

// 3. Get single release request
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const reqRecord = releaseService.getRequestById(db, req.params.id);
  if (!reqRecord) return res.status(404).json({ error: 'Release request not found' });

  if (!enforceInstitutionScope(reqRecord.institution_id, req, res)) return;

  res.json(reqRecord);
});

// 4. Submit release request (Maker 1)
const submitReleaseSchema = z.object({
  fdr_id: z.string().min(1, 'FDR ID is required'),
  request_type: z.enum(['RELEASE', 'DISCHARGE', 'REFUND']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

router.post('/', authenticateToken, requireRole('INSTITUTION_OFFICER', 'SCRUTINY_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const validation = submitReleaseSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Validation Error', details: validation.error.errors });
  }

  const db = getDatabase();
  const fdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(validation.data.fdr_id) as any;
  if (!fdr) return res.status(404).json({ error: 'FDR not found' });

  if (!enforceInstitutionScope(fdr.institution_id, req, res)) return;

  try {
    const record = releaseService.createRequest(
      db,
      {
        fdr_id: fdr.id,
        institution_id: fdr.institution_id,
        request_type: validation.data.request_type,
        reason: validation.data.reason,
      },
      { id: req.user!.id, name: req.user!.full_name, role: req.user!.role }
    );
    res.status(201).json(record);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Scrutiny Officer recommends release (Maker 2)
const recommendSchema = z.object({
  notes: z.string().min(5, 'Recommendation notes are required'),
});

router.post('/:id/recommend', authenticateToken, requireRole('SCRUTINY_OFFICER', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const validation = recommendSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Validation Error', details: validation.error.errors });
  }

  const db = getDatabase();
  try {
    const updated = releaseService.recommendRequest(
      db,
      req.params.id,
      validation.data.notes,
      { id: req.user!.id, name: req.user!.full_name, role: req.user!.role }
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Approving Authority decides release (Checker) - Enforces Maker-Checker!
const decideSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  decision_notes: z.string().min(5, 'Decision notes are required'),
});

router.post('/:id/decide', authenticateToken, requireRole('APPROVING_AUTHORITY', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const validation = decideSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Validation Error', details: validation.error.errors });
  }

  const db = getDatabase();
  try {
    const result = releaseService.decideRequest(
      db,
      req.params.id,
      validation.data.decision,
      validation.data.decision_notes,
      { id: req.user!.id, name: req.user!.full_name, role: req.user!.role }
    );
    res.json(result);
  } catch (err: any) {
    // Return 403 Forbidden on Maker-Checker violation with explicit message
    if (err.message.includes('Maker-Checker restriction')) {
      return res.status(403).json({
        error: 'Maker-Checker Violation',
        message: err.message,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

export default router;
