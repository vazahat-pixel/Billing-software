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
      const masterCompanyId = await require('./companyGroupService').masterId(companyId);
    const parties = await Party.find({ _id: { $in: partyIds }, companyId: masterCompanyId }).select('type city state').lean();
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

  /**
   * JSM Final Reports — presentation only.
   * Every rupee comes from ledgerEngine.computeBalances (same engine as the party ledger).
   * Nothing here posts, rewrites, or reclassifies a journal.
   */
  async _jsmRows(companyId, { asOn, includeOpening = true } = {}) {
    const balances = await ledgerEngine.computeBalances(companyId, { asOn, includeOpening });
    const partyIds = [...new Set(
      balances.map((b) => b.ledger.linkedPartyId).filter(Boolean).map(String)
    )];
    const partiesById = new Map();
    if (partyIds.length) {
      const masterCompanyId = await require('./companyGroupService').masterId(companyId);
      const parties = await Party.find({ _id: { $in: partyIds }, companyId: masterCompanyId })
        .select('type city state address pan name')
        .lean();
      parties.forEach((p) => partiesById.set(String(p._id), p));
    }
    return balances.map((b) => {
      const party = b.ledger.linkedPartyId ? partiesById.get(String(b.ledger.linkedPartyId)) : null;
      return {
        ledgerId: String(b.ledgerId),
        name: b.ledger.name,
        code: b.ledger.code || '',
        group: b.ledger.group,
        subGroup: b.ledger.subGroup || '',
        head: jsmCategory(b.ledger, party?.type),
        debit: b.type === 'Dr' ? b.balance : 0,
        credit: b.type === 'Cr' ? b.balance : 0,
        balance: b.balance,
        type: b.type,
        address: partyAddress(party),
        pan: party?.pan || '',
        station: party?.city || '',
        hasBalance: b.balance > 0.001,
      };
    });
  }

  async finalHeads(companyId) {
    const LedgerMaster = require('../models/LedgerMaster');
    const ledgers = await LedgerMaster.find({ companyId, isActive: true })
      .select('name code group subGroup accountType linkedPartyId')
      .sort({ name: 1 })
      .lean();
    const partyIds = [...new Set(ledgers.map((l) => l.linkedPartyId).filter(Boolean).map(String))];
    const partiesById = new Map();
    if (partyIds.length) {
      const masterCompanyId = await require('./companyGroupService').masterId(companyId);
      const parties = await Party.find({ _id: { $in: partyIds }, companyId: masterCompanyId }).select('type').lean();
      parties.forEach((p) => partiesById.set(String(p._id), p));
    }
    const accounts = ledgers.map((l) => {
      const party = l.linkedPartyId ? partiesById.get(String(l.linkedPartyId)) : null;
      return {
        id: String(l._id),
        name: l.name,
        code: l.code || '',
        head: jsmCategory(l, party?.type),
        subGroup: l.subGroup || '',
      };
    });
    const headSet = new Map();
    for (const a of accounts) {
      if (!headSet.has(a.head)) headSet.set(a.head, a.code);
    }
    const heads = [...headSet.entries()]
      .map(([name, code]) => ({ name, code }))
      .sort((a, b) => groupRank(a.name) - groupRank(b.name) || a.name.localeCompare(b.name));
    return { accounts, heads };
  }

  async jsmGroupList(companyId, { asOn, ledgerIds } = {}) {
    let rows = await this._jsmRows(companyId, { asOn, includeOpening: true });
    const idSet = new Set((ledgerIds || []).map(String));
    if (idSet.size) rows = rows.filter((r) => idSet.has(r.ledgerId));
    rows = rows.filter((r) => r.hasBalance);
    const groups = packGroups(rows, (r) => r.head).map((g) => ({
      name: g.name,
      lines: g.lines.map(publicLine),
      totalDebit: g.totalDebit,
      totalCredit: g.totalCredit,
    }));
    return {
      asOn: asOn || new Date(),
      groups,
      grandDebit: round2(groups.reduce((s, g) => s + g.totalDebit, 0)),
      grandCredit: round2(groups.reduce((s, g) => s + g.totalCredit, 0)),
    };
  }

  async jsmTrialBalance(companyId, { from, to, basis = 'current', layout = 'double', order = 'group', heads } = {}) {
    const asOn = basis === 'opening' ? (from || to) : to;
    let rows = await this._jsmRows(companyId, { asOn, includeOpening: true });
    const headSet = new Set((heads || []).map(String));
    if (headSet.size) rows = rows.filter((r) => headSet.has(r.head));
    rows = rows.filter((r) => r.hasBalance);
    const keyFn = order === 'schedule'
      ? (r) => (r.subGroup || r.head || 'OTHERS').toUpperCase()
      : (r) => r.head;
    if (order === 'alpha') rows.sort((a, b) => a.name.localeCompare(b.name));
    const groups = packGroups(rows, keyFn, order !== 'group');

    const sideOf = (lines, field) => lines
      .filter((l) => l[field] > 0.001)
      .map((l) => ({ name: l.name, code: l.code, amount: l[field], station: l.station }));

    const left = [];
    const right = [];
    for (const g of groups) {
      const cr = sideOf(g.lines, 'credit');
      const dr = sideOf(g.lines, 'debit');
      if (cr.length) {
        left.push({
          name: g.name,
          lines: layout === 'summary' || layout === 'doubleGroup' ? [] : cr,
          total: round2(cr.reduce((s, l) => s + l.amount, 0)),
        });
      }
      if (dr.length) {
        right.push({
          name: g.name,
          lines: layout === 'summary' || layout === 'doubleGroup' ? [] : dr,
          total: round2(dr.reduce((s, l) => s + l.amount, 0)),
        });
      }
    }

    const debitTotal = round2(groups.reduce((s, g) => s + g.totalDebit, 0));
    const creditTotal = round2(groups.reduce((s, g) => s + g.totalCredit, 0));
    const single = layout === 'single' || layout === 'singleGroup' || layout === 'summary';
    return {
      from: from || null,
      to: to || asOn || null,
      basis,
      layout,
      order,
      mode: single ? 'single' : 'double',
      hideLines: layout === 'summary' || layout === 'doubleGroup',
      showGroupTotal: layout !== 'single',
      groups: groups.map((g) => ({
        name: g.name,
        lines: layout === 'summary' ? [] : g.lines.map(publicLine),
        totalDebit: g.totalDebit,
        totalCredit: g.totalCredit,
      })),
      left,
      right,
      debitTotal,
      creditTotal,
      difference: round2(debitTotal - creditTotal),
    };
  }

  async jsmProfitAndLoss(companyId, { from, to, openingStock = 0, closingStock = 0 } = {}) {
    const balances = await ledgerEngine.computeBalances(companyId, {
      asOn: to,
      from,
      includeOpening: false,
    });
    const tradingLeft = [];
    const tradingRight = [];
    const plLeft = [];
    const plRight = [];

    const place = (listPos, listNeg, ledgerName, signed) => {
      if (signed >= 0.005) listPos.push({ name: String(ledgerName || '').toUpperCase(), amount: round2(signed) });
      else if (signed <= -0.005) listNeg.push({ name: String(ledgerName || '').toUpperCase(), amount: round2(-signed) });
    };

    for (const b of balances) {
      if (b.balance <= 0.001) continue;
      const g = b.ledger.group;
      if (g !== 'Income' && g !== 'Expenses') continue;
      const trading = isTradingLedger(b.ledger);
      if (g === 'Expenses') {
        const signed = b.type === 'Dr' ? b.balance : -b.balance;
        if (trading) place(tradingLeft, tradingRight, b.ledger.name, signed);
        else place(plLeft, plRight, b.ledger.name, signed);
      } else {
        const signed = b.type === 'Cr' ? b.balance : -b.balance;
        if (trading) place(tradingRight, tradingLeft, b.ledger.name, signed);
        else place(plRight, plLeft, b.ledger.name, signed);
      }
    }

    const sortName = (a, b) => a.name.localeCompare(b.name);
    tradingLeft.sort(sortName);
    tradingRight.sort(sortName);
    plLeft.sort(sortName);
    plRight.sort(sortName);

    const ob = round2(Number(openingStock) || 0);
    const cb = round2(Number(closingStock) || 0);
    if (ob > 0.001) tradingLeft.unshift({ name: 'OPENING STOCK', amount: ob });
    if (cb > 0.001) tradingRight.push({ name: 'CLOSING STOCK', amount: cb });

    const sum = (list) => round2(list.reduce((s, l) => s + l.amount, 0));
    const tLeftSub = sum(tradingLeft);
    const tRightSub = sum(tradingRight);
    const grossSigned = round2(tRightSub - tLeftSub);
    const gross = {
      label: grossSigned >= 0 ? 'GROSS PROFIT' : 'GROSS LOSS',
      amount: round2(Math.abs(grossSigned)),
      side: grossSigned >= 0 ? 'left' : 'right',
    };
    const tradingLeftTotal = round2(tLeftSub + (gross.side === 'left' ? gross.amount : 0));
    const tradingRightTotal = round2(tRightSub + (gross.side === 'right' ? gross.amount : 0));

    if (gross.side === 'right' && gross.amount > 0.001) plLeft.unshift({ name: 'GROSS LOSS', amount: gross.amount });
    if (gross.side === 'left' && gross.amount > 0.001) plRight.unshift({ name: 'GROSS PROFIT', amount: gross.amount });

    const pLeftSub = sum(plLeft);
    const pRightSub = sum(plRight);
    const netSigned = round2(pRightSub - pLeftSub);
    const net = {
      label: netSigned >= 0 ? 'NET PROFIT' : 'NET LOSS',
      amount: round2(Math.abs(netSigned)),
      side: netSigned >= 0 ? 'left' : 'right',
    };

    const netSales = round2(tradingRight
      .filter((l) => l.name !== 'CLOSING STOCK')
      .reduce((s, l) => s + l.amount, 0));

    return {
      period: { from: from || null, to: to || null },
      openingStock: ob,
      closingStock: cb,
      netSales,
      netProfit: netSigned,
      trading: {
        left: tradingLeft,
        right: tradingRight,
        leftSub: tLeftSub,
        rightSub: tRightSub,
        gross,
        leftTotal: tradingLeftTotal,
        rightTotal: tradingRightTotal,
      },
      profitLoss: {
        left: plLeft,
        right: plRight,
        leftSub: pLeftSub,
        rightSub: pRightSub,
        net,
        leftTotal: round2(pLeftSub + (net.side === 'left' ? net.amount : 0)),
        rightTotal: round2(pRightSub + (net.side === 'right' ? net.amount : 0)),
      },
    };
  }

  async jsmBalanceSheet(companyId, { from, asOn, layout = 'double', order = 'group', onlySummary = false, withNetProfit = true, withStation = false, openingStock = 0, closingStock = 0 } = {}) {
    const rows = (await this._jsmRows(companyId, { asOn, includeOpening: true }))
      .filter((r) => r.hasBalance && r.group !== 'Income' && r.group !== 'Expenses');
    const keyFn = order === 'schedule'
      ? (r) => (r.subGroup || r.head || 'OTHERS').toUpperCase()
      : (r) => r.head;
    const sorted = order === 'alpha' ? [...rows].sort((a, b) => a.name.localeCompare(b.name)) : rows;
    const groups = packGroups(sorted, keyFn, order !== 'group');
    const left = [];
    const right = [];
    for (const g of groups) {
      const cr = g.lines.filter((l) => l.credit > 0.001);
      const dr = g.lines.filter((l) => l.debit > 0.001);
      if (cr.length) {
        left.push({
          name: g.name,
          lines: onlySummary ? [] : cr.map((l) => ({
            name: l.name, code: l.code, amount: l.credit, station: withStation ? l.station : '',
          })),
          total: round2(cr.reduce((s, l) => s + l.credit, 0)),
        });
      }
      if (dr.length) {
        right.push({
          name: g.name,
          lines: onlySummary ? [] : dr.map((l) => ({
            name: l.name, code: l.code, amount: l.debit, station: withStation ? l.station : '',
          })),
          total: round2(dr.reduce((s, l) => s + l.debit, 0)),
        });
      }
    }
    const pl = await this.jsmProfitAndLoss(companyId, { from, to: asOn, openingStock, closingStock });
    const netProfit = pl.netProfit;
    const leftSub = round2(left.reduce((s, g) => s + g.total, 0));
    const rightSub = round2(right.reduce((s, g) => s + g.total, 0));
    const plug = withNetProfit ? netProfit : 0;
    const grandLeft = round2(leftSub + (plug > 0 ? plug : 0));
    const grandRight = round2(rightSub + (plug < 0 ? -plug : 0));
    return {
      from: from || null,
      asOn: asOn || new Date(),
      layout,
      order,
      onlySummary: !!onlySummary,
      withStation: !!withStation,
      withNetProfit: !!withNetProfit,
      left,
      right,
      leftSub,
      rightSub,
      netProfit: plug,
      netLabel: netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS',
      grandLeft,
      grandRight,
      difference: round2(grandLeft - grandRight),
    };
  }
}

const JSM_GROUP_ORDER = [
  'CAPITAL ACCOUNT',
  'CREDITORS FOR JOBWORK',
  'CREDITORS FOR PROCESS',
  'SUNDRY CREDITORS',
  'DUTIES & TAXES',
  'PROVISIONS',
  'BANK BALANCE',
  'CASH-IN-HAND',
  'SUNDRY DEBTORS',
  'CURRENT ASSETS',
  'FIXED ASSETS',
  'TRADING INCOME',
  'TRADING EXPENSE',
  'PROFIT & LOSS INCOME',
  'PROFIT & LOSS EXPENSE',
];

function groupRank(name) {
  const i = JSM_GROUP_ORDER.indexOf(name);
  return i === -1 ? 500 : i;
}

function isTradingLedger(ledger) {
  const sub = String(ledger.subGroup || '').toUpperCase();
  const name = String(ledger.name || '').toUpperCase();
  if (/DIRECT|TRADING/.test(sub)) return true;
  if (/(SALES|PURCHASE|JOB\s*WORK|JOBWORK|PROCESS|GREY)/.test(name)) return true;
  return false;
}

function jsmCategory(ledger, partyType) {
  const group = ledger.group || '';
  if (group === 'Income') return isTradingLedger(ledger) ? 'TRADING INCOME' : 'PROFIT & LOSS INCOME';
  if (group === 'Expenses') return isTradingLedger(ledger) ? 'TRADING EXPENSE' : 'PROFIT & LOSS EXPENSE';
  if (ledger.accountType === 'Party' && partyType === 'Job Worker') {
    const blob = `${ledger.name || ''} ${ledger.subGroup || ''}`.toUpperCase();
    if (/JOB/.test(blob)) return 'CREDITORS FOR JOBWORK';
    return 'CREDITORS FOR PROCESS';
  }
  return categorizeLedger(ledger, partyType);
}

function partyAddress(party) {
  if (!party) return '';
  const a = party.address;
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object') return [a.line1, a.line2, a.street].filter(Boolean).join(', ');
  return '';
}

function publicLine(l) {
  return {
    ledgerId: l.ledgerId,
    name: l.name,
    code: l.code,
    debit: l.debit,
    credit: l.credit,
    address: l.address,
    pan: l.pan,
    station: l.station,
  };
}

function packGroups(rows, keyFn, alphaGroups = false) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || 'OTHERS';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()]
    .map(([name, lines]) => {
      const sorted = [...lines].sort((a, b) => a.name.localeCompare(b.name));
      return {
        name,
        lines: sorted,
        totalDebit: round2(sorted.reduce((s, l) => s + l.debit, 0)),
        totalCredit: round2(sorted.reduce((s, l) => s + l.credit, 0)),
      };
    })
    .sort((a, b) => (alphaGroups ? a.name.localeCompare(b.name) : groupRank(a.name) - groupRank(b.name) || a.name.localeCompare(b.name)));
}

module.exports = new FinancialReportsService();
