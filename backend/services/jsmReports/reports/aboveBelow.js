'use strict';

/**
 * JSM: Reports › Fas Reports › Above Below Rs. (Rpt_Above_Below, "Above/Below Reports").
 *
 * Accounts whose total for the period is above — or below — an amount the operator types.
 * JSM's own SQL (GREATR_OR_LESS_STRING) groups one source per radio and filters with HAVING:
 *
 *   SELECT B.AC_NAME, B.ADD_1, B.ADD_2, C.ST_NAME, SUM(A.NET_TOT) AS AC_TOTAL
 *   FROM <T_SALES | T_PURCHASE | I_MILL_GP | I_JOB_RECEIPT> A ... GROUP BY ... HAVING SUM(...) > n
 *
 * and for 5-Cash Rec / 6-Cash Pay the same shape over T_CASH_MN's REC_AMT, split by REC_PAY.
 *
 * Sales, Purchase and the two cash sides read the same rows the registers and the voucher book
 * already use. Process and Jobwork are refused rather than answered from a different figure —
 * their bill totals are not one of the sources this software has proved against JSM yet.
 */
const { round } = require('../jcEngine');
const { loadSalesRegisterRows, loadPurchaseRegisterRows } = require('../sources/billRegister');

const SOURCES = {
  1: { label: 'Sales', load: loadSalesRegisterRows, amount: 'NET_TOT' },
  2: { label: 'Purchase', load: loadPurchaseRegisterRows, amount: 'NET_TOT' },
  3: { label: 'Process', unavailable: true },
  4: { label: 'Jobwork', unavailable: true },
  5: { label: 'Cash Rec', cash: 'Receipt' },
  6: { label: 'Cash Pay', cash: 'Payment' },
};

function sourceOf(raw) {
  const n = Number(String(raw ?? '1').trim().split('-')[0]) || 1;
  const s = SOURCES[n];
  if (!s) {
    const err = new Error(`Unknown source: ${raw}`);
    err.status = 400;
    throw err;
  }
  if (s.unavailable) {
    const err = new Error(`${s.label} totals are not wired into this report yet`);
    err.status = 400;
    throw err;
  }
  return { n, ...s };
}

/** The cash book's own side of this report: posted receipts or payments, per party. */
async function cashTotals(companyId, voucherType, from, to) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  const match = { companyId, voucherType, status: 'Posted' };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  const rows = await PaymentVoucher.find(match).select('partyName amount').lean();
  const byParty = new Map();
  for (const r of rows) {
    const name = r.partyName || '';
    byParty.set(name, (byParty.get(name) || 0) + Number(r.amount || 0));
  }
  return [...byParty].map(([AC_NAME, total]) => ({ AC_NAME, AC_TOTAL: round(total), ST_NAME: '' }));
}

async function run(companyId, p = {}, deps = {}) {
  const src = sourceOf(p.source);
  const above = String(p.direction ?? 'A').toUpperCase() !== 'B';
  const amount = Number(p.amount || 0);

  let totals;
  if (src.cash) {
    totals = await cashTotals(companyId, src.cash, p.from, p.to);
  } else {
    const { inDateRange } = require('../jcEngine');
    const bills = inDateRange(deps.rows || await src.load(companyId), 'BILL_DATE', p.from, p.to);
    const byParty = new Map();
    for (const b of bills) {
      const key = b.PARTY || '';
      if (!byParty.has(key)) byParty.set(key, { AC_NAME: key, AC_TOTAL: 0, ST_NAME: b.STATION || '' });
      byParty.get(key).AC_TOTAL += Number(b[src.amount] || 0);
    }
    totals = [...byParty.values()].map((r) => ({ ...r, AC_TOTAL: round(r.AC_TOTAL) }));
  }

  // JSM's HAVING: strictly above, or strictly below, the amount typed in.
  const rows = totals
    .filter((r) => (above ? r.AC_TOTAL > amount : r.AC_TOTAL < amount))
    .sort((a, b) => a.AC_NAME.localeCompare(b.AC_NAME));

  return {
    rows,
    grid: {
      layout: 'JSM_VW_GRATER_OR_LESS',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: `${src.label} ${above ? 'Above' : 'Below'} Rs. ${amount.toFixed(2)}`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options() { return {}; }

module.exports = { run, options, SOURCES };
