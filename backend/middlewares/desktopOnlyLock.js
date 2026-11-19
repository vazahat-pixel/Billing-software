'use strict';

/**
 * Cloud only: "Desktop-only entries".
 *
 * While the owner keeps this ON, the office desktop is the only place business data is entered.
 * The web still shows everything (reports, ledgers, bills), but saving, editing or deleting an entry
 * is refused with 423 — so the web and the desktop can never both change the same bill or take the
 * same bill number while the desktop is offline. The desktop's own uploads go through
 * /sync/mirror/*, which is not covered here.
 *
 * On the desktop itself this is a no-op: the desktop is the writer.
 */

const { isLocked } = require('../services/replication/centralService');

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Data-entry modules (paths relative to /api). */
const LOCKED = /^\/(sales|sales-engine|orders|purchases|purchase-engine|jobs|production|production-engine|inventory|inventory-engine|accounting|notes|returns|tds|parties|items|books|submasters|warehouses|masters|migration|stage3\/journals)(\/|$)/;

/** POST endpoints under those modules that only read or calculate. */
const READ_LIKE = /\/(reports?|preview|search|lookup|export|print|compute|calculate|validate|credit-check|check-duplicates|evaluate-approval|payload)(\/|$)/;

function isDesktop() {
  return String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true';
}

/** Exported for tests: would this request be blocked while the lock is ON? */
function isLockedWrite(method, path) {
  const m = String(method || '').toUpperCase();
  const p = String(path || '').split('?')[0];
  if (!WRITE.has(m)) return false;
  if (!LOCKED.test(p)) return false;
  if (m === 'POST' && READ_LIKE.test(p)) return false;
  return true;
}

async function desktopOnlyLock(req, res, next) {
  if (isDesktop()) return next();
  if (!isLockedWrite(req.method, req.path)) return next();
  const companyId = req.companyId || req.user?.companyId;
  if (!companyId) return next();
  try {
    if (!(await isLocked(companyId))) return next();
  } catch (err) {
    // Never block the web because the lock could not be read.
    return next();
  }
  return res.status(423).json({
    success: false,
    code: 'DESKTOP_ONLY_ENTRIES',
    message:
      'Entries for this company are made on the office desktop. The web is view-only while ' +
      '"Desktop-only entries" is ON (Setup System > Setting > Desktop-only Entries).',
  });
}

module.exports = desktopOnlyLock;
module.exports.isLockedWrite = isLockedWrite;
