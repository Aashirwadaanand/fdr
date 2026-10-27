import { Router, Response } from 'express';
import { auditLogger } from '../audit/auditLogger';
import { getDatabase } from '../db/database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

// Retrieve audit logs with filtering and pagination
router.get('/', authenticateToken, requireRole('AUDITOR', 'ADMIN', 'SCRUTINY_OFFICER', 'APPROVING_AUTHORITY'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const actorRole = req.query.actor_role as string | undefined;
  const action = req.query.action as string | undefined;
  const entityType = req.query.entity_type as string | undefined;
  const search = req.query.search as string | undefined;

  let query = 'SELECT * FROM audit_entries WHERE 1=1';
  const params: any[] = [];

  if (actorRole) {
    query += ' AND actor_role = ?';
    params.push(actorRole);
  }
  if (action) {
    query += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }
  if (entityType) {
    query += ' AND entity_type = ?';
    params.push(entityType);
  }
  if (search) {
    query += ' AND (actor_name LIKE ? OR payload_canonical LIKE ? OR entity_id LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Count total matching
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countRow = db.prepare(countQuery).get(...params) as { total: number };
  const total = countRow ? countRow.total : 0;

  query += ' ORDER BY sequence DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const entries = db.prepare(query).all(...params);

  res.json({
    data: entries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Verify cryptographic hash chain integrity
router.get('/verify', authenticateToken, requireRole('AUDITOR', 'ADMIN', 'SCRUTINY_OFFICER', 'APPROVING_AUTHORITY'), (_req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const result = auditLogger.verifyIntegrity(db);
  res.json(result);
});

// Admin-only: Deliberate tamper demo to show fraud detection in action
router.post('/tamper-demo', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const sequence = req.body.sequence ? parseInt(req.body.sequence) : undefined;
  try {
    const result = auditLogger.deliberateTamper(db, sequence);
    res.json({
      message: 'Deliberate tamper simulated successfully on audit entry. Audit chain is now broken.',
      result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin-only: Restore tampered demo record
router.post('/restore-demo', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const sequence = req.body.sequence ? parseInt(req.body.sequence) : undefined;
  try {
    const result = auditLogger.restoreTamperedRecord(db, sequence);
    res.json({
      message: 'Tampered audit record restored successfully. Cryptographic hash chain is intact again.',
      result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
