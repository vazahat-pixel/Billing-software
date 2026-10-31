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

async function centralFetch(path, { method = 'GET', body, token, deviceId, operationId } = {}) {
  const base = centralBase();
  if (!base) throw new Error('CENTRAL_API_BASE_URL not configured');
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId || '',
    // Tells a local API (when the target is one) that this came from sync, so it is not re-queued.
    'X-From-Sync': 'true',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Exactly-once on the cloud: middlewares/idempotency.middleware stores the first reply under this
  // key and returns it again if a retry arrives, so a lost response cannot post the entry twice.
  if (operationId) headers['Idempotency-Key'] = operationId;
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

/**
 * Replay rows (entityType 'rest') carry a request the cloud should run through its own controller,
 * so they go to that endpoint one at a time and in sequence order, not to /sync/push. A row whose
 * ids are not on the cloud yet is left PENDING and picked up on a later tick, once the create it
 * depends on has been pushed.
 */
async function pushReplays(ctx, rows) {
  const syncIdMapService = require('./syncIdMapService');
  const { buildReplayRequest } = require('./syncIdMapCore');

  let pushed = 0;
  let deferred = 0;

  for (const row of rows) {
    const idMap = await syncIdMapService.loadMap(ctx.companyId);
    const unsynced = await syncIdMapService.unsyncedLocalIds(ctx.companyId);
    unsynced.delete(String(row.entityId)); // its own id must not block it

    const req = buildReplayRequest(row, idMap, unsynced);
    if (!req.ready) {
      deferred += 1;
      await syncOutboxService.markFailed(row.operationId, row.companyId, {
        errorCode: 'WAITING',
        errorMessage: `waiting for ${req.waitingOn.join(', ')} to reach the cloud`,
      });
      continue;
    }

    await syncOutboxService.markSyncing(row.operationId, row.companyId);
    try {
      const result = await centralFetch(req.path, {
        method: req.method,
        body: req.body,
        token: ctx.token,
        deviceId: ctx.deviceId,
        operationId: row.operationId,
      });
      const serverId = result?._id || result?.id || '';
      if (row.entityId && serverId) {
        await syncIdMapService.recordMapping(ctx.companyId, 'rest', row.entityId, serverId);
      }
      await syncOutboxService.markSynced(row.operationId, ctx.companyId, { serverEntityId: serverId });
      pushed += 1;
    } catch (err) {
      // 4xx other than 409 will not fix itself by retrying, but we still keep the row so the
      // owner can see it instead of the entry disappearing.
      await syncOutboxService.markFailed(row.operationId, row.companyId, {
        errorCode: String(err.status || 'NETWORK'),
        errorMessage: err.message,
        conflict: err.status === 409,
      });
    }
  }

  return { pushed, deferred };
}

async function pushPending(ctx) {
  const pending = await syncOutboxService.listPending({
    companyId: ctx.companyId,
    limit: 20,
  });
  if (!pending.length) return { pushed: 0 };

  // Typed rows go to /sync/push; REST replays run against their own endpoint.
  const replayRows = pending.filter((r) => String(r.entityType) === 'rest');
  const typedRows = pending.filter((r) => String(r.entityType) !== 'rest');

  // Creates first: a replay usually depends on them having a cloud id.
  let replayResult = { pushed: 0, deferred: 0 };

  if (!typedRows.length) {
    replayResult = await pushReplays(ctx, replayRows);
    return { pushed: replayResult.pushed, deferred: replayResult.deferred };
  }

  const operations = [];
  for (const row of typedRows) {
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
    const syncIdMapService = require('./syncIdMapService');
    for (const acc of result.acceptedOperations || []) {
      await syncOutboxService.markSynced(acc.operationId, ctx.companyId, {
        serverEntityId: acc.entityId,
        serverInvoiceNo: acc.invoiceNo,
      });
      // The cloud minted its own _id — remember it, or a later receipt or edit against this
      // document would be replayed with an id the cloud has never seen.
      const local = typedRows.find((r) => r.operationId === acc.operationId);
      if (local?.entityId && acc.entityId) {
        await syncIdMapService.recordMapping(ctx.companyId, local.entityType, local.entityId, acc.entityId);
      }
    }
    for (const fail of result.failedOperations || []) {
      console.warn('[syncAgentWorker] push failed operation:', JSON.stringify(fail));
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
    // Now that the creates have cloud ids, the replays that depend on them can go.
    if (replayRows.length) replayResult = await pushReplays(ctx, replayRows);

    await setAgentContext({
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      syncState: 'synced',
    });
    return {
      pushed: (result.acceptedOperations || []).length + replayResult.pushed,
      deferred: replayResult.deferred,
    };
  } catch (err) {
    for (const row of typedRows) {
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
    const nextCursor = result.nextCursor || '';
    if (result.complete) {
      cursor = nextCursor;
      await setAgentContext({ pullCursor: cursor });
      break;
    }
    if (cursor === nextCursor) break;
    cursor = nextCursor;
    await setAgentContext({ pullCursor: cursor });
  }
}

async function tick() {
  if (!isHybridDesktop()) return;
  if (!centralBase()) return;
  if (running) {
    let waited = 0;
    while (running && waited < 100) {
      await new Promise(r => setTimeout(r, 100));
      waited++;
    }
  }
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
    await setAgentContext({ syncState: 'issue', lastError: err.message });
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
  if (process.env.NODE_ENV !== 'test' && String(process.env.HYBRID_E2E || '').toLowerCase() !== 'true') {
    setTimeout(() => tick().catch(() => {}), 5000);
  }
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
