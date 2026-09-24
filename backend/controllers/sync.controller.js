const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const syncPushService = require('../services/syncPushService');
const syncPullService = require('../services/syncPullService');
const numberLeaseService = require('../services/numberLeaseService');
const syncOutboxService = require('../services/syncOutboxService');
const SyncDeviceState = require('../models/SyncDeviceState');
const AppError = require('../utils/AppError');

function deviceIdFrom(req) {
  return (
    req.body?.deviceId ||
    req.query?.deviceId ||
    req.headers['x-device-id'] ||
    req.user?.deviceId ||
    ''
  );
}

exports.status = asyncHandler(async (req, res) => {
  const deviceId = String(deviceIdFrom(req) || '');
  const companyId = req.companyId;
  let deviceState = null;
  if (deviceId && companyId) {
    deviceState = await SyncDeviceState.findOne({ companyId, deviceId }).lean();
  }
  const pending = String(process.env.DESKTOP_HYBRID || '') === 'true'
    ? await syncOutboxService.pendingCount(companyId)
    : 0;
  const lease = companyId
    ? await numberLeaseService.getLocalLeaseStatus(companyId, 'sales')
    : { available: 0 };

  return ok(res, {
    hybridSyncEnabled:
      String(process.env.HYBRID_SYNC_ENABLED || '').toLowerCase() === 'true' ||
      String(process.env.DESKTOP_HYBRID || '').toLowerCase() === 'true',
    desktopHybrid: String(process.env.DESKTOP_HYBRID || '') === 'true',
    deviceId: deviceId || null,
    syncVersion: deviceState?.syncVersion || 0,
    initialSyncComplete: !!deviceState?.initialSyncComplete,
    pullCursor: deviceState?.pullCursor || '',
    pendingOutbox: pending,
    invoiceLeaseRemaining: lease.available,
    serverTime: new Date().toISOString(),
  });
});

exports.push = asyncHandler(async (req, res) => {
  const deviceId = String(deviceIdFrom(req) || '');
  if (!deviceId) throw AppError.badRequest('deviceId is required');
  const result = await syncPushService.pushOperations({
    companyId: req.companyId,
    userId: req.user?.id || req.user?._id,
    deviceId,
    operations: Array.isArray(req.body?.operations) ? req.body.operations : [],
  });
  return ok(res, result, 'Sync push processed');
});

exports.pull = asyncHandler(async (req, res) => {
  const deviceId = String(deviceIdFrom(req) || '');
  if (!deviceId) throw AppError.badRequest('deviceId is required');
  const result = await syncPullService.pullChanges({
    companyId: req.companyId,
    deviceId,
    cursor: req.query.cursor || req.body?.cursor,
    limit: req.query.limit || req.body?.limit,
  });
  return ok(res, result);
});

exports.leaseInvoice = asyncHandler(async (req, res) => {
  const deviceId = String(deviceIdFrom(req) || '');
  if (!deviceId) throw AppError.badRequest('deviceId is required');

  const isHybridLocal =
    String(process.env.DESKTOP_HYBRID || '').toLowerCase() === 'true' &&
    String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true';
  const centralBase = String(process.env.CENTRAL_API_BASE_URL || '').replace(/\/$/, '');

  // Hybrid desktop must obtain leases from the central Counter — never allocate locally
  if (isHybridLocal && centralBase) {
    const token = req.headers.authorization || '';
    const upstream = await fetch(`${centralBase}/sync/leases/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'X-Device-Id': deviceId,
      },
      body: JSON.stringify({ size: req.body?.size, deviceId }),
    });
    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      throw AppError.badRequest(json?.message || `Central lease failed HTTP ${upstream.status}`);
    }
    const lease = json?.data || json;
    await numberLeaseService.cacheLeaseLocally(req.companyId, {
      ...lease,
      nextSeq: lease.nextSeq || lease.startSeq,
    });
    return created(res, lease, 'Invoice number lease allocated from central');
  }

  const lease = await numberLeaseService.allocateInvoiceLease(req.companyId, deviceId, {
    size: req.body?.size,
  });
  if (isHybridLocal) {
    await numberLeaseService.cacheLeaseLocally(req.companyId, lease);
  }
  return created(res, lease, 'Invoice number lease allocated');
});

exports.resolveConflict = asyncHandler(async (req, res) => {
  const { operationId, resolution } = req.body || {};
  if (!operationId) throw AppError.badRequest('operationId is required');
  // Phase 5: only acknowledge resolution metadata — no silent overwrite of financials
  if (resolution === 'retry') {
    const SyncOutbox = require('../models/SyncOutbox');
    await SyncOutbox.updateOne(
      { companyId: req.companyId, operationId },
      { $set: { status: 'RETRY', errorMessage: '' } }
    );
  } else if (resolution === 'discard_local') {
    const SyncOutbox = require('../models/SyncOutbox');
    await SyncOutbox.updateOne(
      { companyId: req.companyId, operationId },
      { $set: { status: 'FAILED', errorCode: 'DISCARDED', errorMessage: 'Discarded by resolve-conflict' } }
    );
  } else {
    throw AppError.badRequest('resolution must be retry or discard_local');
  }
  return ok(res, { operationId, resolution }, 'Conflict resolution recorded');
});

/** Desktop-local: apply pulled changes into local Mongo */
exports.applyPull = asyncHandler(async (req, res) => {
  if (String(process.env.DESKTOP_LOCAL || '') !== 'true') {
    throw AppError.forbidden('apply-pull is only available on desktop local API');
  }
  const result = await syncPullService.applyPulledChanges(req.body?.serverChanges || []);
  return ok(res, result);
});

/** Desktop-local: outbox pending summary */
exports.outboxPending = asyncHandler(async (req, res) => {
  const rows = await syncOutboxService.listPending({
    companyId: req.companyId,
    limit: Number(req.query.limit || 50),
  });
  const count = await syncOutboxService.pendingCount(req.companyId);
  return ok(res, { count, rows });
});

/**
 * Test / hybrid-e2e only: run one sync-agent tick (real drain/push/pull).
 * Gated — never available in normal production without HYBRID_E2E or NODE_ENV=test.
 */
exports.agentTick = asyncHandler(async (req, res) => {
  const allowed =
    process.env.NODE_ENV === 'test' ||
    String(process.env.HYBRID_E2E || '').toLowerCase() === 'true';
  if (!allowed) throw AppError.forbidden('agent-tick is test-only');
  const worker = require('../services/syncAgentWorker');
  await worker.tick();
  const ctx = await worker.getAgentContext();
  const pending = await syncOutboxService.pendingCount(req.companyId);
  return ok(res, { pending, agent: ctx });
});
