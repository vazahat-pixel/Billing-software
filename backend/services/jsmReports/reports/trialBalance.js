'use strict';

/**
 * JSM: Reports › Final Reports › Trail Balance (Rpt_Trail_Bal_101).
 *
 * Ground truth: the form's own decompiled TMP_VW_TR_BAL view (golden-master capture,
 * backend/scripts/golden-master/jsm-blueprint/.spec-local/Rpt_Trail_Bal_101.json) computes, per
 * ledger, OP_BAL (opening as of "From") + the period's net movement, then splits the single
 * closing figure into TR_DEBIT / TR_CREDIT by sign — i.e. for the B-Single / C-GroupWise format
 * (the one the owner's own printed report used, 03/11/2026) this is just each ledger's closing
 * balance as of "To", grouped under its JSM head (BANK BALANCE, CASH-IN-HAND, SUNDRY DEBTORS,
 * SUNDRY CREDITORS, CREDITORS FOR JOBWORK, CREDITORS FOR PROCESS, DUTIES & TAXES, ...), with a
 * Grand Total and the Dr/Cr difference — reusing financialReportsService.groupedTrialBalance(),
 * the engine already behind this app's own Trial Balance screen.
 *
 * Only B-Single + C-GroupWise is wired: the owner's print is the only ground truth so far for
 * this screen's 10 other Single/Double/Schedule/Summary print layouts, each a different physical
 * layout JSM builds from the same view — asking for one of those is refused rather than guessed.
 */
const financialReportsService = require('../../financialReportsService');

function requireSingleGroupWise(p) {
  const b = String(p.format || '2').split('-')[0];
  const c = String(p.orderBy || '1').split('-')[0];
  if (b !== '2' || c !== '1') {
    const err = new Error('This Trial Balance layout is not captured yet — only B-Single / C-GroupWise is');
    err.status = 400;
    throw err;
  }
}

async function run(companyId, p = {}) {
  requireSingleGroupWise(p);
  const opening = Boolean(p.opening);
  const asOn = opening ? p.from : (p.to || p.from);

  const result = await financialReportsService.groupedTrialBalance(companyId, {
    asOn,
    withZeroBalance: Boolean(p.withZero),
  });

  const rows = [];
  for (const g of result.groups) {
    for (const l of g.lines) {
      rows.push({
        GROUP1: g.name,
        AC_NAME: l.name,
        DR_AMOUNT: l.debit,
        CR_AMOUNT: l.credit,
      });
    }
  }

  const period = opening
    ? `UPTO DATE ${p.fromText || p.from || ''}`
    : `${p.fromText || p.from || ''} To ${p.toText || p.to || ''}`;

  return {
    rows,
    grid: {
      layout: 'JSM_VW_TR_BAL',
      variant: 1,
      groupColumns: ['GROUP1'],
      groupDisplays: [],
      captions: {},
      title: opening ? 'Opening Trial Balance Report' : 'Trial Balance Report',
      period: `PERIOD : ${period}   |   Diff.Amt : ${result.difference.toFixed(2)}`,
      pageWise: false,
    },
  };
}

async function options() { return {}; }

module.exports = { run, options };
