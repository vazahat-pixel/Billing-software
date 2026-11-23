'use strict';

/**
 * MERN mill receipts as rows of JSM's JSM_VW_PROCESS_RECEIPT_DETAIL. MERN keeps one receipt total per job
 * (received pcs/qty, receive date, mill bill no., charges), so each received job is one receipt row.
 */
const Job = require('../../../models/Job');
const Book = require('../../../models/Book');
require('../../../models/Party');
require('../../../models/InventoryLot');
require('../../../models/Item');
const { MONTHS, round, ofKind } = require('../jcEngine');

async function loadMillReceiptRows(companyId, bookModule = 'millRec') {
  const [jobs, book] = await Promise.all([
    Job.find({ companyId, status: { $in: ['Received', 'Partial'] } })
      .populate('workerId', 'name')
      .populate('outputItemId', 'name')
      .populate({ path: 'lotId', select: 'lotId itemId', populate: { path: 'itemId', select: 'name' } })
      .lean(),
    Book.findOne({ companyId, module: bookModule }).sort({ createdAt: 1 }).lean(),
  ]);
  const bookName = book?.name || (bookModule === 'jobRec' ? 'JOB RECEIPT' : 'MILL RECEIPT');

  // Job Receipt and Mill Receipt are separate registers in JSM — each report shows only its own side.
  const mine = ofKind(jobs, bookModule === 'jobRec' ? 'Job' : 'Mill');

  return mine.map((j) => {
    const date = j.receiveDate ? new Date(j.receiveDate) : (j.issueDate ? new Date(j.issueDate) : null);
    const qty = Number(j.receivedQty || 0);
    const rate = Number(j.jobRate || 0);
    const amount = Number(j.processCharges || 0) || round(qty * rate);
    const grey = j.lotId?.itemId?.name || '';
    return {
      CO_ENT_NO: String(j._id),
      ENT_NO: String(j._id),
      BOOK: bookName,
      REGISTER: bookName,
      MILL: j.workerId?.name || '',
      GREYITEM: grey,
      PARTY: j.workerId?.name || '',
      BROKER: '',
      ITEM: grey,
      RECITEM: j.outputItemId?.name || grey,
      SHORT_PCS: Math.max(0, Number(j.issuePcs || 0) - Number(j.receivedPcs || 0)),
      CONS_PCS: 0,
      PLAIN_PCS: Number(j.receivedPcs || 0),
      SHORT_QTY: round(Number(j.wastage || 0)),
      FINISHITEM: j.outputItemId?.name || grey,
      SRAL_NO: '',
      NCBILL_NO: String(j.billGpNo || j.challanNo || ''),
      BILL_DATE: date,
      // The work bill raised against this challan, if one has been — JSM's JOB_BILL_ENTNO, which
      // its Challan Status screen tests against 0 to tell a billed challan from a pending one.
      NCCHLN_NO: String(j.challanNo || ''),
      CHLN_DATE: j.issueDate ? new Date(j.issueDate) : null,
      JOB_BILL_NO: String(j.processBillNo || ''),
      JOB_BILL_DATE: j.processBillDate ? new Date(j.processBillDate) : null,
      MONTH: date ? MONTHS[date.getUTCMonth()] : '',
      REC_PCS: Number(j.receivedPcs || 0),
      // What was sent to the mill, which the Item Wise Summary totals beside what came back.
      SND_QTY: round(Number(j.issueQty || 0)),
      REC_KGS: round(Number(j.receivedKgs || j.receivedGreyKgs || 0)),
      SND_PCS: Number(j.issuePcs || 0),
      REC_QTY: qty,
      IT_RATE: rate,
      IT_AMOUNT: amount,
      IT_DESC1: '',
      TDS_PER: 0,
      TDS_AMT: 0,
      FNL_AMT: round(amount + Number(j.processGstAmount || 0) + Number(j.roundOff || 0)),
      TYPE: 'R',
    };
  });
}

/**
 * Mill / Job receipts as GST bill rows (taxable, SGST/CGST/IGST, net, party GSTIN), for the GST screens
 * (GSTIN Process/JobWork, 3B Inward/Outward, GSTR-9, 2A/2B/4A matching). The rows above carry no tax
 * fields, so those screens showed GST and net as 0. Figures are the ones saved on the receipt.
 * `kind`: 'Mill' | 'Job' (also accepts the book modules 'millRec' / 'jobRec').
 */
async function loadReceiptGstRows(companyId, kind = 'Mill') {
  const { loadMillReceiptSummaryRows } = require('./millReceiptSummary');
  const rows = await loadMillReceiptSummaryRows(companyId, /job/i.test(String(kind)) ? 'jobRec' : 'millRec');
  return rows.map((r) => {
    const gst = Number(r.SGST_AMT || 0) + Number(r.CGST_AMT || 0) + Number(r.IGST_AMT || 0);
    return {
      ...r,
      TAX_RATE: r.TAXABLE_AMT ? round((gst / r.TAXABLE_AMT) * 100) : 0,
      GST_RATE: r.TAXABLE_AMT ? round((gst / r.TAXABLE_AMT) * 100) : 0,
      CHALLAN_NO: r.NCBILL_NO,
      REC_PCS: r.TO_PCS,
      REC_QTY: r.TO_REC_QTY,
    };
  });
}

const loadJobReceiptRows = (companyId) => loadReceiptGstRows(companyId, 'Job');

module.exports = { loadMillReceiptRows, loadReceiptGstRows, loadJobReceiptRows };
