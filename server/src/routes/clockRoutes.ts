import { Router, Response } from 'express';
import { z } from 'zod';
import { clock } from '../clock/clock';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { auditLogger } from '../audit/auditLogger';
import { getDatabase } from '../db/database';
import { schedulerService } from '../services/schedulerService';

const router = Router();

// Everyone authenticated can query current system clock
router.get('/', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  res.json(clock.getStatus());
});

// Admin-only: advance system clock by N days and trigger scheduler immediately
const advanceSchema = z.object({
  days: z.number().int().min(1).max(3650),
});

router.post('/advance', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const result = advanceSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation Error', details: result.error.errors });
  }

  const { days } = result.data;
  const oldDate = clock.today();
  const newDate = clock.advanceDays(days);

  const db = getDatabase();

  // Run validity scheduler check immediately for the new date
  const schedulerResult = schedulerService.runDailyCheck(db);

  auditLogger.log(
    db,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
    'CLOCK_ADVANCED',
    { type: 'DEMO_CLOCK', id: 'system_clock' },
    { old_date: oldDate, new_date: newDate, days_advanced: days }
  );

  return res.json({
    message: `System clock advanced by ${days} days to ${newDate}`,
    status: clock.getStatus(),
    schedulerResult,
  });
});

// Admin-only: jump directly to a target date
const setDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
});

router.post('/set', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const result = setDateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation Error', details: result.error.errors });
  }

  const { date } = result.data;
  const oldDate = clock.today();
  clock.setDate(date);

  const db = getDatabase();
  const schedulerResult = schedulerService.runDailyCheck(db);

  auditLogger.log(
    db,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
    'CLOCK_SET_EXPLICIT',
    { type: 'DEMO_CLOCK', id: 'system_clock' },
    { old_date: oldDate, new_date: date }
  );

  return res.json({
    message: `System clock date set to ${date}`,
    status: clock.getStatus(),
    schedulerResult,
  });
});

// Admin-only: trigger scheduler run manually
router.post('/trigger-scheduler', authenticateToken, requireRole('ADMIN'), (_req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const schedulerResult = schedulerService.runDailyCheck(db);
  res.json({
    message: 'Scheduled validity check completed successfully',
    schedulerResult,
  });
});

// Admin-only: reset clock to default demonstration date
router.post('/reset', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const oldDate = clock.today();
  const newDate = clock.reset();

  const db = getDatabase();
  const schedulerResult = schedulerService.runDailyCheck(db);

  auditLogger.log(
    db,
    { id: req.user!.id, name: req.user!.full_name, role: req.user!.role },
    'CLOCK_RESET',
    { type: 'DEMO_CLOCK', id: 'system_clock' },
    { old_date: oldDate, new_date: newDate }
  );

  return res.json({
    message: 'System clock reset to standard demo baseline (2026-10-27)',
    status: clock.getStatus(),
    schedulerResult,
  });
});

export default router;
