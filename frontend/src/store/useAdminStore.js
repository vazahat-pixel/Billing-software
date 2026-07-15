import { create } from 'zustand';
import { adminApi } from '../api';

const useAdminStore = create((set, get) => ({
  stats: null,
  companies: [],
  plans: [],
  subscriptions: [],
  licenses: [],
  usage: [],
  auditLogs: [],
  loading: false,
  error: null,

  fetchStats: async () => {
    set({ loading: true });
    try {
      const stats = await adminApi.stats();
      set({ stats, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false });
    }
  },

  fetchCompanies: async () => {
    set({ loading: true });
    try {
      const companies = await adminApi.companies();
      set({ companies: Array.isArray(companies) ? companies : [], loading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false });
    }
  },

  lockCompany: async (id) => {
    try {
      const updated = await adminApi.lockCompany(id);
      set((state) => ({
        companies: state.companies.map((c) => (c._id === id ? updated : c)),
      }));
    } catch (err) {
      console.error('Failed to lock company', err);
    }
  },

  unlockCompany: async (id) => {
    try {
      const updated = await adminApi.unlockCompany(id);
      set((state) => ({
        companies: state.companies.map((c) => (c._id === id ? updated : c)),
      }));
    } catch (err) {
      console.error('Failed to unlock company', err);
    }
  },

  fetchPlans: async () => {
    set({ loading: true });
    try {
      const plans = await adminApi.plans();
      set({ plans: Array.isArray(plans) ? plans : [], loading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false });
    }
  },

  savePlan: async (planData) => {
    try {
      if (planData._id) {
        const updated = await adminApi.updatePlan(planData._id, planData);
        set((state) => ({
          plans: state.plans.map((p) => (p._id === planData._id ? updated : p)),
        }));
      } else {
        const created = await adminApi.createPlan(planData);
        set((state) => ({ plans: [...state.plans, created] }));
      }
    } catch (err) {
      console.error('Failed to save plan', err);
      throw err;
    }
  },

  fetchSubscriptions: async () => {
    set({ loading: true });
    try {
      const subscriptions = await adminApi.subscriptions();
      set({ subscriptions: Array.isArray(subscriptions) ? subscriptions : [], loading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false });
    }
  },

  generateLicense: async (data) => {
    try {
      const license = await adminApi.generateLicense(data);
      set((state) => ({
        licenses: [...state.licenses, license],
      }));
      get().fetchCompanies();
    } catch (err) {
      console.error('Failed to generate license', err);
      throw err;
    }
  },

  fetchUsage: async (companyId, period) => {
    set({ loading: true });
    try {
      const usage = await adminApi.rawGet(
        `/admin/usage?companyId=${companyId || ''}&period=${period || ''}`
      );
      set({ usage: Array.isArray(usage) ? usage : usage || [], loading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false });
    }
  },

  fetchAuditLogs: async (companyId, module) => {
    set({ loading: true });
    try {
      const logs = await adminApi.audit({ companyId: companyId || '', module: module || '' });
      set({ auditLogs: Array.isArray(logs) ? logs : [], loading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false });
    }
  },

  createCompany: async (companyData) => {
    set({ loading: true });
    try {
      const created = await adminApi.createCompany(companyData);
      set((state) => ({
        companies: [...state.companies, created],
        loading: false,
      }));
      return created;
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  updateCompany: async (id, companyData) => {
    set({ loading: true });
    try {
      const updated = await adminApi.updateCompany(id, companyData);
      set((state) => ({
        companies: state.companies.map((c) => (c._id === id ? updated : c)),
        loading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  deletePlan: async (id) => {
    set({ loading: true });
    try {
      await adminApi.deletePlan(id);
      set((state) => ({
        plans: state.plans.filter((p) => p._id !== id),
        loading: false,
      }));
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  updateSubscription: async (companyId, subData) => {
    set({ loading: true });
    try {
      const updated = await adminApi.updateSubscription(companyId, subData);
      set((state) => ({
        subscriptions: state.subscriptions.map((s) =>
          s.companyId?._id === companyId ? updated : s
        ),
        loading: false,
      }));
      get().fetchSubscriptions();
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  renewLicense: async (companyId, data) => {
    set({ loading: true });
    try {
      const updated = await adminApi.renewLicense(companyId, data);
      set((state) => ({
        licenses: state.licenses.map((l) => (l.companyId === companyId ? updated : l)),
        loading: false,
      }));
      get().fetchCompanies();
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },
}));

export default useAdminStore;
