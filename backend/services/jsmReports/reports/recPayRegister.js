'use strict';

/**
 * JSM: Others Reports › Old Reports › Rec/Pay Register › Sales / Purchase / Process / JobWork
 * (Rpt_1Sales_Receipt_Reg, Rpt_1Purchase_Payment_Reg, Rpt_1Process_Payment_Reg,
 * Rpt_1Job_Payment_Reg).
 *
 * Each bill with the money settled against it. JSM builds a temp view whose own SELECT names the
 * columns (Rpt_1Sales_Receipt_Reg.Outstanding_String):
 *
 *   BILL_DATE, BILL_NO, NCBILL_NO, ISNULL(NET_TOT,0) AS BILL_AMT, REC_DATE, SP_TYPE,
 *   ISNULL(ADJUST,0) AS ADJUST, ISNULL(TOT_DISC,0) AS ADD_LESS, ISNULL(SLR_AMT,0) AS SLR_AMT
 *
 * and prints it Normal, Party Wise or Broker Wise (its three Crystal layouts).
 *
 * Sales and Purchase get a row per receipt or payment, read from the vouchers' own
 * againstInvoices lines. Process and Jobwork record one settled total per job rather than each
 * payment, so those show the bill's one settlement row — the figures are the same, the breakdown
 * is not there to show.
 */
const { orderRows, inList, round } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');

const LISTS = { parties: 'PARTY', brokers: 'BROKER', stations: 'STATION', books: 'BOOK' };

/** JSM's Normal / Party Wise / Broker Wise. */
const CATEGORIES = {
  1: { key: null, caption: '', title: '' },
  2: { key: 'PARTY', caption: 'PARTY', title: 'Party Wise ' },
  3: { key: 'BROKER', caption: 'BROKER', order2: 'PARTY', title: 'Broker Wise ' },
};

/** Each posted voucher line against a bill, so a bill settled twice prints twice. */
async function settlementsByBill(companyId, voucherType, from, to) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  const match = { companyId, voucherType, status: 'Posted' };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  const vouchers = await PaymentVoucher.find(match).select('date againstInvoices').lean();
  const byBill = new Map();
  for (const v of vouchers) {
    for (const a of v.againstInvoices || []) {
      const key = String(a.invoiceNo ?? '').trim();
      if (!key) continue;
      if (!byBill.has(key)) byBill.set(key, []);
      byBill.get(key).push({ REC_DATE: v.date, ADJUST: round(Number(a.amount || 0)) });
    }
  }
  return byBill;
}

function recPayReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const n = Number(String(p.category ?? '1').trim().split('-')[0]) || 1;
    const cat = CATEGORIES[n] || CATEGORIES[1];

    let bills = deps.rows || await loadOutstandingRows(companyId, spec.kind, {
      billDateFrom: p.from, billDateTo: p.to, status: 'All',
    });
    for (const [param, field] of Object.entries(LISTS)) bills = inList(bills, field, p[param]);

    const settled = deps.settlements
      || (spec.voucherType ? await settlementsByBill(companyId, spec.voucherType, p.from, p.to) : new Map());

    const out = [];
    for (const b of bills) {
      const base = {
        ...b,
        BILL_AMT: round(Number(b.NET_TOT || 0)),
        ADD_LESS: round(Number(b.TOT_DISC || 0)),
        SLR_AMT: round(Number(b.GOODS_RTN || 0)),
        XGROUP: cat.key ? (b[cat.key] || '') : '',
      };
      const lines = settled.get(String(b.NCBILL_NO ?? '').trim());
      if (lines?.length) {
        for (const l of lines) out.push({ ...base, REC_DATE: l.REC_DATE, ADJUST: l.ADJUST });
      } else {
        out.push({ ...base, REC_DATE: b.PAID_DATE || null, ADJUST: round(Number(b.ADJUST || 0)) });
      }
    }

    const keys = cat.key
      ? ['XGROUP', cat.order2, 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }, 'REC_DATE'].filter(Boolean)
      : ['BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }, 'REC_DATE'];

    return {
      rows: orderRows(out, keys),
      grid: {
        layout: spec.view,
        variant: 1,
        groupColumns: cat.key ? ['XGROUP'] : [],
        groupDisplays: cat.key ? [cat.caption] : [],
        primaryDetailColumn: '_billId',
        captions: cat.key ? { GROUP2: cat.caption } : {},
        title: `${cat.title}${spec.noun} Report`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId) {
    const rows = await loadOutstandingRows(companyId, spec.kind, { status: 'All' });
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return { parties: u('PARTY'), brokers: u('BROKER'), stations: u('STATION'), books: u('BOOK') };
  }

  return { run, options };
}

module.exports = {
  sales: recPayReport({ kind: 'sales', voucherType: 'Receipt', view: 'JSM_VW_SL_RCPT', noun: 'Sales Receipt' }),
  purchase: recPayReport({ kind: 'purchase', voucherType: 'Payment', view: 'JSM_VW_PU_RCPT', noun: 'Purchase Payment' }),
  process: recPayReport({ kind: 'process', view: 'JSM_VW_PR_RCPT', noun: 'Process Payment' }),
  jobwork: recPayReport({ kind: 'jobwork', view: 'JSM_VW_JB_RCPT', noun: 'JobWork Payment' }),
};
