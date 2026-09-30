/**
 * Master lists (party, item, book, submaster, warehouse) live on the group's
 * first company. Transactions keep req.companyId as the company being worked.
 */
function masterScope(req, res, next) {
  const masterId = req.masterCompanyId || req.companyId;
  if (!masterId) return next();
  req.companyId = masterId;
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body.companyId = masterId;
  }
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'companyId')) {
    req.query.companyId = String(masterId);
  }
  return next();
}

module.exports = masterScope;
