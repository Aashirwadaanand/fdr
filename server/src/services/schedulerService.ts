import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { clock } from '../clock/clock';
import { ruleEngine } from '../rules/ruleEngine';
import { auditLogger } from '../audit/auditLogger';

export interface SchedulerRunResult {
  runAt: string;
  systemDate: string;
  fdrsChecked: number;
  expiringTransitioned: number;
  maturedTransitioned: number;
  notificationsCreated: number;
  escalationsCreated: number;
  slaBreachesDetected: number;
}

export class SchedulerService {
  private static instance: SchedulerService;

  private constructor() {}

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  public runDailyCheck(db: DatabaseSync): SchedulerRunResult {
    const today = clock.today();
    const nowIso = clock.now().toISOString();

    let expiringTransitioned = 0;
    let maturedTransitioned = 0;
    let notificationsCreated = 0;
    let escalationsCreated = 0;
    let slaBreachesDetected = 0;

    const fdrs = db.prepare(`
      SELECT f.*, i.name as institution_name
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
    `).all() as any[];

    for (const fdr of fdrs) {
      const maturityDate = fdr.maturity_date;
      const todayDateObj = new Date(today);
      const maturityDateObj = new Date(maturityDate);

      const diffTime = maturityDateObj.getTime() - todayDateObj.getTime();
      const daysToMaturity = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 1. Transition to MATURED if maturity date has arrived or passed and FDR is still ACTIVE or EXPIRING
      if (daysToMaturity <= 0 && ['ACTIVE', 'EXPIRING', 'VERIFIED'].includes(fdr.status)) {
        db.prepare("UPDATE fdrs SET status = 'MATURED', updated_at = ? WHERE id = ?").run(nowIso, fdr.id);
        maturedTransitioned++;

        // Create notification for Institution and Scrutiny Officer
        this.createNotification(
          db,
          'INSTITUTION_OFFICER',
          'FDR Deposit Has Matured',
          `FDR #${fdr.fdr_number} (Rs. ${fdr.amount.toLocaleString('en-IN')}) matured on ${fdr.maturity_date}. Please submit renewal or initiate release request.`,
          'URGENT',
          'FDR',
          fdr.id
        );
        notificationsCreated++;

        // Create Escalation Event
        const overdueDays = Math.abs(daysToMaturity);
        let escalationLevel = 'INSTITUTION_OFFICER';
        if (overdueDays > 15) {
          escalationLevel = 'APPROVING_AUTHORITY';
        } else if (overdueDays > 0) {
          escalationLevel = 'SCRUTINY_OFFICER';
        }

        const existingEsc = db.prepare(`
          SELECT id FROM escalation_events WHERE fdr_id = ? AND status = 'ACTIVE'
        `).get(fdr.id);

        if (!existingEsc) {
          db.prepare(`
            INSERT INTO escalation_events (id, fdr_id, trigger_reason, escalation_level, status, sla_breached, escalated_at)
            VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
          `).run(
            'esc_' + crypto.randomUUID(),
            fdr.id,
            `Deposit overdue by ${overdueDays} days without renewal or release request.`,
            escalationLevel,
            overdueDays > 15 ? 1 : 0,
            nowIso
          );
          escalationsCreated++;
        }
      }
      // 2. Transition to EXPIRING if within 90 days of maturity and status is ACTIVE
      else if (daysToMaturity > 0 && daysToMaturity <= 90 && fdr.status === 'ACTIVE') {
        db.prepare("UPDATE fdrs SET status = 'EXPIRING', updated_at = ? WHERE id = ?").run(nowIso, fdr.id);
        expiringTransitioned++;

        // Send alert at reminder thresholds: 90, 60, 30, 7 days
        const reminderThresholds = [90, 60, 30, 7];
        const isThreshold = reminderThresholds.some(t => Math.abs(daysToMaturity - t) <= 1);

        if (isThreshold) {
          this.createNotification(
            db,
            'INSTITUTION_OFFICER',
            `FDR Maturing in ${daysToMaturity} Days`,
            `Reminder: FDR #${fdr.fdr_number} from ${fdr.issuing_bank} is approaching maturity on ${fdr.maturity_date}. Arrange timely renewal.`,
            daysToMaturity <= 15 ? 'URGENT' : 'WARNING',
            'FDR',
            fdr.id
          );
          notificationsCreated++;
        }
      }

      // Re-sync flags
      const refreshed = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(fdr.id) as any;
      ruleEngine.syncFdrFlags(db, refreshed);
    }

    // 3. Check SLA timers on pending Scrutiny submissions (> 7 days in SUBMITTED state)
    const pendingScrutiny = db.prepare(`
      SELECT id, fdr_number, created_at, status
      FROM fdrs
      WHERE status = 'SUBMITTED'
    `).all() as any[];

    for (const p of pendingScrutiny) {
      const createdTime = new Date(p.created_at).getTime();
      const daysPending = Math.floor((new Date(today).getTime() - createdTime) / (1000 * 60 * 60 * 24));
      if (daysPending > 7) {
        slaBreachesDetected++;
        this.createNotification(
          db,
          'SCRUTINY_OFFICER',
          'SLA Breach: Scrutiny Pending',
          `FDR #${p.fdr_number} has been awaiting initial scrutiny for ${daysPending} days (SLA: 7 days).`,
          'URGENT',
          'FDR',
          p.id
        );
      }
    }

    // Audit log scheduler execution
    auditLogger.log(
      db,
      { id: 'system_scheduler', name: 'AICTE Automated Scheduler', role: 'SYSTEM_SCHEDULER' },
      'SCHEDULER_RUN_COMPLETED',
      { type: 'SYSTEM_JOB', id: 'daily_validity_scan' },
      {
        system_date: today,
        fdrs_checked: fdrs.length,
        expiring_transitioned: expiringTransitioned,
        matured_transitioned: maturedTransitioned,
        notifications_created: notificationsCreated,
        escalations_created: escalationsCreated,
        sla_breaches_detected: slaBreachesDetected,
      }
    );

    return {
      runAt: nowIso,
      systemDate: today,
      fdrsChecked: fdrs.length,
      expiringTransitioned,
      maturedTransitioned,
      notificationsCreated,
      escalationsCreated,
      slaBreachesDetected,
    };
  }

  public createNotification(
    db: DatabaseSync,
    role: string | null,
    title: string,
    message: string,
    severity: 'INFO' | 'WARNING' | 'URGENT',
    entityType?: string,
    entityId?: string,
    userId?: string
  ) {
    const id = 'notif_' + crypto.randomUUID();
    const nowIso = clock.now().toISOString();

    db.prepare(`
      INSERT INTO notifications (id, user_id, role, title, message, severity, entity_type, entity_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id,
      userId || null,
      role || null,
      title,
      message,
      severity,
      entityType || null,
      entityId || null,
      nowIso
    );

    return id;
  }
}

export const schedulerService = SchedulerService.getInstance();
