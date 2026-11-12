'use strict';

/**
 * JSM: Reports › Final Reports › Check Diff Os/Ledger Cur.Year (Rpt_Jsm_Ledger_os_Diff_Check, "Ledger And O/s. Diffrance").
 *
 * For every account of the chosen book type JSM compares the ledger balance (LED_BAL: the trial-data
 * balance plus the opening) with what its outstanding bills add up to (OS_BAL: open bills less
 * unadjusted receipts) and lists the accounts where the two differ (BAL_OS_AMT = LED_BAL − OS_BAL).
 * Sales looks at debtors, Purchase at creditors. This software reads the same two figures from its
 * ledger engine and its outstanding engine (the Check Diff screen's own comparison), nothing new.
 * Process and JobWork parties have no separate outstanding register here, so those two refuse.
 */
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const round = (n) => Number(Number(n || 0).toFixed(2));

async function run(companyId, p = {}, deps = {}) {
  const book = String(p.book || 'Sales');
  if (!['Sales', 'Purchase', 'Process', 'JobWork'].includes(book)) throw bad(`Unknown book type: ${book}`);
  if (book === 'Process' || book === 'JobWork') {
    throw bad(`${book} outstanding is not kept as a separate register here, so its ledger difference cannot be listed.`);
  }
  const fas = deps.fas || require('../../fasCheckReportService');
  const res = await fas.diffYear(companyId, { asOn: p.asOn || p.to || undefined, onlyDiff: '0' });
  const rows = (res.rows || []).map((r) => {
    const ledger = book === 'Sales' ? round(r.ledgerDebit - r.ledgerCredit) : round(r.ledgerCredit - r.ledgerDebit);
    const os = book === 'Sales' ? round(r.receivable) : round(r.payable);
    return { AC_NAME: r.partyName, LED_BAL: ledger, OS_BAL: os, BAL_OS_AMT: round(ledger - os) };
  }).filter((r) => (r.LED_BAL !== 0 || r.OS_BAL !== 0) && r.BAL_OS_AMT !== 0)
    .sort((a, b) => String(a.AC_NAME).localeCompare(String(b.AC_NAME)));
  return { rows };
}

async function options() {
  return {};
}

module.exports = { run, options };
