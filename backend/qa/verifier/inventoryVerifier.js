const InventoryLot = require('../../models/InventoryLot');
const StockMovement = require('../../models/StockMovement');
const reconciliationService = require('../../services/reconciliationService');

const TOLERANCE = 0.01;

async function verifyInventory(companyId) {
  const mismatches = [];
  const lots = await InventoryLot.find({ companyId }).lean();

  for (const lot of lots) {
    const movements = await StockMovement.find({ companyId, lotId: lot._id }).lean();
    const netFromMovements = movements.reduce((s, m) => s + (m.qtyMtrs || 0), 0);
    const expected = netFromMovements;
    const actual = lot.remainingMtrs || 0;

    if (Math.abs(expected - actual) > TOLERANCE && movements.length > 0) {
      mismatches.push({
        lotId: lot.lotId,
        lotOid: lot._id,
        itemId: lot.itemId,
        expected,
        actual,
        movementCount: movements.length,
      });
    }
    if (actual < -TOLERANCE) {
      mismatches.push({
        lotId: lot.lotId,
        lotOid: lot._id,
        itemId: lot.itemId,
        expected: '>= 0',
        actual,
        movementCount: movements.length,
        code: 'NEG_STOCK',
      });
    }
  }

  const reconcileRun = await reconciliationService.runFull(companyId);
  const reconcileErrors = (reconcileRun.findings || []).filter((f) => f.severity === 'error');

  const passed = mismatches.length === 0 && reconcileRun.status !== 'failures';
  const score = passed ? 100 : Math.max(0, 100 - mismatches.length * 2 - reconcileErrors.length * 3);

  return {
    label: 'Inventory Integrity',
    passed,
    score,
    mismatches,
    reconcileStatus: reconcileRun.status,
    reconcileRunId: reconcileRun._id,
    issues: [
      ...mismatches.slice(0, 10).map((m) => `Lot ${m.lotId}: expected ${m.expected}, actual ${m.actual}`),
      ...reconcileErrors.slice(0, 10).map((f) => f.message),
    ],
  };
}

module.exports = { verifyInventory };
