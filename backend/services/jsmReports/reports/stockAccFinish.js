'use strict';

/**
 * JSM: Reports › Acc Stock Reports › Stock Ledger New and Reports › Inv Stock Ledger › Finish At
 * Shop Stock(Book-Acc) (Rpt_Stock_Acc_Finish_Summary, "Summary - Stock Reports").
 *
 * The account books' stock: what the item master opened with, what the purchase and sales books and
 * their returns moved, per item (or category), in Qty, Pcs or Kgs. JSM unions TMP_VW_STOCK from
 * MST_IT_MAST (OP_STOCK) and the four bill books and gathers it on GroupBy 1 / GroupBy 2; the
 * Y-Summary choice totals each group, X-Detail keeps a line per bill date and book. What was
 * dated before From joins OP.STOCK. CLS.STK = OP.STOCK + PURCHASE + SALES RETURN − SALES − PURCHASE RETURN.
 */
const { orderRows, inList, groupBy, round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');

const BILL_VALUE = { 1: 'IT_QTY', 2: 'IT_PCS', 3: 'IT_KGS' };
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const G1 = { Item: 'ITEM_NAME', Category: 'GRIT_NAME' };
const G2 = { None: null, Item: 'ITEM_NAME', Category: 'GRIT_NAME', Book: 'BOOK_NAME', Month: '__month' };
const FIELDS = ['OP_STOCK', 'SALES', 'PURCHASE', 'SL_RTN', 'PU_RTN'];

async function movements(companyId, by) {
  const value = BILL_VALUE[by];
  const [pu, sl, slr, pur] = await Promise.all([
    src.loadPurchaseRegisterRows(companyId),
    src.loadSalesRegisterRows(companyId),
    src.loadReturnRegisterRows(companyId, 'Sales'),
    src.loadReturnRegisterRows(companyId, 'Purchase'),
  ]);
  const rows = [];
  const add = (bills, field) => {
    for (const b of bills) {
      for (const l of b._lines || []) {
        rows.push({
          ITEM_NAME: l.ITEM_NAME || '', GRIT_NAME: l.ITEM_CATEGORY || l.ITEM_GROUP || '',
          BILL_DATE: b.BILL_DATE, BOOK_NAME: b.BOOK || '', [field]: round(Number(l[value] || 0)),
        });
      }
    }
  };
  add(pu, 'PURCHASE');
  add(sl, 'SALES');
  add(slr, 'SL_RTN');
  add(pur, 'PU_RTN');
  if (by === 1) {
    const Item = require('../../../models/Item');
    const items = await Item.find({ companyId }).select('name group category openingQty').lean();
    for (const i of items) {
      const op = round(Number(i.openingQty || 0));
      if (op) rows.push({ ITEM_NAME: i.name || '', GRIT_NAME: i.category || i.group || '', BILL_DATE: null, BOOK_NAME: '', OP_STOCK: op, __master: true });
    }
  }
  return rows;
}

const closing = (g) => round(g.OP_STOCK + g.PURCHASE + g.SL_RTN - g.SALES - g.PU_RTN);

async function run(companyId, p = {}, deps = {}) {
  const by = Number(String(p.itemBy || '1').split('-')[0]) || 1;
  if (!BILL_VALUE[by]) throw bad(`Unknown unit: ${p.itemBy}`);
  const g1Name = p.orderBy1 || 'Item';
  const g2Name = p.orderBy2 || 'None';
  if (!(g1Name in G1) || !(g2Name in G2)) throw bad('Unknown GroupBy');
  const all = deps.rows || await movements(companyId, by);

  const before = p.from ? all.filter((r) => r.__master || (r.BILL_DATE && dayKey(r.BILL_DATE) < p.from)) : all.filter((r) => r.__master);
  const within = all.filter((r) => !r.__master && r.BILL_DATE && (!p.from || dayKey(r.BILL_DATE) >= p.from) && (!p.to || dayKey(r.BILL_DATE) <= p.to));

  // Everything dated before From, plus the master's own figure, becomes OP.STOCK.
  const opening = new Map();
  for (const r of before) {
    const net = r.__master ? r.OP_STOCK : (r.PURCHASE || 0) + (r.SL_RTN || 0) - (r.SALES || 0) - (r.PU_RTN || 0);
    const k = `${r.ITEM_NAME}\u0001${r.BOOK_NAME || ''}`;
    const cur = opening.get(k) || { net: 0, item: r.ITEM_NAME, cat: r.GRIT_NAME, book: r.BOOK_NAME || '' };
    cur.net += net;
    opening.set(k, cur);
  }
  let rows = within.map((r) => ({ ...r, __day: dayKey(r.BILL_DATE), __month: `${MONTHS[new Date(r.BILL_DATE).getUTCMonth()]}-${new Date(r.BILL_DATE).getUTCFullYear()}` }));
  for (const o of opening.values()) {
    if (round(o.net) !== 0) rows.push({ ITEM_NAME: o.item, GRIT_NAME: o.cat, BILL_DATE: p.from ? new Date(p.from) : null, __day: p.from || '', BOOK_NAME: o.book, OP_STOCK: round(o.net), __month: '' });
  }
  rows = inList(rows, 'ITEM_NAME', p.items);
  rows = inList(rows, 'GRIT_NAME', p.categories);
  rows = inList(rows, 'BOOK_NAME', p.books);

  const keys = [G1[g1Name], G2[g2Name]].filter(Boolean).filter((k, i, a) => a.indexOf(k) === i);
  if (!p.summary) keys.push('__day', 'BOOK_NAME');
  const grouped = groupBy(rows, keys, { sum: FIELDS }, (first) => ({
    ITEM_NAME: first.ITEM_NAME, GRIT_NAME: first.GRIT_NAME, BOOK_NAME: first.BOOK_NAME, BILL_DATE: p.summary ? null : first.BILL_DATE, __month: first.__month,
  }));

  return finish(grouped, p, g1Name, g2Name);
}

function finish(grouped, p, g1Name, g2Name) {
  const rows = grouped.map((g) => {
    const o = { ...g };
    for (const f of FIELDS) o[f] = round(g[f] || 0);
    o.CL_STK = closing(o);
    return o;
  });
  const order = [G1[g1Name], G2[g2Name]].filter(Boolean).filter((k, i, a) => a.indexOf(k) === i);
  return {
    rows: orderRows(rows, [...order, ...(p.summary ? [] : ['BILL_DATE'])]),
    grid: {
      layout: 'JSM_VW_FINISH_STOCK_SUMMARY_REPORT',
      variant: 1,
      groupColumns: g2Name !== 'None' ? [G1[g1Name]] : [],
      groupDisplays: g2Name !== 'None' ? [g1Name.toUpperCase()] : [],
      captions: {},
      title: `${g1Name} Wise Stock Reports`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId, deps = {}) {
  const rows = deps.rows || await movements(companyId, 1);
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))].sort((a, b) => String(a).localeCompare(String(b)));
  return { items: u('ITEM_NAME'), categories: u('GRIT_NAME'), books: u('BOOK_NAME') };
}

module.exports = { run, options };
