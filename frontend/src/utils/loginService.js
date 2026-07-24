import api from '../api/client';
import { saveOfflineCredential, tryOfflineLogin } from './offlineAuth';

/**
 * Login online when possible; fall back to verified offline credentials
 * ONLY when the browser itself reports no internet connectivity.
 */
export const loginWithOfflineSupport = async ({
  email,
  password,
  adminOnly = false
}) => {
  const emailNorm = email.trim().toLowerCase();

  const assertRole = (user) => {
    if (adminOnly && user.role !== 'super_admin') {
      throw new Error('Access denied: Not a super admin');
    }
    return user;
  };

  // Only use offline login when the browser itself has NO internet
  const browserHasNoInternet = typeof navigator !== 'undefined' && !navigator.onLine;
  if (browserHasNoInternet) {
    const session = await tryOfflineLogin(emailNorm, password, { adminOnly });
    return { token: session.token, user: assertRole(session.user) };
  }

  // Browser has internet — always attempt the real network login
  try {
    const response = await api.post('/auth/login', { email: emailNorm, password }, {
      skipAuthRedirect: true,
      forceNetwork: true,   // bypass any offline gate in Axios interceptor
    });
    const body = response.data || {};
    const payload = body.data && (body.data.token || body.data.user) ? body.data : body;
    const { token, user } = payload;
    if (!token || !user) {
      throw new Error(body.message || 'Login failed: invalid server response');
    }
    assertRole(user);
    await saveOfflineCredential(emailNorm, password, { token, user });
    return { token, user };
  } catch (err) {
    // Only silently fall back to offline if browser suddenly lost connectivity
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const session = await tryOfflineLogin(emailNorm, password, { adminOnly });
        return { token: session.token, user: assertRole(session.user) };
      } catch {
        // ignore offline fallback error, throw original
      }
    }
    // Throw the real server error message
    const message = err.response?.data?.message || err.message || 'Login failed. Please check your credentials.';
    throw new Error(message);
  }
};

