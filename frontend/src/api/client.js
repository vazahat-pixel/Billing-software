import axios from 'axios';
import { isOffline, markServerReachable, markServerUnreachable } from '../utils/networkStatus';
import { isNetworkError } from '../utils/offlineHelpers';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window === 'undefined') return '/api';
  return window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
};

const client = axios.create({
  baseURL: getBaseUrl(),
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const hasStoredSession = () =>
  !!(localStorage.getItem('token') && localStorage.getItem('user'));

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // WiFi off — skip waiting for hung requests; use IndexedDB instead
  if (isOffline() && !config.forceNetwork) {
    const err = new Error('Network Error');
    err.code = 'ERR_NETWORK';
    err.config = config;
    err.isOfflineBlocked = true;
    return Promise.reject(err);
  }

  return config;
});

client.interceptors.response.use(
  (response) => {
    markServerReachable();
    return response;
  },
  (error) => {
    if (isNetworkError(error)) {
      markServerUnreachable();
    }

    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      const url = String(error.config?.url || '');
      const isAuthMe = url.includes('/auth/me');

      if (isOffline() || (hasStoredSession() && !isAuthMe)) {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
