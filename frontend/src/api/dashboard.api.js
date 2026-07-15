import { get, unwrap } from './http';

/** Tenant dashboard KPIs — computed on backend */
export const dashboardApi = {
  summary: (params) => unwrap(get('/dashboard/summary', params)),
};

export default dashboardApi;
