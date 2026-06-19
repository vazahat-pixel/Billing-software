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

    // Find next accd for this company
    const highest = await Party.findOne({ companyId: partyData.companyId }).sort({ accd: -1 });
    const nextAccd = highest && typeof highest.accd === 'number' ? highest.accd + 1 : 1001;

    const normalized = {
      name,
      type,
      accd: partyData.accd !== undefined ? Number(partyData.accd) : nextAccd,
      gstin: partyData.gstin || '',
      pan: partyData.pan || '',
      mobile: partyData.mobile || '',
      email: partyData.email || '',
      address: partyData.address || '',
      city: partyData.city || partyData.station || '',
      state: partyData.state || 'Gujarat',
      creditLimit: Number(partyData.creditLimit || 0),
      openingBalance: Number(partyData.openingBalance || 0),
      openingBalanceType: partyData.openingBalanceType || 'Dr',
      companyId: partyData.companyId,
      // Replicated fields
      mainGroup: !!partyData.mainGroup,
      mainGroupId: partyData.mainGroupId || '',
      phoneO: partyData.phoneO || '',
      phoneR: partyData.phoneR || '',
      contactPerson: partyData.contactPerson || '',
      tinCstNo: partyData.tinCstNo || '',
      tinGstNo: partyData.tinGstNo || '',
      status: partyData.status || 'Active',
      updateInAllFirm: partyData.updateInAllFirm || 'Y',
      updateInAllYear: partyData.updateInAllYear || 'N',
      aadharNo: partyData.aadharNo || '',
      stateCode: partyData.stateCode || '24',
      stateName: partyData.stateName || 'Gujarat',
      gstType: partyData.gstType || 'INVOICE (IN STATE)',
      udyamAadhar: partyData.udyamAadhar || '',
      msmeType: partyData.msmeType || 'None',
      dueDays: Number(partyData.dueDays || 0),
      rdRate: Number(partyData.rdRate || 0),
      disc1: Number(partyData.disc1 || 0),
      disc2: Number(partyData.disc2 || 0),
      addPer: Number(partyData.addPer || 0),
      intPer: Number(partyData.intPer || 0),
      commi: Number(partyData.commi || 0),
      maxLevel: Number(partyData.maxLevel || 0),
      minLevel: Number(partyData.minLevel || 0),
      tdsPer: Number(partyData.tdsPer || 0),
      tcsPer: Number(partyData.tcsPer || 0)
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
      'creditLimit', 'openingBalance', 'openingBalanceType', 'station', 'group',
      'accd', 'mainGroup', 'mainGroupId', 'phoneO', 'phoneR', 'contactPerson',
      'tinCstNo', 'tinGstNo', 'status', 'updateInAllFirm', 'updateInAllYear',
      'aadharNo', 'stateCode', 'stateName', 'gstType', 'udyamAadhar', 'msmeType',
      'dueDays', 'rdRate', 'disc1', 'disc2', 'addPer', 'intPer', 'commi',
      'maxLevel', 'minLevel', 'tdsPer', 'tcsPer'
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
