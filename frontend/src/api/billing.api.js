import { get, post, unwrap } from './http';

export const billingApi = {
  publicPlans: () => unwrap(get('/billing/public/plans', undefined, { skipAuthRedirect: true, silent: true })),
  me: () => unwrap(get('/billing/me')),
  checkout: (body) => unwrap(post('/billing/checkout', body)),
  confirm: (body) => unwrap(post('/billing/confirm', body)),
};

export default billingApi;
