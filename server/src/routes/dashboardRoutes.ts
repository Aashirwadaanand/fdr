import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { dashboardService } from '../services/dashboardService';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();

  let targetInstitutionId: string | undefined = undefined;
  if (req.user!.role === 'INSTITUTION_OFFICER') {
    targetInstitutionId = req.user!.institution_id || undefined;
  } else if (req.query.institution_id) {
    targetInstitutionId = req.query.institution_id as string;
  }

  const stats = dashboardService.getDashboardStats(db, targetInstitutionId);
  res.json(stats);
});

export default router;
