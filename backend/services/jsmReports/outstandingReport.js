'use strict';

/**
 * Builder for JSM's Outstanding family: Debitor O/s (Rpt_Jsm_Os_Sales), Creditor O/s
 * (Rpt_Jsm_Os_Purchase), Process O/s (Rpt_Jsm_Os_Process), Jobwork O/s (Rpt_Jsm_Os_Jobwork) —
 * plus each one's Age Analysis screen. One shared shape: the screen's "Category Wise" combo
 * decides what PARTY is grouped/relabelled as, exactly like registerReport.js's bill registers.
 *
 * The balance, aging and every bill figure come from sources/outstanding.js, which is a thin
 * reshape of reportService.getOutstanding() — nothing here recomputes a figure.
 */
const { loadOutstandingRows, loadOutstandingAgeRows } = require('./sources/outstanding');
const { orderRows, inList, groupBy, round } = require('./jcEngine');

/**
 * JSM's own Category Wise options, from the decompiled screens (Rpt_Jsm_Os_Sales /
 * _Purchase / _Process / _Jobwork → Genrate_Reports).
 *
 * 1-Normal is NOT a party grouping: JSM selects `'' AS JS_GROUP` for it, i.e. one flat list of
 * bills with no group headers at all, ordered by bill date. Every other category groups on its
 * own column and breaks ties on the party first.
 */
const CATEGORIES = {
  1: { key: null, caption: '', title: 'Outstanding {noun} Report' },
  2: { key: 'PARTY', caption: 'PARTY', title: 'Party Wise ' },
  3: { key: 'BROKER', caption: 'BROKER', order2: 'PARTY', title: 'Broker Wise ' },
  4: { key: 'STATION', caption: 'CITY', order2: 'PARTY', title: 'City Wise ' },
  5: { key: 'MAINGROUP', caption: 'MAINGROUP', order2: 'PARTY', title: 'MainGroup Wise ', noQType: true },
};

/**
 * The bill's own number, which JSM holds as an integer — never sorted as text.
 * Q_TYPE (JSM's row kind: the bill itself vs an adjustment booked against it) sorts just before
 * it on every category but Main Group; rows this software builds carry no Q_TYPE, so there it
 * simply leaves the order alone.
 */
const BILL_TAIL = ['BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }, '_billId'];
const tailFor = (cat, spec) => ((cat.noQType && !spec.qtypeInMainGroup) ? BILL_TAIL : ['Q_TYPE', ...BILL_TAIL]);

const LISTS = { parties: 'PARTY', brokers: 'BROKER', stations: 'STATION', books: 'BOOK', hastes: 'HASTE', states: 'STATE', msmeTypes: 'MSME_TYPE', mainGroups: 'MAINGROUP' };
const SUM = ['NET_TOT', 'ADJUST', 'GOODS_RTN', 'TOT_DISC', 'TOT_BALANCE'];
const AGE_SUM = ['TOT_BALANCE', 'BAL_AMT1', 'BAL_AMT2', 'BAL_AMT3', 'BAL_AMT4', 'BAL_UNADJ'];

function categoryOf(raw, offered) {
  const n = Number(String(raw ?? '').trim().split('-')[0]);
  return offered.includes(n) ? n : offered[0];
}

/**
 * @param {object} spec
 *   kind        'sales' | 'purchase' | 'process' | 'jobwork'
 *   view        captured layout name (JSM_VW_OS_SALES, ...)
 *   ageView     captured layout name for the Age Analysis screen
 *   categories  category numbers this register offers, screen order
 *   noun        'Debitor' | 'Creditor' | 'Process' | 'Jobwork'
 */
function outstandingReport(spec) {
  function toFilters(p) {
    return {
      asOn: p.asOn,
      billDateFrom: p.from,
      billDateTo: p.to,
      paidDateFrom: p.paidFrom,
      paidDateTo: p.paidTo,
      partyIds: p.partyIds,
      brokerIds: p.brokerIds,
      stations: p.stations,
      hastes: p.hastes,
      bookIds: p.books,
      states: p.states,
      msmeTypes: p.msmeTypes,
      mainGroups: p.mainGroups,
      dueDaysMin: p.dueDaysMin,
      onlyFullBill: p.onlyDirectBillClose,
      onlyPartReceived: p.onlyPartReceived,
      includeLastYear: p.includeLastYear !== false,
      status: p.status === '2-Clear' || p.status === 'Clear' ? 'Paid' : (p.status === '3-All' || p.status === 'All' ? 'All' : 'Pending'),
      onlyRgPending: p.onlyRgPending,
      onlyDirectBillClose: p.onlyDirectBillClose,
      withLedgerBalance: p.withLedgerBalance !== false,
    };
  }

  /**
   * JSM's own window titles. Sales words them "<X> Wise Sales Outstanding Report"; Purchase,
   * Process and Jobwork word the same thing "<X> Wise Outstanding <noun> Report". Category
   * 1-Normal is just "Outstanding <noun> Report" on all four.
   */
  function titleFor(cat) {
    const noun = spec.titleNoun || spec.noun;
    if (!cat.key) return `Outstanding ${noun} Report`;
    return spec.titleNounFirst
      ? `${cat.title}${noun} Outstanding Report`
      : `${cat.title}Outstanding ${noun} Report`;
  }

  async function run(companyId, p = {}, deps = {}) {
    const category = categoryOf(p.category, spec.categories);
    const cat = CATEGORIES[category];
    const period = `BILLDATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;

    let rows = deps.rows || await loadOutstandingRows(companyId, spec.kind, toFilters(p));
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    const withX = rows.map((r) => ({ ...r, XGROUP: cat.key ? (r[cat.key] || '') : '' }));
    const ordered = orderRows(withX, cat.key
      ? ['XGROUP', cat.order2, ...tailFor(cat, spec)].filter(Boolean)
      : tailFor(cat, spec));

    return {
      rows: ordered,
      grid: {
        layout: spec.view,
        variant: 1,
        // 1-Normal is a flat list — no group header, no group totals.
        groupColumns: cat.key ? ['XGROUP'] : [],
        groupDisplays: cat.key ? [cat.caption] : [],
        primaryDetailColumn: '_billId',
        captions: cat.key ? { GROUP2: cat.caption } : {},
        title: titleFor(cat),
        period,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function runAge(companyId, p = {}, deps = {}) {
    const category = categoryOf(p.category, spec.categories.filter((c) => c <= 3));
    const cat = category === 3 ? CATEGORIES[3] : CATEGORIES[1];

    let rows = deps.rows || await loadOutstandingAgeRows(companyId, spec.kind, toFilters(p));
    for (const [param, field] of Object.entries(LISTS)) {
      if (field === 'PARTY' || field === 'BROKER') rows = inList(rows, field, p[param]);
    }

    if (cat.key !== 'PARTY') {
      const grouped = groupBy(rows.map((r) => ({ ...r, GROUP2: r[cat.key] || '' })), ['GROUP2'], { sum: AGE_SUM });
      for (const g of grouped) for (const f of AGE_SUM) g[f] = round(g[f]);
      rows = grouped;
    } else {
      rows = rows.map((r) => ({ ...r, GROUP2: r.PARTY }));
    }

    return {
      rows: orderRows(rows, ['GROUP2']),
      grid: {
        layout: spec.ageView,
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: { GROUP2: cat.caption },
        title: `${spec.noun} Age Analysis`,
        period: `BILLDATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId, p = {}, deps = {}) {
    const rows = deps.rows || await loadOutstandingRows(companyId, spec.kind, {});
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return Object.fromEntries(Object.entries(LISTS).map(([k, f]) => [k, u(f)]));
  }

  return { run, runAge, options, categories: spec.categories };
}

module.exports = { outstandingReport, CATEGORIES };
