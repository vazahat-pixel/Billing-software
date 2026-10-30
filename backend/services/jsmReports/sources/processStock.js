'use strict';

/**
 * MERN mill (or job work) challans as rows of JSM's JSM_VW_PROCESS_STOCK_DTL: one row per receipt line of a challan
 * (a challan with nothing received is one row), the challan's own columns repeated on each row, plus its totals and
 * balance up to the "Upto Rec Date". Read-only.
 *
 * JSM view: I_MILL_CH (A) left-joined to its I_MILL_IT receipt lines (B, bill date <= rec date) and their sums (C);
 * TOT_BAL_PCS = ISS_PCS - SUM(IT_PCS), TOT_BAL_QTY = ISS_QTY - SUM(SND_QTY) (grey), TOT_BAL_AMT = TOT_BAL_QTY * PU_RATE.
 */
const Job = require('../../../models/Job');
const Party = require('../../../models/Party');
const Book = require('../../../models/Book');
const Company = require('../../../models/Company');
require('../../../models/InventoryLot');
require('../../../models/Item');
const { round } = require('../jcEngine');

const isJobWork = (j) => j.workKind === 'Job' || (!j.workKind && j.processType === 'Job Work');
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

/** Receipt lines of a challan; challans saved without per-receipt lines show their received totals as one line. */
function receiptLines(j) {
  const lines = (j.receipts || []).map((r) => ({
    date: r.date ? new Date(r.date) : null, billNo: r.billNo || '', serialNo: r.serialNo || '',
    grey: Number(r.greyQty || 0), finish: Number(r.finishQty || 0), pcs: Number(r.pcs || 0), kgs: Number(r.kgs || 0), short: Number(r.shortQty || 0),
  }));
  // what was received but is not in the lines (receipts saved on this screen after the import, or no lines at all)
  const greyTotal = Number(j.receivedGreyQty ?? j.receivedQty ?? 0);
  const rest = {
    grey: round(greyTotal - lines.reduce((s, l) => s + l.grey, 0)),
    finish: round(Number(j.receivedQty || 0) - lines.reduce((s, l) => s + l.finish, 0)),
    pcs: Number(j.receivedGreyPcs ?? j.receivedPcs ?? 0) - lines.reduce((s, l) => s + l.pcs, 0),
  };
  if (rest.grey > 0.005 || rest.finish > 0.005 || rest.pcs > 0) {
    lines.push({ date: j.receiveDate ? new Date(j.receiveDate) : null, billNo: j.billGpNo || '', serialNo: j.serialNo || '', grey: rest.grey, finish: rest.finish, pcs: rest.pcs, kgs: 0, short: 0 });
  }
  return lines;
}

/**
 * @param {string} kind  'Mill' (Process Stock) or 'Job' (Job Work stock)
 * @param {object} o     recTo: receipts up to this date (YYYY-MM-DD) count; '' = all
 */
async function loadProcessStockRows(companyId, { kind = 'Mill', recTo = '' } = {}) {
  const [jobs, company, book] = await Promise.all([
    Job.find({ companyId, status: { $ne: 'Cancelled' } })
      .populate('workerId', 'name group brokerId')
      .populate({ path: 'lotId', select: 'lotId itemId rate', populate: { path: 'itemId', select: 'name' } })
      .lean(),
    Company.findById(companyId).select('name coCode').lean(),
    Book.findOne({ companyId, module: kind === 'Job' ? 'jobIssue' : 'millIssue' }).sort({ createdAt: 1 }).lean(),
  ]);
  const mine = jobs.filter((j) => (kind === 'Job' ? isJobWork(j) : !isJobWork(j)));
  const brokerIds = [...new Set(mine.map((j) => j.workerId?.brokerId).filter(Boolean))];
  const brokers = brokerIds.length
    ? new Map((await Party.find({ _id: { $in: brokerIds.filter((x) => /^[0-9a-f]{24}$/i.test(x)) } }).select('name').lean()).map((p) => [String(p._id), p.name]))
    : new Map();
  const coShort = company?.coCode || '';
  const register = book?.name || (kind === 'Job' ? 'JOB ISSUE' : 'MILL ISSUE');
  const upTo = recTo ? dayKey(recTo) : '';

  const rows = [];
  for (const j of mine) {
    const chDate = j.issueDate ? new Date(j.issueDate) : null;
    const issPcs = Number(j.issuePcs || 0);
    const issQty = Number(j.issueQty || 0);
    const issKgs = Number(j.issueKgs || 0);
    const puRate = Number(j.purchaseRate || 0);
    const lines = receiptLines(j).filter((l) => !upTo || !l.date || dayKey(l.date) <= upTo);
    const recPcs = lines.reduce((s, l) => s + l.pcs, 0);
    const recGrey = round(lines.reduce((s, l) => s + l.grey, 0));
    const recKgs = round(lines.reduce((s, l) => s + l.kgs, 0), 3);
    const balQty = round(issQty - recGrey);
    const balPcs = issPcs - recPcs;
    const [remark1 = '', remark2 = ''] = String(j.remark || '').split(/\r?\n/);
    const item = j.lotId?.itemId?.name || '';
    const mill = j.workerId?.name || '';
    const chNo = String(j.challanNo || j.jobCardNo || '');
    const challan = {
      CO_PATH: coShort, CO_SHORT: coShort, COMPANY: company?.name || '', ENT_NO: String(j._id), CO_ENT_NO: `${j._id}${coShort}2`,
      RF: j.finish === 'R' ? 'R' : 'F', RE_FINISH: j.finish === 'R' ? 'R' : 'F',
      NCCHLN_NO: chNo, CHLN_NO: /^\d+$/.test(chNo) ? Number(chNo) : 0, CHLN_DATE: chDate,
      MILL_NAME: mill, ITEM_NAME: item, PURCHASE_PARTY: j.weaver || '', PU_BILLNO: j.purchaseBillNo || '',
      LOT_NO: j.lotNo || j.lotId?.lotId || '', MASTER_NAME: j.masterName || '', MAINGROUP: String(j.workerId?.group || ''),
      BROKER: brokers.get(String(j.workerId?.brokerId || '')) || '', TRANSPORT: j.transport || '', REGISTER: register, BOOK: register,
      ISS_PCS: issPcs, ISS_QTY: issQty, ISS_KGS: issKgs, PU_RATE: puRate, PU_AMOUNT: round(issQty * puRate),
      REMARK_1: remark1, REMARK_2: remark2, LAST_YEAR: j.lastYear || '',
      TOT_REC_PCS: recPcs, TOT_GRY_REC_QTY: recGrey, TOT_BAL_PCS: balPcs, TOT_BAL_QTY: balQty, TOT_BAL_AMT: round(balQty * puRate),
      TOT_REC_KGS: recKgs, TOT_SHORT_KGS: 0, TOT_BAL_KGS: round(issKgs - recKgs, 3), TOT_KGS_AMT: round((issKgs - recKgs) * puRate),
      PENDING: balQty > 0.005 || balPcs > 0 ? 'PENDING' : 'CLEAR', UNIT_NAME: 'QTY',
    };
    const at = (d) => (d && chDate ? Math.round((new Date(dayKey(d)) - new Date(dayKey(chDate))) / 86400000) : 0);
    if (!lines.length) {
      rows.push({ ...challan, SRAL_NO: 0, NCBILL_NO: '', REC_BILLNO: '', BILL_DATE: null, REC_BILLDATE: null, R_SH_TG: 0, R_SHORT_QTY: 0, R_short_qty: 0, R_REC_PCS: 0, R_GRY_REC_QTY: 0, R_FNS_REC_QTY: 0, R_REC_KGS: 0, DUE_DAYS: 0, OS_DAYS: 0 });
      continue;
    }
    for (const l of lines) {
      const shTg = l.grey ? round(((l.grey - l.finish) / l.grey) * 100) : 0;
      rows.push({
        ...challan, SRAL_NO: Number(l.serialNo) || 0, NCBILL_NO: l.billNo, REC_BILLNO: l.billNo, BILL_DATE: l.date, REC_BILLDATE: l.date,
        R_SH_TG: shTg, R_SHORT_QTY: round(l.short), R_short_qty: round(l.short), R_REC_PCS: l.pcs, R_GRY_REC_QTY: round(l.grey), R_FNS_REC_QTY: round(l.finish),
        R_REC_KGS: l.kgs, DUE_DAYS: at(l.date), OS_DAYS: at(l.date),
      });
    }
  }
  return rows;
}

module.exports = { loadProcessStockRows, isJobWork };
