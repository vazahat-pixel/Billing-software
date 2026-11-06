'use strict';

/**
 * Builder for JSM's Sales Detail(Digital) / Purchase Detail screens
 * (Rpt_SalesRegisterDetailDigital_Report / Rpt_PurchaseRegisterDetail_Report), on the main menu
 * path as "Sales ItemDetail" and "Purchase ItemDetail".
 *
 * Item lines, grouped on two combos at once and optionally split by month, exactly as the
 * decompiled form's btn_screen_Click builds it:
 *
 *   SELECT 'SUMMARY' AS REGISTER, <GroupBy1> AS ZGROUP, <GroupBy2> AS ZGROUP2,
 *          [MONTH AS ZGROUP3,] MAX(YEAR_NO), MAX(MONTH_NO),
 *          SUM(IT_PCS) AS TOT_PCS, SUM(IT_QTY) AS TOT_QTY, SUM(IT_QTY1) AS TOT_QTY1,
 *          SUM(IT_AMOUNT) AS TOT_AMOUNT ... GROUP BY <both> [, MONTH]
 *
 * with "Summary Reports" unticked giving the bills themselves instead.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('./jcEngine');

/** JSM's Group By choices -> the column each one groups on, bill level or line level. */
const GROUP_FIELDS = {
  Register: 'REGISTER',
  Party: 'PARTY',
  Broker: 'BROKER',
  City: 'STATION',
  MainGroup: 'MAINGROUP',
  Haste: 'HASTE',
  Transport: 'TRANSPORT',
  Item: 'ITEM_NAME',
  Category: 'ITEM_GROUP',
  DateWise: 'BILL_DATE',
  Rate: 'IT_RATE',
  ItemDesc: 'IT_DISC1',
  None: null,
};

/** Choices JSM offers that this software does not record. */
const UNRECORDED = ['SalesMan', 'Area'];

const SUM = ['TOT_PCS', 'TOT_QTY', 'TOT_QTY1', 'TOT_AMOUNT'];
const LISTS = { parties: 'PARTY', brokers: 'BROKER', books: 'REGISTER', items: 'ITEM_NAME' };

function fieldOf(choice, fallback) {
  const name = String(choice ?? '').trim() || fallback;
  if (UNRECORDED.includes(name)) {
    const err = new Error(`This software does not record ${name}, so it cannot group by it`);
    err.status = 400;
    throw err;
  }
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Group By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

/**
 * JSM's own ORDER BY (btn_screen_Click):
 *   Pcs / Qty / Amt + Asc|Desc   TOT_<x> asc|desc, YEAR_NO, MONTH_NO
 *   GroupBy1 = Month             YEAR_NO, MONTH_NO, ZGROUP, ZGROUP2
 *   month split on              ZGROUP, ZGROUP2, YEAR_NO, MONTH_NO, ZGROUP3
 *   otherwise                    ZGROUP, ZGROUP2, YEAR_NO, MONTH_NO
 */
function sortKeys(by1, monthWise, p) {
  const dir = p.sort === 'asc' || p.sort === 'desc' ? p.sort : null;
  const on = { Pcs: 'TOT_PCS', Qty: 'TOT_QTY', Amt: 'TOT_AMOUNT' }[String(p.sortBy ?? '').trim()];
  if (dir && on) return [{ field: on, dir }, 'YEAR_NO', 'MONTH_NO'];
  if (by1.name === 'Month') return ['YEAR_NO', 'MONTH_NO', 'ZGROUP', 'ZGROUP2'];
  if (monthWise) return ['ZGROUP', 'ZGROUP2', 'YEAR_NO', 'MONTH_NO', 'ZGROUP3'];
  return ['ZGROUP', 'ZGROUP2', 'YEAR_NO', 'MONTH_NO'];
}

/**
 * @param {object} spec
 *   load   (companyId) => bill rows, each with its `_lines`
 *   views  { summary, bills } layout names
 *   noun   'Sales' | 'Purchase'
 */
function registerDetailReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const by1 = fieldOf(p.groupBy1, 'Register');
    const by2 = fieldOf(p.groupBy2, 'None');
    const monthWise = p.monthWise === true || String(p.monthWise) === 'true';
    const summary = p.summaryReports === undefined || p.summaryReports === null
      || p.summaryReports === true || String(p.summaryReports) === 'true';

    let bills = inDateRange(deps.rows || await spec.load(companyId), 'BILL_DATE', p.from, p.to);
    for (const [param, field] of Object.entries(LISTS)) {
      if (field !== 'ITEM_NAME') bills = inList(bills, field, p[param]);
    }

    const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
    const title = `${by1.name} Wise ${spec.noun} Detail Report`;
    const pageWise = p.printout === '2-PageWise';

    if (!summary) {
      const out = [];
      for (const b of bills) {
        for (const l of (b._lines || [])) out.push({ ...b, ...l, _lines: undefined });
      }
      return {
        rows: orderRows(out, ['BILL_DATE', { field: 'SRAL_NO', dir: 'asc', numeric: true }]),
        grid: {
          layout: spec.views.bills,
          variant: 1,
          groupColumns: [],
          groupDisplays: [],
          primaryDetailColumn: 'CO_ENT_NO',
          captions: {},
          title,
          period,
          pageWise,
        },
      };
    }

    const lines = [];
    for (const b of bills) {
      for (const l of (b._lines || [])) {
        const merged = { ...b, ...l };
        if (Array.isArray(p.items) && p.items.length) {
          const want = new Set(p.items.map((s) => String(s).trim().toUpperCase()));
          if (!want.has(String(l.ITEM_NAME).trim().toUpperCase())) continue;
        }
        lines.push({
          ZGROUP: by1.field ? (merged[by1.field] ?? '') : '',
          ZGROUP2: by2.field ? (merged[by2.field] ?? '') : '',
          ZGROUP3: monthWise ? (b.MONTH || '') : '',
          YEAR_NO: b.YEAR_NO,
          MONTH_NO: b.MONTH_NO,
          TOT_PCS: l.IT_PCS,
          TOT_QTY: l.IT_QTY,
          TOT_QTY1: l.IT_QTY,
          TOT_AMOUNT: l.IT_AMOUNT,
        });
      }
    }

    const keys = ['ZGROUP', by2.field ? 'ZGROUP2' : null, monthWise ? 'ZGROUP3' : null].filter(Boolean);
    const grouped = groupBy(lines, keys, { sum: SUM }, (first) => ({
      YEAR_NO: first.YEAR_NO, MONTH_NO: first.MONTH_NO, ZGROUP2: first.ZGROUP2, ZGROUP3: first.ZGROUP3,
    }));
    for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);

    return {
      rows: orderRows(grouped, sortKeys(by1, monthWise, p)),
      grid: {
        layout: spec.views.summary,
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: { ZGROUP: by1.name, ZGROUP2: by2.name === 'None' ? '' : by2.name },
        title,
        period,
        pageWise,
      },
    };
  }

  return { run, options: spec.options };
}

module.exports = { registerDetailReport, GROUP_FIELDS, UNRECORDED };
