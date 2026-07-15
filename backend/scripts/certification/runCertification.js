/**
 * CLI: Business Readiness Certification (Sprint 2.10)
 * Usage: node scripts/certification/runCertification.js [companyId]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function main() {
  const companyId = process.argv[2] || process.env.CERT_COMPANY_ID;
  if (!companyId) {
    console.error('Usage: node scripts/certification/runCertification.js <companyId>');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software';
  await mongoose.connect(uri);
  console.log('[cert] connected');

  const certificationService = require('../../services/certificationService');
  const documentEngineService = require('../../services/documentEngineService');
  const workflowEngineService = require('../../services/workflowEngineService');
  const businessAutomationService = require('../../services/businessAutomationService');

  console.log('[cert] seeding defaults…');
  await Promise.all([
    documentEngineService.seedTemplates(companyId).catch(() => {}),
    workflowEngineService.seedDefinitions(companyId).catch(() => {}),
    businessAutomationService.seedDefaults(companyId).catch(() => {}),
  ]);

  console.log('[cert] running readiness score…');
  const result = await certificationService.run(companyId);
  console.log('[cert] score:', result.score, '/ gate', result.gate);
  console.log('[cert] passed:', result.passed, '| status:', result.status);
  console.log('[cert] reconcile:', result.reconcileStatus);
  if (result.gaps?.length) {
    console.log('[cert] gaps:');
    result.gaps.forEach((g) => console.log('  -', g));
  }
  console.log('[cert] checklist:');
  (result.checklist || []).forEach((c) => {
    console.log(`  [${c.status}] ${c.label}: ${c.score}/${c.maxScore}`);
  });

  await mongoose.disconnect();
  process.exit(result.passed ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
