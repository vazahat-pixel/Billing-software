import { get, post, unwrap, asArray } from './http';

/**
 * Sprint 2.6 Business Automation Engine
 */
export const businessAutomationApi = {
  pipeline: () => unwrap(get('/business-automation/pipeline')),
  seedDefaults: () => unwrap(post('/business-automation/seed')),

  listRules: () => unwrap(get('/business-automation/rules')).then((d) => asArray(d)),
  upsertRule: (body) => unwrap(post('/business-automation/rules', body)),

  evaluateApproval: (body) => unwrap(post('/business-automation/evaluate-approval', body)),
  checkDuplicates: (body) => unwrap(post('/business-automation/check-duplicates', body)),

  listSeries: (params) => unwrap(get('/business-automation/series', params)).then((d) => asArray(d)),
  allocateNumber: (body) => unwrap(post('/business-automation/series/allocate', body)),

  listNotifications: (params) =>
    unwrap(get('/business-automation/notifications', params)).then((d) => asArray(d)),
  markRead: (id) => unwrap(post(`/business-automation/notifications/${id}/read`)),

  getOutstanding: (params) => unwrap(get('/business-automation/outstanding', params)),
  runLowStockScan: () => unwrap(post('/business-automation/scans/low-stock')),
  runOverdueScan: () => unwrap(post('/business-automation/scans/overdue')),

  listProfitSnapshots: () => unwrap(get('/business-automation/profit-snapshots')).then((d) => asArray(d)),
  createProfitSnapshot: (body = {}) => unwrap(post('/business-automation/profit-snapshots', body)),
};

export default businessAutomationApi;
