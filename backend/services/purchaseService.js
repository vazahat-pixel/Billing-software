const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const AccountingEntry = require('../models/AccountingEntry');

class PurchaseService {
  async createPurchase(purchaseData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Auto-generate Voucher Number as invoiceNo
      const Counter = require('../models/Counter');
      const counterId = `PUR-${purchaseData.companyId}`;
      const seq = await Counter.nextSeq(counterId);
      purchaseData.invoiceNo = purchaseData.invoiceNo && purchaseData.invoiceNo !== 'AUTO' ? purchaseData.invoiceNo : `PUR-${seq}`;

      // Generate Lot IDs for each item before saving
      const purchase = new Purchase(purchaseData);
      for (const item of purchase.items) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 9000) + 1000;
        item.lotId = `LOT-${timestamp}-${random}`;
      }
      await purchase.save({ session });

      // 2. Create Inventory Lots and Stock Movements inside transaction
      for (const item of purchase.items) {
        const lot = new InventoryLot({
          lotId: item.lotId,
          itemId: item.itemId,
          purchaseId: purchase._id,
          totalPcs: item.pcs || 0,
          remainingPcs: item.pcs || 0,
          totalMtrs: item.mts || 0,
          remainingMtrs: item.mts || 0,
          status: 'Available',
          source: 'purchase',
          companyId: purchase.companyId
        });
        await lot.save({ session });

        const movement = new StockMovement({
          lotId: lot._id,
          type: 'PURCHASE',
          qtyPcs: item.pcs || 0,
          qtyMtrs: item.mts || 0,
          balanceMtrs: item.mts || 0,
          referenceId: purchase._id,
          remarks: `Purchase Bill: ${purchase.invoiceNo}`,
          companyId: purchase.companyId
        });
        await movement.save({ session });
      }

      // 3. FIXED: Accounting posting INSIDE transaction (was outside before — silent failures)
      const accountingService = require('./accountingService');
      const entry = await accountingService.onPurchaseBillPost(purchase, session);

      // Store accounting entry reference on bill
      purchase.accountingEntryId = entry?._id;
      await purchase.save({ session });

      await session.commitTransaction();
      return purchase;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getPurchases(companyId, { page = 1, limit = 100, startDate, endDate, status } = {}) {
    const query = { companyId };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [purchases, total] = await Promise.all([
      Purchase.find(query)
        .populate('supplierId', 'name gstin state')
        .populate('items.itemId', 'name hsnCode gstRate')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Purchase.countDocuments(query)
    ]);

    return { purchases, total, page: parseInt(page), limit: parseInt(limit) };
  }

  async getPurchaseById(id, companyId) {
    const purchase = await Purchase.findOne({ _id: id, companyId })
      .populate('supplierId', 'name gstin state city')
      .populate('items.itemId', 'name hsnCode gstRate unit');
    if (!purchase) throw new Error('Purchase not found');
    return purchase;
  }

  async updatePurchaseStatus(id, companyId, status) {
    const validStatuses = ['active', 'cancelled', 'paid', 'partial'];
    if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);
    const purchase = await Purchase.findOneAndUpdate(
      { _id: id, companyId },
      { status },
      { new: true, runValidators: true }
    );
    if (!purchase) throw new Error('Purchase not found');
    return purchase;
  }

  /**
   * FIXED: Cancel now creates proper accounting reversal entry.
   */
  async deletePurchase(id, companyId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const purchase = await Purchase.findOne({ _id: id, companyId }).session(session);
      if (!purchase) throw new Error('Purchase not found');

      if (purchase.status === 'active' || purchase.status === 'partial') {
        // Post reversal accounting entry if original entry exists
        if (purchase.accountingEntryId) {
          const originalEntry = await AccountingEntry.findById(purchase.accountingEntryId).session(session);
          if (originalEntry && !originalEntry.isReversed) {
            const accountingService = require('./accountingService');
            const entryNo = await accountingService.generateEntryNo(companyId, 'JNL');

            const reversalLines = originalEntry.lines.map(line => ({
              ledgerId: line.ledgerId,
              ledgerName: line.ledgerName,
              type: line.type === 'Dr' ? 'Cr' : 'Dr',
              amount: line.amount,
              narration: `Reversal: ${line.narration || ''}`
            }));

            const reversalEntry = await AccountingEntry.create([{
              companyId,
              entryNo,
              entryDate: new Date(),
              voucherType: 'PurchaseAuto',
              refType: 'PurchaseBill',
              refId: purchase._id,
              lines: reversalLines,
              narration: `Reversal of Purchase Bill #${purchase.invoiceNo}`,
              isReversed: false
            }], { session });

            await AccountingEntry.findByIdAndUpdate(
              originalEntry._id,
              { isReversed: true, reversalEntryId: reversalEntry[0]._id },
              { session }
            );
          }
        }

        purchase.status = 'cancelled';
        await purchase.save({ session });
        await session.commitTransaction();
        return purchase;
      }

      await Purchase.findOneAndDelete({ _id: id, companyId }).session(session);
      await session.commitTransaction();
      return { message: 'Purchase deleted' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new PurchaseService();
