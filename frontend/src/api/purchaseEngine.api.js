import { get, post, unwrap, asArray } from './http';

/**
 * Sprint 2.2 Purchase Engine API — Indent → Quote → PO → GRN → QC → Invoice
 */
export const purchaseEngineApi = {
  pipeline: () => unwrap(get('/purchase-engine/pipeline')),

  listIndents: (params) => unwrap(get('/purchase-engine/indents', params)).then((d) => asArray(d)),
  createIndent: (body) => unwrap(post('/purchase-engine/indents', body)),
  submitIndent: (id) => unwrap(post(`/purchase-engine/indents/${id}/submit`)),
  approveIndent: (id, approve = true) => unwrap(post(`/purchase-engine/indents/${id}/approve`, { approve })),

  listQuotations: (params) => unwrap(get('/purchase-engine/quotations', params)).then((d) => asArray(d)),
  createQuotation: (body) => unwrap(post('/purchase-engine/quotations', body)),
  compareQuotations: (indentId) => unwrap(get(`/purchase-engine/quotations/compare/${indentId}`)),
  selectQuotation: (id) => unwrap(post(`/purchase-engine/quotations/${id}/select`)),

  listOrders: (params) => unwrap(get('/purchase-engine/orders', params)).then((d) => asArray(d)),
  createOrder: (body) => unwrap(post('/purchase-engine/orders', body)),
  approveOrder: (id, approve = true) => unwrap(post(`/purchase-engine/orders/${id}/approve`, { approve })),

  listGrns: (params) => unwrap(get('/purchase-engine/grns', params)).then((d) => asArray(d)),
  createGrn: (body) => unwrap(post('/purchase-engine/grns', body)),
  performQc: (id, body) => unwrap(post(`/purchase-engine/grns/${id}/qc`, body)),
  convertToInvoice: (id, body) => unwrap(post(`/purchase-engine/grns/${id}/invoice`, body)),
};

export default purchaseEngineApi;
