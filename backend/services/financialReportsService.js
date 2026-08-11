const AccountingEntry = require('../models/AccountingEntry');
const Party = require('../models/Party');
const ledgerEngine = require('./ledgerEngineService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const isEquityGroup = (g) => g === 'Capital' || g === 'Equity';

/**
 * Legacy Tally-style category label for a ledger — used only for the grouped Trial
 * Balance display. Real accounting (Dr/Cr, balances) never depends on this; it's
 * presentation-only, derived from fields that already exist (accountType/group/subGroup
 * plus the linked party's type for Party ledgers).
 */
function categorizeLedger(ledger, partyType) {
  const name = (ledger.name || '').toUpperCase();
  const accountType = ledger.accountType || '';
  const group = ledger.group || '';
  const subGroup = (ledger.subGroup || '').toUpperCase();

  if (accountType === 'Bank') return 'BANK BALANCE';
  if (accountType === 'Cash') return 'CASH-IN-HAND';
  if (accountType === 'Tax') return 'DUTIES & TAXES';

  if (accountType === 'Party') {
    if (partyType === 'Job Worker') return 'CREDITORS FOR PROCESS';
    if (partyType === 'Customer') return 'SUNDRY DEBTORS';
    if (partyType === 'Supplier' || partyType === 'Broker') return 'SUNDRY CREDITORS';
    return group === 'Assets' ? 'SUNDRY DEBTORS' : 'SUNDRY CREDITORS';
  }

  if (subGroup.includes('CURRENT LIABILIT')) return 'PROVISIONS';
  if (subGroup.includes('CASH & BANK')) return accountType === 'Bank' ? 'BANK BALANCE' : 'CASH-IN-HAND';
  if (subGroup.includes('CURRENT ASSET')) return 'CURRENT ASSETS';
  if (subGroup.includes('FIXED ASSET')) return 'FIXED ASSETS';
  if (group === 'Capital' || group === 'Equity') return 'CAPITAL ACCOUNT';
  if (group === 'Income') return 'PROFIT & LOSS INCOME';
  if (group === 'Expenses') return 'PROFIT & LOSS EXPENSE';
  if (group === 'Liabilities') return 'SUNDRY CREDITORS';
  if (group === 'Assets') return 'CURRENT ASSETS';
  return name || 'OTHERS';
}

/**
 * Financial Reports Engine — Sprint 3.6
 * Every report is derived from journal entries via ledgerEngine.
 */
class FinancialReportsService {
  async trialBalance(companyId, { asOn } = {}) {
    const balances = await ledgerEngine.computeBalances(companyId, { asOn, includeOpening: true });
    const lines = balances
      .filter((b) => b.balance > 0.001)
      .map((b) => ({
        ledgerId: b.ledgerId,
        name: b.ledger.name,
        group: b.ledger.group,
        subGroup: b.ledger.subGroup,
        debit: b.type === 'Dr' ? b.balance : 0,
        credit: b.type === 'Cr' ? b.balance : 0,
      }));

    const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));

    return {
      asOn: asOn || new Date(),
      lines,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.05,
      difference: round2(totalDebit - totalCredit),
    };
  }

  /** Grouped Trial Balance — same numbers as trialBalance(), organized under category
   * headers with per-group subtotals, a Station (party city) column, and Gross Profit. */
  async groupedTrialBalance(companyId, { asOn, withZeroBalance = false } = {}) {
    const balances = await ledgerEngine.computeBalances(companyId, { asOn, includeOpening: true });
    const filtered = withZeroBalance ? balances : balances.filter((b) => b.balance > 0.001);

    const partyIds = [...new Set(
      filtered.map((b) => b.ledger.linkedPartyId).filter(Boolean).map(String)
    )];
    const partiesById = new Map();
    if (partyIds.length) {
      const parties = await Party.find({ _id: { $in: partyIds }, companyId }).select('type city state').lean();
      parties.forEach((p) => partiesById.set(String(p._id), p));
    }

    const groupMap = new Map();
    for (const b of filtered) {
      const party = b.ledger.linkedPartyId ? partiesById.get(String(b.ledger.linkedPartyId)) : null;
      const category = categorizeLedger(b.ledger, party?.type);
      if (!groupMap.has(category)) groupMap.set(category, []);
      groupMap.get(category).push({
        ledgerId: b.ledgerId,
        name: b.ledger.name,
        debit: b.type === 'Dr' ? b.balance : 0,
        credit: b.type === 'Cr' ? b.balance : 0,
        station: party?.city || '',
      });
    }

    const groups = Array.from(groupMap.entries())
      .map(([name, lines]) => {
        const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
        const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
        const signed = round2(totalDebit - totalCredit);
        return {
          name,
          lines,
          totalDebit,
          totalCredit,
          totalBalance: round2(Math.abs(signed)),
          balanceType: signed >= 0 ? 'Dr' : 'Cr',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const grandTotalDebit = round2(groups.reduce((s, g) => s + g.totalDebit, 0));
    const grandTotalCredit = round2(groups.reduce((s, g) => s + g.totalCredit, 0));

    let grossProfit = 0;
    try {
      const pl = await this.profitAndLoss(companyId, { to: asOn });
      grossProfit = pl.grossProfit;
    } catch (_) { /* non-blocking — GP is a supplementary figure on this screen */ }

    return {
      asOn: asOn || new Date(),
      groups,
      grandTotalDebit,
      grandTotalCredit,
      difference: round2(grandTotalDebit - grandTotalCredit),
      isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.05,
      grossProfit,
    };
  }

  async profitAndLoss(companyId, { from, to } = {}) {
    // Period movements only — exclude static OB for P&L accounts
    const balances = await ledgerEngine.computeBalances(companyId, {
      asOn: to,
      from,
      includeOpening: false,
    });

    const income = balances.filter((b) => b.ledger.group === 'Income' && b.balance > 0.001);
    const expenses = balances.filter((b) => b.ledger.group === 'Expenses' && b.balance > 0.001);

    // Income normal Cr → credit balance; Expenses normal Dr
    const totalIncome = round2(income.reduce((s, b) => {
      return s + (b.type === 'Cr' ? b.balance : -b.balance);
    }, 0));
    const totalExpenses = round2(expenses.reduce((s, b) => {
      return s + (b.type === 'Dr' ? b.balance : -b.balance);
    }, 0));

    const directIncome = income.filter((b) => /direct/i.test(b.ledger.subGroup || ''));
    const directExpense = expenses.filter((b) => /direct/i.test(b.ledger.subGroup || ''));
    const grossIncome = round2(directIncome.reduce((s, b) => s + (b.type === 'Cr' ? b.balance : -b.balance), 0));
    const grossExpense = round2(directExpense.reduce((s, b) => s + (b.type === 'Dr' ? b.balance : -b.balance), 0));

    return {
      period: { from: from || null, to: to || null },
      income,
      expenses,
      totalIncome,
      totalExpenses,
      grossProfit: round2(grossIncome - grossExpense),
      netProfit: round2(totalIncome - totalExpenses),
    };
  }

  async balanceSheet(companyId, { asOn, from } = {}) {
    const balances = await ledgerEngine.computeBalances(companyId, { asOn, includeOpening: true });
    const pl = await this.profitAndLoss(companyId, { from, to: asOn });

    const assets = balances.filter((b) => b.ledger.group === 'Assets' && b.balance > 0.001);
    const liabilities = balances.filter((b) => b.ledger.group === 'Liabilities' && b.balance > 0.001);
    const capital = balances.filter((b) => isEquityGroup(b.ledger.group) && b.balance > 0.001);

    const totalAssets = round2(assets.reduce((s, b) => s + (b.type === 'Dr' ? b.balance : -b.balance), 0));
    const totalLiabilities = round2(liabilities.reduce((s, b) => s + (b.type === 'Cr' ? b.balance : -b.balance), 0));
    const totalCapital = round2(capital.reduce((s, b) => s + (b.type === 'Cr' ? b.balance : -b.balance), 0));

    // P&L plug into equity (Retained Earnings current period)
    const currentPL = pl.netProfit;
    const equityWithPL = round2(totalCapital + currentPL);
    const rightSide = round2(totalLiabilities + equityWithPL);

    return {
      asOn: asOn || new Date(),
      assets,
      liabilities,
      capital,
      currentPeriodPL: currentPL,
      totalAssets: Math.abs(totalAssets),
      totalLiabilities: Math.abs(totalLiabilities),
      totalCapital: Math.abs(totalCapital),
      equity: Math.abs(equityWithPL),
      isBalanced: Math.abs(Math.abs(totalAssets) - Math.abs(rightSide)) < 0.5,
      difference: round2(Math.abs(totalAssets) - Math.abs(rightSide)),
    };
  }

  async cashFlow(companyId, { from, to } = {}) {
    const match = {
      companyId,
      ...ledgerEngine.LIVE_ENTRY_FILTER,
    };
    if (from || to) {
      match.entryDate = {};
      if (from) match.entryDate.$gte = new Date(from);
      if (to) match.entryDate.$lte = new Date(to);
    }

    const cashBank = await require('../models/LedgerMaster').find({
      companyId,
      accountType: { $in: ['Cash', 'Bank'] },
      isActive: true,
    });
    const ids = new Set(cashBank.map((l) => l._id.toString()));

    const entries = await AccountingEntry.find(match).lean();
    let operating = 0;
    let investing = 0;
    let financing = 0;
    const details = [];

    for (const e of entries) {
      const cashLines = e.lines.filter((l) => ids.has(l.ledgerId.toString()));
      if (!cashLines.length) continue;
      const netCash = cashLines.reduce((s, l) => s + (l.type === 'Dr' ? l.amount : -l.amount), 0);
      let bucket = 'operating';
      if (['Contra', 'Opening', 'Closing'].includes(e.voucherType)) bucket = 'financing';
      if (/capex|fixed|asset|depreciation/i.test(e.narration || '')) bucket = 'investing';
      if (e.voucherType === 'Payment' || e.voucherType === 'Receipt') bucket = 'operating';
      if (bucket === 'operating') operating += netCash;
      else if (bucket === 'investing') investing += netCash;
      else financing += netCash;
      details.push({
        entryNo: e.entryNo,
        date: e.entryDate,
        voucherType: e.voucherType,
        netCash: round2(netCash),
        bucket,
        narration: e.narration,
      });
    }

    const netChange = round2(operating + investing + financing);
    return {
      period: { from, to },
      operating: round2(operating),
      investing: round2(investing),
      financing: round2(financing),
      netChange,
      details,
    };
  }

  async fundFlow(companyId, { from, to } = {}) {
    const openingBS = await this.balanceSheet(companyId, { asOn: from });
    const closingBS = await this.balanceSheet(companyId, { asOn: to });
    const sources = [];
    const applications = [];

    const pl = await this.profitAndLoss(companyId, { from, to });
    if (pl.netProfit > 0) sources.push({ label: 'Net Profit', amount: pl.netProfit });
    else applications.push({ label: 'Net Loss', amount: Math.abs(pl.netProfit) });

    const wcChange = round2(
      (closingBS.totalAssets - closingBS.equity - closingBS.totalLiabilities) -
      (openingBS.totalAssets - openingBS.equity - openingBS.totalLiabilities)
    );
    // Simplified working capital movement
    if (closingBS.totalAssets > openingBS.totalAssets) {
      applications.push({
        label: 'Increase in Assets',
        amount: round2(closingBS.totalAssets - openingBS.totalAssets),
      });
    } else if (openingBS.totalAssets > closingBS.totalAssets) {
      sources.push({
        label: 'Decrease in Assets',
        amount: round2(openingBS.totalAssets - closingBS.totalAssets),
      });
    }

    const totalSources = round2(sources.reduce((s, x) => s + x.amount, 0));
    const totalApplications = round2(applications.reduce((s, x) => s + x.amount, 0));

    return {
      period: { from, to },
      sources,
      applications,
      totalSources,
      totalApplications,
      workingCapitalChange: wcChange,
    };
  }

  async dayBook(companyId, { date } = {}) {
    const d = date ? new Date(date) : new Date();
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    const entries = await AccountingEntry.find({
      companyId,
      entryDate: { $gte: start, $lte: end },
      ...ledgerEngine.LIVE_ENTRY_FILTER,
    }).sort({ createdAt: 1 }).lean();
    return { date: start, entries, count: entries.length };
  }

  async journalRegister(companyId, { from, to, voucherType } = {}) {
    const filter = { companyId, ...ledgerEngine.LIVE_ENTRY_FILTER };
    if (voucherType) filter.voucherType = voucherType;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = new Date(from);
      if (to) filter.entryDate.$lte = new Date(to);
    }
    return AccountingEntry.find(filter).sort({ entryDate: 1, entryNo: 1 }).lean();
  }

  async voucherRegister(companyId, opts) {
    return this.journalRegister(companyId, opts);
  }
}

module.exports = new FinancialReportsService();
