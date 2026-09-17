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
    if (typeof window.textileDesktop?.isLocalSync === 'function') {
      return window.textileDesktop.isLocalSync() !== false;
    }
    if (typeof window.textileDesktop?.isLocal === 'boolean') {
      return window.textileDesktop.isLocal;
    }
  } catch {
    /* ignore */
  }
  // Packaged desktop defaults to local standalone
  return import.meta.env.VITE_DESKTOP === '1';
}

/** True when sync-queue / IDB should NOT be used as write path */
export function useLocalApiAsSourceOfTruth() {
  return isDesktopLocalMode();
}
