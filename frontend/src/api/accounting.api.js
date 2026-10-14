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
  finalHeads: async () => {
    try {
      return await unwrap(get('/accounting/reports/final-heads'));
    } catch (err) {
      const { computeOfflineFinalHeads } = await import('../utils/offlineReportsEngine');
      return computeOfflineFinalHeads({});
    }
  },
  groupListReport: async (body) => {
    try {
      return await unwrap(post('/accounting/reports/group-list', body));
    } catch (err) {
      const { computeOfflineLedgerStatement } = await import('../utils/offlineReportsEngine');
      const id = (body?.ledgerIds || [])[0];
      const stmt = await computeOfflineLedgerStatement({ ledgerId: id, from: body?.asOn, to: body?.asOn, state: {} });
      return {
        asOn: body?.asOn,
        groups: [{ name: stmt.ledgerName, lines: stmt.statement, totalDebit: stmt.statement.reduce((s, r) => s + (r.debit || 0), 0), totalCredit: stmt.statement.reduce((s, r) => s + (r.credit || 0), 0) }],
        grandDebit: stmt.statement.reduce((s, r) => s + (r.debit || 0), 0),
        grandCredit: stmt.statement.reduce((s, r) => s + (r.credit || 0), 0),
      };
    }
  },
  jsmTrialBalance: async (body) => {
    try {
      return await unwrap(post('/accounting/reports/trial-balance', body));
    } catch (err) {
      const { computeOfflineTrialBalance } = await import('../utils/offlineReportsEngine');
      const rows = await computeOfflineTrialBalance(body?.to, {});
      const totDr = rows.reduce((s, r) => s + (r.debit || 0), 0);
      const totCr = rows.reduce((s, r) => s + (r.credit || 0), 0);
      return {
        from: body?.from,
        to: body?.to,
        rows,
        grandDebit: totDr,
        grandCredit: totCr,
        groups: [{ name: 'Trial Balance', lines: rows, totalDebit: totDr, totalCredit: totCr }]
      };
    }
  },
  jsmProfitLoss: async (body) => {
    try {
      return await unwrap(post('/accounting/reports/profit-loss', body));
    } catch (err) {
      const { computeOfflineProfitLoss } = await import('../utils/offlineReportsEngine');
      const pl = await computeOfflineProfitLoss(body?.from, body?.to, {});
      return {
        from: body?.from,
        to: body?.to,
        ...pl
      };
    }
  },
  jsmBalanceSheet: async (body) => {
    try {
      return await unwrap(post('/accounting/reports/balance-sheet', body));
    } catch (err) {
      const { computeOfflineTrialBalance, computeOfflineProfitLoss } = await import('../utils/offlineReportsEngine');
      const tb = await computeOfflineTrialBalance(body?.asOn, {});
      const pl = await computeOfflineProfitLoss(body?.from, body?.asOn, {});
      const assets = tb.filter((r) => r.debit > 0);
      const liabilities = tb.filter((r) => r.credit > 0);
      return {
        asOn: body?.asOn,
        assets,
        liabilities,
        netProfit: pl.netProfit,
        totalAssets: assets.reduce((s, r) => s + (r.debit || 0), 0),
        totalLiabilities: liabilities.reduce((s, r) => s + (r.credit || 0), 0),
      };
    }
  },
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
