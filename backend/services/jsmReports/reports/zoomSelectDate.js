'use strict';

/**
 * JSM: Others Reports > Outstanding > UnAdjust Setup (Zoom_SelectDate_List)
 * Uses ledger.run() on captured JSM_VW_LEDGER_ACCOUNT layout, or delegates to bankReconciliation
 * when Btn_Reconcilation is pressed.
 */
const LedgerMaster = require('../../../models/LedgerMaster');
const ledgerReport = require('./ledger');
const bankExtra = require('./bankExtraReports');

async function run(companyId, p = {}, deps = {}) {
  if (p.action === 'Btn_Reconcilation') {
    return bankExtra.bankReconciliation.run(companyId, p, deps);
  }

  const ledgers = Array.isArray(p.ledgers) && p.ledgers.length
    ? p.ledgers
    : (p.account ? [String(p.account).trim()] : []);

  if (!ledgers.length) {
    const err = new Error('Enter or select an account name in Account field');
    err.status = 400;
    throw err;
  }

  const res = deps.ledgerRun
    ? await deps.ledgerRun(companyId, { ...p, ledgers })
    : await ledgerReport.run(companyId, { ...p, ledgers });

  const modeLabel = p.action === 'Btn_Confirmation'
    ? 'Confirmation Of Account'
    : (p.action === 'Btn_Interest' ? 'Account Ledger (Interest Mode)' : 'Account Ledger / UnAdjust Setup');

  return {
    rows: res.rows,
    grid: {
      ...res.grid,
      title: ledgers.length === 1 ? `${modeLabel} : ${ledgers[0]}` : modeLabel,
    },
  };
}

async function options(companyId) {
  const ledgers = await LedgerMaster.find({ companyId, isActive: true }).select('name').lean();
  return {
    ledgers: [...new Set(ledgers.map((l) => l.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  };
}

module.exports = { run, options };
