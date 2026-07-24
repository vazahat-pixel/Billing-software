#!/usr/bin/env node
/**
 * Stage 8.11 — Run enterprise testing platform certification (requires Mongo).
 * Usage:
 *   node scripts/certify/runCertification.js
 *   node scripts/certify/runCertification.js --company=<id>
 *   node scripts/certify/runCertification.js --readonly   # no auto-seed
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-characters-long';
process.env.ALLOW_QA = process.env.ALLOW_QA || '1';

async function main() {
  const mongoose = require('mongoose');
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/billing_certify';
  await mongoose.connect(uri);

  const platform = require('../../services/enterpriseTestingPlatformService');
  const { resolveTenant } = require('../../services/certifiers/businessFlowCertifier');

  const companyArg = process.argv.find((a) => a.startsWith('--company='));
  const readonly = process.argv.includes('--readonly');
  let companyId = companyArg ? companyArg.split('=')[1] : null;

  if (!companyId) {
    const tenant = await resolveTenant(null);
    companyId = tenant.companyId ? String(tenant.companyId) : null;
    console.log(companyId ? `Using company ${companyId}` : 'No company resolved — structural mode');
  }

  console.log('Running Stage 8.11 Enterprise Testing Platform certification...');
  const report = await platform.run(companyId, {
    mode: readonly ? 'readonly' : 'full',
    triggeredBy: 'cli',
  });

  const business = report.checklist?.find((c) => c.key === 'business_flows');

  console.log(JSON.stringify({
    score: report.score,
    gate: report.gate,
    passed: report.passed,
    deployAllowed: report.deployAllowed,
    status: report.status,
    businessFlows: {
      status: business?.status,
      score: business ? Math.round((business.score / business.maxScore) * 100) : null,
      detail: business?.detail,
      gaps: business?.gaps?.slice(0, 10),
    },
    gaps: report.gaps?.slice(0, 15),
    gateFailures: report.gateFailures,
    scores: report.meta?.scores,
    durationMs: report.meta?.durationMs,
  }, null, 2));

  await mongoose.connection.close();
  process.exit(report.deployAllowed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
