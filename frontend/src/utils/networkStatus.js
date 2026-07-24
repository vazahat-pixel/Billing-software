/** Real network state — WiFi off, API down, or sticky false-offline recovery */

let browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let serverReachable = true;
const listeners = new Set();
let initialized = false;
let probeTimer = null;
let probing = false;

const PROBE_MS = 4000;

export const getNetworkStatus = () => ({
  browserOnline,
  serverReachable,
  isOffline: !browserOnline || !serverReachable,
});

export const isOffline = () => getNetworkStatus().isOffline;

export const isBrowserOffline = () => !browserOnline;

export const subscribeNetworkStatus = (fn) => {
  listeners.add(fn);
  fn(getNetworkStatus());
  return () => listeners.delete(fn);
};

const notify = () => {
  const status = getNetworkStatus();
  listeners.forEach((fn) => fn(status));
  scheduleProbe();
};

export const markServerUnreachable = () => {
  if (!serverReachable) {
    scheduleProbe();
    return;
  }
  serverReachable = false;
  notify();
};

export const markServerReachable = () => {
  if (!browserOnline) return;
  if (!serverReachable) {
    serverReachable = true;
    notify();
  } else {
    serverReachable = true;
  }
};

export const getApiOrigin = () => {
  if (typeof window === 'undefined') return '';
  if (import.meta.env?.VITE_API_URL) {
    try {
      const u = new URL(import.meta.env.VITE_API_URL, window.location.origin);
      return u.origin;
    } catch {
      /* fall through */
    }
  }
  return window.location.origin;
};

/**
 * Lightweight health probe. Always allowed even when "offline"
 * so sticky false-offline can recover when WiFi + API are fine.
 */
export const probeServerReachability = async () => {
  if (probing) return getNetworkStatus();
  if (typeof window === 'undefined') return getNetworkStatus();

  browserOnline = navigator.onLine;
  if (!browserOnline) {
    if (serverReachable) {
      serverReachable = false;
      notify();
    }
    return getNetworkStatus();
  }

  probing = true;
  try {
    const origin = getApiOrigin();
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctrl?.abort(), 3500);
    
    let res;
    try {
      res = await fetch(`${origin}/api/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl?.signal,
      });
    } catch {
      /* try fallback */
    }
    if (!res || !res.ok) {
      res = await fetch(`${origin}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl?.signal,
      });
    }
    clearTimeout(t);
    if (res && (res.ok || (res.status >= 200 && res.status < 500))) {
      markServerReachable();
    } else {
      markServerUnreachable();
    }
  } catch {
    markServerUnreachable();
  } finally {
    probing = false;
  }
  return getNetworkStatus();
};

const scheduleProbe = () => {
  if (typeof window === 'undefined') return;
  if (probeTimer) return;
  if (browserOnline && serverReachable) return;

  probeTimer = setTimeout(async () => {
    probeTimer = null;
    if (!browserOnline || serverReachable) return;
    await probeServerReachability();
    if (browserOnline && !serverReachable) scheduleProbe();
  }, PROBE_MS);
};

export const initNetworkListeners = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const handleOnline = () => {
    browserOnline = true;
    // Don't assume API is up — probe immediately
    notify();
    probeServerReachability();
  };

  const handleOffline = () => {
    browserOnline = false;
    serverReachable = false;
    notify();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Startup + visibility: recover if tab was backgrounded while API came back
  probeServerReachability();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') probeServerReachability();
  });
};

initNetworkListeners();
