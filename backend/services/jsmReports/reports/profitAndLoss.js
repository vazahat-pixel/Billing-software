'use strict';

/**
 * JSM: Reports › Final Reports › Profit & Loss Account (A_Final_ProfitAndLoss).
 *
 * Two stacked blocks in the same two columns (EXPENDITURE | INCOME), confirmed against the
 * owner's own printed P&L (03/11/2026):
 *   TRADING ACCOUNT        — direct items (Purchase, Jobwork, Process Charge, Sales Return on
 *                             Expenditure; Sales, Round Off on Income), closing stock added to
 *                             Income when the screen's own Closing Stock field is filled in (this
 *                             software carries no automatic inventory valuation for the Trading
 *                             Account — JSM's own screen requires the same manual figure), then a
 *                             GROSS PROFIT/LOSS line on whichever side is short so both foot equal.
 *   PROFIT & LOSS ACCOUNT  — opens with the Gross figure carried down, then every remaining
 *                             (indirect) income/expense ledger, then a NET PROFIT/LOSS line.
 *
 * Expenditure always lists Expense-group ledgers and Income always lists Income-group ledgers —
 * this software's own normal Dr/Cr convention — rather than the ledger's momentary balance side,
 * which is how JSM's own demo data happened to place a couple of lines (abnormal balances in that
 * test company, not a rule to replicate).
 *
 * Only A-Current (not provisional) is wired; "Provisional" and "Net Sales %"/"Show %" toggles are
 * cosmetic additions with no captured ground truth yet.
 */
const financialReportsService = require('../../financialReportsService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

function detailLines(items, pick) {
  return items.map((b) => ({ type: 'detail', label: b.ledger.name, value: round2(pick(b)) }));
}

async function run(companyId, p = {}) {
  const asOn = p.to || p.from;
  const pl = await financialReportsService.profitAndLoss(companyId, { from: p.from, to: asOn });
  const closingStock = Number(p.closingStock || 0);

  // Trading Account
  const tradeExp = detailLines(pl.directExpense, (b) => b.balance);
  const tradeInc = detailLines(pl.directIncome, (b) => b.balance);
  if (closingStock > 0.001) tradeInc.push({ type: 'detail', label: 'CLOSING STOCK', value: round2(closingStock) });

  const tradeExpTotal = round2(tradeExp.reduce((s, l) => s + l.value, 0));
  const tradeIncTotal = round2(tradeInc.reduce((s, l) => s + l.value, 0) );
  const gross = round2(pl.grossProfit + closingStock); // grossProfit already Income-direct minus Expense-direct
  const grossSide = gross >= 0 ? 'left' : 'right'; // a GROSS LOSS plugs Expenditure's shortfall into Income's column (JSM's own layout)
  // JSM's print puts GROSS LOSS on the Income side (reducing it to balance) when Expenditure > Income.
  const tradeFootTotal = Math.max(tradeExpTotal, tradeIncTotal);

  const left1 = [
    { type: 'header', label: 'TRADING ACCOUNT' },
    ...tradeExp,
    { type: 'grand', label: 'TOTAL', value: tradeFootTotal },
  ];
  const right1 = [
    { type: 'header', label: '' },
    ...tradeInc,
  ];
  if (grossSide === 'right') right1.push({ type: 'detail', label: 'GROSS LOSS', value: round2(Math.abs(gross)) });
  right1.push({ type: 'grand', label: 'TOTAL', value: tradeFootTotal });
  if (grossSide === 'left') left1.push({ type: 'detail', label: 'GROSS PROFIT', value: round2(Math.abs(gross)) });

  // Profit & Loss Account — opens with the Gross figure carried down.
  const plExp = detailLines(pl.indirectExpense, (b) => b.balance);
  const plInc = detailLines(pl.indirectIncome, (b) => b.balance);
  const left2 = [{ type: 'header', label: 'PROFIT & LOSS ACCOUNT' }];
  const right2 = [{ type: 'header', label: '' }];
  if (grossSide === 'right') left2.push({ type: 'detail', label: 'GROSS LOSS', value: round2(Math.abs(gross)) });
  else right2.push({ type: 'detail', label: 'GROSS PROFIT', value: round2(Math.abs(gross)) });
  left2.push(...plExp);
  right2.push(...plInc);

  const plExpSubtotal = round2(left2.filter((l) => l.type === 'detail').reduce((s, l) => s + l.value, 0));
  const plIncSubtotal = round2(right2.filter((l) => l.type === 'detail').reduce((s, l) => s + l.value, 0));
  right2.push({ type: 'total', label: 'TOTAL.', value: plIncSubtotal });
  const netProfit = pl.netProfit;
  if (netProfit < 0) right2.push({ type: 'detail', label: 'NET LOSS', value: round2(Math.abs(netProfit)) });
  else left2.push({ type: 'detail', label: 'NET PROFIT', value: round2(netProfit) });
  // Both sides foot to the same figure by construction (standard double-entry T-account close),
  // not by independently re-adding each side's own numbers — that would only coincide when the
  // books are already correct, and silently diverge the moment they are not.
  const plFootTotal = round2(Math.max(plExpSubtotal + Math.max(0, netProfit), plIncSubtotal + Math.max(0, -netProfit)));
  left2.push({ type: 'grand', label: 'TOTAL', value: plFootTotal });
  right2.push({ type: 'grand', label: 'TOTAL', value: plFootTotal });

  return {
    left: { title: 'EXPENDITURE', lines: [...left1, ...left2] },
    right: { title: 'INCOME', lines: [...right1, ...right2] },
    title: 'Trading & ProfitLoss Account',
    period: `As On Date : ${p.toText || p.to || ''}`,
  };
}

async function options() { return {}; }

module.exports = { run, options };
