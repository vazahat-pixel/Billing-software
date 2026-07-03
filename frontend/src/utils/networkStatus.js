/** Real network state — WiFi off, server down, or browser offline */

let browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let serverReachable = true;
const listeners = new Set();
let initialized = false;

export const getNetworkStatus = () => ({
  browserOnline,
  serverReachable,
  isOffline: !browserOnline || !serverReachable
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
};

export const markServerUnreachable = () => {
  if (!serverReachable) return;
  serverReachable = false;
  notify();
};

export const markServerReachable = () => {
  if (!browserOnline) return;
  if (!serverReachable) {
    serverReachable = true;
    notify();
  }
};

export const initNetworkListeners = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const handleOnline = () => {
    browserOnline = true;
    serverReachable = true;
    notify();
  };

  const handleOffline = () => {
    browserOnline = false;
    serverReachable = false;
    notify();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
};

initNetworkListeners();
