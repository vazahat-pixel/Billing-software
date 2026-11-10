'use strict';

/**
 * Builder for JSM's Sales / Purchase Summary Report screens — the ones on the main menu path
 * (Reports › Sales › Sales Bill › Sales Summary, Reports › Purchase › Purchase Bill › Purchase
 * Summary), forms Rpt_SalesRegisterSummary_Report / Rpt_PurchaseRegisterSummary_Report.
 *
 * These are NOT the Category Wise registers in registerReport.js. This screen has two Order By
 * combos instead, and groups on both at once:
 *
 *   SELECT <OrderBy1> AS ZGROUP1, <OrderBy2> AS ZGROUP2, SUM(...) ... GROUP BY <both>
 *
 * with "Summary Reports" ticked, or one row per bill with it unticked — exactly as the decompiled
 * form's btn_screen_Click builds it.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('./jcEngine');

/** JSM's Order By choices -> the column each one groups on. */
const ORDER_FIELDS = {
  Register: 'REGISTER',
  Party: 'PARTY',
  Broker: 'BROKER',
  Station: 'STATION',
  MainGroup: 'MAINGROUP',
  Haste: 'HASTE',
  Transport: 'TRANSPORT',
  Month: 'MONTH',
  MONTH: 'MONTH',
  DateWise: 'BILL_DATE',
  // The GSTIN Return screens offer these three instead of Broker/Haste/Transport.
  State_Code_Nm: 'STATE',
  Type: 'TYPE',
  GstRate: 'GST_RATE',
  None: null,
};

/**
 * Choices JSM offers that this software does not record. Asking for one is refused rather than
 * answered with a different grouping under the chosen heading.
 */
const UNRECORDED = ['SalesMan', 'Area', 'Company', 'Msme_Type'];

const SUM = ['TO_PCS', 'TO_QTY', 'TO_QTY1', 'SUB_TOT', 'TAXABLE_AMT', 'NET_TOT', 'T_ADD', 'T_LESS',
  'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'TCS_AMT'];
const LISTS = { parties: 'PARTY', brokers: 'BROKER', books: 'REGISTER', stations: 'STATION' };

function fieldOf(choice, which) {
  const name = String(choice ?? '').trim() || (which === 1 ? 'Register' : 'None');
  if (UNRECORDED.includes(name)) {
    const err = new Error(`This software does not record ${name}, so it cannot group by it`);
    err.status = 400;
    throw err;
  }
  if (!(name in ORDER_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: ORDER_FIELDS[name] };
}

/**
 * @param {object} spec
 *   load   (companyId) => bill rows
 *   views  { summary, bills } captured layout names
 *   noun   'Sales' | 'Purchase'
 */
function registerSummaryReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const by1 = fieldOf(p.orderBy1, 1);
    const by2 = fieldOf(p.orderBy2, 2);
    const summary = p.summaryReports === undefined || p.summaryReports === null
      || p.summaryReports === true || String(p.summaryReports) === 'true';

    let rows = inDateRange(deps.rows || await spec.load(companyId), 'BILL_DATE', p.from, p.to);
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
    const title = `${by1.name} Wise ${spec.noun} Summary Report`;
    const pageWise = p.printout === '2-PageWise';

    if (!summary) {
      // One row per bill, under the first Order By as the group header.
      const out = rows.map((r) => ({ ...r, _lines: undefined, ZGROUP1: by1.field ? (r[by1.field] ?? '') : '' }));
      return {
        rows: orderRows(out, ['ZGROUP1', 'BILL_DATE', { field: 'SRAL_NO', dir: 'asc', numeric: true }]),
        grid: {
          layout: spec.views.bills,
          variant: 1,
          groupColumns: ['ZGROUP1'],
          groupDisplays: [by1.name],
          captions: {},
          title,
          period,
          pageWise,
        },
      };
    }

    const flat = rows.map((r) => ({
      ...r,
      ZGROUP1: by1.field ? (r[by1.field] ?? '') : '',
      ZGROUP2: by2.field ? (r[by2.field] ?? '') : '',
    }));
    const keys = by2.field ? ['ZGROUP1', 'ZGROUP2'] : ['ZGROUP1'];
    const grouped = groupBy(flat, keys, { sum: SUM }, (first) => ({
      YEAR_NO: first.YEAR_NO, MONTH_NO: first.MONTH_NO,
    }));
    for (const g of grouped) {
      for (const f of SUM) g[f] = round(g[f]);
      // The summary layout prints the totals under its own column names.
      g.TPCS = g.TO_PCS;
      g.TQTY = g.TO_QTY;
      g.BILLAMT = g.NET_TOT;
      g.GROUP1 = g.ZGROUP1;
      g.GROUP2 = g.ZGROUP2 ?? '';
    }

    return {
      rows: orderRows(grouped, sortKeys(by1, by2, p)),
      grid: {
        layout: spec.views.summary,
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: { GROUP1: by1.name, GROUP2: by2.name === 'None' ? '' : by2.name },
        title,
        period,
        pageWise,
      },
    };
  }

  return { run, options: spec.options };
}

/**
 * JSM's own ORDER BY for the grouped summary:
 *   Amt Asc / Amt Desc   ZGROUP1, NET_TOT asc|desc, ZGROUP2
 *   OrderBy1 = Month     YEAR_NO, MONTH_NO, ZGROUP1
 *   OrderBy2 = Month     ZGROUP1, YEAR_NO, MONTH_NO, ZGROUP2
 *   otherwise            ZGROUP1, ZGROUP2, YEAR_NO, MONTH_NO
 */
function sortKeys(by1, by2, p) {
  const sort = String(p.sort ?? '').toLowerCase();
  if (sort === 'asc' || sort === 'desc') {
    return ['ZGROUP1', { field: 'NET_TOT', dir: sort }, 'ZGROUP2'];
  }
  if (by1.name === 'Month') return ['YEAR_NO', 'MONTH_NO', 'ZGROUP1'];
  if (by2.name === 'Month') return ['ZGROUP1', 'YEAR_NO', 'MONTH_NO', 'ZGROUP2'];
  return ['ZGROUP1', 'ZGROUP2', 'YEAR_NO', 'MONTH_NO'];
}

module.exports = { registerSummaryReport, ORDER_FIELDS, UNRECORDED };
