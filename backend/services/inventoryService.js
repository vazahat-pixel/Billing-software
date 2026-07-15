const mongoose = require('mongoose');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const Item = require('../models/Item');

class InventoryService {
  async getInventory(companyId, filters = {}) {
    const query = { companyId, ...filters };
    return await InventoryLot.find(query)
      .populate('itemId', 'name category fabricType brand quality')
      .populate('warehouseId', 'name code type')
      .sort({ createdAt: -1 });
  }

  async getLotDetails(lotId, companyId) {
    const lot = await InventoryLot.findOne({ lotId, companyId })
      .populate('itemId')
      .populate('warehouseId');
    if (!lot) throw new Error('Lot not found');

    const movements = await StockMovement.find({ lotId: lot._id, companyId }).sort({ createdAt: -1 });
    return { lot, movements };
  }

  async getStockByItem(itemId, companyId) {
    const lots = await InventoryLot.find({ itemId, companyId, remainingMtrs: { $gt: 0 } });
    const totalMtrs = lots.reduce((acc, lot) => acc + lot.remainingMtrs, 0);
    const totalPcs = lots.reduce((acc, lot) => acc + lot.remainingPcs, 0);
    return { totalMtrs, totalPcs, lotCount: lots.length };
  }

  async createOpeningStock({
    companyId,
    itemId,
    pcs = 0,
    mts,
    remarks = 'Opening stock entry',
    warehouseId = null,
    rate = 0,
  }) {
    if (!itemId || !mts || mts <= 0) {
      throw new Error('Item and quantity (mts) are required for opening stock.');
    }

    const item = await Item.findOne({ _id: itemId, companyId });
    if (!item) throw new Error('Item not found for this company');

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const timestamp = Date.now();
      const lotCode = `OPN-${timestamp}`;
      const unitRate = Number(rate || item.purchaseRate || 0);

      const lotDocs = await InventoryLot.create(
        [
          {
            lotId: lotCode,
            itemId,
            purchaseId: null,
            source: 'opening',
            totalPcs: pcs,
            remainingPcs: pcs,
            totalMtrs: mts,
            remainingMtrs: mts,
            warehouseId: warehouseId || item.defaultWarehouseId || null,
            rate: unitRate,
            companyId,
          },
        ],
        { session }
      );
      const lot = lotDocs[0];

      await StockMovement.create(
        [
          {
            lotId: lot._id,
            type: 'OPENING',
            qtyPcs: pcs,
            qtyMtrs: mts,
            balanceMtrs: mts,
            referenceId: lot._id,
            idempotencyKey: `OPENING:${lot._id}`,
            remarks,
            companyId,
          },
        ],
        { session }
      );

      await Item.findOneAndUpdate(
        { _id: itemId, companyId },
        { $inc: { openingStock: Number(mts) } },
        { session }
      );

      await session.commitTransaction();
      return lot;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new InventoryService();

