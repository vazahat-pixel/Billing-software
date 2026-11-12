'use strict';

/**
 * JSM: Reports > Process Reports > TakaWise Stock Detail (Rpt_Process_Stock_TakaDetail)
 * Screen grid: JSM_VW_PROCESS_STOCK_TAKADETAIL_REPORT (captured in layouts.json).
 */
const Job = require('../../../models/Job');
const Party = require('../../../models/Party');
const Book = require('../../../models/Book');
const Company = require('../../../models/Company');
require('../../../models/InventoryLot');
require('../../../models/Item');
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

const ORDER_MAP = {
  Register: 'XREGISTER',
  Mill_Name: 'XMILL_NAME',
  Mill: 'XMILL_NAME',
  Item_Name: 'XITEM_NAME',
  Item: 'XITEM_NAME',
};

const isPendingStatus = (j) => ['Issued', 'In-Process', 'Partial'].includes(j.status) && Number(j.receivedGreyQty ?? j.receivedQty ?? 0) < Number(j.issueQty || 0) - 0.005;

async function loadTakaRows(companyId) {
  const [jobs, company, book] = await Promise.all([
    Job.find({ companyId, status: { $ne: 'Cancelled' } })
      .populate('workerId', 'name')
      .populate({ path: 'lotId', select: 'lotId itemId', populate: { path: 'itemId', select: 'name' } })
      .lean(),
    Company.findById(companyId).select('name coCode').lean(),
    Book.findOne({ companyId, module: 'millIssue' }).sort({ createdAt: 1 }).lean(),
  ]);

  const coShort = company?.coCode || '';
  const register = book?.name || 'PROCESS CHARGE';
  const rows = [];

  for (const j of jobs) {
    if (j.workKind === 'Job' || (!j.workKind && j.processType === 'Job Work')) continue;
    const [remark1 = '', remark2 = ''] = String(j.remark || '').split(/\r?\n/);
    const status = isPendingStatus(j) ? 'P' : 'C';
    const base = {
      CO_PATH: coShort,
      CO_SHORT: coShort,
      ENT_NO: String(j._id),
      CO_ENT_NO: `${j._id}${coShort}`,
      BOOK: register,
      NCCHLN_NO: String(j.challanNo || j.jobCardNo || ''),
      CHLN_DATE: j.issueDate ? new Date(j.issueDate) : null,
      MILL_NAME: j.workerId?.name || '',
      ITEM_NAME: j.lotId?.itemId?.name || '',
      ISS_PCS: Number(j.issuePcs || 0),
      ISS_QTY: round(j.issueQty || 0, 3),
      LOT_NO: j.lotNo || j.lotId?.lotId || '',
      REMARK_1: remark1,
      REMARK_2: remark2,
      PURCHASE_PARTY: j.weaver || '',
      STATUS: status,
      PU_KGS: round(j.issueKgs || 0, 3),
      NCBILL_NO: j.billGpNo || j.purchaseBillNo || '',
      XREGISTER: register,
      XMILL_NAME: j.workerId?.name || '',
      XITEM_NAME: j.lotId?.itemId?.name || '',
      XCO_ENT_NO: `${j._id}${coShort}`,
    };

    if (Array.isArray(j.takas) && j.takas.length) {
      j.takas.forEach((t, idx) => {
        rows.push({
          ...base,
          DSR_NO: Number(t.srNo || idx + 1),
          DISS_QTY: round(t.issueQty || 0, 3),
          DREC_QTY: round(t.recQty || 0, 2),
          DSHORT_QTY: round(t.shortQty || 0, 2),
        });
      });
    } else if (Array.isArray(j.receipts) && j.receipts.length) {
      j.receipts.forEach((r, idx) => {
        rows.push({
          ...base,
          DSR_NO: idx + 1,
          DISS_QTY: idx === 0 ? round(j.issueQty || 0, 3) : 0,
          DREC_QTY: round(r.greyQty || r.finishQty || 0, 2),
          DSHORT_QTY: round(r.shortQty || 0, 2),
        });
      });
    } else {
      rows.push({
        ...base,
        DSR_NO: 1,
        DISS_QTY: round(j.issueQty || 0, 3),
        DREC_QTY: round(j.receivedGreyQty ?? j.receivedQty ?? 0, 2),
        DSHORT_QTY: round(j.wastage || 0, 2),
      });
    }
  }
  return rows;
}

async function run(companyId, p = {}, deps = {}) {
  let rows = deps.rows ? deps.rows.map((r) => ({ ...r, XREGISTER: r.BOOK || r.REGISTER || '', XMILL_NAME: r.MILL_NAME || '', XITEM_NAME: r.ITEM_NAME || '', XCO_ENT_NO: r.CO_ENT_NO || `${r.ENT_NO}${r.CO_PATH || ''}` })) : await loadTakaRows(companyId);

  rows = inDateRange(rows, 'CHLN_DATE', p.from, p.to);
  const st = String(p.status || 'Pending').toUpperCase();
  if (st.startsWith('P')) rows = rows.filter((r) => r.STATUS === 'P');
  else if (st.startsWith('C')) rows = rows.filter((r) => r.STATUS === 'C');

  rows = inList(rows, 'MILL_NAME', p.mills);
  rows = inList(rows, 'ITEM_NAME', p.items);
  rows = inList(rows, 'PURCHASE_PARTY', p.purParties);
  rows = inList(rows, 'BOOK', p.books);

  const g1 = ORDER_MAP[p.orderBy1] || 'XREGISTER';
  const g2 = ORDER_MAP[p.orderBy2] || null;
  const groupCols = [g1, g2 && g2 !== g1 ? g2 : null].filter(Boolean);

  return {
    rows: orderRows(rows, [...groupCols, 'CHLN_DATE', { field: 'NCCHLN_NO', dir: 'asc', numeric: true }, { field: 'DSR_NO', dir: 'asc', numeric: true }]),
    grid: {
      layout: 'JSM_VW_PROCESS_STOCK_TAKADETAIL_REPORT',
      variant: 1,
      groupColumns: groupCols,
      groupDisplays: groupCols.map((c) => c.slice(1)),
      primaryDetailColumn: 'XCO_ENT_NO',
      captions: {},
      title: `${p.orderBy1 || 'Register'} Wise Process Stock Taka Details Report`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: String(p.printout || '').startsWith('2'),
    },
  };
}

async function options(companyId) {
  const [jobs, books, parties] = await Promise.all([
    Job.find({ companyId, status: { $ne: 'Cancelled' } }).populate('workerId', 'name').populate({ path: 'lotId', populate: { path: 'itemId', select: 'name' } }).lean(),
    Book.find({ companyId, module: 'millIssue' }).select('name').lean(),
    Party.find({ companyId, isDeleted: { $ne: true } }).select('name').lean(),
  ]);
  const u = (xs) => [...new Set(xs.filter(Boolean))].sort();
  return {
    mills: u(jobs.map((j) => j.workerId?.name)),
    items: u(jobs.map((j) => j.lotId?.itemId?.name)),
    purParties: u([...jobs.map((j) => j.weaver), ...parties.map((pt) => pt.name)]),
    books: u(books.map((b) => b.name)),
  };
}

module.exports = { run, options };
