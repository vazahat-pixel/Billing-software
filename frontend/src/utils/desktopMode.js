/**
 * Desktop-local helpers — when Electron runs with embedded API, IndexedDB is cache-only
 * (not the system of record). Sync queue must not intercept writes.
 */

export function isDesktopShell() {
  if (typeof window === 'undefined') return false;
  return !!(
    window.textileDesktop?.isDesktop ||
    import.meta.env.VITE_DESKTOP === '1'
  );
}

export function isDesktopLocalMode() {
  if (!isDesktopShell()) return false;
  try {
    const mode =
      typeof window.textileDesktop?.getModeSync === 'function'
        ? window.textileDesktop.getModeSync()
        : window.textileDesktop?.mode;
    if (mode === 'remote') return false;
    if (mode === 'local' || mode === 'hybrid') return true;
  } catch {
    /* ignore */
  }
  try {
    if (typeof window.textileDesktop?.isLocalSync === 'function') {
      return window.textileDesktop.isLocalSync() !== false;
    }
    if (typeof window.textileDesktop?.isLocal === 'boolean') {
      return window.textileDesktop.isLocal;
    }
  } catch {
    /* ignore */
  }
  // Packaged desktop defaults to hybrid/local
  return import.meta.env.VITE_DESKTOP === '1';
}

export function isDesktopHybridMode() {
  if (!isDesktopShell()) return false;
  try {
    const mode =
      typeof window.textileDesktop?.getModeSync === 'function'
        ? window.textileDesktop.getModeSync()
        : window.textileDesktop?.mode;
    return mode === 'hybrid';
  } catch {
    return false;
  }
}

/** True when sync-queue / IDB should NOT be used as write path */
export function useLocalApiAsSourceOfTruth() {
  return isDesktopLocalMode();
}
