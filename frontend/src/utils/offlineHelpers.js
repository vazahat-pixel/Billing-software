import { canUseOfflineMode, getCompanySettings } from './featureAccess';
import {
  isOffline as networkIsOffline,
  isBrowserOffline,
  markServerUnreachable
} from './networkStatus';

export const isOffline = networkIsOffline;

export const isNetworkError = (err) => {
  if (isOffline() || isBrowserOffline()) return true;
  if (!err) return false;
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') return true;
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) return true;
  if (!err.response && err.request) return true;
  if (err.isOfflineBlocked) return true;
  return false;
};

export const handleNetworkFailure = (err) => {
  if (isNetworkError(err)) markServerUnreachable();
};

const OFFLINE_FLAG_KEY = 'offlineEnabled';

export const persistOfflineFlag = (user, plan) => {
  if (!user) {
    localStorage.removeItem(OFFLINE_FLAG_KEY);
    return false;
  }
  const effectivePlan = plan || user.plan;
  const settings = getCompanySettings(user);
  // Default: allow offline for all logged-in users unless explicitly disabled
  const enabled = canUseOfflineMode(effectivePlan, settings);
  localStorage.setItem(OFFLINE_FLAG_KEY, enabled ? 'true' : 'false');
  return enabled;
};

export const readOfflineEnabled = () =>
  localStorage.getItem(OFFLINE_FLAG_KEY) === 'true';

/**
 * Any authenticated user can save data offline.
 * Only unauthenticated users are blocked.
 */
export const canSaveOffline = (get) => {
  const { user, token } = get();
  if (!user || !token) return false;
  return true;
};
