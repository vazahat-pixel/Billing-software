'use strict';

/**
 * JSM: Reports › Fas Reports › Bank / Cash Book › Cash/Bank Register
 * (A_All_CashBank_Report, titled "CashBank").
 *
 * Every receipt and payment with the adjustments that went with it, gathered on two Order By
 * boxes. JSM reads JSM_VW_CASHBANK, filters it with
 *
 *   (A.REC_DATE >='…' AND A.REC_DATE <='…') AND A.BOOK IN (…) AND A.PARTY IN (…)
 *   AND A.BROKER IN (…) AND A.HEADWISE IN (…) AND A.Head2 IN (…) AND A.Station IN (…)
 *   A.REC_PAY='R' | A.REC_PAY='P'            -- the type combo
 *   AND A.CHQ_RETURN<>0                      -- the "Only Cheque Return" tick
 *
 * and either lists it or totals it (btn_screen_Click):
 *
 *   SELECT <g1> AS ZGROUP1, <g2> AS ZGROUP2, MAX(YEAR_NO), MAX(MONTH_NO), SUM(A.REC_AMT),
 *          SUM(A.AMT_1) … SUM(A.AMT_7), SUM(A.AMT_BC) … GROUP BY …
 *
 * ordered by the group, or by the amount when the Asc/Desc box asks for that.
 *
 * AMT_1 to AMT_7 are a receipt's adjustment lines. This software records those by name —
 * discount, TDS, RG, claim, RD, interest and the two others — so they are captioned by name here
 * rather than by number: which number JSM gives each one is not written down in anything that can
 * be read, and a wrong guess would put real money under the wrong heading. AMT_BC is the bank
 * charge. Every figure is the voucher's own, not recomputed.
 */
const { orderRows, inList, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');

/** The Order By choices and the column each one gathers on. */
const GROUP_FIELDS = {
  None: null,
  Bank: 'BANK',
  Party: 'PARTY',
  Broker: 'BROKER',
  HeadWise: 'HEADWISE',
  Head2: 'HEAD2',
  Month: 'MONTH',
  Station: 'STATION',
};

const ADJUSTMENTS = ['DISCOUNT', 'TDS', 'RG_AMT', 'CLAIM', 'RD', 'INTEREST', 'OTH1', 'OTH2'];
const SUM = ['REC_AMT', ...ADJUSTMENTS, 'AMT_BC'];
// The first tab is JSM's Bank list, which its condition tests as A.BOOK — the money book itself.
const LISTS = { books: 'BANK', parties: 'PARTY', brokers: 'BROKER', heads: 'HEADWISE', head2: 'HEAD2', stations: 'STATION' };

function fieldOf(choice, fallback) {
  const name = String(choice ?? '').trim() || fallback;
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

/** Every posted receipt and payment, with its adjustment lines added up. */
async function cashBankRows(companyId, p) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  require('../../../models/LedgerMaster');
  const match = { companyId, status: 'Posted' };
  if (p.from || p.to) {
    match.date = {};
    if (p.from) match.date.$gte = new Date(p.from);
    if (p.to) match.date.$lte = new Date(`${p.to}T23:59:59.999Z`);
  }
  const vouchers = await PaymentVoucher.find(match)
    .populate('bankLedgerId', 'name group')
    .populate('partyLedgerId', 'name group')
    .lean();

  return vouchers.map((v) => {
    const date = v.date ? new Date(v.date) : null;
    const add = (field) => round((v.againstInvoices || [])
      .reduce((t, a) => t + Number(a[field] || 0), 0));
    return {
      ENT_NO: String(v._id),
      SRAL_NO: v.voucherNo || '',
      REC_DATE: v.date,
      BOOK: v.bookName || '',
      REGISTER: v.bookName || '',
      BANK: v.bankLedgerId?.name || '',
      PARTY: v.partyName || '',
      BROKER: '',
      HEADWISE: v.partyLedgerId?.group || '',
      HEAD2: v.remark2 || '',
      STATION: '',
      MONTH: date ? MONTHS[date.getUTCMonth()] : '',
      YEAR_NO: date ? date.getUTCFullYear() : 0,
      MONTH_NO: date ? date.getUTCMonth() + 1 : 0,
      REC_PAY: v.voucherType === 'Receipt' ? 'R' : 'P',
      CHQ_NO: v.chequeNo || '',
      CHQ_RETURN: 0,
      REC_AMT: round(v.amount),
      DISCOUNT: add('discount'),
      TDS: add('tds'),
      RG_AMT: add('rg'),
      CLAIM: add('claim'),
      RD: add('rd'),
      INTEREST: add('interest'),
      OTH1: add('oth1'),
      OTH2: add('oth2'),
      AMT_BC: round(v.finance || 0),
      REMARK_1: v.narration || '',
      REMARK_2: v.remark2 || '',
    };
  });
}

async function run(companyId, p = {}, deps = {}) {
  const by1 = fieldOf(p.orderBy1, 'None');
  const by2 = fieldOf(p.orderBy2, 'None');
  const summary = p.summary === true || String(p.summary) === 'true';

  let rows = deps.rows || await cashBankRows(companyId, p);
  rows = inDateRange(rows, 'REC_DATE', p.from, p.to);
  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

  const type = String(p.type ?? '').trim();
  if (type === 'REC' || type === 'R') rows = rows.filter((r) => r.REC_PAY === 'R');
  if (type === 'PAY' || type === 'P') rows = rows.filter((r) => r.REC_PAY === 'P');
  // JSM's "Only Cheque Return" tick. A returned cheque is not recorded here, so the tick finds
  // nothing rather than quietly showing everything.
  if (p.onlyChequeReturn) rows = rows.filter((r) => Number(r.CHQ_RETURN || 0) !== 0);

  const levelled = rows.map((r) => ({
    ...r,
    ZGROUP1: by1.field ? (r[by1.field] || '') : '',
    ZGROUP2: by2.field ? (r[by2.field] || '') : '',
  }));

  const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`
    + (p.onlyChequeReturn ? '   (Only Cheque Return)' : '');
  const title = `${by1.name} Wise All CashBank Report`;
  const desc = String(p.order ?? '').trim().toLowerCase();

  if (summary) {
    const keys = ['ZGROUP1', by2.field ? 'ZGROUP2' : null].filter(Boolean);
    const grouped = groupBy(levelled, keys, { sum: SUM, max: ['YEAR_NO', 'MONTH_NO'] });
    for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);

    // Asc / Desc order the groups by their own total instead of by name.
    const order = desc === 'asc' || desc === 'desc'
      ? ['ZGROUP1', { field: 'REC_AMT', dir: desc, numeric: true }]
      : (by1.name === 'Month'
        ? [{ field: 'YEAR_NO', dir: 'asc', numeric: true }, { field: 'MONTH_NO', dir: 'asc', numeric: true }, ...keys]
        : keys);

    return {
      rows: orderRows(grouped, order),
      grid: {
        layout: 'RPT_CASHBANK_SUMMARY',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: { ZGROUP1: by1.name, ZGROUP2: by2.name === 'None' ? '' : by2.name },
        title: `${title} [Summary]`,
        period,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  const keys = [by1.field ? 'ZGROUP1' : null, by2.field ? 'ZGROUP2' : null].filter(Boolean);
  return {
    rows: orderRows(levelled, [...keys, 'REC_DATE', { field: 'SRAL_NO', dir: 'asc', numeric: true }]),
    grid: {
      layout: 'RPT_CASHBANK_DETAIL',
      variant: 1,
      groupColumns: keys,
      groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
      primaryDetailColumn: 'ENT_NO',
      captions: {},
      title,
      period,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId) {
  const rows = await cashBankRows(companyId, {});
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return {
    books: u('BANK'), parties: u('PARTY'), brokers: u('BROKER'),
    heads: u('HEADWISE'), head2: u('HEAD2'), stations: u('STATION'),
  };
}

module.exports = { run, options };
