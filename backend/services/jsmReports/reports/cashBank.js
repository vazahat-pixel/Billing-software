'use strict';

/**
 * JSM: Reports › Fas Reports › Bank / Cash Book › Bank Book / Cash Book / Cash/Bank Register
 * (Rpt_cashbank1 / A_All_CashBank_Report — same report, same JSM form shape).
 *
 * A Cash or Bank ledger's own statement, captioned the way JSM captions a money book (Receipt /
 * Payment, or Debit / Credit on the Z-Dtl+VNo variant) instead of Debit / Credit / Closing —
 * reusing ledgerEngineService.getStatement(), the same engine behind this app's own Ledger
 * Statement screen and this session's Ledger report. Receipt(Debit) = Dr (money in increases a
 * Cash/Bank asset), Payment(Credit) = Cr — ordinary double-entry either way.
 *
 * Ground truth: the owner's own two prints (Cash_Bank_Report.pdf, 03/11/2026):
 *   X-Detail   — Date / Description / ChqNo / Receipt / Payment / Balance. Only the active side's
 *                amount is shown (the other is blank, not "0.00"); Balance carries its own
 *                "CR"/"DR" suffix in the cell.
 *   Z-Dtl+VNo  — same, plus a Vno column (the settling voucher's own number — JSM's T_TRANDATA.
 *                NCBILL_NO, confirmed live against JsmSql2_DEMO2026, 03/11/2026) and Debit/Credit
 *                captions instead of Receipt/Payment.
 * Both show a second, indented line under a row that settled a bill ("Bill No.:9") or carried a
 * bank name — JSM's REMARK_1 — one "Book : <name>" section per ticked account, an Opening Balance
 * row, every posting, then a Closing Balance row whose Receipt/Payment cells are the PERIOD'S
 * totals (unlike the plain Ledger report's closing row).
 *
 * The bank-name subline here is the voucher's own bankLedgerId — JSM's demo print showed a
 * different value there (a drawee-bank name, e.g. "ABN AMRO B") that didn't match either leg of
 * the transaction; this software has no drawee-bank field to source that from, so the voucher's
 * real bank ledger is shown instead rather than inventing one.
 */
const ledgerEngine = require('../../ledgerEngineService');
const LedgerMaster = require('../../../models/LedgerMaster');

const round2 = (n) => Number(Number(n || 0).toFixed(2));
const balText = (amount, type) => `${round2(amount).toFixed(2)} ${type}`;
const amtOrBlank = (v) => (Math.abs(v || 0) < 0.005 ? '' : round2(v).toFixed(2));

function sublineOf(line) {
  if (line.billNos) return `Bill No.:${line.billNos}`;
  if (line.bankName) return line.bankName;
  return '';
}

async function buildSection(companyId, name, p) {
  const stmt = await ledgerEngine.getStatement(companyId, name, { from: p.from, to: p.to });

  const rows = [{
    GROUP1: stmt.ledgerName,
    ENT_DATE: p.from ? new Date(p.from) : null,
    VNO: '',
    DESCRIPTION: 'Opening Balance :',
    CHQ_NO: '',
    RECEIPT: stmt.openingBalanceType === 'Dr' ? stmt.openingBalance.toFixed(2) : '0.00',
    PAYMENT: stmt.openingBalanceType === 'Cr' ? stmt.openingBalance.toFixed(2) : '0.00',
    BALANCE: balText(stmt.openingBalance, stmt.openingBalanceType),
  }];

  let periodReceipt = 0;
  let periodPayment = 0;
  for (const line of stmt.statement) {
    periodReceipt += line.debit || 0;
    periodPayment += line.credit || 0;
    rows.push({
      GROUP1: stmt.ledgerName,
      ENT_DATE: line.date ? new Date(line.date) : null,
      VNO: line.billVoucherNo || '',
      DESCRIPTION: line.particulars || '',
      CHQ_NO: line.chequeNo || '',
      RECEIPT: amtOrBlank(line.debit),
      PAYMENT: amtOrBlank(line.credit),
      BALANCE: balText(line.runningBalance, line.balanceType),
    });
    const sub = sublineOf(line);
    if (sub) {
      rows.push({
        GROUP1: stmt.ledgerName,
        ENT_DATE: null,
        VNO: '',
        DESCRIPTION: `    ${sub}`,
        CHQ_NO: '',
        RECEIPT: '',
        PAYMENT: '',
        BALANCE: '',
      });
    }
  }

  rows.push({
    GROUP1: stmt.ledgerName,
    ENT_DATE: p.to ? new Date(p.to) : null,
    VNO: '',
    DESCRIPTION: 'Closing Balance :',
    CHQ_NO: '',
    RECEIPT: round2(periodReceipt).toFixed(2),
    PAYMENT: round2(periodPayment).toFixed(2),
    BALANCE: balText(stmt.closingBalance, stmt.closingBalanceType),
  });

  return rows;
}

async function run(companyId, p = {}) {
  // X-Detail and Z-Dtl+VNo are both captured (the owner's own two prints, 03/11/2026);
  // Y-Summary is a different physical layout with no ground truth yet, so it is refused.
  const variant = p.variant || 'detail';
  if (!['detail', 'dtlvno'].includes(variant)) {
    const err = new Error(`Cash/Bank Report layout not captured yet: ${variant}`);
    err.status = 400;
    throw err;
  }
  const names = [...new Set((p.accounts || []).map((n) => String(n || '').trim()).filter(Boolean))];
  if (!names.length) {
    const err = new Error('Select at least one account');
    err.status = 400;
    throw err;
  }
  const sections = [];
  for (const name of names) sections.push(await buildSection(companyId, name, p));

  // layout: 'JSM_VW_CASHBANK_DETAIL' for X-Detail, layout: 'JSM_VW_CASHBANK_DTLVNO' for Z-Dtl+VNo.
  return {
    rows: sections.flat(),
    grid: {
      layout: variant === 'dtlvno' ? 'JSM_VW_CASHBANK_DTLVNO' : 'JSM_VW_CASHBANK_DETAIL',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: p.title || 'Cash/Bank Report',
      period: `Period : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const ledgers = await LedgerMaster.find({ companyId, accountType: { $in: ['Cash', 'Bank'] }, isActive: true })
    .select('name').lean();
  return { accounts: [...new Set(ledgers.map((l) => l.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)) };
}

module.exports = { run, options };
