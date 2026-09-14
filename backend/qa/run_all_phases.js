/**
 * Master E2E Regression Runner
 * Executes all Phase test runners (Phase 1 to Phase 10) in sequence.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const phases = [
  { name: 'Phase 1: Super Admin & Subscription Tiers', script: 'phase1_super_admin_test.js' },
  { name: 'Phase 2: QA Company & Master Setup', script: 'phase2_masters_test.js' },
  { name: 'Phase 3: Purchase & Inward Stock', script: 'phase3_purchase_test.js' },
  { name: 'Phase 4: Mill / Job Work Flow', script: 'phase4_jobwork_test.js' },
  { name: 'Phase 5: Sales & Tax Determination', script: 'phase5_sales_test.js' },
  { name: 'Phase 6: Payments & Receipts', script: 'phase6_payments_test.js' },
  { name: 'Phase 7: Credit & Debit Notes', script: 'phase7_notes_test.js' },
  { name: 'Phase 8: Accounting Certification', script: 'phase8_accounting_test.js' },
  { name: 'Phase 9: GST Ecosystem & Statutory', script: 'phase9_gst_test.js' },
  { name: 'Phase 10: Reports & Export Certification', script: 'phase10_reports_test.js' }
];

console.log('================================================================');
console.log('🚀 RUNNING COMPLETE END-TO-END ERP REGRESSION SUITE (PHASES 1-10)');
console.log('================================================================\n');

const summary = [];
let totalPassed = 0;
let totalFailed = 0;

for (const p of phases) {
  console.log(`\n▶️ Executing [${p.name}] (${p.script})...`);
  const fullPath = path.join(__dirname, p.script);
  const start = Date.now();
  const res = spawnSync(process.execPath, [fullPath], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  const durationMs = Date.now() - start;

  if (res.status === 0) {
    console.log(`✅ ${p.name} PASSED in ${(durationMs / 1000).toFixed(2)}s`);
    summary.push({ phase: p.name, status: 'PASS', duration: `${(durationMs / 1000).toFixed(2)}s` });
    totalPassed++;
  } else {
    console.error(`❌ ${p.name} FAILED with exit code ${res.status}`);
    console.error(res.stdout);
    console.error(res.stderr);
    summary.push({ phase: p.name, status: 'FAIL', duration: `${(durationMs / 1000).toFixed(2)}s`, error: res.stderr || res.stdout });
    totalFailed++;
  }
}

console.log('\n================================================================');
console.log('📊 MASTER REGRESSION EXECUTION SUMMARY');
console.log('================================================================');
console.table(summary);
console.log(`Total Phases: ${phases.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`);

if (totalFailed === 0) {
  console.log('\n🎉 ALL 10 PHASES COMPLETED WITH 100% PASS RATE! ZERO REGRESSION DETECTED.');
  process.exit(0);
} else {
  console.error('\n⚠️ SOME PHASES FAILED. PLEASE REVIEW LOGS.');
  process.exit(1);
}
