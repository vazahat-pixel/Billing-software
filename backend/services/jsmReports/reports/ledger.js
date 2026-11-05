'use strict';

/**
 * JSM: Reports › Fas Reports › Ledger / Ledger T-Format / Confirmation
 * (A_AccountLedgerSingleSide / A_AccountLedgerDoubleSide — same screen shape, same data).
 *
 * One section per selected account: an OPENING BALANCE row, every posted entry in date order
 * with its running balance, then a CLOSING BALANCE row — exactly as JSM prints it when several
 * accounts are ticked (one after another, no merged totals). Built on
 * ledgerEngineService.getStatement(), the same engine behind this software's own Ledger
 * Statement screen, so these figures can never drift from what the rest of the app shows.
 *
 * Layout: JSM_VW_LEDGER_ACCOUNT (captured from STP_REPORT, mode D) — DATE, BILL NO, BOOK, DEBIT,
 * CREDIT, CLOSING, DRCR. REMARK_1 / REMARK_2 follow the screen's own "With Narration 1/2"
 * checkboxes (both checked by default, matching the captured runtime state).
 */
const ledgerEngine = require('../../ledgerEngineService');
const LedgerMaster = require('../../../models/LedgerMaster');

async function buildSection(companyId, name, p) {
  const stmt = await ledgerEngine.getStatement(companyId, name, { from: p.from, to: p.to });

  const rows = [{
    GROUP1: stmt.ledgerName,
    ENT_DATE: p.from ? new Date(p.from) : null,
    NCBILL_NO: '',
    BOOK_name: 'OPENING BALANCE',
    REMARK_1: '',
    REMARK_2: '',
    DR_AMOUNT: stmt.openingBalanceType === 'Dr' ? stmt.openingBalance : 0,
    CR_AMOUNT: stmt.openingBalanceType === 'Cr' ? stmt.openingBalance : 0,
    CLOSING_BAL: stmt.openingBalance,
    CLOSING_DRCR: stmt.openingBalanceType,
  }];

  for (const line of stmt.statement) {
    rows.push({
      GROUP1: stmt.ledgerName,
      ENT_DATE: line.date ? new Date(line.date) : null,
      NCBILL_NO: line.billVoucherNo || '',
      BOOK_name: line.particulars || '',
      REMARK_1: p.withNarration1 === false ? '' : (line.narration || ''),
      REMARK_2: p.withNarration2 === false ? '' : (line.remarks || ''),
      DR_AMOUNT: line.debit || 0,
      CR_AMOUNT: line.credit || 0,
      CLOSING_BAL: line.runningBalance,
      CLOSING_DRCR: line.balanceType,
    });
  }

  rows.push({
    GROUP1: stmt.ledgerName,
    ENT_DATE: p.to ? new Date(p.to) : null,
    NCBILL_NO: '',
    BOOK_name: 'CLOSING BALANCE',
    REMARK_1: '',
    REMARK_2: '',
    DR_AMOUNT: stmt.closingBalanceType === 'Dr' ? stmt.closingBalance : 0,
    CR_AMOUNT: stmt.closingBalanceType === 'Cr' ? stmt.closingBalance : 0,
    CLOSING_BAL: stmt.closingBalance,
    CLOSING_DRCR: stmt.closingBalanceType,
  });

  return rows;
}

async function run(companyId, p = {}) {
  const names = [...new Set((p.ledgers || []).map((n) => String(n || '').trim()).filter(Boolean))];
  if (!names.length) {
    const err = new Error('Select at least one account');
    err.status = 400;
    throw err;
  }

  // JSM prints the accounts in name order, not in the order they were ticked
  // (`ORDER BY AC_NAME, ENT_DATE, …` — A_AccountLedgerSingleSide.LedgerExportToExcel). Its
  // HeadWise and IndexWise orders put GRAC_HEAD / GRCHR_CODE ahead of the name; neither is
  // wired here yet, so the screen always prints JSM's default Account order.
  names.sort((a, b) => a.toUpperCase().localeCompare(b.toUpperCase()));

  const sections = [];
  for (const name of names) sections.push(await buildSection(companyId, name, p));

  return {
    rows: sections.flat(),
    grid: {
      layout: 'JSM_VW_LEDGER_ACCOUNT',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: names.length === 1 ? `Ledger : ${names[0]}` : 'Account Ledger',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const ledgers = await LedgerMaster.find({ companyId, isActive: true }).select('name accountType').lean();
  const names = (pick) => [...new Set(ledgers.filter(pick).map((l) => l.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  return {
    parties: names(() => true),
    groups: [...new Set(ledgers.map((l) => l.accountType).filter(Boolean))].sort(),
  };
}

module.exports = { run, options };
