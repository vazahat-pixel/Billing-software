import { get, post, unwrap, asArray } from './http';

/**
 * Sprint 2.5 Sales Engine — Quote → Order → Pack → Challan → Invoice → Return
 */
export const salesEngineApi = {
  pipeline: () => unwrap(get('/sales-engine/pipeline')),

  listQuotations: (params) => unwrap(get('/sales-engine/quotations', params)).then((d) => asArray(d)),
  createQuotation: (body) => unwrap(post('/sales-engine/quotations', body)),
  acceptQuotation: (id, accept = true) => unwrap(post(`/sales-engine/quotations/${id}/accept`, { accept })),
  convertQuotation: (id, body = {}) => unwrap(post(`/sales-engine/quotations/${id}/convert`, body)),

  listOrders: (params) => unwrap(get('/sales-engine/orders', params)).then((d) => asArray(d)),
  createOrder: (body) => unwrap(post('/sales-engine/orders', body)),
  approveOrder: (id, approve = true) => unwrap(post(`/sales-engine/orders/${id}/approve`, { approve })),
  updatePacking: (id, packingStatus) => unwrap(post(`/sales-engine/orders/${id}/packing`, { packingStatus })),

  listChallans: (params) => unwrap(get('/sales-engine/challans', params)).then((d) => asArray(d)),
  createChallan: (body) => unwrap(post('/sales-engine/challans', body)),
  convertChallanToInvoice: (id, body = {}) => unwrap(post(`/sales-engine/challans/${id}/invoice`, body)),

  createDirectInvoice: (body) => unwrap(post('/sales-engine/invoice', body)),
  createSalesReturn: (body) => unwrap(post('/sales-engine/returns', body)),
};

export default salesEngineApi;
