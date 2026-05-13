const mongoose = require('mongoose');
const Sales = require('../models/Sales');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const ledgerService = require('./ledgerService');
const Party = require('../models/Party');

class SalesService {
  async createInvoice(salesData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { companyId, customerId, items, netAmount, taxableAmount, gstAmount, date } = salesData;

      // 1. Create the Sales Record
      const sales = new Sales(salesData);
      await sales.save({ session });

      // 2. Reduce Stock and Log Movements
      for (const item of items) {
        const lot = await InventoryLot.findOne({ _id: item.lotId, companyId }).session(session);
        if (!lot) throw new Error(`Lot ${item.lotId} not found`);
        if (lot.remainingMtrs < item.mts) throw new Error(`Insufficient stock in Lot ${lot.lotId}. Available: ${lot.remainingMtrs}`);

        lot.remainingMtrs -= item.mts;
        lot.remainingPcs -= item.pcs;
        if (lot.remainingMtrs <= 0) lot.status = 'Closed';
        await lot.save({ session });

        const movement = new StockMovement({
          lotId: lot._id,
          type: 'SALE',
          qtyPcs: -item.pcs,
          qtyMtrs: -item.mts,
          balanceMtrs: lot.remainingMtrs,
          referenceId: sales._id,
          remarks: `Sales Inv: ${sales.invoiceNo}`,
          companyId
        });
        await movement.save({ session });
      }

      // 3. Create Ledger Entries (Double Entry) via Auto-Accounting Service
      const accountingService = require('./accountingService');
      try {
        await accountingService.onSalesInvoicePost(sales);
      } catch (ae) {
        console.error('Auto accounting on sales invoice failed:', ae);
      }

      await session.commitTransaction();
      return sales;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getSales(companyId) {
    return await Sales.find({ companyId })
      .populate('customerId', 'name')
      .populate('items.itemId', 'name')
      .sort({ createdAt: -1 });
  }
}

module.exports = new SalesService();
