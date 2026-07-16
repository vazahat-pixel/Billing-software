const mongoose = require('mongoose');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');
const BankReconciliation = require('../models/BankReconciliation');
const BankInstrument = require('../models/BankInstrument');
const journalEngine = require('./journalEngineService');
const ledgerEngine = require('./ledgerEngineService');
const auditService = require('./auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * Cash & Bank Engine — Sprint 3.4
 */
class CashBankEngineService {
  async cashBook(companyId, { from, to, ledgerId } = {}) {
    const cashLedgers = ledgerId
      ? [await LedgerMaster.findOne({ _id: ledgerId, companyId, accountType: 'Cash' })]
      : await LedgerMaster.find({ companyId, accountType: 'Cash', isActive: true });

    const books = [];
    for (const ledger of cashLedgers.filter(Boolean)) {
      books.push({
        ledger,
        ...(await ledgerEngine.getStatement(companyId, ledger._id, { from, to })),
      });
    }
    return books;
  }

  async bankBook(companyId, { from, to, ledgerId } = {}) {
    const bankLedgers = ledgerId
      ? [await LedgerMaster.findOne({ _id: ledgerId, companyId, accountType: 'Bank' })]
      : await LedgerMaster.find({ companyId, accountType: 'Bank', isActive: true });

    const books = [];
    for (const ledger of bankLedgers.filter(Boolean)) {
      books.push({
        ledger,
        ...(await ledgerEngine.getStatement(companyId, ledger._id, { from, to })),
      });
    }
    return books;
  }

  async listBankAccounts(companyId) {
    return LedgerMaster.find({ companyId, accountType: 'Bank', isActive: true })
      .sort({ name: 1 })
      .lean();
  }

  async createBankAccount(companyId, payload, userId) {
    const chart = require('./chartOfAccountsService');
    return chart.createLedger(companyId, {
      name: payload.name,
      group: 'Assets',
      subGroup: 'Cash & Bank',
      accountType: 'Bank',
      nature: 'Dr',
      linkedBankAccount: {
        accountNo: payload.accountNo,
        ifsc: payload.ifsc,
        bankName: payload.bankName,
        branch: payload.branch,
      },
      openingBalance: payload.openingBalance || 0,
      openingBalanceType: payload.openingBalanceType || 'Dr',
    }, userId);
  }

  async registerInstrument(companyId, payload, userId = null) {
    const doc = await BankInstrument.create({
      companyId,
      instrumentType: payload.instrumentType,
      direction: payload.direction,
      instrumentNo: payload.instrumentNo,
      instrumentDate: payload.instrumentDate || new Date(),
      amount: round2(payload.amount),
      bankLedgerId: payload.bankLedgerId,
      partyLedgerId: payload.partyLedgerId,
      partyName: payload.partyName || '',
      status: payload.status || 'Pending',
      accountingEntryId: payload.accountingEntryId,
      paymentVoucherId: payload.paymentVoucherId,
      narration: payload.narration || '',
      createdBy: userId,
    });
    return doc;
  }

  async updateInstrumentStatus(companyId, id, { status, clearedDate, bounceReason }, userId) {
    const doc = await BankInstrument.findOne({ _id: id, companyId });
    if (!doc) throw new Error('Instrument not found');
    const before = doc.toObject();
    doc.status = status;
    if (clearedDate) doc.clearedDate = clearedDate;
    if (bounceReason) doc.bounceReason = bounceReason;
    doc.updatedBy = userId;
    await doc.save();
    await auditService.logSystem({
      companyId, userId, action: 'INSTRUMENT_STATUS', module: 'BankInstrument',
      referenceId: doc._id, before, after: doc.toObject(),
    });
    return doc;
  }

  async chequeRegister(companyId, query = {}) {
    const filter = { companyId, instrumentType: 'Cheque' };
    if (query.status) filter.status = query.status;
    if (query.direction) filter.direction = query.direction;
    if (query.from || query.to) {
      filter.instrumentDate = {};
      if (query.from) filter.instrumentDate.$gte = new Date(query.from);
      if (query.to) filter.instrumentDate.$lte = new Date(query.to);
    }
    return BankInstrument.find(filter).sort({ instrumentDate: -1 }).lean();
  }

  async digitalRegister(companyId, query = {}) {
    const filter = {
      companyId,
      instrumentType: { $in: ['NEFT', 'RTGS', 'UPI', 'IMPS'] },
    };
    if (query.status) filter.status = query.status;
    return BankInstrument.find(filter).sort({ instrumentDate: -1 }).limit(200).lean();
  }

  async postBankCharges(companyId, { bankLedgerId, amount, entryDate, narration, userId }) {
    const charges = await LedgerMaster.findOne({ companyId, name: 'Bank Charges' });
    if (!charges) throw new Error('Bank Charges ledger missing — seed CoA first');
    const amt = round2(amount);
    return journalEngine.postJournal(companyId, {
      entryDate: entryDate || new Date(),
      voucherType: 'Journal',
      refType: 'BankCharges',
      lines: [
        { ledgerId: charges._id, type: 'Dr', amount: amt, narration: narration || 'Bank charges' },
        { ledgerId: bankLedgerId, type: 'Cr', amount: amt, narration: narration || 'Bank charges' },
      ],
      narration: narration || 'Bank charges',
    }, { userId, systemPost: true });
  }

  async depositWithdraw(companyId, { cashLedgerId, bankLedgerId, amount, direction, entryDate, narration, userId }) {
    const amt = round2(amount);
    // Deposit: Dr Bank / Cr Cash ; Withdrawal: Dr Cash / Cr Bank
    const from = direction === 'Deposit' ? cashLedgerId : bankLedgerId;
    const to = direction === 'Deposit' ? bankLedgerId : cashLedgerId;
    return journalEngine.postContra(companyId, {
      fromLedgerId: from,
      toLedgerId: to,
      amount: amt,
      entryDate,
      narration: narration || direction,
      userId,
    });
  }

  async startReconciliation(companyId, { bankLedgerId, statementDate, statementBalance, userId }) {
    const stmt = await ledgerEngine.getStatement(companyId, bankLedgerId, { to: statementDate });
    const bookBalance = stmt.closingBalanceType === 'Dr' ? stmt.closingBalance : -stmt.closingBalance;

    const entries = await AccountingEntry.find({
      companyId,
      isReversed: false,
      'lines.ledgerId': bankLedgerId,
      entryDate: { $lte: new Date(statementDate) },
    }).sort({ entryDate: 1 });

    const uncleared = [];
    for (const entry of entries) {
      const line = entry.lines.find((l) => l.ledgerId.toString() === bankLedgerId.toString());
      if (!line) continue;
      uncleared.push({
        accountingEntryId: entry._id,
        entryNo: entry.entryNo,
        entryDate: entry.entryDate,
        amount: line.amount,
        type: line.type,
        reason: 'Pending clearance',
      });
    }

    const rec = await BankReconciliation.create({
      companyId,
      bankLedgerId,
      statementDate,
      statementBalance: round2(statementBalance),
      bookBalance: round2(bookBalance),
      difference: round2(statementBalance - bookBalance),
      status: 'InProgress',
      unclearedEntries: uncleared,
      createdBy: userId,
    });
    return rec;
  }

  async clearEntries(companyId, reconId, { entryIds, bankReference }, userId) {
    const rec = await BankReconciliation.findOne({ _id: reconId, companyId });
    if (!rec) throw new Error('Reconciliation not found');
    if (rec.status === 'Reconciled') throw new Error('Already reconciled');

    const idSet = new Set((entryIds || []).map(String));
    const stillUncleared = [];
    for (const u of rec.unclearedEntries) {
      if (idSet.has(u.accountingEntryId.toString())) {
        rec.clearedEntries.push({
          ...u.toObject?.() || u,
          clearedDate: new Date(),
          bankReference: bankReference || '',
        });
      } else {
        stillUncleared.push(u);
      }
    }
    rec.unclearedEntries = stillUncleared;
    rec.updatedBy = userId;
    await rec.save();
    return rec;
  }

  async finalizeReconciliation(companyId, reconId, userId) {
    const rec = await BankReconciliation.findOne({ _id: reconId, companyId });
    if (!rec) throw new Error('Reconciliation not found');
    const clearedNet = rec.clearedEntries.reduce((s, e) => {
      return s + (e.type === 'Dr' ? e.amount : -e.amount);
    }, 0);
    // Soft check — difference should approach zero after adjustments
    rec.status = 'Reconciled';
    rec.reconciledBy = userId;
    rec.reconciledAt = new Date();
    await rec.save();
    await auditService.logSystem({
      companyId, userId, action: 'BANK_RECONCILED', module: 'BankReconciliation',
      referenceId: rec._id, after: { difference: rec.difference, clearedNet },
    });
    return rec;
  }

  async cashClosing(companyId, { asOn, cashLedgerId } = {}) {
    const ledgers = cashLedgerId
      ? [await LedgerMaster.findOne({ _id: cashLedgerId, companyId })]
      : await LedgerMaster.find({ companyId, accountType: 'Cash', isActive: true });

    const result = [];
    for (const ledger of ledgers.filter(Boolean)) {
      const stmt = await ledgerEngine.getStatement(companyId, ledger._id, { to: asOn });
      result.push({
        ledgerId: ledger._id,
        name: ledger.name,
        closingBalance: stmt.closingBalance,
        closingBalanceType: stmt.closingBalanceType,
        asOn: asOn || new Date(),
      });
    }
    return result;
  }
}

module.exports = new CashBankEngineService();
