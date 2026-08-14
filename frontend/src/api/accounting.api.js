import { get, post, put, request, unwrap, asArray } from './http';
import { stage3Api } from './stage3.api';

export const accountingApi = {
  listLedgers: (params) => unwrap(get('/accounting/ledgers', params)).then((d) => asArray(d, ['ledgers'])),
  createLedger: (body) => unwrap(post('/accounting/ledgers', body)),
  statement: (ledgerId, params) => unwrap(get(`/accounting/ledgers/${ledgerId}/statement`, params)),
  /** Returns full envelope { data: voucher, discountNotes: [] } */
  payments: (body) => request('post', '/accounting/payments', { data: body }),
  /** Returns full envelope { data: voucher, discountNotes: [] } */
  receipts: (body) => request('post', '/accounting/receipts', { data: body }),
  listVouchers: (params) => unwrap(get('/accounting/payments', params)).then((d) => asArray(d, ['vouchers', 'payments'])),
  /** Edit a posted voucher — backend reverses and re-posts atomically, number preserved.
   *  Returns full envelope { data: voucher, discountNotes: [] } */
  updateVoucher: (id, body) => request('put', `/accounting/payments/${id}`, { data: body }),
  reverseVoucher: (id, body = {}) => unwrap(post(`/accounting/payments/${id}/reverse`, body)),
  trialBalance: (params) => unwrap(get('/accounting/trial-balance', params)),
  groupedTrialBalance: (params) => unwrap(get('/accounting/trial-balance/grouped', params)),
  profitLoss: (params) => unwrap(get('/accounting/profit-loss', params)),
  balanceSheet: (params) => unwrap(get('/accounting/balance-sheet', params)),
  outstanding: (params) => unwrap(get('/accounting/outstanding', params)),
  journal: (body) => unwrap(post('/accounting/journal', body)),
  /** Stage 3 financial engine */
  stage3: stage3Api,
};

export const ledgerApi = {
  /** Prefer accountingApi.statement — this hits deprecated /ledgers */
  partyLedger: (partyId) => unwrap(get(`/ledgers/${partyId}`)),
  statement: (ledgerId, params) => accountingApi.statement(ledgerId, params),
  list: (params) => accountingApi.listLedgers(params),
};

export { stage3Api };
export default accountingApi;
