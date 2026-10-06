'use strict';

/**
 * HYBRID ERP FULL CROSS-MODULE HARNESS
 * =====================================
 * Runs Sales regression FIRST. If it fails, stops immediately.
 * Then runs each module suite in dependency order.
 * NEVER connects to production.
 *
 * Usage:
 *   node tests/hybrid-e2e/run-all.js
 *   node tests/hybrid-e2e/run-all.js --keep
 *
 * Exit: 0 if all pass, 1 if any fail.
 */

const { assertNotProduction } = require('../helpers/memoryDb');
const path = require('path');

const keepData = process.argv.includes('--keep');

// Safety guard — must run as non-production
const mongoUri = process.env.MONGO_URI || '';
if (mongoUri) {
  try { assertNotProduction(mongoUri); } catch (e) {
    console.error('FATAL: run-all.js refuses to run against production database');
    process.exit(1);
  }
}

async function runAll() {
  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  const header = (title) => {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60));
  };

  // ── PHASE 1: Sales regression baseline (must pass before anything else) ──
  header('PHASE 1: SALES REGRESSION BASELINE');
  const { spawn } = require('child_process');
  const runScript = (scriptPath) => new Promise((resolve) => {
    const args = [scriptPath];
    if (keepData) args.push('--keep');
    const proc = spawn(process.execPath, args, {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
    });
    proc.on('exit', (code) => resolve(code || 0));
  });

  console.log('\n[1/3] Running Sales certification (run.js)...');
  const salesCode = await runScript(path.join(__dirname, 'run.js'));
  if (salesCode !== 0) {
    console.error('\n!!! SALES CERTIFICATION FAILED. Halting cross-module harness. !!!');
    console.error('!!! Fix Sales regressions before certifying other modules.     !!!');
    process.exit(1);
  }
  console.log('[1/3] Sales certification PASSED.\n');
  results.push({ module: 'sales', passed: true });

  // ── PHASE 2: Purchase ────────────────────────────────────────────────────
  header('PHASE 2: PURCHASE HYBRID CERTIFICATION');
  console.log('\n[2/3] Running Purchase certification...');
  const purchaseCode = await runScript(path.join(__dirname, 'modules', 'purchase', 'run.js'));
  results.push({ module: 'purchase', passed: purchaseCode === 0 });
  if (purchaseCode !== 0) totalFailed++;
  else totalPassed++;
  console.log(`[2/3] Purchase certification ${purchaseCode === 0 ? 'PASSED' : 'FAILED'}.\n`);

  // ── PHASE 3: Job Work ───────────────────────────────────────────────────
  header('PHASE 3: JOB WORK HYBRID CERTIFICATION');
  const jobWorkPath = path.join(__dirname, 'modules', 'job-work', 'run.js');
  const fs = require('fs');
  if (fs.existsSync(jobWorkPath)) {
    console.log('\n[3/4] Running Job Work certification...');
    const jobCode = await runScript(jobWorkPath);
    results.push({ module: 'job_work', passed: jobCode === 0 });
    if (jobCode !== 0) totalFailed++;
    else totalPassed++;
    console.log(`[3/4] Job Work certification ${jobCode === 0 ? 'PASSED' : 'FAILED'}.\n`);
  } else {
    console.log('[3/4] Job Work certification suite not yet implemented — skipping.\n');
    results.push({ module: 'job_work', passed: null, skipped: true });
  }

  // ── PHASE 4: Web + Desktop Synchronization ──────────────────────────────
  header('PHASE 4: WEB + DESKTOP SYNCHRONIZATION CERTIFICATION');
  const webDesktopPath = path.join(__dirname, 'modules', 'web-desktop', 'run.js');
  if (fs.existsSync(webDesktopPath)) {
    console.log('\n[4/4] Running Web + Desktop certification...');
    const webDesktopCode = await runScript(webDesktopPath);
    results.push({ module: 'web_desktop', passed: webDesktopCode === 0 });
    if (webDesktopCode !== 0) totalFailed++;
    else totalPassed++;
    console.log(`[4/4] Web + Desktop certification ${webDesktopCode === 0 ? 'PASSED' : 'FAILED'}.\n`);
  } else {
    console.log('[4/4] Web + Desktop certification suite not found — skipping.\n');
    results.push({ module: 'web_desktop', passed: null, skipped: true });
  }

  // ── Final summary ────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  HYBRID ERP FULL CROSS-MODULE CERTIFICATION RESULT');
  console.log('='.repeat(60));
  for (const r of results) {
    const tag = r.skipped ? 'SKIP' : (r.passed ? 'PASS' : 'FAIL');
    console.log(`  [${tag}] ${r.module}`);
  }
  console.log('='.repeat(60));
  if (totalFailed > 0) {
    console.log(`\n  RESULT: FAIL (${totalFailed} module(s) failed)\n`);
    process.exit(1);
  } else {
    console.log('\n  RESULT: PASS\n');
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
