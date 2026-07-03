import { openDB } from 'idb';

const DB_NAME = 'billing-offline';
const DB_VERSION = 6;
const DATA_STORES = [
  'parties', 'items', 'sales', 'purchases', 'books',
  'inventory', 'payments', 'receipts', 'syncQueue',
  'jobs', 'orders', 'returns', 'notes', 'visits', 'ledgers', 'subMasters'
];
const AUTH_STORE = 'offlineAuth';
const STORES = [...DATA_STORES, AUTH_STORE];
const COMPANY_KEY = 'offlineCompanyId';

let dbPromise = null;

const resetDbPromise = () => {
  dbPromise = null;
};

export const getActiveCompanyId = () => localStorage.getItem(COMPANY_KEY);

export const setActiveCompanyId = (companyId) => {
  if (companyId) localStorage.setItem(COMPANY_KEY, String(companyId));
  else localStorage.removeItem(COMPANY_KEY);
};

const ensureIndex = (objectStore, name, keyPath) => {
  if (!objectStore.indexNames.contains(name)) {
    objectStore.createIndex(name, keyPath);
  }
};

const configureStore = (objectStore, storeName) => {
  if (storeName === 'syncQueue') {
    ensureIndex(objectStore, 'status', 'status');
    ensureIndex(objectStore, 'companyId', 'companyId');
  } else if (storeName === AUTH_STORE) {
    ensureIndex(objectStore, 'email', 'email');
  } else {
    ensureIndex(objectStore, 'companyId', 'companyId');
  }
};

const runUpgrade = (db, transaction) => {
  STORES.forEach((storeName) => {
    if (!db.objectStoreNames.contains(storeName)) {
      configureStore(db.createObjectStore(storeName, { keyPath: 'id' }), storeName);
      return;
    }
    configureStore(transaction.objectStore(storeName), storeName);
  });
};

const deleteDatabase = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('[OfflineDB] Delete blocked — close other tabs, then refresh');
    };
  });

const openDatabase = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      runUpgrade(db, transaction);
    },
    blocked() {
      console.warn('[OfflineDB] Database upgrade blocked — close other open tabs');
    }
  });

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDatabase().catch(async (err) => {
      console.warn('[OfflineDB] Opening failed, resetting local cache:', err?.message);
      await deleteDatabase();
      return openDatabase();
    });
  }
  return dbPromise;
};

export const generateLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const withCompany = (entity, companyId) => ({
  ...entity,
  companyId: companyId || entity.companyId || getActiveCompanyId()
});

export const cacheEntities = async (storeName, entities, companyId = getActiveCompanyId()) => {
  if (!companyId || !entities?.length) return;
  const db = await getDB();
  const cid = String(companyId);

  const existing = await db.getAll(storeName);
  const tx = db.transaction(storeName, 'readwrite');
  for (const row of existing) {
    if (String(row.companyId) === cid && !row.offlinePending) {
      await tx.store.delete(row.id);
    }
  }

  for (const entity of entities) {
    const id = entity.id || entity._id;
    if (!id) continue;
    await tx.store.put(withCompany({ ...entity, id, _cachedAt: Date.now() }, cid));
  }
  await tx.done;
};

export const getCachedEntities = async (storeName, companyId = getActiveCompanyId()) => {
  const db = await getDB();
  const all = await db.getAll(storeName);
  if (!companyId) {
    return all.filter((r) => !r.offlineDeleted);
  }
  return all.filter(
    (r) => String(r.companyId) === String(companyId) && !r.offlineDeleted
  );
};

export const patchOfflineCache = async (storeName, id, payload, companyId = getActiveCompanyId()) => {
  const db = await getDB();
  const existing = (await db.get(storeName, id)) || { id, _id: id };
  const entry = withCompany({ ...existing, ...payload, id, _id: id }, companyId);
  await db.put(storeName, entry);
  return entry;
};

export const putOfflineRecord = async (storeName, record, companyId = getActiveCompanyId()) => {
  const db = await getDB();
  const id = record.id || record._id || generateLocalId();
  const entry = withCompany(
    { ...record, id, _id: id, offlinePending: true, offlineDeleted: false },
    companyId
  );
  await db.put(storeName, entry);
  return entry;
};

export const markOfflineDeleted = async (storeName, id) => {
  const db = await getDB();
  const existing = await db.get(storeName, id);
  if (!existing) return null;
  const entry = { ...existing, offlineDeleted: true, offlinePending: true };
  await db.put(storeName, entry);
  return entry;
};

export const removeOfflineRecord = async (storeName, id) => {
  const db = await getDB();
  await db.delete(storeName, id);
};

export const addToSyncQueue = async (item, companyId = getActiveCompanyId()) => {
  const db = await getDB();
  const entry = {
    id: generateLocalId(),
    status: 'pending',
    retries: 0,
    createdAt: new Date().toISOString(),
    companyId: companyId || getActiveCompanyId(),
    ...item
  };
  await db.put('syncQueue', entry);
  return entry;
};

export const getSyncQueueItems = async (companyId = getActiveCompanyId()) => {
  const db = await getDB();
  const all = await db.getAll('syncQueue');
  if (!companyId) return all;
  return all.filter((item) => String(item.companyId) === String(companyId));
};

export const getPendingSyncItems = async (companyId = getActiveCompanyId()) => {
  const items = await getSyncQueueItems(companyId);
  return items.filter((item) => item.status === 'pending' || item.status === 'failed');
};

export const getFailedSyncItems = async (companyId = getActiveCompanyId()) => {
  const items = await getSyncQueueItems(companyId);
  return items.filter((item) => item.status === 'failed');
};

export const updateSyncItem = async (id, updates) => {
  const db = await getDB();
  const existing = await db.get('syncQueue', id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await db.put('syncQueue', updated);
  return updated;
};

export const removeSyncItem = async (id) => {
  const db = await getDB();
  await db.delete('syncQueue', id);
};

export const removeSyncQueueByLocalId = async (localId) => {
  const all = await getSyncQueueItems(null);
  const match = all.find((item) => item.localId === localId);
  if (match) await removeSyncItem(match.id);
};

export const updateSyncQueuePayload = async (localId, payload) => {
  const all = await getSyncQueueItems(null);
  const match = all.find((item) => item.localId === localId && item.action === 'create');
  if (!match) return null;
  return updateSyncItem(match.id, { payload: { ...match.payload, ...payload } });
};

export const clearOfflineDB = async () => {
  try {
    const db = await getDB();
    const tx = db.transaction(DATA_STORES, 'readwrite');
    for (const store of DATA_STORES) {
      await tx.objectStore(store).clear();
    }
    await tx.done;
  } finally {
    resetDbPromise();
    localStorage.removeItem(COMPANY_KEY);
  }
};

export const putOfflineAuth = async (record) => {
  const db = await getDB();
  await db.put(AUTH_STORE, record);
  return record;
};

export const getOfflineAuth = async (email) => {
  const db = await getDB();
  return db.get(AUTH_STORE, email.trim().toLowerCase());
};

export const listOfflineAuths = async () => {
  const db = await getDB();
  return db.getAll(AUTH_STORE);
};

export const removeOfflineAuth = async (email) => {
  const db = await getDB();
  await db.delete(AUTH_STORE, email.trim().toLowerCase());
};

export const clearCompanyCache = async (companyId) => {
  if (!companyId) return;
  const cid = String(companyId);
  const db = await getDB();

  for (const store of DATA_STORES) {
    const all = await db.getAll(store);
    const tx = db.transaction(store, 'readwrite');
    for (const row of all) {
      if (String(row.companyId) === cid) {
        await tx.store.delete(row.id);
      }
    }
    await tx.done;
  }
};

export const prepareCompanyCache = async (newCompanyId) => {
  const prev = getActiveCompanyId();
  const next = newCompanyId ? String(newCompanyId) : null;
  if (prev && next && prev !== next) {
    await clearCompanyCache(prev);
  }
  setActiveCompanyId(next);
};
