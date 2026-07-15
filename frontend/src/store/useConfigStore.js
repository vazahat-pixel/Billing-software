import { create } from 'zustand';
import { getPermissions } from '../utils/permissions';

/**
 * Single source of truth for session configuration after login.
 * Populated from auth payload + ConfigProvider bundle sync.
 * Screens must read company/plan/permissions/modules from here — not hardcode.
 */
const useConfigStore = create((set, get) => ({
  company: null,
  companySettings: null,
  plan: null,
  user: null,
  modules: {},
  subMenus: {},
  featureFlags: {},
  fieldConfig: {},
  financialYear: null,
  books: [],
  branch: null,
  warehouse: null,
  permissions: getPermissions('owner', 'user'),
  configHash: null,
  bundleVersion: null,
  lastSyncedAt: null,
  ready: false,

  hydrateFromAuth: (user, plan) => {
    if (!user) {
      set({
        company: null,
        companySettings: null,
        plan: null,
        user: null,
        permissions: getPermissions('owner', 'user'),
        ready: false,
      });
      return;
    }
    const settings = user.companySettings || user.settings || null;
    const company = user.company || {
      _id: user.companyId,
      name: settings?.legalName || settings?.shortName || user.companyName || 'My Company',
      meta: {
        gstin: settings?.gstin,
        pan: settings?.pan,
        state: settings?.state,
        address: settings?.address,
        phone: settings?.phone,
        email: settings?.email,
        city: settings?.city,
        pincode: settings?.pincode,
      },
    };
    set({
      user,
      plan: plan || user.plan || null,
      company,
      companySettings: settings,
      financialYear: settings?.financialYear || user.financialYear || null,
      permissions: getPermissions(user.companyRole, user.role),
      modules: user.moduleConfig?.modules || get().modules,
      subMenus: user.moduleConfig?.subMenus || get().subMenus,
      ready: true,
    });
  },

  syncBundle: (bundle) => {
    if (!bundle) return;
    const rawFlags = bundle.featureFlags;
    let featureFlags = get().featureFlags;
    if (Array.isArray(rawFlags)) {
      featureFlags = Object.fromEntries(
        rawFlags.map((f) => [f.flagKey || f.key, f.enabled !== false])
      );
    } else if (rawFlags && typeof rawFlags === 'object') {
      featureFlags = { ...rawFlags };
    }
    set({
      modules: bundle.modules || bundle.moduleConfig?.modules || get().modules,
      subMenus: bundle.subMenus || bundle.moduleConfig?.subMenus || get().subMenus,
      featureFlags,
      fieldConfig: bundle.forms || bundle.fields || get().fieldConfig,
      configHash: bundle.configHash || null,
      bundleVersion: bundle.bundleVersion || null,
      lastSyncedAt: new Date().toISOString(),
      companySettings: bundle.companySettings || get().companySettings,
    });
  },

  setBooks: (books) => set({ books: Array.isArray(books) ? books : [] }),

  can: (section) => get().permissions.canAccessSection?.(section) !== false,

  isModuleEnabled: (moduleKey) => {
    const mods = get().modules;
    if (!mods || typeof mods !== 'object') return true;
    if (mods[moduleKey] === false) return false;
    return true;
  },

  isFlagEnabled: (flagKey, defaultValue = true) => {
    const flags = get().featureFlags;
    if (!flags || !(flagKey in flags)) return defaultValue;
    return !!flags[flagKey];
  },

  reset: () =>
    set({
      company: null,
      companySettings: null,
      plan: null,
      user: null,
      modules: {},
      subMenus: {},
      featureFlags: {},
      fieldConfig: {},
      financialYear: null,
      books: [],
      branch: null,
      warehouse: null,
      permissions: getPermissions('owner', 'user'),
      configHash: null,
      bundleVersion: null,
      lastSyncedAt: null,
      ready: false,
    }),
}));

export default useConfigStore;
