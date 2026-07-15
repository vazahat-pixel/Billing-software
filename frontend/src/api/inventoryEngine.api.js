import { get, post, unwrap, asArray } from './http';

/**
 * Sprint 2.3 Inventory Engine — availability, reservation, transfer, adjustment, ledger
 */
export const inventoryEngineApi = {
  pipeline: () => unwrap(get('/inventory-engine/pipeline')),

  availability: (params) => unwrap(get('/inventory-engine/availability', params)),
  stockLedger: (params) => unwrap(get('/inventory-engine/ledger', params)).then((d) => asArray(d)),
  lotLedger: (lotId) => unwrap(get(`/inventory-engine/lot/${lotId}/ledger`)),
  valuation: (itemId) => unwrap(get(`/inventory-engine/valuation/${itemId}`)),
  lowStock: () => unwrap(get('/inventory-engine/low-stock')).then((d) => asArray(d)),

  listReservations: (params) =>
    unwrap(get('/inventory-engine/reservations', params)).then((d) => asArray(d)),
  reserveStock: (body) => unwrap(post('/inventory-engine/reservations', body)),
  releaseReservation: (id, body = {}) => unwrap(post(`/inventory-engine/reservations/${id}/release`, body)),

  listTransfers: () => unwrap(get('/inventory-engine/transfers')).then((d) => asArray(d)),
  transferStock: (body) => unwrap(post('/inventory-engine/transfers', body)),

  listAdjustments: () => unwrap(get('/inventory-engine/adjustments')).then((d) => asArray(d)),
  createAdjustment: (body) => unwrap(post('/inventory-engine/adjustments', body)),
  postAdjustment: (id) => unwrap(post(`/inventory-engine/adjustments/${id}/post`)),

  setLotHold: (lotId, body) => unwrap(post(`/inventory-engine/lots/${lotId}/hold`, body)),
};

export default inventoryEngineApi;
