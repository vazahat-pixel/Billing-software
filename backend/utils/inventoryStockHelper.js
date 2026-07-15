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

module.exports = {
  availableMtrs,
  availablePcs,
  assertLotIssuable,
  applyLotMovement,
  loadLotForUpdate,
};
