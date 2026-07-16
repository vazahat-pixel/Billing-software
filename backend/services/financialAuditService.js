const mongoose = require('mongoose');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');
const InventoryLot = require('../models/InventoryLot');
const financialReports = require('./financialReportsService');
const outstandingEngine = require('./outstandingEngineService');
const AuditLog = require('../models/AuditLog');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * Audit & Reconciliation Engine — Sprint 3.8
 */
class FinancialAuditService {
  async journalAudit(companyId, { from, to } = {}) {
    const filter = { companyId };
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = new Date(from);
      if (to) filter.entryDate.$lte = new Date(to);
    }
    const entries = await AccountingEntry.find(filter).lean();
    const unbalanced = [];
    const orphans = [];
    const ledgerIds = new Set(
      (await LedgerMaster.find({ companyId }).select('_id').lean()).map((l) => l._id.toString())
    );

    for (const e of entries) {
      if (Math.abs((e.totalDebit || 0) - (e.totalCredit || 0)) > 0.01) {
        unbalanced.push({ entryNo: e.entryNo, totalDebit: e.totalDebit, totalCredit: e.totalCredit });
      }
      for (const line of e.lines || []) {
        if (!ledgerIds.has(line.ledgerId.toString())) {
          orphans.push({ entryNo: e.entryNo, ledgerId: line.ledgerId, ledgerName: line.ledgerName });
        }
      }
    }
    return {
      totalJournals: entries.length,
      unbalanced,
      orphanLines: orphans,
      ok: unbalanced.length === 0 && orphans.length === 0,
    };
  }

  async trialBalanceValidation(companyId, { asOn } = {}) {
    const tb = await financialReports.trialBalance(companyId, { asOn });
    return {
      ok: tb.isBalanced,
      totalDebit: tb.totalDebit,
      totalCredit: tb.totalCredit,
      difference: tb.difference,
    };
  }

  async inventoryVsGl(companyId) {
    const stockLedger = await LedgerMaster.findOne({ companyId, name: 'Stock A/c' });
    const lots = await InventoryLot.find({ companyId, isDeleted: { $ne: true } });
    let inventoryValue = 0;
    for (const lot of lots) {
      const qty = parseFloat(lot.remainingQty ?? lot.qty ?? 0);
      const rate = parseFloat(lot.rate ?? lot.costPerUnit ?? lot.purchaseRate ?? 0);
      inventoryValue += qty * rate;
    }
    inventoryValue = round2(inventoryValue);

    let glBalance = 0;
    let glType = 'Dr';
    if (stockLedger) {
      const ledgerEngine = require('./ledgerEngineService');
      const stmt = await ledgerEngine.getStatement(companyId, stockLedger._id, {});
      glBalance = stmt.closingBalance;
      glType = stmt.closingBalanceType;
    }

    const difference = round2(inventoryValue - (glType === 'Dr' ? glBalance : -glBalance));
    return {
      inventoryValue,
      glBalance,
      glType,
      difference,
      ok: Math.abs(difference) < 1 || !stockLedger,
      note: !stockLedger ? 'Stock A/c missing' : undefined,
    };
  }

  async gstVsGl(companyId) {
    const taxLedgers = await LedgerMaster.find({ companyId, accountType: 'Tax' });
    const ledgerEngine = require('./ledgerEngineService');
    const details = [];
    for (const led of taxLedgers) {
      const stmt = await ledgerEngine.getStatement(companyId, led._id, {});
      details.push({
        name: led.name,
        gstMapping: led.gstMapping,
        balance: stmt.closingBalance,
        type: stmt.closingBalanceType,
      });
    }
    return { ledgers: details, ok: true };
  }

  async cashReconciliation(companyId, { asOn } = {}) {
    const cashBank = require('./cashBankEngineService');
    const closing = await cashBank.cashClosing(companyId, { asOn });
    return { accounts: closing, ok: true };
  }

  async duplicateVoucherDetection(companyId) {
    const dupes = await AccountingEntry.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
      { $group: { _id: '$entryNo', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    return { duplicates: dupes, ok: dupes.length === 0 };
  }

  async suspenseDetection(companyId) {
    const suspense = await LedgerMaster.findOne({ companyId, name: 'Suspense A/c' });
    if (!suspense) return { ok: true, balance: 0 };
    const ledgerEngine = require('./ledgerEngineService');
    const stmt = await ledgerEngine.getStatement(companyId, suspense._id, {});
    return {
      ok: stmt.closingBalance < 0.01,
      balance: stmt.closingBalance,
      type: stmt.closingBalanceType,
    };
  }

  async fullReconciliation(companyId) {
    const [
      journal,
      tb,
      inventory,
      gst,
      cash,
      dupes,
      suspense,
      ar,
      ap,
    ] = await Promise.all([
      this.journalAudit(companyId),
      this.trialBalanceValidation(companyId),
      this.inventoryVsGl(companyId),
      this.gstVsGl(companyId),
      this.cashReconciliation(companyId),
      this.duplicateVoucherDetection(companyId),
      this.suspenseDetection(companyId),
      outstandingEngine.reconcileWithLedger(companyId, { type: 'receivable' }),
      outstandingEngine.reconcileWithLedger(companyId, { type: 'payable' }),
    ]);

    const exceptions = [];
    if (!journal.ok) exceptions.push('Journal audit failed');
    if (!tb.ok) exceptions.push(`Trial Balance off by ₹${tb.difference}`);
    if (!inventory.ok) exceptions.push(`Inventory vs GL diff ₹${inventory.difference}`);
    if (!dupes.ok) exceptions.push(`${dupes.duplicates.length} duplicate voucher numbers`);
    if (!suspense.ok) exceptions.push(`Suspense balance ₹${suspense.balance}`);
    if (!ar.ok) exceptions.push(`${ar.mismatches.length} AR ledger mismatches`);
    if (!ap.ok) exceptions.push(`${ap.mismatches.length} AP ledger mismatches`);

    return {
      ok: exceptions.length === 0,
      exceptions,
      journal,
      trialBalance: tb,
      inventory,
      gst,
      cash,
      duplicates: dupes,
      suspense,
      receivables: ar,
      payables: ap,
    };
  }

  async auditTrail(companyId, { module, from, to, limit = 100 } = {}) {
    const filter = { companyId };
    if (module) filter.module = module;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    return AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 500))
      .lean();
  }
}

module.exports = new FinancialAuditService();
