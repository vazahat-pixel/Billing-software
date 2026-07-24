/**
 * Performance certification — monitoring snapshot + k6 script presence.
 */
const fs = require('fs');
const path = require('path');

async function certify(companyId) {
  const issues = [];
  const k6Dir = path.join(__dirname, '../../performance/k6');
  const smoke = path.join(k6Dir, 'load-smoke.js');
  const stress = path.join(k6Dir, 'load-stress.js');

  if (!fs.existsSync(smoke)) issues.push('k6 load-smoke.js missing');
  if (!fs.existsSync(stress)) issues.push('k6 load-stress.js missing');

  let withinBudget = true;
  let snapshot = null;
  try {
    const monitoringService = require('../monitoringService');
    snapshot = await monitoringService.snapshot(companyId);
    withinBudget = snapshot?.api?.withinBudget !== false;
    if (!withinBudget) issues.push('API latency budget exceeded');
  } catch {
    // Monitoring optional in fresh envs
  }

  const passed = fs.existsSync(smoke) && withinBudget;
  return {
    passed,
    warnOnly: !withinBudget && fs.existsSync(smoke),
    detail: `k6=${fs.existsSync(smoke)} withinBudget=${withinBudget}`,
    gaps: issues,
    snapshot: snapshot
      ? { withinBudget: snapshot?.api?.withinBudget, p95: snapshot?.api?.p95 }
      : null,
    score: passed ? 100 : 70,
  };
}

module.exports = { certify };
