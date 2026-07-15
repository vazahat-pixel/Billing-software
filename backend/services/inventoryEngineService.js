const mongoose = require('mongoose');
const Counter = require('../models/Counter');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const StockReservation = require('../models/StockReservation');
const StockTransfer = require('../models/StockTransfer');
const StockAdjustment = require('../models/StockAdjustment');
const Item = require('../models/Item');
const Warehouse = require('../models/Warehouse');
const AppError = require('../utils/AppError');
const { assertRefs } = require('../utils/refIntegrity');
const {
  availableMtrs,
  availablePcs,
  applyLotMovement,
  loadLotForUpdate,
} = require('../utils/inventoryStockHelper');
const auditService = require('./auditService');
const eventBus = require('../events/eventBus');

async function nextNo(companyId, prefix, session = null) {
  const fy = `${new Date().getFullYear().toString().slice(2)}`;
  const seq = await Counter.nextSeq(`${prefix}-${fy}-${companyId}`, session);
  return `${prefix}-${fy}-${String(seq).padStart(4, '0')}`;
}

class InventoryEngineService {
  /** Pipeline counts for dashboard / modal header */
  async pipeline(companyId) {
    const [lots, reservations, transfers, lowStock] = await Promise.all([
      InventoryLot.countDocuments({ companyId, remainingMtrs: { $gt: 0 }, holdStatus: 'None' }),
      StockReservation.countDocuments({ companyId, status: 'Active' }),
      StockTransfer.countDocuments({ companyId, status: 'Completed' }),
      this.lowStockAlerts(companyId),
    ]);
    return {
      activeLots: lots,
      activeReservations: reservations,
      transfersCompleted: transfers,
      lowStockCount: lowStock.length,
    };
  }

  /** Availability by item or lot — physical minus reservations */
  async getAvailability(companyId, { itemId, lotId, warehouseId } = {}) {
    const filter = { companyId, remainingMtrs: { $gt: 0 }, holdStatus: { $in: ['None', null] } };
    if (itemId) filter.itemId = itemId;
    if (lotId) filter._id = lotId;
    if (warehouseId) filter.warehouseId = warehouseId;

    const lots = await InventoryLot.find(filter)
      .populate('itemId', 'name unit reorderLevel')
      .populate('warehouseId', 'name code')
      .lean();

    const rows = lots.map((lot) => ({
      lotId: lot._id,
      lotCode: lot.lotId,
      itemId: lot.itemId?._id || lot.itemId,
      itemName: lot.itemId?.name,
      warehouseId: lot.warehouseId?._id || lot.warehouseId,
      warehouseName: lot.warehouseId?.name,
      physicalMtrs: lot.remainingMtrs,
      reservedMtrs: lot.reservedMtrs || 0,
      availableMtrs: availableMtrs(lot),
      physicalPcs: lot.remainingPcs || 0,
      reservedPcs: lot.reservedPcs || 0,
      availablePcs: availablePcs(lot),
      holdStatus: lot.holdStatus || 'None',
      rate: lot.rate || 0,
    }));

    const totals = rows.reduce(
      (acc, r) => ({
        physicalMtrs: acc.physicalMtrs + r.physicalMtrs,
        reservedMtrs: acc.reservedMtrs + r.reservedMtrs,
        availableMtrs: acc.availableMtrs + r.availableMtrs,
      }),
      { physicalMtrs: 0, reservedMtrs: 0, availableMtrs: 0 }
    );

    return { rows, totals };
  }

  async stockLedger(companyId, { itemId, lotId, limit = 200 } = {}) {
    const filter = { companyId };
    if (lotId) filter.lotId = lotId;
    else if (itemId) {
      const lots = await InventoryLot.find({ companyId, itemId }).select('_id').lean();
      filter.lotId = { $in: lots.map((l) => l._id) };
    }

    const movements = await StockMovement.find(filter)
      .populate({ path: 'lotId', select: 'lotId itemId', populate: { path: 'itemId', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 200, 500))
      .lean();

    return movements;
  }

  async lotLedger(companyId, lotOid) {
    const lot = await InventoryLot.findOne({ _id: lotOid, companyId })
      .populate('itemId', 'name')
      .populate('warehouseId', 'name code');
    if (!lot) throw AppError.notFound('Lot not found');

    const movements = await StockMovement.find({ companyId, lotId: lot._id }).sort({ createdAt: 1 }).lean();
    const reservations = await StockReservation.find({ companyId, lotId: lot._id }).sort({ createdAt: -1 }).lean();

    return {
      lot,
      movements,
      reservations,
      availableMtrs: availableMtrs(lot),
      availablePcs: availablePcs(lot),
    };
  }

  /** Weighted average valuation for an item */
  async getValuation(companyId, itemId) {
    const lots = await InventoryLot.find({
      companyId,
      itemId,
      remainingMtrs: { $gt: 0 },
    }).lean();

    let totalMtrs = 0;
    let totalValue = 0;
    for (const lot of lots) {
      const m = lot.remainingMtrs || 0;
      totalMtrs += m;
      totalValue += m * (lot.rate || 0);
    }

    return {
      itemId,
      lotCount: lots.length,
      totalMtrs,
      totalValue,
      weightedAvgRate: totalMtrs > 0 ? Number((totalValue / totalMtrs).toFixed(4)) : 0,
    };
  }

  async lowStockAlerts(companyId) {
    const items = await Item.find({
      companyId,
      reorderLevel: { $gt: 0 },
    }).select('name reorderLevel unit').lean();

    const alerts = [];
    for (const item of items) {
      const threshold = item.reorderLevel || 0;
      if (threshold <= 0) continue;
      const { totals } = await this.getAvailability(companyId, { itemId: item._id });
      if (totals.availableMtrs < threshold) {
        alerts.push({
          itemId: item._id,
          itemName: item.name,
          threshold,
          availableMtrs: totals.availableMtrs,
          unit: item.unit,
        });
      }
    }
    return alerts;
  }

  // ─── Reservation ───────────────────────────────────────────
  async listReservations(companyId, { status = 'Active' } = {}) {
    const filter = { companyId };
    if (status) filter.status = status;
    return StockReservation.find(filter)
      .populate('lotId', 'lotId')
      .populate('itemId', 'name')
      .sort({ createdAt: -1 });
  }

  async reserveStock(companyId, data, userId) {
    const { lotId, reservedMts, reservedPcs = 0, referenceType = 'Manual', referenceId, remarks = '' } = data;
    if (!lotId || !reservedMts || reservedMts <= 0) {
      throw AppError.badRequest('lotId and reservedMts required');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const lot = await loadLotForUpdate(session, lotId, companyId);
      if (availableMtrs(lot) < reservedMts) {
        throw AppError.badRequest(
          `Cannot reserve ${reservedMts} mtrs — only ${availableMtrs(lot)} available on lot ${lot.lotId}`
        );
      }

      const reservationNo = data.reservationNo || (await nextNo(companyId, 'RSV', session));
      const [reservation] = await StockReservation.create(
        [
          {
            companyId,
            reservationNo,
            lotId: lot._id,
            itemId: lot.itemId,
            reservedMts: Number(reservedMts),
            reservedPcs: Number(reservedPcs || 0),
            referenceType,
            referenceId: referenceId || null,
            status: 'Active',
            remarks,
          },
        ],
        { session }
      );

      lot.reservedMtrs = Number(((lot.reservedMtrs || 0) + reservedMts).toFixed(4));
      lot.reservedPcs = (lot.reservedPcs || 0) + Number(reservedPcs || 0);
      await lot.save({ session });

      await session.commitTransaction();
      try {
        eventBus.emitSafe('inventory.reserved', { companyId, reservationId: reservation._id, lotId: lot._id });
      } catch {
        /* optional */
      }
      return reservation;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async releaseReservation(companyId, reservationId, { consume = false, consumeMts = null } = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const reservation = await StockReservation.findOne({
        _id: reservationId,
        companyId,
        status: 'Active',
      }).session(session);
      if (!reservation) throw AppError.notFound('Active reservation not found');

      const lot = await loadLotForUpdate(session, reservation.lotId, companyId);
      const releaseMts = consume && consumeMts != null ? Math.min(consumeMts, reservation.reservedMts) : reservation.reservedMts;
      const releasePcs = reservation.reservedPcs;

      lot.reservedMtrs = Math.max(0, Number(((lot.reservedMtrs || 0) - releaseMts).toFixed(4)));
      lot.reservedPcs = Math.max(0, (lot.reservedPcs || 0) - releasePcs);

      if (consume && releaseMts > 0) {
        await applyLotMovement({
          session,
          lot,
          companyId,
          deltaMts: -releaseMts,
          deltaPcs: -releasePcs,
          type: 'SALE',
          referenceId: reservation.referenceId || reservation._id,
          idempotencyKey: `RSV-CONSUME:${reservation._id}`,
          remarks: `Reservation consumed ${reservation.reservationNo}`,
        });
      } else {
        await lot.save({ session });
      }

      reservation.status = consume ? 'Consumed' : 'Released';
      if (consume && releaseMts < reservation.reservedMts) {
        reservation.reservedMts = Number((reservation.reservedMts - releaseMts).toFixed(4));
        reservation.reservedPcs = Math.max(0, reservation.reservedPcs - releasePcs);
        reservation.status = 'Active';
      }
      await reservation.save({ session });

      await session.commitTransaction();
      return reservation;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ─── Transfer ──────────────────────────────────────────────
  async listTransfers(companyId) {
    return StockTransfer.find({ companyId })
      .populate('fromLotId', 'lotId')
      .populate('toLotId', 'lotId')
      .populate('toWarehouseId', 'name code')
      .sort({ createdAt: -1 });
  }

  async transferStock(companyId, data) {
    const { fromLotId, toWarehouseId, qtyMts, qtyPcs = 0, remarks = '' } = data;
    if (!fromLotId || !toWarehouseId || !qtyMts || qtyMts <= 0) {
      throw AppError.badRequest('fromLotId, toWarehouseId, qtyMts required');
    }

    await assertRefs(companyId, [{ Model: Warehouse, id: toWarehouseId, label: 'Warehouse' }]);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const sourceLot = await loadLotForUpdate(session, fromLotId, companyId);
      const fromWarehouseId = sourceLot.warehouseId;
      if (availableMtrs(sourceLot) < qtyMts) {
        throw AppError.badRequest(`Insufficient available qty on lot ${sourceLot.lotId}`);
      }

      const transferNo = data.transferNo || (await nextNo(companyId, 'TRF', session));
      let destLot = sourceLot;

      if (Math.abs(qtyMts - sourceLot.remainingMtrs) < 0.0001) {
        // Full lot move — reassign warehouse
        sourceLot.warehouseId = toWarehouseId;
        await sourceLot.save({ session });
        await StockMovement.create(
          [
            {
              lotId: sourceLot._id,
              type: 'TRANSFER_IN',
              qtyPcs: 0,
              qtyMtrs: qtyMts,
              balanceMtrs: sourceLot.remainingMtrs,
              referenceId: sourceLot._id,
              idempotencyKey: `TRF-FULL:${transferNo}:${sourceLot._id}`,
              remarks: remarks || `Transfer ${transferNo} (full lot)`,
              companyId,
            },
          ],
          { session }
        );
      } else {
        // Partial — split lot
        await applyLotMovement({
          session,
          lot: sourceLot,
          companyId,
          deltaMts: -qtyMts,
          deltaPcs: -(qtyPcs || 0),
          type: 'TRANSFER_OUT',
          referenceId: sourceLot._id,
          idempotencyKey: `TRF-OUT:${transferNo}:${sourceLot._id}`,
          remarks: remarks || `Transfer out ${transferNo}`,
        });

        const [newLot] = await InventoryLot.create(
          [
            {
              lotId: `${sourceLot.lotId}-T${Date.now().toString().slice(-6)}`,
              itemId: sourceLot.itemId,
              purchaseId: sourceLot.purchaseId,
              source: sourceLot.source || 'transfer',
              totalPcs: qtyPcs || 0,
              remainingPcs: qtyPcs || 0,
              totalMtrs: qtyMts,
              remainingMtrs: qtyMts,
              warehouseId: toWarehouseId,
              rate: sourceLot.rate || 0,
              companyId,
            },
          ],
          { session }
        );
        destLot = newLot;

        await StockMovement.create(
          [
            {
              lotId: newLot._id,
              type: 'TRANSFER_IN',
              qtyPcs: qtyPcs || 0,
              qtyMtrs: qtyMts,
              balanceMtrs: qtyMts,
              referenceId: sourceLot._id,
              idempotencyKey: `TRF-IN:${transferNo}:${newLot._id}`,
              remarks: remarks || `Transfer in ${transferNo}`,
              companyId,
            },
          ],
          { session }
        );
      }

      const transfer = await StockTransfer.create(
        [
          {
            companyId,
            transferNo,
            fromLotId: sourceLot._id,
            toLotId: destLot._id,
            fromWarehouseId,
            toWarehouseId,
            itemId: sourceLot.itemId,
            qtyMts,
            qtyPcs: qtyPcs || 0,
            status: 'Completed',
            remarks,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return { transfer: transfer[0], destLot };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ─── Adjustment / cycle count ──────────────────────────────
  async createAdjustment(companyId, data, userId) {
    const lines = (data.lines || []).map((l) => ({
      lotId: l.lotId,
      itemId: l.itemId,
      systemMts: Number(l.systemMts || 0),
      physicalMts: Number(l.physicalMts || 0),
      varianceMts: Number((Number(l.physicalMts || 0) - Number(l.systemMts || 0)).toFixed(4)),
      remarks: l.remarks || '',
    }));
    if (!lines.length) throw AppError.badRequest('Adjustment lines required');

    const adjustNo = data.adjustNo || (await nextNo(companyId, 'ADJ'));
    return StockAdjustment.create({
      companyId,
      adjustNo,
      warehouseId: data.warehouseId || null,
      reason: data.reason || 'Physical verification',
      lines,
      status: 'Draft',
    });
  }

  async postAdjustment(companyId, adjustId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const adj = await StockAdjustment.findOne({ _id: adjustId, companyId, status: 'Draft' }).session(session);
      if (!adj) throw AppError.notFound('Draft adjustment not found');

      for (const line of adj.lines) {
        if (Math.abs(line.varianceMts) < 0.0001) continue;
        const lot = await loadLotForUpdate(session, line.lotId, companyId);
        await applyLotMovement({
          session,
          lot,
          companyId,
          deltaMts: line.varianceMts,
          deltaPcs: 0,
          type: 'ADJUSTMENT',
          referenceId: adj._id,
          idempotencyKey: `ADJ:${adj._id}:${lot._id}`,
          remarks: adj.reason || `Adjustment ${adj.adjustNo}`,
        });
      }

      adj.status = 'Posted';
      adj.postedAt = new Date();
      await adj.save({ session });

      await session.commitTransaction();
      return adj;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async listAdjustments(companyId) {
    return StockAdjustment.find({ companyId }).sort({ createdAt: -1 });
  }

  // ─── Hold status (Blocked / Damaged / InTransit) ───────────
  async setLotHold(companyId, lotId, holdStatus, remarks = '') {
    const allowed = ['None', 'Blocked', 'Damaged', 'InTransit'];
    if (!allowed.includes(holdStatus)) throw AppError.badRequest('Invalid holdStatus');

    const lot = await InventoryLot.findOneAndUpdate(
      { _id: lotId, companyId },
      { holdStatus },
      { new: true }
    );
    if (!lot) throw AppError.notFound('Lot not found');

    await auditService.logSystem({
      companyId,
      action: 'inventory.hold',
      module: 'inventory',
      referenceId: lot._id,
      after: { holdStatus, remarks },
    });

    return lot;
  }
}

module.exports = new InventoryEngineService();
