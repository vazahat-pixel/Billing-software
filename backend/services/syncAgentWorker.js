/**
 * Desktop-hybrid background agent: drain SyncOutbox → central /api/sync/push,
 * pull masters, renew leases. Runs inside local Express when DESKTOP_HYBRID=true.
 */
const syncOutboxService = require('./syncOutboxService');
const numberLeaseService = require('./numberLeaseService');
const SyncState = require('../models/SyncState');

let timer = null;
let running = false;

function isHybridDesktop() {
  return (
    String(process.env.DESKTOP_HYBRID || '').toLowerCase() === 'true' &&
    String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true'
  );
}

function centralBase() {
  return String(process.env.CENTRAL_API_BASE_URL || '').replace(/\/$/, '');
}

async function getAgentContext() {
  const doc = await SyncState.findOne({ key: 'hybrid:agent' }).lean();
  return doc?.value || {};
}

async function setAgentContext(patch) {
  const current = await getAgentContext();
  await SyncState.findOneAndUpdate(
    { key: 'hybrid:agent' },
    { $set: { value: { ...current, ...patch, updatedAt: new Date().toISOString() } } },
    { upsert: true }
  );
}

async function centralFetch(path, { method = 'GET', body, token, deviceId } = {}) {
  const base = centralBase();
  if (!base) throw new Error('CENTRAL_API_BASE_URL not configured');
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId || '',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.message || json?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json?.data ?? json;
}

async function renewLeaseIfNeeded(ctx) {
  if (!ctx.companyId || !ctx.token || !ctx.deviceId) return;
  const status = await numberLeaseService.getLocalLeaseStatus(ctx.companyId, 'sales');
  if (status.available >= 10) return;
  const lease = await centralFetch('/sync/leases/invoice', {
    method: 'POST',
    token: ctx.token,
    deviceId: ctx.deviceId,
    body: { size: Number(process.env.SYNC_INVOICE_LEASE_SIZE || 50), deviceId: ctx.deviceId },
  });
  await numberLeaseService.cacheLeaseLocally(ctx.companyId, lease);
}

async function pushPending(ctx) {
  const pending = await syncOutboxService.listPending({
    companyId: ctx.companyId,
    limit: 20,
  });
  if (!pending.length) return { pushed: 0 };

  const operations = [];
  for (const row of pending) {
    await syncOutboxService.markSyncing(row.operationId, row.companyId);
    operations.push({
      operationId: row.operationId,
      entityType: row.entityType,
      entityId: row.entityId,
      operationType: row.operationType,
      payload: row.payload,
      sequenceNumber: row.sequenceNumber,
    });
  }

  try {
    const result = await centralFetch('/sync/push', {
      method: 'POST',
      token: ctx.token,
      deviceId: ctx.deviceId,
      body: { deviceId: ctx.deviceId, operations },
    });
    for (const acc of result.acceptedOperations || []) {
      await syncOutboxService.markSynced(acc.operationId, ctx.companyId, {
        serverEntityId: acc.entityId,
        serverInvoiceNo: acc.invoiceNo,
      });
    }
    for (const fail of result.failedOperations || []) {
      await syncOutboxService.markFailed(fail.operationId, ctx.companyId, {
        errorCode: fail.errorCode,
        errorMessage: fail.errorMessage,
      });
    }
    for (const c of result.conflicts || []) {
      await syncOutboxService.markFailed(c.operationId, ctx.companyId, {
        errorCode: c.errorCode,
        errorMessage: c.errorMessage,
        conflict: true,
      });
    }
    await setAgentContext({
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      syncState: 'synced',
    });
    return { pushed: (result.acceptedOperations || []).length };
  } catch (err) {
    for (const row of pending) {
      await syncOutboxService.markFailed(row.operationId, row.companyId, {
        errorCode: String(err.status || 'NETWORK'),
        errorMessage: err.message,
      });
    }
    await setAgentContext({ lastError: err.message, syncState: 'issue' });
    throw err;
  }
}

async function pullIncremental(ctx) {
  if (!ctx.token || !ctx.deviceId || !ctx.companyId) return;
  let cursor = ctx.pullCursor || '';
  let guard = 0;
  while (guard < 50) {
    guard += 1;
    const qs = new URLSearchParams({
      deviceId: ctx.deviceId,
      limit: '100',
    });
    if (cursor) qs.set('cursor', cursor);
    const result = await centralFetch(`/sync/pull?${qs}`, {
      token: ctx.token,
      deviceId: ctx.deviceId,
    });
    if (result.serverChanges?.length) {
      await require('./syncPullService').applyPulledChanges(result.serverChanges);
    }
    cursor = result.nextCursor || '';
    await setAgentContext({ pullCursor: cursor });
    if (result.complete) break;
    if (!result.serverChanges?.length) break;
  }
}

async function tick() {
  if (running || !isHybridDesktop()) return;
  if (!centralBase()) return;
  running = true;
  try {
    const ctx = await getAgentContext();
    if (!ctx.token || !ctx.companyId || !ctx.deviceId) {
      await setAgentContext({ syncState: 'idle', lastError: 'awaiting login context' });
      return;
    }
    await setAgentContext({ syncState: 'syncing' });
    await renewLeaseIfNeeded(ctx);
    await pushPending(ctx);
    await pullIncremental(ctx);
    const pending = await syncOutboxService.pendingCount(ctx.companyId);
    await setAgentContext({
      syncState: pending ? 'issue' : 'synced',
      pendingCount: pending,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[syncAgentWorker]', err.message);
  } finally {
    running = false;
  }
}

function startSyncAgentWorker(intervalMs = Number(process.env.SYNC_AGENT_INTERVAL_MS || 20000)) {
  if (!isHybridDesktop()) return;
  if (timer) return;
  console.log('[syncAgentWorker] starting hybrid sync agent');
  timer = setInterval(() => {
    tick().catch(() => {});
  }, intervalMs);
  if (timer.unref) timer.unref();
  setTimeout(() => tick().catch(() => {}), 5000);
}

function stopSyncAgentWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Called from auth login success on desktop hybrid to seed agent credentials */
async function seedAgentSession({ companyId, token, deviceId, refreshToken }) {
  await setAgentContext({
    companyId: String(companyId),
    token,
    refreshToken: refreshToken || '',
    deviceId: String(deviceId || ''),
  });
}

module.exports = {
  startSyncAgentWorker,
  stopSyncAgentWorker,
  tick,
  seedAgentSession,
  getAgentContext,
  setAgentContext,
  isHybridDesktop,
};
