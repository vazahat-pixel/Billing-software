import { create } from 'zustand';
import api from '../utils/api';

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
            const response = await api.get('/admin/stats');
            set({ stats: response.data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.message || err.message, loading: false });
        }
    },

    fetchCompanies: async () => {
        set({ loading: true });
        try {
            const response = await api.get('/admin/companies');
            set({ companies: response.data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.message || err.message, loading: false });
        }
    },

    lockCompany: async (id) => {
        try {
            const response = await api.put(`/admin/company/${id}/lock`);
            set((state) => ({
                companies: state.companies.map(c => c._id === id ? response.data : c)
            }));
        } catch (err) {
            console.error('Failed to lock company', err);
        }
    },

    unlockCompany: async (id) => {
        try {
            const response = await api.put(`/admin/company/${id}/unlock`);
            set((state) => ({
                companies: state.companies.map(c => c._id === id ? response.data : c)
            }));
        } catch (err) {
            console.error('Failed to unlock company', err);
        }
    },

    fetchPlans: async () => {
        set({ loading: true });
        try {
            const response = await api.get('/admin/plans');
            set({ plans: response.data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.message || err.message, loading: false });
        }
    },

    savePlan: async (planData) => {
        try {
            if (planData._id) {
                const response = await api.put(`/admin/plans/${planData._id}`, planData);
                set((state) => ({
                    plans: state.plans.map(p => p._id === planData._id ? response.data : p)
                }));
            } else {
                const response = await api.post('/admin/plans', planData);
                set((state) => ({ plans: [...state.plans, response.data] }));
            }
        } catch (err) {
            console.error('Failed to save plan', err);
        }
    },

    fetchSubscriptions: async () => {
        set({ loading: true });
        try {
            const response = await api.get('/admin/subscriptions');
            set({ subscriptions: response.data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.message || err.message, loading: false });
        }
    },

    generateLicense: async (data) => {
        try {
            const response = await api.post('/admin/license/generate', data);
            set((state) => ({
                licenses: [...state.licenses, response.data]
            }));
            // Update companies list to show the new license key
            get().fetchCompanies();
        } catch (err) {
            console.error('Failed to generate license', err);
        }
    },

    fetchUsage: async (companyId, period) => {
        set({ loading: true });
        try {
            const response = await api.get(`/admin/usage?companyId=${companyId || ''}&period=${period || ''}`);
            set({ usage: response.data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.message || err.message, loading: false });
        }
    },

    fetchAuditLogs: async (companyId, module) => {
        set({ loading: true });
        try {
            const response = await api.get(`/admin/audit?companyId=${companyId || ''}&module=${module || ''}`);
            set({ auditLogs: response.data, loading: false });
        } catch (err) {
            set({ error: err.response?.data?.message || err.message, loading: false });
        }
    }
}));

export default useAdminStore;
