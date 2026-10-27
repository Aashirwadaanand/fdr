import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { auditLogger } from '../audit/auditLogger';
import { clock } from '../clock/clock';

const router = Router();

// 1. Get escalation events with FDR and institution context
router.get('/', authenticateToken, requireRole('SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const status = req.query.status as string || 'ACTIVE';

  let query = `
    SELECT 
      e.*,
      f.fdr_number,
      f.issuing_bank,
      f.amount,
      f.maturity_date,
      f.status as fdr_status,
      i.name as institution_name,
      i.code as institution_code,
      i.state as institution_state
    FROM escalation_events e
    JOIN fdrs f ON e.fdr_id = f.id
    JOIN institutions i ON f.institution_id = i.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status !== 'ALL') {
    query += ' AND e.status = ?';
    params.push(status);
  }

  query += ' ORDER BY e.sla_breached DESC, e.escalated_at DESC';

  const escalations = db.prepare(query).all(...params);
  res.json(escalations);
});

// 2. Resolve escalation event
router.patch('/:id/resolve', authenticateToken, requireRole('SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const nowIso = clock.now().toISOString();

  const update = db.prepare(`
    UPDATE escalation_events
    SET status = 'RESOLVED', resolved_at = ?
    WHERE id = ?
  `).run(nowIso, req.params.id);

  if (update.changes === 0) {
    return res.status(404).json({ error: 'Escalation event not found' });
  }

  auditLogger.log(
    db,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
    'ESCALATION_RESOLVED',
    { type: 'ESCALATION_EVENT', id: req.params.id },
    { resolved_at: nowIso }
  );

  res.json({ message: 'Escalation event resolved successfully' });
});

export default router;
