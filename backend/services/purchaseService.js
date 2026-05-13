const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');

class PurchaseService {
  async createPurchase(purchaseData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Save the Purchase
      const purchase = new Purchase(purchaseData);
      
      // Generate Lot IDs for each item
      for (let item of purchase.items) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        item.lotId = `LOT-${timestamp}-${random}`;
      }

      await purchase.save({ session });

      // 2. Create Inventory Lots and Stock Movements
      for (const item of purchase.items) {
        // Create the Lot
        const lot = new InventoryLot({
          lotId: item.lotId,
          itemId: item.itemId,
          purchaseId: purchase._id,
          totalPcs: item.pcs,
          remainingPcs: item.pcs,
          totalMtrs: item.mts,
          remainingMtrs: item.mts,
          companyId: purchase.companyId
        });
        await lot.save({ session });

        // Create the Stock Movement
        const movement = new StockMovement({
          lotId: lot._id,
          type: 'PURCHASE',
          qtyPcs: item.pcs,
          qtyMtrs: item.mts,
          balanceMtrs: item.mts,
          referenceId: purchase._id,
          remarks: `Purchase Inv: ${purchase.invoiceNo}`,
          companyId: purchase.companyId
        });
        await movement.save({ session });
      }

      // Auto accounting double-entry trigger
      const accountingService = require('./accountingService');
      try {
        await accountingService.onPurchaseBillPost(purchase);
      } catch (ae) {
        console.error('Auto accounting on purchase bill failed:', ae);
      }

      await session.commitTransaction();
      return purchase;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getPurchases(companyId) {
    return await Purchase.find({ companyId })
      .populate('supplierId', 'name')
      .populate('items.itemId', 'name')
      .sort({ createdAt: -1 });
  }
}

module.exports = new PurchaseService();
