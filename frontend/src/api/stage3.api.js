import { get, post, patch, del, unwrap, asArray } from './http';

/** Stage 3 Financial Engine API — /api/stage3/* */
export const stage3Api = {
  // CoA
  coaPipeline: () => unwrap(get('/stage3/coa/pipeline')),
  coaSeed: () => unwrap(post('/stage3/coa/seed')),
  coaGroups: (params) => unwrap(get('/stage3/coa/groups', params)),
  coaCreateGroup: (body) => unwrap(post('/stage3/coa/groups', body)),
  coaHierarchy: () => unwrap(get('/stage3/coa/hierarchy')),
  coaLedgers: (params) => unwrap(get('/stage3/coa/ledgers', params)).then((d) => asArray(d)),
  coaCreateLedger: (body) => unwrap(post('/stage3/coa/ledgers', body)),
  coaUpdateLedger: (id, body) => unwrap(patch(`/stage3/coa/ledgers/${id}`, body)),
  coaDeleteLedger: (id) => unwrap(del(`/stage3/coa/ledgers/${id}`)),

  // Journals
  journals: (params) => unwrap(get('/stage3/journals', params)).then((d) => asArray(d)),
  journal: (id) => unwrap(get(`/stage3/journals/${id}`)),
  postJournal: (body) => unwrap(post('/stage3/journals', body)),
  reverseJournal: (id, body) => unwrap(post(`/stage3/journals/${id}/reverse`, body || {})),
  contra: (body) => unwrap(post('/stage3/journals/contra', body)),

  // Ledgers
  ledgerBalances: (params) => unwrap(get('/stage3/ledgers/balances', params)),
  ledgerStatement: (id, params) => unwrap(get(`/stage3/ledgers/${id}/statement`, params)),
  partyLedger: (partyId, params) => unwrap(get(`/stage3/ledgers/party/${partyId}`, params)),

  // Cash & Bank
  cashBook: (params) => unwrap(get('/stage3/cash-book', params)),
  bankBook: (params) => unwrap(get('/stage3/bank-book', params)),
  bankAccounts: () => unwrap(get('/stage3/bank-accounts')).then((d) => asArray(d)),
  createBankAccount: (body) => unwrap(post('/stage3/bank-accounts', body)),
  cheques: (params) => unwrap(get('/stage3/cheques', params)).then((d) => asArray(d)),
  digitalInstruments: (params) => unwrap(get('/stage3/digital-instruments', params)).then((d) => asArray(d)),
  registerInstrument: (body) => unwrap(post('/stage3/instruments', body)),
  updateInstrument: (id, body) => unwrap(patch(`/stage3/instruments/${id}`, body)),
  bankCharges: (body) => unwrap(post('/stage3/bank-charges', body)),
  depositWithdraw: (body) => unwrap(post('/stage3/deposit-withdraw', body)),
  cashClosing: (params) => unwrap(get('/stage3/cash-closing', params)),
  startBrs: (body) => unwrap(post('/stage3/brs', body)),
  clearBrs: (id, body) => unwrap(post(`/stage3/brs/${id}/clear`, body)),
  finalizeBrs: (id) => unwrap(post(`/stage3/brs/${id}/finalize`)),

  // Outstanding
  outstanding: (params) => unwrap(get('/stage3/outstanding', params)).then((d) => asArray(d)),
  rebuildSettlements: () => unwrap(post('/stage3/outstanding/rebuild')),
  followUp: (id, body) => unwrap(patch(`/stage3/outstanding/${id}/follow-up`, body)),
  settleBill: (body) => unwrap(post('/stage3/outstanding/settle', body)),
  creditCheck: (body) => unwrap(post('/stage3/outstanding/credit-check', body)),
  outstandingReconcile: (params) => unwrap(get('/stage3/outstanding/reconcile', params)),

  // Reports
  trialBalance: (params) => unwrap(get('/stage3/reports/trial-balance', params)),
  profitLoss: (params) => unwrap(get('/stage3/reports/profit-loss', params)),
  balanceSheet: (params) => unwrap(get('/stage3/reports/balance-sheet', params)),
  cashFlow: (params) => unwrap(get('/stage3/reports/cash-flow', params)),
  fundFlow: (params) => unwrap(get('/stage3/reports/fund-flow', params)),
  dayBook: (params) => unwrap(get('/stage3/reports/day-book', params)),
  journalRegister: (params) => unwrap(get('/stage3/reports/journal-register', params)),

  // Closing
  lockMonth: (body) => unwrap(post('/stage3/closing/lock-month', body)),
  unlockMonth: (body) => unwrap(post('/stage3/closing/unlock-month', body)),
  lockPeriod: (body) => unwrap(post('/stage3/closing/lock-period', body)),
  validateClose: (body) => unwrap(post('/stage3/closing/validate', body)),
  closeYear: (body) => unwrap(post('/stage3/closing/close-year', body)),
  reopenYear: (body) => unwrap(post('/stage3/closing/reopen-year', body)),
  depreciation: (body) => unwrap(post('/stage3/closing/depreciation', body)),

  // Audit
  reconcile: () => unwrap(get('/stage3/audit/reconcile')),
  journalAudit: (params) => unwrap(get('/stage3/audit/journals', params)),
  inventoryGl: () => unwrap(get('/stage3/audit/inventory-gl')),
  gstGl: () => unwrap(get('/stage3/audit/gst-gl')),
  auditTrail: (params) => unwrap(get('/stage3/audit/trail', params)),

  // Cost centers
  costCenterSeed: () => unwrap(post('/stage3/cost-centers/seed')),
  costCenters: (params) => unwrap(get('/stage3/cost-centers', params)).then((d) => asArray(d)),
  createCostCenter: (body) => unwrap(post('/stage3/cost-centers', body)),
  updateCostCenter: (id, body) => unwrap(patch(`/stage3/cost-centers/${id}`, body)),
  costReport: (params) => unwrap(get('/stage3/cost-centers/report', params)),
  textileCosting: (params) => unwrap(get('/stage3/costing/textile', params)),
  margin: (body) => unwrap(post('/stage3/costing/margin', body)),
  allocateOverhead: (body) => unwrap(post('/stage3/costing/allocate-overhead', body)),

  // Certification
  certificationRun: () => unwrap(post('/stage3/certification/run')),
  certificationLatest: () => unwrap(get('/stage3/certification/latest')),
  certificationList: () => unwrap(get('/stage3/certification')).then((d) => asArray(d)),
};

export default stage3Api;
