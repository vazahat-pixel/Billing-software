const mongoose = require('mongoose');
const Sales = require('../models/Sales');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const AccountingEntry = require('../models/AccountingEntry');

class SalesService {
  async createInvoice(salesData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { companyId, items } = salesData;

      const Counter = require('../models/Counter');
      const counterId = `INV-${companyId}`;
      const seq = await Counter.nextSeq(counterId);
      salesData.invoiceNo = salesData.invoiceNo && salesData.invoiceNo !== 'AUTO' ? salesData.invoiceNo : `INV-${seq}`;

      // 1. Create the Sales Record inside transaction
      const sales = new Sales(salesData);
      await sales.save({ session });

      // 2. Reduce Stock and Log Movements (inside transaction)
      for (const item of items) {
        if (item.lotId) {
          const lot = await InventoryLot.findOne({ _id: item.lotId, companyId }).session(session);
          if (!lot) throw new Error(`Lot not found`);
          if (lot.remainingMtrs < (item.mts || 0)) {
            throw new Error(`Insufficient stock in Lot ${lot.lotId}. Available: ${lot.remainingMtrs} mtrs`);
          }

          lot.remainingMtrs = parseFloat((lot.remainingMtrs - (item.mts || 0)).toFixed(4));
          lot.remainingPcs = Math.max(0, (lot.remainingPcs || 0) - (item.pcs || 0));
          lot.status = lot.remainingMtrs <= 0 ? 'Closed' : 'Partially Used';
          await lot.save({ session });

          const movement = new StockMovement({
            lotId: lot._id,
            type: 'SALE',
            qtyPcs: -(item.pcs || 0),
            qtyMtrs: -(item.mts || 0),
            balanceMtrs: lot.remainingMtrs,
            referenceId: sales._id,
            remarks: `Sales Inv: ${sales.invoiceNo}`,
            companyId
          });
          await movement.save({ session });
        }
      }

      // 3. FIXED: Auto-accounting posting INSIDE transaction so it rolls back if it fails
      const accountingService = require('./accountingService');
      const entry = await accountingService.onSalesInvoicePost(sales, session);
      
      // Store accounting entry reference on invoice
      sales.accountingEntryId = entry?._id;
      await sales.save({ session });

      await session.commitTransaction();
      return sales;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getSales(companyId, { page = 1, limit = 100, startDate, endDate, status } = {}) {
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
    const [sales, total] = await Promise.all([
      Sales.find(query)
        .populate('customerId', 'name gstin state')
        .populate('items.itemId', 'name hsnCode gstRate')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Sales.countDocuments(query)
    ]);

    return { sales, total, page: parseInt(page), limit: parseInt(limit) };
  }

  async getSaleById(id, companyId) {
    const sale = await Sales.findOne({ _id: id, companyId })
      .populate('customerId', 'name gstin state city')
      .populate('items.itemId', 'name hsnCode gstRate unit');
    if (!sale) throw new Error('Sale not found');
    return sale;
  }

  async updateSaleStatus(id, companyId, status) {
    const validStatuses = ['active', 'cancelled', 'paid', 'partial'];
    if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);
    const sale = await Sales.findOneAndUpdate(
      { _id: id, companyId },
      { status },
      { new: true, runValidators: true }
    );
    if (!sale) throw new Error('Sale not found');
    return sale;
  }

  /**
   * FIXED: Cancel now creates a proper accounting reversal entry.
   * The original entry is NOT deleted — a new reversal entry is posted.
   * Inventory stock is NOT restored on cancellation (goods already dispatched).
   * For stock restoration, use Sales Return workflow.
   */
  async deleteSale(id, companyId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const sale = await Sales.findOne({ _id: id, companyId }).session(session);
      if (!sale) throw new Error('Sale not found');

      if (sale.status === 'active' || sale.status === 'partial') {
        // Post reversal accounting entry
        if (sale.accountingEntryId) {
          const originalEntry = await AccountingEntry.findById(sale.accountingEntryId).session(session);
          if (originalEntry && !originalEntry.isReversed) {
            const accountingService = require('./accountingService');
            const entryNo = await accountingService.generateEntryNo(companyId, 'JNL');

            // Flip Dr/Cr for reversal
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
              voucherType: 'SalesAuto',
              refType: 'SalesInvoice',
              refId: sale._id,
              lines: reversalLines,
              narration: `Reversal of Sales Invoice #${sale.invoiceNo}`,
              isReversed: false
            }], { session });

            // Mark original entry as reversed
            await AccountingEntry.findByIdAndUpdate(
              originalEntry._id,
              { isReversed: true, reversalEntryId: reversalEntry[0]._id },
              { session }
            );
          }
        }

        sale.status = 'cancelled';
        await sale.save({ session });
        await session.commitTransaction();
        return sale;
      }

      // Hard delete if already cancelled
      await Sales.findOneAndDelete({ _id: id, companyId }).session(session);
      await session.commitTransaction();
      return { message: 'Sale deleted' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new SalesService();
