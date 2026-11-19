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
const { jsmProfitAndLoss } = require('../finalAccounts');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

// A group sits on the side of its net balance; the P&L heads (Income / Expense ledgers) are not on the
// Balance Sheet at all — they arrive as the Net Profit / Loss line.
function sideGroups(groups, want) {
  return groups.filter((g) => g.balanceType === want && g.lines.length > 0);
}

function buildLines(groups, want, ticked = null) {
  const lines = [];
  let total = 0;
  for (const g of groups) {
    const matchingLines = ticked ? g.lines.filter((l) => ticked.has(l.name)) : g.lines;
    if (matchingLines.length === 0) continue;
    lines.push({ type: 'header', label: g.name });
    let groupTotal = 0;
    for (const l of matchingLines) {
      // signed on the group's own side: a debit ledger inside a credit group is shown as a minus, not dropped
      const v = round2(want === 'Cr' ? l.credit - l.debit : l.debit - l.credit);
      lines.push({ type: 'detail', label: l.name, value: v });
      groupTotal += v;
    }
    const gt = round2(groupTotal);
    lines.push({ type: 'total', label: '', value: gt });
    total += gt;
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
    jsmProfitAndLoss(companyId, { from: p.from, to: asOn }),
  ]);

  const ticked = Array.isArray(p.accounts) && p.accounts.length ? new Set(p.accounts) : null;
  // leave the Income / Expense ledgers out (they make up the Net Profit line)
  const LedgerMaster = require('../../../models/LedgerMaster');
  const plIds = new Set((await LedgerMaster.find({ companyId, group: { $in: ['Income', 'Expenses'] } }).select('_id').lean()).map((l) => String(l._id)));
  tb.groups = tb.groups
    .map((g) => {
      const lines = g.lines.filter((l) => !plIds.has(String(l.ledgerId)));
      const net = round2(lines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0));
      return { ...g, lines, balanceType: net >= 0 ? 'Dr' : 'Cr' };
    });
  const liab = buildLines(sideGroups(tb.groups, 'Cr'), 'Cr', ticked);
  const asset = buildLines(sideGroups(tb.groups, 'Dr'), 'Dr', ticked);
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

async function options(companyId) {
  const LedgerMaster = require('../../../models/LedgerMaster');
  const ledgers = await LedgerMaster.find({
    companyId,
    isActive: { $ne: false },
    group: { $nin: ['Income', 'Expenses'] },
  }).select('name').lean();
  return { accounts: [...new Set(ledgers.map((l) => l.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)) };
}

module.exports = { run, options };
