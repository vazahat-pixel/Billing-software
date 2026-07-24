import { get, post, put, del, unwrap, asArray } from './http';

/** Stage 6 Enterprise Productivity Platform — /api/stage6/* */
export const stage6Api = {
  overview: () => unwrap(get('/stage6/overview')),
  getConfig: () => unwrap(get('/stage6/config')),
  updateConfig: (body) => unwrap(put('/stage6/config', body)),
  seedFlags: () => unwrap(post('/stage6/config/seed-flags')),

  // 6.1 Search
  search: (q, params = {}) => unwrap(get('/stage6/search', { q, ...params })),
  commands: () => unwrap(get('/stage6/commands')),

  // 6.2 Notifications
  notifSeed: () => unwrap(post('/stage6/notifications/seed')),
  notifConfigs: () => unwrap(get('/stage6/notifications/configs')).then((d) => asArray(d)),
  notifConfigUpdate: (ruleKey, body) => unwrap(put(`/stage6/notifications/configs/${ruleKey}`, body)),
  notifInbox: (params) => unwrap(get('/stage6/notifications/inbox', params)),
  notifUnread: () => unwrap(get('/stage6/notifications/unread')),
  notifRead: (id) => unwrap(post(`/stage6/notifications/${id}/read`)),
  notifReadAll: () => unwrap(post('/stage6/notifications/read-all')),
  notifArchive: (id) => unwrap(post(`/stage6/notifications/${id}/archive`)),
  notifSend: (body) => unwrap(post('/stage6/notifications/send', body)),

  // 6.3 Automation
  autoPipeline: () => unwrap(get('/stage6/automation/pipeline')),
  autoSeed: () => unwrap(post('/stage6/automation/seed')),
  autoRules: () => unwrap(get('/stage6/automation/rules')).then((d) => asArray(d)),
  autoUpsert: (body) => unwrap(post('/stage6/automation/rules', body)),
  autoLogs: (params) => unwrap(get('/stage6/automation/logs', params)).then((d) => asArray(d)),
  autoRun: (body) => unwrap(post('/stage6/automation/run', body)),

  // 6.4 Approvals
  apprPipeline: () => unwrap(get('/stage6/approvals/pipeline')),
  apprSeed: () => unwrap(post('/stage6/approvals/seed')),
  apprDefs: () => unwrap(get('/stage6/approvals/definitions')).then((d) => asArray(d)),
  apprDefUpdate: (code, body) => unwrap(put(`/stage6/approvals/definitions/${code}`, body)),
  apprInbox: (params) => unwrap(get('/stage6/approvals/inbox', params)).then((d) => asArray(d)),
  apprStart: (body) => unwrap(post('/stage6/approvals/start', body)),
  apprDecide: (id, body) => unwrap(post(`/stage6/approvals/${id}/decide`, body)),
  apprReject: (id, body) => unwrap(post(`/stage6/approvals/${id}/reject`, body || {})),
  apprResubmit: (id, body) => unwrap(post(`/stage6/approvals/${id}/resubmit`, body || {})),
  apprComment: (id, body) => unwrap(post(`/stage6/approvals/${id}/comments`, body)),
  apprHistory: (referenceId) => unwrap(get(`/stage6/approvals/history/${referenceId}`)).then((d) => asArray(d)),

  // 6.5 Offline
  offlineStatus: () => unwrap(get('/stage6/offline/status')),
  offlineToggle: (enabled) => unwrap(put('/stage6/offline/enabled', { enabled })),

  // 6.6 Communication
  commTemplates: () => unwrap(get('/stage6/communication/templates')).then((d) => asArray(d)),
  commSend: (body) => unwrap(post('/stage6/communication/send', body)),
  commLogs: (params) => unwrap(get('/stage6/communication/logs', params)).then((d) => asArray(d)),
  commPipeline: () => unwrap(get('/stage6/communication/pipeline')),

  // 6.7 Documents
  docPipeline: () => unwrap(get('/stage6/documents/pipeline')),
  docSeed: () => unwrap(post('/stage6/documents/seed')),
  docTemplates: () => unwrap(get('/stage6/documents/templates')).then((d) => asArray(d)),
  docUpdate: (id, body) => unwrap(put(`/stage6/documents/templates/${id}`, body)),
  docPreview: (body) => unwrap(post('/stage6/documents/preview', body)),

  // 6.8 BI
  biOverview: () => unwrap(get('/stage6/bi/overview')),
  biSales: (params) => unwrap(get('/stage6/bi/sales', params)),
  biPurchase: (params) => unwrap(get('/stage6/bi/purchase', params)),
  biInventory: () => unwrap(get('/stage6/bi/inventory')),
  biProduction: () => unwrap(get('/stage6/bi/production')),
  biAccounting: () => unwrap(get('/stage6/bi/accounting')),
  biBranch: () => unwrap(get('/stage6/bi/branch')),
  biExport: () => unwrap(get('/stage6/bi/export')),

  // 6.9 Productivity
  productivity: () => unwrap(get('/stage6/productivity')),
  pin: (body) => unwrap(post('/stage6/productivity/pin', body)),
  unpin: (id) => unwrap(del(`/stage6/productivity/pin/${id}`)),
  touch: (body) => unwrap(post('/stage6/productivity/touch', body)),
  saveDraft: (body) => unwrap(post('/stage6/productivity/drafts', body)),
  clearDraft: (module) => unwrap(del(`/stage6/productivity/drafts/${module}`)),
  favorite: (body) => unwrap(post('/stage6/productivity/favorite', body)),
  duplicate: (body) => unwrap(post('/stage6/productivity/duplicate', body)),
  bulkExport: (body) => unwrap(post('/stage6/productivity/bulk-export', body)),

  // 6.10 Certification
  certificationRun: (body) => unwrap(post('/stage6/certification/run', body || {})),
  certificationLatest: () => unwrap(get('/stage6/certification/latest')),
  certificationList: () => unwrap(get('/stage6/certification')).then((d) => asArray(d)),
};

export default stage6Api;
