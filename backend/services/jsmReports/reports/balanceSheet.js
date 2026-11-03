'use strict';

/**
 * JSM: Reports › Final Reports › BalanceSheet (A_Final_BalanceSheet).
 *
 * Reuses financialReportsService.groupedTrialBalance() (the same JSM-head grouping already
 * verified against the owner's own printed Trial Balance, 03/11/2026 — CREDITORS FOR JOBWORK,
 * CREDITORS FOR PROCESS, BANK BALANCE, CASH-IN-HAND, SUNDRY DEBTORS/CREDITORS, DUTIES & TAXES,
 * PROVISIONS, ...) split by balance side: every Cr-balance group (excluding the P&L groups) is a
 * Liability, every Dr-balance group an Asset — and financialReportsService.profitAndLoss() for the
 * Net Profit/Loss plug, confirmed against the owner's own printed Balance Sheet (same date):
 * Liabilities total 4242770.36 + Net Profit 16339430.39 = Assets total 20582200.75.
 *
 * Only A-Group Wise + B-Double (the owner's own print) is wired — Alphabet/ScheduleWise and
 * Single are different physical layouts with no ground truth yet.
 */
const financialReportsService = require('../../financialReportsService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

function sideGroups(groups, want) {
  return groups.filter((g) => g.balanceType === want && !/PROFIT & LOSS/.test(g.name));
}

function buildLines(groups, want) {
  const lines = [];
  let total = 0;
  for (const g of groups) {
    lines.push({ type: 'header', label: g.name });
    for (const l of g.lines) {
      const v = want === 'Cr' ? l.credit : l.debit;
      lines.push({ type: 'detail', label: l.name, value: v });
    }
    lines.push({ type: 'total', label: '', value: want === 'Cr' ? g.totalCredit : g.totalDebit });
    total += want === 'Cr' ? g.totalCredit : g.totalDebit;
  }
  return { lines, total: round2(total) };
}

function requireGroupWiseDouble(p) {
  const orderBy = p.orderBy || 'group';
  const format = p.format || 'double';
  if (orderBy !== 'group' || format !== 'double') {
    const err = new Error('This Balance Sheet layout is not captured yet — only Group Wise / Double is');
    err.status = 400;
    throw err;
  }
}

async function run(companyId, p = {}) {
  requireGroupWiseDouble(p);
  const asOn = p.to || p.from;

  const [tb, pl] = await Promise.all([
    financialReportsService.groupedTrialBalance(companyId, { asOn }),
    financialReportsService.profitAndLoss(companyId, { from: p.from, to: asOn }),
  ]);

  const liab = buildLines(sideGroups(tb.groups, 'Cr'), 'Cr');
  const asset = buildLines(sideGroups(tb.groups, 'Dr'), 'Dr');
  const netProfit = pl.netProfit;
  const netProfitSide = netProfit >= 0 ? 'left' : 'right';
  const netProfitLabel = netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS';
  const netProfitValue = round2(Math.abs(netProfit));

  const left = [...liab.lines];
  const right = [...asset.lines];
  if (netProfitSide === 'left') left.push({ type: 'grand', label: netProfitLabel, value: netProfitValue });
  else right.push({ type: 'grand', label: netProfitLabel, value: netProfitValue });
  const totalLeft = round2(liab.total + (netProfitSide === 'left' ? netProfitValue : 0));
  const totalRight = round2(asset.total + (netProfitSide === 'right' ? netProfitValue : 0));
  left.push({ type: 'grand', label: 'TOTAL', value: totalLeft });
  right.push({ type: 'grand', label: 'TOTAL', value: totalRight });

  return {
    left: { title: 'LIABILITIES', lines: left },
    right: { title: 'ASSETS', lines: right },
    title: 'Balance Sheet',
    period: `As On : ${p.toText || p.to || p.fromText || p.from || ''}`,
  };
}

async function options() { return {}; }

module.exports = { run, options };
