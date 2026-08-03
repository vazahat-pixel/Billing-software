const mongoose = require('mongoose');
const CuttingEntry = require('../models/CuttingEntry');
const BeamEntry = require('../models/BeamEntry');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const Counter = require('../models/Counter');

async function nextEntryNo(companyId, prefix) {
  const fy = new Date().getFullYear();
  const seq = await Counter.nextSeq(`${prefix}-${fy}-${companyId}`);
  return `${prefix}-${fy}-${String(seq).padStart(4, '0')}`;
}

class CuttingBeamService {
  /** Cutting reduces the source lot's remaining qty — kept consistent via a real StockMovement + transaction. */
  async createCuttingEntry(companyId, payload, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const lot = await InventoryLot.findOne({ _id: payload.lotId, companyId }).session(session);
      if (!lot) throw new Error('Lot not found');

      const cutQty = Number(payload.cutQty || 0);
      const wastageQty = Number(payload.wastageQty || 0);
      const totalDeduct = cutQty + wastageQty;
      if (totalDeduct <= 0) throw new Error('Cut Qty must be greater than zero');
      if (totalDeduct > Number(lot.remainingMtrs || 0) + 0.001) {
        throw new Error(`Cut+Wastage (${totalDeduct}) exceeds lot balance (${lot.remainingMtrs})`);
      }

      lot.remainingMtrs = Number((lot.remainingMtrs - totalDeduct).toFixed(3));
      if (lot.remainingMtrs <= 0.001) lot.status = 'Closed';
      await lot.save({ session });

      const entryNo = await nextEntryNo(companyId, 'CUT');
      const [entry] = await CuttingEntry.create([{
        companyId,
        entryNo,
        date: payload.date || new Date(),
        lotId: lot._id,
        lotCode: lot.lotId,
        itemId: lot.itemId,
        originalQty: lot.totalMtrs,
        cutPieces: Number(payload.cutPieces || 0),
        cutQty,
        wastageQty,
        remark: payload.remark || '',
        createdBy: userId,
      }], { session });

      await StockMovement.create([{
        lotId: lot._id,
        companyId,
        type: 'ADJUSTMENT',
        qtyMtrs: -totalDeduct,
        qtyPcs: -(Number(payload.cutPieces || 0)),
        balanceMtrs: lot.remainingMtrs,
        referenceId: entry._id,
        remarks: `Cutting Entry #${entryNo}${wastageQty ? ` (incl. ${wastageQty}m wastage)` : ''}`,
      }], { session });

      await session.commitTransaction();
      return entry;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async listCuttingEntries(companyId, query = {}) {
    const filter = { companyId };
    if (query.lotId) filter.lotId = query.lotId;
    return CuttingEntry.find(filter).populate('itemId', 'name').sort({ date: -1 }).lean();
  }

  /** Beam Entry — pre-weaving record only; no linked stock lot exists for yarn in this system yet. */
  async createBeamEntry(companyId, payload, userId) {
    const beamNo = payload.beamNo || await nextEntryNo(companyId, 'BEAM');
    return BeamEntry.create({
      companyId,
      beamNo,
      date: payload.date || new Date(),
      itemId: payload.itemId || undefined,
      yarnDetails: payload.yarnDetails || '',
      quantityKg: Number(payload.quantityKg || 0),
      totalEnds: Number(payload.totalEnds || 0),
      lengthMtrs: Number(payload.lengthMtrs || 0),
      partyId: payload.partyId || undefined,
      loomNo: payload.loomNo || '',
      status: payload.status || 'Prepared',
      remark: payload.remark || '',
      createdBy: userId,
    });
  }

  async listBeamEntries(companyId, query = {}) {
    const filter = { companyId };
    if (query.status) filter.status = query.status;
    return BeamEntry.find(filter).populate('itemId', 'name').populate('partyId', 'name').sort({ date: -1 }).lean();
  }
}

module.exports = new CuttingBeamService();
