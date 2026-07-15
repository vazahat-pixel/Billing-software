const Sales = require('../models/Sales');
const BaseRepository = require('./BaseRepository');

class SalesRepository extends BaseRepository {
  constructor() {
    super(Sales);
  }

  async findWithCustomer(filter, companyId, options = {}) {
    return this.findMany(filter, companyId, {
      ...options,
      populate: options.populate || [
        { path: 'customerId', select: 'name gstin state' },
        { path: 'items.itemId', select: 'name hsnCode gstRate' },
      ],
    });
  }
}

module.exports = new SalesRepository();
