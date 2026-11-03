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

const CATEGORIES = {
  1: { key: 'PARTY', caption: 'PARTY' },      // Normal — JSM's own screens group by party too
  2: { key: 'PARTY', caption: 'PARTY' },
  3: { key: 'BROKER', caption: 'BROKER' },
  4: { key: 'STATION', caption: 'CITY' },
  5: { key: 'MAINGROUP', caption: 'MAINGROUP' },
};

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

  async function run(companyId, p = {}, deps = {}) {
    const category = categoryOf(p.category, spec.categories);
    const cat = CATEGORIES[category];
    const period = `BILLDATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;

    let rows = deps.rows || await loadOutstandingRows(companyId, spec.kind, toFilters(p));
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    const withX = rows.map((r) => ({ ...r, XGROUP: r[cat.key] || '' }));
    const ordered = orderRows(withX, ['XGROUP', 'BILL_DATE', 'NCBILL_NO', '_billId']);

    return {
      rows: ordered,
      grid: {
        layout: spec.view,
        variant: 1,
        groupColumns: ['XGROUP'],
        groupDisplays: [cat.caption],
        primaryDetailColumn: '_billId',
        captions: { GROUP2: cat.caption },
        title: `${spec.noun} Outstanding`,
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
