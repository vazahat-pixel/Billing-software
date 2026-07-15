import api from '../api/client';
import {
  removeOfflineRecord,
  removeSyncItem,
  updateSyncItem,
  getPendingSyncItems,
  getFailedSyncItems,
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
  normalizeVoucher,
  normalizeInventoryLot
} from './normalizers';
import { isOffline } from './networkStatus';

const ENDPOINTS = {
  sales: '/sales',
  purchases: '/purchases',
  parties: '/parties',
  items: '/items',
  payments: '/accounting/payments',
  receipts: '/accounting/receipts'
};

const NORMALIZERS = {
  sales: normalizeSale,
  purchases: normalizePurchase,
  parties: normalizeParty,
  items: normalizeItem,
  payments: normalizeVoucher,
  receipts: normalizeVoucher
};

const INVENTORY_AFFECTING = new Set(['sales', 'purchases']);

const isDuplicateError = (err) => {
  const msg = (err?.response?.data?.message || err?.message || '').toLowerCase();
  return msg.includes('duplicate') || msg.includes('already exists') || msg.includes('unique');
};

const isLocalId = (id) => String(id || '').startsWith('local-');

const renameInvoiceNo = (payload) => {
  const current = payload.invoiceNo;
  if (!current || current === 'AUTO') return { ...payload, invoiceNo: 'AUTO' };
  return { ...payload, invoiceNo: `${current}-OFF${Date.now().toString().slice(-4)}` };
};

const runCreate = async (item) => {
  const endpoint = ENDPOINTS[item.entityType];
  let payload = { ...item.payload };
  // Offline drafts use local-* ids — never send those as Mongo _id
  if (isLocalId(payload._id) || isLocalId(payload.id)) {
    const { _id, id, localId, ...rest } = payload;
    payload = rest;
  }
  if (payload.invoiceNo && String(payload.invoiceNo).startsWith('local-')) {
    payload = { ...payload, invoiceNo: 'AUTO' };
  }
  try {
    return await api.post(endpoint, payload, { forceNetwork: true });
  } catch (err) {
    if (isDuplicateError(err) && (item.entityType === 'sales' || item.entityType === 'purchases')) {
      payload = renameInvoiceNo(payload);
      return await api.post(endpoint, payload, { forceNetwork: true });
    }
    throw err;
  }
};

const runUpdate = async (item) => {
  const endpoint = ENDPOINTS[item.entityType];
  const targetId = item.serverId || item.localId;
  if (item.payload?.status && Object.keys(item.payload).length === 1) {
    return api.put(`${endpoint}/${targetId}/status`, item.payload, { forceNetwork: true });
  }
  return api.put(`${endpoint}/${targetId}`, item.payload, { forceNetwork: true });
};

const runDelete = async (item) => {
  const endpoint = ENDPOINTS[item.entityType];
  const targetId = item.serverId || item.localId;
  return api.delete(`${endpoint}/${targetId}`, { forceNetwork: true });
};

const syncItem = async (item, onSynced) => {
  const action = item.action || 'create';
  let response;

  if (action === 'create') {
    response = await runCreate(item);
  } else if (action === 'update') {
    response = await runUpdate(item);
  } else if (action === 'delete') {
    await runDelete(item);
    if (item.localId) await removeOfflineRecord(item.entityType, item.localId);
    await removeSyncItem(item.id);
    if (onSynced) onSynced(item.entityType, null, item.localId, action);
    return null;
  } else {
    throw new Error(`Unknown sync action: ${action}`);
  }

  const raw = response.data?.data || response.data;
  const normalize = NORMALIZERS[item.entityType];
  const synced = normalize ? normalize(raw) : raw;

  if (item.localId && action === 'create') {
    await removeOfflineRecord(item.entityType, item.localId);
  }
  await removeSyncItem(item.id);

  if (onSynced) onSynced(item.entityType, synced, item.localId, action);
  return synced;
};

let syncing = false;

export const processSyncQueue = async (onSynced, onError, onComplete) => {
  if (syncing || isOffline()) return { synced: 0, failed: 0 };
  syncing = true;

  let synced = 0;
  let failed = 0;
  let needsInventoryRefresh = false;

  try {
    const pending = await getPendingSyncItems();
    pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    for (const item of pending) {
      try {
        await updateSyncItem(item.id, { status: 'pending' });
        await syncItem(item, (entityType, syncedRecord, localId, action) => {
          if (INVENTORY_AFFECTING.has(entityType) && action !== 'delete') {
            needsInventoryRefresh = true;
          }
          if (onSynced) onSynced(entityType, syncedRecord, localId, action);
        });
        synced++;
      } catch (err) {
        failed++;
        await updateSyncItem(item.id, {
          status: 'failed',
          retries: (item.retries || 0) + 1,
          error: err?.response?.data?.message || err.message,
          lastAttempt: new Date().toISOString()
        });
        if (onError) onError(item, err);
      }
    }
  } finally {
    syncing = false;
    if (onComplete) onComplete({ synced, failed, needsInventoryRefresh });
  }

  return { synced, failed, needsInventoryRefresh };
};

export const saveOffline = async (entityType, payload, action = 'create') => {
  const companyId = getActiveCompanyId();
  const localId = payload.id || payload._id || generateLocalId();
  const record = await putOfflineRecord(entityType, {
    ...payload,
    id: localId,
    _id: localId,
    offlinePending: true,
    createdAt: payload.createdAt || new Date().toISOString()
  }, companyId);

  await addToSyncQueue({
    entityType,
    action,
    payload: { ...payload },
    localId,
    serverId: action === 'create' ? null : localId
  }, companyId);
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
      serverId: id
    }, companyId);
  }
  return record;
};

export const saveOfflineDelete = async (entityType, id) => {
  const companyId = getActiveCompanyId();

  if (isLocalId(id)) {
    await removeOfflineRecord(entityType, id);
    await removeSyncQueueByLocalId(id);
    return;
  }

  await markOfflineDeleted(entityType, id);
  await addToSyncQueue({
    entityType,
    action: 'delete',
    payload: {},
    localId: id,
    serverId: id
  }, companyId);
};

export const retrySyncItem = async (queueId, onSynced, onError, onComplete) => {
  await updateSyncItem(queueId, { status: 'pending', error: null });
  return processSyncQueue(onSynced, onError, onComplete);
};

export const retryAllFailed = async (onSynced, onError, onComplete) => {
  const failed = await getFailedSyncItems();
  await Promise.all(failed.map((item) => updateSyncItem(item.id, { status: 'pending', error: null })));
  return processSyncQueue(onSynced, onError, onComplete);
};

export const initSyncListener = (onSynced, onError, onComplete) => {
  const run = () => processSyncQueue(onSynced, onError, onComplete);

  window.addEventListener('online', run);
  if (!isOffline()) run();

  return () => window.removeEventListener('online', run);
};

export const getPendingCount = async () => {
  const pending = await getPendingSyncItems();
  return pending.length;
};

export const getFailedCount = async () => {
  const failed = await getFailedSyncItems();
  return failed.length;
};

export { getFailedSyncItems, getPendingSyncItems };
