'use strict';

/**
 * Profit figures for JSM's Final Reports (Trading & P&L, Balance Sheet), the way JSM's own views build
 * them (APP_VW_FINAL_PROFIT_LOSS / APP_VW_FINAL_BALANCESHEET):
 *  - every Income / Expense ledger counts its movement in the period PLUS its opening balance — the
 *    opening of a P&L head is what was carried in (OPENING STOCK on the Trading side). The general
 *    financialReportsService.profitAndLoss() leaves openings out, which on an imported company dropped
 *    the whole Opening Stock and overstated the profit;
 *  - a ledger on its "wrong" side (an expense with a credit balance) is kept, as a negative line,
 *    instead of being dropped;
 *  - Trading Account = heads whose sub-group is Direct or Trading (JSM's TRADING EXPENSE / INCOME).
 * Read-only; used only by the JSM report screens.
 */
const ledgerEngine = require('../ledgerEngineService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));
const isTrading = (ledger) => /\bdirect\b|trading/i.test(ledger.subGroup || '');

async function jsmProfitAndLoss(companyId, { from, to } = {}) {
  const balances = await ledgerEngine.computeBalances(companyId, { asOn: to, from, includeOpening: false });
  const rows = balances
    .filter((b) => b.ledger.group === 'Income' || b.ledger.group === 'Expenses')
    .map((b) => {
      const signed = Number(b.signedBalance || 0) + Number(ledgerEngine.signedOpening(b.ledger) || 0); // Dr +
      return {
        ledger: b.ledger,
        // amount on the head's own side: Income as credit, Expense as debit
        amount: round2(b.ledger.group === 'Income' ? -signed : signed),
      };
    })
    .filter((r) => Math.abs(r.amount) > 0.004);

  const income = rows.filter((r) => r.ledger.group === 'Income');
  const expenses = rows.filter((r) => r.ledger.group === 'Expenses');
  const sum = (list) => round2(list.reduce((s, r) => s + r.amount, 0));
  const tradingIncome = income.filter((r) => isTrading(r.ledger));
  const tradingExpense = expenses.filter((r) => isTrading(r.ledger));
  const totalIncome = sum(income);
  const totalExpenses = sum(expenses);
  return {
    tradingIncome,
    tradingExpense,
    otherIncome: income.filter((r) => !isTrading(r.ledger)),
    otherExpense: expenses.filter((r) => !isTrading(r.ledger)),
    totalIncome,
    totalExpenses,
    grossProfit: round2(sum(tradingIncome) - sum(tradingExpense)),
    netProfit: round2(totalIncome - totalExpenses),
  };
}

module.exports = { jsmProfitAndLoss, isTrading };
