import { DatabaseSync } from 'node:sqlite';
import { clock } from '../clock/clock';

export class DashboardService {
  private static instance: DashboardService;

  private constructor() {}

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  public getDashboardStats(db: DatabaseSync, institutionId?: string) {
    const today = clock.today();

    let baseFilter = '';
    const params: any[] = [];
    if (institutionId) {
      baseFilter = ' WHERE institution_id = ?';
      params.push(institutionId);
    }

    // 1. Status Counts & Totals
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) as count, SUM(amount) as total_amount
      FROM fdrs
      ${baseFilter}
      GROUP BY status
    `).all(...params) as any[];

    const counts: Record<string, number> = {
      ACTIVE: 0,
      EXPIRING: 0,
      MATURED: 0,
      RENEWED: 0,
      RELEASED: 0,
      SUBMITTED: 0,
      UNDER_SCRUTINY: 0,
      VERIFIED: 0,
    };
    let totalLienAmount = 0;
    let totalFdrs = 0;

    for (const row of statusRows) {
      counts[row.status] = row.count;
      totalFdrs += row.count;
      if (['ACTIVE', 'EXPIRING', 'VERIFIED'].includes(row.status)) {
        totalLienAmount += (row.total_amount || 0);
      }
    }

    const pendingCount = counts.SUBMITTED + counts.UNDER_SCRUTINY;

    // 2. Trust Level Counts
    const trustRows = db.prepare(`
      SELECT trust_level, COUNT(*) as count
      FROM fdrs
      ${baseFilter}
      GROUP BY trust_level
    `).all(...params) as any[];

    const trustCounts: Record<string, number> = {
      DECLARED: 0,
      DOCUMENT_EXTRACTED: 0,
      BANK_CONFIRMED: 0,
    };
    for (const t of trustRows) {
      trustCounts[t.trust_level] = t.count;
    }

    // 3. Aging Buckets for Pending Verification (0-7, 8-30, 30+ days)
    const pendingFdrs = db.prepare(`
      SELECT id, created_at
      FROM fdrs
      WHERE status IN ('SUBMITTED', 'UNDER_SCRUTINY')
      ${institutionId ? 'AND institution_id = ?' : ''}
    `).all(...(institutionId ? [institutionId] : [])) as any[];

    const agingBuckets = {
      '0_to_7_days': 0,
      '8_to_30_days': 0,
      'over_30_days': 0,
    };

    const todayMs = new Date(today).getTime();

    for (const p of pendingFdrs) {
      const createdMs = new Date(p.created_at).getTime();
      const ageDays = Math.max(0, Math.floor((todayMs - createdMs) / (1000 * 60 * 60 * 24)));
      if (ageDays <= 7) {
        agingBuckets['0_to_7_days']++;
      } else if (ageDays <= 30) {
        agingBuckets['8_to_30_days']++;
      } else {
        agingBuckets['over_30_days']++;
      }
    }

    // 4. Bank-wise breakdown
    const bankRows = db.prepare(`
      SELECT issuing_bank, COUNT(*) as count, SUM(amount) as total_amount
      FROM fdrs
      ${baseFilter}
      GROUP BY issuing_bank
      ORDER BY count DESC
      LIMIT 10
    `).all(...params);

    // 5. Institution category breakdown
    const categoryRows = db.prepare(`
      SELECT i.category, COUNT(f.id) as fdr_count, SUM(f.amount) as total_amount
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      ${institutionId ? 'WHERE f.institution_id = ?' : ''}
      GROUP BY i.category
      ORDER BY fdr_count DESC
    `).all(...params);

    // 6. Risk-Ranked Officer Worklist
    // Priority order: OVERDUE (MATURED) -> EXPIRING -> UNVERIFIED / PENDING -> FLAGGED
    const worklist = db.prepare(`
      SELECT 
        f.id,
        f.fdr_number,
        f.issuing_bank,
        f.amount,
        f.status,
        f.trust_level,
        f.issue_date,
        f.maturity_date,
        i.name as institution_name,
        i.code as institution_code,
        (SELECT COUNT(*) FROM fdr_flags flg WHERE flg.fdr_id = f.id AND flg.is_resolved = 0) as flag_count,
        CASE
          WHEN f.status = 'MATURED' THEN 1
          WHEN f.status = 'EXPIRING' THEN 2
          WHEN f.status IN ('SUBMITTED', 'UNDER_SCRUTINY') THEN 3
          ELSE 4
        END as risk_rank
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      ${baseFilter ? baseFilter + ' AND' : 'WHERE'} (
        f.status IN ('MATURED', 'EXPIRING', 'SUBMITTED', 'UNDER_SCRUTINY')
        OR (SELECT COUNT(*) FROM fdr_flags flg WHERE flg.fdr_id = f.id AND flg.is_resolved = 0) > 0
      )
      ORDER BY risk_rank ASC, flag_count DESC, f.maturity_date ASC
      LIMIT 15
    `).all(...params);

    return {
      systemDate: today,
      totalFdrs,
      totalLienAmount,
      counts: {
        ...counts,
        PENDING: pendingCount,
      },
      trustCounts,
      agingBuckets,
      bankBreakdown: bankRows,
      categoryBreakdown: categoryRows,
      riskWorklist: worklist,
    };
  }
}

export const dashboardService = DashboardService.getInstance();
