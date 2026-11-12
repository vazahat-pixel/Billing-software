'use strict';

/**
 * JSM: Reports › Final Reports › CashBank Finance (Rpt_Cash_Bank_Finance_Report, "Cash Bank Finance Report").
 *
 * JSM builds VW_T_CASH_MIX from the cash/bank vouchers (T_CASH_RPD) and lists each voucher whose
 * receipt amount is not wholly adjusted against bills: FINANCE.AMT = REC.AMT − TOT.ADJ, only where
 * that is not 0. Ticked Book and Party lists, GroupBy 1 Book or Party. Posted vouchers only;
 * TOT.ADJ is what the voucher settled against bills.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

const bad = (m) => Object.assign(new Error(m), { status: 400 });
const GROUPS = { Book: 'BOOK', Party: 'AC_NAME' };

async function loadRows(companyId) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  const vouchers = await PaymentVoucher.find({ companyId, status: 'Posted', isReversed: { $ne: true } }).lean();
  return vouchers.map((v) => {
    const adjusted = round((v.againstInvoices || []).reduce((t, a) => t + Number(a.amount || 0), 0));
    const recAmt = round(v.amount);
    return {
      ENT_NO: String(v._id),
      BOOK: v.bookName || '',
      AC_NAME: v.partyName || '',
      PBANK: v.partyBank || '',
      SRAL_NO: v.voucherNo || '',
      REC_DATE: v.date,
      REC_AMT: recAmt,
      REC_PAY: v.voucherType === 'Receipt' ? 'R' : 'P',
      CHQ_NO: v.chequeNo || '',
      CHQ_DATE: v.chequeDate || null,
      TOT_ADJUST: adjusted,
      FNCE_AMT: round(recAmt - adjusted),
    };
  });
}

async function run(companyId, p = {}, deps = {}) {
  const g = String(p.orderBy1 || 'Book');
  if (!(g in GROUPS)) throw bad(`Unknown Order By: ${g}`);
  let rows = deps.rows || await loadRows(companyId);
  rows = inDateRange(rows, 'REC_DATE', p.from, p.to);
  rows = inList(rows, 'BOOK', p.books);
  rows = inList(rows, 'AC_NAME', p.parties);
  rows = rows.filter((r) => r.FNCE_AMT !== 0);
  return {
    rows: orderRows(rows, [GROUPS[g], 'BOOK', { field: 'ENT_NO' }]),
    grid: {
      layout: 'JSM_VW_GST_BC_FINANCE_RPT',
      variant: 1,
      groupColumns: [GROUPS[g]],
      groupDisplays: [g.toUpperCase()],
      primaryDetailColumn: 'ENT_NO',
      captions: {},
      title: `${g} Wise Finance List GSTIN:`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: String(p.printout || '').startsWith('2'),
    },
  };
}

async function options(companyId, deps = {}) {
  const rows = deps.rows || await loadRows(companyId);
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  return { books: u('BOOK'), parties: u('AC_NAME') };
}

module.exports = { run, options };
