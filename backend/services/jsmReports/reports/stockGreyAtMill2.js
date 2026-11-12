'use strict';

/**
 * JSM: Reports › Inv Stock Ledger › Grey At Mill Stock - Format 2 (Rpt1_Stk_Grey_At_Mill, "Gray In Mill - Stock Reports").
 *
 * Grey in the mills as a register, from JSM's TMP_VW_GR_ML_STK: OP (pcs / mts, the master's mill
 * opening), what was SENT to mills in the period (pcs / mts), what CAME BACK (pcs, finish qty,
 * shortage, the grey they used = NET) up to the "Upto Rec Date", and DMG/LOSS (goods written off as
 * LOST, not recorded here → 0). Gathered Item, Category or Date+Month wise; rows with every column 0
 * are dropped. CLOSING = OP + SENT − NET − DMG/LOSS. Receipts dated before From join the opening.
 */
const { orderRows, inList, groupBy, round, MONTHS } = require('../jcEngine');
const { loadProcessStockRows } = require('../sources/processStock');

const bad = (m) => Object.assign(new Error(m), { status: 400 });
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const FIELDS = ['OP_PCS', 'OP_MTS', 'ML_SND_PCS', 'ML_SND_MTS', 'ML_PCS', 'ML_RCPT', 'SHRTG_MTS', 'NET_MTS', 'TP', 'DMG_LOSS'];

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
      if (r.CHLN_DATE) out.push({ ...base, DATE: r.CHLN_DATE, ML_SND_PCS: Number(r.ISS_PCS) || 0, ML_SND_MTS: Number(r.ISS_QTY) || 0 });
    }
    const date = r.REC_BILLDATE || r.BILL_DATE;
    if (date && (Number(r.R_GRY_REC_QTY) || Number(r.R_REC_PCS) || Number(r.R_SHORT_QTY))) {
      out.push({
        ...base, DATE: date, ML_PCS: Number(r.R_REC_PCS) || 0, ML_RCPT: Number(r.R_FNS_REC_QTY) || 0,
        SHRTG_MTS: Number(r.R_SHORT_QTY) || 0, NET_MTS: Number(r.R_GRY_REC_QTY) || 0,
      });
    }
  }
  return out;
}

const closingMts = (g) => round(g.OP_MTS + g.ML_SND_MTS - g.NET_MTS - g.DMG_LOSS);
const closingPcs = (g) => round(g.OP_PCS + g.ML_SND_PCS - g.ML_PCS);

async function run(companyId, p = {}, deps = {}) {
  const mode = p.mode || 'item';
  if (!['item', 'category', 'month'].includes(mode)) throw bad(`Unknown report mode: ${mode}`);
  const all = (await movements(companyId, deps)).filter((r) => !(p.recTo && r.NET_MTS !== undefined && dayKey(r.DATE) > p.recTo));
  const before = p.from ? all.filter((r) => dayKey(r.DATE) < p.from) : [];
  const within = all.filter((r) => (!p.from || dayKey(r.DATE) >= p.from) && (!p.to || dayKey(r.DATE) <= p.to));

  const opening = new Map();
  for (const r of before) {
    const cur = opening.get(r.ITEM_NAME) || { mts: 0, pcs: 0, cat: r.GRIT_NAME };
    cur.mts += (r.ML_SND_MTS || 0) - (r.NET_MTS || 0);
    cur.pcs += (r.ML_SND_PCS || 0) - (r.ML_PCS || 0);
    opening.set(r.ITEM_NAME, cur);
  }
  const monthOf = (d) => {
    const t = new Date(d);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')} ${MONTHS[t.getUTCMonth()]}`;
  };
  let rows = within.map((r) => ({ ...r, __period: mode === 'month' ? monthOf(r.DATE) : '' }));
  for (const [item, o] of opening) {
    if (round(o.mts) !== 0 || o.pcs !== 0) rows.push({ ITEM_NAME: item, GRIT_NAME: o.cat, DATE: p.from, OP_MTS: round(o.mts), OP_PCS: o.pcs, __period: mode === 'month' ? monthOf(p.from || new Date()) : '' });
  }
  rows = inList(rows, 'ITEM_NAME', p.items);
  rows = inList(rows, 'GRIT_NAME', p.categories);

  const keys = mode === 'category' ? ['GRIT_NAME'] : mode === 'month' ? ['__period', 'ITEM_NAME'] : ['ITEM_NAME'];
  const out = groupBy(rows, keys, { sum: FIELDS }, (first) => ({ ITEM_NAME: first.ITEM_NAME, GRIT_NAME: first.GRIT_NAME, __period: first.__period }))
    .map((g) => {
      const o = { ITEM_NAME: mode === 'category' ? g.GRIT_NAME : g.ITEM_NAME, GRIT_NAME: g.GRIT_NAME, PERIOD: g.__period, MONTH: mode === 'month' ? String(g.__period).slice(8) : '' };
      for (const f of FIELDS) o[f] = round(g[f] || 0);
      o.CL_MTS = closingMts(o);
      o.CL_PCS = closingPcs(o);
      return o;
    })
    .filter((r) => FIELDS.some((f) => r[f] !== 0));

  return {
    rows: orderRows(out, mode === 'month' ? ['PERIOD', 'ITEM_NAME'] : ['ITEM_NAME']),
    grid: {
      layout: 'RPT_GREY_AT_MILL_REGISTER',
      variant: 1,
      groupColumns: mode === 'month' ? ['MONTH'] : [],
      groupDisplays: mode === 'month' ? ['MONTH'] : [],
      captions: {},
      title: 'GREY IN MILL STOCK REGISTER',
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId, deps = {}) {
  const Item = deps.Item || require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name category group').lean();
  const u = (vals) => [...new Set(vals.filter((v) => String(v ?? '').trim()))].sort((a, b) => String(a).localeCompare(String(b)));
  return { items: u(items.map((i) => i.name)), categories: u(items.map((i) => i.category || i.group)) };
}

module.exports = { run, options };
