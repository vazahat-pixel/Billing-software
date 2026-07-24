const fs = require('fs');
const path = require('path');

/**
 * Security certification — middleware presence, JWT/RBAC/rate-limit/sanitize posture.
 */
async function certify() {
  const issues = [];
  const root = path.join(__dirname, '../..');
  const required = [
    'middlewares/auth.middleware.js',
    'middlewares/permission.middleware.js',
    'middlewares/companyIsolation.middleware.js',
    'middlewares/rateLimit.middleware.js',
  ];

  for (const rel of required) {
    if (!fs.existsSync(path.join(root, rel))) issues.push(`Missing ${rel}`);
  }

  // Package deps
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const d of ['helmet', 'express-rate-limit', 'express-mongo-sanitize', 'jsonwebtoken', 'bcryptjs']) {
    if (!deps[d]) issues.push(`Missing dependency: ${d}`);
  }

  // Server mounts security middleware
  let serverSrc = '';
  try {
    serverSrc = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  } catch {
    issues.push('server.js unreadable');
  }
  if (serverSrc && !/helmet/i.test(serverSrc)) issues.push('Helmet not referenced in server.js');
  if (serverSrc && !/mongo-sanitize|mongoSanitize/i.test(serverSrc)) {
    issues.push('Mongo sanitize not referenced in server.js');
  }

  // Try load critical middlewares
  try {
    require('../../middlewares/auth.middleware');
    require('../../middlewares/permission.middleware');
  } catch (err) {
    issues.push(`Middleware load failure: ${err.message}`);
  }

  const passed = issues.length === 0;
  return {
    passed,
    detail: `checks=${required.length} issues=${issues.length}`,
    gaps: issues,
    score: passed ? 100 : Math.max(0, 100 - issues.length * 15),
  };
}

module.exports = { certify };
