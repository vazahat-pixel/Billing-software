'use strict';

/**
 * JSM: Reports > Gst Reports > E-Way Bill Bulk Generation (Eway_Billing_Bulk).
 *
 * "Load Data" lists every sales bill of the chosen book and dates, one row per item line, in the 41
 * columns JSM's grid shows (the NIC bulk-upload fields; a * marks the ones NIC requires). From that
 * grid JSM writes the bulk JSON. Nothing here recalculates a bill: values are read as saved.
 * Distance, vehicle and transporter id are not recorded on a sales bill here, so they stay blank
 * and "Check Error" lists the bills still missing a required value.
 */
const { orderRows, round, inDateRange } = require('../jcEngine');

const dmy = (d) => {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`;
};

const stateCodeOf = (gstin, party) => {
  const g = String(gstin || '').trim();
  if (/^\d{2}/.test(g)) return Number(g.slice(0, 2));
  const c = Number(party?.stateCode);
  return Number.isFinite(c) && c > 0 ? c : '';
};

async function loadBills(companyId, p, deps) {
  if (deps.bills) return deps.bills;
  const Sales = require('../../../models/Sales');
  const CompanySettings = require('../../../models/CompanySettings');
  require('../../../models/Party');
  require('../../../models/Item');
  const Book = require('../../../models/Book');
  const [bills, co, books] = await Promise.all([
    Sales.find({ companyId, status: { $ne: 'cancelled' } })
      .populate('customerId', 'name gstin address address2 city state stateCode pincode')
      .populate('items.itemId', 'name hsnCode unit')
      .lean(),
    CompanySettings.findOne({ companyId }).lean(),
    Book.find({ companyId }).select('name').lean(),
  ]);
  const bookName = new Map(books.map((b) => [String(b._id), b.name]));
  return bills.map((b) => ({ ...b, __company: co || {}, __book: bookName.get(String(b.bookId)) || '' }));
}

function rowsOf(bill) {
  const co = bill.__company || {};
  const party = bill.customerId || {};
  const igstBill = bill.gstType === 'IGST' || bill.gstType === 'Export';
  const total = round(Number(bill.netAmount ?? bill.totalAmount ?? 0));
  return (bill.items || []).map((l, i) => {
    const gst = round(l.gstAmt);
    const taxable = round(Number(l.amount || 0) - (igstBill ? 0 : 0));
    return {
      ENT_NO: String(bill._id),
      SR_NO: i + 1,
      BOOK: bill.__book || '',
      SUP_TYPE: 'Outward',
      SUB_TYPE: 'Supply',
      DOC_TYPE: 'Tax Invoice',
      DOC_NO: bill.invoiceNo || '',
      DOC_DATE: dmy(bill.date),
      DOC_DATE_RAW: bill.date,
      FRM_PRTY_NAME: co.legalName || '',
      FRM_GSTN: co.gstin || '',
      FRM_ADD1: co.address || '',
      FRM_ADD2: co.address2 || '',
      FRM_PLACE: co.city || '',
      FRM_PINCODE: co.pincode || '',
      FRM_STATE: co.state || '',
      FRM_ACT_STATE_CODE: stateCodeOf(co.gstin),
      TO_PRTY_NAME: party.name || '',
      TO_GSTN: party.gstin || 'URP',
      TO_ADD1: party.address || '',
      TO_ADD2: party.address2 || '',
      TO_PLACE: party.city || '',
      TO_PINCODE: party.pincode || '',
      TO_STATE: party.state || '',
      TO_ACT_STATE_CODE: stateCodeOf(party.gstin, party),
      PRO_NAME: l.itemId?.name || '',
      PRO_DESC: l.desc || l.itemId?.name || '',
      PRO_HSN: l.itemId?.hsnCode || '',
      PRO_UNIT: l.unit || l.itemId?.unit || '',
      PRO_QTY: round(l.mts || l.pcs, 3),
      ACC_VALUE: taxable,
      TAX_RATE: Number(l.gstPer || bill.gstRate || 0),
      CGST_AMT: igstBill ? 0 : round(gst / 2),
      SGST_AMT: igstBill ? 0 : round(gst / 2),
      IGST_AMT: igstBill ? gst : 0,
      CESS_AMT: 0,
      TRNS_MODE: 'Road',
      DISTANCE: '',
      TRAN_NAME: bill.transport || '',
      TRAN_GSTN: '',
      TRNS_DOCNO: bill.lrNo || '',
      TRNS_DATE: dmy(bill.lrDate),
      VEHICAL_NO: '',
      VEHICAL_TYPE: '',
      TOT_INV_VALUE: total,
      MAIN_HSN_CODE: l.itemId?.hsnCode || '',
      TRANS_TYPE: 'Regular',
    };
  });
}

/** Required (*) values NIC rejects a bill for when they are empty. */
const REQUIRED = [
  ['DOC_NO', 'DOC.NO'], ['DOC_DATE', 'DOC.DATE'], ['FRM_GSTN', 'FRM.GSTN'], ['FRM_PINCODE', 'FRM.PINCODE'],
  ['FRM_STATE', 'FRM.STATE'], ['TO_GSTN', 'TO.GSTN'], ['TO_PINCODE', 'TO.PINCODE'], ['TO_STATE', 'TO.STATE'],
  ['PRO_HSN', 'PRO.HSN'], ['ACC_VALUE', 'ACC.VALUE'], ['DISTANCE', 'DISTANCE'],
];

async function run(companyId, p = {}, deps = {}) {
  const bills = await loadBills(companyId, p, deps);
  let rows = [];
  for (const b of inDateRange(bills, 'date', p.from, p.to)) {
    if (p.book && p.book !== 'All' && String(b.__book || '') !== String(p.book)) continue;
    rows.push(...rowsOf(b));
  }
  rows = orderRows(rows, [{ field: 'DOC_DATE_RAW' }, { field: 'DOC_NO', numeric: true }, { field: 'SR_NO', numeric: true }]);

  const errors = [];
  if (p.checkError) {
    for (const r of rows) {
      const missing = REQUIRED.filter(([k]) => r[k] === '' || r[k] === null || r[k] === undefined || r[k] === 0).map(([, c]) => c);
      if (missing.length) errors.push({ DOC_NO: r.DOC_NO, ERROR: `Missing ${missing.join(', ')}` });
    }
  }
  return { rows, errors };
}

async function options(companyId, deps = {}) {
  const Book = deps.Book || require('../../../models/Book');
  const books = await Book.find({ companyId }).select('name').lean();
  return { books: ['All', ...books.map((b) => b.name).filter(Boolean)] };
}

module.exports = { run, options, rowsOf };
