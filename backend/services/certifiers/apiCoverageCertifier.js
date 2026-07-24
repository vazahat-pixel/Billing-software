const fs = require('fs');
const path = require('path');

/**
 * API coverage certification — route manifest completeness for transactional endpoints.
 */
async function certify() {
  const manifestPath = path.join(__dirname, '../../tests/api/routeManifest.js');
  const issues = [];

  if (!fs.existsSync(manifestPath)) {
    return { passed: false, detail: 'routeManifest missing', gaps: ['routeManifest.js missing'], score: 0 };
  }

  const routes = require('../../tests/api/routeManifest');
  const groups = new Set(routes.map((r) => r.group));
  const requiredGroups = [
    'health',
    'auth',
    'sales',
    'purchases',
    'inventory',
    'accounting',
    'gst',
    'parties',
    'items',
    'reports',
    'dashboard',
  ];

  for (const g of requiredGroups) {
    if (!groups.has(g)) issues.push(`Missing API group in manifest: ${g}`);
  }

  const transactional = routes.filter((r) =>
    ['sales', 'purchases', 'inventory', 'accounting', 'gst', 'payments', 'jobs', 'returns', 'notes'].includes(r.group)
  );

  // Expect expanded coverage (≥ 35 routes for enterprise platform)
  if (routes.length < 35) {
    issues.push(`Route manifest too thin: ${routes.length} < 35`);
  }

  const engine = path.join(__dirname, '../../tests/api/apiTestEngine.js');
  if (!fs.existsSync(engine)) issues.push('apiTestEngine.js missing');

  const passed = issues.length === 0;
  return {
    passed,
    detail: `routes=${routes.length} groups=${groups.size} transactional=${transactional.length}`,
    gaps: issues,
    routeCount: routes.length,
    groups: [...groups],
    score: passed ? 100 : Math.max(0, 100 - issues.length * 12),
  };
}

module.exports = { certify };
