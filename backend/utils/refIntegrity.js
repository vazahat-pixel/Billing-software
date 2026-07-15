const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

/**
 * Referential integrity helpers — validate ObjectIds exist within the same company.
 * Use before financial writes; never trust FE references.
 */
async function assertExists(Model, id, companyId, label = 'Record') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw AppError.badRequest(`Invalid ${label} id`);
  }
  const filter = Model.schema.path('companyId')
    ? { _id: id, companyId }
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
