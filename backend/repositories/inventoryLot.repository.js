const InventoryLot = require('../models/InventoryLot');
const BaseRepository = require('./BaseRepository');

class InventoryLotRepository extends BaseRepository {
  constructor() {
    super(InventoryLot);
  }

  async findAvailable(companyId, { itemId } = {}) {
    const filter = { status: { $ne: 'Closed' } };
    if (itemId) filter.itemId = itemId;
    return this.findMany(filter, companyId, { sort: { createdAt: -1 }, limit: 1000 });
  }

  async findByLotCode(lotId, companyId, options = {}) {
    return this.findOne({ lotId }, companyId, options);
  }
}

module.exports = new InventoryLotRepository();
