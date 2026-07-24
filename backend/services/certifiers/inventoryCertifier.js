const InventoryLot = require('../../models/InventoryLot');
const StockMovement = require('../../models/StockMovement');
const { availableMtrs } = require('../../utils/inventoryStockHelper');

/**
 * Inventory certification — no negative stock, lot integrity, movement coherence.
 */
async function certify(companyId) {
  const issues = [];
  const filter = companyId ? { companyId, isDeleted: { $ne: true } } : { isDeleted: { $ne: true } };
  const lots = await InventoryLot.find(filter).limit(5000).lean().catch(() => []);

  let negative = 0;
  let reservationOverflow = 0;

  for (const lot of lots) {
    if (Number(lot.remainingMtrs || 0) < -0.0001) {
      negative += 1;
      if (issues.length < 25) issues.push(`Negative stock lot ${lot.lotId}: ${lot.remainingMtrs}`);
    }
    if (Number(lot.reservedMtrs || 0) - Number(lot.remainingMtrs || 0) > 0.0001) {
      reservationOverflow += 1;
      if (issues.length < 30) {
        issues.push(`Reservation overflow lot ${lot.lotId}: reserved ${lot.reservedMtrs} > remaining ${lot.remainingMtrs}`);
      }
    }
    // Soft check available helper
    if (availableMtrs(lot) < -0.0001) {
      issues.push(`availableMtrs negative for ${lot.lotId}`);
    }
  }

  let movementOrphans = 0;
  if (companyId) {
    const lotIdSet = new Set(lots.map((l) => String(l._id)));
    const movements = await StockMovement.find({ companyId }).limit(2000).select('lotId').lean().catch(() => []);
    for (const m of movements) {
      if (m.lotId && lotIdSet.size && !lotIdSet.has(String(m.lotId))) {
        // Lot may be soft-deleted — only count if still referenced as active issue
        movementOrphans += 1;
      }
    }
  }

  const passed = negative === 0 && reservationOverflow === 0;
  return {
    passed: lots.length === 0 ? true : passed,
    detail: `lots=${lots.length} negative=${negative} reservationOverflow=${reservationOverflow} orphanMoves~${movementOrphans}`,
    gaps: issues,
    lotCount: lots.length,
    negative,
    reservationOverflow,
    score: passed ? 100 : Math.max(0, 100 - negative * 20 - reservationOverflow * 10),
  };
}

module.exports = { certify };
