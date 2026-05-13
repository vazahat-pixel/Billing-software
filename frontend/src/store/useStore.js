import { create } from 'zustand';
import api from '../api/client';

const useStore = create((set, get) => ({
  // --- AUTH STATE ---
  user: null,
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
  loading: false,
  error: null,

  // --- AUTH ACTIONS ---
  setAuth: (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.user.role);
    set({ 
      token: data.token, 
      user: data.user, 
      role: data.user.role, 
      plan: data.user.plan 
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    set({ token: null, user: null, role: null, plan: null, parties: [], items: [] });
  },

  // --- MASTER ACTIONS ---
  fetchParties: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/parties');
      set({ parties: res.data.data || res.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addParty: async (partyData) => {
    try {
      const res = await api.post('/parties', {
        ...partyData,
        companyId: get().user?.companyId
      });
      const newParty = res.data.data || res.data;
      set((state) => ({ parties: [...state.parties, newParty] }));
      return newParty;
    } catch (err) {
      throw err;
    }
  },

  searchParties: async (query) => {
    try {
      const res = await api.get(`/parties/search?q=${query}`);
      return res.data.data || res.data;
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  },

  fetchItems: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/items');
      set({ items: res.data.data || res.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addItem: async (itemData) => {
    try {
      const res = await api.post('/items', {
        ...itemData,
        companyId: get().user?.companyId
      });
      const newItem = res.data.data || res.data;
      set((state) => ({ items: [...state.items, newItem] }));
      return newItem;
    } catch (err) {
      throw err;
    }
  },

  searchItems: async (query) => {
    try {
      const res = await api.get(`/items/search?q=${query}`);
      return res.data.data || res.data;
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  },

  // --- PURCHASE ACTIONS ---
  fetchPurchases: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/purchases');
      set({ purchases: res.data.data || res.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addPurchase: async (purchaseData) => {
    try {
      const res = await api.post('/purchases', {
        ...purchaseData,
        companyId: get().user?.companyId
      });
      const newPurchase = res.data.data || res.data;
      set((state) => ({ purchases: [newPurchase, ...state.purchases] }));
      
      // Auto-sync inventory after purchase
      get().fetchInventory();
      
      return newPurchase;
    } catch (err) {
      throw err;
    }
  },

  // --- SALES ACTIONS ---
  fetchSales: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/sales');
      set({ sales: res.data.data || res.data, loading: false });
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
      const newSale = res.data.data || res.data;
      set((state) => ({ sales: [newSale, ...state.sales] }));
      
      // Auto-sync inventory after sale
      get().fetchInventory();
      
      return newSale;
    } catch (err) {
      throw err;
    }
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
        loading: false 
      }));
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
        loading: false 
      }));
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

  // --- UI ACTIONS ---
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  clearError: () => set({ error: null })
}));

export default useStore;
