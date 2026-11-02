import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, Globe } from 'lucide-react';
import api from '../../api/client';
import useToastStore from '../../store/useToastStore';
import { isDesktopLocalMode } from '../../utils/desktopMode';

/**
 * Setup System > Setting > Desktop-only Entries.
 *
 * ON  — entries are made only on the office desktop; the web shows everything but cannot save.
 *       The desktop is then the only writer, so desktop and web always show the same figures.
 * OFF — the web can make entries too; the desktop downloads them when it is online.
 *
 * The switch lives on the cloud. From the desktop the change is forwarded there, so it needs internet.
 */
export default function DesktopOnlyEntriesSettings({ canEdit }) {
  const toast = useToastStore();
  const onDesktop = isDesktopLocalMode();
  const [lock, setLock] = useState(null);
  const [sync, setSync] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/sync/mirror/lock');
      setLock(res.data?.data || { desktopOnly: false });
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Could not read this setting');
    }
    if (onDesktop) {
      try {
        const s = await api.get('/sync/mirror/status');
        setSync(s.data?.data || null);
      } catch { /* not a mirrored desktop */ }
    }
  }, [onDesktop]);

  useEffect(() => { load(); }, [load]);

  const change = async (desktopOnly) => {
    setSaving(true);
    try {
      const res = await api.put('/sync/mirror/lock', { desktopOnly });
      setLock(res.data?.data || { desktopOnly });
      toast.success(desktopOnly ? 'Entries are now made only on the office desktop.' : 'The web can make entries again.');
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message || 'Could not change this setting');
    } finally {
      setSaving(false);
    }
  };

  const on = !!lock?.desktopOnly;

  return (
    <div className="p-6 space-y-5 max-w-xl">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-base)] flex items-center gap-2">
          {on ? <Monitor className="h-4 w-4 text-[var(--color-success)]" /> : <Globe className="h-4 w-4 text-[var(--text-muted)]" />}
          Desktop-only Entries — {lock ? (on ? 'ON' : 'OFF') : '…'}
        </h3>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          When ON, bills, vouchers and masters are entered only on the office desktop. The web still
          shows every report, ledger and bill, but cannot save, edit or delete entries. This keeps the
          desktop and the web exactly equal, even when the desktop works without internet.
        </p>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {lock && (
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
          {canEdit ? (
            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving || on}
                onClick={() => change(true)}
                className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-40"
              >
                Turn ON
              </button>
              <button
                type="button"
                disabled={saving || !on}
                onClick={() => change(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-base)] text-sm font-semibold disabled:opacity-40"
              >
                Turn OFF
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Only the Owner or an Admin can change this.</p>
          )}
          {lock.changedAt && (
            <p className="text-xs text-[var(--text-muted)]">
              Last changed {new Date(lock.changedAt).toLocaleString('en-IN')}{lock.changedBy ? ` by ${lock.changedBy}` : ''}
            </p>
          )}
          {!on && (
            <p className="text-xs text-[var(--color-warning)]">
              While OFF: if the web and an offline desktop both make a bill at the same time they can take
              the same bill number, and a bill deleted on the web stays on the desktop. Keep it ON for daily work.
            </p>
          )}
        </div>
      )}

      {onDesktop && sync && (
        <div className="rounded-lg border border-[var(--border)] p-4 text-sm space-y-1">
          <p className="font-medium text-[var(--text-base)]">This computer</p>
          <p className="text-[var(--text-muted)]">Waiting to upload: <b>{sync.pending}</b></p>
          <p className="text-[var(--text-muted)]">
            Last upload: {sync.lastPushAt ? new Date(sync.lastPushAt).toLocaleString('en-IN') : 'never'}
          </p>
          {sync.lastError && <p className="text-[var(--color-warning)]">{sync.lastError}</p>}
          {sync.failing?.length > 0 && (
            <p className="text-[var(--color-danger)]">
              {sync.failing.length} entr{sync.failing.length === 1 ? 'y was' : 'ies were'} refused by the cloud: {sync.failing[0].message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
