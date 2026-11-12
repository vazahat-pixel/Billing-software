'use strict';

/**
 * JSM: Others Reports › Daily Transaction (Rpt_Daily_TransactionNew, "Daily Transaction Report").
 *
 * The money that moved — every receipt and payment — over a date range, gathered the way the two
 * Order By boxes ask for. JSM reads its own VW_DAILY_TRANS_DATEWISE, built on T_CASH_MN
 * (GetParaMetersNo_From_STP_REPORT1), filters it with
 *
 *   (A.BILL_DATE >='…' AND A.BILL_DATE <='…') AND A.BOOK IN (…) AND A.AC_NAME IN (…)
 *   AND A.TYPE IN (…) AND A.dr_amount<>0        -- the Debit radio; Credit uses cr_amount<>0
 *
 * and then either lists it or totals it (btn_screen_Click):
 *
 *   SELECT <g1> AS ZGROUP1, <g2> AS ZGROUP2, MAX(YEAR_NO), MAX(MONTH_NO),
 *          SUM(CR_AMOUNT), SUM(DR_AMOUNT), SUM(ISS_QTY), SUM(REC_QTY) … GROUP BY …
 *
 * with both Order By boxes choosing from Register, Book, Party, Type, Month, DateWise, Quaterly,
 * Weekly and None. Its column names come from Js_Add_NewColumn_Function: BILL.DATE, PARTY, DR.AMT,
 * CR.AMT, VOU.NO, P.BANK, REM1, REM2, MONTH, GROUP1, GROUP2.
 *
 * A receipt debits the money book and a payment credits it, so DR_AMOUNT is what came in and
 * CR_AMOUNT what went out — the same sides this software's own cash book shows. ISS_QTY and
 * REC_QTY stay at zero here as they do in JSM: they belong to the challan half of the view it
 * shares, and a cash voucher carries no quantity.
 */
const { orderRows, inList, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');

/** The Order By choices and the column each one gathers on. */
const GROUP_FIELDS = {
  None: null,
  Register: 'BOOK',
  Book: 'BOOK',
  Party: 'AC_NAME',
  Type: 'TYPE',
  Month: 'MONTH_NAME',
  DateWise: 'DATEWISE',
  Quaterly: 'QUATERLY',
  Weekly: 'WEEKLY',
};

const SUM = ['DR_AMOUNT', 'CR_AMOUNT', 'ISS_QTY', 'REC_QTY'];
const LISTS = { parties: 'AC_NAME', books: 'BOOK', types: 'TYPE' };

function fieldOf(choice, fallback) {
  const name = String(choice ?? '').trim() || fallback;
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

/** dd/MM/yyyy, the week of the year and the quarter — JSM's DateWise, Weekly and Quaterly. */
function dateParts(value) {
  const blank = { DATEWISE: '', WEEKLY: '', QUATERLY: '', MONTH_NAME: '', YEAR_NO: 0, MONTH_NO: 0 };
  if (!value) return blank;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return blank;
  const p = (n) => String(n).padStart(2, '0');
  const firstOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - firstOfYear) / 604800000) + 1;
  return {
    DATEWISE: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    WEEKLY: `Week ${week}`,
    QUATERLY: `Q${Math.floor(d.getUTCMonth() / 3) + 1}`,
    MONTH_NAME: MONTHS[d.getUTCMonth()],
    YEAR_NO: d.getUTCFullYear(),
    MONTH_NO: d.getUTCMonth() + 1,
  };
}

/** Every posted receipt and payment as one row, in the view's own column names. */
async function transactionRows(companyId, p) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  const match = { companyId, status: 'Posted' };
  if (p.from || p.to) {
    match.date = {};
    if (p.from) match.date.$gte = new Date(p.from);
    if (p.to) match.date.$lte = new Date(`${p.to}T23:59:59.999Z`);
  }
  const vouchers = await PaymentVoucher.find(match)
    .select('voucherNo date voucherType partyName amount bookName partyBank narration remark2 chequeNo')
    .lean();

  return vouchers.map((v) => {
    const amount = round(Number(v.amount || 0));
    return {
      BILL_DATE: v.date,
      SRAL_NO: v.voucherNo || '',
      BOOK: v.bookName || '',
      TYPE: v.voucherType || '',
      AC_NAME: v.partyName || '',
      PARTY_BANK: v.partyBank || '',
      CHQ_NO: v.chequeNo || '',
      DR_AMOUNT: v.voucherType === 'Receipt' ? amount : 0,
      CR_AMOUNT: v.voucherType === 'Payment' ? amount : 0,
      ISS_QTY: 0,
      REC_QTY: 0,
      REMARK_1: v.narration || '',
      REMARK_2: v.remark2 || '',
      ...dateParts(v.date),
    };
  });
}

async function run(companyId, p = {}, deps = {}) {
  const by1 = fieldOf(p.orderBy1, 'DateWise');
  const by2 = fieldOf(p.orderBy2, 'None');

  let rows = deps.rows || await transactionRows(companyId, p);
  rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

  // JSM's Debit / Credit / Both radio, which drops the rows whose side is empty.
  const side = String(p.side ?? 'Both').trim();
  if (side === 'Debit') rows = rows.filter((r) => Number(r.DR_AMOUNT || 0) !== 0);
  if (side === 'Credit') rows = rows.filter((r) => Number(r.CR_AMOUNT || 0) !== 0);

  // The screen's amount box and its operator, which JSM appends as ` and A.NET_TOT <op> <value>`.
  // A cash row's own amount is whichever side it moved, so that is what is compared.
  const limit = Number(p.amount ?? 0);
  const op = String(p.amountOp ?? '').trim();
  if (op && Number.isFinite(limit) && limit !== 0) {
    const amountOf = (r) => Number(r.DR_AMOUNT || 0) + Number(r.CR_AMOUNT || 0);
    const test = {
      '>': (v) => v > limit,
      '>=': (v) => v >= limit,
      '<': (v) => v < limit,
      '<=': (v) => v <= limit,
      '=': (v) => Math.abs(v - limit) < 0.005,
      '<>': (v) => Math.abs(v - limit) >= 0.005,
    }[op];
    if (!test) {
      const err = new Error(`Unknown amount operator: ${op}`);
      err.status = 400;
      throw err;
    }
    rows = rows.filter((r) => test(amountOf(r)));
  }

  const levelled = rows.map((r) => ({
    ...r,
    ZGROUP1: by1.field ? (r[by1.field] || '') : '',
    ZGROUP2: by2.field ? (r[by2.field] || '') : '',
  }));

  const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
  // JSM heads this window `<Order By 1> Wise Sales Summary Report` — its Fill_String_For_Period
  // carries the Sales Summary wording, the screen this one was copied from. Kept as JSM prints it.
  const title = `${by1.name} Wise Sales Summary Report`;

  // Both boxes on None is JSM's own listing; any other choice — or the Summary tick, which asks
  // for the totals of whatever is gathered — totals the rows instead.
  const summary = p.summary === true || String(p.summary) === 'true';
  if (!by1.field && !by2.field && !summary) {
    return {
      rows: orderRows(levelled, [
        'BILL_DATE',
        { field: 'SRAL_NO', dir: 'asc', numeric: true },
      ]),
      grid: {
        layout: 'JSM_VW_DAILY_TRANS',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title,
        period,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  const keys = ['ZGROUP1', by2.field ? 'ZGROUP2' : null].filter(Boolean);
  const grouped = groupBy(levelled, keys, { sum: SUM, max: ['YEAR_NO', 'MONTH_NO'] });
  for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);

  return {
    // A month or a date gathers in calendar order; everything else in its own name's order.
    rows: orderRows(grouped, ['Month', 'DateWise', 'Quaterly', 'Weekly'].includes(by1.name)
      ? [{ field: 'YEAR_NO', dir: 'asc', numeric: true }, { field: 'MONTH_NO', dir: 'asc', numeric: true }, ...keys]
      : keys),
    grid: {
      layout: 'JSM_VW_DAILY_TRANS_SUMMARY',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: { ZGROUP1: by1.name, ZGROUP2: by2.name === 'None' ? '' : by2.name },
      title,
      period,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId) {
  const rows = await transactionRows(companyId, {});
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { parties: u('AC_NAME'), books: u('BOOK'), types: u('TYPE') };
}

module.exports = { run, options };
