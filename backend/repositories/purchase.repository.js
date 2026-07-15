const Purchase = require('../models/Purchase');
const BaseRepository = require('./BaseRepository');

class PurchaseRepository extends BaseRepository {
  constructor() {
    super(Purchase);
  }

  async findWithParty(filter, companyId, options = {}) {
    return this.findMany(filter, companyId, {
      ...options,
      populate: options.populate || [{ path: 'supplierId', select: 'name gstin state' }],
    });
  }
}

module.exports = new PurchaseRepository();
