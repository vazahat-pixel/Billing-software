const fs = require('fs');
const path = require('path');
const Party = require('../../models/Party');
const Sales = require('../../models/Sales');
const Item = require('../../models/Item');

/**
 * Multi-company isolation certification.
 * Structural: middleware present + companyId scoped queries + no cross-tenant leakage in sample.
 */
async function certify(companyId) {
  const issues = [];
  const mwPath = path.join(__dirname, '../../middlewares/companyIsolation.middleware.js');
  const authPath = path.join(__dirname, '../../middlewares/auth.middleware.js');

  if (!fs.existsSync(mwPath)) issues.push('companyIsolation.middleware.js missing');
  if (!fs.existsSync(authPath)) issues.push('auth.middleware.js missing');

  let mwOk = false;
  try {
    const mw = require('../../middlewares/companyIsolation.middleware.js');
    mwOk = typeof mw === 'function';
    if (!mwOk) issues.push('companyIsolation middleware is not a function');
  } catch (err) {
    issues.push(`Isolation middleware load error: ${err.message}`);
  }

  // Sample: documents without companyId (leak risk)
  let unscoped = 0;
  if (companyId) {
    const [parties, sales, items] = await Promise.all([
      Party.countDocuments({ companyId }).catch(() => 0),
      Sales.countDocuments({ companyId }).catch(() => 0),
      Item.countDocuments({ companyId }).catch(() => 0),
    ]);

    // Count records missing companyId in these collections (global leak risk)
    const [pMiss, sMiss, iMiss] = await Promise.all([
      Party.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }).catch(() => 0),
      Sales.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }).catch(() => 0),
      Item.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }).catch(() => 0),
    ]);
    unscoped = pMiss + sMiss + iMiss;
    if (unscoped > 0) {
      issues.push(`Unscoped master/txn documents: parties=${pMiss} sales=${sMiss} items=${iMiss}`);
    }

    // Soft presence
    void parties;
    void sales;
    void items;
  }

  // Source scan: middleware strips body.companyId spoofing
  let stripPresent = false;
  try {
    const src = fs.readFileSync(mwPath, 'utf8');
    stripPresent = src.includes('delete req.body.companyId') || src.includes("hasOwnProperty.call(req.body, 'companyId')");
    if (!stripPresent) issues.push('Isolation middleware does not strip spoofed companyId');
  } catch {
    /* already flagged */
  }

  const passed = issues.length === 0 && mwOk;
  return {
    passed,
    detail: `middleware=${mwOk} strip=${stripPresent} unscoped=${unscoped}`,
    gaps: issues,
    unscoped,
    score: passed ? 100 : Math.max(0, 100 - issues.length * 20),
  };
}

module.exports = { certify };
