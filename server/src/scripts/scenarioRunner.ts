import { getDatabase } from '../db/database';
import { ScenarioRunner } from '../services/scenarioRunner';

async function main() {
  console.log('🧪 Executing AICTE FDR-Sentinel Scenario Verification Suite (10 Scenarios)...');
  const db = getDatabase();
  const results = await ScenarioRunner.runAll(db);

  console.log('========================================================================');
  console.log(`📋 SCENARIO TEST EXECUTION RESULTS (${results.totalPassed}/${results.scenarios.length} PASSED)`);
  console.log('========================================================================');

  for (let i = 0; i < results.scenarios.length; i++) {
    const s = results.scenarios[i];
    const statusIcon = s.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${String(i + 1).padStart(2, ' ')}. [${statusIcon}] [${s.category}] ${s.name} (${s.durationMs}ms)`);
    console.log(`    Description: ${s.description}`);
    console.log(`    Result:      ${s.message}`);
    console.log('');
  }

  console.log('========================================================================');
  if (results.totalFailed === 0) {
    console.log('🎉 ALL SCENARIOS PASSED SUCCESSFULLY!');
  } else {
    console.error(`⚠️  ${results.totalFailed} SCENARIOS FAILED!`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal scenario runner error:', err);
  process.exit(1);
});
