import { get, post, put, unwrap, asArray } from './http';

/** Stage 4 Compliance Engine — /api/stage4/* */
export const stage4Api = {
  // Config
  getConfig: () => unwrap(get('/stage4/config')),
  updateConfig: (body) => unwrap(put('/stage4/config', body)),
  mapLedgers: () => unwrap(post('/stage4/config/map-ledgers')),
  periods: () => unwrap(get('/stage4/periods')).then((d) => asArray(d)),
  lockPeriod: (body) => unwrap(post('/stage4/periods/lock', body)),
  unlockPeriod: (body) => unwrap(post('/stage4/periods/unlock', body)),

  // Returns
  gstr1: (params) => unwrap(get('/stage4/returns/gstr1', params)),
  gstr3b: (params) => unwrap(get('/stage4/returns/gstr3b', params)),
  gstr9: (params) => unwrap(get('/stage4/returns/gstr9', params)),
  snapshotReturn: (body) => unwrap(post('/stage4/returns/snapshot', body)),
  exportReturn: (type, params) => unwrap(get(`/stage4/returns/export/${type}`, params)),

  // HSN
  hsnList: (params) => unwrap(get('/stage4/hsn', params)).then((d) => asArray(d)),
  hsnUpsert: (body) => unwrap(post('/stage4/hsn', body)),
  hsnSync: () => unwrap(post('/stage4/hsn/sync')),
  hsnSummary: (params) => unwrap(get('/stage4/hsn/summary', params)),

  // TDS/TCS
  tdsSections: () => unwrap(get('/stage4/tds/sections')),
  tdsCompute: (body) => unwrap(post('/stage4/tds/compute', body)),
  tdsPost: (body) => unwrap(post('/stage4/tds', body)),
  tcsPost: (body) => unwrap(post('/stage4/tcs', body)),
  tdsList: (params) => unwrap(get('/stage4/tds', params)).then((d) => asArray(d)),
  tdsReport: (params) => unwrap(get('/stage4/tds/report', params)),
  tdsCertificate: (id) => unwrap(post(`/stage4/tds/${id}/certificate`)),

  // E-Invoice / E-Way
  einvoiceList: (params) => unwrap(get('/stage4/einvoice', params)).then((d) => asArray(d)),
  einvoicePayload: (salesId) => unwrap(get(`/stage4/einvoice/payload/${salesId}`)),
  einvoiceGenerate: (body) => unwrap(post('/stage4/einvoice/generate', body)),
  einvoiceCancel: (id, body) => unwrap(post(`/stage4/einvoice/${id}/cancel`, body || {})),
  ewayList: (params) => unwrap(get('/stage4/eway', params)).then((d) => asArray(d)),
  ewayGenerate: (body) => unwrap(post('/stage4/eway/generate', body)),

  // CA Workspace
  caOverview: (params) => unwrap(get('/stage4/ca/overview', params)),
  caTrialBalance: (params) => unwrap(get('/stage4/ca/trial-balance', params)),
  caPL: (params) => unwrap(get('/stage4/ca/profit-loss', params)),
  caBS: (params) => unwrap(get('/stage4/ca/balance-sheet', params)),
  caJournals: (params) => unwrap(get('/stage4/ca/journals', params)),
  caLedger: (id, params) => unwrap(get(`/stage4/ca/ledgers/${id}`, params)),
  caGst: (params) => unwrap(get('/stage4/ca/gst', params)),
  caAuditPack: (params) => unwrap(get('/stage4/ca/audit-pack', params)),
  caExports: (params) => unwrap(get('/stage4/ca/exports', params)),

  // Reconciliation
  import2b: (body) => unwrap(post('/stage4/reconcile/2b/import', body)),
  reconcile2b: (id) => unwrap(post(`/stage4/reconcile/2b/${id}`)),
  fullReconcile: (params) => unwrap(get('/stage4/reconcile/full', params)),
  salesVsGstr1: (params) => unwrap(get('/stage4/reconcile/sales-gstr1', params)),

  // Dashboard + certification
  dashboard: (params) => unwrap(get('/stage4/dashboard', params)),
  filingCalendar: (params) => unwrap(get('/stage4/filing-calendar', params)),
  certificationRun: (body) => unwrap(post('/stage4/certification/run', body || {})),
  certificationLatest: () => unwrap(get('/stage4/certification/latest')),
  certificationList: () => unwrap(get('/stage4/certification')).then((d) => asArray(d)),
};

export default stage4Api;
