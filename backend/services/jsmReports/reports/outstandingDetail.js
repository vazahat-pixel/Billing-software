'use strict';

/**
 * JSM: Others Reports › Outstanding › Debitors / Creditors › Detail
 * (Rpt_Jsm_Os_Sales_Detail / Rpt_Jsm_Os_Purchase_Detail).
 *
 * The same outstanding listing as the Normal screen, with each bill's item lines printed under
 * it — JSM's captured layout is master/detail: the bill row carries BILL.DATE, BILL.NO, PARTY,
 * BILL.AMT, TOT REC, TOT RG.AMT, BALANCE and DAYS, and the line rows carry ITEM, PCS, QTY, RATE.
 *
 * Both halves come from engines already proved against JSM: the bill figures from
 * sources/outstanding.js (reportService.getOutstanding), the lines from the bill registers.
 * Nothing is recomputed — the lines are only attached to the bill they belong to.
 */
const { orderRows, inList, inDateRange } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');
const { loadSalesRegisterRows, loadPurchaseRegisterRows } = require('../sources/billRegister');

const LISTS = { parties: 'PARTY', brokers: 'BROKER', stations: 'STATION', books: 'BOOK' };
const BILL_TAIL = ['Q_TYPE', 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }, '_billId'];

/** JSM's Category Wise on these screens, the same five the Normal screen offers. */
const CATEGORIES = {
  1: { key: null, caption: '' },
  2: { key: 'PARTY', caption: 'PARTY' },
  3: { key: 'BROKER', caption: 'BROKER', order2: 'PARTY' },
  4: { key: 'STATION', caption: 'CITY', order2: 'PARTY' },
  5: { key: 'MAINGROUP', caption: 'MAINGROUP', order2: 'PARTY' },
};

function detailReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const n = Number(String(p.category ?? '1').trim().split('-')[0]) || 1;
    const cat = CATEGORIES[n] || CATEGORIES[1];

    let bills = deps.rows || await loadOutstandingRows(companyId, spec.kind, {
      asOn: p.to,
      billDateFrom: p.from,
      billDateTo: p.to,
      status: p.status === '2-Clear' ? 'Paid' : (p.status === '3-All' ? 'All' : 'Pending'),
    });
    for (const [param, field] of Object.entries(LISTS)) bills = inList(bills, field, p[param]);

    // The item lines of the very bills listed, keyed the way both sides name a bill.
    const register = deps.register
      || inDateRange(await spec.load(companyId), 'BILL_DATE', p.from, p.to);
    const linesOf = new Map();
    for (const r of register) {
      linesOf.set(`${String(r.NCBILL_NO ?? '').trim()}|${String(r.PARTY ?? '').trim()}`, r._lines || []);
    }

    const out = [];
    for (const b of orderRows(bills.map((r) => ({ ...r, XGROUP: cat.key ? (r[cat.key] || '') : '' })),
      cat.key ? ['XGROUP', cat.order2, ...BILL_TAIL].filter(Boolean) : BILL_TAIL)) {
      const lines = linesOf.get(`${String(b.NCBILL_NO ?? '').trim()}|${String(b.PARTY ?? '').trim()}`) || [];
      if (!lines.length) { out.push({ ...b }); continue; }
      for (const l of lines) out.push({ ...b, ...l });
    }

    return {
      rows: out,
      grid: {
        layout: spec.view,
        variant: 1,
        groupColumns: cat.key ? ['XGROUP'] : [],
        groupDisplays: cat.key ? [cat.caption] : [],
        primaryDetailColumn: '_billId',
        captions: cat.key ? { GROUP2: cat.caption } : {},
        title: `Outstanding ${spec.noun} Report`,
        period: `BILLDATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId) {
    const rows = await loadOutstandingRows(companyId, spec.kind, {});
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return { parties: u('PARTY'), brokers: u('BROKER'), stations: u('STATION'), books: u('BOOK') };
  }

  return { run, options };
}

module.exports = {
  sales: detailReport({
    kind: 'sales', load: loadSalesRegisterRows, view: 'JSM_VW_OS_SALES_DETAIL', noun: 'Sales',
  }),
  purchase: detailReport({
    kind: 'purchase', load: loadPurchaseRegisterRows, view: 'JSM_VW_OS_PURCHASE_DETAIL', noun: 'Purchase',
  }),
};
