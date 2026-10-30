'use strict';

/**
 * JSM: Reports › Process Reports › Process Stock (form Rpt_Process_Stock_New_Gst), screen grid JSM_VW_PROCESS_STOCK_DTL.
 * Per challan: issued pcs / qty, every receipt line (grey qty, finish qty, pcs) and the balance still at the mill,
 * grouped by GroupBy 1 / 2 / 3 with group and grand totals (challan columns counted once per challan).
 */
const { loadProcessStockRows } = require('../sources/processStock');
const { orderRows, inList, inDateRange } = require('../jcEngine');

const ORDER1 = ['Register', 'Mill', 'Item', 'PuParty', 'Master', 'MainGroup', 'Broker'];
const ORDER2 = ['None', 'Mill', 'Item', 'PuParty', 'Master', 'Broker'];
// layout variant per GroupBy 1 (variant 2 = Mill wise: challan, date, lot, item, issued, received, balance)
const VARIANT = { Register: 1, Mill: 2, Item: 3, PuParty: 4, Master: 5, MainGroup: 2, Broker: 2 };
const X_COLUMN = { Register: 'XREGISTER', Mill: 'XMILL', Item: 'XITEM', PuParty: 'XPUPARTY', Master: 'XMASTER', MainGroup: 'XMAINGROUP', Broker: 'XBROKER' };
const X_SOURCE = { XREGISTER: 'REGISTER', XMILL: 'MILL_NAME', XITEM: 'ITEM_NAME', XPUPARTY: 'PURCHASE_PARTY', XMASTER: 'MASTER_NAME', XMAINGROUP: 'MAINGROUP', XBROKER: 'BROKER' };
const LISTS = { mills: 'MILL_NAME', items: 'ITEM_NAME', purParties: 'PURCHASE_PARTY', masters: 'MASTER_NAME', mainGroups: 'MAINGROUP', brokers: 'BROKER', books: 'REGISTER', transports: 'TRANSPORT' };
const DUPLICATE_ORDER = 'A column has been specified more than once in the order by list. Columns in the order by list must be unique.';

const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/**
 * @param {object} p  from, to (issue date), recTo (receipts up to), includeLastYear, status ('1-Pending'|'2-Clear'|'3-All'),
 *   processType ('1-All'|'2-Finish'|'3-Re-Finish'), chFrom / chTo (challan no. range), orderBy1 / 2 / 3, tick lists, kind ('Mill'|'Job')
 */
async function run(companyId, p = {}, deps = {}) {
  const o1 = pick(p.orderBy1, ORDER1, 'Mill');
  const o2 = pick(p.orderBy2, ORDER2, 'None');
  const o3 = pick(p.orderBy3, ORDER2, 'None');
  const kind = p.kind === 'Job' ? 'Job' : 'Mill';
  let rows = deps.rows || await loadProcessStockRows(companyId, { kind, recTo: p.recTo || '' });

  // issue date window; "Including Last Year" also lists the challans issued before it (goods still at the mill)
  rows = inDateRange(rows, 'CHLN_DATE', p.includeLastYear ? null : p.from, p.to);
  const status = String(p.status || '1-Pending');
  if (status.startsWith('1')) rows = rows.filter((r) => r.PENDING === 'PENDING');
  else if (status.startsWith('2')) rows = rows.filter((r) => r.PENDING === 'CLEAR');
  const pt = String(p.processType || '1-All');
  if (pt.startsWith('2')) rows = rows.filter((r) => r.RE_FINISH !== 'R');
  else if (pt.startsWith('3')) rows = rows.filter((r) => r.RE_FINISH === 'R');
  const chFrom = Number(p.chFrom || 0); const chTo = Number(p.chTo || 0);
  if (chFrom || chTo) rows = rows.filter((r) => (!chFrom || r.CHLN_NO >= chFrom) && (!chTo || r.CHLN_NO <= chTo));
  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

  const xs = [X_COLUMN[o1], o2 === 'None' ? null : X_COLUMN[o2], o3 === 'None' ? null : X_COLUMN[o3]].filter(Boolean);
  if (new Set(xs.map((x) => X_SOURCE[x])).size !== xs.length) {
    const err = new Error(DUPLICATE_ORDER);
    err.status = 400;
    throw err;
  }
  const withX = rows.map((r) => {
    const out = { ...r };
    for (const [x, src] of Object.entries(X_SOURCE)) out[x] = r[src];
    out.XCO_ENT_NO = r.CO_ENT_NO;
    return out;
  });
  const ordered = orderRows(withX, [...xs, 'CHLN_DATE', 'CHLN_NO', 'NCCHLN_NO', 'CO_ENT_NO', 'BILL_DATE', 'SRAL_NO']);
  return {
    rows: ordered,
    grid: {
      layout: 'JSM_VW_PROCESS_STOCK_DTL',
      variant: VARIANT[o1] || 2,
      groupColumns: xs,
      groupDisplays: [o1, o2, o3].filter((o) => o && o !== 'None').map((o) => o.toUpperCase()),
      primaryDetailColumn: 'XCO_ENT_NO',
      title: `${o1} Wise ${kind === 'Job' ? 'JobWork' : 'Process'} Stock (Detail) Report`,
      period: `ISSUE DATE : FROM ${p.includeLastYear ? '(Including Last Year)' : (p.fromText || p.from || '')}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId, p = {}) {
  const rows = await loadProcessStockRows(companyId, { kind: p.kind === 'Job' ? 'Job' : 'Mill' });
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))].sort((a, b) => String(a).localeCompare(String(b)));
  return Object.fromEntries(Object.entries(LISTS).map(([k, f]) => [k, u(f)]));
}

module.exports = { run, options };
