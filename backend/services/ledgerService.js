const LedgerEntry = require('../models/LedgerEntry');

class LedgerService {
  async postToLedger(entries, session) {
    // Basic validation to ensure double-entry balances
    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Accounting Imbalance: Debit (${totalDebit}) does not match Credit (${totalCredit})`);
    }

    return await LedgerEntry.insertMany(entries, { session });
  }

  async getPartyLedger(partyId, companyId, startDate, endDate) {
    const query = { accountId: partyId, companyId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    return await LedgerEntry.find(query).sort({ date: 1, createdAt: 1 });
  }

  async getAccountBalance(partyId, companyId) {
    const entries = await LedgerEntry.find({ accountId: partyId, companyId });
    const balance = entries.reduce((acc, e) => acc + (e.debit || 0) - (e.credit || 0), 0);
    return balance;
  }
}

module.exports = new LedgerService();
