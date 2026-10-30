import axios from 'axios';
import { isOffline, markServerReachable, markServerUnreachable } from '../utils/networkStatus';
import { isNetworkError } from '../utils/offlineHelpers';
import { parseApiError } from '../utils/errors';
import { getCachedDeviceIdentity } from '../utils/deviceIdentity';

let activeRequests = 0;
let activeMutatingRequests = 0;
const apiLoadingListeners = new Set();

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export const onApiLoadingChange = (listener) => {
  apiLoadingListeners.add(listener);
  listener(activeRequests > 0, activeMutatingRequests > 0);
  return () => {
    apiLoadingListeners.delete(listener);
  };
};

const notifyListeners = () => {
  const isLoading = activeRequests > 0;
  const isMutating = activeMutatingRequests > 0;
  apiLoadingListeners.forEach((listener) => {
    try {
      listener(isLoading, isMutating);
    } catch (e) {
      console.error('[client] Error in loading listener:', e);
    }
  });
};

const updateActiveRequests = (delta, isMutating = false) => {
  activeRequests = Math.max(0, activeRequests + delta);
  if (isMutating) {
    activeMutatingRequests = Math.max(0, activeMutatingRequests + delta);
  }
  // Guard against stuck SAVING… badge from unbalanced counters
  if (activeRequests === 0) activeMutatingRequests = 0;
  notifyListeners();
};

/** Reset stuck loading badge (e.g. after offline recovery) */
export const resetApiLoadingState = () => {
  activeRequests = 0;
  activeMutatingRequests = 0;
  notifyListeners();
};

const getBaseUrl = () => {
  // Electron desktop — runtime config (userData/config.json) wins
  try {
    if (typeof window !== 'undefined' && window.textileDesktop?.getApiBaseUrlSync) {
      const desktopUrl = window.textileDesktop.getApiBaseUrlSync();
      if (desktopUrl) return String(desktopUrl).replace(/\/$/, '');
    }
  } catch {
    /* ignore */
  }

  const envUrl = import.meta.env?.VITE_API_URL;
  if (envUrl) {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocalHost && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
        return '/api';
      }
    }
    return String(envUrl).replace(/\/$/, '');
  }
  return '/api';
};

const client = axios.create({
  baseURL: getBaseUrl(),
  // Vercel serverless + Mongo cold start often exceeds 8s
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const hasStoredSession = () =>
  !!(localStorage.getItem('token') && localStorage.getItem('user'));

// --- Session refresh ----------------------------------------------------------------------------
// The access token lives 8 h; login also issues a 30-day refresh token. On a 401 the client trades
// the refresh token for a new access token once and replays the request, so a desktop left open all
// day never fails a save at the 8-hour mark. Only when the refresh itself is refused (idle
// overnight, revoked) is 'erp-session-expired' raised, and the user logs in again over the open
// screen — the half-filled bill and the offline queue stay.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/register', '/auth/forgot-password',
  '/auth/reset-password', '/auth/send-registration-otp', '/auth/verify-registration-otp'];
let refreshInFlight = null;

/** companyId inside a JWT (payload only, no verification — the server verifies). */
const tokenCompanyId = (token) => {
  try {
    const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part)).companyId || null;
  } catch {
    return null;
  }
};

const sessionExpired = (message) => Object.assign(new Error(message), { sessionExpired: true });

export const refreshAccessToken = () => {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return Promise.reject(sessionExpired('No refresh token — please log in again'));
  refreshInFlight = client
    .request({
      method: 'post',
      url: '/auth/refresh',
      data: { refreshToken },
      _skipRefresh: true,
      skipAuthRedirect: true,
      forceNetwork: true,
      silent: true,
    })
    .then((res) => {
      const { token, refreshToken: next } = res.data || {};
      if (!token) throw sessionExpired('Session refresh failed');
      // Never continue in another company than the one open on screen.
      const active = localStorage.getItem('offlineCompanyId'); // offlineDB COMPANY_KEY
      const fresh = tokenCompanyId(token);
      if (active && fresh && String(active) !== String(fresh)) {
        throw sessionExpired('Company changed — please log in again');
      }
      localStorage.setItem('token', token);
      if (next) localStorage.setItem('refreshToken', next);
      window.dispatchEvent(new CustomEvent('erp-token-refreshed', { detail: { token } }));
      return token;
    })
    .catch((err) => {
      if (err?.sessionExpired || err?.response?.status === 401) {
        // Another tab may have rotated the token a moment earlier: use what it stored.
        const stored = localStorage.getItem('refreshToken');
        if (stored && stored !== refreshToken && !err.message?.startsWith('Company changed')) {
          return localStorage.getItem('token');
        }
        if (stored === refreshToken) localStorage.removeItem('refreshToken');
        throw Object.assign(err, { sessionExpired: true });
      }
      throw err; // network trouble: keep the refresh token and try again later
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};

client.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  const mutating = MUTATING_METHODS.has(method);
  const silent = !!config.silent;
  config._isMutating = mutating;
  config._silent = silent;
  if (mutating) config._noRetry = true;
  if (!silent) {
    updateActiveRequests(1, mutating);
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (!config.headers['X-Request-Id']) {
    config.headers['X-Request-Id'] =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // A create that carries an operationId is applied once on the server even if it is sent again
  // (reply lost, then saved offline and re-sent by the sync queue).
  const opId = config.data && typeof config.data === 'object' ? config.data.operationId : null;
  if (opId && String(config.method).toLowerCase() === 'post' && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = String(opId);
  }

  // Licence device binding — read from cache only, so this stays synchronous.
  const deviceIdentity = getCachedDeviceIdentity();
  if (deviceIdentity?.deviceId) {
    config.headers['X-Device-Id'] = deviceIdentity.deviceId;
    if (deviceIdentity.deviceFingerprint) {
      config.headers['X-Device-Fingerprint'] = deviceIdentity.deviceFingerprint;
    }
  }

  // Refresh desktop baseURL if running inside Electron shell
  if (typeof window !== 'undefined' && window.textileDesktop?.getApiBaseUrlSync) {
    try {
      const desktopUrl = window.textileDesktop.getApiBaseUrlSync();
      if (desktopUrl && (!config.baseURL || config.baseURL === '/api' || config.baseURL.includes('dealingindia.com'))) {
        config.baseURL = String(desktopUrl).replace(/\/$/, '');
      }
    } catch {
      /* ignore */
    }
  }

  const isAuthRequest = (config.url || '').includes('/auth/');
  const currentBase = String(config.baseURL || getBaseUrl() || '');
  const isLocalApi =
    (typeof window !== 'undefined' && !!window.textileDesktop) ||
    currentBase.includes('127.0.0.1') ||
    currentBase.includes('localhost') ||
    import.meta.env.VITE_DESKTOP === '1';

  if (!isLocalApi && isOffline() && !config.forceNetwork && !isAuthRequest && typeof navigator !== 'undefined' && !navigator.onLine) {
    if (!silent) updateActiveRequests(-1, mutating);
    const err = new Error('Network Error');
    err.code = 'ERR_NETWORK';
    err.config = config;
    err.isQueueBlocked = true;
    return Promise.reject(err);
  }

  return config;
});

client.interceptors.response.use(
  (response) => {
    const cfg = response.config || {};
    const mutating = cfg._isMutating || false;
    if (!cfg._silent) updateActiveRequests(-1, mutating);
    markServerReachable();
    return response;
  },
  async (error) => {
    const cfg = error.config || {};
    const mutating = cfg._isMutating || false;
    if (!cfg._silent) updateActiveRequests(-1, mutating);

    if (error.response) {
      markServerReachable();
    } else if (isNetworkError(error)) {
      markServerUnreachable();
    }

    const method = (cfg.method || 'get').toLowerCase();
    if (
      method === 'get' &&
      !cfg._noRetry &&
      !cfg.__retried &&
      !isOffline() &&
      (isNetworkError(error) || (error.response && error.response.status >= 500))
    ) {
      cfg.__retried = true;
      return client.request(cfg);
    }

    // Expired access token: refresh once and replay the same request.
    const reqUrl = String(cfg.url || '');
    if (
      error.response?.status === 401 &&
      !cfg._skipRefresh &&
      !cfg.__refreshed &&
      localStorage.getItem('token') &&
      !AUTH_ENDPOINTS.some((p) => reqUrl.includes(p))
    ) {
      try {
        const token = await refreshAccessToken();
        cfg.__refreshed = true;
        cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
        return client.request(cfg);
      } catch (refreshErr) {
        if (refreshErr?.sessionExpired) {
          window.dispatchEvent(new CustomEvent('erp-session-expired', { detail: { message: refreshErr.message } }));
        }
        // fall through: reject with the original 401
      }
    }

    if (error.response?.status === 401 && !cfg.skipAuthRedirect) {
      const url = String(cfg.url || '');
      const isAuthMe = url.includes('/auth/me');
      if (isOffline() || (hasStoredSession() && !isAuthMe)) {
        return Promise.reject(error);
      }
    }

    error.friendlyMessage = parseApiError(error);
    return Promise.reject(error);
  }
);

export default client;
