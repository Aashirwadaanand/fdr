import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { clock } from '../clock/clock';
import { ruleEngine } from '../rules/ruleEngine';
import { authService } from '../auth/authService';
import { initializeSchema } from '../db/database';

export class SeedService {
  private static instance: SeedService;

  private constructor() {}

  public static getInstance(): SeedService {
    if (!SeedService.instance) {
      SeedService.instance = new SeedService();
    }
    return SeedService.instance;
  }

  public seedAll(db: DatabaseSync): {
    institutionsCount: number;
    banksCount: number;
    fdrsCount: number;
    deliberateErrorsCount: number;
    errorsBreakdown: Record<string, number>;
  } {
    // Reset clock to 2026-10-27
    clock.reset();

    // Clear dynamic operational tables
    db.exec(`
      DELETE FROM fdr_flags;
      DELETE FROM verification_records;
      DELETE FROM fdr_documents;
      DELETE FROM observations;
      DELETE FROM release_requests;
      DELETE FROM escalation_events;
      DELETE FROM notifications;
      DELETE FROM fdrs;
      DELETE FROM institutions WHERE id != 'inst_001';
    `);

    // Ensure demo users exist
    authService.seedDemoUsers();

    // 1. Generate 40 Fictional Institutions
    const states = [
      { state: 'Delhi', district: 'South Delhi' },
      { state: 'Maharashtra', district: 'Pune' },
      { state: 'Karnataka', district: 'Bengaluru Urban' },
      { state: 'Tamil Nadu', district: 'Chennai' },
      { state: 'Uttar Pradesh', district: 'Noida' },
      { state: 'Gujarat', district: 'Ahmedabad' },
      { state: 'West Bengal', district: 'Kolkata' },
      { state: 'Kerala', district: 'Ernakulam' },
      { state: 'Telangana', district: 'Hyderabad' },
      { state: 'Punjab', district: 'Ludhiana' },
    ];

    const categories = ['Engineering', 'Management', 'Pharmacy', 'Polytechnic', 'MCA/IT'];

    const insertInst = db.prepare(`
      INSERT INTO institutions (id, code, name, state, district, category, email, phone, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);

    const institutionIds: string[] = ['inst_001'];

    for (let i = 2; i <= 40; i++) {
      const id = `inst_${String(i).padStart(3, '0')}`;
      institutionIds.push(id);
      const st = states[(i - 1) % states.length];
      const cat = categories[(i - 1) % categories.length];
      const code = `AICTE-${st.state.substring(0, 2).toUpperCase()}-${cat.substring(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`;
      const name = `${st.state} Academy of ${cat} Sciences & Advanced Technology #${i}`;

      insertInst.run(
        id,
        code,
        name,
        st.state,
        st.district,
        cat,
        `admin@inst${i}.edu.in`,
        `+91-${9800000000 + i}`,
        clock.now().toISOString()
      );
    }

    // 2. Fictional Banks (4 mainstream synthetic banks)
    const fictionalBanks = [
      'Apex National Commercial Bank',
      'Federal Trust Bank of India',
      'United Sovereign Bank',
      'Canal Mercantile Bank',
    ];

    // 3. Generate 200 FDRs with EXACTLY 30 Deliberate Errors (5 of each of the 6 types)
    const deliberateErrors = {
      missing_field: 0,
      duplicate_reference: 0,
      bad_dates: 0,
      bad_amount: 0,
      extracted_mismatch: 0,
      overdue_but_active: 0,
    };

    const insertFdr = db.prepare(`
      INSERT INTO fdrs (
        id, institution_id, fdr_number, issuing_bank, branch_name, ifsc_code,
        account_number_masked, amount, issue_date, maturity_date, interest_rate,
        status, trust_level, replaces_fdr_id, purpose, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDoc = db.prepare(`
      INSERT INTO fdr_documents (
        id, fdr_id, version, filename, original_name, mime_type, file_size,
        sha256_hash, storage_path, extracted_data, uploaded_by, uploaded_at
      )
      VALUES (?, ?, 1, ?, ?, 'application/pdf', 245000, ?, ?, ?, 'usr_admin_001', ?)
    `);

    const sharedHash = crypto.createHash('sha256').update('SYNTHETIC_SHARED_CERTIFICATE_DUMMY_PDF').digest('hex');

    // We will generate 200 total FDRs
    for (let i = 1; i <= 200; i++) {
      const fdrId = `fdr_seed_${String(i).padStart(3, '0')}`;
      const instId = institutionIds[(i - 1) % institutionIds.length];
      const bank = fictionalBanks[(i - 1) % fictionalBanks.length];

      let fdrNumber = `FDR-${bank.split(' ').map(w => w[0]).join('')}-2024-${String(i).padStart(4, '0')}`;
      let amount = 1000000 + ((i * 12345) % 4000000);
      let issueDate = '2024-03-15';
      let maturityDate = '2027-03-15';
      let status = 'ACTIVE';
      let trustLevel = 'BANK_CONFIRMED';
      let hasDocument = true;
      let hasExtractedMismatch = false;

      // DELIBERATE ERRORS: exactly 5 each

      // Error Type 1: MISSING_REQUIRED_FIELD (records 1 to 5)
      if (i >= 1 && i <= 5) {
        fdrNumber = ''; // missing fdr number
        status = 'SUBMITTED';
        trustLevel = 'DECLARED';
        hasDocument = false;
        deliberateErrors.missing_field++;
      }
      // Error Type 2: DUPLICATE_REFERENCE (records 6 to 10)
      else if (i >= 6 && i <= 10) {
        // Will share identical reference with another record
        fdrNumber = `FDR-DUP-SYNTHETIC-00${i - 5}`;
        status = 'SUBMITTED';
        trustLevel = 'DECLARED';
        deliberateErrors.duplicate_reference++;
      }
      // Error Type 3: INVALID_DATE_SEQUENCE (records 11 to 15)
      else if (i >= 11 && i <= 15) {
        issueDate = '2027-05-01';
        maturityDate = '2024-05-01'; // issue date is AFTER maturity date!
        status = 'SUBMITTED';
        trustLevel = 'DECLARED';
        deliberateErrors.bad_dates++;
      }
      // Error Type 4: NON_POSITIVE_AMOUNT (records 16 to 20)
      else if (i >= 16 && i <= 20) {
        amount = 0; // zero deposit amount!
        status = 'SUBMITTED';
        trustLevel = 'DECLARED';
        deliberateErrors.bad_amount++;
      }
      // Error Type 5: EXTRACTED_VS_SUBMITTED_MISMATCH (records 21 to 25)
      else if (i >= 21 && i <= 25) {
        amount = 2500000;
        status = 'UNDER_SCRUTINY';
        trustLevel = 'DOCUMENT_EXTRACTED';
        hasExtractedMismatch = true; // OCR will say Rs. 15,00,000 while form submitted 25,00,000!
        deliberateErrors.extracted_mismatch++;
      }
      // Error Type 6: OVERDUE_BUT_ACTIVE (records 26 to 30)
      else if (i >= 26 && i <= 30) {
        issueDate = '2022-01-10';
        maturityDate = '2025-01-10'; // In the past relative to 2026-10-27!
        status = 'ACTIVE'; // Matured and overdue, but improperly left ACTIVE!
        trustLevel = 'BANK_CONFIRMED';
        deliberateErrors.overdue_but_active++;
      }
      // Clean records (records 31 to 200)
      else {
        // Diversify statuses
        if (i % 8 === 0) {
          status = 'SUBMITTED';
          trustLevel = 'DECLARED';
        } else if (i % 7 === 0) {
          status = 'UNDER_SCRUTINY';
          trustLevel = 'DOCUMENT_EXTRACTED';
        } else if (i % 5 === 0) {
          status = 'EXPIRING';
          issueDate = '2023-11-20';
          maturityDate = '2026-11-20'; // expiring in ~24 days
          trustLevel = 'BANK_CONFIRMED';
        } else if (i % 11 === 0) {
          status = 'MATURED';
          issueDate = '2022-04-01';
          maturityDate = '2026-04-01';
          trustLevel = 'BANK_CONFIRMED';
        } else {
          status = 'ACTIVE';
          trustLevel = 'BANK_CONFIRMED';
        }
      }

      // Insert second duplicate record for the 5 duplicate references (records 31 to 35)
      if (i >= 31 && i <= 35) {
        fdrNumber = `FDR-DUP-SYNTHETIC-00${i - 30}`;
      }

      insertFdr.run(
        fdrId,
        instId,
        fdrNumber,
        bank,
        `Corporate Branch - ${instId}`,
        `ANCB000${String(i).padStart(4, '0')}`,
        `XXXX-XXXX-${String(i * 1111).slice(-4)}`,
        amount,
        issueDate,
        maturityDate,
        7.25,
        status,
        trustLevel,
        null,
        'AICTE Security Deposit',
        clock.now().toISOString(),
        clock.now().toISOString()
      );

      // Attach document
      if (hasDocument) {
        const docId = `doc_seed_${String(i).padStart(3, '0')}`;
        // Deliberately reuse document hash on records 36, 37, 38
        const docHash = (i >= 36 && i <= 38)
          ? sharedHash
          : crypto.createHash('sha256').update(`DOC_CONTENT_${fdrId}_${i}`).digest('hex');

        let extractedPayload: any = {
          engine: 'Simulated OCR & Regex Extraction Engine (AICTE Regulatory Model)',
          isSimulated: true,
          confidenceScore: 0.95,
          extractedFields: {
            fdr_number: fdrNumber,
            issuing_bank: bank,
            amount: hasExtractedMismatch ? 1500000 : amount, // mismatch if flagged!
            issue_date: issueDate,
            maturity_date: maturityDate,
          },
        };

        insertDoc.run(
          docId,
          fdrId,
          `cert_${fdrNumber || 'deposit'}.pdf`,
          `FDR_Certificate_${fdrNumber || 'scan'}.pdf`,
          docHash,
          `uploads/mock_${fdrId}.pdf`,
          JSON.stringify(extractedPayload),
          clock.now().toISOString()
        );
      }
    }

    // Run rule engine scan across all 200 FDRs to generate flags
    const allFdrs = db.prepare('SELECT * FROM fdrs').all() as any[];
    for (const f of allFdrs) {
      ruleEngine.syncFdrFlags(db, f);
    }

    return {
      institutionsCount: 40,
      banksCount: fictionalBanks.length,
      fdrsCount: 200,
      deliberateErrorsCount: 30,
      errorsBreakdown: deliberateErrors,
    };
  }
}

export const seedService = SeedService.getInstance();
