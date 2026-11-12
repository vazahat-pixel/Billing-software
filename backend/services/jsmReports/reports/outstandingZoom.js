'use strict';

/**
 * JSM: Others Reports › Outstanding Zoom › Debitors / Creditors / Process / JobWork
 * (Rpt_Outstating_Report, titled "Outstanding").
 *
 * The same outstanding bills as the Normal screens, on JSM's older and richer window: three
 * Group By combos instead of one Category Wise, and a Summary tick that totals each group
 * instead of listing the bills.
 *
 * Every figure comes from sources/outstanding.js — the engine the Normal screens already use and
 * whose output is replayed against JSM — so this screen cannot disagree with them.
 */
const { orderRows, inList, groupBy, round, MONTHS } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');

/** JSM's Group By choices -> the column each one groups on. */
const GROUP_FIELDS = {
  None: null,
  Register: 'BOOK',
  Party: 'PARTY',
  Broker: 'BROKER',
  Station: 'STATION',
  MainGroup: 'MAINGROUP',
  Haste: 'HASTE',
  MonthWise: 'MONTH',
};

/** Choices JSM offers that this software does not record against a bill. */
const UNRECORDED = ['Company', 'Discount', 'SalesMan'];

const SUM = ['NET_TOT', 'ADJUST', 'GOODS_RTN', 'TOT_DISC', 'TOT_BALANCE'];
const LISTS = { parties: 'PARTY', brokers: 'BROKER', stations: 'STATION', books: 'BOOK', hastes: 'HASTE' };

function fieldOf(choice, fallback) {
  const name = String(choice ?? '').trim() || fallback;
  if (UNRECORDED.includes(name)) {
    const err = new Error(`This software does not record ${name} against a bill, so it cannot group by it`);
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

function zoomReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const by1 = fieldOf(p.groupBy1, 'Party');
    const by2 = fieldOf(p.groupBy2, 'None');
    const by3 = fieldOf(p.groupBy3, 'None');
    const summary = p.summary === true || String(p.summary) === 'true';

    let rows = deps.rows || await loadOutstandingRows(companyId, spec.kind, {
      asOn: p.to,
      billDateFrom: p.from,
      billDateTo: p.to,
      status: p.status === '2-Clear' ? 'Paid' : (p.status === '3-All' ? 'All' : 'Pending'),
      includeLastYear: p.includeLastYear !== false,
      onlyFullBill: p.onlyFullBill,
      onlyPartReceived: p.onlyPartReceived,
      dueDaysMin: p.dueDays,
    });
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    const withMonth = rows.map((r) => ({
      ...r,
      MONTH: r.BILL_DATE ? MONTHS[new Date(r.BILL_DATE).getUTCMonth()] : '',
    }));
    const levelled = withMonth.map((r) => ({
      ...r,
      ZGROUP1: by1.field ? (r[by1.field] || '') : '',
      ZGROUP2: by2.field ? (r[by2.field] || '') : '',
      ZGROUP3: by3.field ? (r[by3.field] || '') : '',
    }));

    const keys = ['ZGROUP1', by2.field ? 'ZGROUP2' : null, by3.field ? 'ZGROUP3' : null].filter(Boolean);
    const title = `${by1.name} Wise Outstanding ${spec.noun} Report`;
    const period = `BILLDATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;

    if (summary) {
      const grouped = groupBy(levelled, keys, { sum: SUM });
      for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);
      return {
        rows: orderRows(grouped, keys),
        grid: {
          layout: 'JSM_VW_OS_ZOOM_SUMMARY',
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

    return {
      rows: orderRows(levelled, [...keys, 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }, '_billId']),
      grid: {
        layout: 'JSM_VW_OS_ZOOM',
        variant: 1,
        groupColumns: ['ZGROUP1'],
        groupDisplays: [by1.name],
        primaryDetailColumn: '_billId',
        captions: {},
        title,
        period,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId) {
    const rows = await loadOutstandingRows(companyId, spec.kind, {});
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return Object.fromEntries(Object.entries(LISTS).map(([k, f]) => [k, u(f)]));
  }

  return { run, options };
}

module.exports = {
  sales: zoomReport({ kind: 'sales', noun: 'Sales' }),
  purchase: zoomReport({ kind: 'purchase', noun: 'Purchase' }),
  process: zoomReport({ kind: 'process', noun: 'Process' }),
  jobwork: zoomReport({ kind: 'jobwork', noun: 'Jobwork' }),
};
