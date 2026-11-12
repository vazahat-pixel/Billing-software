'use strict';

/**
 * JSM Old Bank / Cash Balance Reports:
 *   - Tran_BankDetail (Others Reports > Old Reports > Extra Reports > Cash Bank Flow)
 *   - Frm_TabReport   (Others Reports > Old Reports > Extra Reports > CB Bal & Extra Report > Balance)
 *
 * Uses MERN LedgerMaster + AccountingEntry + BankReconciliation cleanly (read-only).
 */
const { orderRows, round } = require('../jcEngine');

async function loadLedgerStats(companyId, deps = {}) {
  if (deps.ledgers) return deps.ledgers;
  const LedgerMaster = require('../../../models/LedgerMaster');
  const AccountingEntry = require('../../../models/AccountingEntry');
  require('../../../models/AccountGroup');
  const [ledgers, entries] = await Promise.all([
    LedgerMaster.find({ companyId, isDeleted: { $ne: true } }).populate('accountGroupId', 'name code nature').lean(),
    AccountingEntry.find({ companyId, status: { $ne: 'Cancelled' } }).select('lines voucherType clearDate isReconciled').lean(),
  ]);

  const totals = new Map();
  for (const e of entries) {
    const cleared = Boolean(e.clearDate || e.isReconciled);
    for (const l of e.lines || []) {
      const id = String(l.ledgerId || '');
      if (!id) continue;
      if (!totals.has(id)) totals.set(id, { dr: 0, cr: 0, clrDr: 0, clrCr: 0 });
      const t = totals.get(id);
      const d = Number(l.debit || 0);
      const c = Number(l.credit || 0);
      t.dr += d;
      t.cr += c;
      if (cleared) { t.clrDr += d; t.clrCr += c; }
    }
  }

  return ledgers
    .filter((l) => {
      const gn = String(l.accountGroupId?.name || l.name || '').toUpperCase();
      return gn.includes('BANK') || gn.includes('CASH') || l.isBankAccount || l.isCashAccount;
    })
    .map((l) => {
      const t = totals.get(String(l._id)) || { dr: 0, cr: 0, clrDr: 0, clrCr: 0 };
      const op = String(l.openingType || '').toUpperCase() === 'CR' ? -Number(l.openingBalance || 0) : Number(l.openingBalance || 0);
      const gn = String(l.accountGroupId?.name || l.name || '').toUpperCase();
      const isCash = l.isCashAccount || gn.includes('CASH');
      return {
        AC_NAME: l.name || '',
        GROUP_NAME: l.accountGroupId?.name || '',
        KIND: isCash ? 'CASH' : 'BANK',
        OPBAL: round(op),
        DRAMT: round(t.dr),
        CRAMT: round(t.cr),
        CLBAL: round(op + t.dr - t.cr),
        CLR_DR: round(t.clrDr),
        CLR_CR: round(t.clrCr),
        CLEAR_BAL: round(op + t.clrDr - t.clrCr),
        UNCLEAR_BAL: round((t.dr - t.cr) - (t.clrDr - t.clrCr)),
      };
    });
}

/** Tran_BankDetail — Cash Summary / Cash Only Summary / Bank Balance */
async function runBankDetail(companyId, p = {}, deps = {}) {
  const mode = p.mode || 'BankBalance'; // 'CashSummary' | 'CashOnly' | 'BankBalance'
  const stats = await loadLedgerStats(companyId, deps);
  const filtered = mode === 'CashOnly'
    ? stats.filter((s) => s.KIND === 'CASH')
    : (mode === 'BankBalance' ? stats.filter((s) => s.KIND === 'BANK') : stats);

  const rows = filtered.map((s) => ({
    BANK_NAME: s.AC_NAME,
    KIND: s.KIND,
    OP_BAL: s.OPBAL,
    BANK_DR: s.DRAMT,
    BANK_CR: s.CRAMT,
    BANK_BAL: s.CLBAL,
    RECON_DR: s.CLR_DR,
    RECON_CR: s.CLR_CR,
    RECON_BAL: s.CLEAR_BAL,
    UNCLEAR_BAL: s.UNCLEAR_BAL,
  }));

  return {
    rows: orderRows(rows, ['KIND', 'BANK_NAME']),
    grid: {
      layout: 'JSM_VW_TRAN_BANK_DETAIL',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: mode === 'BankBalance' ? 'Bank Book & Reconciled Balance' : 'Cash / Bank Flow Summary',
      period: 'Current Books',
      pageWise: false,
    },
  };
}

/** Frm_TabReport — Cash/Bank Opening, Income(Dr), Expense(Cr), Clear & Unclear Closing */
async function runTabReport(companyId, p = {}, deps = {}) {
  const stats = await loadLedgerStats(companyId, deps);
  const rows = stats.map((s) => ({
    AC_NAME: s.AC_NAME,
    KIND: s.KIND,
    OPBAL: s.OPBAL,
    INCOME: s.DRAMT,
    EXPENSE: s.CRAMT,
    CLBAL: s.CLBAL,
    CLEAR_BAL: s.CLEAR_BAL,
    UNCLEAR_BAL: s.UNCLEAR_BAL,
  }));

  return {
    rows: orderRows(rows, ['KIND', 'AC_NAME']),
    grid: {
      layout: 'JSM_VW_FRM_TAB_REPORT',
      variant: 1,
      groupColumns: ['KIND'],
      groupDisplays: ['TYPE'],
      captions: {},
      title: 'Cash & Bank Balance Summary',
      period: 'Current Books',
      pageWise: false,
    },
  };
}

const opts = async () => ({});

module.exports = {
  bankDetail: { run: runBankDetail, options: opts },
  tabReport: { run: runTabReport, options: opts },
};
