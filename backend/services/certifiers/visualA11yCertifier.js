const fs = require('fs');
const path = require('path');

/**
 * Visual regression + accessibility harness certification (Playwright artifacts).
 */
async function certify() {
  const fe = path.join(__dirname, '../../../frontend');
  const issues = [];
  const required = [
    path.join(fe, 'playwright.config.js'),
    path.join(fe, 'e2e', 'visual.spec.js'),
    path.join(fe, 'e2e', 'keyboard.spec.js'),
    path.join(fe, 'e2e', 'smoke.spec.js'),
  ];

  for (const p of required) {
    if (!fs.existsSync(p)) issues.push(`Missing: ${path.relative(fe, p)}`);
  }

  const pkgPath = path.join(fe, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.devDependencies?.['@playwright/test']) issues.push('@playwright/test not in frontend deps');
  }

  const passed = issues.length === 0;
  return {
    passed,
    detail: `artifacts=${required.length - issues.length}/${required.length}`,
    gaps: issues,
    score: passed ? 100 : Math.max(40, 100 - issues.length * 20),
  };
}

module.exports = { certify };
