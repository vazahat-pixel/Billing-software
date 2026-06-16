import { create } from 'zustand';
import api from '../api/client';
import {
  normalizeParty,
  normalizeItem,
  normalizeSale,
  normalizePurchase,
  normalizeUser
} from '../utils/normalizers';

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
  setAuth: (data) => {
    const user = normalizeUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', user.role);
    localStorage.setItem('user', JSON.stringify(user));
    set({ 
      token: data.token, 
      user, 
      role: user.role, 
      plan: user.plan,
      sessionReady: true
    });
  },

  restoreSession: async () => {
    const token = get().token || localStorage.getItem('token');
    if (!token) {
      set({ sessionReady: true });
      return;
    }

    try {
      const res = await api.get('/auth/me');
      const user = normalizeUser(res.data.user);
      localStorage.setItem('role', user.role);
      localStorage.setItem('user', JSON.stringify(user));
      // FIXED: Restore plan from saved user data so plan isn't null after refresh
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      set({ user, role: user.role, plan: user.plan || savedUser.plan || null, sessionReady: true });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      set({ token: null, user: null, role: null, plan: null, sessionReady: true });
    }
  },

  logout: () => {
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
    return get().refreshAllData();
  },

  refreshAllData: async () => {
    const {
      fetchParties, fetchItems, fetchSales, fetchPurchases, fetchInventory,
      fetchJobs, fetchOrders, fetchReturns, fetchNotes, fetchVisits, fetchVouchers, fetchBooks
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
      fetchBooks()
    ]);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[Refresh] ${failed.length} data fetches failed:`, failed.map(f => f.reason?.message));
    }
  },

  // --- MASTER ACTIONS ---
  fetchParties: async () => {
    set({ partiesLoading: true });
    try {
      const res = await api.get('/parties');
      const raw = res.data.data || res.data || [];
      const parties = (Array.isArray(raw) ? raw : []).map(normalizeParty);
      set({ parties, partiesLoading: false });
    } catch (err) {
      set({ error: err.message, partiesLoading: false });
    }
  },

  addParty: async (partyData) => {
    try {
      // SECURITY FIX: Do not send companyId from frontend — server extracts from JWT
      const res = await api.post('/parties', partyData);
      const newParty = normalizeParty(res.data.data || res.data);
      set((state) => ({ parties: [...state.parties, newParty] }));
      return newParty;
    } catch (err) {
      throw err;
    }
  },

  updateParty: async (id, partyData) => {
    try {
      const res = await api.put(`/parties/${id}`, partyData);
      const updatedParty = normalizeParty(res.data.data || res.data);
      set((state) => ({
        parties: state.parties.map((p) => (p._id === id ? updatedParty : p))
      }));
      return updatedParty;
    } catch (err) {
      throw err;
    }
  },

  deleteParty: async (id) => {
    try {
      await api.delete(`/parties/${id}`);
      set((state) => ({
        parties: state.parties.filter((p) => p._id !== id)
      }));
    } catch (err) {
      throw err;
    }
  },

  searchParties: async (query) => {
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
    try {
      const res = await api.get('/items');
      const raw = res.data.data || res.data || [];
      const items = (Array.isArray(raw) ? raw : []).map(normalizeItem);
      set({ items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addItem: async (itemData) => {
    try {
      // SECURITY FIX: Do not send companyId from frontend — server extracts from JWT
      const res = await api.post('/items', itemData);
      const newItem = normalizeItem(res.data.data || res.data);
      set((state) => ({ items: [...state.items, newItem] }));
      return newItem;
    } catch (err) {
      throw err;
    }
  },

  updateItem: async (id, itemData) => {
    try {
      const res = await api.put(`/items/${id}`, itemData);
      const updatedItem = normalizeItem(res.data.data || res.data);
      set((state) => ({
        items: state.items.map((i) => (i._id === id ? updatedItem : i))
      }));
      return updatedItem;
    } catch (err) {
      throw err;
    }
  },

  deleteItem: async (id) => {
    try {
      await api.delete(`/items/${id}`);
      set((state) => ({
        items: state.items.filter((i) => i._id !== id)
      }));
    } catch (err) {
      throw err;
    }
  },

  searchItems: async (query) => {
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
    try {
      const queryParams = new URLSearchParams(params).toString();
      const res = await api.get(`/purchases${queryParams ? '?' + queryParams : ''}`);
      const raw = res.data.data?.purchases || res.data.data || res.data || [];
      const purchases = (Array.isArray(raw) ? raw : []).map(normalizePurchase);
      set({ purchases, purchasesLoading: false });
    } catch (err) {
      set({ error: err.message, purchasesLoading: false });
    }
  },

  addPurchase: async (purchaseData) => {
    try {
      // SECURITY FIX: Do not send companyId from frontend — server extracts from JWT
      const res = await api.post('/purchases', purchaseData);
      const newPurchase = normalizePurchase(res.data.data || res.data);
      set((state) => ({ purchases: [newPurchase, ...state.purchases] }));
      // Auto-sync inventory after purchase
      get().fetchInventory();
      return newPurchase;
    } catch (err) {
      throw err;
    }
  },

  deletePurchase: async (id) => {
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
  },

  updatePurchaseStatus: async (id, status) => {
    const res = await api.put(`/purchases/${id}/status`, { status });
    const updated = normalizePurchase(res.data.data);
    set(state => ({
      purchases: state.purchases.map(p => (p._id === id || p.id === id ? updated : p))
    }));
    return updated;
  },

  createOpeningStock: async (data) => {
    const res = await api.post('/inventory/opening-stock', data);
    get().fetchInventory();
    return res.data.data;
  },

  // --- SALES ACTIONS ---
  fetchSales: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/sales');
      const raw = res.data.data?.sales || res.data.data || res.data || [];
      const sales = (Array.isArray(raw) ? raw : []).map(normalizeSale);
      set({ sales, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addSale: async (saleData) => {
    try {
      const res = await api.post('/sales', {
        ...saleData,
        companyId: get().user?.companyId
      });
      const newSale = normalizeSale(res.data.data || res.data);
      set((state) => ({ sales: [newSale, ...state.sales] }));
      
      // Auto-sync inventory after sale
      get().fetchInventory();
      
      return newSale;
    } catch (err) {
      throw err;
    }
  },

  deleteSale: async (id) => {
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
  },

  updateSaleStatus: async (id, status) => {
    const res = await api.put(`/sales/${id}/status`, { status });
    const updated = normalizeSale(res.data.data);
    set(state => ({
      sales: state.sales.map(s => (s._id === id || s.id === id ? updated : s))
    }));
    return updated;
  },

  fetchGstr1: async (startDate, endDate) => {
    const res = await api.get(`/gst/gstr1?startDate=${startDate || ''}&endDate=${endDate || ''}`);
    return res.data.data;
  },

  // --- INVENTORY ---
  fetchInventory: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/inventory');
      set({ inventoryLots: res.data.data || res.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // --- JOB WORK ---
  fetchJobs: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/jobs');
      set({ jobWorkEntries: res.data.data || res.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
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
      set((state) => ({ 
        jobWorkEntries: state.jobWorkEntries.map(j => j._id === receiveData.jobId ? res.data.data || res.data : j) 
      }));
      return res.data;
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
    try {
      const companyId = get().user?.companyId;
      const res = await api.get(`/accounting/ledgers?companyId=${companyId}&group=${group}&search=${search}`);
      set({ ledgers: res.data.data || [] });
      return res.data.data;
    } catch (err) {
      console.error('Fetch ledgers failed:', err);
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
    set({ loading: true });
    try {
      const res = await api.post('/accounting/payments', {
        ...data,
        companyId: get().user?.companyId
      });
      const newVoucher = res.data.data;
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
      throw err;
    }
  },

  addReceipt: async (data) => {
    set({ loading: true });
    try {
      const res = await api.post('/accounting/receipts', {
        ...data,
        companyId: get().user?.companyId
      });
      const newVoucher = res.data.data;
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
      set({ trialBalance: res.data.data || [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
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
    }
  },

  fetchBooks: async () => {
    set({ loading: true });
    try {
      const companyId = get().user?.companyId;
      const res = await api.get(`/books?companyId=${companyId}`);
      set({ books: res.data.data || [], loading: false });
      return res.data.data;
    } catch (err) {
      console.error('Fetch books failed:', err);
      set({ error: err.message, loading: false });
      return [];
    }
  },

  fetchBooksByModule: async (moduleName) => {
    try {
      const res = await api.get(`/books/module/${moduleName}`);
      return res.data.data || [];
    } catch (err) {
      console.error('Fetch books failed:', err);
      return [];
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
    try {
      const res = await api.get(`/submasters?type=${type}`);
      set({ subMasters: res.data.data || [] });
      return res.data.data;
    } catch (err) {
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

  // --- ORDERS ---
  fetchOrders: async (orderType = '') => {
    try {
      const res = await api.get(`/orders?orderType=${orderType}`);
      set({ orders: res.data.data || [] });
      return res.data.data;
    } catch (err) {
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
    try {
      const res = await api.get(`/returns?returnType=${returnType}`);
      set({ returns: res.data.data || [] });
      return res.data.data;
    } catch (err) {
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
    try {
      const res = await api.get(`/notes?noteType=${noteType}`);
      set({ notes: res.data.data || [] });
      return res.data.data;
    } catch (err) {
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
    try {
      const res = await api.get('/visits');
      const raw = res.data.data || res.data || [];
      set({ visits: Array.isArray(raw) ? raw : [] });
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.error('Fetch visits failed:', err);
      return [];
    }
  },

  // --- VOUCHERS (Receipts & Payments) ---
  fetchVouchers: async (type = '') => {
    try {
      const query = type ? `?type=${type}` : '';
      const res = await api.get(`/accounting/payments${query}`);
      const raw = res.data.data || [];
      const vouchers = Array.isArray(raw) ? raw : [];
      if (type) {
        return vouchers;
      }
      set({ vouchers });
      return vouchers;
    } catch (err) {
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
