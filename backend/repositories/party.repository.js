const Party = require('../models/Party');
const BaseRepository = require('./BaseRepository');

class PartyRepository extends BaseRepository {
  constructor() {
    super(Party);
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
          { gstin: new RegExp(q, 'i') },
          { mobile: new RegExp(q, 'i') },
        ],
      })
      .limit(limit);
  }
}

module.exports = new PartyRepository();
