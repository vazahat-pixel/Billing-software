import { openDB } from 'idb';

const DB_NAME = 'billing-offline';
const DB_VERSION = 7;
const DATA_STORES = [
  'parties', 'items', 'sales', 'purchases', 'books',
  'inventory', 'payments', 'receipts', 'vouchers', 'syncQueue',
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
  new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve();
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn('[OfflineDB] Delete database error:', request.error);
        resolve();
      };
      request.onblocked = () => {
        console.warn('[OfflineDB] Delete blocked — close other tabs, then refresh');
        resolve();
      };
    } catch (e) {
      console.warn('[OfflineDB] Delete database exception:', e);
      resolve();
    }
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
      console.warn('[OfflineDB] Opening failed, attempting recovery:', err?.message || err);
      try {
        await deleteDatabase();
        return await openDatabase();
      } catch (retryErr) {
        console.warn('[OfflineDB] IndexedDB recovery failed, resetting promise for future attempts:', retryErr?.message || retryErr);
        dbPromise = null;
        throw retryErr;
      }
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
  try {
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
  } catch (err) {
    console.warn(`[offlineDB] cacheEntities(${storeName}) skipped:`, err?.message || err);
  }
};

export const getCachedEntities = async (storeName, companyId = getActiveCompanyId()) => {
  try {
    const db = await getDB();
    const all = await db.getAll(storeName);
    if (!companyId) {
      return all.filter((r) => !r.offlineDeleted);
    }
    return all.filter(
      (r) => String(r.companyId) === String(companyId) && !r.offlineDeleted
    );
  } catch (err) {
    console.warn(`[offlineDB] getCachedEntities(${storeName}) failed:`, err?.message || err);
    return [];
  }
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
    // CRITICAL: Never wipe syncQueue on logout! Pending offline transactions
    // must be preserved until successfully synced to MongoDB cloud.
    const storesToClear = DATA_STORES.filter((s) => s !== 'syncQueue');
    const tx = db.transaction(storesToClear, 'readwrite');
    for (const store of storesToClear) {
      await tx.objectStore(store).clear();
    }
    await tx.done;
  } finally {
    resetDbPromise();
    localStorage.removeItem(COMPANY_KEY);
  }
};

const LS_AUTH_PREFIX = 'erp_offline_auth_';
const LS_ACCOUNTS_KEY = 'erp_offline_accounts';

const getStoredAccountList = () => {
  try {
    const raw = localStorage.getItem(LS_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredAccountList = (list) => {
  try {
    localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
};

export const putOfflineAuth = async (record) => {
  if (!record || !record.email) return record;
  const emailKey = record.email.trim().toLowerCase();

  // 1. Direct mirror to localStorage (Synchronous & immune to LevelDB/IndexedDB locking bugs)
  try {
    localStorage.setItem(`${LS_AUTH_PREFIX}${emailKey}`, JSON.stringify(record));
    const list = getStoredAccountList();
    if (!list.includes(emailKey)) {
      list.push(emailKey);
      saveStoredAccountList(list);
    }
  } catch (lsErr) {
    console.warn('[OfflineDB] localStorage auth mirror warning:', lsErr);
  }

  // 2. Also persist to IndexedDB if available
  try {
    const db = await getDB();
    await db.put(AUTH_STORE, record);
  } catch (idbErr) {
    console.warn('[OfflineDB] IndexedDB putOfflineAuth skipped (localStorage active):', idbErr?.message || idbErr);
  }

  return record;
};

export const getOfflineAuth = async (email) => {
  if (!email) return null;
  const emailKey = email.trim().toLowerCase();

  // 1. Try reading from IndexedDB first
  try {
    const db = await getDB();
    const record = await db.get(AUTH_STORE, emailKey);
    if (record) {
      // Sync to localStorage as backup
      try {
        localStorage.setItem(`${LS_AUTH_PREFIX}${emailKey}`, JSON.stringify(record));
      } catch {}
      return record;
    }
  } catch (idbErr) {
    console.warn('[OfflineDB] IndexedDB getOfflineAuth failed, falling back to localStorage:', idbErr?.message || idbErr);
  }

  // 2. Fallback to localStorage mirror
  try {
    const raw = localStorage.getItem(`${LS_AUTH_PREFIX}${emailKey}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (lsErr) {
    console.warn('[OfflineDB] localStorage getOfflineAuth parse error:', lsErr);
  }

  return null;
};

export const listOfflineAuths = async () => {
  const map = new Map();

  // 1. Read from localStorage accounts
  try {
    const accounts = getStoredAccountList();
    for (const email of accounts) {
      const raw = localStorage.getItem(`${LS_AUTH_PREFIX}${email}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.email) map.set(parsed.email.toLowerCase(), parsed);
      }
    }
  } catch (lsErr) {
    console.warn('[OfflineDB] localStorage listOfflineAuths error:', lsErr);
  }

  // 2. Read from IndexedDB if available and merge
  try {
    const db = await getDB();
    const idbRecords = await db.getAll(AUTH_STORE);
    for (const rec of idbRecords || []) {
      if (rec?.email && !map.has(rec.email.toLowerCase())) {
        map.set(rec.email.toLowerCase(), rec);
        try {
          localStorage.setItem(`${LS_AUTH_PREFIX}${rec.email.toLowerCase()}`, JSON.stringify(rec));
        } catch {}
      }
    }
  } catch (idbErr) {
    console.warn('[OfflineDB] IndexedDB listOfflineAuths skipped (using localStorage):', idbErr?.message || idbErr);
  }

  return Array.from(map.values());
};

export const removeOfflineAuth = async (email) => {
  if (!email) return;
  const emailKey = email.trim().toLowerCase();

  // 1. Remove from localStorage
  try {
    localStorage.removeItem(`${LS_AUTH_PREFIX}${emailKey}`);
    const nextList = getStoredAccountList().filter((e) => e !== emailKey);
    saveStoredAccountList(nextList);
  } catch (lsErr) {
    console.warn('[OfflineDB] localStorage removeOfflineAuth error:', lsErr);
  }

  // 2. Remove from IndexedDB
  try {
    const db = await getDB();
    await db.delete(AUTH_STORE, emailKey);
  } catch (idbErr) {
    console.warn('[OfflineDB] IndexedDB removeOfflineAuth skipped:', idbErr?.message || idbErr);
  }
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
