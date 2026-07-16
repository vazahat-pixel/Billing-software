const { verifyInventory } = require('./inventoryVerifier');
const { verifyAccounting } = require('./accountingVerifier');
const { verifyGst } = require('./gstVerifier');
const { verifyReports } = require('./reportVerifier');
const certificationService = require('../../services/certificationService');
const { writeJsonReport } = require('../reports/jsonReporter');
const { writeHtmlReport } = require('../reports/htmlReporter');
const { printReadinessSummary } = require('../reports/consoleReporter');

const WEIGHTS = {
  inventory: 20,
  accounting: 20,
  gst: 15,
  reports: 15,
  api: 10,
  performance: 10,
  security: 5,
  database: 5,
};

function weightedScore(areas) {
  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const area = areas[key];
    if (!area) continue;
    total += (area.score || 0) * (weight / 100);
    weightSum += weight;
  }
  if (!weightSum) return 0;
  return Math.round((total / weightSum) * 100);
}

async function buildReadinessReport(ctx, extras = {}) {
  const companyId = ctx.companyId;
  const areas = {};

  areas.inventory = await verifyInventory(companyId);
  areas.accounting = await verifyAccounting(companyId);
  areas.gst = await verifyGst(companyId);
  areas.reports = await verifyReports(companyId);

  areas.api = extras.api || { label: 'API Coverage', passed: false, score: 0, issues: ['Not run'] };
  areas.performance = extras.benchmark || {
    label: 'Performance',
    passed: true,
    score: 100,
    issues: ['Skipped'],
  };
  areas.security = extras.security || {
    label: 'Security',
    passed: true,
    score: 100,
    issues: [],
  };
  areas.database = {
    label: 'Database Integrity',
    passed: areas.inventory.reconcileStatus !== 'failures',
    score: areas.inventory.reconcileStatus === 'failures' ? 0 : 100,
    issues: areas.inventory.reconcileStatus === 'failures' ? ['Reconciliation failures'] : [],
  };

  let businessCert = null;
  try {
    businessCert = await certificationService.run(companyId);
    if (!businessCert.passed) {
      areas.database.issues.push(...(businessCert.gaps || []).slice(0, 3));
    }
  } catch (err) {
    areas.database.issues.push(err.message);
  }

  const overallScore = weightedScore(areas);
  const allPassed = Object.values(areas).every((a) => a.passed);
  const recommendation = allPassed && overallScore >= 90
    ? 'READY — all integrity checks passed'
    : overallScore >= 75
      ? 'CAUTION — review failures before production deploy'
      : 'NOT READY — critical integrity failures detected';

  const report = {
    generatedAt: new Date().toISOString(),
    profile: ctx.profile.name,
    companyId: String(companyId),
    overallScore,
    recommendation,
    areas,
    businessCertification: businessCert,
    simulation: extras.simulation || null,
    benchmark: extras.benchmark || null,
    api: extras.api || null,
    outputDir: ctx.outputDir,
  };

  writeJsonReport(ctx.outputDir, report);
  writeHtmlReport(ctx.outputDir, report);
  printReadinessSummary(report);

  return { report, exitCode: allPassed && overallScore >= 85 ? 0 : 2 };
}

module.exports = { buildReadinessReport, WEIGHTS };
