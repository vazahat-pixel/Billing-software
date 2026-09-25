import React, { useEffect, useState } from 'react';
import ToastHost from '../components/ui/ToastHost';
import ConfirmDialogHost from '../components/ui/ConfirmDialogHost';
import CommandPalette from '../components/CommandPalette';
import NotificationCenter from '../components/NotificationCenter';
import ThemeProvider from '../theme/ThemeProvider';
import useConfigStore from '../store/useConfigStore';
import useStore from '../store/useStore';
import useUiStore from '../store/useUiStore';
import { useFormEnterNavigation } from '../hooks/useFormEnterNavigation';
import { installBrowserDialogGuard } from '../utils/browserDialogGuard';
import { stage6Api } from '../api/stage6.api';
import { consumeSupportSession } from '../utils/supportSession';

/**
 * App-level providers glue — keeps existing Router in App.jsx.
 */
export function AppProviders({ children }) {
  const user = useStore((s) => s.user);
  const plan = useStore((s) => s.plan);
  const token = useStore((s) => s.token);
  const restoreSession = useStore((s) => s.restoreSession);
  const hydrateFromAuth = useConfigStore((s) => s.hydrateFromAuth);
  const resetConfig = useConfigStore((s) => s.reset);
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const commandPaletteOpen = useUiStore((s) => s.commandPaletteOpen);
  const setNotificationUnread = useUiStore((s) => s.setNotificationUnread);
  const [bootDone, setBootDone] = useState(false);

  useFormEnterNavigation(!commandPaletteOpen);

  useEffect(() => {
    installBrowserDialogGuard();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const setAuthFn = useStore.getState().setAuth;
      const applied = await consumeSupportSession(setAuthFn);
      if (!cancelled && !applied) {
        await restoreSession();
      }
      if (!cancelled) setBootDone(true);
    })();
    return () => { cancelled = true; };
  }, [restoreSession]);

  useEffect(() => {
    if (token && user) {
      hydrateFromAuth(user, plan || user.plan);
    } else if (!token) {
      resetConfig();
    }
  }, [token, user, plan, hydrateFromAuth, resetConfig]);

  useEffect(() => {
    if (!token || !user) return;
    stage6Api
      .notifUnread()
      .then((d) => setNotificationUnread(d?.count || 0))
      .catch(() => {});
    const t = setInterval(() => {
      stage6Api
        .notifUnread()
        .then((d) => setNotificationUnread(d?.count || 0))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [token, user, setNotificationUnread]);

  useEffect(() => {
    const onKey = (e) => {
      const key = String(e.key).toLowerCase();
      if (user?.companyRole === 'ca') return;
      if ((e.ctrlKey || e.metaKey) && (key === 'k' || e.code === 'Space' || key === ' ')) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCommandPalette, user?.companyRole]);

  if (!bootDone) {
    return (
      <ThemeProvider>
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading session...</p>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      {children}
      <ToastHost />
      <ConfirmDialogHost />
      <CommandPalette />
      <NotificationCenter />
    </ThemeProvider>
  );
}

export default AppProviders;
