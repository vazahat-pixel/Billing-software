import React from 'react';
import useThemeStore from '../../store/useThemeStore';
import { listThemes } from '../../theme/themes';

/** Compact theme picker for settings / command palette */
export default function ThemePicker({ className = '' }) {
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const themes = listThemes();

  return (
    <div className={className}>
      <label className="text-label block mb-1.5">Appearance</label>
      <select
        value={themeId}
        onChange={(e) => setTheme(e.target.value)}
        className="w-full h-8 px-2 text-[12px] border border-[var(--border)] rounded-md bg-[var(--bg-card)] text-[var(--text-primary)] erp-focus-ring"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
