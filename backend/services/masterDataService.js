const mongoose = require('mongoose');
const Party = require('../models/Party');
const Item = require('../models/Item');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const InventoryLot = require('../models/InventoryLot');
const LedgerMaster = require('../models/LedgerMaster');
const SubMaster = require('../models/SubMaster');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');

/**
 * Master Data Engine utilities — merge + bulk import (Sprint 2.1).
 */
class MasterDataService {
  /**
   * Merge source party into target: re-point FKs, soft-delete source.
   */
  async mergeParties(companyId, { sourceId, targetId, userId }) {
    if (!sourceId || !targetId) throw AppError.badRequest('sourceId and targetId required');
    if (String(sourceId) === String(targetId)) throw AppError.badRequest('Cannot merge a party into itself');

    const [source, target] = await Promise.all([
      Party.findOne({ _id: sourceId, companyId }),
      Party.findOne({ _id: targetId, companyId }),
    ]);
    if (!source || !target) throw AppError.notFound('Source or target party not found');

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Sales.updateMany({ companyId, customerId: sourceId }, { customerId: targetId }, { session });
      await Sales.updateMany({ companyId, brokerId: sourceId }, { brokerId: targetId }, { session });
      await Purchase.updateMany({ companyId, supplierId: sourceId }, { supplierId: targetId }, { session });
      await Purchase.updateMany({ companyId, brokerId: sourceId }, { brokerId: targetId }, { session });
      await LedgerMaster.updateMany(
        { companyId, linkedPartyId: sourceId },
        { linkedPartyId: targetId, name: target.name },
        { session }
      );

      source.isDeleted = true;
      source.deletedAt = new Date();
      source.deletedBy = userId || null;
      source.status = 'Inactive';
      await source.save({ session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    await auditService.logSystem({
      companyId,
      userId,
      action: 'MERGE',
      module: 'Party',
      referenceId: targetId,
      before: { sourceId, sourceName: source.name },
      after: { targetId, targetName: target.name },
      reason: 'Party merge',
    });

    return { mergedInto: target, retired: { _id: source._id, name: source.name } };
  }

  async mergeItems(companyId, { sourceId, targetId, userId }) {
    if (!sourceId || !targetId) throw AppError.badRequest('sourceId and targetId required');
    if (String(sourceId) === String(targetId)) throw AppError.badRequest('Cannot merge an item into itself');

    const [source, target] = await Promise.all([
      Item.findOne({ _id: sourceId, companyId }),
      Item.findOne({ _id: targetId, companyId }),
    ]);
    if (!source || !target) throw AppError.notFound('Source or target item not found');

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await InventoryLot.updateMany({ companyId, itemId: sourceId }, { itemId: targetId }, { session });
      source.isDeleted = true;
      source.deletedAt = new Date();
      source.deletedBy = userId || null;
      await source.save({ session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    await auditService.logSystem({
      companyId,
      userId,
      action: 'MERGE',
      module: 'Item',
      referenceId: targetId,
      before: { sourceId, sourceName: source.name },
      after: { targetId, targetName: target.name },
      reason: 'Item merge',
    });

    return { mergedInto: target, retired: { _id: source._id, name: source.name } };
  }

  /**
   * Dry-run or apply rows for parties/items/submasters.
   * rows: array of plain objects
   */
  async importMasters(companyId, { entity, rows = [], dryRun = true, userId }) {
    if (!['party', 'item', 'submaster'].includes(entity)) {
      throw AppError.badRequest('entity must be party|item|submaster');
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      throw AppError.badRequest('rows array required');
    }

    const report = { entity, dryRun, total: rows.length, valid: 0, invalid: 0, created: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const line = i + 1;
      try {
        if (entity === 'party') {
          const name = String(row.name || '').trim();
          if (!name) throw new Error('name required');
          const type = row.type || 'Customer';
          const exists = await Party.findOne({ companyId, name });
          if (exists) {
            report.skipped += 1;
            report.valid += 1;
            continue;
          }
          report.valid += 1;
          if (!dryRun) {
            const partyService = require('./partyService');
            await partyService.createParty({ ...row, name, type, companyId });
            report.created += 1;
          }
        } else if (entity === 'item') {
          const name = String(row.name || row.itemName || '').trim();
          if (!name) throw new Error('name required');
          const exists = await Item.findOne({ companyId, name });
          if (exists) {
            report.skipped += 1;
            report.valid += 1;
            continue;
          }
          report.valid += 1;
          if (!dryRun) {
            const itemService = require('./itemService');
            await itemService.createItem({ ...row, name, companyId });
            report.created += 1;
          }
        } else {
          const type = row.type;
          const name = String(row.name || '').trim();
          if (!type || !name) throw new Error('type and name required');
          if (!SubMaster.SUB_MASTER_TYPES.includes(type)) throw new Error(`Invalid type ${type}`);
          const exists = await SubMaster.findOne({ companyId, type, name });
          if (exists) {
            report.skipped += 1;
            report.valid += 1;
            continue;
          }
          report.valid += 1;
          if (!dryRun) {
            await SubMaster.create({ companyId, type, name, extraFields: row.extraFields || {} });
            report.created += 1;
          }
        }
      } catch (err) {
        report.invalid += 1;
        report.errors.push({ line, message: err.message, row });
      }
    }

    if (!dryRun) {
      await auditService.logSystem({
        companyId,
        userId,
        action: 'IMPORT',
        module: entity,
        before: null,
        after: { created: report.created, skipped: report.skipped, invalid: report.invalid },
        reason: 'Bulk master import',
      });
    }

    return report;
  }

  async exportMasters(companyId, entity) {
    if (entity === 'party') {
      return Party.find({ companyId }).sort({ name: 1 }).lean();
    }
    if (entity === 'item') {
      return Item.find({ companyId }).sort({ name: 1 }).lean();
    }
    if (entity === 'submaster') {
      return SubMaster.find({ companyId }).sort({ type: 1, name: 1 }).lean();
    }
    if (entity === 'warehouse') {
      const Warehouse = require('../models/Warehouse');
      return Warehouse.find({ companyId }).sort({ type: 1, name: 1 }).lean();
    }
    throw AppError.badRequest('entity must be party|item|submaster|warehouse');
  }
}

module.exports = new MasterDataService();
