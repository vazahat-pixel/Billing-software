/**
 * Stage 8.11 — Quality gates for deploy certification.
 * Any critical gate failure blocks deployment.
 */

const PRODUCTION_GATE = 95;

const TEST_TYPES = [
  'Unit',
  'Integration',
  'API',
  'UI',
  'End-to-End',
  'Business Flow',
  'Regression',
  'Smoke',
  'Sanity',
  'Performance',
  'Load',
  'Stress',
  'Security',
  'Accessibility',
  'Visual Regression',
  'Database',
  'Migration',
  'Offline',
  'Multi Tenant Isolation',
  'Production Readiness',
];

const SUITES = [
  { id: 'unit', label: 'Unit Tests', command: 'npm run test:unit', critical: true },
  { id: 'integration', label: 'Integration / Business Flows', command: 'npm run test:integration', critical: true },
  { id: 'api', label: 'API Certification', command: 'npm run test:api', critical: true },
  { id: 'security', label: 'Security Tests', command: 'npm run test:security', critical: true },
  { id: 'isolation', label: 'Multi-Company Isolation', command: 'npm run test:isolation', critical: true },
  { id: 'certification', label: 'Accounting / Inventory / GST Recon', command: 'npm run test:certification', critical: true },
  { id: 'offline', label: 'Offline Tests', command: 'npm run test:offline', critical: false },
  { id: 'e2e', label: 'UI / Playwright', command: 'cd ../frontend && npm run test:e2e', critical: false },
  { id: 'performance', label: 'Performance (k6)', command: 'k6 run performance/k6/load-smoke.js', critical: false },
  { id: 'certify', label: 'Enterprise Platform Certify', command: 'npm run certify', critical: true },
];

const CRITICAL_KEYS = new Set([
  'business_flows',
  'accounting',
  'inventory',
  'gst',
  'isolation',
  'security',
  'api',
]);

const GATES = [
  { id: 'business_flow', label: 'Any business flow fails', blocking: true },
  { id: 'inventory_mismatch', label: 'Inventory mismatch exists', blocking: true },
  { id: 'accounting_mismatch', label: 'Accounting mismatch exists', blocking: true },
  { id: 'gst_mismatch', label: 'GST mismatch exists', blocking: true },
  { id: 'security_critical', label: 'Security critical issue exists', blocking: true },
  { id: 'performance_threshold', label: 'Performance threshold exceeded', blocking: false },
  { id: 'cross_company_leakage', label: 'Cross-company data leakage detected', blocking: true },
  { id: 'regression', label: 'Regression detected', blocking: true },
  { id: 'production_score', label: 'Production Readiness Score < 95%', blocking: true },
];

function isCritical(key) {
  return CRITICAL_KEYS.has(key);
}

function evaluate({ score, suites, gateFailures }) {
  const byKey = Object.fromEntries(suites.map((s) => [s.key, s]));
  return GATES.map((g) => {
    let passed = true;
    let detail = 'ok';

    switch (g.id) {
      case 'business_flow':
        passed = byKey.business_flows?.status !== 'fail';
        detail = byKey.business_flows?.detail || '';
        break;
      case 'inventory_mismatch':
        passed = byKey.inventory?.status !== 'fail';
        detail = byKey.inventory?.detail || '';
        break;
      case 'accounting_mismatch':
        passed = byKey.accounting?.status !== 'fail';
        detail = byKey.accounting?.detail || '';
        break;
      case 'gst_mismatch':
        passed = byKey.gst?.status !== 'fail';
        detail = byKey.gst?.detail || '';
        break;
      case 'security_critical':
        passed = byKey.security?.status !== 'fail';
        detail = byKey.security?.detail || '';
        break;
      case 'performance_threshold':
        passed = byKey.performance?.status !== 'fail';
        detail = byKey.performance?.detail || '';
        break;
      case 'cross_company_leakage':
        passed = byKey.isolation?.status !== 'fail';
        detail = byKey.isolation?.detail || '';
        break;
      case 'regression':
        passed = (gateFailures || []).length === 0 && byKey.qa_smoke?.status !== 'fail';
        detail = `${(gateFailures || []).length} critical failures`;
        break;
      case 'production_score':
        passed = score >= PRODUCTION_GATE;
        detail = `score=${score} gate=${PRODUCTION_GATE}`;
        break;
      default:
        break;
    }

    return { ...g, passed, detail };
  });
}

/**
 * CI summary evaluator — used by scripts/certify/runQualityGates.js
 * summary: { unitFailed, integrationFailed, securityFailed, isolationFailed, certificationFailed, platformScore, platformPassed }
 */
function evaluateCi(summary = {}) {
  const failures = [];
  if (summary.unitFailed) failures.push('Unit tests failed');
  if (summary.integrationFailed) failures.push('Integration / business flow tests failed');
  if (summary.securityFailed) failures.push('Security tests failed');
  if (summary.isolationFailed) failures.push('Multi-company isolation tests failed');
  if (summary.certificationFailed) failures.push('Accounting/Inventory/GST certification tests failed');
  if (summary.apiFailed) failures.push('API certification failed');
  if (typeof summary.platformScore === 'number' && summary.platformScore < PRODUCTION_GATE) {
    failures.push(`Production score ${summary.platformScore} < ${PRODUCTION_GATE}`);
  }
  if (summary.platformPassed === false) failures.push('Enterprise platform certification failed');

  return {
    passed: failures.length === 0,
    gate: PRODUCTION_GATE,
    failures,
    deployAllowed: failures.length === 0,
    summary,
  };
}

module.exports = {
  PRODUCTION_GATE,
  TEST_TYPES,
  SUITES,
  GATES,
  CRITICAL_KEYS,
  isCritical,
  evaluate,
  evaluateCi,
};
