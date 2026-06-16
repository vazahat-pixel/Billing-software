const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');

class InventoryService {
  async getInventory(companyId, filters = {}) {
    const query = { companyId, ...filters };
    return await InventoryLot.find(query)
      .populate('itemId', 'name category fabricType')
      .sort({ createdAt: -1 });
  }

  async getLotDetails(lotId, companyId) {
    const lot = await InventoryLot.findOne({ lotId, companyId }).populate('itemId');
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

  async createOpeningStock({ companyId, itemId, pcs = 0, mts, remarks = 'Opening stock entry' }) {
    if (!itemId || !mts || mts <= 0) {
      throw new Error('Item and quantity (mts) are required for opening stock.');
    }

    const timestamp = Date.now();
    const lotCode = `OPN-${timestamp}`;

    const lot = new InventoryLot({
      lotId: lotCode,
      itemId,
      purchaseId: null,
      source: 'opening',
      totalPcs: pcs,
      remainingPcs: pcs,
      totalMtrs: mts,
      remainingMtrs: mts,
      companyId
    });
    await lot.save();

    const movement = new StockMovement({
      lotId: lot._id,
      type: 'OPENING',
      qtyPcs: pcs,
      qtyMtrs: mts,
      balanceMtrs: mts,
      referenceId: lot._id,
      remarks,
      companyId
    });
    await movement.save();

    return lot;
  }
}

module.exports = new InventoryService();
