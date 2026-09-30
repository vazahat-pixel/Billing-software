const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

/**
 * Referential integrity helpers — validate ObjectIds exist within the same company.
 * Use before financial writes; never trust FE references.
 */
const MASTER_MODELS = new Set(['Party', 'Item', 'Book', 'Warehouse', 'SubMaster', 'AccountGroup', 'HsnMaster']);

async function companyScope(companyId, modelName) {
  if (!MASTER_MODELS.has(modelName)) return companyId;
  const companyGroupService = require('../services/companyGroupService');
  const master = await companyGroupService.masterId(companyId);
  if (!master || String(master) === String(companyId)) return companyId;
  return { $in: [companyId, master] };
}

async function assertExists(Model, id, companyId, label = 'Record') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw AppError.badRequest(`Invalid ${label} id`);
  }
  const filter = Model.schema.path('companyId')
    ? { _id: id, companyId: await companyScope(companyId, Model.modelName) }
    : { _id: id };
  const doc = await Model.findOne(filter).select('_id').lean();
  if (!doc) throw AppError.badRequest(`${label} not found for this company`);
  return doc;
}

async function assertRefs(companyId, refs = []) {
  for (const { Model, id, label } of refs) {
    if (id == null || id === '') continue;
    await assertExists(Model, id, companyId, label);
  }
}

module.exports = { assertExists, assertRefs };
