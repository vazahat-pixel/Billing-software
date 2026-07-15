import { get, post, put, del, unwrap } from './http';

export const authApi = {
  login: (payload) => unwrap(post('/auth/login', payload)),
  register: (payload) => unwrap(post('/auth/register', payload)),
  me: () => unwrap(get('/auth/me', undefined, { skipAuthRedirect: true, forceNetwork: true, silent: true })),
  forgotPassword: (payload) => unwrap(post('/auth/forgot-password', payload)),
  resetPassword: (payload) => unwrap(post('/auth/reset-password', payload)),
};

export default authApi;
