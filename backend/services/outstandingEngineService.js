const mongoose = require('mongoose');
const Party = require('../models/Party');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const PaymentVoucher = require('../models/PaymentVoucher');
const BillSettlement = require('../models/BillSettlement');
const LedgerMaster = require('../models/LedgerMaster');
const ledgerEngine = require('./ledgerEngineService');
const auditService = require('./auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * Receivable & Payable Engine — Sprint 3.5
 */
class OutstandingEngineService {
  agingBuckets(asOnDate, docDate, outstanding) {
    const ageInDays = Math.floor((asOnDate - new Date(docDate)) / (1000 * 60 * 60 * 24));
    const aging = { bucket30: 0, bucket60: 0, bucket90: 0, bucket90Plus: 0, days: ageInDays };
    if (ageInDays <= 30) aging.bucket30 = outstanding;
    else if (ageInDays <= 60) aging.bucket60 = outstanding;
    else if (ageInDays <= 90) aging.bucket90 = outstanding;
    else aging.bucket90Plus = outstanding;
    return aging;
  }

  async syncBillFromSales(companyId, sale) {
    const billAmount = round2(sale.netAmount || sale.totals?.total || 0);
    const paid = round2(sale.paidAmount || 0);
    const outstanding = round2(Math.max(0, billAmount - paid));
    const creditDays = sale.creditDays || 0;
    const dueDate = new Date(sale.date || sale.createdAt);
    dueDate.setDate(dueDate.getDate() + creditDays);

    return BillSettlement.findOneAndUpdate(
      { companyId, billType: 'SalesInvoice', billId: sale._id },
      {
        companyId,
        partyId: sale.customerId,
        billType: 'SalesInvoice',
        billId: sale._id,
        billNo: sale.invoiceNo || '',
        billDate: sale.date || sale.createdAt,
        billAmount,
        settledAmount: paid,
        outstandingAmount: outstanding,
        dueDate,
        creditDays,
        status: outstanding < 0.01 ? 'Settled' : paid > 0 ? 'Partial' : 'Open',
      },
      { upsert: true, new: true }
    );
  }

  async syncBillFromPurchase(companyId, bill) {
    const billAmount = round2(bill.netAmount || bill.totals?.total || 0);
    const paid = round2(bill.paidAmount || 0);
    const outstanding = round2(Math.max(0, billAmount - paid));
    const creditDays = bill.creditDays || 0;
    const dueDate = new Date(bill.date || bill.createdAt);
    dueDate.setDate(dueDate.getDate() + creditDays);

    return BillSettlement.findOneAndUpdate(
      { companyId, billType: 'PurchaseBill', billId: bill._id },
      {
        companyId,
        partyId: bill.supplierId,
        billType: 'PurchaseBill',
        billId: bill._id,
        billNo: bill.invoiceNo || '',
        billDate: bill.date || bill.createdAt,
        billAmount,
        settledAmount: paid,
        outstandingAmount: outstanding,
        dueDate,
        creditDays,
        status: outstanding < 0.01 ? 'Settled' : paid > 0 ? 'Partial' : 'Open',
      },
      { upsert: true, new: true }
    );
  }

  async rebuildSettlements(companyId) {
    const sales = await Sales.find({ companyId });
    const purchases = await Purchase.find({ companyId });
    for (const s of sales) await this.syncBillFromSales(companyId, s);
    for (const p of purchases) await this.syncBillFromPurchase(companyId, p);
    return { sales: sales.length, purchases: purchases.length };
  }

  async outstandingReport(companyId, { type = 'receivable', asOn } = {}) {
    const asOnDate = asOn ? new Date(asOn) : new Date();
    const isReceivable = type === 'receivable';
    const billType = isReceivable ? 'SalesInvoice' : 'PurchaseBill';

    let bills = await BillSettlement.find({
      companyId,
      billType,
      status: { $in: ['Open', 'Partial'] },
      outstandingAmount: { $gt: 0.01 },
    }).lean();

    if (!bills.length) {
      await this.rebuildSettlements(companyId);
      bills = await BillSettlement.find({
        companyId,
        billType,
        status: { $in: ['Open', 'Partial'] },
        outstandingAmount: { $gt: 0.01 },
      }).lean();
    }

    const byParty = {};
    for (const bill of bills) {
      const key = bill.partyId.toString();
      if (!byParty[key]) {
        byParty[key] = {
          partyId: bill.partyId,
          totalOutstanding: 0,
          aging: { bucket30: 0, bucket60: 0, bucket90: 0, bucket90Plus: 0 },
          bills: [],
        };
      }
      const aging = this.agingBuckets(asOnDate, bill.billDate, bill.outstandingAmount);
      byParty[key].totalOutstanding += bill.outstandingAmount;
      byParty[key].aging.bucket30 += aging.bucket30;
      byParty[key].aging.bucket60 += aging.bucket60;
      byParty[key].aging.bucket90 += aging.bucket90;
      byParty[key].aging.bucket90Plus += aging.bucket90Plus;
      byParty[key].bills.push({
        billId: bill.billId,
        billNo: bill.billNo,
        billDate: bill.billDate,
        dueDate: bill.dueDate,
        outstanding: bill.outstandingAmount,
        followUpStatus: bill.followUpStatus,
        ageDays: aging.days,
      });
    }

    const partyIds = Object.keys(byParty);
    const parties = await Party.find({ _id: { $in: partyIds }, companyId }).lean();
    const partyMap = {};
    parties.forEach((p) => { partyMap[p._id.toString()] = p; });

    return Object.values(byParty).map((row) => {
      const p = partyMap[row.partyId.toString()] || {};
      return {
        partyId: row.partyId,
        partyName: p.name || '',
        phone: p.phone || '',
        creditLimit: p.creditLimit || 0,
        creditDays: p.creditDays || 0,
        totalOutstanding: round2(row.totalOutstanding),
        aging: {
          bucket30: round2(row.aging.bucket30),
          bucket60: round2(row.aging.bucket60),
          bucket90: round2(row.aging.bucket90),
          bucket90Plus: round2(row.aging.bucket90Plus),
        },
        bills: row.bills,
        overCreditLimit: (p.creditLimit || 0) > 0 && row.totalOutstanding > p.creditLimit,
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }

  async updateFollowUp(companyId, settlementId, { followUpStatus, followUpNotes }, userId) {
    const doc = await BillSettlement.findOne({ _id: settlementId, companyId });
    if (!doc) throw new Error('Settlement not found');
    doc.followUpStatus = followUpStatus || doc.followUpStatus;
    if (followUpNotes !== undefined) doc.followUpNotes = followUpNotes;
    doc.lastFollowUpAt = new Date();
    doc.updatedBy = userId;
    await doc.save();
    return doc;
  }

  async recordSettlement(companyId, {
    billType, billId, amount, date, mode, paymentVoucherId, accountingEntryId, narration, isAdvanceAdjustment,
  }, userId) {
    const doc = await BillSettlement.findOne({ companyId, billType, billId });
    if (!doc) throw new Error('Bill settlement record not found — sync bills first');
    const amt = round2(amount);
    if (amt > doc.outstandingAmount + 0.01) {
      throw new Error(`Settlement ₹${amt} exceeds outstanding ₹${doc.outstandingAmount}`);
    }
    doc.settlements.push({
      date: date || new Date(),
      amount: amt,
      mode: mode || '',
      paymentVoucherId,
      accountingEntryId,
      isAdvanceAdjustment: !!isAdvanceAdjustment,
      narration: narration || '',
    });
    doc.settledAmount = round2(doc.settledAmount + amt);
    doc.outstandingAmount = round2(Math.max(0, doc.billAmount - doc.settledAmount));
    doc.status = doc.outstandingAmount < 0.01 ? 'Settled' : 'Partial';
    doc.updatedBy = userId;
    await doc.save();

    // Mirror paidAmount on source doc
    if (billType === 'SalesInvoice') {
      await Sales.updateOne(
        { _id: billId, companyId },
        { $set: { paidAmount: doc.settledAmount, status: doc.status === 'Settled' ? 'paid' : 'partial' } }
      );
    } else if (billType === 'PurchaseBill') {
      await Purchase.updateOne(
        { _id: billId, companyId },
        { $set: { paidAmount: doc.settledAmount, status: doc.status === 'Settled' ? 'paid' : 'partial' } }
      );
    }

    await auditService.logSystem({
      companyId, userId, action: 'BILL_SETTLEMENT', module: 'BillSettlement',
      referenceId: doc._id, after: { amount: amt, outstanding: doc.outstandingAmount },
    });
    return doc;
  }

  async checkCreditLimit(companyId, partyId, additionalAmount = 0) {
    const party = await Party.findOne({ _id: partyId, companyId });
    if (!party) throw new Error('Party not found');
    const limit = party.creditLimit || 0;
    if (!limit) return { ok: true, unlimited: true, party };

    const report = await this.outstandingReport(companyId, { type: 'receivable' });
    const row = report.find((r) => r.partyId.toString() === partyId.toString());
    const current = row?.totalOutstanding || 0;
    const projected = current + round2(additionalAmount);
    return {
      ok: projected <= limit + 0.01,
      unlimited: false,
      creditLimit: limit,
      currentOutstanding: round2(current),
      projectedOutstanding: round2(projected),
      available: round2(Math.max(0, limit - current)),
      party,
    };
  }

  /**
   * Reconcile bill-wise outstanding vs party ledger balance.
   */
  async reconcileWithLedger(companyId, { type = 'receivable' } = {}) {
    const isReceivable = type === 'receivable';
    const outstanding = await this.outstandingReport(companyId, { type });
    const mismatches = [];

    for (const row of outstanding) {
      const ledger = await LedgerMaster.findOne({ companyId, linkedPartyId: row.partyId });
      if (!ledger) {
        mismatches.push({ partyId: row.partyId, partyName: row.partyName, reason: 'No party ledger' });
        continue;
      }
      const stmt = await ledgerEngine.getStatement(companyId, ledger._id, {});
      const ledgerBal = stmt.closingBalance;
      // Receivable: party ledger should be Dr; Payable: Cr
      const expectedType = isReceivable ? 'Dr' : 'Cr';
      if (stmt.closingBalanceType !== expectedType && ledgerBal > 0.01) {
        mismatches.push({
          partyId: row.partyId,
          partyName: row.partyName,
          reason: `Expected ${expectedType} balance`,
          billOutstanding: row.totalOutstanding,
          ledgerBalance: ledgerBal,
          ledgerType: stmt.closingBalanceType,
        });
        continue;
      }
      if (Math.abs(ledgerBal - row.totalOutstanding) > 1) {
        mismatches.push({
          partyId: row.partyId,
          partyName: row.partyName,
          reason: 'Bill-wise vs ledger mismatch',
          billOutstanding: row.totalOutstanding,
          ledgerBalance: ledgerBal,
          difference: round2(ledgerBal - row.totalOutstanding),
        });
      }
    }
    return { ok: mismatches.length === 0, mismatches };
  }
}

module.exports = new OutstandingEngineService();
