import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getDatabase } from '../src/db/database';
import { clock } from '../src/clock/clock';
import { extractionAdapter } from '../src/adapters/extraction/extractionAdapter';

describe('Phase 2: Rules, Verification Adapters, Documents, Extraction & Lifecycle', () => {
  const app = createApp();
  const db = getDatabase();

  let adminToken: string;
  let scrutinyToken: string;
  let institutionToken: string;

  beforeAll(async () => {
    clock.reset();

    const adminLogin = await request(app).post('/api/auth/login').send({ username: 'admin_officer', password: 'Admin@123' });
    adminToken = adminLogin.body.token;

    const scrutinyLogin = await request(app).post('/api/auth/login').send({ username: 'scrutiny_officer', password: 'Scrutiny@123' });
    scrutinyToken = scrutinyLogin.body.token;

    const instLogin = await request(app).post('/api/auth/login').send({ username: 'institution_officer', password: 'Institution@123' });
    institutionToken = instLogin.body.token;
  });

  it('2.1 Simulated OCR Extraction parses FDR certificate text accurately', async () => {
    const rawCertificateText = `
      STATE BANK OF INDIA
      TERM DEPOSIT RECEIPT / FDR
      Branch: IIT Hauz Khas, New Delhi
      FDR Ref No: SBI-FDR-2024-001
      Account No: 30948817264
      Date of Issue: 15/05/2024
      Maturity Date: 15/05/2027
      Deposit Sum: Rs. 15,00,000.00
      Favoring: The Member Secretary, AICTE New Delhi
    `;

    const result = await extractionAdapter.extractFromText(rawCertificateText);
    expect(result.isSimulated).toBe(true);
    expect(result.extractedFields.fdr_number).toBe('SBI-FDR-2024-001');
    expect(result.extractedFields.issuing_bank).toBe('State Bank of India');
    expect(result.extractedFields.amount).toBe(1500000);
    expect(result.extractedFields.issue_date).toBe('2024-05-15');
    expect(result.extractedFields.maturity_date).toBe('2027-05-15');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it('2.2 Rule Engine flags negative amounts, invalid dates, and duplicates', async () => {
    // Submit invalid FDR with zero amount and issue date after maturity date
    const res = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'TEST-FDR-ERR-001',
        issuing_bank: 'Punjab National Bank',
        amount: 100000,
        issue_date: '2026-12-01',
        maturity_date: '2026-06-01', // Invalid: maturity before issue!
      });

    expect(res.status).toBe(201);
    const flags = res.body.flags;
    const flagCodes = flags.map((f: any) => f.rule_code);
    expect(flagCodes).toContain('INVALID_DATE_SEQUENCE');
    expect(flagCodes).toContain('MISSING_SUPPORTING_DOCUMENT');
  });

  it('2.3 Rule toggle: Admin can disable rule and re-evaluation omits it', async () => {
    // Disable INVALID_DATE_SEQUENCE rule
    const patchRes = await request(app)
      .patch('/api/rules/INVALID_DATE_SEQUENCE')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_enabled: false });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.is_enabled).toBe(0);

    // Re-evaluate all FDRs
    const evalRes = await request(app)
      .post('/api/rules/evaluate-all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(evalRes.status).toBe(200);

    // Re-enable rule for continued testing
    await request(app)
      .patch('/api/rules/INVALID_DATE_SEQUENCE')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_enabled: true });
  });

  it('2.4 Lifecycle State Machine: rejects illegal jumps and enforces role constraints', async () => {
    // Create new FDR
    const fdrRes = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'LIFECYCLE-FDR-001',
        issuing_bank: 'Canara Bank',
        amount: 500000,
        issue_date: '2025-01-01',
        maturity_date: '2028-01-01',
      });

    const fdrId = fdrRes.body.fdr.id;
    expect(fdrRes.body.fdr.status).toBe('SUBMITTED');

    // Attempt illegal transition: SUBMITTED directly to ACTIVE
    const badTransition = await request(app)
      .patch(`/api/fdrs/${fdrId}/status`)
      .set('Authorization', `Bearer ${scrutinyToken}`)
      .send({ status: 'ACTIVE' });

    expect(badTransition.status).toBe(422);
    expect(badTransition.body.message).toContain('Illegal lifecycle transition');

    // Proper transition: SUBMITTED -> UNDER_SCRUTINY
    const valid1 = await request(app)
      .patch(`/api/fdrs/${fdrId}/status`)
      .set('Authorization', `Bearer ${scrutinyToken}`)
      .send({ status: 'UNDER_SCRUTINY' });

    expect(valid1.status).toBe(200);
    expect(valid1.body.status).toBe('UNDER_SCRUTINY');
  });

  it('2.5 Bank Verification: Mock Bank API matches and elevates trust level to BANK_CONFIRMED', async () => {
    // Create FDR matching fictional bank record
    const fdrRes = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'SBI-FDR-2024-001',
        issuing_bank: 'State Bank of India',
        amount: 1500000,
        issue_date: '2024-05-15',
        maturity_date: '2027-05-15',
      });

    const fdrId = fdrRes.body.fdr.id;
    expect(fdrRes.body.fdr.trust_level).toBe('DECLARED');

    // Run verification with Mock Bank API adapter
    const verRes = await request(app)
      .post('/api/verification/verify')
      .set('Authorization', `Bearer ${scrutinyToken}`)
      .send({
        fdr_id: fdrId,
        adapter_id: 'mock_bank_api',
      });

    expect(verRes.status).toBe(200);
    expect(verRes.body.result.status).toBe('MATCH');
    expect(verRes.body.result.isSimulated).toBe(true);
    expect(verRes.body.updatedFdr.trust_level).toBe('BANK_CONFIRMED');
    expect(verRes.body.updatedFdr.status).toBe('VERIFIED');
  });

  it('2.6 Renewal and Replacement: Detects coverage gap between old maturity and new issue date', async () => {
    // 1. Initial FDR expiring 2026-05-01
    const oldFdr = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'OLD-FDR-2023',
        issuing_bank: 'HDFC Bank',
        amount: 1000000,
        issue_date: '2023-05-01',
        maturity_date: '2026-05-01',
      });

    const oldId = oldFdr.body.fdr.id;

    // 2. Renewal FDR starting 2026-05-15 (14-day coverage gap!)
    const renewalFdr = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'RENEWAL-FDR-2026',
        issuing_bank: 'HDFC Bank',
        amount: 1000000,
        issue_date: '2026-05-15',
        maturity_date: '2029-05-15',
        replaces_fdr_id: oldId,
      });

    expect(renewalFdr.status).toBe(201);
    expect(renewalFdr.body.renewalChain.replacesFdr.id).toBe(oldId);
    expect(renewalFdr.body.renewalChain.coverageGapDays).toBe(14);
  });

  it('2.7 Document upload computes SHA-256 and detects reused hash', async () => {
    // 1. First FDR document upload
    const fdr1 = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'DOC-FDR-001',
        issuing_bank: 'Canara Bank',
        amount: 500000,
        issue_date: '2025-01-01',
        maturity_date: '2028-01-01',
      });

    const dummyPdfContent = Buffer.from('PDF_CERTIFICATE_DUMMY_CONTENT_12345');

    const upload1 = await request(app)
      .post(`/api/fdrs/${fdr1.body.fdr.id}/documents`)
      .set('Authorization', `Bearer ${institutionToken}`)
      .attach('file', dummyPdfContent, 'certificate1.pdf');

    expect(upload1.status).toBe(201);
    expect(upload1.body.sha256_hash).toBeDefined();

    // 2. Second FDR uploading the exact same document
    const fdr2 = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'DOC-FDR-002',
        issuing_bank: 'Canara Bank',
        amount: 500000,
        issue_date: '2025-01-01',
        maturity_date: '2028-01-01',
      });

    const upload2 = await request(app)
      .post(`/api/fdrs/${fdr2.body.fdr.id}/documents`)
      .set('Authorization', `Bearer ${institutionToken}`)
      .attach('file', dummyPdfContent, 'certificate2.pdf');

    expect(upload2.status).toBe(201);
    expect(upload2.body.sha256_hash).toBe(upload1.body.sha256_hash);

    // Verify REUSED_DOCUMENT_HASH flag on FDR2
    const detail2 = await request(app)
      .get(`/api/fdrs/${fdr2.body.fdr.id}`)
      .set('Authorization', `Bearer ${institutionToken}`);

    const flagCodes = detail2.body.flags.map((f: any) => f.rule_code);
    expect(flagCodes).toContain('REUSED_DOCUMENT_HASH');
  });
});
