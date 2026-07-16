const Purchase = require('../../models/Purchase');
const Sales = require('../../models/Sales');
const InventoryLot = require('../../models/InventoryLot');
const BillSettlement = require('../../models/BillSettlement');
const purchaseService = require('../../services/purchaseService');
const salesService = require('../../services/salesService');
const gstReturnService = require('../../services/gstReturnService');

async function verifyReports(companyId) {
  const issues = [];
  const tolerance = 0.01;

  const purchaseAgg = await Purchase.aggregate([
    { $match: { companyId, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
  ]);
  const salesAgg = await Sales.aggregate([
    { $match: { companyId, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
  ]);

  const purchaseRegister = await purchaseService.getPurchases(companyId, { limit: 1 });
  const salesRegister = await salesService.getSales(companyId, { limit: 1 });

  if (purchaseAgg[0]?.count !== purchaseRegister.total) {
    issues.push(`Purchase register count mismatch: agg ${purchaseAgg[0]?.count} vs service ${purchaseRegister.total}`);
  }
  if (salesAgg[0]?.count !== salesRegister.total) {
    issues.push(`Sales register count mismatch: agg ${salesAgg[0]?.count} vs service ${salesRegister.total}`);
  }

  const lotStock = await InventoryLot.aggregate([
    { $match: { companyId } },
    { $group: { _id: null, mtrs: { $sum: '$remainingMtrs' } } },
  ]);
  const inventoryMtrs = lotStock[0]?.mtrs || 0;
  if (inventoryMtrs < 0) issues.push(`Inventory report negative total mtrs: ${inventoryMtrs}`);

  const outstanding = await BillSettlement.aggregate([
    { $match: { companyId } },
    {
      $group: {
        _id: '$billType',
        open: { $sum: { $subtract: ['$billAmount', '$settledAmount'] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let gstBuilt = null;
  try {
    gstBuilt = await gstReturnService.buildGstr3b(companyId, period);
    if (!gstBuilt) issues.push('GSTR-3B builder returned empty');
  } catch (err) {
    issues.push(`GST report build: ${err.message}`);
  }

  const passed = issues.length === 0;
  const score = passed ? 100 : Math.max(0, 100 - issues.length * 10);

  return {
    label: 'Reports',
    passed,
    score,
    purchaseTotal: purchaseAgg[0]?.total || 0,
    salesTotal: salesAgg[0]?.total || 0,
    inventoryMtrs,
    outstanding,
    gstBuilt: !!gstBuilt,
    issues,
    tolerance,
  };
}

module.exports = { verifyReports };
