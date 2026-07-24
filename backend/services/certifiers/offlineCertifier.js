const fs = require('fs');
const path = require('path');

/**
 * Offline capability certification — scripts + frontend offline utils + e2e.
 */
async function certify() {
  const root = path.join(__dirname, '../..');
  const fe = path.join(root, '..', 'frontend');
  const issues = [];
  const checks = [
    path.join(root, 'scripts', 'testOfflineFeature.js'),
    path.join(fe, 'e2e', 'offline.spec.js'),
    path.join(fe, 'src', 'utils'),
  ];

  for (const p of checks) {
    if (!fs.existsSync(p)) issues.push(`Missing offline artifact: ${path.basename(p)}`);
  }

  // Look for offline-related frontend modules
  const utilsDir = path.join(fe, 'src', 'utils');
  if (fs.existsSync(utilsDir)) {
    const files = fs.readdirSync(utilsDir);
    const hasOffline = files.some((f) => /offline|sync|idb/i.test(f));
    if (!hasOffline) {
      // Search src more broadly
      const apiDir = path.join(fe, 'src');
      const found = walkHas(apiDir, /offline|syncQueue|idb/i, 3);
      if (!found) issues.push('No offline/sync frontend modules detected');
    }
  }

  const passed = issues.length === 0;
  return {
    passed,
    detail: `issues=${issues.length}`,
    gaps: issues,
    score: passed ? 100 : Math.max(50, 100 - issues.length * 20),
  };
}

function walkHas(dir, re, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (re.test(e.name)) return true;
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
      if (walkHas(path.join(dir, e.name), re, depth - 1)) return true;
    }
  }
  return false;
}

module.exports = { certify };
