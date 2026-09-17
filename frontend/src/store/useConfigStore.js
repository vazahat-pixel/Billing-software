import { create } from 'zustand';
import { getPermissions } from '../utils/permissions';

/** True when settings carry enough identity to drive setup checks / invoices. */
function hasCompanyIdentity(settings) {
  if (!settings || typeof settings !== 'object') return false;
  if (settings._id) return true;
  const legal = String(settings.legalName || settings.shortName || '').trim();
  const gstin = String(settings.gstin || '').replace(/\s/g, '');
  return Boolean(legal || gstin.length >= 15);
}

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
    // Config sync stores settings under activeConfig; login payload often omits them.
    // Never wipe a richer in-memory copy when re-hydrate runs after every Sync.
    const incoming =
      user.companySettings || user.settings || user.activeConfig?.companySettings || null;
    const existing = get().companySettings;
    const settings = hasCompanyIdentity(incoming)
      ? incoming
      : hasCompanyIdentity(existing)
        ? existing
        : incoming || existing || null;

    const baseCompany = user.company || {
      _id: user.companyId,
      name: settings?.legalName || settings?.shortName || user.companyName || 'My Company',
      meta: {},
    };
    const company = {
      ...baseCompany,
      name: settings?.legalName || settings?.shortName || baseCompany.name || user.companyName || 'My Company',
      meta: {
        ...(baseCompany.meta || {}),
        gstin: settings?.gstin ?? baseCompany.meta?.gstin,
        pan: settings?.pan ?? baseCompany.meta?.pan,
        state: settings?.state ?? baseCompany.meta?.state,
        stateCode: settings?.stateCode ?? baseCompany.meta?.stateCode,
        address: settings?.address ?? baseCompany.meta?.address,
        phone: settings?.phone ?? baseCompany.meta?.phone,
        email: settings?.email ?? baseCompany.meta?.email,
        city: settings?.city ?? baseCompany.meta?.city,
        pincode: settings?.pincode ?? baseCompany.meta?.pincode,
      },
    };
    set({
      user,
      plan: plan || user.plan || null,
      company,
      companySettings: settings,
      financialYear: settings?.financialYear || user.financialYear || get().financialYear || null,
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
    const fromBundle = bundle.companySettings;
    const prev = get().companySettings;
    // Empty `{}` from backend `companySettings || {}` must not wipe filled store.
    const companySettings = hasCompanyIdentity(fromBundle)
      ? fromBundle
      : prev || (fromBundle && Object.keys(fromBundle).length ? fromBundle : prev);

    set({
      modules: bundle.modules || bundle.moduleConfig?.modules || get().modules,
      subMenus: bundle.subMenus || bundle.moduleConfig?.subMenus || get().subMenus,
      featureFlags,
      fieldConfig: bundle.forms || bundle.fields || get().fieldConfig,
      configHash: bundle.configHash || null,
      bundleVersion: bundle.bundleVersion || null,
      lastSyncedAt: new Date().toISOString(),
      companySettings,
    });
  },

  setBooks: (books) => set({ books: Array.isArray(books) ? books : [] }),

  /** Immediately apply saved company settings so setup warnings clear without waiting for poll. */
  patchCompanySettings: (settings) => {
    if (!settings || typeof settings !== 'object') return;
    set((s) => {
      const next = { ...(s.companySettings || {}), ...settings };
      const company = s.company
        ? {
            ...s.company,
            name: settings.legalName || settings.shortName || s.company.name,
            meta: {
              ...(s.company.meta || {}),
              gstin: settings.gstin ?? s.company.meta?.gstin,
              pan: settings.pan ?? s.company.meta?.pan,
              state: settings.state ?? s.company.meta?.state,
              stateCode: settings.stateCode ?? s.company.meta?.stateCode,
              address: settings.address ?? s.company.meta?.address,
              phone: settings.phone ?? s.company.meta?.phone,
              email: settings.email ?? s.company.meta?.email,
              city: settings.city ?? s.company.meta?.city,
              pincode: settings.pincode ?? s.company.meta?.pincode,
            },
          }
        : s.company;
      return { companySettings: next, company };
    });
  },

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
