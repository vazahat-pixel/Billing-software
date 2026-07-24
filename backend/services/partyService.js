const Party = require('../models/Party');
const LedgerMaster = require('../models/LedgerMaster');

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
      else if (g.includes('TRANSPORT')) type = 'Transport';
      else if (g.includes('EMPLOYEE')) type = 'Employee';
      else if (g.includes('SALESMAN') || g.includes('SALES')) type = 'Salesman';
      else if (g.includes('AGENT')) type = 'Agent';
    }

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
      tcsPer: Number(partyData.tcsPer || 0),
      paymentTermsId: partyData.paymentTermsId || null,
      isFavorite: !!partyData.isFavorite,
    };

    const existing = await Party.findOne({
      name: normalized.name,
      companyId: normalized.companyId
    });

    if (existing) {
      throw new Error('Party with this name already exists in your company.');
    }

    const party = new Party(normalized);
    const saved = await party.save();

    // Sync opening to LedgerMaster when opening amount present
    if (saved.openingBalance) {
      await this.syncOpeningToLedger(saved);
    }
    return saved;
  }

  /**
   * Keep Party.openingBalance and linked LedgerMaster in lockstep (Sprint 2.1).
   */
  async syncOpeningToLedger(party) {
    if (!party?._id || !party.companyId) return null;
    let ledger = await LedgerMaster.findOne({
      companyId: party.companyId,
      linkedPartyId: party._id,
    });

    const isCreditor = ['Supplier', 'Both', 'Job Worker', 'Broker', 'Transport', 'Agent'].includes(party.type);
    const group = isCreditor ? 'Liabilities' : 'Assets';
    const subGroup = isCreditor ? 'Sundry Creditors' : 'Sundry Debtors';
    const openingBalance = Number(party.openingBalance || 0);
    const openingBalanceType = party.openingBalanceType || (isCreditor ? 'Cr' : 'Dr');

    if (!ledger) {
      ledger = await LedgerMaster.create({
        companyId: party.companyId,
        name: party.name,
        group,
        subGroup,
        linkedPartyId: party._id,
        openingBalance,
        openingBalanceType,
      });
    } else {
      ledger.name = party.name;
      ledger.openingBalance = openingBalance;
      ledger.openingBalanceType = openingBalanceType;
      await ledger.save();
    }
    return ledger;
  }

  async getParties(companyId, { type, favorites } = {}) {
    const filter = { companyId };
    if (type) filter.type = type;
    if (favorites) filter.isFavorite = true;
    return await Party.find(filter).sort({ name: 1 });
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
    return await Party.find(filter).limit(10).sort({ lastUsedAt: -1, name: 1 });
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
      'maxLevel', 'minLevel', 'tdsPer', 'tcsPer', 'paymentTermsId', 'isFavorite', 'lastUsedAt',
      'banks'
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
      else if (g.includes('TRANSPORT')) patch.type = 'Transport';
      else patch.type = 'Customer';
    }
    if (patch.openingBalance !== undefined) patch.openingBalance = Number(patch.openingBalance);

    const party = await Party.findOneAndUpdate(
      { _id: id, companyId },
      patch,
      { new: true, runValidators: true }
    );
    if (!party) return null;

    if (
      patch.openingBalance !== undefined ||
      patch.openingBalanceType !== undefined ||
      patch.name !== undefined ||
      patch.type !== undefined
    ) {
      await this.syncOpeningToLedger(party);
    }
    return party;
  }

  async deleteParty(id, companyId) {
    return await Party.findOneAndUpdate(
      { _id: id, companyId },
      { isDeleted: true, deletedAt: new Date(), status: 'Inactive' },
      { new: true }
    );
  }
}

module.exports = new PartyService();

