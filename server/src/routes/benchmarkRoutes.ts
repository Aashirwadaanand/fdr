import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { benchmarkService } from '../services/benchmarkService';
import { ScenarioRunner } from '../services/scenarioRunner';
import { seedService } from '../services/seedService';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { auditLogger } from '../audit/auditLogger';

const router = Router();

// 1. Run live rule engine benchmark and 100-edit tamper check
router.get('/', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const report = benchmarkService.runRuleEngineBenchmark(db);
  res.json(report);
});

// 2. Run live scenario tests suite
router.get('/scenarios', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const results = await ScenarioRunner.runAll(db);
  res.json(results);
});

// 3. Reset and re-seed demo dataset (ADMIN only)
router.post('/seed', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const seedResult = seedService.seedAll(db);

  auditLogger.log(
    db,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
    'DEMO_DATASET_RESET_AND_SEEDED',
    { type: 'SYSTEM_OPERATION', id: 'seed_dataset' },
    seedResult
  );

  res.json({
    message: 'Demo dataset reset and deterministic synthetic seed generated successfully (200 FDRs, 30 deliberate compliance errors).',
    seedResult,
  });
});

export default router;
