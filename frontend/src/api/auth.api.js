import { get, post, put, del, unwrap } from './http';
import { getDeviceIdentity } from '../utils/deviceIdentity';

export const authApi = {
  // Licence binding needs the machine identity at login; resolving it must
  // never block the attempt, so a failure just sends the credentials alone.
  login: async (payload) => {
    let identity = {};
    try {
      identity = await getDeviceIdentity();
    } catch {
      /* backend treats a missing deviceId as unbound */
    }
    return unwrap(post('/auth/login', { ...payload, ...identity }));
  },
  register: (payload) => unwrap(post('/auth/register', payload)),
  // /auth/me returns { user }, not the usual { data } envelope. unwrap()
  // therefore hands back the wrapper; callers need the inner profile.
  me: async () => {
    const body = await unwrap(get('/auth/me', undefined, { skipAuthRedirect: true, forceNetwork: true, silent: true }));
    if (body && typeof body === 'object' && body.user && typeof body.user === 'object') {
      return body.user;
    }
    return body;
  },
  changePassword: (payload) => unwrap(post('/auth/change-password', payload)),
  forgotPassword: (payload) => unwrap(post('/auth/forgot-password', payload)),
  resetPassword: (payload) => unwrap(post('/auth/reset-password', payload)),
};

export default authApi;
