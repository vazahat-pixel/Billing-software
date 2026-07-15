const mongoose = require('mongoose');

/**
 * Enterprise document metadata — additive, optional fields for Sprint 1.4+.
 * Does not break existing documents (defaults applied on write).
 */
const enterpriseMetaSchema = {
  branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  financialYearId: { type: String, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false, index: true },
  version: { type: Number, default: 1, min: 1 },
};

/**
 * Soft-delete + optimistic versioning plugin.
 * find hooks exclude isDeleted unless explicitly queried.
 */
function enterpriseIntegrityPlugin(schema, options = {}) {
  const { softDelete = true, versionField = true } = options;

  Object.entries(enterpriseMetaSchema).forEach(([key, def]) => {
    if (!schema.path(key)) {
      if (key === 'version' && !versionField) return;
      if ((key === 'isDeleted' || key === 'deletedAt' || key === 'deletedBy') && !softDelete) return;
      schema.add({ [key]: def });
    }
  });

  if (softDelete) {
    schema.pre(/^find/, function softDeleteFilter() {
      const q = this.getQuery();
      if (q.isDeleted === undefined && q.deletedAt === undefined) {
        this.where({ isDeleted: { $ne: true } });
      }
    });
  }

  if (versionField) {
    schema.pre('save', function bumpVersion(next) {
      if (!this.isNew && this.isModified() && !this.isModified('version')) {
        this.version = (this.version || 1) + 1;
      }
      next();
    });
  }

  schema.methods.softDelete = async function softDeleteDoc(userId, session) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (userId) this.deletedBy = userId;
    if (this.status != null && schema.path('status')) {
      // leave status as-is unless document already cancelled elsewhere
    }
    return this.save({ session });
  };
}

module.exports = { enterpriseMetaSchema, enterpriseIntegrityPlugin };
