import api from '../api/client';
import { saveOfflineCredential, tryOfflineLogin } from './offlineAuth';
import { getDeviceIdentity } from './deviceIdentity';
import { isDesktopLocalMode } from './desktopMode';

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

  // Desktop hybrid mode: first check if local DB needs activation (empty DB),
  // then do normal local login. Falls back to offline IndexedDB when offline.
  if (isDesktopLocalMode()) {
    const browserHasNoInternet = typeof navigator !== 'undefined' && !navigator.onLine;

    if (browserHasNoInternet) {
      // Fully offline: use IndexedDB-cached credentials
      const session = await tryOfflineLogin(emailNorm, password, { adminOnly });
      return { token: session.token, user: assertRole(session.user) };
    }

    // Online + desktop local: try normal local API login first
    try {
      const response = await api.post('/auth/login', { email: emailNorm, password, ...(totpCode ? { totpCode } : {}) }, { skipAuthRedirect: true, forceNetwork: true });
      const body = response.data || {};
      if (body.requires2fa || body.code === 'TOTP_REQUIRED') {
        const err = new Error(body.message || 'Two-factor code required');
        err.requires2fa = true;
        throw err;
      }
      const payload = body.data && (body.data.token || body.data.user) ? body.data : body;
      if (payload.token && payload.user) {
        assertRole(payload.user);
        try { await saveOfflineCredential(emailNorm, password, { token: payload.token, user: payload.user }); } catch { /* ignore */ }
        return { token: payload.token, user: payload.user };
      }
    } catch (localErr) {
      if (localErr.requires2fa) throw localErr;
      // 401 = user not found → try auto-activate (first run on this device)
      const isNotFound = !localErr.response || localErr.response?.status === 401 || localErr.response?.status === 404;
      if (!isNotFound) throw localErr;
    }

    // Auto-activate: local DB has no user yet — provision from cloud credentials
    try {
      let identity = {};
      try { identity = await getDeviceIdentity(); } catch { /* ok */ }
      const actRes = await api.post('/desktop/auto-activate', {
        email: emailNorm,
        password,
        deviceId: identity.deviceId,
        deviceName: identity.deviceName || 'Textile ERP Desktop',
      }, { skipAuthRedirect: true, forceNetwork: true });
      const actBody = actRes.data?.data || actRes.data || {};
      if (actBody.token && actBody.user) {
        assertRole(actBody.user);
        try { await saveOfflineCredential(emailNorm, password, { token: actBody.token, user: actBody.user }); } catch { /* ignore */ }
        return { token: actBody.token, user: actBody.user };
      }
    } catch (actErr) {
      if (actErr.requires2fa) throw actErr;
      throw new Error(actErr.response?.data?.message || actErr.message || 'Login failed');
    }
  }

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
    // 30-day refresh token: lets the app renew the 8-hour access token instead of logging out.
    if (payload.refreshToken) localStorage.setItem('refreshToken', payload.refreshToken);
    else localStorage.removeItem('refreshToken');
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
    // Fall back to the saved offline login when the server gave no answer at all — browser
    // offline, or connected but the server unreachable (ISP / server down). A wrong password
    // or any other server reply still fails normally.
    if (!err.response || (typeof navigator !== 'undefined' && !navigator.onLine)) {
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
