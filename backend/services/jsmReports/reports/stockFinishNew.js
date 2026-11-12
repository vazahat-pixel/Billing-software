'use strict';

/**
 * JSM: Reports › Inv Stock Ledger › Finish At Shop Stock (Rpt_Jsm_Stock_Finish_New1, "Finish Stock Report").
 *
 * The finish side of the stock in the unit chosen (Qty / Pcs / Kgs), gathered on Item or Category.
 * Summary gives one line per item (OPENING + what moved − what left = CLOSING, as JSM's
 * RUNTIME_JSM_VW_STOCK_OPENING view builds it); Datewise and Month break the period down, and with
 * those the closing column is dropped, as JSM's column format for those two shows it. Movements are
 * the quantities the books recorded, read from the same sources the registers use; RF (re-finishing)
 * is a flow this software does not record and stays 0.
 */
const { orderRows, inList, groupBy, round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');
const { loadMillIssueRows } = require('../sources/millIssue');
const { loadMillReceiptRows } = require('../sources/millReceipt');

const UNITS = { 1: 'QTY', 2: 'PCS', 3: 'KGS' };
const BILL_VALUE = { QTY: 'IT_QTY', PCS: 'IT_PCS', KGS: 'IT_KGS' };
const JOB_REC_VALUE = { QTY: 'REC_QTY', PCS: 'REC_PCS', KGS: 'REC_KGS' };
const JOB_ISS_VALUE = { QTY: 'ISS_QTY', PCS: 'ISS_PCS', KGS: 'ISS_KGS' };
const bad = (m) => Object.assign(new Error(m), { status: 400 });

const isFinish = (category) => String(category || '').toLowerCase() !== 'grey';
const unitOf = (v) => {
  const u = UNITS[Number(String(v ?? '1').split('-')[0])];
  if (!u) throw bad(`Unknown Unit: ${v}`);
  return u;
};
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

async function movements(companyId, U) {
  const [purchases, sales, salesRtn, purchaseRtn, millRec, jobIss, jobRec] = await Promise.all([
    src.loadPurchaseRegisterRows(companyId),
    src.loadSalesRegisterRows(companyId),
    src.loadReturnRegisterRows(companyId, 'Sales'),
    src.loadReturnRegisterRows(companyId, 'Purchase'),
    loadMillReceiptRows(companyId, 'millRec'),
    loadMillIssueRows(companyId, 'jobIssue'),
    loadMillReceiptRows(companyId, 'jobRec'),
  ]);
  const rows = [];
  const bills = (list, field) => {
    for (const b of list) {
      for (const l of b._lines || []) {
        if (!isFinish(l.ITEM_CATEGORY)) continue;
        rows.push({ ITEM_NAME: l.ITEM_NAME || '', GRIT_NAME: l.ITEM_CATEGORY || l.ITEM_GROUP || '', BILLDATE: b.BILL_DATE, [field]: round(Number(l[BILL_VALUE[U]] || 0)) });
      }
    }
  };
  bills(purchases, 'FNS_PU');
  bills(sales, 'FNS_SL');
  bills(salesRtn, 'FNS_SLR');
  bills(purchaseRtn, 'FNS_PUR');
  const jobs = (list, field, item, valueKey, date) => {
    for (const j of list) rows.push({ ITEM_NAME: j[item] || '', GRIT_NAME: '', BILLDATE: j[date], [field]: round(Number(j[valueKey] || 0)) });
  };
  jobs(millRec, 'ML_REC', 'RECITEM', JOB_REC_VALUE[U], 'BILL_DATE');
  jobs(jobIss, 'JB_ISS', 'ITEM', JOB_ISS_VALUE[U], 'CHLN_DATE');
  jobs(jobRec, 'JB_REC', 'RECITEM', JOB_REC_VALUE[U], 'BILL_DATE');

  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name group category openingQty').lean();
  for (const i of items) {
    if (!isFinish(i.category || i.group)) continue;
    // The item master holds one opening figure (metres); the other units have none recorded.
    const opening = U === 'QTY' ? round(Number(i.openingQty || 0)) : 0;
    if (opening) rows.push({ ITEM_NAME: i.name || '', GRIT_NAME: i.category || i.group || '', BILLDATE: null, __opening: true, OP: opening });
  }
  return rows;
}

const IN = ['OP', 'ML_REC', 'FNS_PU', 'FNS_SLR', 'JB_REC'];
const OUT = ['FNS_SL', 'FNS_PUR', 'JB_ISS', 'ML_RF'];
const ALL = ['OP', 'ML_RF', 'ML_REC', 'FNS_PU', 'FNS_SL', 'FNS_SLR', 'FNS_PUR', 'JB_ISS', 'JB_REC', 'ML_RECRF'];

const monthLabel = (d) => {
  const t = new Date(d);
  return `${MONTHS[t.getUTCMonth()].slice(0, 3)}-${t.getUTCFullYear()}`;
};

async function run(companyId, p = {}, deps = {}) {
  const U = unitOf(p.unit);
  const mode = p.mode || 'summary';
  if (!['summary', 'month', 'datewise', 'datewiseMix'].includes(mode)) throw bad(`Unknown report mode: ${mode}`);
  const byCategory = /^2/.test(String(p.category || '1'));
  const all = deps.rows || await movements(companyId, U);

  // Opening: the item master's figure plus everything dated before the period.
  const before = all.filter((r) => r.__opening || (p.from && r.BILLDATE && dayKey(r.BILLDATE) < p.from));
  const within = all.filter((r) => !r.__opening && r.BILLDATE && (!p.from || dayKey(r.BILLDATE) >= p.from) && (!p.to || dayKey(r.BILLDATE) <= p.to));
  const openingOf = new Map();
  for (const r of before) {
    const net = r.__opening ? r.OP
      : IN.reduce((t, f) => t + Number(r[f] || 0), 0) - OUT.reduce((t, f) => t + Number(r[f] || 0), 0);
    const k = r.ITEM_NAME;
    const cur = openingOf.get(k) || { net: 0, cat: r.GRIT_NAME };
    cur.net += net;
    if (!cur.cat) cur.cat = r.GRIT_NAME;
    openingOf.set(k, cur);
  }

  let rows = within.map((r) => ({ ...r, __period: mode === 'month' ? monthLabel(r.BILLDATE) : dayKey(r.BILLDATE) }));
  for (const [item, o] of openingOf) rows.push({ ITEM_NAME: item, GRIT_NAME: o.cat, BILLDATE: p.from ? new Date(p.from) : null, __period: mode === 'summary' ? '' : (mode === 'month' ? monthLabel(p.from) : p.from), OP: round(o.net) });
  rows = inList(rows, 'ITEM_NAME', p.items);
  rows = inList(rows, 'GRIT_NAME', p.categories);

  const keys = [];
  if (byCategory) keys.push('GRIT_NAME');
  if (!byCategory || mode !== 'summary') keys.push('ITEM_NAME');
  if (mode !== 'summary') keys.push('__period');
  const grouped = groupBy(rows, keys, { sum: ALL }, (first) => ({ GRIT_NAME: first.GRIT_NAME, ITEM_NAME: first.ITEM_NAME, BILLDATE: first.BILLDATE }))
    .map((g) => {
      for (const f of ALL) g[f] = round(g[f] || 0);
      const cl = round(IN.reduce((t, f) => t + g[f], 0) - OUT.reduce((t, f) => t + g[f], 0));
      const out = { ITEM_NAME: byCategory && mode === 'summary' ? g.GRIT_NAME : g.ITEM_NAME, GRIT_NAME: g.GRIT_NAME, BILLDATE: mode === 'summary' ? null : (g.__period ?? g.BILLDATE), [`CL_${U}`]: cl };
      for (const f of ALL) out[`${f}_${U}`] = g[f];
      if (mode !== 'summary') out.BILLDATE = g.__period;
      return out;
    })
    .filter((r) => p.closingZero || mode !== 'summary' || r[`CL_${U}`] !== 0 || ALL.some((f) => r[`${f}_${U}`] !== 0));

  const order = [...(byCategory ? ['GRIT_NAME'] : []), 'ITEM_NAME', ...(mode === 'summary' ? [] : ['BILLDATE'])];
  const layout = { QTY: 'JSM_VW_STOCK_FINISH', PCS: 'JSM_VW_STOCK_FINISH_PCS', KGS: 'JSM_VW_STOCK_FINISH__KGS' }[U];
  const variant = mode === 'summary' ? (byCategory ? 2 : 1) : (mode === 'month' ? 4 : 3);
  return {
    rows: orderRows(grouped, order),
    grid: {
      layout,
      variant,
      groupColumns: mode === 'summary' ? [] : ['ITEM_NAME'],
      groupDisplays: mode === 'summary' ? [] : ['ITEM NAME'],
      captions: {},
      title: `${byCategory ? 'Category' : 'Item'} Wise Finish Stock Report`,
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options() {
  return {};
}

module.exports = { run, options };
