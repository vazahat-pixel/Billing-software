import { create } from 'zustand';
import { DEFAULT_THEME_ID, getTheme, THEMES } from '../theme/themes';

const GLOBAL_KEY = 'erp-theme-id';

const companyKey = (companyId) =>
  companyId ? `erp-theme-id:${String(companyId)}` : GLOBAL_KEY;

const readStored = (companyId) => {
  try {
    if (typeof localStorage === 'undefined') return null;
    if (companyId) {
      const scoped = localStorage.getItem(companyKey(companyId));
      if (scoped) return scoped;
    }
    return localStorage.getItem(GLOBAL_KEY);
  } catch {
    return null;
  }
};

const writeStored = (themeId, companyId) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(GLOBAL_KEY, themeId);
    if (companyId) localStorage.setItem(companyKey(companyId), themeId);
  } catch {
    /* ignore */
  }
};

const useThemeStore = create((set, get) => ({
  themeId: (typeof localStorage !== 'undefined' && localStorage.getItem(GLOBAL_KEY)) || DEFAULT_THEME_ID,
  companyId: null,

  setTheme: (themeId, options = {}) => {
    const theme = getTheme(themeId);
    const companyId = options.companyId !== undefined ? options.companyId : get().companyId;
    set({ themeId: theme.id, companyId: companyId || get().companyId });
    if (options.persist !== false) {
      writeStored(theme.id, companyId || get().companyId);
    }
  },

  /** Bind theme to logged-in company — company setting wins, else classic default. */
  bindCompanyTheme: (companyId, uiThemeId) => {
    const cid = companyId ? String(companyId) : null;
    const fromCompany = uiThemeId && THEMES[uiThemeId] ? uiThemeId : null;
    const fromLocal = readStored(cid);
    const next = fromCompany || fromLocal || DEFAULT_THEME_ID;
    const theme = getTheme(next);
    set({ themeId: theme.id, companyId: cid });
    writeStored(theme.id, cid);
  },

  cycleTheme: () => {
    const order = Object.keys(THEMES);
    const idx = order.indexOf(get().themeId);
    const next = order[(idx + 1) % order.length];
    get().setTheme(next);
  },
}));

export default useThemeStore;
