import { create } from 'zustand';
import {
  authApi,
  partiesApi,
  itemsApi,
  salesApi,
  purchasesApi,
  inventoryApi,
  jobsApi,
  accountingApi,
  ledgerApi,
  gstApi,
  reportsApi,
  booksApi,
  usersApi,
  visitsApi,
  ordersApi,
  returnsApi,
  notesApi,
  subMastersApi,
  dashboardApi,
} from '../api';
import {
  normalizeParty,
  normalizeItem,
  normalizeSale,
  normalizePurchase,
  normalizeUser,
  normalizeVoucher,
  normalizeInventoryLot
} from '../utils/normalizers';
import { cacheEntities, getCachedEntities, generateLocalId, clearOfflineDB, prepareCompanyCache, setActiveCompanyId, patchOfflineCache } from '../utils/offlineDB';
import { saveOffline, saveOfflineUpdate, saveOfflineDelete } from '../utils/syncQueue';
import {
  enrichSalePayload,
  enrichPurchasePayload,
  linkSalesWithParties,
  linkPurchasesWithParties,
  applySaleToInventory,
  applyPurchaseToInventory,
  isLocalBillId
} from '../utils/offlineBillHelpers';
import { getDefaultBooksForModule } from '../utils/defaultBooks';
import {
  isOffline,
  isNetworkError,
  persistOfflineFlag,
  canSaveOffline,
  handleNetworkFailure
} from '../utils/offlineHelpers';
import { updateOfflineSession } from '../utils/offlineAuth';

const mergePending = async (storeName, serverList, normalize) => {
  const pending = (await getCachedEntities(storeName)).filter((r) => r.offlinePending);
  const normalized = (Array.isArray(serverList) ? serverList : []).map(normalize);
  const serverIds = new Set(normalized.map((r) => r.id || r._id));
  const activePending = pending.filter((p) => !serverIds.has(p.id)).map(normalize);
  return [...activePending, ...normalized];
};

const useStore = create((set, get) => ({
  // --- AUTH STATE ---
  user: (() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? normalizeUser(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem('token') || null,
  role: (() => {
    const ls = localStorage.getItem('role');
    if (ls === 'super_admin' || ls === 'user') return ls;
    try {
      const saved = JSON.parse(localStorage.getItem('user') || 'null');
      if (saved?.role === 'super_admin' || saved?.role === 'user') return saved.role;
    } catch {
      /* ignore */
    }
    // Token without role still gets ERP access after hydrate
    return localStorage.getItem('token') ? 'user' : null;
  })(),
  plan: null,
  theme: 'light',

  // --- ERP STATE (Fetched from API) ---
  parties: [],
  items: [],
  purchases: [],
  sales: [],
  inventoryLots: [],
  jobWorkEntries: [],
  ledgerEntries: [],
  payments: [],
  receipts: [],
  currentLedgerStatement: null,
  trialBalance: [],
  profitLoss: null,
  outstandingReport: [],
  ledgers: [],
  books: [],
  subMasters: [],
  orders: [],
  returns: [],
  notes: [],
  visits: [],
  vouchers: [],
  companyUsers: [],
  sessionReady: false,
  dashboardSummary: null,
  dashboardLoading: false,
  // FIXED: Per-entity loading states instead of one shared boolean
  loading: false,
  partiesLoading: false,
  itemsLoading: false,
  salesLoading: false,
  purchasesLoading: false,
  inventoryLoading: false,
  error: null,

  // --- AUTH ACTIONS ---
  setAuth: async (data) => {
    const user = normalizeUser(data.user);
    const platformRole = user.role === 'super_admin' ? 'super_admin' : 'user';
    await prepareCompanyCache(user.companyId);
    // Explicitly set companyId BEFORE any cache hydration
    if (user.companyId) setActiveCompanyId(user.companyId);
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', platformRole);
    localStorage.setItem('user', JSON.stringify({ ...user, role: platformRole }));
    const plan = user.plan;
    persistOfflineFlag(user, plan);
    try {
      const { default: useConfigStore } = await import('./useConfigStore');
      useConfigStore.getState().hydrateFromAuth(user, plan);
    } catch { /* config store optional during early boot */ }
    set({ 
      token: data.token, 
      user: { ...user, role: platformRole }, 
      role: platformRole, 
      plan,
      sessionReady: true
    });
    queueMicrotask(() => {
      if (isOffline()) {
        get().hydrateFromCache().catch(() => {});
      } else {
        get().refreshAllData().catch((err) => {
          // If online fetch fails, fallback to cached data
          console.warn('[setAuth] refreshAllData failed, falling back to cache:', err?.message);
          get().hydrateFromCache().catch(() => {});
        });
      }
    });
  },

  /** Sync live config bundle into user snapshot (admin changes → user panel) */
  syncActiveConfig: (bundle) => {
    if (!bundle) return;
    const current = get().user;
    if (!current) return;
    // Skip no-op updates — ConfigProvider used to loop forever rewriting the same hash
    if (
      bundle.configHash &&
      current.configHash &&
      bundle.configHash === current.configHash
    ) {
      return;
    }
    const updated = normalizeUser({
      ...current,
      moduleConfig: {
        modules: bundle.modules || {},
        subMenus: bundle.subMenus || {},
        fields: bundle.fields || {}
      },
      configVersion: bundle.bundleVersion,
      configHash: bundle.configHash,
      activeConfig: {
        featureFlags: bundle.featureFlags,
        bills: bundle.bills,
        columns: bundle.columns,
        permissions: bundle.permissions,
        companySettings: bundle.companySettings
      }
    });
    localStorage.setItem('user', JSON.stringify(updated));
    set({ user: updated });
  },

  restoreSession: async () => {
    const token = get().token || localStorage.getItem('token');
    if (!token) {
      set({ sessionReady: true });
      return;
    }

    let savedUser = null;
    try {
      savedUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      savedUser = null;
    }

    const applyLocalSession = () => {
      if (!savedUser) {
        // Stale token without user → still mark ready; platform role defaults to user for ERP
        localStorage.setItem('role', 'user');
        set({ token, role: 'user', sessionReady: true });
        return false;
      }
      const user = normalizeUser(savedUser);
      const platformRole = user.role === 'super_admin' ? 'super_admin' : 'user';
      persistOfflineFlag(user, user.plan);
      if (user.companyId) setActiveCompanyId(user.companyId);
      localStorage.setItem('role', platformRole);
      localStorage.setItem('user', JSON.stringify({ ...user, role: platformRole }));
      set({
        token,
        user: { ...user, role: platformRole },
        role: platformRole,
        plan: user.plan || null,
        sessionReady: true
      });
      return true;
    };

    // Always restore local session first — required for offline refresh after login
    const hasLocal = applyLocalSession();

    // CRITICAL: Ensure companyId is in localStorage BEFORE hydrating from cache
    // Race condition fix: if savedUser has companyId but setActiveCompanyId was missed
    if (hasLocal && savedUser?.companyId) {
      setActiveCompanyId(savedUser.companyId);
    }

    if (isOffline()) {
      if (hasLocal) await get().hydrateFromCache();
      return;
    }

    if (!hasLocal) {
      return;
    }

    // Online: refresh profile in background; never clear session on failure
    try {
      const me = await authApi.me();
      const res = { data: { data: me, user: me, success: true } };
      const user = normalizeUser(res.data.user);
      localStorage.setItem('role', user.role);
      localStorage.setItem('user', JSON.stringify(user));
      const plan = user.plan || savedUser?.plan || null;
      persistOfflineFlag(user, plan);
      if (user.companyId) setActiveCompanyId(user.companyId);
      set({ user, role: user.role, plan });
      await updateOfflineSession(user.email, { token, user });
    } catch (err) {
      handleNetworkFailure(err);
      if (isNetworkError(err) && hasLocal) {
        // Server unreachable — fallback to IndexedDB cache
        await get().hydrateFromCache();
      }
      console.warn('[Session] Using cached login — server refresh failed:', err.message);
    }
  },

  logout: async () => {
    await clearOfflineDB();
    persistOfflineFlag(null, null);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    try {
      const { default: useConfigStore } = await import('./useConfigStore');
      useConfigStore.getState().reset();
    } catch { /* ignore */ }
    // FIXED: Clear ALL entity state on logout to prevent data leakage
    set({
      token: null,
      user: null,
      role: null,
      plan: null,
      parties: [],
      items: [],
      purchases: [],
      sales: [],
      inventoryLots: [],
      jobWorkEntries: [],
      ledgers: [],
      payments: [],
      receipts: [],
      orders: [],
      returns: [],
      notes: [],
      visits: [],
      vouchers: [],
      companyUsers: [],
      sessionReady: true
    });
  },

  bootstrapMasters: async () => {
    if (isOffline()) {
      await get().hydrateFromCache();
      return;
    }
    try {
      await get().refreshAllData();
    } catch (err) {
      console.warn('[bootstrapMasters] refreshAllData failed, loading from cache:', err?.message);
      await get().hydrateFromCache();
    }
  },

  hydrateFromCache: async () => {
    try {
      const [
        parties, items, sales, purchases, books, inventory, payments, receipts,
        jobs, orders, returns, notes, visits, ledgers, subMasters
      ] = await Promise.all([
        getCachedEntities('parties'),
        getCachedEntities('items'),
        getCachedEntities('sales'),
        getCachedEntities('purchases'),
        getCachedEntities('books'),
        getCachedEntities('inventory'),
        getCachedEntities('payments'),
        getCachedEntities('receipts'),
        getCachedEntities('jobs'),
        getCachedEntities('orders'),
        getCachedEntities('returns'),
        getCachedEntities('notes'),
        getCachedEntities('visits'),
        getCachedEntities('ledgers'),
        getCachedEntities('subMasters')
      ]);
      const partyList = parties.map(normalizeParty);
      const itemList = items.map(normalizeItem);
      const voucherList = [
        ...payments.map(normalizeVoucher),
        ...receipts.map(normalizeVoucher)
      ];
      set({
        parties: partyList,
        items: itemList,
        sales: linkSalesWithParties(sales.map(normalizeSale), partyList),
        purchases: linkPurchasesWithParties(purchases.map(normalizePurchase), partyList),
        books: books.filter((b) => !b.offlinePending),
        inventoryLots: inventory.map(normalizeInventoryLot),
        payments: payments.map(normalizeVoucher),
        receipts: receipts.map(normalizeVoucher),
        vouchers: voucherList,
        jobWorkEntries: jobs,
        orders,
        returns,
        notes,
        visits,
        ledgers,
        subMasters
      });
    } catch (err) {
      console.warn('[Offline] hydrateFromCache failed:', err.message);
    }
  },

  refreshAllData: async () => {
    const {
      fetchParties, fetchItems, fetchSales, fetchPurchases, fetchInventory,
      fetchJobs, fetchOrders, fetchReturns, fetchNotes, fetchVisits, fetchVouchers, fetchBooks,
      fetchLedgers
    } = get();
    const results = await Promise.allSettled([
      fetchParties(),
      fetchItems(),
      fetchSales(),
      fetchPurchases(),
      fetchInventory(),
      fetchJobs(),
      fetchOrders(),
      fetchReturns(),
      fetchNotes(),
      fetchVisits(),
      fetchVouchers(),
      fetchBooks(),
      fetchLedgers()
    ]);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[Refresh] ${failed.length} data fetches failed:`, failed.map(f => f.reason?.message));
    }
  },

  // --- MASTER ACTIONS ---
  fetchParties: async () => {
    set({ partiesLoading: true });
    if (isOffline()) {
      const cached = (await getCachedEntities('parties')).map(normalizeParty);
      set({ parties: cached, partiesLoading: false });
      return;
    }
    try {
      const _parties = await partiesApi.listRaw();
      const res = { data: { data: _parties } };
      const raw = res.data.data || res.data || [];
      const parties = (Array.isArray(raw) ? raw : []).map(normalizeParty);
      await cacheEntities('parties', parties);
      set({ parties, partiesLoading: false });
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = (await getCachedEntities('parties')).map(normalizeParty);
        set({ parties: cached, partiesLoading: false });
      } else {
        set({ error: err.message, partiesLoading: false });
      }
    }
  },

  addParty: async (partyData) => {
    const saveLocal = async () => {
      const localId = generateLocalId();
      const localParty = normalizeParty({ ...partyData, _id: localId, id: localId, offlinePending: true });
      await saveOffline('parties', { ...partyData, _id: localId, id: localId });
      set((state) => ({ parties: [...state.parties, localParty] }));
      return localParty;
    };

    if (isOffline() && canSaveOffline(get)) {
      return saveLocal();
    }
    if (isOffline()) {
      throw new Error('Please log in while online first, then you can work offline.');
    }
    try {
      const _party = await partiesApi.create(partyData);
      const res = { data: { data: _party } };
      const newParty = normalizeParty(res.data.data || res.data);
      set((state) => ({ parties: [...state.parties, newParty] }));
      return newParty;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return saveLocal();
      throw err;
    }
  },

  updateParty: async (id, partyData) => {
    const applyLocal = async () => {
      const updated = normalizeParty({ ...partyData, _id: id, id, offlinePending: true });
      await saveOfflineUpdate('parties', id, { ...partyData, _id: id, id });
      set((state) => ({
        parties: state.parties.map((p) => (String(p._id) === String(id) ? updated : p))
      }));
      return updated;
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      const _party = await partiesApi.update(id, partyData);
      const res = { data: { data: _party } };
      const updatedParty = normalizeParty(res.data.data || res.data);
      set((state) => ({
        parties: state.parties.map((p) => (String(p._id) === String(id) ? updatedParty : p))
      }));
      return updatedParty;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  deleteParty: async (id) => {
    const applyLocal = async () => {
      await saveOfflineDelete('parties', id);
      set((state) => ({
        parties: state.parties.filter((p) => p._id !== id && p.id !== id)
      }));
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      await partiesApi.remove(id);
      set((state) => ({
        parties: state.parties.filter((p) => p._id !== id)
      }));
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  searchParties: async (query) => {
    if (isOffline()) {
      const q = (query || '').toLowerCase();
      const list = get().parties.length
        ? get().parties
        : (await getCachedEntities('parties')).map(normalizeParty);
      return list.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.code || '').toLowerCase().includes(q)
      );
    }
    try {
      const _sp = await partiesApi.search(query);
      const res = { data: { data: _sp } };
      const results = res.data.data || res.data || [];
      return (Array.isArray(results) ? results : []).map(normalizeParty);
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  },

  fetchItems: async () => {
    set({ loading: true });
    if (isOffline()) {
      const cached = (await getCachedEntities('items')).map(normalizeItem);
      set({ items: cached, loading: false });
      return;
    }
    try {
      const _items = await itemsApi.listRaw();
      const res = { data: { data: _items } };
      const raw = res.data.data || res.data || [];
      const items = (Array.isArray(raw) ? raw : []).map(normalizeItem);
      await cacheEntities('items', items);
      set({ items, loading: false });
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = (await getCachedEntities('items')).map(normalizeItem);
        set({ items: cached, loading: false });
      } else {
        set({ error: err.message, loading: false });
      }
    }
  },

  addItem: async (itemData) => {
    const saveLocal = async () => {
      const localId = generateLocalId();
      const localItem = normalizeItem({ ...itemData, _id: localId, id: localId, offlinePending: true });
      await saveOffline('items', { ...itemData, _id: localId, id: localId });
      set((state) => ({ items: [...state.items, localItem] }));
      return localItem;
    };

    if (isOffline() && canSaveOffline(get)) {
      return saveLocal();
    }
    if (isOffline()) {
      throw new Error('Please log in while online first, then you can work offline.');
    }
    try {
      const _item = await itemsApi.create(itemData);
      const res = { data: { data: _item } };
      const newItem = normalizeItem(res.data.data || res.data);
      set((state) => ({ items: [...state.items, newItem] }));
      return newItem;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return saveLocal();
      throw err;
    }
  },

  updateItem: async (id, itemData) => {
    const applyLocal = async () => {
      const updated = normalizeItem({ ...itemData, _id: id, id, offlinePending: true });
      await saveOfflineUpdate('items', id, { ...itemData, _id: id, id });
      set((state) => ({
        items: state.items.map((i) => (String(i._id) === String(id) ? updated : i))
      }));
      return updated;
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      const _item = await itemsApi.update(id, itemData);
      const res = { data: { data: _item } };
      const updatedItem = normalizeItem(res.data.data || res.data);
      set((state) => ({
        items: state.items.map((i) => (i._id === id ? updatedItem : i))
      }));
      return updatedItem;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  deleteItem: async (id) => {
    const applyLocal = async () => {
      await saveOfflineDelete('items', id);
      set((state) => ({
        items: state.items.filter((i) => i._id !== id && i.id !== id)
      }));
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      await itemsApi.remove(id);
      set((state) => ({
        items: state.items.filter((i) => i._id !== id)
      }));
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  searchItems: async (query) => {
    if (isOffline()) {
      const q = (query || '').toLowerCase();
      const list = get().items.length
        ? get().items
        : (await getCachedEntities('items')).map(normalizeItem);
      return list.filter(
        (i) =>
          (i.name || '').toLowerCase().includes(q) ||
          (i.code || '').toLowerCase().includes(q)
      );
    }
    try {
      const _si = await itemsApi.search(query);
      const res = { data: { data: _si } };
      const results = res.data.data || res.data || [];
      return (Array.isArray(results) ? results : []).map(normalizeItem);
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  },

  // --- PURCHASE ACTIONS ---
  fetchPurchases: async (params = {}) => {
    set({ purchasesLoading: true });
    const linkPurchases = async (list) => {
      const partyList = get().parties.length
        ? get().parties
        : (await getCachedEntities('parties')).map(normalizeParty);
      return linkPurchasesWithParties(list, partyList);
    };
    if (isOffline()) {
      const cached = await linkPurchases((await getCachedEntities('purchases')).map(normalizePurchase));
      set({ purchases: cached, purchasesLoading: false });
      return;
    }
    try {
      const queryParams = new URLSearchParams(params).toString();
      const _purchases = await purchasesApi.listRaw(Object.fromEntries(new URLSearchParams(queryParams || '')));
      const res = { data: { data: _purchases } };
      const raw = res.data.data?.purchases || res.data.data || res.data || [];
      const purchases = await linkPurchases(await mergePending('purchases', raw, normalizePurchase));
      await cacheEntities('purchases', purchases.filter((p) => !p.offlinePending));
      set({ purchases, purchasesLoading: false });
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await linkPurchases((await getCachedEntities('purchases')).map(normalizePurchase));
        set({ purchases: cached, purchasesLoading: false });
      } else {
        set({ error: err.message, purchasesLoading: false });
      }
    }
  },

  addPurchase: async (purchaseData) => {
    const enriched = enrichPurchasePayload(purchaseData, get());
    const applyInventory = (state) => {
      const lots = applyPurchaseToInventory(state.inventoryLots, enriched.items, state.items);
      cacheEntities('inventory', lots).catch(() => {});
      return lots;
    };
    const saveLocal = async () => {
      const localId = generateLocalId();
      const invoiceNo = enriched.invoiceNo === 'AUTO' ? `OFF-PUR-${Date.now()}` : enriched.invoiceNo;
      const localPurchase = normalizePurchase({
        ...enriched,
        _id: localId,
        id: localId,
        invoiceNo,
        offlinePending: true,
        date: enriched.date || new Date().toISOString().split('T')[0]
      });
      await saveOffline('purchases', { ...enriched, invoiceNo, _id: localId, id: localId });
      set((state) => ({
        purchases: [localPurchase, ...state.purchases],
        inventoryLots: applyInventory(state)
      }));
      return localPurchase;
    };

    if (isOffline() && canSaveOffline(get)) {
      return saveLocal();
    }
    if (isOffline()) {
      throw new Error('Please log in while online first, then you can work offline.');
    }
    try {
      const _purchase = await purchasesApi.create(enriched);
      const res = { data: { data: _purchase } };
      const newPurchase = normalizePurchase(res.data.data || res.data);
      set((state) => ({ purchases: [newPurchase, ...state.purchases] }));
      get().fetchInventory();
      return newPurchase;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return saveLocal();
      throw err;
    }
  },

  deletePurchase: async (id) => {
    const applyLocal = async () => {
      await saveOfflineDelete('purchases', id);
      set((state) => ({
        purchases: state.purchases.filter((p) => p._id !== id && p.id !== id)
      }));
      return { status: 'cancelled' };
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      const _delP = await purchasesApi.remove(id);
      const res = { data: { data: _delP } };
      const result = res.data.data;
      if (result?.status === 'cancelled' || result?._id) {
        set(state => ({
          purchases: state.purchases.map(p => (p._id === id || p.id === id ? normalizePurchase(result) : p))
        }));
      } else {
        set(state => ({ purchases: state.purchases.filter(p => p._id !== id && p.id !== id) }));
      }
      return result;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  updatePurchase: async (id, purchaseData) => {
    const enriched = enrichPurchasePayload(purchaseData, get());
    const applyLocal = async () => {
      const updated = normalizePurchase({
        ...enriched,
        _id: id,
        id,
        offlinePending: true
      });
      if (isLocalBillId(id)) {
        await saveOfflineUpdate('purchases', id, { ...enriched, _id: id, id });
      } else {
        await patchOfflineCache('purchases', id, { ...enriched, offlineLocalEdit: true });
      }
      set((state) => ({
        purchases: state.purchases.map((p) => (p._id === id || p.id === id ? updated : p))
      }));
      return updated;
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      const _upP = await purchasesApi.update(id, enriched);
      const res = { data: { data: _upP } };
      const updated = normalizePurchase(res.data.data || res.data);
      set((state) => ({
        purchases: state.purchases.map((p) => (p._id === id || p.id === id ? updated : p))
      }));
      get().fetchInventory();
      return updated;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  updatePurchaseStatus: async (id, status) => {
    const applyLocal = async () => {
      const existing = get().purchases.find((p) => p._id === id || p.id === id);
      const updated = normalizePurchase({ ...existing, status, offlinePending: true });
      await saveOfflineUpdate('purchases', id, { status });
      set(state => ({
        purchases: state.purchases.map(p => (p._id === id || p.id === id ? updated : p))
      }));
      return updated;
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      const _stP = await purchasesApi.updateStatus(id, status);
      const res = { data: { data: _stP } };
      const updated = normalizePurchase(res.data.data);
      set(state => ({
        purchases: state.purchases.map(p => (p._id === id || p.id === id ? updated : p))
      }));
      return updated;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  createOpeningStock: async (data) => {
    const _op = await inventoryApi.openingStock(data);
    const res = { data: { data: _op } };
    get().fetchInventory();
    return res.data.data;
  },

  // --- SALES ACTIONS ---
  fetchSales: async () => {
    set({ loading: true });
    const linkSales = async (list) => {
      const partyList = get().parties.length
        ? get().parties
        : (await getCachedEntities('parties')).map(normalizeParty);
      return linkSalesWithParties(list, partyList);
    };
    if (isOffline()) {
      const cached = await linkSales((await getCachedEntities('sales')).map(normalizeSale));
      set({ sales: cached, loading: false });
      return;
    }
    try {
      const _sales = await salesApi.listRaw();
      const res = { data: { data: _sales } };
      const raw = res.data.data?.sales || res.data.data || res.data || [];
      const sales = await linkSales(await mergePending('sales', raw, normalizeSale));
      await cacheEntities('sales', sales.filter((s) => !s.offlinePending));
      set({ sales, loading: false });
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await linkSales((await getCachedEntities('sales')).map(normalizeSale));
        set({ sales: cached, loading: false });
      } else {
        set({ error: err.message, loading: false });
      }
    }
  },

  addSale: async (saleData) => {
    const enriched = enrichSalePayload(saleData, get());
    const applyInventory = (state) => {
      const lots = applySaleToInventory(state.inventoryLots, enriched.items);
      cacheEntities('inventory', lots).catch(() => {});
      return lots;
    };
    const saveLocal = async () => {
      const localId = generateLocalId();
      const invoiceNo = enriched.invoiceNo === 'AUTO' ? `OFF-INV-${Date.now()}` : enriched.invoiceNo;
      const localSale = normalizeSale({
        ...enriched,
        _id: localId,
        id: localId,
        invoiceNo,
        offlinePending: true,
        date: enriched.date || new Date().toISOString().split('T')[0]
      });
      await saveOffline('sales', { ...enriched, invoiceNo, _id: localId, id: localId });
      set((state) => ({
        sales: [localSale, ...state.sales],
        inventoryLots: applyInventory(state)
      }));
      return localSale;
    };

    if (isOffline() && canSaveOffline(get)) {
      return saveLocal();
    }
    if (isOffline()) {
      throw new Error('Please log in while online first, then you can work offline.');
    }
    try {
      const _sale = await salesApi.create(enriched);
      const res = { data: { data: _sale } };
      const newSale = normalizeSale(res.data.data || res.data);
      set((state) => ({ sales: [newSale, ...state.sales] }));
      get().fetchInventory();
      return newSale;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return saveLocal();
      throw err;
    }
  },

  deleteSale: async (id) => {
    const applyLocal = async () => {
      await saveOfflineDelete('sales', id);
      set((state) => ({
        sales: state.sales.filter((s) => s._id !== id && s.id !== id)
      }));
      return { status: 'cancelled' };
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      const _delS = await salesApi.remove(id);
      const res = { data: { data: _delS } };
      const result = res.data.data;
      if (result?.status === 'cancelled' || result?._id) {
        set(state => ({
          sales: state.sales.map(s => (s._id === id || s.id === id ? normalizeSale(result) : s))
        }));
      } else {
        set(state => ({ sales: state.sales.filter(s => s._id !== id && s.id !== id) }));
      }
      return result;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  updateSale: async (id, saleData) => {
    const enriched = enrichSalePayload(saleData, get());
    const applyLocal = async () => {
      const updated = normalizeSale({
        ...enriched,
        _id: id,
        id,
        offlinePending: true
      });
      if (isLocalBillId(id)) {
        await saveOfflineUpdate('sales', id, { ...enriched, _id: id, id });
      } else {
        await patchOfflineCache('sales', id, { ...enriched, offlineLocalEdit: true });
      }
      set((state) => ({
        sales: state.sales.map((s) => (s._id === id || s.id === id ? updated : s))
      }));
      return updated;
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      const _upS = await salesApi.update(id, enriched);
      const res = { data: { data: _upS } };
      const updated = normalizeSale(res.data.data || res.data);
      set((state) => ({
        sales: state.sales.map((s) => (s._id === id || s.id === id ? updated : s))
      }));
      get().fetchInventory();
      return updated;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  updateSaleStatus: async (id, status) => {
    const applyLocal = async () => {
      const existing = get().sales.find((s) => s._id === id || s.id === id);
      const updated = normalizeSale({ ...existing, status, offlinePending: true });
      await saveOfflineUpdate('sales', id, { status });
      set(state => ({
        sales: state.sales.map(s => (s._id === id || s.id === id ? updated : s))
      }));
      return updated;
    };
    if (isOffline() && canSaveOffline(get)) return applyLocal();
    try {
      const _stS = await salesApi.updateStatus(id, status);
      const res = { data: { data: _stS } };
      const updated = normalizeSale(res.data.data);
      set(state => ({
        sales: state.sales.map(s => (s._id === id || s.id === id ? updated : s))
      }));
      return updated;
    } catch (err) {
      if (isNetworkError(err) && canSaveOffline(get)) return applyLocal();
      throw err;
    }
  },

  fetchGstr1: async (startDate, endDate) => {
    const _g1 = await gstApi.gstr1({ startDate: startDate || '', endDate: endDate || '' });
    const res = { data: { data: _g1 } };
    return res.data.data;
  },

  fetchGstr2: async (startDate, endDate) => {
    const _g2 = await gstApi.gstr2({ startDate: startDate || '', endDate: endDate || '' });
    const res = { data: { data: _g2 } };
    return res.data.data;
  },

  fetchCADashboard: async (startDate, endDate) => {
    const _ca = await gstApi.caDashboard({ startDate: startDate || '', endDate: endDate || '' });
    const res = { data: { data: _ca } };
    return res.data.data;
  },

  caDashboard: null,
  caDashboardLoading: false,

  // --- INVENTORY ---
  fetchInventory: async () => {
    set({ loading: true });
    if (isOffline()) {
      const cached = (await getCachedEntities('inventory')).map(normalizeInventoryLot);
      set({ inventoryLots: cached, loading: false });
      return cached;
    }
    try {
      const _inv = await inventoryApi.list();
      const res = { data: { data: _inv } };
      const lots = (res.data.data || res.data || []).map(normalizeInventoryLot);
      await cacheEntities('inventory', lots);
      set({ inventoryLots: lots, loading: false });
      return lots;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = (await getCachedEntities('inventory')).map(normalizeInventoryLot);
        set({ inventoryLots: cached, loading: false });
        return cached;
      }
      set({ error: err.message, loading: false });
      return [];
    }
  },

  // --- JOB WORK ---
  fetchJobs: async () => {
    set({ loading: true });
    if (isOffline()) {
      const cached = await getCachedEntities('jobs');
      set({ jobWorkEntries: cached, loading: false });
      return cached;
    }
    try {
      const _jobs = await jobsApi.list();
      const res = { data: { data: _jobs } };
      const data = res.data.data || res.data || [];
      const list = Array.isArray(data) ? data : [];
      await cacheEntities('jobs', list);
      set({ jobWorkEntries: list, loading: false });
      return list;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getCachedEntities('jobs');
        set({ jobWorkEntries: cached, loading: false });
        return cached;
      }
      set({ error: err.message, loading: false });
      return [];
    }
  },

  issueToMill: async (issueData) => {
    try {
      const _ji = await jobsApi.issue(issueData);
      const res = { data: { data: _ji } };
      set((state) => ({ jobWorkEntries: [res.data.data || res.data, ...state.jobWorkEntries] }));
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  receiveFromMill: async (receiveData) => {
    try {
      const _jr = await jobsApi.receive(receiveData);
      const res = { data: { data: _jr } };
      await get().fetchJobs();
      await get().fetchInventory();
      return res.data.data;
    } catch (err) {
      throw err;
    }
  },

  updateJobProcess: async (jobId, status) => {
    try {
      const _jp = await jobsApi.process({ jobId, status });
      const res = { data: { data: _jp } };
      const updated = res.data.data;
      set((state) => ({
        jobWorkEntries: state.jobWorkEntries.map((j) =>
          j._id === jobId ? { ...j, ...updated } : j
        )
      }));
      return updated;
    } catch (err) {
      throw err;
    }
  },

  // --- ACCOUNTING ---
  fetchLedger: async (partyId) => {
    set({ loading: true });
    try {
      const _pl = await ledgerApi.partyLedger(partyId);
      const res = { data: { data: _pl } };
      set({ ledgerEntries: res.data.data || res.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchLedgers: async (group = '', search = '') => {
    if (isOffline()) {
      const cached = await getCachedEntities('ledgers');
      set({ ledgers: cached });
      return cached;
    }
    try {
      const companyId = get().user?.companyId;
      const _ledgers = await accountingApi.listLedgers({ group, search });
      const res = { data: { data: _ledgers } };
      const data = res.data.data || [];
      await cacheEntities('ledgers', data);
      set({ ledgers: data });
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getCachedEntities('ledgers');
        set({ ledgers: cached });
        return cached;
      }
      console.error('Fetch ledgers failed:', err);
      return [];
    }
  },

  addLedger: async (ledgerData) => {
    try {
      const _cl = await accountingApi.createLedger({
        ...ledgerData,
        companyId: get().user?.companyId
      });
      const res = { data: { data: _cl } };
      const newLedger = res.data.data;
      set(state => ({ ledgers: [...state.ledgers, newLedger] }));
      return newLedger;
    } catch (err) {
      throw err;
    }
  },

  addPayment: async (data) => {
    const saveLocal = async () => {
      const localId = generateLocalId();
      const voucherNo = `OFF-PV-${Date.now()}`;
      const localVoucher = normalizeVoucher({
        ...data,
        _id: localId,
        id: localId,
        type: 'Payment',
        voucherNo,
        offlinePending: true,
        date: data.date || new Date().toISOString().split('T')[0]
      });
      await saveOffline('payments', { ...data, _id: localId, id: localId, type: 'Payment' });
      set((state) => ({
        payments: [localVoucher, ...state.payments],
        vouchers: [localVoucher, ...state.vouchers],
        loading: false
      }));
      return localVoucher;
    };

    set({ loading: true });
    if (isOffline() && canSaveOffline(get)) return saveLocal();
    try {
      const _pay = await accountingApi.payments({
        ...data,
        companyId: get().user?.companyId
      });
      const res = { data: { data: _pay } };
      const newVoucher = normalizeVoucher(res.data.data);
      set(state => ({ 
        payments: [newVoucher, ...state.payments],
        vouchers: [newVoucher, ...state.vouchers],
        loading: false 
      }));
      get().fetchVouchers();
      get().fetchSales();
      get().fetchPurchases();
      return newVoucher;
    } catch (err) {
      set({ loading: false });
      if (isNetworkError(err) && canSaveOffline(get)) return saveLocal();
      throw err;
    }
  },

  addReceipt: async (data) => {
    const saveLocal = async () => {
      const localId = generateLocalId();
      const voucherNo = `OFF-RV-${Date.now()}`;
      const localVoucher = normalizeVoucher({
        ...data,
        _id: localId,
        id: localId,
        type: 'Receipt',
        voucherNo,
        offlinePending: true,
        date: data.date || new Date().toISOString().split('T')[0]
      });
      await saveOffline('receipts', { ...data, _id: localId, id: localId, type: 'Receipt' });
      set((state) => ({
        receipts: [localVoucher, ...state.receipts],
        vouchers: [localVoucher, ...state.vouchers],
        loading: false
      }));
      return localVoucher;
    };

    set({ loading: true });
    if (isOffline() && canSaveOffline(get)) return saveLocal();
    try {
      const _rcp = await accountingApi.receipts({
        ...data,
        companyId: get().user?.companyId
      });
      const res = { data: { data: _rcp } };
      const newVoucher = normalizeVoucher(res.data.data);
      set(state => ({ 
        receipts: [newVoucher, ...state.receipts],
        vouchers: [newVoucher, ...state.vouchers],
        loading: false 
      }));
      get().fetchVouchers();
      get().fetchSales();
      get().fetchPurchases();
      return newVoucher;
    } catch (err) {
      set({ loading: false });
      if (isNetworkError(err) && canSaveOffline(get)) return saveLocal();
      throw err;
    }
  },

  fetchLedgerStatement: async ({ ledgerId, from, to }) => {
    set({ loading: true });
    try {
      const _stmt = await accountingApi.statement(ledgerId, { from: from || '', to: to || '' });
      const res = { data: { data: _stmt } };
      set({ currentLedgerStatement: res.data.data, loading: false });
      return res.data.data;
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchTrialBalance: async (asOn) => {
    set({ loading: true });
    try {
      const companyId = get().user?.companyId;
      const _tb = await accountingApi.trialBalance({ asOn: asOn || '' });
      const res = { data: { data: _tb } };
      const data = res.data.data || [];
      set({ trialBalance: data, loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return [];
    }
  },

  fetchProfitLoss: async (from, to) => {
    set({ loading: true });
    try {
      const companyId = get().user?.companyId;
      const _pl = await accountingApi.profitLoss({ from: from || '', to: to || '' });
      const res = { data: { data: _pl } };
      set({ profitLoss: res.data.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchOutstanding: async (type, asOn) => {
    set({ loading: true });
    try {
      const companyId = get().user?.companyId;
      const _os = await accountingApi.outstanding({ type, asOn: asOn || '' });
      const res = { data: { data: _os } };
      set({ outstandingReport: res.data.data || [], loading: false });
      return res.data.data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return [];
    }
  },

  fetchReportsBundle: async (startDate, endDate) => {
    try {
      const _rb = await reportsApi.bundle({ startDate: startDate || '', endDate: endDate || '' });
      const res = { data: { data: _rb } };
      return res.data.data;
    } catch (err) {
      console.error('Reports bundle failed:', err);
      throw err;
    }
  },

  fetchStockReport: async () => {
    const _st = await reportsApi.stock();
    const res = { data: { data: _st } };
    return res.data.data;
  },

  fetchBooks: async () => {
    set({ loading: true });
    const loadCached = async () => {
      const cached = await getCachedEntities('books');
      if (cached.length > 0) return cached;
      const modules = ['sales', 'purchase', 'receipt', 'payment', 'millIssue', 'millRec', 'jobIssue', 'jobRec', 'ledger'];
      return modules.flatMap((m) => getDefaultBooksForModule(m));
    };

    if (isOffline()) {
      const books = await loadCached();
      set({ books, loading: false });
      return books;
    }
    try {
      const companyId = get().user?.companyId;
      const _books = await booksApi.list();
      const res = { data: { data: _books } };
      const raw = res.data.data || [];
      const books = Array.isArray(raw) ? raw : [];
      await cacheEntities('books', books.map((b) => ({ ...b, id: b._id || b.id })));
      set({ books, loading: false });
      return books;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await loadCached();
        set({ books: cached, loading: false });
        return cached;
      }
      console.error('Fetch books failed:', err);
      set({ error: err.message, loading: false });
      return [];
    }
  },

  fetchBooksByModule: async (moduleName) => {
    const loadCached = async () => {
      const cached = await getCachedEntities('books');
      const filtered = cached.filter((b) => b.module === moduleName);
      if (filtered.length > 0) return filtered;
      return getDefaultBooksForModule(moduleName);
    };

    if (isOffline()) {
      return loadCached();
    }

    try {
      const _bm = await booksApi.byModule(moduleName);
      const res = { data: { data: _bm } };
      const data = res.data.data || [];
      if (data.length > 0) {
        await cacheEntities('books', data.map((b) => ({ ...b, id: b._id || b.id })));
        return data;
      }
      return loadCached();
    } catch (err) {
      if (isNetworkError(err)) {
        return loadCached();
      }
      console.error('Fetch books failed:', err);
      return getDefaultBooksForModule(moduleName);
    }
  },

  createBook: async (bookData) => {
    try {
      const _nb = await booksApi.create({
        ...bookData,
        companyId: get().user?.companyId
      });
      const res = { data: { data: _nb } };
      return res.data.data;
    } catch (err) {
      console.error('Create book failed:', err);
      throw err;
    }
  },

  deleteBook: async (id) => {
    try {
      await booksApi.remove(id);
    } catch (err) {
      console.error('Delete book failed:', err);
      throw err;
    }
  },

  // --- SUBMASTERS ---
  fetchSubMasters: async (type = '') => {
    if (isOffline()) {
      const cached = await getCachedEntities('subMasters');
      const filtered = type ? cached.filter((sm) => sm.type === type) : cached;
      set({ subMasters: filtered });
      return filtered;
    }
    try {
      const _sm = await subMastersApi.list({ type });
      const res = { data: { data: _sm } };
      const data = res.data.data || [];
      if (!type) await cacheEntities('subMasters', data);
      set({ subMasters: data });
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getCachedEntities('subMasters');
        set({ subMasters: type ? cached.filter((sm) => sm.type === type) : cached });
        return cached;
      }
      console.error('Fetch sub-masters failed:', err);
      return [];
    }
  },

  addSubMaster: async (data) => {
    try {
      const _smc = await subMastersApi.create(data);
      const res = { data: { data: _smc } };
      const newRecord = res.data.data;
      set(state => ({ subMasters: [...state.subMasters, newRecord] }));
      return newRecord;
    } catch (err) {
      console.error('Add sub-master failed:', err);
      throw err;
    }
  },

  deleteSubMaster: async (id) => {
    try {
      await subMastersApi.remove(id);
      set(state => ({ subMasters: state.subMasters.filter(sm => sm._id !== id) }));
    } catch (err) {
      console.error('Delete sub-master failed:', err);
      throw err;
    }
  },

  updateSubMaster: async (id, data) => {
    try {
      const _smu = await subMastersApi.update(id, data);
      const res = { data: { data: _smu } };
      const updated = res.data.data;
      set((state) => ({
        subMasters: state.subMasters.map((sm) => (sm._id === id ? updated : sm))
      }));
      return updated;
    } catch (err) {
      console.error('Update sub-master failed:', err);
      throw err;
    }
  },

  // --- ORDERS ---
  fetchOrders: async (orderType = '') => {
    if (isOffline()) {
      const cached = await getCachedEntities('orders');
      const filtered = orderType ? cached.filter((o) => o.orderType === orderType) : cached;
      set({ orders: filtered });
      return filtered;
    }
    try {
      const _ord = await ordersApi.list({ orderType });
      const res = { data: { data: _ord } };
      const data = res.data.data || [];
      if (!orderType) await cacheEntities('orders', data);
      set({ orders: data });
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getCachedEntities('orders');
        set({ orders: orderType ? cached.filter((o) => o.orderType === orderType) : cached });
        return cached;
      }
      console.error('Fetch orders failed:', err);
      return [];
    }
  },

  addOrder: async (data) => {
    try {
      const _oc = await ordersApi.create(data);
      const res = { data: { data: _oc } };
      const newOrder = res.data.data;
      set(state => ({ orders: [newOrder, ...state.orders] }));
      return newOrder;
    } catch (err) {
      console.error('Add order failed:', err);
      throw err;
    }
  },

  // --- RETURNS ---
  fetchReturns: async (returnType = '') => {
    if (isOffline()) {
      const cached = await getCachedEntities('returns');
      const filtered = returnType ? cached.filter((r) => r.returnType === returnType) : cached;
      set({ returns: filtered });
      return filtered;
    }
    try {
      const _ret = await returnsApi.list({ returnType });
      const res = { data: { data: _ret } };
      const data = res.data.data || [];
      if (!returnType) await cacheEntities('returns', data);
      set({ returns: data });
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getCachedEntities('returns');
        set({ returns: returnType ? cached.filter((r) => r.returnType === returnType) : cached });
        return cached;
      }
      console.error('Fetch returns failed:', err);
      return [];
    }
  },

  addReturn: async (data) => {
    try {
      const _rc = await returnsApi.create(data);
      const res = { data: { data: _rc } };
      const newReturn = res.data.data;
      set(state => ({ returns: [newReturn, ...state.returns] }));
      return newReturn;
    } catch (err) {
      console.error('Add return failed:', err);
      throw err;
    }
  },

  // --- NOTES ---
  fetchNotes: async (noteType = '') => {
    if (isOffline()) {
      const cached = await getCachedEntities('notes');
      const filtered = noteType ? cached.filter((n) => n.noteType === noteType) : cached;
      set({ notes: filtered });
      return filtered;
    }
    try {
      const _notes = await notesApi.list({ noteType });
      const res = { data: { data: _notes } };
      const data = res.data.data || [];
      if (!noteType) await cacheEntities('notes', data);
      set({ notes: data });
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getCachedEntities('notes');
        set({ notes: noteType ? cached.filter((n) => n.noteType === noteType) : cached });
        return cached;
      }
      console.error('Fetch notes failed:', err);
      return [];
    }
  },

  addNote: async (data) => {
    try {
      const _nc = await notesApi.create(data);
      const res = { data: { data: _nc } };
      const newNote = res.data.data;
      set(state => ({ notes: [newNote, ...state.notes] }));
      return newNote;
    } catch (err) {
      console.error('Add note failed:', err);
      throw err;
    }
  },

  // --- VISITS ---
  fetchVisits: async () => {
    if (isOffline()) {
      const cached = await getCachedEntities('visits');
      set({ visits: cached });
      return cached;
    }
    try {
      const _v = await visitsApi.list();
      const res = { data: { data: _v } };
      const raw = res.data.data || res.data || [];
      const list = Array.isArray(raw) ? raw : [];
      await cacheEntities('visits', list);
      set({ visits: list });
      return list;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getCachedEntities('visits');
        set({ visits: cached });
        return cached;
      }
      console.error('Fetch visits failed:', err);
      return [];
    }
  },

  // --- VOUCHERS (Receipts & Payments) ---
  fetchVouchers: async (type = '') => {
    if (isOffline()) {
      const payments = (await getCachedEntities('payments')).map(normalizeVoucher);
      const receipts = (await getCachedEntities('receipts')).map(normalizeVoucher);
      const vouchers = [...payments, ...receipts];
      if (type === 'Payment') return payments;
      if (type === 'Receipt') return receipts;
      set({ vouchers, payments, receipts });
      return vouchers;
    }
    try {
      const query = type ? `?type=${type}` : '';
      const _vq = await accountingApi.listVouchers(Object.fromEntries(new URLSearchParams((query || '').replace(/^\?/, ''))));
      const res = { data: { data: _vq } };
      const raw = res.data.data || [];
      const vouchers = (Array.isArray(raw) ? raw : []).map(normalizeVoucher);
      const payments = vouchers.filter((v) => v.type === 'Payment');
      const receipts = vouchers.filter((v) => v.type === 'Receipt');
      await cacheEntities('payments', payments);
      await cacheEntities('receipts', receipts);
      if (type) return vouchers;
      set({ vouchers, payments, receipts });
      return vouchers;
    } catch (err) {
      if (isNetworkError(err)) {
        const payments = (await getCachedEntities('payments')).map(normalizeVoucher);
        const receipts = (await getCachedEntities('receipts')).map(normalizeVoucher);
        const vouchers = [...payments, ...receipts];
        set({ vouchers, payments, receipts });
        return type === 'Payment' ? payments : type === 'Receipt' ? receipts : vouchers;
      }
      console.error('Fetch vouchers failed:', err);
      return [];
    }
  },

  // --- MANUAL JOURNAL ---
  addJournalEntry: async (entryData) => {
    try {
      const _je = await accountingApi.journal(entryData);
      const res = { data: { data: _je } };
      return res.data.data;
    } catch (err) {
      console.error('Add journal entry failed:', err);
      throw err;
    }
  },

  // --- COMPANY USERS ---
  fetchCompanyUsers: async () => {
    try {
      const _users = await usersApi.list();
      const res = { data: { data: _users } };
      const users = (res.data.data || []).map(normalizeUser);
      set({ companyUsers: users });
      return users;
    } catch (err) {
      console.error('Fetch company users failed:', err);
      return [];
    }
  },

  addCompanyUser: async (userData) => {
    const _nu = await usersApi.create(userData);
    const res = { data: { data: _nu } };
    const user = normalizeUser(res.data.data);
    set(state => ({ companyUsers: [...state.companyUsers, user] }));
    return user;
  },

  updateCompanyUser: async (id, userData) => {
    const _uu = await usersApi.update(id, userData);
    const res = { data: { data: _uu } };
    const user = normalizeUser(res.data.data);
    set(state => ({
      companyUsers: state.companyUsers.map(u => (u._id === id || u.id === id ? user : u))
    }));
    return user;
  },

  deactivateCompanyUser: async (id) => {
    await usersApi.remove(id);
    set(state => ({
      companyUsers: state.companyUsers.filter(u => u._id !== id && u.id !== id)
    }));
  },

  // --- UI ACTIONS ---
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  clearError: () => set({ error: null }),

  fetchDashboardSummary: async () => {
    set({ dashboardLoading: true });
    try {
      const data = await dashboardApi.summary();
      set({ dashboardSummary: data, dashboardLoading: false });
      return data;
    } catch (err) {
      set({ dashboardLoading: false, error: err.message });
      return null;
    }
  },
}));

export default useStore;
