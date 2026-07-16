import React, { useEffect } from 'react';
import ToastHost from '../components/ui/ToastHost';
import CommandPalette from '../components/CommandPalette';
import useConfigStore from '../store/useConfigStore';
import useStore from '../store/useStore';
import useUiStore from '../store/useUiStore';
import { useFormEnterNavigation } from '../hooks/useFormEnterNavigation';

/**
 * App-level providers glue — keeps existing Router in App.jsx.
 * Bridges auth → config store and registers Ctrl+K shortcut.
 * Restores session early so ProtectedRoute never blocks AuthBootstrap.
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

  useFormEnterNavigation(!commandPaletteOpen);

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
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCommandPalette]);

  return (
    <>
      {children}
      <ToastHost />
      <CommandPalette />
    </>
  );
}

export default AppProviders;
