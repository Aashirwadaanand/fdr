import { DatabaseSync } from 'node:sqlite';
import { clock } from '../clock/clock';
import { ruleEngine } from '../rules/ruleEngine';
import { auditLogger, canonicalizeJson } from '../audit/auditLogger';
import crypto from 'crypto';

export interface BenchmarkReport {
  timestamp: string;
  disclaimer: string;
  scanTimeMs: number;
  totalFdrsScanned: number;
  deliberateErrorsTotal: number;
  deliberateErrorsCaught: number;
  detectionRatePercent: number;
  breakdown: {
    ruleCode: string;
    ruleName: string;
    expectedErrors: number;
    caughtErrors: number;
    ratio: string;
  }[];
  cleanRecordsWronglyFlaggedCount: number;
  cleanRecordsWronglyFlagged: { fdrId: string; fdrNumber: string; ruleCode: string; message: string }[];
  auditTamperBenchmark: {
    iterationsRun: number;
    tamperedDetected: number;
    detectionSuccessRatePercent: number;
    averageDetectionTimeMs: number;
  };
}

export interface ScenarioTestResult {
  id: string;
  title: string;
  category: 'POSITIVE' | 'NEGATIVE';
  description: string;
  passed: boolean;
  details: string;
  executionTimeMs: number;
}

export class BenchmarkService {
  private static instance: BenchmarkService;

  private constructor() {}

  public static getInstance(): BenchmarkService {
    if (!BenchmarkService.instance) {
      BenchmarkService.instance = new BenchmarkService();
    }
    return BenchmarkService.instance;
  }

  public runRuleEngineBenchmark(db: DatabaseSync): BenchmarkReport {
    const startTime = Date.now();

    const fdrs = db.prepare('SELECT * FROM fdrs').all() as any[];

    // Track catches on deliberate error records
    // Records 1 to 5: MISSING_REQUIRED_FIELD
    // Records 6 to 10: DUPLICATE_REFERENCE
    // Records 11 to 15: INVALID_DATE_SEQUENCE
    // Records 16 to 20: NON_POSITIVE_AMOUNT
    // Records 21 to 25: EXTRACTED_VS_SUBMITTED_MISMATCH
    // Records 26 to 30: OVERDUE_BUT_ACTIVE

    const expectedMap: Record<string, { expected: number; caught: number; name: string }> = {
      'MISSING_REQUIRED_FIELD': { expected: 5, caught: 0, name: 'Missing Required Field' },
      'DUPLICATE_REFERENCE': { expected: 5, caught: 0, name: 'Duplicate FDR Reference' },
      'INVALID_DATE_SEQUENCE': { expected: 5, caught: 0, name: 'Issue Date on/after Maturity' },
      'NON_POSITIVE_AMOUNT': { expected: 5, caught: 0, name: 'Zero or Negative Amount' },
      'EXTRACTED_VS_SUBMITTED_MISMATCH': { expected: 5, caught: 0, name: 'Extracted vs Submitted Discrepancy' },
      'OVERDUE_BUT_ACTIVE': { expected: 5, caught: 0, name: 'Matured/Overdue Instrument Still Active' },
    };

    const cleanRecordsWronglyFlagged: { fdrId: string; fdrNumber: string; ruleCode: string; message: string }[] = [];

    for (let idx = 0; idx < fdrs.length; idx++) {
      const f = fdrs[idx];
      const flags = ruleEngine.evaluateFdr(db, f);
      const flagCodes = flags.map(fl => fl.ruleCode);
      const recNumber = parseInt(f.id.replace('fdr_seed_', '')) || 0;

      // Check deliberate error matches
      if (recNumber >= 1 && recNumber <= 5) {
        if (flagCodes.includes('MISSING_REQUIRED_FIELD')) expectedMap['MISSING_REQUIRED_FIELD'].caught++;
      } else if (recNumber >= 6 && recNumber <= 10) {
        if (flagCodes.includes('DUPLICATE_REFERENCE')) expectedMap['DUPLICATE_REFERENCE'].caught++;
      } else if (recNumber >= 11 && recNumber <= 15) {
        if (flagCodes.includes('INVALID_DATE_SEQUENCE')) expectedMap['INVALID_DATE_SEQUENCE'].caught++;
      } else if (recNumber >= 16 && recNumber <= 20) {
        if (flagCodes.includes('NON_POSITIVE_AMOUNT')) expectedMap['NON_POSITIVE_AMOUNT'].caught++;
      } else if (recNumber >= 21 && recNumber <= 25) {
        if (flagCodes.includes('EXTRACTED_VS_SUBMITTED_MISMATCH')) expectedMap['EXTRACTED_VS_SUBMITTED_MISMATCH'].caught++;
      } else if (recNumber >= 26 && recNumber <= 30) {
        if (flagCodes.includes('OVERDUE_BUT_ACTIVE')) expectedMap['OVERDUE_BUT_ACTIVE'].caught++;
      } else {
        // Records 31 to 200 are expected clean (except planned reused hash on 36-38, and duplicates pair on 31-35)
        for (const fl of flags) {
          if (fl.ruleCode !== 'REUSED_DOCUMENT_HASH' && fl.ruleCode !== 'DUPLICATE_REFERENCE') {
            cleanRecordsWronglyFlagged.push({
              fdrId: f.id,
              fdrNumber: f.fdr_number,
              ruleCode: fl.ruleCode,
              message: fl.message,
            });
          }
        }
      }
    }

    const scanTimeMs = Date.now() - startTime;

    let totalCaught = 0;
    const breakdown = Object.entries(expectedMap).map(([code, data]) => {
      totalCaught += data.caught;
      return {
        ruleCode: code,
        ruleName: data.name,
        expectedErrors: data.expected,
        caughtErrors: data.caught,
        ratio: `${data.caught}/${data.expected}`,
      };
    });

    // 100 random simulated edits on audit trail to test tamper detection
    const auditTamperBenchmark = this.benchmarkAuditTamperDetection(db, 100);

    return {
      timestamp: clock.now().toISOString(),
      disclaimer: 'Synthetic functional test, not a real-world accuracy claim.',
      scanTimeMs,
      totalFdrsScanned: fdrs.length,
      deliberateErrorsTotal: 30,
      deliberateErrorsCaught: totalCaught,
      detectionRatePercent: Math.round((totalCaught / 30) * 100),
      breakdown,
      cleanRecordsWronglyFlaggedCount: cleanRecordsWronglyFlagged.length,
      cleanRecordsWronglyFlagged,
      auditTamperBenchmark,
    };
  }

  public benchmarkAuditTamperDetection(db: DatabaseSync, iterations: number = 100): {
    iterationsRun: number;
    tamperedDetected: number;
    detectionSuccessRatePercent: number;
    averageDetectionTimeMs: number;
  } {
    // Ensure we have at least 5 audit entries to simulate with
    const countRow = db.prepare('SELECT COUNT(*) as count FROM audit_entries').get() as { count: number };
    if (countRow.count < 3) {
      for (let i = 0; i < 5; i++) {
        auditLogger.log(
          db,
          { id: 'usr_admin_001', name: 'Er. Sandeep Verma', role: 'ADMIN' },
          'BENCHMARK_PRELOAD',
          { type: 'BENCHMARK', id: `bm_${i}` },
          { index: i }
        );
      }
    }

    const entries = db.prepare('SELECT sequence, payload_canonical, hash FROM audit_entries ORDER BY sequence ASC').all() as any[];
    if (entries.length === 0) {
      return { iterationsRun: 0, tamperedDetected: 0, detectionSuccessRatePercent: 100, averageDetectionTimeMs: 0 };
    }

    let detectedCount = 0;
    const times: number[] = [];

    // Temporarily drop trigger for the simulation
    db.exec('DROP TRIGGER IF EXISTS audit_no_update;');

    for (let i = 0; i < iterations; i++) {
      const target = entries[i % entries.length];
      const originalPayload = target.payload_canonical;

      // Tamper: alter one character or insert field
      const corrupted = JSON.stringify({ corrupted: true, iter: i, orig: originalPayload.substring(0, 20) });

      db.prepare('UPDATE audit_entries SET payload_canonical = ? WHERE sequence = ?').run(corrupted, target.sequence);

      const t0 = performance.now();
      const integrity = auditLogger.verifyIntegrity(db);
      const t1 = performance.now();
      times.push(t1 - t0);

      if (!integrity.valid && integrity.brokenSequence === target.sequence) {
        detectedCount++;
      }

      // Restore immediately
      db.prepare('UPDATE audit_entries SET payload_canonical = ? WHERE sequence = ?').run(originalPayload, target.sequence);
    }

    // Re-create immutable trigger
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS audit_no_update
      BEFORE UPDATE ON audit_entries
      BEGIN
        SELECT RAISE(FAIL, 'Audit entries are strictly append-only and cannot be updated');
      END;
    `);

    const avgTime = times.reduce((a, b) => a + b, 0) / (times.length || 1);

    return {
      iterationsRun: iterations,
      tamperedDetected: detectedCount,
      detectionSuccessRatePercent: Math.round((detectedCount / iterations) * 100),
      averageDetectionTimeMs: Math.round(avgTime * 100) / 100,
    };
  }
}

export const benchmarkService = BenchmarkService.getInstance();
