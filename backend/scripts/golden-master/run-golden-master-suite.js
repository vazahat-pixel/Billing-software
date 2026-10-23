#!/usr/bin/env node

/**
 * Golden-Master Reconciliation Suite Orchestrator
 *
 * Three-stage workflow:
 * 1. Extract: JSM SQL → CSV (read-only)
 * 2. Import: CSV → MERN test company (atomic, idempotent)
 * 3. Reconcile: JSM view vs MERN API (diff harness)
 *
 * Usage:
 *   npm run golden-master              # Full suite in test mode
 *   npm run golden-master -- --execute # Execute live import + reconciliation
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT_DIR = __dirname;
const SCRIPTS = [
  { name: 'Extract', script: 'jsm-extract-demo.js', args: [] },
  { name: 'Import', script: 'mern-import-golden-data.js', args: ['--dryRun'] },
  { name: 'Reconcile', script: 'reconcile-reports.js', args: [] }
];

const isExecute = process.argv.includes('--execute');

async function runScript(name, scriptPath, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${name}] Starting...`);
    console.log(`${'='.repeat(60)}`);

    const child = spawn('node', [scriptPath, ...args], { stdio: 'inherit', cwd: SCRIPT_DIR });

    child.on('exit', code => {
      if (code === 0) {
        console.log(`[${name}] ✓ Success`);
        resolve();
      } else {
        console.error(`[${name}] ✗ Failed with code ${code}`);
        reject(new Error(`${name} script exited with code ${code}`));
      }
    });

    child.on('error', err => {
      reject(err);
    });
  });
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         GOLDEN-MASTER RECONCILIATION SUITE                  ║');
  console.log(`║         Mode: ${isExecute ? 'LIVE EXECUTION' : 'TEST (DRY-RUN)'}                                ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (!isExecute) {
    console.log(`
⚠  DRY-RUN MODE: The import stage will NOT write to the database.
    To execute live:
    npm run golden-master -- --execute
    `);
  }

  try {
    // Stage 1: Extract from JSM (always read-only)
    await runScript('STAGE 1: EXTRACT', path.join(SCRIPT_DIR, 'jsm-extract-demo.js'), []);

    // Stage 2: Import to MERN
    const importArgs = isExecute ? ['--execute'] : ['--dryRun'];
    await runScript('STAGE 2: IMPORT', path.join(SCRIPT_DIR, 'mern-import-golden-data.js'), importArgs);

    // Stage 3: Reconcile
    await runScript('STAGE 3: RECONCILE', path.join(SCRIPT_DIR, 'reconcile-reports.js'), []);

    console.log(`\n${'='.repeat(60)}`);
    console.log('✓ GOLDEN-MASTER RECONCILIATION SUITE COMPLETE');
    console.log(`${'='.repeat(60)}\n`);

    console.log('📊 Next steps:');
    console.log('  1. Review golden-master/reconciliation/mismatch_register.csv');
    console.log('  2. For each mismatch, trace the MERN API or JSM view logic');
    console.log('  3. Fix highest-priority reports (GST, Outstanding, Ledger)');
    console.log('  4. Re-run suite to verify fixes\n');

  } catch (err) {
    console.error(`\n✗ SUITE FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

main();
