'use strict';

/**
 * JSM: Reports › Inv Stock Ledger › Grey At Shop Stock and Others Reports › Old Reports › Old Stock
 * Reports › GreyAtShop (Rpt_Stk_Grey_At_Shop, "Grey In Shop - Stock Reports").
 *
 * JSM unions TMP_VW_GREY_STK from the item master (OP_STOCK) and the grey side of the books:
 *   PURCHASE      grey bought                    MILL_GR_RTN  grey taken back from a mill (not recorded here → 0)
 *   MILL_SEND     grey sent to mills (challans)  GREY_SL      grey sold
 *   PU_RTN_GRY    grey returned to suppliers
 * for the Qty or Pcs choice, gathered Item wise, Category wise or Date+Month wise, and keeps rows where
 * any column is not 0. Closing = OP + PURCHASE + MILL_GR_RTN − MILL_SEND − GREY_SL − PU_RTN_GRY.
 * What was dated before From joins OP_STOCK.
 */
const { orderRows, inList, groupBy, round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');
const { loadMillIssueRows } = require('../sources/millIssue');

const bad = (m) => Object.assign(new Error(m), { status: 400 });
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const FIELDS = ['OP_STOCK', 'PURCHASE', 'MILL_GR_RTN', 'MILL_SEND', 'GREY_SL', 'PU_RTN_GRY'];
const isGrey = (category) => String(category || '').toLowerCase() === 'grey';

async function movements(companyId, pcs) {
  const value = pcs ? 'IT_PCS' : 'IT_QTY';
  const [pu, sl, pur, iss] = await Promise.all([
    src.loadPurchaseRegisterRows(companyId),
    src.loadSalesRegisterRows(companyId),
    src.loadReturnRegisterRows(companyId, 'Purchase'),
    loadMillIssueRows(companyId, 'millIssue'),
  ]);
  const rows = [];
  const bills = (list, field) => {
    for (const b of list) {
      for (const l of b._lines || []) {
        if (!isGrey(l.ITEM_CATEGORY)) continue;
        rows.push({ ITEM_NAME: l.ITEM_NAME || '', GRIT_NAME: l.ITEM_CATEGORY || '', BILL_DATE: b.BILL_DATE, [field]: round(Number(l[value] || 0)) });
      }
    }
  };
  bills(pu, 'PURCHASE');
  bills(sl, 'GREY_SL');
  bills(pur, 'PU_RTN_GRY');
  for (const j of iss) rows.push({ ITEM_NAME: j.ITEM || '', GRIT_NAME: 'GREY', BILL_DATE: j.CHLN_DATE, MILL_SEND: round(Number(pcs ? j.ISS_PCS : j.ISS_QTY) || 0) });
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name group category openingQty').lean();
  for (const i of items) {
    if (!isGrey(i.category || i.group)) continue;
    const op = pcs ? 0 : round(Number(i.openingQty || 0));
    if (op) rows.push({ ITEM_NAME: i.name || '', GRIT_NAME: i.category || i.group || '', BILL_DATE: null, OP_STOCK: op, __master: true });
  }
  return rows;
}

const closing = (g) => round(g.OP_STOCK + g.PURCHASE + g.MILL_GR_RTN - g.MILL_SEND - g.GREY_SL - g.PU_RTN_GRY);

async function run(companyId, p = {}, deps = {}) {
  const mode = p.mode || 'item';
  if (!['item', 'category', 'month'].includes(mode)) throw bad(`Unknown report mode: ${mode}`);
  const pcs = Boolean(p.pcs);
  const all = deps.rows || await movements(companyId, pcs);

  const net = (r) => (r.__master ? r.OP_STOCK : (r.PURCHASE || 0) - (r.MILL_SEND || 0) - (r.GREY_SL || 0) - (r.PU_RTN_GRY || 0));
  const before = all.filter((r) => r.__master || (p.from && r.BILL_DATE && dayKey(r.BILL_DATE) < p.from));
  const within = all.filter((r) => !r.__master && r.BILL_DATE && (!p.from || dayKey(r.BILL_DATE) >= p.from) && (!p.to || dayKey(r.BILL_DATE) <= p.to));

  const opening = new Map();
  for (const r of before) {
    const cur = opening.get(r.ITEM_NAME) || { net: 0, cat: r.GRIT_NAME };
    cur.net += net(r);
    opening.set(r.ITEM_NAME, cur);
  }
  const monthOf = (d) => {
    const t = new Date(d);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')} ${MONTHS[t.getUTCMonth()]}`;
  };
  let rows = within.map((r) => ({ ...r, __period: mode === 'month' ? monthOf(r.BILL_DATE) : '' }));
  for (const [item, o] of opening) {
    if (round(o.net) !== 0) rows.push({ ITEM_NAME: item, GRIT_NAME: o.cat, BILL_DATE: p.from, OP_STOCK: round(o.net), __period: mode === 'month' ? monthOf(p.from || new Date()) : '' });
  }
  rows = inList(rows, 'ITEM_NAME', p.items);
  rows = inList(rows, 'GRIT_NAME', p.categories);

  const keys = mode === 'category' ? ['GRIT_NAME'] : mode === 'month' ? ['__period', 'ITEM_NAME'] : ['ITEM_NAME'];
  const out = groupBy(rows, keys, { sum: [...FIELDS, 'MILL_GR_RTN'] }, (first) => ({ ITEM_NAME: first.ITEM_NAME, GRIT_NAME: first.GRIT_NAME, __period: first.__period }))
    .map((g) => {
      const o = { ITEM_NAME: mode === 'category' ? g.GRIT_NAME : g.ITEM_NAME, GRIT_NAME: g.GRIT_NAME, MONTH: mode === 'month' ? String(g.__period).slice(8) : '', PERIOD: g.__period };
      for (const f of FIELDS) o[f] = round(g[f] || 0);
      o.CL_STOCK = closing(o);
      return o;
    })
    .filter((r) => FIELDS.some((f) => r[f] !== 0));

  return {
    rows: orderRows(out, mode === 'month' ? ['PERIOD', 'ITEM_NAME'] : ['ITEM_NAME']),
    grid: {
      layout: 'RPT_GREY_AT_SHOP',
      variant: 1,
      groupColumns: mode === 'month' ? ['MONTH'] : [],
      groupDisplays: mode === 'month' ? ['MONTH'] : [],
      captions: {},
      title: 'GREY IN SHOP STOCK REPORT',
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name group category').lean();
  const grey = items.filter((i) => isGrey(i.category || i.group));
  const u = (vals) => [...new Set(vals.filter((v) => String(v ?? '').trim()))].sort((a, b) => String(a).localeCompare(String(b)));
  return { items: u(grey.map((i) => i.name)), categories: u(grey.map((i) => i.category || i.group)) };
}

module.exports = { run, options };
