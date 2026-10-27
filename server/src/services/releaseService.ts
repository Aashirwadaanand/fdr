import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { clock } from '../clock/clock';
import { auditLogger } from '../audit/auditLogger';
import { ruleEngine } from '../rules/ruleEngine';

export interface EligibilityChecklist {
  isBankConfirmed: boolean;
  noOpenObservations: boolean;
  notAlreadyReleased: boolean;
  isMaturedOrReplaced: boolean;
  overallEligible: boolean;
  details: {
    trust_level: string;
    open_observations_count: number;
    current_status: string;
    is_matured: boolean;
    has_replacement: boolean;
  };
}

export class ReleaseService {
  private static instance: ReleaseService;

  private constructor() {}

  public static getInstance(): ReleaseService {
    if (!ReleaseService.instance) {
      ReleaseService.instance = new ReleaseService();
    }
    return ReleaseService.instance;
  }

  public evaluateEligibility(db: DatabaseSync, fdrId: string): EligibilityChecklist {
    const fdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(fdrId) as any;
    if (!fdr) throw new Error('FDR not found');

    const today = clock.today();

    // 1. Bank confirmed
    const isBankConfirmed = fdr.trust_level === 'BANK_CONFIRMED';

    // 2. Open observations count
    const obsCountRow = db.prepare('SELECT COUNT(*) as count FROM observations WHERE fdr_id = ? AND is_resolved = 0').get(fdrId) as { count: number };
    const noOpenObservations = (obsCountRow?.count || 0) === 0;

    // 3. Not already released
    const notAlreadyReleased = fdr.status !== 'RELEASED';

    // 4. Matured or replaced
    const isMatured = fdr.status === 'MATURED' || (fdr.maturity_date && fdr.maturity_date <= today);
    const replacementRow = db.prepare('SELECT id FROM fdrs WHERE replaces_fdr_id = ? AND status IN (\'ACTIVE\', \'VERIFIED\')').get(fdrId);
    const hasReplacement = Boolean(replacementRow);
    const isMaturedOrReplaced = isMatured || hasReplacement;

    const overallEligible = isBankConfirmed && noOpenObservations && notAlreadyReleased && isMaturedOrReplaced;

    return {
      isBankConfirmed,
      noOpenObservations,
      notAlreadyReleased,
      isMaturedOrReplaced,
      overallEligible,
      details: {
        trust_level: fdr.trust_level,
        open_observations_count: obsCountRow?.count || 0,
        current_status: fdr.status,
        is_matured: isMatured,
        has_replacement: hasReplacement,
      },
    };
  }

  public createRequest(
    db: DatabaseSync,
    data: {
      fdr_id: string;
      institution_id: string;
      request_type: 'RELEASE' | 'DISCHARGE' | 'REFUND';
      reason: string;
    },
    actor: { id: string; name: string; role: string }
  ) {
    const checklist = this.evaluateEligibility(db, data.fdr_id);
    const id = 'rel_' + crypto.randomUUID();
    const nowIso = clock.now().toISOString();

    db.prepare(`
      INSERT INTO release_requests (
        id, fdr_id, institution_id, request_type, status, reason, checklist_results, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'PENDING_RECOMMENDATION', ?, ?, ?, ?)
    `).run(
      id,
      data.fdr_id,
      data.institution_id,
      data.request_type,
      data.reason,
      JSON.stringify(checklist),
      nowIso,
      nowIso
    );

    auditLogger.log(
      db,
      actor,
      'RELEASE_REQUEST_SUBMITTED',
      { type: 'RELEASE_REQUEST', id },
      {
        fdr_id: data.fdr_id,
        request_type: data.request_type,
        checklist_passed: checklist.overallEligible,
      }
    );

    return this.getRequestById(db, id);
  }

  public recommendRequest(
    db: DatabaseSync,
    requestId: string,
    notes: string,
    actor: { id: string; name: string; role: string }
  ) {
    const req = db.prepare('SELECT * FROM release_requests WHERE id = ?').get(requestId) as any;
    if (!req) throw new Error('Release request not found');

    if (req.status !== 'PENDING_RECOMMENDATION') {
      throw new Error(`Cannot recommend request currently in status '${req.status}'`);
    }

    const nowIso = clock.now().toISOString();

    db.prepare(`
      UPDATE release_requests
      SET status = 'RECOMMENDED', recommended_by = ?, recommended_at = ?, recommendation_notes = ?, updated_at = ?
      WHERE id = ?
    `).run(actor.id, nowIso, notes, nowIso, requestId);

    auditLogger.log(
      db,
      actor,
      'RELEASE_REQUEST_RECOMMENDED',
      { type: 'RELEASE_REQUEST', id: requestId },
      { fdr_id: req.fdr_id, notes }
    );

    return this.getRequestById(db, requestId);
  }

  public decideRequest(
    db: DatabaseSync,
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    decisionNotes: string,
    actor: { id: string; name: string; role: string }
  ) {
    const req = db.prepare('SELECT * FROM release_requests WHERE id = ?').get(requestId) as any;
    if (!req) throw new Error('Release request not found');

    if (req.status !== 'RECOMMENDED' && req.status !== 'PENDING_RECOMMENDATION') {
      throw new Error(`Request has already been decided (status: '${req.status}')`);
    }

    // SERVER-SIDE MAKER-CHECKER ENFORCEMENT:
    // 1. Person who recommended cannot approve
    if (req.recommended_by && req.recommended_by === actor.id) {
      auditLogger.log(
        db,
        actor,
        'MAKER_CHECKER_VIOLATION_BLOCKED',
        { type: 'RELEASE_REQUEST', id: requestId },
        {
          attempted_action: 'APPROVE',
          reason: 'Officer who recommended release cannot approve it',
          user_id: actor.id,
        }
      );
      throw new Error('Maker-Checker restriction: The officer who recommended this release request cannot act as the Approving Authority.');
    }

    // 2. Person who verified FDR cannot approve release
    const verificationRows = db.prepare('SELECT verified_by FROM verification_records WHERE fdr_id = ?').all(req.fdr_id) as { verified_by: string }[];
    const verifierIds = verificationRows.map(v => v.verified_by);
    if (verifierIds.includes(actor.id)) {
      auditLogger.log(
        db,
        actor,
        'MAKER_CHECKER_VIOLATION_BLOCKED',
        { type: 'RELEASE_REQUEST', id: requestId },
        {
          attempted_action: 'APPROVE',
          reason: 'Officer who verified the bank FDR cannot approve its release',
          user_id: actor.id,
        }
      );
      throw new Error('Maker-Checker restriction: An officer who performed bank verification on this FDR cannot act as the Approving Authority for its release.');
    }

    const nowIso = clock.now().toISOString();

    db.prepare(`
      UPDATE release_requests
      SET status = ?, approved_by = ?, approved_at = ?, decision_notes = ?, updated_at = ?
      WHERE id = ?
    `).run(decision, actor.id, nowIso, decisionNotes, nowIso, requestId);

    // If APPROVED, update FDR status to RELEASED!
    if (decision === 'APPROVED') {
      db.prepare(`
        UPDATE fdrs
        SET status = 'RELEASED', updated_at = ?
        WHERE id = ?
      `).run(nowIso, req.fdr_id);

      // Refresh flags
      const refreshedFdr = db.prepare('SELECT * FROM fdrs WHERE id = ?').get(req.fdr_id) as any;
      ruleEngine.syncFdrFlags(db, refreshedFdr);
    }

    auditLogger.log(
      db,
      actor,
      decision === 'APPROVED' ? 'RELEASE_REQUEST_APPROVED' : 'RELEASE_REQUEST_REJECTED',
      { type: 'RELEASE_REQUEST', id: requestId },
      { fdr_id: req.fdr_id, decision, decisionNotes }
    );

    return this.getRequestById(db, requestId);
  }

  public getRequestById(db: DatabaseSync, id: string) {
    const req = db.prepare(`
      SELECT 
        r.*,
        f.fdr_number,
        f.issuing_bank,
        f.amount,
        f.maturity_date,
        f.status as fdr_status,
        f.trust_level as fdr_trust_level,
        i.name as institution_name,
        i.code as institution_code,
        u_rec.full_name as recommended_by_name,
        u_app.full_name as approved_by_name
      FROM release_requests r
      JOIN fdrs f ON r.fdr_id = f.id
      JOIN institutions i ON r.institution_id = i.id
      LEFT JOIN users u_rec ON r.recommended_by = u_rec.id
      LEFT JOIN users u_app ON r.approved_by = u_app.id
      WHERE r.id = ?
    `).get(id) as any;

    if (req && req.checklist_results) {
      try {
        req.checklist_results = JSON.parse(req.checklist_results);
      } catch {
        // ignore
      }
    }

    return req;
  }

  public getAllRequests(db: DatabaseSync, status?: string) {
    let query = `
      SELECT 
        r.*,
        f.fdr_number,
        f.issuing_bank,
        f.amount,
        f.maturity_date,
        f.status as fdr_status,
        f.trust_level as fdr_trust_level,
        i.name as institution_name,
        i.code as institution_code,
        u_rec.full_name as recommended_by_name,
        u_app.full_name as approved_by_name
      FROM release_requests r
      JOIN fdrs f ON r.fdr_id = f.id
      JOIN institutions i ON r.institution_id = i.id
      LEFT JOIN users u_rec ON r.recommended_by = u_rec.id
      LEFT JOIN users u_app ON r.approved_by = u_app.id
    `;
    const params: any[] = [];

    if (status && status !== 'ALL') {
      query += ' WHERE r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    for (const r of rows) {
      if (r.checklist_results) {
        try {
          r.checklist_results = JSON.parse(r.checklist_results);
        } catch {
          // ignore
        }
      }
    }
    return rows;
  }
}

export const releaseService = ReleaseService.getInstance();
