'use strict';

/**
 * MERN mill receipts as bill rows of JSM's JSM_VW_PROCESS_RECEIPT_SUMMARY. MERN keeps one receipt total per
 * job, so each received job is one receipt bill. Read-only.
 */
const Job = require('../../../models/Job');
const Book = require('../../../models/Book');
require('../../../models/Party');
const { MONTHS, round } = require('../jcEngine');

async function loadMillReceiptSummaryRows(companyId, bookModule = 'millRec') {
  const [jobs, book] = await Promise.all([
    Job.find({ companyId, status: { $in: ['Received', 'Partial'] } })
      .populate('workerId', 'name msmeType gstin mobile')
      .lean(),
    Book.findOne({ companyId, module: bookModule }).sort({ createdAt: 1 }).lean(),
  ]);
  const bookName = book?.name || (bookModule === 'jobRec' ? 'JOB RECEIPT' : 'MILL RECEIPT');
  return jobs.map((j) => {
    const date = j.receiveDate ? new Date(j.receiveDate) : (j.issueDate ? new Date(j.issueDate) : null);
    const qty = Number(j.receivedQty || 0);
    const gross = Number(j.processCharges || 0) || round(qty * Number(j.jobRate || 0));
    const gst = Number(j.processGstAmount || 0);
    const igst = /IGST/i.test(j.gstType || '') ? gst : 0;
    const half = igst ? 0 : round(gst / 2);
    const net = round(gross + gst + Number(j.roundOff || 0));
    return {
      CO_ENT_NO: String(j._id),
      ENT_NO: String(j._id),
      BOOK: bookName,
      REGISTER: bookName,
      MILL: j.workerId?.name || '',
      PARTY: j.workerId?.name || '',
      MSME_TYPE: j.workerId?.msmeType || '',
      GSTIN_NO: j.workerId?.gstin || '',
      PARTY_MOBILE: j.workerId?.mobile || '',
      SRAL_NO: '',
      NCBILL_NO: String(j.billGpNo || j.challanNo || ''),
      BILL_DATE: date,
      DATEWISE: date,
      MONTH: date ? MONTHS[date.getUTCMonth()] : '',
      MONTH_NO: date ? date.getUTCMonth() + 1 : null,
      YEAR_NO: date ? date.getUTCFullYear() : null,
      SGC: '1',
      TO_PCS: Number(j.receivedPcs || 0),
      TO_REC_QTY: qty,
      TO_SND_QTY: Number(j.issueQty || 0),
      TO_FOLD_QTY: 0,
      TO_SND_KGS: 0,
      TO_REC_KGS: 0,
      SUB_TOT: gross,
      T_ADDLESS: 0,
      TAXABLE_AMT: gross,
      SGST_AMT: half,
      CGST_AMT: half,
      IGST_AMT: igst,
      TDS_PER: 0,
      TDS_AMT: 0,
      NET_TOT: net,
      FNL_AMT: net,
    };
  });
}

module.exports = { loadMillReceiptSummaryRows };
