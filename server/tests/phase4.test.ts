import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getDatabase } from '../src/db/database';
import { clock } from '../src/clock/clock';

describe('Phase 4: Release Workflow, Maker-Checker Enforcement & Reports', () => {
  const app = createApp();
  const db = getDatabase();

  let adminToken: string;
  let scrutinyToken: string;
  let approverToken: string;
  let institutionToken: string;

  beforeAll(async () => {
    clock.reset();

    const adminLogin = await request(app).post('/api/auth/login').send({ username: 'admin_officer', password: 'Admin@123' });
    adminToken = adminLogin.body.token;

    const scrutinyLogin = await request(app).post('/api/auth/login').send({ username: 'scrutiny_officer', password: 'Scrutiny@123' });
    scrutinyToken = scrutinyLogin.body.token;

    const approverLogin = await request(app).post('/api/auth/login').send({ username: 'approving_officer', password: 'Approver@123' });
    approverToken = approverLogin.body.token;

    const instLogin = await request(app).post('/api/auth/login').send({ username: 'institution_officer', password: 'Institution@123' });
    institutionToken = instLogin.body.token;
  });

  it('4.1 Automated Eligibility Checklist evaluates release prerequisites', async () => {
    // Create an unverified FDR
    const fdrRes = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'ELIG-TEST-FDR-001',
        issuing_bank: 'State Bank of India',
        amount: 1500000,
        issue_date: '2023-01-01',
        maturity_date: '2026-01-01',
      });

    const fdrId = fdrRes.body.fdr.id;

    // Check eligibility before bank verification - should fail isBankConfirmed
    const check1 = await request(app)
      .get(`/api/release/eligibility/${fdrId}`)
      .set('Authorization', `Bearer ${institutionToken}`);

    expect(check1.status).toBe(200);
    expect(check1.body.isBankConfirmed).toBe(false);
    expect(check1.body.overallEligible).toBe(false);

    // Verify FDR with Mock Bank API
    await request(app)
      .post('/api/verification/verify')
      .set('Authorization', `Bearer ${scrutinyToken}`)
      .send({ fdr_id: fdrId, adapter_id: 'mock_bank_api' });

    // Check eligibility after verification (matured instrument) - should now pass
    const check2 = await request(app)
      .get(`/api/release/eligibility/${fdrId}`)
      .set('Authorization', `Bearer ${institutionToken}`);

    expect(check2.status).toBe(200);
    expect(check2.body.isBankConfirmed).toBe(true);
    expect(check2.body.overallEligible).toBe(true);
  });

  it('4.2 Full Release Workflow: Maker 1 (submit) -> Maker 2 (recommend) -> Checker (approve)', async () => {
    // 1. Create and verify FDR
    const fdrRes = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'WORKFLOW-REL-001',
        issuing_bank: 'Punjab National Bank',
        amount: 2000000,
        issue_date: '2023-05-01',
        maturity_date: '2026-05-01',
      });

    const fdrId = fdrRes.body.fdr.id;

    // 2. Institution Officer submits release request
    const relRes = await request(app)
      .post('/api/release')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        fdr_id: fdrId,
        request_type: 'RELEASE',
        reason: 'Institution has completed statutory compliance obligation for term deposit.',
      });

    expect(relRes.status).toBe(201);
    const reqId = relRes.body.id;
    expect(relRes.body.status).toBe('PENDING_RECOMMENDATION');

    // 3. Scrutiny Officer recommends release
    const recRes = await request(app)
      .post(`/api/release/${reqId}/recommend`)
      .set('Authorization', `Bearer ${scrutinyToken}`)
      .send({ notes: 'Documents verified and no pending audit objections. Recommended for release.' });

    expect(recRes.status).toBe(200);
    expect(recRes.body.status).toBe('RECOMMENDED');

    // 4. Approving Authority approves release (independent checker)
    const decRes = await request(app)
      .post(`/api/release/${reqId}/decide`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ decision: 'APPROVED', decision_notes: 'Lien discharge sanctioned by Bureau Head.' });

    expect(decRes.status).toBe(200);
    expect(decRes.body.status).toBe('APPROVED');

    // Verify FDR status updated to RELEASED
    const fdrDetail = await request(app).get(`/api/fdrs/${fdrId}`).set('Authorization', `Bearer ${institutionToken}`);
    expect(fdrDetail.body.fdr.status).toBe('RELEASED');
  });

  it('4.3 Maker-Checker Enforcement: Recommending officer CANNOT approve their own recommendation', async () => {
    // 1. Create FDR
    const fdrRes = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'MAKER-CHECKER-001',
        issuing_bank: 'Canara Bank',
        amount: 1000000,
        issue_date: '2023-01-01',
        maturity_date: '2026-01-01',
      });
    const fdrId = fdrRes.body.fdr.id;

    // 2. Submit release
    const relRes = await request(app)
      .post('/api/release')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        fdr_id: fdrId,
        request_type: 'RELEASE',
        reason: 'Mandate concluded successfully.',
      });
    const reqId = relRes.body.id;

    // 3. Admin recommends release
    await request(app)
      .post(`/api/release/${reqId}/recommend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Recommended by admin' });

    // 4. Same admin attempts to approve -> MUST BE REJECTED with 403 Maker-Checker violation!
    const badApprove = await request(app)
      .post(`/api/release/${reqId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED', decision_notes: 'Self approval attempt' });

    expect(badApprove.status).toBe(403);
    expect(badApprove.body.error).toBe('Maker-Checker Violation');
    expect(badApprove.body.message).toContain('Maker-Checker restriction');

    // Verify violation logged to audit trail
    const auditRows = db.prepare('SELECT * FROM audit_entries WHERE action = ? ORDER BY sequence DESC LIMIT 1')
      .get('MAKER_CHECKER_VIOLATION_BLOCKED') as any;

    expect(auditRows).toBeDefined();
  });

  it('4.4 Dashboard statistics returns complete KPIs and aging buckets', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalFdrs).toBeGreaterThan(0);
    expect(res.body.counts).toBeDefined();
    expect(res.body.agingBuckets).toBeDefined();
    expect(Array.isArray(res.body.bankBreakdown)).toBe(true);
    expect(Array.isArray(res.body.riskWorklist)).toBe(true);
  });

  it('4.5 Reports API generates CSV export for pending verifications and upcoming maturities', async () => {
    const pendingCsvRes = await request(app)
      .get('/api/reports/pending-verifications?format=csv')
      .set('Authorization', `Bearer ${scrutinyToken}`);

    expect(pendingCsvRes.status).toBe(200);
    expect(pendingCsvRes.header['content-type']).toContain('text/csv');
    expect(pendingCsvRes.text).toContain('fdr_number,issuing_bank,amount');

    const maturitiesCsvRes = await request(app)
      .get('/api/reports/upcoming-maturities?format=csv')
      .set('Authorization', `Bearer ${scrutinyToken}`);

    expect(maturitiesCsvRes.status).toBe(200);
    expect(maturitiesCsvRes.header['content-type']).toContain('text/csv');
  });
});
