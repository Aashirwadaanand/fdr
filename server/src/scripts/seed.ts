import { getDatabase } from '../db/database';
import { seedService } from '../services/seedService';

console.log('🌱 Starting deterministic seed generation for AICTE FDR-Sentinel...');
const db = getDatabase();
const result = seedService.seedAll(db);

console.log('✅ Seed completed successfully:');
console.log(`   - Institutions: ${result.institutionsCount}`);
console.log(`   - Fictional Banks: ${result.banksCount}`);
console.log(`   - FDRs Generated: ${result.fdrsCount}`);
console.log(`   - Deliberate Compliance Errors Seeded: ${result.deliberateErrorsCount} (exactly 5 of each of the 6 types)`);
console.log('   - Breakdown:', result.errorsBreakdown);
console.log('🛡️  Prototype notice: Synthetic data active. All bank verification is simulated.');
