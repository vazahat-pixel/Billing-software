import { get, post, put, del, unwrap, asArray } from './http';

export const booksApi = {
  list: () => unwrap(get('/books')).then((d) => asArray(d, ['books'])),
  byModule: (moduleName) => unwrap(get(`/books/module/${moduleName}`)).then((d) => asArray(d, ['books'])),
  create: (body) => unwrap(post('/books', body)),
  remove: (id) => unwrap(del(`/books/${id}`)),
};

export const configApi = {
  active: (config) => unwrap(get('/config/active', undefined, config)),
  version: (config) => unwrap(get('/config/version', undefined, config)),
};

export const usersApi = {
  list: () => unwrap(get('/users')).then((d) => asArray(d, ['users'])),
  create: (body) => unwrap(post('/users', body)),
  update: (id, body) => unwrap(put(`/users/${id}`, body)),
  remove: (id) => unwrap(del(`/users/${id}`)),
};

export const visitsApi = {
  list: () => unwrap(get('/visits')).then((d) => asArray(d, ['visits'])),
  get: (id) => unwrap(get(`/visits/${id}`)),
  create: (body) => unwrap(post('/visits', body)),
};

export const ordersApi = {
  list: (params) => unwrap(get('/orders', params)).then((d) => asArray(d, ['orders'])),
  create: (body) => unwrap(post('/orders', body)),
  updateStatus: (id, status) => unwrap(put(`/orders/${id}/status`, { status })),
};

export const returnsApi = {
  list: (params) => unwrap(get('/returns', params)).then((d) => asArray(d, ['returns'])),
  create: (body) => unwrap(post('/returns', body)),
};

export const notesApi = {
  list: (params) => unwrap(get('/notes', params)).then((d) => asArray(d, ['notes'])),
  create: (body) => unwrap(post('/notes', body)),
};

export const subMastersApi = {
  list: (params) => unwrap(get('/submasters', params)).then((d) => asArray(d, ['submasters'])),
  create: (body) => unwrap(post('/submasters', body)),
  update: (id, body) => unwrap(put(`/submasters/${id}`, body)),
  remove: (id) => unwrap(del(`/submasters/${id}`)),
};

export const warehousesApi = {
  list: (params) => unwrap(get('/warehouses', params)).then((d) => asArray(d, ['warehouses'])),
  create: (body) => unwrap(post('/warehouses', body)),
  update: (id, body) => unwrap(put(`/warehouses/${id}`, body)),
  remove: (id) => unwrap(del(`/warehouses/${id}`)),
};

export const masterDataApi = {
  mergeParties: (body) => unwrap(post('/masters/merge/parties', body)),
  mergeItems: (body) => unwrap(post('/masters/merge/items', body)),
  importRows: (body) => unwrap(post('/masters/import', body)),
  exportRows: (entity) => unwrap(get('/masters/export', { entity })),
  listFinancialYears: () => unwrap(get('/masters/financial-years')).then((d) => asArray(d)),
  createFinancialYear: (body) => unwrap(post('/masters/financial-years', body)),
  activateFinancialYear: (id) => unwrap(put(`/masters/financial-years/${id}/activate`)),
  listVoucherSeries: (params) => unwrap(get('/masters/voucher-series', params)).then((d) => asArray(d)),
  createVoucherSeries: (body) => unwrap(post('/masters/voucher-series', body)),
};

export default {
  booksApi,
  configApi,
  usersApi,
  visitsApi,
  ordersApi,
  returnsApi,
  notesApi,
  subMastersApi,
  warehousesApi,
  masterDataApi,
};
