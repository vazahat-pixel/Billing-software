import axios from 'axios';
import { isOffline, markServerReachable, markServerUnreachable } from '../utils/networkStatus';
import { isNetworkError } from '../utils/offlineHelpers';
import { parseApiError } from '../utils/errors';

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
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
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

  const isAuthRequest = (config.url || '').includes('/auth/');
  if (isOffline() && !config.forceNetwork && !isAuthRequest && typeof navigator !== 'undefined' && !navigator.onLine) {
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
