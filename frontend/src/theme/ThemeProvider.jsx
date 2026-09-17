import { useEffect } from 'react';
import useThemeStore from '../store/useThemeStore';
import useConfigStore from '../store/useConfigStore';
import { getTheme, DARK_THEME_IDS } from './themes';

export default function ThemeProvider({ children }) {
  const themeId = useThemeStore((s) => s.themeId);
  const bindCompanyTheme = useThemeStore((s) => s.bindCompanyTheme);
  const companyId = useConfigStore((s) => s.company?._id || s.company?.id || s.user?.companyId || null);
  const uiThemeId = useConfigStore((s) => s.companySettings?.uiThemeId || null);
  const ready = useConfigStore((s) => s.ready);

  useEffect(() => {
    if (!ready) return;
    bindCompanyTheme(companyId, uiThemeId);
  }, [ready, companyId, uiThemeId, bindCompanyTheme]);

  useEffect(() => {
    const theme = getTheme(themeId);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.id);
    Object.entries(theme.tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    if (DARK_THEME_IDS.has(theme.id)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeId]);

  return children;
}
