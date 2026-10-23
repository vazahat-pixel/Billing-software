'use strict';

/**
 * JSM: Reports › Process Reports › Send  (form Rpt_Process_Issue_Report).
 * Mirrors its btn_screen_Click / GetParaMetersNo_From_STP_REPORT: same filters, view, sort,
 * summary grouping and the grid hand-off (layout name, variant, group columns, captions).
 */
const Purchase = require('../../../models/Purchase');
require('../../../models/Party');
const { loadMillIssueRows } = require('../sources/millIssue');
const {
  orderRows, inList, inDateRange, groupBy,
} = require('../jcEngine');

const ORDER1 = ['Register', 'Mill', 'PurParty', 'Item', 'Month'];
const ORDER2 = ['None', 'Mill', 'PurParty', 'Item', 'DateWise', 'Month'];
const VARIANT = { Register: 1, Mill: 2, PurParty: 3, Item: 4, Month: 1 };
// JSM sorts/groups by "X" + combo text (SQL Server matches it case-insensitively to these aliases).
const X_COLUMN = {
  Register: 'XREGISTER', Mill: 'XMILL', PurParty: 'XPURPARTY', Item: 'XITEM', Month: 'XMONTH', DateWise: 'XDateWise',
};
const COLUMN = {
  Register: 'REGISTER', Mill: 'MILL', PurParty: 'PURPARTY', Item: 'ITEM', Month: 'MONTH',
};

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

async function unadjustedOnly(companyId, rows) {
  const purchases = await Purchase.find({ companyId, status: { $ne: 'cancelled' } })
    .select('invoiceNo supplierInvoiceNo supplierId')
    .populate('supplierId', 'name')
    .lean();
  const billed = new Set();
  for (const p of purchases) {
    const party = String(p.supplierId?.name || '').trim().toUpperCase();
    for (const no of [p.invoiceNo, p.supplierInvoiceNo]) {
      if (no) billed.add(`${String(no).trim().toUpperCase()}|${party}`);
    }
  }
  return rows.filter((r) => !billed.has(`${String(r.PU_BILLNO).trim().toUpperCase()}|${String(r.PURPARTY).trim().toUpperCase()}`));
}

/**
 * @param {object} p  dialog values:
 *   from, to (YYYY-MM-DD), orderBy1, orderBy2, summary, onlyUnadjust, processType ('1-All'|'2-Finish'|'3-Re-Finish'),
 *   mills[], purParties[], items[], remark1[], remark2[], printout ('1-Continue'|'2-PageWise')
 */
async function run(companyId, p = {}, deps = {}) {
  const orderBy1 = pick(p.orderBy1, ORDER1, 'Register');
  const orderBy2 = pick(p.orderBy2, ORDER2, 'None');
  const summary = Boolean(p.summary);
  const onlyUnadjust = Boolean(p.onlyUnadjust);

  let rows = deps.rows || await loadMillIssueRows(companyId);
  if (onlyUnadjust) rows = deps.unadjustedOnly ? deps.unadjustedOnly(rows) : await unadjustedOnly(companyId, rows);
  rows = inDateRange(rows, 'CHLN_DATE', p.from, p.to);
  rows = inList(rows, 'MILL', p.mills);
  rows = inList(rows, 'PURPARTY', p.purParties);
  rows = inList(rows, 'ITEM', p.items);
  rows = inList(rows, 'REMARK_1', p.remark1);
  rows = inList(rows, 'REMARK_2', p.remark2);
  if (p.processType === '2-Finish') rows = rows.filter((r) => r.RE_FINISH !== 'R');
  else if (p.processType === '3-Re-Finish') rows = rows.filter((r) => r.RE_FINISH === 'R');
  else rows = rows.filter((r) => r.RE_FINISH !== 'X');

  const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
  const reportType = `${orderBy1} Wise Mill Report`;
  const pageWise = p.printout === '2-PageWise';

  if (summary && !onlyUnadjust) {
    if (orderBy2 === 'DateWise') {
      // JSM groups by the literal text of the combo; there is no DateWise column, so SQL Server rejects it.
      const err = new Error("Invalid column name 'DateWise'.");
      err.status = 400;
      throw err;
    }
    const g1 = COLUMN[orderBy1];
    const g2 = orderBy2 === 'None' ? null : COLUMN[orderBy2];
    const grouped = groupBy(rows, g2 ? [g1, g2] : [g1], {
      sum: ['ISS_PCS', 'ISS_QTY', 'ISS_KGS', 'PU_AMOUNT'],
      avg: ['PU_RATE'],
      max: ['YEAR_NO', 'MONTH_NO'],
    }).map((r) => ({
      REGISTER: 'SUMMARY',
      ZGROUP: g2 ? r[g1] : '',
      ZGROUP2: g2 ? r[g2] : r[g1],
      YEAR_NO: r.YEAR_NO,
      MONTH_NO: r.MONTH_NO,
      ISS_PCS: r.ISS_PCS,
      ISS_QTY: r.ISS_QTY,
      ISS_KGS: r.ISS_KGS,
      PU_AMOUNT: r.PU_AMOUNT,
      AVG_PU_RATE: r.PU_RATE,
    }));
    let order;
    if (orderBy1 === 'Month') order = ['YEAR_NO', 'MONTH_NO', 'ZGROUP', 'ZGROUP2'];
    else if (orderBy2 === 'Month') order = ['ZGROUP', 'YEAR_NO', 'MONTH_NO'];
    else order = ['ZGROUP', 'ZGROUP2', 'YEAR_NO', 'MONTH_NO'];
    const out = orderRows(grouped, order).map((r) => ({
      ...r, XZGROUP: r.ZGROUP, XZGROUP2: r.ZGROUP2, XREGISTER: r.REGISTER,
    }));
    return {
      rows: out,
      grid: {
        layout: 'JSM_VW_PROCESS_ISSUE_SUM_REPORT',
        variant: 1,
        captions: { ZGROUP2: orderBy1 },
        groupColumns: ['XZGROUP'],
        groupDisplays: [orderBy1.toUpperCase()],
        primaryDetailColumn: 'XZGROUP',
        title: reportType,
        period,
        pageWise,
      },
    };
  }

  const xOrder1 = X_COLUMN[orderBy1];
  const xOrder2 = orderBy2 === 'None' ? null : X_COLUMN[orderBy2];
  const withFix = rows.map((r) => ({
    ...r,
    XENT_NO: r.ENT_NO,
    XCO_ENT_NO: r.CO_ENT_NO,
    XBOOK: r.BOOK,
    XREGISTER: r.BOOK,
    XMILL: r.MILL,
    XPURPARTY: r.PURPARTY,
    XITEM: r.ITEM,
    XDateWise: r.CHLN_DATE,
    XMONTH: r.MONTH,
  }));
  const orderCols = [xOrder1, xOrder2, 'CHLN_DATE', 'CHLN_NO', 'NCCHLN_NO'].filter(Boolean);
  const underlying = {
    XREGISTER: 'BOOK', XMILL: 'MILL', XPURPARTY: 'PURPARTY', XITEM: 'ITEM', XDateWise: 'CHLN_DATE', XMONTH: 'MONTH',
  };
  if (new Set(orderCols.map((c) => underlying[c] || c)).size !== orderCols.length) {
    // JSM orders by these aliases; when two resolve to the same column SQL Server refuses the query.
    const err = new Error('A column has been specified more than once in the order by list. Columns in the order by list must be unique.');
    err.status = 400;
    throw err;
  }
  const out = orderRows(withFix, orderCols);
  return {
    rows: out,
    grid: {
      layout: 'JSM_VW_PROCESS_ISSUE_REPORT',
      variant: VARIANT[orderBy1],
      groupColumns: [xOrder1, xOrder2].filter(Boolean),
      groupDisplays: [orderBy1.toUpperCase(), orderBy2 === 'None' ? '' : orderBy2.toUpperCase()].filter(Boolean),
      primaryDetailColumn: 'XCO_ENT_NO',
      title: reportType,
      period,
      pageWise,
    },
  };
}

/**
 * Tab lists, filled from masters like JSM's Form_Load: process accounts (MERN's Mill Issue screen offers
 * Job Worker / Both parties), creditors, the item master, and distinct challan remarks.
 */
async function options(companyId) {
  const Party = require('../../../models/Party');
  const Item = require('../../../models/Item');
  const { masterId } = require('../../companyGroupService');
  const masterCompanyId = await masterId(companyId);
  const [mills, creditors, items, rows] = await Promise.all([
    Party.find({ companyId: masterCompanyId, type: { $in: ['Job Worker', 'Both'] } }).select('name').lean(),
    Party.find({ companyId: masterCompanyId, type: { $in: ['Supplier', 'Both'] } }).select('name').lean(),
    Item.find({ companyId: masterCompanyId }).select('name').lean(),
    loadMillIssueRows(companyId),
  ]);
  const names = (list) => [...new Set(list.map((x) => x.name).filter(Boolean))].sort(sortName);
  const distinct = (f) => [...new Set(rows.map((r) => r[f]))].sort(sortName);
  return {
    mills: names(mills),
    purParties: names(creditors),
    items: names(items),
    remark1: distinct('REMARK_1'),
    remark2: distinct('REMARK_2'),
  };
}

function sortName(a, b) {
  const x = String(a).toUpperCase();
  const y = String(b).toUpperCase();
  if (x < y) return -1;
  return x > y ? 1 : 0;
}

module.exports = { run, options };
