import { getDatabase } from '../db/database';
import { benchmarkService } from '../services/benchmarkService';

console.log('⚡ Running AICTE FDR-Sentinel Rule Engine & Audit Tamper Benchmark...');
const db = getDatabase();
const report = benchmarkService.runRuleEngineBenchmark(db);

console.log('========================================================================');
console.log('📊 BENCHMARK REPORT');
console.log(`   Notice: ${report.disclaimer}`);
console.log(`   Timestamp: ${report.timestamp}`);
console.log(`   Total Records Scanned: ${report.totalFdrsScanned}`);
console.log(`   Scan Duration: ${report.scanTimeMs} ms`);
console.log(`   Deliberate Errors Caught: ${report.deliberateErrorsCaught} / ${report.deliberateErrorsTotal} (${report.detectionRatePercent}%)`);
console.log('------------------------------------------------------------------------');
console.log('🔍 Breakdown by Rule Type:');
for (const b of report.breakdown) {
  console.log(`   • ${b.ruleName.padEnd(40)}: ${b.ratio} (${Math.round((b.caughtErrors / b.expectedErrors) * 100)}%)`);
}
console.log('------------------------------------------------------------------------');
console.log(`⚠️  Clean Records Wrongly Flagged: ${report.cleanRecordsWronglyFlaggedCount}`);
if (report.cleanRecordsWronglyFlaggedCount > 0) {
  for (const c of report.cleanRecordsWronglyFlagged.slice(0, 5)) {
    console.log(`     - FDR ${c.fdrNumber}: ${c.ruleCode} (${c.message})`);
  }
}
console.log('------------------------------------------------------------------------');
console.log('🔒 Cryptographic Audit Trail Tamper-Detection Benchmark (100 Edits):');
console.log(`   • Iterations Run: ${report.auditTamperBenchmark.iterationsRun}`);
console.log(`   • Tampered Edits Detected: ${report.auditTamperBenchmark.tamperedDetected} / ${report.auditTamperBenchmark.iterationsRun}`);
console.log(`   • Tamper Detection Success Rate: ${report.auditTamperBenchmark.detectionSuccessRatePercent}%`);
console.log(`   • Avg Detection Latency: ${report.auditTamperBenchmark.averageDetectionTimeMs} ms`);
console.log('========================================================================');
