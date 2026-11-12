'use strict';

/**
 * JSM Bank / Cash Book Extra Reports:
 *   - Rpt_CB1_Reconsilation          (Reconciliation & Recon.Test — Read-Only Statement)
 *   - A_CashBankLedgerSingleSide     (Bank OD Intrest)
 *   - A_Bank_Receipt_Bill_Os_Details (Bank Voucher Print — Receipt Against Bill Details)
 */
const { orderRows, inList, inDateRange, round, MONTHS } = require('../jcEngine');
const ledgerEngine = require('../../ledgerEngineService');

function diffDays(a, b) {
  if (!a || !b) return 0;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  return Math.max(0, Math.round((Date.UTC(db.getUTCFullYear(), db.getUTCMonth(), db.getUTCDate())
    - Date.UTC(da.getUTCFullYear(), da.getUTCMonth(), da.getUTCDate())) / 86400000));
}

const bankReconciliation = {
  async run(companyId, p = {}, deps = {}) {
    const mode = String(p.txType || 'Both');
    const tickStatus = String(p.status || 'All');
    const sortMode = String(p.sortBy || 'By Date');

    let rows = deps.rows;
    let bookBalance = Number(deps.bookBalance || 0);
    if (!rows) {
      const PaymentVoucher = require('../../../models/PaymentVoucher');
      const BankInstrument = require('../../../models/BankInstrument');
      const LedgerMaster = require('../../../models/LedgerMaster');

      const ledger = p.bankName
        ? await LedgerMaster.findOne({ companyId, name: p.bankName }).lean()
        : await LedgerMaster.findOne({ companyId, group: 'Bank Accounts' }).lean();
      if (ledger) {
        const stmt = await ledgerEngine.getStatement(companyId, ledger.name, { from: p.from, to: p.to });
        bookBalance = Number(stmt.closingBalance || 0) * (stmt.closingBalanceType === 'Cr' ? -1 : 1);
      }

      const vFilter = { companyId, status: 'Posted' };
      if (ledger) vFilter.bankLedgerId = ledger._id;
      const [vouchers, instruments] = await Promise.all([
        PaymentVoucher.find(vFilter).lean(),
        BankInstrument.find({ companyId, ...(ledger ? { bankLedgerId: ledger._id } : {}) }).lean(),
      ]);
      const instByNo = new Map(instruments.map((i) => [String(i.instrumentNo || '').trim(), i]));
      rows = vouchers.map((v) => {
        const inst = instByNo.get(String(v.chequeNo || '').trim());
        const clearDate = v.clearDate || inst?.clearedDate || null;
        return {
          ENT_NO: v.voucherNo || String(v._id),
          ENT_DATE: v.date,
          CHQ_DD_NO: v.chequeNo || '',
          BOOK: v.partyName || '',
          DEPOSITS: v.voucherType === 'Receipt' ? round(v.amount) : 0,
          WITHDRAWAL: v.voucherType === 'Payment' ? round(v.amount) : 0,
          CLEAR_DATE: clearDate,
          REMARK_1: v.narration || '',
          REMARK_2: v.remark2 || '',
        };
      });
    }

    if (p.from || p.to) rows = inDateRange(rows, 'ENT_DATE', p.from, p.to);
    if (mode === 'Receipt') rows = rows.filter((r) => Number(r.DEPOSITS || 0) > 0);
    if (mode === 'Payment') rows = rows.filter((r) => Number(r.WITHDRAWAL || 0) > 0);
    if (tickStatus === 'Pending') rows = rows.filter((r) => !r.CLEAR_DATE);
    if (tickStatus === 'Clear') rows = rows.filter((r) => Boolean(r.CLEAR_DATE));

    const orderSpec = sortMode === 'By ClearDate'
      ? ['CLEAR_DATE', 'ENT_DATE']
      : (sortMode === 'By ChqNo' ? ['CHQ_DD_NO', 'ENT_DATE'] : ['ENT_DATE', 'CHQ_DD_NO']);
    const ordered = orderRows(rows, orderSpec);

    let runBal = 0;
    let depNotClear = 0;
    let issNotClear = 0;
    const out = ordered.map((r) => {
      const dep = round(r.DEPOSITS || 0);
      const wd = round(r.WITHDRAWAL || 0);
      runBal = round(runBal + dep - wd);
      if (!r.CLEAR_DATE) {
        depNotClear = round(depNotClear + dep);
        issNotClear = round(issNotClear + wd);
      }
      return { ...r, BAL_AMT: runBal };
    });

    const bankStmtBal = round(bookBalance - depNotClear + issNotClear);
    return {
      rows: out,
      grid: {
        layout: 'RUNTIME_BANK_RECON',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: `Bank Reconcilation Statment${p.bankName ? ` - ${p.bankName}` : ''}`,
        period: `FROM : ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
        notice: `Accounts Bal: ${bookBalance.toFixed(2)} | Cheq Deposited Not Clear: ${depNotClear.toFixed(2)} | Cheq Issued Not Clear: ${issNotClear.toFixed(2)} | Bank Statement Bal: ${bankStmtBal.toFixed(2)} (Read-only view)`,
        pageWise: false,
      },
    };
  },

  async options(companyId) {
    const LedgerMaster = require('../../../models/LedgerMaster');
    const ledgers = await LedgerMaster.find({ companyId, group: { $in: ['Bank Accounts', 'Bank OD A/c', 'Cash-in-Hand'] } })
      .select('name')
      .lean();
    return { banks: ledgers.map((l) => l.name).filter(Boolean).sort() };
  },
};

const bankOdInterest = {
  async run(companyId, p = {}, deps = {}) {
    const rate = Number(p.interestRate ?? 0) || 0;
    const yearDays = Number(p.yearDays ?? 360) || 360;
    const interestMode = p.mode === 'Interest';
    const tillDate = p.to || new Date().toISOString().slice(0, 10);

    let accounts = deps.accounts;
    if (!accounts) {
      const LedgerMaster = require('../../../models/LedgerMaster');
      let bankNames = p.parties && p.parties.length ? p.parties : null;
      if (!bankNames) {
        const list = await LedgerMaster.find({ companyId, group: { $in: ['Bank Accounts', 'Bank OD A/c'] } }).select('name').lean();
        bankNames = list.map((l) => l.name).filter(Boolean);
      }
      accounts = await Promise.all(bankNames.map((n) => ledgerEngine.getStatement(companyId, n, { from: p.from, to: p.to })));
    }

    const rows = [];
    for (const stmt of accounts) {
      const lines = stmt.statement || [];
      let bal = Number(stmt.openingBalance || 0) * (stmt.openingBalanceType === 'Cr' ? -1 : 1);
      for (let i = 0; i < lines.length; i++) {
        const cur = lines[i];
        const dr = round(cur.debit || 0);
        const cr = round(cur.credit || 0);
        bal = round(bal + dr - cr);
        const nextDate = i + 1 < lines.length ? lines[i + 1].date : tillDate;
        const days = diffDays(cur.date, nextDate);
        // OD/CC interest accrues on overdrawn (negative / Cr) balance when Interest mode is active
        const odPrincipal = bal < 0 ? Math.abs(bal) : 0;
        const intAmt = interestMode && rate > 0 ? round((odPrincipal * rate / 100 / yearDays) * days) : 0;
        rows.push({
          BOOK: stmt.ledgerName || '',
          ENT_DATE: cur.date,
          PARTICULARS: cur.particulars || '',
          CHQ_NO: cur.chequeNo || '',
          DR_AMOUNT: dr,
          CR_AMOUNT: cr,
          CL_BAL: Math.abs(bal),
          DRCR: bal < 0 ? 'CR' : 'DR',
          DAYS: days,
          INT_RATE: rate,
          INT_AMT: intAmt,
        });
      }
    }

    return {
      rows,
      grid: {
        layout: 'RUNTIME_BANK_OD_INTEREST',
        variant: 1,
        groupColumns: ['BOOK'],
        groupDisplays: ['BOOK'],
        captions: {},
        title: `Bank ${interestMode ? 'OD Interest' : 'Ledger'} Report`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  },

  async options(companyId) {
    const LedgerMaster = require('../../../models/LedgerMaster');
    const list = await LedgerMaster.find({ companyId, group: { $in: ['Bank Accounts', 'Bank OD A/c', 'Cash-in-Hand'] } })
      .select('name')
      .lean();
    return { parties: list.map((l) => l.name).filter(Boolean).sort() };
  },
};

const ORDER_MAP = {
  Bank: 'BANK',
  Party: 'PARTY',
  Register: 'BOOK',
  Month: 'MONTH',
  None: null,
};

const bankVoucherPrint = {
  async run(companyId, p = {}, deps = {}) {
    let rows = deps.rows;
    if (!rows) {
      const PaymentVoucher = require('../../../models/PaymentVoucher');
      require('../../../models/LedgerMaster');
      const vouchers = await PaymentVoucher.find({ companyId, status: 'Posted', voucherType: 'Receipt' })
        .populate('bankLedgerId', 'name')
        .lean();
      rows = [];
      for (const v of vouchers) {
        const dt = v.date ? new Date(v.date) : null;
        const month = dt ? MONTHS[dt.getUTCMonth()] : '';
        const items = (v.againstInvoices && v.againstInvoices.length)
          ? v.againstInvoices
          : [{ invoiceNo: v.intBillNo || '', billDate: v.date, billAmt: v.amount, amount: v.amount }];
        for (const a of items) {
          rows.push({
            SRAL_NO: v.voucherNo || '',
            REC_DATE: v.date,
            BANK: v.bankLedgerId?.name || '',
            BOOK: v.bookName || v.bankLedgerId?.name || '',
            PARTY: v.partyName || '',
            CHQ_NO: v.chequeNo || '',
            NCBILL_NO: a.invoiceNo || '',
            BILL_DATE: a.billDate || null,
            BILL_AMT: round(a.billAmt || 0),
            ADJUST: round(a.amount || 0),
            DISCOUNT: round(a.discount || 0),
            TDS: round(a.tds || 0),
            RG_AMT: round(a.rg || 0),
            NET_OS: round(a.netOs || 0),
            MONTH: month,
          });
        }
      }
    }

    if (p.from || p.to) rows = inDateRange(rows, 'REC_DATE', p.from, p.to);
    rows = inList(rows, 'BOOK', p.books);
    rows = inList(rows, 'PARTY', p.parties);

    const g1 = ORDER_MAP[p.orderBy1] ?? 'BANK';
    const g2 = ORDER_MAP[p.orderBy2] ?? null;
    const groupColumns = [g1, g2].filter(Boolean);
    return {
      rows: orderRows(rows, [...groupColumns, 'REC_DATE', { field: 'SRAL_NO', dir: 'asc', numeric: true }]),
      grid: {
        layout: 'RUNTIME_BANK_VOUCHER_PRINT',
        variant: 1,
        groupColumns,
        groupDisplays: groupColumns,
        captions: {},
        title: 'Bank Receipt Bill Net O/s. Report',
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  },

  async options(companyId) {
    const PaymentVoucher = require('../../../models/PaymentVoucher');
    const vouchers = await PaymentVoucher.find({ companyId, status: 'Posted', voucherType: 'Receipt' })
      .populate('bankLedgerId', 'name')
      .select('bookName partyName bankLedgerId')
      .lean();
    const uniq = (vals) => [...new Set(vals.filter(Boolean))].sort();
    return {
      books: uniq(vouchers.map((v) => v.bookName || v.bankLedgerId?.name)),
      parties: uniq(vouchers.map((v) => v.partyName)),
    };
  },
};

module.exports = { bankReconciliation, bankOdInterest, bankVoucherPrint };
