'use strict';

/**
 * /api/sync/mirror/* — desktop mirroring.
 *
 * On the cloud: manifest / page (desktop downloads its company), apply (desktop uploads what it
 * changed), lock (Desktop-only entries).
 * On the desktop: status (what the screen shows), lock (forwarded to the cloud), retry.
 */

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

const isDesktop = () => String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true';

/** Mirroring copies whole documents (users included), so only Owner / Admin may run it. */
function assertOwnerOrAdmin(req) {
  const role = String(req.user?.companyRole || '').toLowerCase();
  if (req.user?.role === 'super_admin' || role === 'owner' || role === 'admin') return;
  throw AppError.forbidden('Only the Owner or an Admin can connect a desktop to this company.');
}

function cloudOnly() {
  if (isDesktop()) throw AppError.notFound('Not available on the desktop');
}

exports.manifest = asyncHandler(async (req, res) => {
  cloudOnly();
  assertOwnerOrAdmin(req);
  const central = require('../services/replication/centralService');
  return ok(res, await central.manifest(req.companyId));
});

exports.page = asyncHandler(async (req, res) => {
  cloudOnly();
  assertOwnerOrAdmin(req);
  const central = require('../services/replication/centralService');
  const { collection, after, limit, since, until } = req.query;
  return ok(res, await central.snapshotPage(req.companyId, { collection, after, limit, since, until }));
});

exports.apply = asyncHandler(async (req, res) => {
  cloudOnly();
  assertOwnerOrAdmin(req);
  if (typeof req.body?.payload !== 'string') throw AppError.badRequest('payload (EJSON string) is required');
  const central = require('../services/replication/centralService');
  return ok(res, await central.applyBatch(req.companyId, req.body.payload));
});

exports.getLock = asyncHandler(async (req, res) => {
  if (isDesktop()) {
    const desktop = require('../services/replication/desktopSync');
    return ok(res, await desktop.getLock({ refresh: true }));
  }
  const central = require('../services/replication/centralService');
  return ok(res, await central.getLock(req.companyId));
});

exports.setLock = asyncHandler(async (req, res) => {
  assertOwnerOrAdmin(req);
  const desktopOnly = !!req.body?.desktopOnly;
  if (isDesktop()) {
    const desktop = require('../services/replication/desktopSync');
    try {
      return ok(res, await desktop.setLock(desktopOnly));
    } catch (err) {
      throw AppError.badRequest(`Could not reach the cloud to change this setting: ${err.message}`);
    }
  }
  const central = require('../services/replication/centralService');
  return ok(res, await central.setLock(req.companyId, desktopOnly, req.user?.name || req.user?.email));
});

exports.status = asyncHandler(async (req, res) => {
  if (!isDesktop()) throw AppError.notFound('Only meaningful on the desktop');
  const desktop = require('../services/replication/desktopSync');
  return ok(res, await desktop.status());
});

exports.retry = asyncHandler(async (req, res) => {
  if (!isDesktop()) throw AppError.notFound('Only meaningful on the desktop');
  const desktop = require('../services/replication/desktopSync');
  desktop.tick().catch(() => {});
  return ok(res, { started: true });
});
