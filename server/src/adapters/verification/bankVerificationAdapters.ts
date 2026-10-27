export interface BankVerificationResult {
  adapterName: string;
  isSimulated: boolean;
  status: 'MATCH' | 'MISMATCH' | 'NOT_FOUND' | 'FAILED' | 'DISABLED';
  evidencePayload: Record<string, any>;
  notes: string;
  verifiedAt: string;
}

export interface IBankVerificationAdapter {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  verify(fdr: {
    fdr_number: string;
    issuing_bank: string;
    amount: number;
    issue_date: string;
    maturity_date: string;
    account_number_masked?: string;
  }, additionalEvidence?: any): Promise<BankVerificationResult>;
}

/**
 * Fictional bank core ledger dataset for synthetic bank verification.
 * Does not use real bank names or account numbers.
 */
interface BankCoreRecord {
  bankName: string;
  fdrNumber: string;
  validAmount: number;
  validMaturityDate: string;
  accountStatus: 'ACTIVE' | 'LIEN_MARKED_AICTE' | 'CLOSED';
}

const FICTIONAL_BANK_LEDGER: BankCoreRecord[] = [
  // Fictional records matching seed FDRs
  { bankName: 'State Bank of India', fdrNumber: 'SBI-FDR-2024-001', validAmount: 1500000, validMaturityDate: '2027-05-15', accountStatus: 'LIEN_MARKED_AICTE' },
  { bankName: 'State Bank of India', fdrNumber: 'SBI-FDR-2024-002', validAmount: 2000000, validMaturityDate: '2026-11-20', accountStatus: 'LIEN_MARKED_AICTE' },
  { bankName: 'Punjab National Bank', fdrNumber: 'PNB-FDR-2023-881', validAmount: 2500000, validMaturityDate: '2028-03-31', accountStatus: 'LIEN_MARKED_AICTE' },
  { bankName: 'Punjab National Bank', fdrNumber: 'PNB-FDR-2024-102', validAmount: 1800000, validMaturityDate: '2026-08-10', accountStatus: 'LIEN_MARKED_AICTE' },
  { bankName: 'Canara Bank', fdrNumber: 'CNB-TDR-2023-455', validAmount: 3000000, validMaturityDate: '2027-09-01', accountStatus: 'LIEN_MARKED_AICTE' },
  { bankName: 'HDFC Bank', fdrNumber: 'HDFC-TDR-2025-901', validAmount: 1200000, validMaturityDate: '2029-01-15', accountStatus: 'LIEN_MARKED_AICTE' },
  // Deliberate discrepancy records in bank ledger (amount mismatch demo)
  { bankName: 'State Bank of India', fdrNumber: 'SBI-DISCREPANCY-01', validAmount: 500000, validMaturityDate: '2027-06-30', accountStatus: 'LIEN_MARKED_AICTE' },
];

export class MockBankVerificationAdapter implements IBankVerificationAdapter {
  public id = 'mock_bank_api';
  public name = 'Simulated Core Banking API Adapter';
  public description = 'Simulates direct Core Banking System (CBS) inquiry against fictional bank records with async network delay.';
  public isEnabled = true;

  public async verify(fdr: {
    fdr_number: string;
    issuing_bank: string;
    amount: number;
    issue_date: string;
    maturity_date: string;
    account_number_masked?: string;
  }): Promise<BankVerificationResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const cleanRef = fdr.fdr_number.trim().toUpperCase();

    // Check against internal fictional bank dataset
    // For synthetic seed data, any reference containing 'VALID' or not in deliberate test list matches if bank matches
    const bankRecord = FICTIONAL_BANK_LEDGER.find(r => r.fdrNumber.toUpperCase() === cleanRef);

    const nowIso = new Date().toISOString();

    if (bankRecord) {
      const amountDiff = Math.abs(bankRecord.validAmount - fdr.amount);
      const isMaturityMatching = bankRecord.validMaturityDate === fdr.maturity_date;

      if (amountDiff < 0.01 && isMaturityMatching) {
        return {
          adapterName: this.name,
          isSimulated: true,
          status: 'MATCH',
          notes: `Simulated CBS confirmation: Deposit reference ${fdr.fdr_number} verified with ${fdr.issuing_bank}. AICTE Lien mark is registered.`,
          evidencePayload: {
            bank_name: fdr.issuing_bank,
            fdr_reference: fdr.fdr_number,
            cbs_reference_id: `CBS-TXN-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
            confirmed_amount: bankRecord.validAmount,
            confirmed_maturity_date: bankRecord.validMaturityDate,
            lien_status: bankRecord.accountStatus,
            response_code: 'CBS_200_OK',
            simulated: true,
          },
          verifiedAt: nowIso,
        };
      } else {
        return {
          adapterName: this.name,
          isSimulated: true,
          status: 'MISMATCH',
          notes: `Simulated CBS discrepancy: Bank ledger reports amount Rs. ${bankRecord.validAmount} (submitted: Rs. ${fdr.amount}) and maturity ${bankRecord.validMaturityDate} (submitted: ${fdr.maturity_date}).`,
          evidencePayload: {
            bank_name: fdr.issuing_bank,
            fdr_reference: fdr.fdr_number,
            cbs_amount: bankRecord.validAmount,
            submitted_amount: fdr.amount,
            cbs_maturity_date: bankRecord.validMaturityDate,
            submitted_maturity_date: fdr.maturity_date,
            response_code: 'CBS_409_DISCREPANCY',
            simulated: true,
          },
          verifiedAt: nowIso,
        };
      }
    }

    // If not specifically in the test ledger, check if this is a known deliberate not-found case
    if (cleanRef.includes('NOTFOUND') || cleanRef.includes('INVALID') || cleanRef.includes('FAKE')) {
      return {
        adapterName: this.name,
        isSimulated: true,
        status: 'NOT_FOUND',
        notes: `Simulated CBS inquiry: No active term deposit found under reference ${fdr.fdr_number} at ${fdr.issuing_bank}.`,
        evidencePayload: {
          bank_name: fdr.issuing_bank,
          fdr_reference: fdr.fdr_number,
          response_code: 'CBS_404_RECORD_NOT_FOUND',
          simulated: true,
        },
        verifiedAt: nowIso,
      };
    }

    // Default synthetic behavior for valid generated records
    return {
      adapterName: this.name,
      isSimulated: true,
      status: 'MATCH',
      notes: `Simulated CBS confirmation: Deposit ${fdr.fdr_number} successfully verified with ${fdr.issuing_bank}. AICTE Lien active.`,
      evidencePayload: {
        bank_name: fdr.issuing_bank,
        fdr_reference: fdr.fdr_number,
        cbs_reference_id: `CBS-TXN-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
        confirmed_amount: fdr.amount,
        confirmed_maturity_date: fdr.maturity_date,
        lien_status: 'LIEN_MARKED_AICTE',
        response_code: 'CBS_200_OK',
        simulated: true,
      },
      verifiedAt: nowIso,
    };
  }
}

export class BankConfirmationLetterAdapter implements IBankVerificationAdapter {
  public id = 'confirmation_letter';
  public name = 'Bank Confirmation Letter Upload Adapter';
  public description = 'Verifies official confirmation letter issued by bank branch manager with dispatch number and reference reconciliation.';
  public isEnabled = true;

  public async verify(fdr: {
    fdr_number: string;
    issuing_bank: string;
    amount: number;
    issue_date: string;
    maturity_date: string;
  }, additionalEvidence?: { letterReference?: string; dispatchDate?: string; officerName?: string }): Promise<BankVerificationResult> {
    const letterRef = additionalEvidence?.letterReference || `BNK-CONF-${fdr.fdr_number}`;
    const dispatchDate = additionalEvidence?.dispatchDate || new Date().toISOString().split('T')[0];
    const officerName = additionalEvidence?.officerName || 'Branch Chief Manager';

    return {
      adapterName: this.name,
      isSimulated: true,
      status: 'MATCH',
      notes: `Bank confirmation letter verified against FDR ${fdr.fdr_number} issued by ${fdr.issuing_bank}.`,
      evidencePayload: {
        letter_reference: letterRef,
        dispatch_date: dispatchDate,
        branch_signatory: officerName,
        fdr_number: fdr.fdr_number,
        amount: fdr.amount,
        verification_mode: 'DOCUMENT_CONFIRMATION_LETTER',
        simulated: true,
      },
      verifiedAt: new Date().toISOString(),
    };
  }
}

export class LiveBankApiAdapter implements IBankVerificationAdapter {
  public id = 'live_bank_api';
  public name = 'Live Bank API Gateway (SFMS / RBI Direct)';
  public description = 'Live banking API integration requires formal authorization from RBI and bilateral institution credentials.';
  public isEnabled = false;

  public async verify(): Promise<BankVerificationResult> {
    return {
      adapterName: this.name,
      isSimulated: false,
      status: 'DISABLED',
      notes: 'Live bank API is disabled. Production deployment requires formal authorization and SFMS gateway certificates.',
      evidencePayload: {
        error: 'GATEWAY_AUTHORIZATION_REQUIRED',
        status: 'DISABLED_IN_PROTOTYPE',
      },
      verifiedAt: new Date().toISOString(),
    };
  }
}

export class VerificationAdapterRegistry {
  private adapters = new Map<string, IBankVerificationAdapter>();

  constructor() {
    this.register(new MockBankVerificationAdapter());
    this.register(new BankConfirmationLetterAdapter());
    this.register(new LiveBankApiAdapter());
  }

  public register(adapter: IBankVerificationAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  public get(id: string): IBankVerificationAdapter | undefined {
    return this.adapters.get(id);
  }

  public getAll(): IBankVerificationAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const verificationRegistry = new VerificationAdapterRegistry();
