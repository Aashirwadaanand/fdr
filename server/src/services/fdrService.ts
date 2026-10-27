import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { clock } from '../clock/clock';
import { ruleEngine, FdrRecord } from '../rules/ruleEngine';
import { LifecycleStateMachine, FdrStatus, TrustLevel } from '../state/lifecycleStateMachine';
import { auditLogger } from '../audit/auditLogger';

export interface FdrFilterParams {
  institution_id?: string;
  issuing_bank?: string;
  status?: string;
  trust_level?: string;
  maturity_from?: string;
  maturity_to?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export class FdrService {
  private static instance: FdrService;

  private constructor() {}

  public static getInstance(): FdrService {
    if (!FdrService.instance) {
      FdrService.instance = new FdrService();
    }
    return FdrService.instance;
  }

  public getFdrs(db: DatabaseSync, params: FdrFilterParams) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.institution_id) {
      whereClause += ' AND f.institution_id = ?';
      queryParams.push(params.institution_id);
    }
    if (params.issuing_bank) {
      whereClause += ' AND f.issuing_bank = ?';
      queryParams.push(params.issuing_bank);
    }
    if (params.status) {
      whereClause += ' AND f.status = ?';
      queryParams.push(params.status);
    }
    if (params.trust_level) {
      whereClause += ' AND f.trust_level = ?';
      queryParams.push(params.trust_level);
    }
    if (params.maturity_from) {
      whereClause += ' AND f.maturity_date >= ?';
      queryParams.push(params.maturity_from);
    }
    if (params.maturity_to) {
      whereClause += ' AND f.maturity_date <= ?';
      queryParams.push(params.maturity_to);
    }
    if (params.search) {
      whereClause += ' AND (f.fdr_number LIKE ? OR f.branch_name LIKE ? OR i.name LIKE ? OR i.code LIKE ?)';
      const s = `%${params.search}%`;
      queryParams.push(s, s, s, s);
    }

    // Total count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...queryParams) as { total: number };
    const total = countRow ? countRow.total : 0;

    // Sorting
    const allowedSortFields = ['maturity_date', 'amount', 'created_at', 'issue_date', 'status', 'trust_level'];
    const sortBy = allowedSortFields.includes(params.sort_by || '') ? params.sort_by! : 'created_at';
    const sortOrder = params.sort_order === 'ASC' ? 'ASC' : 'DESC';

    const selectSql = `
      SELECT 
        f.*,
        i.name as institution_name,
        i.code as institution_code,
        i.state as institution_state,
        (SELECT COUNT(*) FROM fdr_flags flg WHERE flg.fdr_id = f.id AND flg.is_resolved = 0) as flag_count,
        (SELECT COUNT(*) FROM observations obs WHERE obs.fdr_id = f.id AND obs.is_resolved = 0) as open_observation_count
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      ${whereClause}
      ORDER BY f.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const data = db.prepare(selectSql).all(...queryParams, limit, offset) as any[];

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public getFdrById(db: DatabaseSync, id: string) {
    const fdr = db.prepare(`
      SELECT 
        f.*,
        i.name as institution_name,
        i.code as institution_code,
        i.state as institution_state,
        i.category as institution_category,
        i.email as institution_email,
        i.phone as institution_phone
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      WHERE f.id = ?
    `).get(id) as any;

    if (!fdr) return null;

    // Documents
    const documents = db.prepare(`
      SELECT d.*, u.full_name as uploaded_by_name
      FROM fdr_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.fdr_id = ?
      ORDER BY d.version DESC
    `).all(id);

    // Verification records
    const verifications = db.prepare(`
      SELECT v.*, u.full_name as verified_by_name
      FROM verification_records v
      LEFT JOIN users u ON v.verified_by = u.id
      WHERE v.fdr_id = ?
      ORDER BY v.created_at DESC
    `).all(id);

    // Observations
    const observations = db.prepare(`
      SELECT o.*
      FROM observations o
      WHERE o.fdr_id = ?
      ORDER BY o.created_at DESC
    `).all(id);

    // Active flags from rule engine
    const flags = db.prepare(`
      SELECT *
      FROM fdr_flags
      WHERE fdr_id = ?
      ORDER BY severity DESC, created_at DESC
    `).all(id);

    // Linked renewal chain
    let renewalChain: any = {
      replacesFdr: null,
      replacedByFdr: null,
      coverageGapDays: null,
    };

    if (fdr.replaces_fdr_id) {
      const prev = db.prepare('SELECT id, fdr_number, issuing_bank, amount, issue_date, maturity_date, status FROM fdrs WHERE id = ?').get(fdr.replaces_fdr_id) as any;
      if (prev) {
        renewalChain.replacesFdr = prev;
        // Calculate coverage gap: days between prev.maturity_date and current.issue_date
        const prevMaturity = new Date(prev.maturity_date);
        const currIssue = new Date(fdr.issue_date);
        const diffMs = currIssue.getTime() - prevMaturity.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        renewalChain.coverageGapDays = diffDays > 0 ? diffDays : 0;
      }
    }

    const next = db.prepare('SELECT id, fdr_number, issuing_bank, amount, issue_date, maturity_date, status FROM fdrs WHERE replaces_fdr_id = ?').get(id) as any;
    if (next) {
      renewalChain.replacedByFdr = next;
    }

    // Release requests
    const releaseRequests = db.prepare(`
      SELECT r.*, ru.full_name as recommended_by_name, au.full_name as approved_by_name
      FROM release_requests r
      LEFT JOIN users ru ON r.recommended_by = ru.id
      LEFT JOIN users au ON r.approved_by = au.id
      WHERE r.fdr_id = ?
      ORDER BY r.created_at DESC
    `).all(id);

    return {
      fdr,
      documents,
      verifications,
      observations,
      flags,
      renewalChain,
      releaseRequests,
    };
  }

  public createFdr(
    db: DatabaseSync,
    data: {
      institution_id: string;
      fdr_number: string;
      issuing_bank: string;
      branch_name?: string;
      ifsc_code?: string;
      account_number_masked?: string;
      amount: number;
      issue_date: string;
      maturity_date: string;
      interest_rate?: number;
      purpose?: string;
      replaces_fdr_id?: string;
      trust_level?: TrustLevel;
      status?: FdrStatus;
    },
    actor: { id: string; name: string; role: string }
  ) {
    const id = 'fdr_' + crypto.randomUUID();
    const nowIso = clock.now().toISOString();
    const status: FdrStatus = data.status || 'SUBMITTED';
    const trustLevel: TrustLevel = data.trust_level || 'DECLARED';

    // Mask account number if provided unmasked
    let masked = data.account_number_masked;
    if (masked && !masked.startsWith('XXXX-XXXX-')) {
      masked = 'XXXX-XXXX-' + masked.slice(-4);
    }

    const insert = db.prepare(`
      INSERT INTO fdrs (
        id, institution_id, fdr_number, issuing_bank, branch_name, ifsc_code,
        account_number_masked, amount, issue_date, maturity_date, interest_rate,
        status, trust_level, replaces_fdr_id, purpose, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      id,
      data.institution_id,
      data.fdr_number.trim(),
      data.issuing_bank.trim(),
      data.branch_name || null,
      data.ifsc_code || null,
      masked || null,
      data.amount,
      data.issue_date,
      data.maturity_date,
      data.interest_rate || 0.0,
      status,
      trustLevel,
      data.replaces_fdr_id || null,
      data.purpose || 'AICTE Security Deposit',
      nowIso,
      nowIso
    );

    // If this replaces an existing FDR, update previous FDR status to RENEWED if applicable
    if (data.replaces_fdr_id) {
      db.prepare(`
        UPDATE fdrs SET status = 'RENEWED', updated_at = ? WHERE id = ?
      `).run(nowIso, data.replaces_fdr_id);
    }

    const fdrRecord: FdrRecord = {
      id,
      institution_id: data.institution_id,
      fdr_number: data.fdr_number,
      issuing_bank: data.issuing_bank,
      branch_name: data.branch_name,
      amount: data.amount,
      issue_date: data.issue_date,
      maturity_date: data.maturity_date,
      status,
      trust_level: trustLevel,
      replaces_fdr_id: data.replaces_fdr_id,
    };

    // Evaluate rules and store flags
    ruleEngine.syncFdrFlags(db, fdrRecord);

    // Write to audit log
    auditLogger.log(
      db,
      actor,
      'FDR_CREATED',
      { type: 'FDR', id },
      {
        fdr_number: data.fdr_number,
        institution_id: data.institution_id,
        issuing_bank: data.issuing_bank,
        amount: data.amount,
        issue_date: data.issue_date,
        maturity_date: data.maturity_date,
        replaces_fdr_id: data.replaces_fdr_id,
        trust_level: trustLevel,
      }
    );

    return this.getFdrById(db, id);
  }

  public updateStatus(
    db: DatabaseSync,
    fdrId: string,
    targetStatus: FdrStatus,
    actor: { id: string; name: string; role: string },
    note?: string
  ) {
    const fdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(fdrId) as any;
    if (!fdr) throw new Error('FDR not found');

    const transitionCheck = LifecycleStateMachine.validateTransition(fdr.status, targetStatus, actor.role);
    if (!transitionCheck.allowed) {
      throw new Error(transitionCheck.reason);
    }

    const nowIso = clock.now().toISOString();

    db.prepare('UPDATE fdrs SET status = ?, updated_at = ? WHERE id = ?').run(targetStatus, nowIso, fdrId);

    // Refresh flags
    const updatedFdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(fdrId) as any;
    ruleEngine.syncFdrFlags(db, updatedFdr);

    // Log to audit
    auditLogger.log(
      db,
      actor,
      'FDR_STATUS_TRANSITION',
      { type: 'FDR', id: fdrId },
      {
        previous_status: fdr.status,
        new_status: targetStatus,
        note: note || 'Lifecycle transition executed',
      }
    );

    return updatedFdr;
  }
}

export const fdrService = FdrService.getInstance();
