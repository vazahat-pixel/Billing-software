'use strict';

/**
 * JSM: Reports › Purchase › Purchase Stock / Purchase Stock(Godown) / Purchase Stock(Old)
 * (Rpt_Purchase_Stock_LRWiseReport, Rpt_Purchase_Stock_Godown_Report, Rpt_Purchase_Stock).
 *
 * Three windows on one question — what of a purchase is still lying in stock — each asking it its
 * own way:
 *
 *   Old (Rpt_Purchase_Stock, "Purchase Stock"): the bill, what came in, what went out to the mill
 *     or back to the supplier, and what is left. Pending is `{PU_MTS} <> {BILL_MTS}`, Clear is
 *     `{PU_MTS} = {BILL_MTS}` (Genrate_Reports), printed Normal, Party Wise or Item Wise, with a
 *     "With Unadjust" tick that unions in the mill challans naming no purchase bill.
 *   LrWise (Rpt_Purchase_Stock_LRWiseReport): the same bills with the LR they came on. Pending is
 *     `A.SALES_NO = 'P'` — the goods have not been sold on — Clear is `A.SALES_NO <> 'P'`, and the
 *     two Order By boxes gather on Register, Party or Item.
 *   Godown (Rpt_Purchase_Stock_Godown_Report): a line per goods-received lot, with what has been
 *     issued out of it and what is left. Pending is `(A.BAL_QTY <> 0)`, Clear is `A.BAL_QTY = 0`.
 *
 * All three read sources/purchaseStock.js, so they cannot disagree with each other. The pending
 * test differs by screen exactly as JSM's does: the quantity still unissued for the first two, the
 * lot's own remaining quantity for the Godown one.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const { loadPurchaseStockRows, loadUnadjustedIssueRows } = require('../sources/purchaseStock');

/** Register / Party / Item, the choices the two Order By boxes share. */
const GROUP_FIELDS = { None: null, Register: 'BOOK', Party: 'PARTY', Item: 'ITEM' };

const LISTS = { parties: 'PARTY', items: 'ITEM' };

function fieldOf(choice, fallback) {
  const name = String(choice ?? '').trim() || fallback;
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

/** 1-Pending / 2-Clear / 3-All, each screen testing what JSM's own SQL tests. */
function statusFilter(raw, pendingTest) {
  const n = Number(String(raw ?? '1').trim().split('-')[0]) || 1;
  if (n === 2) return (r) => !pendingTest(r);
  if (n === 3) return () => true;
  return pendingTest;
}

/** JSM's A-Normal / B-Party / C-Item on the Old screen. */
const CATEGORIES = {
  1: { key: null, caption: '', title: 'Purchase Stock Detail' },
  2: { key: 'PARTY', caption: 'PARTY', title: 'Party Wise Purchase Stock Detail' },
  3: { key: 'ITEM', caption: 'ITEM', title: 'Item Wise Purchase Stock Detail' },
};

async function baseRows(companyId, p, deps) {
  let rows = deps.rows || await loadPurchaseStockRows(companyId);
  if (p.withUnadjust) {
    rows = [...rows, ...(deps.unadjusted || await loadUnadjustedIssueRows(companyId))];
  }
  rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);
  return rows;
}

/** Rpt_Purchase_Stock — the Old screen. */
async function runOld(companyId, p = {}, deps = {}) {
  const n = Number(String(p.category ?? '1').trim().split('-')[0]) || 1;
  const cat = CATEGORIES[n] || CATEGORIES[1];
  const rows = (await baseRows(companyId, p, deps))
    .filter(statusFilter(p.status, (r) => Math.abs(round(r.PU_MTS) - round(r.BILL_MTS)) >= 0.005));

  const out = rows.map((r) => ({
    SRAL_NO: r.SRAL_NO,
    BILL_NO: r.BILL_NO,
    BILL_DATE: r.BILL_DATE,
    PARTY: r.PARTY,
    ST_NAME: r.ST_NAME,
    ITEM: r.ITEM,
    PU_PCS: r.PU_PCS,
    PU_MTS: r.PU_MTS,
    PU_RATE: r.PU_RATE,
    NET_TOT: r.NET_TOT,
    CH_NO: r.CH_NO,
    CHLN_DATE: r.CHLN_DATE,
    ISS_PCS: r.ISS_PCS,
    ISS_MTS: r.ISS_MTS,
    BILL_MTS: r.BILL_MTS,
    STK_MTS: r.STK_MTS,
    XGROUP: cat.key ? (r[cat.key] || '') : '',
  }));

  return {
    rows: orderRows(out, [
      cat.key ? 'XGROUP' : null,
      'BILL_DATE',
      { field: 'BILL_NO', dir: 'asc', numeric: true },
    ].filter(Boolean)),
    grid: {
      layout: 'JSM_VW_PUR_STK',
      variant: 1,
      groupColumns: cat.key ? ['XGROUP'] : [],
      groupDisplays: cat.key ? [cat.caption] : [],
      captions: {},
      title: cat.title,
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

/** Rpt_Purchase_Stock_LRWiseReport. */
async function runLrWise(companyId, p = {}, deps = {}) {
  const by1 = fieldOf(p.orderBy1, 'None');
  const by2 = fieldOf(p.orderBy2, 'None');
  const rows = (await baseRows(companyId, p, deps))
    .filter(statusFilter(p.status, (r) => Math.abs(round(r.STK_MTS)) >= 0.005));

  const levelled = rows.map((r) => ({
    SRAL_NO: r.SRAL_NO,
    NCBILL_NO: r.NCBILL_NO,
    BILL_DATE: r.BILL_DATE,
    PARTY: r.PARTY,
    ITEM: r.ITEM,
    LRNO: r.LRNO,
    SP_TYPE: r.SP_TYPE,
    TO_PCS: r.PU_PCS,
    TO_QTY: r.PU_MTS,
    IT_RATE: r.PU_RATE,
    NET_TOT: r.NET_TOT,
    STK_MTS: r.STK_MTS,
    // JSM counts the bills sharing an LR; a blank LR counts as its own.
    LR_COUNT: 0,
    ZGROUP1: by1.field ? (r[by1.field] || '') : '',
    ZGROUP2: by2.field ? (r[by2.field] || '') : '',
  }));

  const perLr = new Map();
  for (const r of levelled) {
    const key = String(r.LRNO ?? '').trim();
    if (!key) continue;
    perLr.set(key, (perLr.get(key) || 0) + 1);
  }
  for (const r of levelled) r.LR_COUNT = perLr.get(String(r.LRNO ?? '').trim()) || 1;

  const keys = [by1.field ? 'ZGROUP1' : null, by2.field ? 'ZGROUP2' : null].filter(Boolean);

  return {
    rows: orderRows(levelled, [...keys, 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }]),
    grid: {
      layout: 'JSM_VW_PURCHASE_STOCK_LRWISE_REPORT',
      variant: 1,
      groupColumns: keys,
      groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
      captions: {},
      title: `${by1.name} Wise Purchase Stock Report`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

/** Rpt_Purchase_Stock_Godown_Report — a line per received lot. */
async function runGodown(companyId, p = {}, deps = {}) {
  const by1 = fieldOf(p.orderBy1, 'None');
  const by2 = fieldOf(p.orderBy2, 'None');
  const bills = await baseRows(companyId, p, deps);

  const lines = [];
  for (const b of bills) {
    for (const l of b._lots || []) {
      lines.push({
        SRAL_NO: b.SRAL_NO,
        GP_NO: l.GP_NO,
        BILL_DATE: b.BILL_DATE,
        PARTY: b.PARTY,
        ITEM: l.ITEM,
        GODOWN: b.GODOWN,
        BOOK: b.BOOK,
        G_PCS: l.G_PCS,
        G_QTY: l.G_QTY,
        NCCHLN_NO: b.CH_NO,
        CHLN_DATE: b.CHLN_DATE,
        ISS_PCS: l.ISS_PCS,
        ISS_QTY: l.ISS_QTY,
        BAL_PCS: l.BAL_PCS,
        BAL_QTY: l.BAL_QTY,
      });
    }
  }

  const kept = lines.filter(statusFilter(p.status, (r) => Math.abs(round(r.BAL_QTY)) >= 0.005));
  const levelled = kept.map((r) => ({
    ...r,
    ZGROUP1: by1.field ? (r[by1.field] || '') : '',
    ZGROUP2: by2.field ? (r[by2.field] || '') : '',
  }));
  const keys = [by1.field ? 'ZGROUP1' : null, by2.field ? 'ZGROUP2' : null].filter(Boolean);

  return {
    rows: orderRows(levelled, [...keys, 'BILL_DATE', { field: 'SRAL_NO', dir: 'asc', numeric: true }, 'GP_NO']),
    grid: {
      layout: 'JSM_VW_PURCHASE_STOCK_GODOWN',
      variant: 1,
      groupColumns: keys,
      groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
      captions: {},
      title: `${by1.name} Wise Purchase(Godown) Stock Report`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId) {
  const rows = await loadPurchaseStockRows(companyId);
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { registers: u('BOOK'), parties: u('PARTY'), items: u('ITEM'), godowns: u('GODOWN') };
}

module.exports = {
  old: { run: runOld, options },
  lrWise: { run: runLrWise, options },
  godown: { run: runGodown, options },
};
