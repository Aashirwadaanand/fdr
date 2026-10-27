import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { clock } from '../clock/clock';
import { fdrService } from './fdrService';
import { auditLogger } from '../audit/auditLogger';

export interface RowError {
  rowNumber: number;
  fdrNumber?: string;
  reasons: string[];
  rawData: Record<string, string>;
}

export interface BulkImportResult {
  totalRows: number;
  importedCount: number;
  failedCount: number;
  importedIds: string[];
  errors: RowError[];
}

export class ImportService {
  private static instance: ImportService;

  private constructor() {}

  public static getInstance(): ImportService {
    if (!ImportService.instance) {
      ImportService.instance = new ImportService();
    }
    return ImportService.instance;
  }

  public parseCsv(csvText: string): Record<string, string>[] {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Basic CSV field parser handling quoted strings with commas
      const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
      const values: string[] = [];
      let match;
      while ((match = regex.exec(lines[i])) !== null) {
        let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
        values.push(val ? val.trim() : '');
      }

      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      rows.push(row);
    }

    return rows;
  }

  public importFdrs(
    db: DatabaseSync,
    csvContent: string,
    actor: { id: string; name: string; role: string }
  ): BulkImportResult {
    const rows = this.parseCsv(csvContent);
    const errors: RowError[] = [];
    const importedIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const row = rows[i];
      const rowReasons: string[] = [];

      const fdrNumber = row['fdr_number'] || row['reference_no'] || row['fdr_no'] || '';
      const bank = row['issuing_bank'] || row['bank'] || '';
      const institutionCode = row['institution_code'] || row['inst_code'] || '';
      const rawAmount = row['amount'] || row['deposit_amount'] || '';
      const issueDate = row['issue_date'] || '';
      const maturityDate = row['maturity_date'] || '';

      // Validate required fields
      if (!fdrNumber) rowReasons.push('Missing FDR reference number');
      if (!bank) rowReasons.push('Missing issuing bank');
      if (!institutionCode) rowReasons.push('Missing institution code');
      if (!issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) rowReasons.push('Invalid issue date format (YYYY-MM-DD required)');
      if (!maturityDate || !/^\d{4}-\d{2}-\d{2}$/.test(maturityDate)) rowReasons.push('Invalid maturity date format (YYYY-MM-DD required)');

      const amount = parseFloat(rawAmount.replace(/,/g, ''));
      if (isNaN(amount) || amount <= 0) {
        rowReasons.push('Amount must be a positive numeric value');
      }

      if (issueDate && maturityDate && issueDate >= maturityDate) {
        rowReasons.push(`Issue date (${issueDate}) cannot be on or after maturity date (${maturityDate})`);
      }

      // Lookup institution
      let institutionId = '';
      if (institutionCode) {
        const inst = db.prepare('SELECT id FROM institutions WHERE LOWER(code) = LOWER(?)').get(institutionCode) as { id: string } | undefined;
        if (!inst) {
          rowReasons.push(`Institution code '${institutionCode}' not found in registry`);
        } else {
          institutionId = inst.id;
        }
      }

      // Check duplicate FDR reference
      if (fdrNumber) {
        const dup = db.prepare('SELECT id FROM fdrs WHERE LOWER(fdr_number) = LOWER(?)').get(fdrNumber.trim());
        if (dup) {
          rowReasons.push(`FDR reference '${fdrNumber}' already exists in portal`);
        }
      }

      if (rowReasons.length > 0) {
        errors.push({
          rowNumber: rowNum,
          fdrNumber: fdrNumber || undefined,
          reasons: rowReasons,
          rawData: row,
        });
        continue;
      }

      // Insert valid row
      try {
        const newFdr = fdrService.createFdr(
          db,
          {
            institution_id: institutionId,
            fdr_number: fdrNumber,
            issuing_bank: bank,
            branch_name: row['branch_name'] || undefined,
            amount,
            issue_date: issueDate,
            maturity_date: maturityDate,
            purpose: row['purpose'] || 'AICTE Security Deposit',
            status: 'SUBMITTED',
            trust_level: 'DECLARED',
          },
          actor
        );

        if (newFdr && newFdr.fdr) {
          importedIds.push(newFdr.fdr.id);
        }
      } catch (err: any) {
        errors.push({
          rowNumber: rowNum,
          fdrNumber,
          reasons: [`Database error: ${err.message}`],
          rawData: row,
        });
      }
    }

    auditLogger.log(
      db,
      actor,
      'BULK_IMPORT_COMPLETED',
      { type: 'IMPORT_BATCH', id: 'batch_' + Date.now() },
      {
        total_rows: rows.length,
        imported_count: importedIds.length,
        failed_count: errors.length,
      }
    );

    return {
      totalRows: rows.length,
      importedCount: importedIds.length,
      failedCount: errors.length,
      importedIds,
      errors,
    };
  }
}

export const importService = ImportService.getInstance();
