import React, { useEffect } from 'react';
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

  useFormEnterNavigation(!commandPaletteOpen);

  useEffect(() => {
    installBrowserDialogGuard();
  }, []);

  useEffect(() => {
    restoreSession();
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
      if ((e.ctrlKey || e.metaKey) && (key === 'k' || e.code === 'Space' || key === ' ')) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCommandPalette]);

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
