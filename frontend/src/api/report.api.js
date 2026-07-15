import { get, unwrap } from './http';

export const reportApi = {
  bundle: (params) => unwrap(get('/reports/bundle', params)),
  sales: (params) => unwrap(get('/reports/sales', params)),
  purchases: (params) => unwrap(get('/reports/purchases', params)),
  stock: (params) => unwrap(get('/reports/stock', params)),
  outstanding: (params) => unwrap(get('/reports/outstanding', params)),
  pl: (params) => unwrap(get('/reports/pl', params)),
  jobwork: (params) => unwrap(get('/reports/jobwork', params)),
  daily: (params) => unwrap(get('/reports/daily', params)),
  masters: (params) => unwrap(get('/reports/masters', params)),
};

/** @deprecated alias */
export const reportsApi = reportApi;

export default reportApi;
