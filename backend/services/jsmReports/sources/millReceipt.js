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
const { MONTHS, round } = require('../jcEngine');

async function loadMillReceiptRows(companyId) {
  const [jobs, book] = await Promise.all([
    Job.find({ companyId, status: { $in: ['Received', 'Partial'] } })
      .populate('workerId', 'name')
      .populate('outputItemId', 'name')
      .populate({ path: 'lotId', select: 'lotId itemId', populate: { path: 'itemId', select: 'name' } })
      .lean(),
    Book.findOne({ companyId, module: 'millRec' }).sort({ createdAt: 1 }).lean(),
  ]);
  const bookName = book?.name || 'MILL RECEIPT';
  return jobs.map((j) => {
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
      FINISHITEM: j.outputItemId?.name || grey,
      SRAL_NO: '',
      NCBILL_NO: String(j.billGpNo || j.challanNo || ''),
      BILL_DATE: date,
      MONTH: date ? MONTHS[date.getUTCMonth()] : '',
      REC_PCS: Number(j.receivedPcs || 0),
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

module.exports = { loadMillReceiptRows };
