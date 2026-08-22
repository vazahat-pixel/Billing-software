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
  me: () => unwrap(get('/auth/me', undefined, { skipAuthRedirect: true, forceNetwork: true, silent: true })),
  forgotPassword: (payload) => unwrap(post('/auth/forgot-password', payload)),
  resetPassword: (payload) => unwrap(post('/auth/reset-password', payload)),
};

export default authApi;
