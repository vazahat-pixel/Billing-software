const Party = require('../models/Party');

class PartyService {
  async createParty(partyData) {
    // Check for existing party with same name in company
    const existing = await Party.findOne({ 
      name: partyData.name, 
      companyId: partyData.companyId 
    });
    
    if (existing) {
      throw new Error('Party with this name already exists in your company.');
    }

    const party = new Party(partyData);
    return await party.save();
  }

  async searchParties(query, companyId) {
    const filter = { companyId };
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { gstin: { $regex: query, $options: 'i' } },
        { mobile: { $regex: query, $options: 'i' } }
      ];
    }
    return await Party.find(filter).limit(10).sort({ name: 1 });
  }

  async getPartyById(id, companyId) {
    return await Party.findOne({ _id: id, companyId });
  }

  async updateParty(id, companyId, updateData) {
    return await Party.findOneAndUpdate(
      { _id: id, companyId },
      updateData,
      { new: true, runValidators: true }
    );
  }

  async deleteParty(id, companyId) {
    return await Party.findOneAndDelete({ _id: id, companyId });
  }
}

module.exports = new PartyService();
