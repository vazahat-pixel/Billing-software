import api from '../api/client';
import {
  removeOfflineRecord,
  removeSyncItem,
  updateSyncItem,
  getPendingSyncItems,
  getFailedSyncItems,
  getSyncQueueItems,
  putOfflineRecord,
  addToSyncQueue,
  generateLocalId,
  markOfflineDeleted,
  removeSyncQueueByLocalId,
  updateSyncQueuePayload,
  getActiveCompanyId
} from './offlineDB';
import {
  normalizeSale,
  normalizePurchase,
  normalizeParty,
  normalizeItem,
  normalizeVoucher
} from './normalizers';
import { isOffline, subscribeNetworkStatus } from './networkStatus';
import { useLocalApiAsSourceOfTruth } from './desktopMode';
import {
  isLocalId,
  remapLocalIds,
  pendingLocalRefs,
  resolveRequest,
  idempotencyKeyOf,
  classifyError,
  renumberNotice
} from './syncQueueCore';

const NORMALIZERS = {
  sales: normalizeSale,
  purchases: normalizePurchase,
  parties: normalizeParty,
  items: normalizeItem,
  payments: normalizeVoucher,
  receipts: normalizeVoucher,
  jobs: (j) => j,
  ledgers: (l) => l,
  notes: (n) => n
};

const INVENTORY_AFFECTING = new Set(['sales', 'purchases', 'jobs']);
const AUTO_RETRY_MS = 30 * 1000;

/** New operation id for a create; the same id goes online first and, if that fails, into the queue. */
export const newOperationId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateLocalId());

/** Tell listeners (status bar, desktop close warning) that the queue changed. */
const announce = async () => {
  if (typeof window === 'undefined') return;
  try {
    const all = await getSyncQueueItems(null);
    const open = all.filter((i) => i.status === 'pending' || i.status === 'failed');
    const detail = {
      pending: open.length,
      failed: open.filter((i) => i.status === 'failed').length,
      thisCompany: open.filter((i) => String(i.companyId) === String(getActiveCompanyId())).length
    };
    window.dispatchEvent(new CustomEvent('erp-sync-queue-changed', { detail }));
    window.textileDesktop?.setPendingSync?.(detail.pending);
  } catch {
    /* ignore */
  }
};

/** Point every waiting entry (and its device copy) at the server id of a master that just synced. */
const remapQueue = async (localId, serverId) => {
  if (!localId || !serverId || !isLocalId(localId)) return;
  const idMap = new Map([[localId, String(serverId)]]);
  const all = await getSyncQueueItems(null);
  for (const q of all) {
    const payload = remapLocalIds(q.payload, idMap);
    if (JSON.stringify(payload) !== JSON.stringify(q.payload)) await updateSyncItem(q.id, { payload });
  }
};

const syncItem = async (item) => {
  const req = resolveRequest(item);
  if (!req.url) throw Object.assign(new Error(`No sync address for ${item.entityType}`), { response: { status: 400 } });
  const response = await api.request({
    method: req.method,
    url: req.url,
    data: req.data,
    forceNetwork: true,
    headers: { 'Idempotency-Key': idempotencyKeyOf(item), 'X-Offline-Sync': '1' }
  });
  if (req.method === 'delete') return null;
  const raw = response.data?.data || response.data;
  const normalize = NORMALIZERS[item.entityType];
  return normalize ? normalize(raw) : raw;
};

let syncing = false;

/** True while an upload run is in progress (logout waits for it). */
export const isSyncRunning = () => syncing;

/**
 * Send the active company's queued entries, oldest first. Masters created offline go before the
 * bills that use them; a bill still pointing at an unsynced master waits. A network failure stops
 * the run (entries stay pending); a server refusal marks only that entry and the rest continue.
 * @param {{ includeRejected?: boolean }} opts — rejected entries are retried on reconnect / manual
 *   retry, not on every timer tick.
 */
export const processSyncQueue = async (onSynced, onError, onComplete, opts = {}) => {
  const includeRejected = opts.includeRejected !== false;
  if (useLocalApiAsSourceOfTruth()) return { synced: 0, failed: 0 };
  if (syncing || isOffline()) return { synced: 0, failed: 0 };
  syncing = true;

  let synced = 0;
  let failed = 0;
  let needsInventoryRefresh = false;
  const renumbered = [];

  try {
    const pending = (await getPendingSyncItems())
      .filter((i) => includeRejected || i.status !== 'failed')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    for (const queued of pending) {
      // Re-read: an earlier entry in this run may have remapped this one's ids.
      const item = (await getSyncQueueItems(null)).find((q) => q.id === queued.id);
      if (!item) continue;
      const waitingOn = pendingLocalRefs(item.payload, item.localId);
      if (waitingOn.length) {
        await updateSyncItem(item.id, { status: 'pending', error: 'Waiting for a party / item created offline to upload first' });
        continue;
      }
      try {
        const action = item.action || 'create';
        const saved = await syncItem(item);
        if (action === 'create' && isLocalId(item.localId)) {
          const serverId = saved?._id || saved?.id;
          await remapQueue(item.localId, serverId);
        }
        if (item.localId && (action === 'create' || action === 'delete')) {
          await removeOfflineRecord(item.entityType, item.localId);
        }
        await removeSyncItem(item.id);
        const notice = renumberNotice(item, saved);
        if (notice) renumbered.push(notice);
        if (INVENTORY_AFFECTING.has(item.entityType) && action !== 'delete') needsInventoryRefresh = true;
        if (onSynced) onSynced(item.entityType, saved, item.localId, action, notice);
        synced++;
      } catch (err) {
        const kind = classifyError(err);
        const message = err?.response?.data?.message || err.message;
        if (kind === 'offline' || kind === 'auth') {
          await updateSyncItem(item.id, {
            status: 'pending',
            error: kind === 'auth' ? 'Login expired — log in again to upload' : null,
            lastAttempt: new Date().toISOString()
          });
          break; // connection or login gone — stop; everything left stays queued
        }
        if (kind === 'retry') {
          await updateSyncItem(item.id, { status: 'pending', error: message, lastAttempt: new Date().toISOString() });
          continue;
        }
        failed++;
        await updateSyncItem(item.id, {
          status: 'failed',
          retries: (item.retries || 0) + 1,
          error: message,
          lastAttempt: new Date().toISOString()
        });
        if (onError) onError(item, err);
      }
    }
  } finally {
    syncing = false;
    await announce();
    if (onComplete) onComplete({ synced, failed, needsInventoryRefresh, renumbered });
  }

  return { synced, failed, needsInventoryRefresh, renumbered };
};

/**
 * Save an entry on the device and queue it for upload.
 * @param {{ endpoint?: string, queuePayload?: object }} opts — endpoint: exact create address when it
 *   is not the entity's default (contra, journal, receive); queuePayload: what to send, when it
 *   differs from the device copy.
 */
export const saveOffline = async (entityType, payload, action = 'create', opts = {}) => {
  if (useLocalApiAsSourceOfTruth()) {
    throw new Error('Desktop local mode: use live API (IndexedDB queue disabled)');
  }
  const companyId = getActiveCompanyId();
  const localId = payload.id || payload._id || generateLocalId();
  const record = await putOfflineRecord(entityType, {
    ...payload,
    id: localId,
    _id: localId,
    offlinePending: true,
    createdAt: payload.createdAt || new Date().toISOString()
  }, companyId);

  const sendPayload = { ...(opts.queuePayload || payload) };
  await addToSyncQueue({
    entityType,
    action,
    payload: sendPayload,
    localId,
    serverId: action === 'create' ? null : localId,
    opKey: sendPayload.operationId || generateLocalId(),
    ...(opts.endpoint ? { endpoint: opts.endpoint } : {})
  }, companyId);
  await announce();
  return record;
};

export const saveOfflineUpdate = async (entityType, id, payload) => {
  const companyId = getActiveCompanyId();
  const record = await putOfflineRecord(entityType, {
    ...payload,
    id,
    _id: id,
    offlinePending: true
  }, companyId);

  if (isLocalId(id)) {
    await updateSyncQueuePayload(id, payload);
  } else {
    await addToSyncQueue({
      entityType,
      action: 'update',
      payload: { ...payload },
      localId: id,
      serverId: id,
      opKey: generateLocalId()
    }, companyId);
  }
  await announce();
  return record;
};

export const saveOfflineDelete = async (entityType, id) => {
  const companyId = getActiveCompanyId();

  if (isLocalId(id)) {
    await removeOfflineRecord(entityType, id);
    await removeSyncQueueByLocalId(id);
    await announce();
    return;
  }

  await markOfflineDeleted(entityType, id);
  await addToSyncQueue({
    entityType,
    action: 'delete',
    payload: {},
    localId: id,
    serverId: id,
    opKey: generateLocalId()
  }, companyId);
  await announce();
};

/** Drop an entry the server will never accept (user confirmed). Removes the device copy too. */
export const discardSyncItem = async (queueId) => {
  const item = (await getSyncQueueItems(null)).find((q) => q.id === queueId);
  if (!item) return;
  if (item.localId && isLocalId(item.localId)) await removeOfflineRecord(item.entityType, item.localId);
  await removeSyncItem(queueId);
  await announce();
};

/** Entries still waiting (not refused) — e.g. a bill waiting for its offline party to upload. */
export const getWaitingSyncItems = async () =>
  (await getPendingSyncItems()).filter((i) => i.status === 'pending');

export const retrySyncItem = async (queueId, onSynced, onError, onComplete) => {
  await updateSyncItem(queueId, { status: 'pending', error: null });
  return processSyncQueue(onSynced, onError, onComplete);
};

export const retryAllFailed = async (onSynced, onError, onComplete) => {
  const failedItems = await getFailedSyncItems();
  await Promise.all(failedItems.map((item) => updateSyncItem(item.id, { status: 'pending', error: null })));
  return processSyncQueue(onSynced, onError, onComplete);
};

/**
 * Upload whenever a connection is available: on start, when the browser or the server comes back,
 * and every 30 s while anything is queued (pending entries only; refused ones wait for reconnect
 * or a manual retry).
 */
export const initSyncListener = (onSynced, onError, onComplete) => {
  if (useLocalApiAsSourceOfTruth()) {
    return () => {};
  }
  const run = (opts) => processSyncQueue(onSynced, onError, onComplete, opts);

  let wasOffline = isOffline();
  const unsubscribe = subscribeNetworkStatus(({ isOffline: offlineNow }) => {
    if (wasOffline && !offlineNow) run({ includeRejected: true });
    wasOffline = offlineNow;
  });
  const onBrowserOnline = () => run({ includeRejected: true });
  window.addEventListener('online', onBrowserOnline);
  const timer = setInterval(() => { if (!isOffline()) run({ includeRejected: false }); }, AUTO_RETRY_MS);
  if (!isOffline()) run({ includeRejected: true });
  announce();

  return () => {
    unsubscribe();
    window.removeEventListener('online', onBrowserOnline);
    clearInterval(timer);
  };
};

export const getPendingCount = async () => {
  const pending = await getPendingSyncItems();
  return pending.length;
};

export const getFailedCount = async () => {
  const failedItems = await getFailedSyncItems();
  return failedItems.length;
};

export { getFailedSyncItems, getPendingSyncItems };
