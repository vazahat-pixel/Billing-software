const mongoose = require('mongoose');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * Ledger Engine — Sprint 3.3
 * All balances derived from journals + master OB (when no Opening journal).
 */
class LedgerEngineService {
  /**
   * Signed balance: positive = Dr, negative = Cr
   */
  signedOpening(ledger) {
    const ob = ledger.openingBalance || 0;
    if (ledger.openingEntryId) return 0; // OB already in journals
    return ledger.openingBalanceType === 'Cr' ? -ob : ob;
  }

  async aggregateByLedger(companyId, { from, to, ledgerIds } = {}) {
    const match = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isReversed: false,
      status: { $ne: 'Draft' },
    };
    if (from || to) {
      match.entryDate = {};
      if (from) match.entryDate.$gte = new Date(from);
      if (to) match.entryDate.$lte = new Date(to);
    }

    const pipeline = [
      { $match: match },
      { $unwind: '$lines' },
    ];
    if (ledgerIds?.length) {
      pipeline.push({
        $match: { 'lines.ledgerId': { $in: ledgerIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      });
    }
    pipeline.push({
      $group: {
        _id: '$lines.ledgerId',
        totalDr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Dr'] }, '$lines.amount', 0] } },
        totalCr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Cr'] }, '$lines.amount', 0] } },
      },
    });

    const rows = await AccountingEntry.aggregate(pipeline);
    const map = {};
    rows.forEach((r) => { map[r._id.toString()] = r; });
    return map;
  }

  /**
   * Period movement only (no OB) — for P&L.
   * Closing = OB + all movements up to `to`.
   */
  async computeBalances(companyId, { asOn, from, includeOpening = true } = {}) {
    const aggMap = await this.aggregateByLedger(companyId, { from, to: asOn });
    const ledgers = await LedgerMaster.find({ companyId, isActive: true });

    return ledgers.map((ledger) => {
      const row = aggMap[ledger._id.toString()] || { totalDr: 0, totalCr: 0 };
      let signed = includeOpening ? this.signedOpening(ledger) : 0;
      signed += (row.totalDr - row.totalCr);
      return {
        ledgerId: ledger._id,
        ledger,
        totalDr: round2(row.totalDr),
        totalCr: round2(row.totalCr),
        balance: round2(Math.abs(signed)),
        type: signed >= 0 ? 'Dr' : 'Cr',
        signedBalance: round2(signed),
      };
    });
  }

  /**
   * Correct statement: opening = master OB + movements before `from`.
   */
  async getStatement(companyId, ledgerId, { from, to } = {}) {
    const ledger = await LedgerMaster.findOne({ _id: ledgerId, companyId });
    if (!ledger) throw new Error('Ledger not found');

    let openingSigned = this.signedOpening(ledger);

    if (from) {
      const prior = await this.aggregateByLedger(companyId, {
        to: new Date(new Date(from).getTime() - 1),
        ledgerIds: [ledgerId],
      });
      const row = prior[ledgerId.toString()] || { totalDr: 0, totalCr: 0 };
      openingSigned += (row.totalDr - row.totalCr);
    }

    const entryFilter = {
      companyId,
      isReversed: false,
      'lines.ledgerId': ledger._id,
    };
    if (from || to) {
      entryFilter.entryDate = {};
      if (from) entryFilter.entryDate.$gte = new Date(from);
      if (to) entryFilter.entryDate.$lte = new Date(to);
    }

    const entries = await AccountingEntry.find(entryFilter).sort({ entryDate: 1, createdAt: 1 });
    let current = openingSigned;
    const statement = [];

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.ledgerId.toString() !== ledger._id.toString()) continue;
        if (line.type === 'Dr') current += line.amount;
        else current -= line.amount;
        statement.push({
          _id: entry._id,
          date: entry.entryDate,
          voucherNo: entry.entryNo,
          voucherType: entry.voucherType,
          narration: line.narration || entry.narration,
          debit: line.type === 'Dr' ? line.amount : 0,
          credit: line.type === 'Cr' ? line.amount : 0,
          runningBalance: round2(Math.abs(current)),
          balanceType: current >= 0 ? 'Dr' : 'Cr',
          refType: entry.refType,
          refId: entry.refId,
        });
      }
    }

    return {
      ledger,
      openingBalance: round2(Math.abs(openingSigned)),
      openingBalanceType: openingSigned >= 0 ? 'Dr' : 'Cr',
      closingBalance: round2(Math.abs(current)),
      closingBalanceType: current >= 0 ? 'Dr' : 'Cr',
      statement,
    };
  }

  async partyLedger(companyId, partyId, opts) {
    const ledger = await LedgerMaster.findOne({ companyId, linkedPartyId: partyId });
    if (!ledger) throw new Error('Party ledger not found');
    return this.getStatement(companyId, ledger._id, opts);
  }

  async listByType(companyId, accountType) {
    return LedgerMaster.find({ companyId, accountType, isActive: true }).sort({ name: 1 }).lean();
  }
}

module.exports = new LedgerEngineService();
