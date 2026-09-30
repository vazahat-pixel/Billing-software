import { get, post, unwrap } from './http';

export const reportApi = {
  bundle: (params) => unwrap(get('/reports/bundle', params)),
  sales: (params) => unwrap(get('/reports/sales', params)),
  purchases: (params) => unwrap(get('/reports/purchases', params)),
  stock: (params) => unwrap(get('/reports/stock', params)),
  outstanding: (params) => unwrap(get('/reports/outstanding', params)),
  outstandingFilterOptions: (params) => unwrap(get('/reports/outstanding/filter-options', params)),
  pl: (params) => unwrap(get('/reports/pl', params)),
  jobwork: (params) => unwrap(get('/reports/jobwork', params)),
  stockLedger: (params) => unwrap(get('/reports/stock-ledger', params)),
  daily: (params) => unwrap(get('/reports/daily', params)),
  masters: (params) => unwrap(get('/reports/masters', params)),
  ledgerInterest: (params) => unwrap(get('/reports/ledger-interest', params)),
  confirmation: (params) => unwrap(get('/reports/confirmation', params)),
  aboveBelow: (params) => unwrap(get('/reports/above-below', params)),
  diffOpening: (params) => unwrap(get('/reports/diff-opening', params)),
  diffYear: (params) => unwrap(get('/reports/diff-ledger', params)),
  importBank: (body) => unwrap(post('/reports/import-bank', body)),
};

/** @deprecated alias */
export const reportsApi = reportApi;

export default reportApi;
