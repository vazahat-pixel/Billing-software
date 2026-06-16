const Party = require('../models/Party');

class PartyService {
  async createParty(partyData) {
    const name = (partyData.name || '').trim();
    if (!name) {
      throw new Error('Party name is required.');
    }

    let type = partyData.type || 'Customer';
    if (partyData.group) {
      const g = partyData.group.toUpperCase();
      if (g.includes('CREDITOR')) type = 'Supplier';
      else if (g.includes('DEBTOR')) type = 'Customer';
      else if (g.includes('BROKER')) type = 'Broker';
      else if (g.includes('JOB') || g.includes('WORKER')) type = 'Job Worker';
    }

    const normalized = {
      name,
      type,
      gstin: partyData.gstin || '',
      pan: partyData.pan || '',
      mobile: partyData.mobile || '',
      email: partyData.email || '',
      address: partyData.address || '',
      city: partyData.city || partyData.station || '',
      state: partyData.state || 'Gujarat',
      creditLimit: Number(partyData.creditLimit || 0),
      openingBalance: Number(partyData.openingBalance || 0),
      companyId: partyData.companyId
    };

    const existing = await Party.findOne({ 
      name: normalized.name, 
      companyId: normalized.companyId 
    });
    
    if (existing) {
      throw new Error('Party with this name already exists in your company.');
    }

    const party = new Party(normalized);
    return await party.save();
  }

  async getParties(companyId) {
    return await Party.find({ companyId }).sort({ name: 1 });
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
    const allowed = [
      'name', 'type', 'gstin', 'pan', 'mobile', 'email', 'address', 'city', 'state',
      'creditLimit', 'openingBalance', 'openingBalanceType', 'station', 'group'
    ];
    const patch = {};
    allowed.forEach((key) => {
      if (updateData[key] !== undefined) patch[key] = updateData[key];
    });
    if (patch.station && !patch.city) patch.city = patch.station;
    if (patch.group && !patch.type) {
      const g = String(patch.group).toUpperCase();
      if (g.includes('CREDITOR')) patch.type = 'Supplier';
      else if (g.includes('BROKER')) patch.type = 'Broker';
      else if (g.includes('JOB') || g.includes('WORKER')) patch.type = 'Job Worker';
      else patch.type = 'Customer';
    }
    if (patch.openingBalance !== undefined) patch.openingBalance = Number(patch.openingBalance);
    return await Party.findOneAndUpdate(
      { _id: id, companyId },
      patch,
      { new: true, runValidators: true }
    );
  }

  async deleteParty(id, companyId) {
    return await Party.findOneAndDelete({ _id: id, companyId });
  }
}

module.exports = new PartyService();
