import { useEffect } from 'react';
import useThemeStore from '../store/useThemeStore';
import { getTheme, DARK_THEME_IDS } from './themes';

export default function ThemeProvider({ children }) {
  const themeId = useThemeStore((s) => s.themeId);

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
