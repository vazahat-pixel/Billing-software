'use strict';

/**
 * MERN mill-issue challans (Job documents from the Mill Issue screen) as rows of JSM's
 * JSM_VW_PROCESS_ISSUE view (I_MILL_CH joined to book, mill, purchase party and item).
 * Read-only.
 */
const Job = require('../../../models/Job');
const Book = require('../../../models/Book');
const Company = require('../../../models/Company');
require('../../../models/Party');
require('../../../models/InventoryLot');
require('../../../models/Item');
const { MONTHS, round } = require('../jcEngine');

function splitRemark(remark) {
  const lines = String(remark || '').split(/\r?\n/);
  return [lines[0] || '', lines[1] || ''];
}

async function loadMillIssueRows(companyId, bookModule = 'millIssue') {
  const [jobs, book, company] = await Promise.all([
    Job.find({ companyId, status: { $ne: 'Cancelled' } })
      .populate('workerId', 'name')
      .populate({ path: 'lotId', select: 'lotId itemId rate', populate: { path: 'itemId', select: 'name' } })
      .lean(),
    Book.findOne({ companyId, module: bookModule }).sort({ createdAt: 1 }).lean(),
    Company.findById(companyId).select('name coCode').lean(),
  ]);
  const bookName = book?.name || (bookModule === 'jobIssue' ? 'JOB ISSUE' : 'MILL ISSUE');
  const coShort = company?.coCode || '';

  return jobs.map((j) => {
    const date = j.issueDate ? new Date(j.issueDate) : null;
    const [remark1, remark2] = splitRemark(j.remark);
    const issQty = Number(j.issueQty || 0);
    const puRate = Number(j.purchaseRate || 0);
    const chNo = String(j.challanNo || j.jobCardNo || '');
    const numericCh = /^\d+$/.test(chNo) ? Number(chNo) : 0;
    return {
      CO_PATH: coShort,
      CO_SHORT: coShort,
      ENT_NO: String(j._id),
      CO_ENT_NO: `${j._id}${coShort}`,
      BOOK: bookName,
      REGISTER: bookName,
      MILL: j.workerId?.name || '',
      PARTY: j.workerId?.name || '',
      BROKER: '',
      PU_PARTY: j.weaver || '',
      JOB_RATE: Number(j.jobRate || 0),
      PURPARTY: j.weaver || '',
      ITEM: j.lotId?.itemId?.name || '',
      MONTH: date ? MONTHS[date.getUTCMonth()] : '',
      MONTH_NAME: date ? MONTHS[date.getUTCMonth()] : '',
      MONTH_NO: date ? date.getUTCMonth() + 1 : null,
      YEAR_NO: date ? date.getUTCFullYear() : null,
      RE_FINISH: 'F',
      CHLN_NO: numericCh,
      CCHLN_NO: '',
      NCCHLN_NO: chNo,
      CHLN_DATE: date,
      ISS_PCS: Number(j.issuePcs || 0),
      ISS_QTY: issQty,
      ISS_KGS: 0,
      PU_RATE: puRate,
      PU_AMOUNT: round(issQty * puRate),
      LOT_NO: j.lotId?.lotId || '',
      REMARK_1: remark1,
      REMARK_2: remark2,
      PU_BILLNO: j.purchaseBillNo || '',
      REC_QTY: Number(j.receivedQty || 0),
      REC_PCS: Number(j.receivedPcs || 0),
    };
  });
}

module.exports = { loadMillIssueRows };
