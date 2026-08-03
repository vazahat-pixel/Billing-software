const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const AppError = require('./AppError');

/** Physical remaining minus active reservations */
function availableMtrs(lot) {
  return Math.max(0, Number(lot.remainingMtrs || 0) - Number(lot.reservedMtrs || 0));
}

function availablePcs(lot) {
  return Math.max(0, Number(lot.remainingPcs || 0) - Number(lot.reservedPcs || 0));
}

function assertLotIssuable(lot) {
  if (!lot) throw AppError.badRequest('Lot not found');
  if (lot.isDeleted) throw AppError.badRequest('Lot is deleted');
  if (lot.holdStatus && lot.holdStatus !== 'None') {
    throw AppError.badRequest(`Lot ${lot.lotId} is ${lot.holdStatus} and cannot be issued`);
  }
}

/**
 * Apply quantity delta to lot and append immutable StockMovement.
 * Negative delta = issue; positive = receipt/adjustment in.
 */
async function applyLotMovement({
  session,
  lot,
  companyId,
  deltaMts,
  deltaPcs = 0,
  type,
  referenceId,
  idempotencyKey,
  remarks = '',
}) {
  assertLotIssuable(lot);

  const newRemainingMtrs = Number((lot.remainingMtrs + deltaMts).toFixed(4));
  const newRemainingPcs = Math.max(0, (lot.remainingPcs || 0) + deltaPcs);

  if (newRemainingMtrs < -0.0001) {
    throw AppError.badRequest(
      `Negative stock blocked on lot ${lot.lotId}. Available ${availableMtrs(lot)} mtrs, requested ${Math.abs(deltaMts)}`
    );
  }

  // When issuing, also respect reservations
  if (deltaMts < 0) {
    const need = Math.abs(deltaMts);
    if (need - availableMtrs(lot) > 0.0001) {
      throw AppError.badRequest(
        `Insufficient available stock on lot ${lot.lotId}. Available ${availableMtrs(lot)} mtrs (after reservations)`
      );
    }
  }

  lot.remainingMtrs = Math.max(0, newRemainingMtrs);
  lot.remainingPcs = newRemainingPcs;
  if (lot.remainingMtrs <= 0) lot.status = 'Closed';
  else if (lot.remainingMtrs < lot.totalMtrs) lot.status = 'Partially Used';
  else lot.status = 'Available';

  const version = lot.version || 1;
  const updated = await InventoryLot.findOneAndUpdate(
    { _id: lot._id, companyId, version, isDeleted: { $ne: true } },
    {
      $set: {
        remainingMtrs: lot.remainingMtrs,
        remainingPcs: lot.remainingPcs,
        status: lot.status,
      },
      $inc: { version: 1 },
    },
    { session, new: true }
  );
  if (!updated) {
    throw AppError.badRequest('Concurrent stock update detected — please retry');
  }

  await StockMovement.create(
    [
      {
        lotId: updated._id,
        type,
        qtyPcs: deltaPcs,
        qtyMtrs: deltaMts,
        balanceMtrs: updated.remainingMtrs,
        referenceId,
        idempotencyKey: idempotencyKey || null,
        remarks,
        companyId,
      },
    ],
    { session }
  );

  return updated;
}

async function loadLotForUpdate(session, lotOid, companyId) {
  const lot = await InventoryLot.findOne({ _id: lotOid, companyId }).session(session);
  if (!lot) throw AppError.notFound('Lot not found');
  return lot;
}

/**
 * Create an opening lot so sales can post when purchase stock was never entered.
 * Qty matches the bill line; after SALE movement remaining becomes 0.
 */
async function createOpeningLotForSale(session, companyId, itemId, needMts = 0, needPcs = 0) {
  const mts = Math.max(Number(needMts) || 0, 0);
  const pcs = Math.max(Number(needPcs) || 0, 0);
  // Ensure lot has something to deduct (applyLotMovement blocks negative)
  const totalMtrs = mts > 0 ? mts : pcs > 0 ? 0 : 0.001;
  const totalPcs = pcs;
  const lotId = `OPEN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const [lot] = await InventoryLot.create(
    [
      {
        companyId,
        itemId,
        lotId,
        source: 'opening',
        totalMtrs,
        remainingMtrs: totalMtrs,
        totalPcs,
        remainingPcs: totalPcs,
        status: 'Available',
        holdStatus: 'None',
        reservedMtrs: 0,
        reservedPcs: 0,
      },
    ],
    { session }
  );

  // Lot qty is already on hand — SALE movement will post when invoice deducts.
  // Do not create StockMovement here: referenceId is required and sale id is not known yet.

  return lot;
}

/**
 * FIFO pick an open lot for a sales line when UI does not send lotId.
 * If no purchase stock exists (or not enough), auto-creates an opening lot
 * so the sales bill can still be saved.
 */
async function pickLotForSale(session, companyId, itemId, needMts = 0, needPcs = 0) {
  if (!itemId) {
    throw AppError.badRequest('Item is required to allocate stock');
  }
  const qtyMts = Number(needMts || 0);
  const qtyPcs = Number(needPcs || 0);
  const lots = await InventoryLot.find({
    companyId,
    itemId,
    isDeleted: { $ne: true },
    status: { $nin: ['Closed', 'Exhausted'] },
    $or: [{ holdStatus: { $exists: false } }, { holdStatus: 'None' }, { holdStatus: null }],
  })
    .sort({ createdAt: 1 })
    .session(session);

  const candidates = lots.filter((lot) => {
    try {
      assertLotIssuable(lot);
    } catch {
      return false;
    }
    return availableMtrs(lot) > 0.0001 || availablePcs(lot) > 0;
  });

  if (!candidates.length) {
    return createOpeningLotForSale(session, companyId, itemId, qtyMts, qtyPcs);
  }

  let best =
    candidates.find(
      (lot) =>
        availableMtrs(lot) + 0.0001 >= qtyMts && availablePcs(lot) >= qtyPcs
    ) || null;

  if (!best && qtyMts > 0) {
    best = candidates.find((lot) => availableMtrs(lot) + 0.0001 >= qtyMts) || null;
  }
  if (!best) {
    best = candidates[0];
  }

  if (qtyMts > 0 && availableMtrs(best) + 0.0001 < qtyMts) {
    // Not enough on existing lots — open stock for this bill line
    return createOpeningLotForSale(session, companyId, itemId, qtyMts, qtyPcs);
  }

  return best;
}

/**
 * @param {{ revision?: string|number, remarks?: string }} [options] — `revision` (e.g. the
 *   invoice's pre-update `updatedAt` timestamp) keeps the idempotency key unique per edit
 *   cycle while still deduping retries of the *same* reversal attempt.
 */
async function reverseSaleStock(session, sale, companyId, options = {}) {
  if (sale.stockFromChallan) return;
  const { revision, remarks } = options;
  const keySuffix = revision != null ? `:${revision}` : '';
  for (const item of sale.items || []) {
    if (!item.lotId) continue;
    const key = `SALE_CANCEL:${sale._id}:${item.lotId}${keySuffix}`;
    const exists = await StockMovement.findOne({ companyId, idempotencyKey: key }).session(session);
    if (exists) continue;
    const lot = await loadLotForUpdate(session, item.lotId, companyId);
    await applyLotMovement({
      session,
      lot,
      companyId,
      deltaMts: item.mts || 0,
      deltaPcs: item.pcs || 0,
      type: 'SALE_CANCEL',
      referenceId: sale._id,
      idempotencyKey: key,
      remarks: remarks || `Cancel Sales Inv: ${sale.invoiceNo}`,
    });
  }
}

async function reversePurchaseStock(session, purchase, companyId) {
  const lots = await InventoryLot.find({
    purchaseId: purchase._id,
    companyId,
    isDeleted: { $ne: true },
  }).session(session);

  for (const lot of lots) {
    const used = (lot.totalMtrs || 0) - (lot.remainingMtrs || 0);
    if (used > 0.0001) {
      throw new Error(
        `Cannot cancel purchase: lot ${lot.lotId} already used (${used.toFixed(2)} mtrs issued)`
      );
    }
    const key = `PURCHASE_CANCEL:${purchase._id}:${lot._id}`;
    const exists = await StockMovement.findOne({ companyId, idempotencyKey: key }).session(session);
    if (exists) continue;
    if ((lot.remainingMtrs || 0) > 0 || (lot.remainingPcs || 0) > 0) {
      await applyLotMovement({
        session,
        lot,
        companyId,
        deltaMts: -(lot.remainingMtrs || 0),
        deltaPcs: -(lot.remainingPcs || 0),
        type: 'PURCHASE_CANCEL',
        referenceId: purchase._id,
        idempotencyKey: key,
        remarks: `Cancel Purchase: ${purchase.invoiceNo}`,
      });
    }
    lot.isDeleted = true;
    lot.status = 'Closed';
    await lot.save({ session });
  }
}

module.exports = {
  availableMtrs,
  availablePcs,
  assertLotIssuable,
  applyLotMovement,
  loadLotForUpdate,
  pickLotForSale,
  createOpeningLotForSale,
  reverseSaleStock,
  reversePurchaseStock,
};
