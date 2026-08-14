const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const AppError = require('./AppError');

/** Physical remaining minus active reservations */
function availableMtrs(lot) {
  return Number(lot.remainingMtrs || 0) - Number(lot.reservedMtrs || 0);
}

function availablePcs(lot) {
  return Number(lot.remainingPcs || 0) - Number(lot.reservedPcs || 0);
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
 * Negative stock is allowed on sales & issue movements.
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

  // Track meters when the lot was created with meters, still has meter balance,
  // OR when the movement being applied is explicitly a meter-based delta.
  // This ensures a closed lot (totalMtrs=0, remainingMtrs=0) still goes
  // to 'Negative Stock' when further meter sales are applied to it.
  const tracksMtrs =
    Number(lot.totalMtrs || 0) > 0 ||
    (lot.remainingMtrs !== 0) ||
    (deltaMts !== 0 && deltaPcs === 0);

  const newRemainingMtrs = Number((lot.remainingMtrs + deltaMts).toFixed(4));
  const newRemainingPcs = Number(((lot.remainingPcs || 0) + deltaPcs).toFixed(4));

  lot.remainingMtrs = newRemainingMtrs;
  lot.remainingPcs = newRemainingPcs;

  const remainingForStatus = tracksMtrs ? lot.remainingMtrs : lot.remainingPcs;
  const totalForStatus = tracksMtrs ? lot.totalMtrs : lot.totalPcs;

  if (remainingForStatus < 0) lot.status = 'Negative Stock';
  else if (remainingForStatus === 0) lot.status = 'Closed';
  else if (totalForStatus > 0 && remainingForStatus < totalForStatus) lot.status = 'Partially Used';
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
 * Starts at 0 balance so sales push it into exact negative values.
 */
async function createOpeningLotForSale(session, companyId, itemId, needMts = 0, needPcs = 0) {
  const lotId = `OPEN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const [lot] = await InventoryLot.create(
    [
      {
        companyId,
        itemId,
        lotId,
        source: 'opening',
        totalMtrs: 0,
        remainingMtrs: 0,
        totalPcs: 0,
        remainingPcs: 0,
        status: 'Available',
        holdStatus: 'None',
        reservedMtrs: 0,
        reservedPcs: 0,
      },
    ],
    { session }
  );

  return lot;
}

/**
 * FIFO pick an open lot for a sales line when UI does not send lotId.
 * Picks existing lot for the item (even if in negative balance) or creates one
 * so sales continue and negative stock accumulates properly.
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
    $or: [{ holdStatus: { $exists: false } }, { holdStatus: 'None' }, { holdStatus: null }],
  })
    .sort({ createdAt: 1 })
    .session(session);

  const candidates = lots.filter((lot) => {
    try {
      assertLotIssuable(lot);
      return true;
    } catch {
      return false;
    }
  });

  if (!candidates.length) {
    return createOpeningLotForSale(session, companyId, itemId, qtyMts, qtyPcs);
  }

  // 1. Prefer an existing lot with positive stock
  let best = candidates.find((lot) => (qtyMts > 0 ? (lot.remainingMtrs || 0) > 0 : (lot.remainingPcs || 0) > 0));

  // 2. Otherwise pick the first existing lot for this item so negative stock accumulates on it!
  if (!best) {
    best = candidates[0];
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
