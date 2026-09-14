import api from '../api/client';
import { saveOfflineCredential, tryOfflineLogin } from './offlineAuth';
import { getDeviceIdentity } from './deviceIdentity';

/**
 * Login online when possible; fall back to verified offline credentials
 * ONLY when the browser itself reports no internet connectivity.
 */
export const loginWithOfflineSupport = async ({
  email,
  password,
  totpCode,
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
    let identity = {};
    try {
      identity = await getDeviceIdentity();
    } catch {
      /* backend accepts unbound clients */
    }

    const response = await api.post('/auth/login', {
      email: emailNorm,
      password,
      ...(totpCode ? { totpCode } : {}),
      ...identity,
    }, {
      skipAuthRedirect: true,
      forceNetwork: true,   // bypass any offline gate in Axios interceptor
    });
    const contentType = String(response.headers?.['content-type'] || '');
    if (contentType.includes('text/html')) {
      throw new Error(
        'API not reachable on this host (got HTML instead of JSON). On Vercel set Root Directory to repo root, enable api/index.js, and add MONGO_URI + JWT_SECRET (32+ chars).'
      );
    }
    const body = response.data || {};
    if (body.requires2fa || body.code === 'TOTP_REQUIRED') {
      const err = new Error(body.message || 'Two-factor code required');
      err.requires2fa = true;
      throw err;
    }
    const payload = body.data && (body.data.token || body.data.user) ? body.data : body;
    const { token, user } = payload;
    if (!token || !user) {
      throw new Error(body.message || 'Login failed: invalid server response');
    }
    assertRole(user);
    // IndexedDB can throw "Internal error." in Electron — never block online login.
    try {
      await saveOfflineCredential(emailNorm, password, { token, user });
    } catch (offlineErr) {
      console.warn('[login] offline credential save skipped:', offlineErr?.message || offlineErr);
    }
    return { token, user };
  } catch (err) {
    if (err.requires2fa) throw err;
    if (err.response?.data?.requires2fa || err.response?.data?.code === 'TOTP_REQUIRED') {
      const e = new Error(err.response.data.message || 'Two-factor code required');
      e.requires2fa = true;
      throw e;
    }
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
