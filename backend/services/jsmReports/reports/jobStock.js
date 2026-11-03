'use strict';

/**
 * JSM: Reports › JobWork Reports › Jobwork Stock/Pending Report (form Rpt_JobWork_Stock_Report),
 * screen grid JSM_VW_JOBWORK_STOCK_REPORT.
 *
 * Per job work challan: issued pcs / qty, each receipt line and the balance still with the job worker,
 * grouped by GroupBy 1 / 2. Unlike Process Stock this form has only two GroupBy combos, a Unit combo
 * (Pcs / Qty / Kgs) that picks the column set, and tabs Party / Broker / Item / Book / Range.
 */
const { loadJobworkStockRows } = require('../sources/jobworkStock');
const { orderRows, inList, inDateRange } = require('../jcEngine');

const ORDER1 = ['Register', 'Party', 'Broker', 'Item', 'Range'];
const ORDER2 = ['None', 'Party', 'Broker', 'Item', 'Range'];

// Layout variants: 1 = Register wise (pcs columns), 2 = grouped wise (party column dropped),
// 6 = Qty mode (metre columns). Unit wins over GroupBy, as in JSM.
const VARIANT_PCS = { Register: 1, Party: 2, Broker: 2, Item: 2, Range: 2 };

const X_COLUMN = { Register: 'XREGISTER', Party: 'XPARTY', Broker: 'XBROKER', Item: 'XITEM', Range: 'XRANGE' };
const X_SOURCE = { XREGISTER: 'REGISTER', XPARTY: 'PARTY', XBROKER: 'BROKER', XITEM: 'ITEM', XRANGE: 'RANGE' };
const LISTS = { parties: 'PARTY', brokers: 'BROKER', items: 'ITEM', books: 'REGISTER', ranges: 'RANGE' };
const DUPLICATE_ORDER = 'A column has been specified more than once in the order by list. Columns in the order by list must be unique.';

const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/**
 * @param {object} p  from, to (issue date), recTo (receipts up to), includeLastYear,
 *   status ('All'|'Pending'|'Clear'), unit ('Pcs'|'Qty'|'Kgs'), orderBy1 / 2, tick lists, printout
 */
async function run(companyId, p = {}, deps = {}) {
  const o1 = pick(p.orderBy1, ORDER1, 'Register');
  const o2 = pick(p.orderBy2, ORDER2, 'None');
  const unit = pick(p.unit, ['Pcs', 'Qty', 'Kgs'], 'Pcs');

  let rows = deps.rows || await loadJobworkStockRows(companyId, { recTo: p.recTo || '' });

  // Issue-date window; "Including Last Year" also lists challans issued before it (goods still out).
  rows = inDateRange(rows, 'CHLN_DATE', p.includeLastYear ? null : p.from, p.to);

  const status = String(p.status || 'Pending');
  if (/^(1-)?Pending$/i.test(status)) rows = rows.filter((r) => r.PENDING === 'PENDING');
  else if (/^(2-)?Clear$/i.test(status)) rows = rows.filter((r) => r.PENDING === 'CLEAR');

  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

  const xs = [X_COLUMN[o1], o2 === 'None' ? null : X_COLUMN[o2]].filter(Boolean);
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
  const ordered = orderRows(withX, [...xs, 'CHLN_DATE', 'CHLN_NO', 'NCCHLN_NO', 'CO_ENT_NO', 'BILLDT', 'SRAL_NO']);

  return {
    rows: ordered,
    grid: {
      layout: 'JSM_VW_JOBWORK_STOCK_REPORT',
      variant: unit === 'Pcs' ? (VARIANT_PCS[o1] || 2) : 6,
      groupColumns: xs,
      groupDisplays: [o1, o2].filter((o) => o && o !== 'None').map((o) => o.toUpperCase()),
      primaryDetailColumn: 'XCO_ENT_NO',
      title: `${o1} Wise JobWork Stock Report`,
      period: `ISSUE DATE : FROM ${p.includeLastYear ? '(Including Last Year)' : (p.fromText || p.from || '')}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId) {
  const rows = await loadJobworkStockRows(companyId);
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return Object.fromEntries(Object.entries(LISTS).map(([k, f]) => [k, u(f)]));
}

module.exports = { run, options };
