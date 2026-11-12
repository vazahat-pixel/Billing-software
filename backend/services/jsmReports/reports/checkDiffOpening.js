'use strict';

/**
 * JSM: Reports › Final Reports › Chek Diff Os.Bill/Op.Balance (Mst1_Check_Diff, "Rpt_Check_Diff").
 *
 * JSM compares each account's opening balance (MST_AC_MAST.OP_BAL, Dr/Cr) with the old bills still
 * pending for it (T_OS_BILL, last year's) and prints the accounts side by side — Summary one line per
 * account. Sale looks at debtors, Purchase at creditors. This software reads the opening and the
 * pending bills dated before the financial year from the Check Diff screen's own comparison
 * (fasCheckReportService.diffOpening). Process, JobWork and Agency have no separate old-bill
 * register here, and the per-bill Detail is not produced, so those choices refuse.
 */
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const round = (n) => Number(Number(n || 0).toFixed(2));

async function run(companyId, p = {}, deps = {}) {
  const book = String(p.book || 'Sale');
  if (!['Sale', 'Purchase'].includes(book)) {
    throw bad(`${book} old bills are not kept as a separate register here, so this comparison cannot be listed.`);
  }
  if (p.detail) throw bad('The per-bill Detail needs the old bill list, which is not available here; use Summary.');
  const fas = deps.fas || require('../../fasCheckReportService');
  const res = await fas.diffOpening(companyId, { asOn: p.asOn || p.to || undefined, onlyDiff: '0' });
  const want = Array.isArray(p.accounts) && p.accounts.length ? new Set(p.accounts.map((a) => String(a).toUpperCase())) : null;
  const rows = (res.rows || [])
    .filter((r) => (book === 'Sale' ? r.partyType !== 'Supplier' : r.partyType !== 'Customer'))
    .filter((r) => !want || want.has(String(r.partyName).toUpperCase()))
    .map((r) => {
      const opening = r.openingType === 'Cr' ? -round(r.opening) : round(r.opening);
      const pending = book === 'Sale' ? round(r.receivable) : round(r.payable);
      // For Purchase the opening is a credit; show both on the same side so the difference reads as JSM's.
      const op = book === 'Sale' ? opening : -opening;
      return { AC_NAME: r.partyName, OP_BAL: round(op), OS_AMOUNT: pending, DIFF: round(op - pending) };
    })
    .filter((r) => r.OP_BAL !== 0 || r.OS_AMOUNT !== 0)
    .sort((a, b) => String(a.AC_NAME).localeCompare(String(b.AC_NAME)));

  return {
    rows,
    grid: {
      layout: 'RPT_CHK_DIFF_LASTYEAR',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Chek Diff LastYear Ledger Balance & O/S Bill',
      period: `PERIOD : ${p.fromText || ''} TO ${p.toText || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId, deps = {}) {
  const fas = deps.fas || require('../../fasCheckReportService');
  const res = await fas.diffOpening(companyId, { onlyDiff: '0' });
  return { accounts: [...new Set((res.rows || []).map((r) => r.partyName).filter(Boolean))].sort((a, b) => a.localeCompare(b)) };
}

module.exports = { run, options };
