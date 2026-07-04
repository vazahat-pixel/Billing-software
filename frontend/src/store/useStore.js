import { create } from 'zustand';
import api from '../api/client';
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
  role: localStorage.getItem('role') || null,
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
    await prepareCompanyCache(user.companyId);
    // Explicitly set companyId BEFORE any cache hydration
    if (user.companyId) setActiveCompanyId(user.companyId);
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', user.role);
    localStorage.setItem('user', JSON.stringify(user));
    const plan = user.plan;
    persistOfflineFlag(user, plan);
    set({ 
      token: data.token, 
      user, 
      role: user.role, 
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
        set({ token, sessionReady: true });
        return false;
      }
      const user = normalizeUser(savedUser);
      persistOfflineFlag(user, user.plan);
      if (user.companyId) setActiveCompanyId(user.companyId);
      set({
        token,
        user,
        role: user.role || localStorage.getItem('role'),
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
      const res = await api.get('/auth/me', { skipAuthRedirect: true, forceNetwork: true });
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
      const res = await api.get('/parties');
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
      const res = await api.post('/parties', partyData);
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
      const res = await api.put(`/parties/${id}`, partyData);
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
      await api.delete(`/parties/${id}`);
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
      const res = await api.get(`/parties/search?q=${query}`);
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
      const res = await api.get('/items');
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
      const res = await api.post('/items', itemData);
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
      const res = await api.put(`/items/${id}`, itemData);
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
      await api.delete(`/items/${id}`);
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
      const res = await api.get(`/items/search?q=${query}`);
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
      const res = await api.get(`/purchases${queryParams ? '?' + queryParams : ''}`);
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
      const res = await api.post('/purchases', enriched);
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
      const res = await api.delete(`/purchases/${id}`);
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
      const res = await api.put(`/purchases/${id}`, enriched);
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
      const res = await api.put(`/purchases/${id}/status`, { status });
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
    const res = await api.post('/inventory/opening-stock', data);
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
      const res = await api.get('/sales');
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
      const res = await api.post('/sales', enriched);
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
      const res = await api.delete(`/sales/${id}`);
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
      const res = await api.put(`/sales/${id}`, enriched);
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
      const res = await api.put(`/sales/${id}/status`, { status });
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
    const res = await api.get(`/gst/gstr1?startDate=${startDate || ''}&endDate=${endDate || ''}`);
    return res.data.data;
  },

  fetchGstr2: async (startDate, endDate) => {
    const res = await api.get(`/gst/gstr2?startDate=${startDate || ''}&endDate=${endDate || ''}`);
    return res.data.data;
  },

  fetchCADashboard: async (startDate, endDate) => {
    const res = await api.get(`/gst/ca-dashboard?startDate=${startDate || ''}&endDate=${endDate || ''}`);
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
      const res = await api.get('/inventory');
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
      const res = await api.get('/jobs');
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
      const res = await api.post('/jobs/issue', issueData);
      set((state) => ({ jobWorkEntries: [res.data.data || res.data, ...state.jobWorkEntries] }));
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  receiveFromMill: async (receiveData) => {
    try {
      const res = await api.post('/jobs/receive', receiveData);
      await get().fetchJobs();
      await get().fetchInventory();
      return res.data.data;
    } catch (err) {
      throw err;
    }
  },

  updateJobProcess: async (jobId, status) => {
    try {
      const res = await api.put('/jobs/process', { jobId, status });
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
      const res = await api.get(`/ledgers/${partyId}`);
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
      const res = await api.get(`/accounting/ledgers?companyId=${companyId}&group=${group}&search=${search}`);
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
      const res = await api.post('/accounting/ledgers', {
        ...ledgerData,
        companyId: get().user?.companyId
      });
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
      const res = await api.post('/accounting/payments', {
        ...data,
        companyId: get().user?.companyId
      });
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
      const res = await api.post('/accounting/receipts', {
        ...data,
        companyId: get().user?.companyId
      });
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
      const res = await api.get(`/accounting/ledgers/${ledgerId}/statement?from=${from || ''}&to=${to || ''}`);
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
      const res = await api.get(`/accounting/trial-balance?companyId=${companyId}&asOn=${asOn || ''}`);
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
      const res = await api.get(`/accounting/profit-loss?companyId=${companyId}&from=${from || ''}&to=${to || ''}`);
      set({ profitLoss: res.data.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchOutstanding: async (type, asOn) => {
    set({ loading: true });
    try {
      const companyId = get().user?.companyId;
      const res = await api.get(`/accounting/outstanding?companyId=${companyId}&type=${type}&asOn=${asOn || ''}`);
      set({ outstandingReport: res.data.data || [], loading: false });
      return res.data.data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return [];
    }
  },

  fetchReportsBundle: async (startDate, endDate) => {
    try {
      const res = await api.get(`/reports/bundle?startDate=${startDate || ''}&endDate=${endDate || ''}`);
      return res.data.data;
    } catch (err) {
      console.error('Reports bundle failed:', err);
      throw err;
    }
  },

  fetchStockReport: async () => {
    const res = await api.get('/reports/stock');
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
      const res = await api.get(`/books?companyId=${companyId}`);
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
      const res = await api.get(`/books/module/${moduleName}`);
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
      const res = await api.post('/books', {
        ...bookData,
        companyId: get().user?.companyId
      });
      return res.data.data;
    } catch (err) {
      console.error('Create book failed:', err);
      throw err;
    }
  },

  deleteBook: async (id) => {
    try {
      await api.delete(`/books/${id}`);
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
      const res = await api.get(`/submasters?type=${type}`);
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
      const res = await api.post('/submasters', data);
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
      await api.delete(`/submasters/${id}`);
      set(state => ({ subMasters: state.subMasters.filter(sm => sm._id !== id) }));
    } catch (err) {
      console.error('Delete sub-master failed:', err);
      throw err;
    }
  },

  updateSubMaster: async (id, data) => {
    try {
      const res = await api.put(`/submasters/${id}`, data);
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
      const res = await api.get(`/orders?orderType=${orderType}`);
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
      const res = await api.post('/orders', data);
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
      const res = await api.get(`/returns?returnType=${returnType}`);
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
      const res = await api.post('/returns', data);
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
      const res = await api.get(`/notes?noteType=${noteType}`);
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
      const res = await api.post('/notes', data);
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
      const res = await api.get('/visits');
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
      const res = await api.get(`/accounting/payments${query}`);
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
      const res = await api.post('/accounting/journal', entryData);
      return res.data.data;
    } catch (err) {
      console.error('Add journal entry failed:', err);
      throw err;
    }
  },

  // --- COMPANY USERS ---
  fetchCompanyUsers: async () => {
    try {
      const res = await api.get('/users');
      const users = (res.data.data || []).map(normalizeUser);
      set({ companyUsers: users });
      return users;
    } catch (err) {
      console.error('Fetch company users failed:', err);
      return [];
    }
  },

  addCompanyUser: async (userData) => {
    const res = await api.post('/users', userData);
    const user = normalizeUser(res.data.data);
    set(state => ({ companyUsers: [...state.companyUsers, user] }));
    return user;
  },

  updateCompanyUser: async (id, userData) => {
    const res = await api.put(`/users/${id}`, userData);
    const user = normalizeUser(res.data.data);
    set(state => ({
      companyUsers: state.companyUsers.map(u => (u._id === id || u.id === id ? user : u))
    }));
    return user;
  },

  deactivateCompanyUser: async (id) => {
    await api.delete(`/users/${id}`);
    set(state => ({
      companyUsers: state.companyUsers.filter(u => u._id !== id && u.id !== id)
    }));
  },

  // --- UI ACTIONS ---
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  clearError: () => set({ error: null })
  // --- END ---
}));

export default useStore;
