'use strict';

/**
 * JSM: Reports › Fas Reports › Bank / Cash Book › Cheq In Hand
 * (Rpt_BankStockInHandCheq, titled "Stock Report").
 *
 * The cheques taken in that have not gone out again. JSM reads JSM_VW_CHEQ_IN_HAND over a receipt
 * date range and keeps the rows where nothing has been paid against them
 * (Fill_String_For_Condition):
 *
 *   (A.REC_DATE >='…' AND A.REC_DATE <='…') AND A.BOOK IN (…) AND A.PAY_CHQNO IS NULL
 *
 * printing BOOK, PARTY, P.BANK, SRAL.NO, REC.DT, REC.AMT, CHQ.NO, CHQ.DATE, PAY.DT and PAY.AMT
 * (Js_Add_NewColumn_Function).
 *
 * A cheque receipt here carries the date it cleared the bank, blank until it does — which is the
 * same thing JSM's missing pay cheque says — so those are the receipts listed, and the two pay
 * columns stay empty, as they do on JSM's own screen.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

async function cheqRows(companyId, p) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  require('../../../models/LedgerMaster');
  const match = {
    companyId,
    status: 'Posted',
    voucherType: 'Receipt',
    chequeNo: { $nin: [null, ''] },
  };
  if (p.from || p.to) {
    match.date = {};
    if (p.from) match.date.$gte = new Date(p.from);
    if (p.to) match.date.$lte = new Date(`${p.to}T23:59:59.999Z`);
  }
  const vouchers = await PaymentVoucher.find(match)
    .populate('bankLedgerId', 'name')
    .lean();

  return vouchers
    .filter((v) => !v.clearDate)
    .map((v) => ({
      ENT_NO: String(v._id),
      BOOK: v.bookName || v.bankLedgerId?.name || '',
      AC_NAME: v.partyName || '',
      PBANK: v.partyBank || '',
      SRAL_NO: v.voucherNo || '',
      REC_DATE: v.date,
      REC_AMT: round(v.amount),
      CHQ_NO: v.chequeNo || '',
      CHQ_DATE: v.chequeDate || null,
      PAY_DATE: null,
      PAY_AMT: 0,
    }));
}

async function run(companyId, p = {}, deps = {}) {
  let rows = deps.rows || await cheqRows(companyId, p);
  rows = inDateRange(rows, 'REC_DATE', p.from, p.to);
  rows = inList(rows, 'AC_NAME', p.parties);
  rows = inList(rows, 'BOOK', p.books);

  const group = String(p.group ?? '').trim();
  const grouped = group === 'Book';

  return {
    rows: orderRows(rows, [
      grouped ? 'BOOK' : null,
      'REC_DATE',
      { field: 'SRAL_NO', dir: 'asc', numeric: true },
    ].filter(Boolean)),
    grid: {
      layout: 'JSM_VW_CHEQ_IN_HAND',
      variant: 1,
      groupColumns: grouped ? ['BOOK'] : [],
      groupDisplays: grouped ? ['BOOK'] : [],
      captions: {},
      title: `${group || 'None'} Wise Stock Report`,
      period: `DATE : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId) {
  const rows = await cheqRows(companyId, {});
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { parties: u('AC_NAME'), books: u('BOOK') };
}

module.exports = { run, options };
