const mongoose = require('mongoose');
const CostCenter = require('../models/CostCenter');
const AccountingEntry = require('../models/AccountingEntry');
const Job = require('../models/Job');
const auditService = require('./auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const TEXTILE_PROCESSES = [
  { code: 'CC-GREY', name: 'Grey Fabric', type: 'Process', processStage: 'Grey' },
  { code: 'CC-PRINT', name: 'Printing', type: 'Process', processStage: 'Printing' },
  { code: 'CC-DYE', name: 'Dyeing', type: 'Process', processStage: 'Dyeing' },
  { code: 'CC-EMB', name: 'Embroidery', type: 'Process', processStage: 'Embroidery' },
  { code: 'CC-STITCH', name: 'Stitching', type: 'Process', processStage: 'Stitching' },
  { code: 'CC-PACK', name: 'Packing', type: 'Process', processStage: 'Packing' },
  { code: 'CC-OH', name: 'Overhead', type: 'Process', processStage: 'Overhead' },
];

/**
 * Costing & Cost Centers — Sprint 3.9
 */
class CostCenterService {
  async seedTextileProcesses(companyId) {
    const created = [];
    for (const p of TEXTILE_PROCESSES) {
      const doc = await CostCenter.findOneAndUpdate(
        { companyId, code: p.code },
        { ...p, companyId, isActive: true },
        { upsert: true, new: true }
      );
      created.push(doc);
    }
    return created;
  }

  async create(companyId, payload, userId) {
    const doc = await CostCenter.create({
      companyId,
      code: payload.code,
      name: payload.name,
      type: payload.type || 'CostCenter',
      parentId: payload.parentId || null,
      processStage: payload.processStage || '',
      budgetAmount: payload.budgetAmount || 0,
      description: payload.description || '',
      createdBy: userId,
    });
    await auditService.logSystem({
      companyId, userId, action: 'CREATE', module: 'CostCenter',
      referenceId: doc._id, after: doc.toObject(),
    });
    return doc;
  }

  async list(companyId, query = {}) {
    const filter = { companyId };
    if (query.type) filter.type = query.type;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;
    return CostCenter.find(filter).sort({ type: 1, code: 1 }).lean();
  }

  async update(companyId, id, payload, userId) {
    const doc = await CostCenter.findOne({ _id: id, companyId });
    if (!doc) throw new Error('Cost center not found');
    const fields = ['name', 'type', 'parentId', 'processStage', 'budgetAmount', 'description', 'isActive'];
    for (const f of fields) {
      if (payload[f] !== undefined) doc[f] = payload[f];
    }
    doc.updatedBy = userId;
    await doc.save();
    return doc;
  }

  async softDelete(companyId, id, userId) {
    const doc = await CostCenter.findOne({ _id: id, companyId });
    if (!doc) throw new Error('Cost center not found');
    await doc.softDelete(userId);
    return doc;
  }

  /**
   * Aggregate journal line amounts by cost center.
   */
  async costReport(companyId, { from, to, costCenterId } = {}) {
    const match = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isReversed: false,
    };
    if (from || to) {
      match.entryDate = {};
      if (from) match.entryDate.$gte = new Date(from);
      if (to) match.entryDate.$lte = new Date(to);
    }

    const pipeline = [
      { $match: match },
      { $unwind: '$lines' },
      { $match: { 'lines.costCenterId': { $ne: null } } },
    ];
    if (costCenterId) {
      pipeline.push({
        $match: { 'lines.costCenterId': new mongoose.Types.ObjectId(costCenterId) },
      });
    }
    pipeline.push({
      $group: {
        _id: '$lines.costCenterId',
        totalDr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Dr'] }, '$lines.amount', 0] } },
        totalCr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Cr'] }, '$lines.amount', 0] } },
      },
    });

    const rows = await AccountingEntry.aggregate(pipeline);
    const centers = await CostCenter.find({ companyId }).lean();
    const cmap = {};
    centers.forEach((c) => { cmap[c._id.toString()] = c; });

    return rows.map((r) => {
      const cc = cmap[r._id.toString()] || {};
      return {
        costCenterId: r._id,
        code: cc.code,
        name: cc.name,
        type: cc.type,
        processStage: cc.processStage,
        totalDr: round2(r.totalDr),
        totalCr: round2(r.totalCr),
        netCost: round2(r.totalDr - r.totalCr),
      };
    });
  }

  /**
   * Textile process cost roll-up: Grey → … → Finished.
   * Uses Job docs when available for qty, else cost-center spend only.
   */
  async textileProcessCosting(companyId, { jobId, meters, pieces } = {}) {
    const processes = await CostCenter.find({
      companyId,
      type: 'Process',
      isActive: true,
    }).lean();

    const costs = await this.costReport(companyId);
    const byStage = {};
    for (const p of processes) {
      const row = costs.find((c) => c.costCenterId.toString() === p._id.toString());
      byStage[p.processStage || p.code] = {
        costCenter: p,
        amount: row?.netCost || 0,
      };
    }

    let totalCost = round2(Object.values(byStage).reduce((s, x) => s + x.amount, 0));
    let qtyMeters = meters || 0;
    let qtyPieces = pieces || 0;

    if (jobId) {
      const job = await Job.findOne({ _id: jobId, companyId }).lean();
      if (job) {
        qtyMeters = qtyMeters || parseFloat(job.receivedQty || job.qty || 0);
        // Prefer job-level cost if present
        if (job.totalCost) totalCost = round2(job.totalCost);
      }
    }

    const costPerMeter = qtyMeters > 0 ? round2(totalCost / qtyMeters) : 0;
    const costPerPiece = qtyPieces > 0 ? round2(totalCost / qtyPieces) : 0;

    return {
      stages: byStage,
      totalCost,
      meters: qtyMeters,
      pieces: qtyPieces,
      costPerMeter,
      costPerPiece,
      chain: ['Grey', 'Printing', 'Dyeing', 'Embroidery', 'Stitching', 'Packing', 'Overhead'],
    };
  }

  async marginAnalysis(companyId, { salesAmount, costAmount, meters, pieces } = {}) {
    const sales = round2(salesAmount || 0);
    const cost = round2(costAmount || 0);
    const gross = round2(sales - cost);
    return {
      sales,
      cost,
      grossMargin: gross,
      grossMarginPct: sales > 0 ? round2((gross / sales) * 100) : 0,
      netMargin: gross, // net = gross until overhead allocation separates
      netMarginPct: sales > 0 ? round2((gross / sales) * 100) : 0,
      costPerMeter: meters > 0 ? round2(cost / meters) : 0,
      costPerPiece: pieces > 0 ? round2(cost / pieces) : 0,
    };
  }

  async allocateOverhead(companyId, { overheadCostCenterId, targetCostCenterIds, amount, basis = 'equal', userId }) {
    const targets = targetCostCenterIds || [];
    if (!targets.length) throw new Error('No target cost centers');
    const amt = round2(amount);
    const share = basis === 'equal' ? round2(amt / targets.length) : amt;

    // Allocation is analytical — posts a memo journal with cost center tags if cash ledger used
    // Here we return the allocation schedule (posting left to caller via journalEngine)
    const allocation = targets.map((id) => ({
      costCenterId: id,
      amount: share,
    }));
    const remainder = round2(amt - share * targets.length);
    if (Math.abs(remainder) >= 0.01 && allocation.length) {
      allocation[0].amount = round2(allocation[0].amount + remainder);
    }

    await auditService.logSystem({
      companyId, userId, action: 'OVERHEAD_ALLOC', module: 'CostCenter',
      after: { overheadCostCenterId, amount: amt, allocation },
    });
    return { amount: amt, basis, allocation };
  }
}

module.exports = new CostCenterService();
