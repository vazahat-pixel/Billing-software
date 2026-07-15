const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');

/**
 * Company-scoped repository base — every find/update/delete requires companyId.
 * Controllers/Services must pass companyId from JWT (req.companyId).
 * Sprint 1.4: soft-delete preferred; optimistic version updates supported.
 */
class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  requireCompany(companyId) {
    if (!companyId) {
      throw AppError.forbidden('companyId is required for data access');
    }
    return companyId;
  }

  async findById(id, companyId, { populate, select, session, includeDeleted = false } = {}) {
    this.requireCompany(companyId);
    const filter = { _id: id, companyId };
    if (includeDeleted) filter.isDeleted = { $in: [true, false] };
    let q = this.model.findOne(filter);
    if (populate) q = q.populate(populate);
    if (select) q = q.select(select);
    if (session) q = q.session(session);
    return q.lean(false);
  }

  async findOne(filter, companyId, { populate, select, session } = {}) {
    this.requireCompany(companyId);
    let q = this.model.findOne({ ...filter, companyId });
    if (populate) q = q.populate(populate);
    if (select) q = q.select(select);
    if (session) q = q.session(session);
    return q;
  }

  async findMany(filter, companyId, { populate, select, sort = { createdAt: -1 }, skip = 0, limit = 500, session } = {}) {
    this.requireCompany(companyId);
    let q = this.model.find({ ...filter, companyId });
    if (populate) q = q.populate(populate);
    if (select) q = q.select(select);
    if (session) q = q.session(session);
    return q.sort(sort).skip(skip).limit(Math.min(limit, 2000));
  }

  async count(filter, companyId) {
    this.requireCompany(companyId);
    return this.model.countDocuments({ ...filter, companyId });
  }

  async create(data, companyId, { session } = {}) {
    this.requireCompany(companyId);
    const docs = await this.model.create([{ ...data, companyId }], { session });
    return docs[0];
  }

  async updateById(id, companyId, update, { session } = {}) {
    this.requireCompany(companyId);
    return this.model.findOneAndUpdate(
      { _id: id, companyId },
      update,
      { new: true, runValidators: true, session }
    );
  }

  /**
   * Optimistic lock — requires matching `version` or throws 409 CONFLICT.
   */
  async updateWithVersion(id, companyId, expectedVersion, update, { session, userId } = {}) {
    this.requireCompany(companyId);
    const nextVersion = (Number(expectedVersion) || 1) + 1;
    const payload = {
      ...update,
      version: nextVersion,
      ...(userId ? { updatedBy: userId } : {}),
    };
    const doc = await this.model.findOneAndUpdate(
      { _id: id, companyId, version: expectedVersion, isDeleted: { $ne: true } },
      payload,
      { new: true, runValidators: true, session }
    );
    if (!doc) {
      throw new AppError('Document was modified by another user. Reload and retry.', {
        statusCode: 409,
        errorCode: ErrorCodes.CONFLICT,
      });
    }
    return doc;
  }

  /** Soft delete when schema supports it; otherwise hard delete. */
  async softDeleteById(id, companyId, { session, userId } = {}) {
    this.requireCompany(companyId);
    if (this.model.schema.path('isDeleted')) {
      return this.model.findOneAndUpdate(
        { _id: id, companyId, isDeleted: { $ne: true } },
        {
          isDeleted: true,
          deletedAt: new Date(),
          ...(userId ? { deletedBy: userId } : {}),
        },
        { new: true, session }
      );
    }
    return this.deleteById(id, companyId, { session });
  }

  async deleteById(id, companyId, { session } = {}) {
    this.requireCompany(companyId);
    return this.model.findOneAndDelete({ _id: id, companyId }, { session });
  }

  async aggregate(pipeline, companyId) {
    this.requireCompany(companyId);
    const pipe = Array.isArray(pipeline) ? [...pipeline] : [];
    const hasMatch = pipe[0] && pipe[0].$match;
    if (hasMatch && pipe[0].$match.companyId == null) {
      pipe[0] = { $match: { ...pipe[0].$match, companyId } };
    } else if (!hasMatch) {
      pipe.unshift({ $match: { companyId } });
    }
    // Soft-delete: inject unless caller already filtered
    if (this.model.schema.path('isDeleted') && pipe[0]?.$match?.isDeleted == null) {
      pipe[0].$match = { ...pipe[0].$match, isDeleted: { $ne: true } };
    }
    return this.model.aggregate(pipe);
  }
}

module.exports = BaseRepository;
