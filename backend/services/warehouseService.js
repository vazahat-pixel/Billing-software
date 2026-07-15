const Warehouse = require('../models/Warehouse');
const AppError = require('../utils/AppError');

class WarehouseService {
  async list(companyId, { type, parentId } = {}) {
    const filter = { companyId };
    if (type) filter.type = type;
    if (parentId) filter.parentId = parentId;
    return Warehouse.find(filter).sort({ type: 1, name: 1 });
  }

  async create(companyId, data) {
    const code = String(data.code || data.name || '').trim().toUpperCase();
    const name = String(data.name || '').trim();
    if (!name || !code) throw AppError.badRequest('Warehouse name and code are required');

    if (data.isDefault) {
      await Warehouse.updateMany({ companyId, isDefault: true }, { isDefault: false });
    }

    return Warehouse.create({
      companyId,
      name,
      code,
      type: data.type || 'Warehouse',
      parentId: data.parentId || null,
      address: data.address || '',
      isDefault: !!data.isDefault,
      status: data.status || 'Active',
    });
  }

  async update(id, companyId, data) {
    const patch = {};
    ['name', 'code', 'type', 'parentId', 'address', 'isDefault', 'status'].forEach((k) => {
      if (data[k] !== undefined) patch[k] = data[k];
    });
    if (patch.code) patch.code = String(patch.code).toUpperCase();
    if (patch.isDefault) {
      await Warehouse.updateMany({ companyId, isDefault: true, _id: { $ne: id } }, { isDefault: false });
    }
    const doc = await Warehouse.findOneAndUpdate({ _id: id, companyId }, patch, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw AppError.notFound('Warehouse not found');
    return doc;
  }

  async softDelete(id, companyId) {
    const doc = await Warehouse.findOneAndUpdate(
      { _id: id, companyId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!doc) throw AppError.notFound('Warehouse not found');
    return doc;
  }

  async getDefault(companyId) {
    return (
      (await Warehouse.findOne({ companyId, isDefault: true, status: 'Active' })) ||
      (await Warehouse.findOne({ companyId, type: 'Warehouse', status: 'Active' }))
    );
  }
}

module.exports = new WarehouseService();
