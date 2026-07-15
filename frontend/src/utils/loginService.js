import api from '../api/client';
import { isOffline, isNetworkError } from './offlineHelpers';
import { saveOfflineCredential, tryOfflineLogin } from './offlineAuth';

/**
 * Login online when possible; fall back to verified offline credentials.
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

  if (isOffline()) {
    const session = await tryOfflineLogin(emailNorm, password, { adminOnly });
    return { token: session.token, user: assertRole(session.user) };
  }

  try {
    const response = await api.post('/auth/login', { email: emailNorm, password }, { skipAuthRedirect: true });
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
    if (isNetworkError(err)) {
      const session = await tryOfflineLogin(emailNorm, password, { adminOnly });
      return { token: session.token, user: assertRole(session.user) };
    }
    const message = err.response?.data?.message || err.message || 'Login failed';
    throw new Error(message);
  }
};
