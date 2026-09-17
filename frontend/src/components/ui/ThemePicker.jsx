import React, { useState } from 'react';
import useThemeStore from '../../store/useThemeStore';
import useConfigStore from '../../store/useConfigStore';
import { listThemes, getTheme, DEFAULT_THEME_ID } from '../../theme/themes';
import { configApi } from '../../api/masters.api';
import { toast } from '../../store/useToastStore';

/**
 * Theme picker — preview on select, Apply saves for this company (not just browser).
 */
export default function ThemePicker({ className = '' }) {
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const companyId = useThemeStore((s) => s.companyId);
  const companySettings = useConfigStore((s) => s.companySettings);
  const patchCompanySettings = useConfigStore((s) => s.patchCompanySettings);
  const themes = listThemes();
  const [draftId, setDraftId] = useState(themeId);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setDraftId(themeId);
  }, [themeId]);

  const preview = (id) => {
    setDraftId(id);
    setTheme(id, { persist: false, companyId });
  };

  const applyTheme = async () => {
    const theme = getTheme(draftId);
    setTheme(theme.id, { companyId, persist: true });
    setSaving(true);
    try {
      const payload = { ...(companySettings || {}), uiThemeId: theme.id };
      const { settings: saved } = await configApi.saveSettings(payload);
      const next = saved || payload;
      patchCompanySettings({ ...next, uiThemeId: theme.id });
      toast.success(`Theme saved for company: ${theme.label}`);
    } catch (err) {
      toast.error(err, { fallback: 'Theme applied here, but company save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const resetClassic = async () => {
    setDraftId(DEFAULT_THEME_ID);
    setTheme(DEFAULT_THEME_ID, { companyId, persist: true });
    setSaving(true);
    try {
      const payload = { ...(companySettings || {}), uiThemeId: DEFAULT_THEME_ID };
      const { settings: saved } = await configApi.saveSettings(payload);
      patchCompanySettings({ ...(saved || payload), uiThemeId: DEFAULT_THEME_ID });
      toast.success('Classic ERP set as company theme');
    } catch (err) {
      toast.error(err, { fallback: 'Could not save classic theme.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <label className="text-label block mb-1.5">Appearance</label>
      <p className="text-[11px] text-[var(--text-muted)] mb-3">
        Default is <strong>Classic ERP</strong>. Apply saves theme for this company — next login keeps it.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 max-h-[280px] overflow-y-auto pr-1">
        {themes.map((t) => {
          const active = draftId === t.id;
          const swatch = getTheme(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => preview(t.id)}
              className={`text-left rounded-lg border p-2 transition-colors ${
                active
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--accent-light)]'
                  : 'border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-card)]'
              }`}
            >
              <div
                className="h-8 rounded mb-1.5 border border-[var(--border)]"
                style={{
                  background: `linear-gradient(135deg, ${swatch.tokens['--bg-base'] || '#eee'} 40%, ${swatch.tokens['--accent'] || '#0055ea'} 100%)`,
                }}
              />
              <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{t.label}</p>
              {t.id === DEFAULT_THEME_ID && (
                <p className="text-[9px] text-[var(--text-muted)]">Default</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyTheme}
          disabled={saving}
          className="erp-btn erp-btn-primary h-8 px-4 text-[11px] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Apply Theme'}
        </button>
        <button
          type="button"
          onClick={resetClassic}
          disabled={saving}
          className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] disabled:opacity-50"
        >
          Reset Classic
        </button>
      </div>
    </div>
  );
}
