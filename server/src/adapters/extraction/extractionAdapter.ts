export interface ExtractedFdrFields {
  fdr_number?: string;
  issuing_bank?: string;
  branch_name?: string;
  account_number_masked?: string;
  amount?: number;
  issue_date?: string; // YYYY-MM-DD
  maturity_date?: string; // YYYY-MM-DD
  interest_rate?: number;
}

export interface ExtractionResult {
  engine: string;
  isSimulated: boolean;
  confidenceScore: number;
  extractedFields: ExtractedFdrFields;
  rawText: string;
  warnings?: string[];
}

export interface IExtractionAdapter {
  extractFromText(text: string): Promise<ExtractionResult>;
  extractFromBuffer(buffer: Buffer, mimeType: string): Promise<ExtractionResult>;
}

export class SimulatedOcrExtractionAdapter implements IExtractionAdapter {
  public async extractFromBuffer(buffer: Buffer, _mimeType: string): Promise<ExtractionResult> {
    // Convert text or ASCII representation from buffer
    const text = buffer.toString('utf-8');
    return this.extractFromText(text);
  }

  public async extractFromText(text: string): Promise<ExtractionResult> {
    const fields: ExtractedFdrFields = {};
    const warnings: string[] = [];
    let fieldsFound = 0;

    // 1. Extract FDR Reference Number (e.g. FDR Ref No: SBI-FDR-2024-001, Ref No: 12345678, etc.)
    const fdrLabeledMatch = text.match(/(?:FDR|TDR|Receipt|Deposit|Ref(?:erence)?)\s*(?:Ref(?:erence)?|Receipt)?\s*(?:No\.?|#|Number|ID)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{4,25})/i);
    if (fdrLabeledMatch) {
      fields.fdr_number = fdrLabeledMatch[1].trim();
      fieldsFound++;
    } else {
      // Look for standard reference patterns like SBI-FDR-2024-001, PNB-FDR-..., etc.
      const patternMatch = text.match(/\b([A-Z]{2,6}[-_][A-Z0-9]{2,6}[-_][A-Z0-9\-_]{3,15})\b/i);
      if (patternMatch) {
        fields.fdr_number = patternMatch[1].trim();
        fieldsFound++;
      } else {
        const fallbackMatch = text.match(/\b([A-Z]{3,4}[0-9]{6,12})\b/);
        if (fallbackMatch) {
          fields.fdr_number = fallbackMatch[1].trim();
          fieldsFound++;
        }
      }
    }

    // 2. Extract Bank Name
    const banks = [
      'State Bank of India',
      'Punjab National Bank',
      'Canara Bank',
      'HDFC Bank',
      'Bank of Baroda',
      'Union Bank of India',
      'ICICI Bank',
      'Axis Bank'
    ];
    for (const bank of banks) {
      if (new RegExp(bank, 'i').test(text)) {
        fields.issuing_bank = bank;
        fieldsFound++;
        break;
      }
    }

    // 3. Extract Branch
    const branchMatch = text.match(/Branch(?:\s*Name)?\s*[:\-]?\s*([A-Za-z0-9\s,\.]{3,35})(?:\r|\n|$|,)/i);
    if (branchMatch) {
      fields.branch_name = branchMatch[1].trim();
      fieldsFound++;
    }

    // 4. Extract Amount (e.g. Rs. 15,00,000 or INR 2500000 or Amount: 1000000)
    const amountMatch = text.match(/(?:(?:Rs\.?|INR|Amount|Principal|Deposit\s*Sum)\s*[:\-]?\s*)(?:Rs\.?)?\s*([\d,]+(?:\.\d{2})?)/i);
    if (amountMatch) {
      const cleanAmt = amountMatch[1].replace(/,/g, '');
      const parsedAmt = parseFloat(cleanAmt);
      if (!isNaN(parsedAmt)) {
        fields.amount = parsedAmt;
        fieldsFound++;
      }
    }

    // 5. Extract Dates
    // Matches DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD
    const dateRegexStr = '(\\d{4}-\\d{2}-\\d{2}|\\d{2}[\\/\\-]\\d{2}[\\/\\-]\\d{4})';

    // Issue Date
    const issueDateMatch = text.match(new RegExp(`(?:Issue\\s*Date|Date\\s*of\\s*Issue|Deposit\\s*Date)\\s*[:\\-]?\\s*${dateRegexStr}`, 'i'));
    if (issueDateMatch) {
      fields.issue_date = this.normalizeDate(issueDateMatch[1]);
      fieldsFound++;
    }

    // Maturity Date
    const maturityDateMatch = text.match(new RegExp(`(?:Maturity\\s*Date|Due\\s*Date|Date\\s*of\\s*Maturity)\\s*[:\\-]?\\s*${dateRegexStr}`, 'i'));
    if (maturityDateMatch) {
      fields.maturity_date = this.normalizeDate(maturityDateMatch[1]);
      fieldsFound++;
    }

    // 6. Extract Account Number (Masked)
    const acctMatch = text.match(/(?:A\/C|Account|Deposit\s*A\/c)\s*(?:No\.?|#)?\s*[:\-]?\s*([A-Z0-9\-\*]{6,20})/i);
    if (acctMatch) {
      const rawAcct = acctMatch[1].replace(/[\s\-]/g, '');
      if (rawAcct.length >= 4) {
        fields.account_number_masked = 'XXXX-XXXX-' + rawAcct.slice(-4);
      } else {
        fields.account_number_masked = 'XXXX-XXXX-' + rawAcct;
      }
      fieldsFound++;
    }

    // Confidence score based on key fields detected
    const totalKeyFields = 5; // fdr_number, bank, amount, issue_date, maturity_date
    const confidenceScore = Math.min(1.0, Math.round((fieldsFound / totalKeyFields) * 100) / 100);

    if (!fields.fdr_number) warnings.push('FDR Reference Number could not be detected with high confidence');
    if (!fields.amount) warnings.push('Principal deposit amount could not be parsed');
    if (!fields.maturity_date) warnings.push('Maturity date could not be parsed');

    return {
      engine: 'Simulated OCR & Regex Extraction Engine (AICTE Regulatory Model)',
      isSimulated: true,
      confidenceScore,
      extractedFields: fields,
      rawText: text,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private normalizeDate(dateStr: string): string {
    // If format is DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateStr)) {
      const parts = dateStr.split(/[\/\-]/);
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  }
}

export const extractionAdapter: IExtractionAdapter = new SimulatedOcrExtractionAdapter();
