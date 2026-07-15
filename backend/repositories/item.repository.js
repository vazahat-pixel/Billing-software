const Item = require('../models/Item');
const BaseRepository = require('./BaseRepository');

class ItemRepository extends BaseRepository {
  constructor() {
    super(Item);
  }

  async search(query, companyId, limit = 50) {
    this.requireCompany(companyId);
    const q = String(query || '').trim();
    if (!q) return this.findMany({}, companyId, { limit });
    return this.model
      .find({
        companyId,
        $or: [
          { name: new RegExp(q, 'i') },
          { hsnCode: new RegExp(q, 'i') },
          { design: new RegExp(q, 'i') },
        ],
      })
      .limit(limit);
  }
}

module.exports = new ItemRepository();
