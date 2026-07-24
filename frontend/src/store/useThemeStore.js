import { create } from 'zustand';
import { DEFAULT_THEME_ID, getTheme, THEMES } from '../theme/themes';

const STORAGE_KEY = 'erp-theme-id';

const useThemeStore = create((set, get) => ({
  themeId: (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || DEFAULT_THEME_ID,

  setTheme: (themeId) => {
    const theme = getTheme(themeId);
    set({ themeId: theme.id });
    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {
      /* ignore */
    }
  },

  cycleTheme: () => {
    const order = Object.keys(THEMES);
    const idx = order.indexOf(get().themeId);
    const next = order[(idx + 1) % order.length];
    get().setTheme(next);
  },
}));

export default useThemeStore;
