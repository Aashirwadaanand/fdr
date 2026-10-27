import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { clock } from '../clock/clock';

export interface RuleEvaluationResult {
  ruleCode: string;
  ruleName: string;
  triggered: boolean;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'WARNING' | 'HIGH' | 'CRITICAL';
  message: string;
  triggerValues: Record<string, any>;
}

export interface FdrRecord {
  id: string;
  institution_id: string;
  fdr_number: string;
  issuing_bank: string;
  branch_name?: string;
  amount: number;
  issue_date: string;
  maturity_date: string;
  status: string;
  trust_level: string;
  replaces_fdr_id?: string;
}

export class RuleEngine {
  private static instance: RuleEngine;

  private constructor() {}

  public static getInstance(): RuleEngine {
    if (!RuleEngine.instance) {
      RuleEngine.instance = new RuleEngine();
    }
    return RuleEngine.instance;
  }

  public getRuleConfigs(db: DatabaseSync): Record<string, { is_enabled: boolean; severity: string; parameters: any }> {
    const rows = db.prepare('SELECT rule_code, is_enabled, severity, parameters FROM rule_configs').all() as any[];
    const configs: Record<string, { is_enabled: boolean; severity: string; parameters: any }> = {};
    for (const r of rows) {
      configs[r.rule_code] = {
        is_enabled: Boolean(r.is_enabled),
        severity: r.severity,
        parameters: JSON.parse(r.parameters || '{}'),
      };
    }
    return configs;
  }

  public evaluateFdr(db: DatabaseSync, fdr: FdrRecord): RuleEvaluationResult[] {
    const configs = this.getRuleConfigs(db);
    const results: RuleEvaluationResult[] = [];
    const today = clock.today();

    // 1. MISSING_REQUIRED_FIELD
    if (configs['MISSING_REQUIRED_FIELD']?.is_enabled) {
      const missing: string[] = [];
      if (!fdr.fdr_number || fdr.fdr_number.trim() === '') missing.push('fdr_number');
      if (fdr.amount === undefined || fdr.amount === null || isNaN(fdr.amount)) missing.push('amount');
      if (!fdr.issue_date) missing.push('issue_date');
      if (!fdr.maturity_date) missing.push('maturity_date');
      if (!fdr.issuing_bank || fdr.issuing_bank.trim() === '') missing.push('issuing_bank');

      if (missing.length > 0) {
        results.push({
          ruleCode: 'MISSING_REQUIRED_FIELD',
          ruleName: 'Missing Required Field',
          triggered: true,
          severity: 'HIGH',
          message: `Mandatory compliance fields missing: ${missing.join(', ')}.`,
          triggerValues: { missing_fields: missing },
        });
      }
    }

    // 2. DUPLICATE_REFERENCE
    if (configs['DUPLICATE_REFERENCE']?.is_enabled && fdr.fdr_number) {
      const existing = db.prepare(`
        SELECT id, institution_id, fdr_number
        FROM fdrs
        WHERE LOWER(TRIM(fdr_number)) = LOWER(TRIM(?)) AND id != ?
      `).all(fdr.fdr_number, fdr.id || '') as any[];

      if (existing.length > 0) {
        results.push({
          ruleCode: 'DUPLICATE_REFERENCE',
          ruleName: 'Duplicate FDR Reference',
          triggered: true,
          severity: 'HIGH',
          message: `FDR reference number '${fdr.fdr_number}' is already registered in the repository under record ${existing[0].id}.`,
          triggerValues: {
            duplicate_fdr_number: fdr.fdr_number,
            conflicting_records: existing.map(e => ({ id: e.id, institution_id: e.institution_id })),
          },
        });
      }
    }

    // 3. INVALID_DATE_SEQUENCE
    if (configs['INVALID_DATE_SEQUENCE']?.is_enabled) {
      if (fdr.issue_date && fdr.maturity_date && fdr.issue_date >= fdr.maturity_date) {
        results.push({
          ruleCode: 'INVALID_DATE_SEQUENCE',
          ruleName: 'Issue Date on or After Maturity',
          triggered: true,
          severity: 'HIGH',
          message: `Issue date (${fdr.issue_date}) is chronologically on or after maturity date (${fdr.maturity_date}).`,
          triggerValues: {
            issue_date: fdr.issue_date,
            maturity_date: fdr.maturity_date,
          },
        });
      }
    }

    // 4. NON_POSITIVE_AMOUNT
    if (configs['NON_POSITIVE_AMOUNT']?.is_enabled) {
      if (fdr.amount !== undefined && fdr.amount !== null && fdr.amount <= 0) {
        results.push({
          ruleCode: 'NON_POSITIVE_AMOUNT',
          ruleName: 'Zero or Negative Amount',
          triggered: true,
          severity: 'HIGH',
          message: `Registered deposit amount is non-positive (Rs. ${fdr.amount}).`,
          triggerValues: { amount: fdr.amount },
        });
      }
    }

    // 5. EXTRACTED_VS_SUBMITTED_MISMATCH
    if (configs['EXTRACTED_VS_SUBMITTED_MISMATCH']?.is_enabled && fdr.id) {
      const doc = db.prepare(`
        SELECT extracted_data FROM fdr_documents
        WHERE fdr_id = ? AND extracted_data IS NOT NULL
        ORDER BY version DESC LIMIT 1
      `).get(fdr.id) as { extracted_data: string } | undefined;

      if (doc && doc.extracted_data) {
        try {
          const extracted = JSON.parse(doc.extracted_data);
          const fields = extracted.extractedFields || {};
          const discrepancies: Record<string, { submitted: any; extracted: any }> = {};

          if (fields.fdr_number && fields.fdr_number.toLowerCase() !== fdr.fdr_number.toLowerCase()) {
            discrepancies['fdr_number'] = { submitted: fdr.fdr_number, extracted: fields.fdr_number };
          }
          if (fields.amount && Math.abs(fields.amount - fdr.amount) > 1.0) {
            discrepancies['amount'] = { submitted: fdr.amount, extracted: fields.amount };
          }
          if (fields.maturity_date && fields.maturity_date !== fdr.maturity_date) {
            discrepancies['maturity_date'] = { submitted: fdr.maturity_date, extracted: fields.maturity_date };
          }

          if (Object.keys(discrepancies).length > 0) {
            results.push({
              ruleCode: 'EXTRACTED_VS_SUBMITTED_MISMATCH',
              ruleName: 'Extracted vs Submitted Discrepancy',
              triggered: true,
              severity: 'MEDIUM',
              message: `Discrepancy detected between document extraction and submitted details in: ${Object.keys(discrepancies).join(', ')}.`,
              triggerValues: discrepancies,
            });
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    // 6. OVERDUE_BUT_ACTIVE
    if (configs['OVERDUE_BUT_ACTIVE']?.is_enabled) {
      if (fdr.status === 'ACTIVE' && fdr.maturity_date && fdr.maturity_date < today) {
        results.push({
          ruleCode: 'OVERDUE_BUT_ACTIVE',
          ruleName: 'Matured/Overdue Instrument Still Active',
          triggered: true,
          severity: 'HIGH',
          message: `Instrument passed maturity date (${fdr.maturity_date}) relative to system date (${today}) but remains marked ACTIVE.`,
          triggerValues: {
            maturity_date: fdr.maturity_date,
            system_date: today,
            status: fdr.status,
          },
        });
      }
    }

    // 7. MISSING_SUPPORTING_DOCUMENT
    if (configs['MISSING_SUPPORTING_DOCUMENT']?.is_enabled && fdr.id) {
      const docCount = db.prepare('SELECT COUNT(*) as count FROM fdr_documents WHERE fdr_id = ?').get(fdr.id) as { count: number };
      if (!docCount || docCount.count === 0) {
        results.push({
          ruleCode: 'MISSING_SUPPORTING_DOCUMENT',
          ruleName: 'Missing Supporting Document',
          triggered: true,
          severity: 'MEDIUM',
          message: 'No physical FDR certificate copy or scanned document has been uploaded.',
          triggerValues: { document_count: 0 },
        });
      }
    }

    // 8. REUSED_DOCUMENT_HASH
    if (configs['REUSED_DOCUMENT_HASH']?.is_enabled && fdr.id) {
      const ownDocs = db.prepare('SELECT sha256_hash FROM fdr_documents WHERE fdr_id = ?').all(fdr.id) as { sha256_hash: string }[];
      for (const d of ownDocs) {
        const matchingOther = db.prepare(`
          SELECT fdr_id, filename, original_name
          FROM fdr_documents
          WHERE sha256_hash = ? AND fdr_id != ?
        `).all(d.sha256_hash, fdr.id) as any[];

        if (matchingOther.length > 0) {
          results.push({
            ruleCode: 'REUSED_DOCUMENT_HASH',
            ruleName: 'Reused Document Hash',
            triggered: true,
            severity: 'HIGH',
            message: `Uploaded certificate SHA-256 matches document already attached to FDR #${matchingOther[0].fdr_id}.`,
            triggerValues: {
              sha256: d.sha256_hash,
              matching_fdrs: matchingOther.map(m => m.fdr_id),
            },
          });
          break;
        }
      }
    }

    return results;
  }

  public syncFdrFlags(db: DatabaseSync, fdr: FdrRecord): RuleEvaluationResult[] {
    const flags = this.evaluateFdr(db, fdr);

    // Delete existing flags for this FDR to refresh with latest rule evaluations
    if (fdr.id) {
      db.prepare('DELETE FROM fdr_flags WHERE fdr_id = ?').run(fdr.id);

      const insert = db.prepare(`
        INSERT INTO fdr_flags (id, fdr_id, rule_code, rule_name, message, trigger_values, severity, is_resolved, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

      for (const flag of flags) {
        insert.run(
          'flg_' + crypto.randomUUID(),
          fdr.id,
          flag.ruleCode,
          flag.ruleName,
          flag.message,
          JSON.stringify(flag.triggerValues),
          flag.severity,
          clock.now().toISOString()
        );
      }
    }

    return flags;
  }
}

export const ruleEngine = RuleEngine.getInstance();
