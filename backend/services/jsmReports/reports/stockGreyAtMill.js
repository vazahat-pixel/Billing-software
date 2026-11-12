'use strict';

/**
 * JSM: Reports › Inv Stock Ledger › Grey At Mill Stock - Format 1 (Rpt_Jsm_Stock_Grey_At_Mill).
 *
 * Grey goods lying at the mills. Per item (or category): OPENING + GREY ISS. − REC.QTY − SHORTAGE
 * − RTN QTY = CLOSING, as JSM's RUNTIME_JSM_VW_STOCK_OPENING builds it: what moved before the
 * period is rolled into the opening, what moved inside it stays in its own column. Summary
 * Reports gives one line per item; without it the period is listed Item + Date wise, with no
 * closing column. Quantities come from the mill challans (issued) and their receipt lines (grey
 * consumed and shortage). Re-finish (RF) columns stay 0 — that flow is not recorded here.
 */
const { orderRows, groupBy, round, inList } = require('../jcEngine');
const { loadProcessStockRows } = require('../sources/processStock');

const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const FIELDS = ['OP_QTY', 'ML_ISS_QTY', 'ML_ISSRF_QTY', 'ML_REC_QTY', 'ML_RECRF_QTY', 'ML_SHRT_QTY', 'ML_RTN_QTY', 'ML_NET_QTY'];
const closing = (g) => round(g.OP_QTY + g.ML_ISS_QTY + g.ML_ISSRF_QTY - g.ML_REC_QTY - g.ML_RECRF_QTY - g.ML_SHRT_QTY - g.ML_RTN_QTY);

async function movements(companyId, deps) {
  const challans = deps.rows || await loadProcessStockRows(companyId, { kind: 'Mill' });
  const Item = deps.Item || require('../../../models/Item');
  const items = deps.items || await Item.find({ companyId }).select('name category group').lean();
  const category = new Map(items.map((i) => [String(i.name), i.category || i.group || '']));
  const seen = new Set();
  const out = [];
  for (const r of challans) {
    const base = { ITEM_NAME: r.ITEM_NAME || '', GRIT_NAME: category.get(String(r.ITEM_NAME)) || '' };
    if (!seen.has(r.ENT_NO)) {
      seen.add(r.ENT_NO);
      if (r.CHLN_DATE && Number(r.ISS_QTY)) out.push({ ...base, BILLDATE: r.CHLN_DATE, ML_ISS_QTY: Number(r.ISS_QTY) });
    }
    const date = r.REC_BILLDATE || r.BILL_DATE;
    if (date && (Number(r.R_GRY_REC_QTY) || Number(r.R_SHORT_QTY))) {
      out.push({ ...base, BILLDATE: date, ML_REC_QTY: Number(r.R_GRY_REC_QTY) || 0, ML_SHRT_QTY: Number(r.R_SHORT_QTY) || 0 });
    }
  }
  return out;
}

async function run(companyId, p = {}, deps = {}) {
  const byCategory = /^2/.test(String(p.category || '1'));
  const all = await movements(companyId, deps);
  const before = p.from ? all.filter((r) => dayKey(r.BILLDATE) < p.from) : [];
  const within = all.filter((r) => (!p.from || dayKey(r.BILLDATE) >= p.from) && (!p.to || dayKey(r.BILLDATE) <= p.to));

  const net = (r) => (r.ML_ISS_QTY || 0) - (r.ML_REC_QTY || 0) - (r.ML_SHRT_QTY || 0);
  const opening = new Map();
  for (const r of before) {
    const cur = opening.get(r.ITEM_NAME) || { net: 0, cat: r.GRIT_NAME };
    cur.net += net(r);
    opening.set(r.ITEM_NAME, cur);
  }
  let rows = within.map((r) => ({ ...r, __day: dayKey(r.BILLDATE) }));
  for (const [item, o] of opening) {
    if (round(o.net) !== 0) rows.push({ ITEM_NAME: item, GRIT_NAME: o.cat, BILLDATE: p.from, __day: p.summary ? '' : p.from, OP_QTY: round(o.net) });
  }
  rows = inList(rows, 'ITEM_NAME', p.items);
  rows = inList(rows, 'GRIT_NAME', p.categories);

  const keys = byCategory ? ['GRIT_NAME'] : ['ITEM_NAME'];
  if (!p.summary) keys.push('__day');
  const grouped = groupBy(rows, keys, { sum: FIELDS }, (first) => ({ ITEM_NAME: first.ITEM_NAME, GRIT_NAME: first.GRIT_NAME }))
    .map((g) => {
      const o = { ITEM_NAME: byCategory ? g.GRIT_NAME : g.ITEM_NAME, GRIT_NAME: g.GRIT_NAME, BILLDATE: p.summary ? null : g.__day };
      for (const f of FIELDS) o[f] = round(g[f] || 0);
      o.ML_NET_QTY = round(o.ML_REC_QTY - o.ML_SHRT_QTY);
      o.CL_QTY = closing(o);
      return o;
    })
    .filter((r) => !p.summary || FIELDS.some((f) => r[f] !== 0) || r.CL_QTY !== 0);

  const noun = byCategory ? 'Category' : 'Item';
  return {
    rows: orderRows(grouped, ['ITEM_NAME', ...(p.summary ? [] : ['BILLDATE'])]),
    grid: {
      layout: 'JSM_VW_STOCK_MILL',
      variant: p.summary ? (byCategory ? 2 : 1) : 3,
      groupColumns: p.summary ? [] : ['ITEM_NAME'],
      groupDisplays: p.summary ? [] : [byCategory ? 'GRIT_NAME' : 'ITEM_NAME'],
      captions: {},
      title: p.summary ? `${noun} Wise Grey At Mill Stock Reports` : `${noun} + Date Wise Grey At Mill Stock Reports`,
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options() {
  return {};
}

module.exports = { run, options };
