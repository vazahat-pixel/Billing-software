const AccountGroup = require('../models/AccountGroup');
const LedgerMaster = require('../models/LedgerMaster');
const auditService = require('./auditService');

const DEFAULT_GROUPS = [
  { code: 'AST', name: 'Assets', nature: 'Assets', normalBalance: 'Dr', level: 1 },
  { code: 'AST-CA', name: 'Current Assets', nature: 'Assets', normalBalance: 'Dr', level: 2, parentCode: 'AST' },
  { code: 'AST-CA-CASH', name: 'Cash', nature: 'Assets', normalBalance: 'Dr', level: 3, parentCode: 'AST-CA' },
  { code: 'AST-CA-BANK', name: 'Bank', nature: 'Assets', normalBalance: 'Dr', level: 3, parentCode: 'AST-CA' },
  { code: 'AST-CA-INV', name: 'Inventory', nature: 'Assets', normalBalance: 'Dr', level: 3, parentCode: 'AST-CA' },
  { code: 'AST-CA-AR', name: 'Accounts Receivable', nature: 'Assets', normalBalance: 'Dr', level: 3, parentCode: 'AST-CA' },
  { code: 'AST-CA-TAX', name: 'Tax Receivable', nature: 'Assets', normalBalance: 'Dr', level: 3, parentCode: 'AST-CA' },
  { code: 'AST-NCA', name: 'Non-Current Assets', nature: 'Assets', normalBalance: 'Dr', level: 2, parentCode: 'AST' },
  { code: 'LIA', name: 'Liabilities', nature: 'Liabilities', normalBalance: 'Cr', level: 1 },
  { code: 'LIA-CL', name: 'Current Liabilities', nature: 'Liabilities', normalBalance: 'Cr', level: 2, parentCode: 'LIA' },
  { code: 'LIA-CL-AP', name: 'Accounts Payable', nature: 'Liabilities', normalBalance: 'Cr', level: 3, parentCode: 'LIA-CL' },
  { code: 'LIA-CL-TAX', name: 'Tax Payable', nature: 'Liabilities', normalBalance: 'Cr', level: 3, parentCode: 'LIA-CL' },
  { code: 'EQY', name: 'Equity', nature: 'Equity', normalBalance: 'Cr', level: 1 },
  { code: 'EQY-CAP', name: "Owner's Capital", nature: 'Equity', normalBalance: 'Cr', level: 2, parentCode: 'EQY' },
  { code: 'EQY-RE', name: 'Retained Earnings', nature: 'Equity', normalBalance: 'Cr', level: 2, parentCode: 'EQY' },
  { code: 'INC', name: 'Income', nature: 'Income', normalBalance: 'Cr', level: 1 },
  { code: 'INC-DI', name: 'Direct Income', nature: 'Income', normalBalance: 'Cr', level: 2, parentCode: 'INC', affectsGrossProfit: true },
  { code: 'INC-II', name: 'Indirect Income', nature: 'Income', normalBalance: 'Cr', level: 2, parentCode: 'INC' },
  { code: 'EXP', name: 'Expenses', nature: 'Expenses', normalBalance: 'Dr', level: 1 },
  { code: 'EXP-DE', name: 'Direct Expenses', nature: 'Expenses', normalBalance: 'Dr', level: 2, parentCode: 'EXP', affectsGrossProfit: true },
  { code: 'EXP-IE', name: 'Indirect Expenses', nature: 'Expenses', normalBalance: 'Dr', level: 2, parentCode: 'EXP' },
];

const SYSTEM_LEDGERS = [
  { name: 'Cash A/c', group: 'Assets', subGroup: 'Cash & Bank', accountType: 'Cash', nature: 'Dr', groupCode: 'AST-CA-CASH' },
  { name: 'Bank A/c', group: 'Assets', subGroup: 'Cash & Bank', accountType: 'Bank', nature: 'Dr', groupCode: 'AST-CA-BANK' },
  { name: 'Sales A/c', group: 'Income', subGroup: 'Direct Income', accountType: 'System', nature: 'Cr', groupCode: 'INC-DI' },
  { name: 'Purchase A/c', group: 'Expenses', subGroup: 'Direct Expenses', accountType: 'System', nature: 'Dr', groupCode: 'EXP-DE' },
  { name: 'CGST Input', group: 'Assets', subGroup: 'Tax', accountType: 'Tax', nature: 'Dr', groupCode: 'AST-CA-TAX', gstMapping: { taxType: 'CGST_IN' } },
  { name: 'SGST Input', group: 'Assets', subGroup: 'Tax', accountType: 'Tax', nature: 'Dr', groupCode: 'AST-CA-TAX', gstMapping: { taxType: 'SGST_IN' } },
  { name: 'IGST Input', group: 'Assets', subGroup: 'Tax', accountType: 'Tax', nature: 'Dr', groupCode: 'AST-CA-TAX', gstMapping: { taxType: 'IGST_IN' } },
  { name: 'CGST Output', group: 'Liabilities', subGroup: 'Tax', accountType: 'Tax', nature: 'Cr', groupCode: 'LIA-CL-TAX', gstMapping: { taxType: 'CGST_OUT' } },
  { name: 'SGST Output', group: 'Liabilities', subGroup: 'Tax', accountType: 'Tax', nature: 'Cr', groupCode: 'LIA-CL-TAX', gstMapping: { taxType: 'SGST_OUT' } },
  { name: 'IGST Output', group: 'Liabilities', subGroup: 'Tax', accountType: 'Tax', nature: 'Cr', groupCode: 'LIA-CL-TAX', gstMapping: { taxType: 'IGST_OUT' } },
  { name: 'Job Work Charges', group: 'Expenses', subGroup: 'Direct Expenses', accountType: 'System', nature: 'Dr', groupCode: 'EXP-DE' },
  { name: 'Production Loss A/c', group: 'Expenses', subGroup: 'Direct Expenses', accountType: 'System', nature: 'Dr', groupCode: 'EXP-DE' },
  { name: 'Stock A/c', group: 'Assets', subGroup: 'Current Assets', accountType: 'Stock', nature: 'Dr', groupCode: 'AST-CA-INV' },
  { name: 'Freight Charges', group: 'Expenses', subGroup: 'Indirect Expenses', accountType: 'System', nature: 'Dr', groupCode: 'EXP-IE' },
  { name: 'Capital A/c', group: 'Capital', subGroup: "Owner's Capital", accountType: 'System', nature: 'Cr', groupCode: 'EQY-CAP' },
  { name: 'Retained Earnings', group: 'Capital', subGroup: 'Retained Earnings', accountType: 'System', nature: 'Cr', groupCode: 'EQY-RE' },
  { name: 'GRN Clearing A/c', group: 'Liabilities', subGroup: 'Current Liabilities', accountType: 'System', nature: 'Cr', groupCode: 'LIA-CL' },
  { name: 'Sales Return A/c', group: 'Income', subGroup: 'Direct Income', accountType: 'System', nature: 'Dr', groupCode: 'INC-DI' },
  { name: 'Purchase Return A/c', group: 'Expenses', subGroup: 'Direct Expenses', accountType: 'System', nature: 'Cr', groupCode: 'EXP-DE' },
  { name: 'Round Off', group: 'Expenses', subGroup: 'Indirect Expenses', accountType: 'System', nature: 'Dr', groupCode: 'EXP-IE' },
  { name: 'Suspense A/c', group: 'Assets', subGroup: 'Current Assets', accountType: 'System', nature: 'Dr', groupCode: 'AST-CA' },
  { name: 'TDS Payable', group: 'Liabilities', subGroup: 'Current Liabilities', accountType: 'Tax', nature: 'Cr', groupCode: 'LIA-CL-TAX' },
  { name: 'Bank Charges', group: 'Expenses', subGroup: 'Indirect Expenses', accountType: 'System', nature: 'Dr', groupCode: 'EXP-IE' },
  { name: 'Depreciation A/c', group: 'Expenses', subGroup: 'Indirect Expenses', accountType: 'System', nature: 'Dr', groupCode: 'EXP-IE' },
];

function defaultNatureForGroup(group) {
  if (['Assets', 'Expenses'].includes(group)) return 'Dr';
  return 'Cr';
}

class ChartOfAccountsService {
  async seedDefaultGroups(companyId) {
    const byCode = {};
    for (const g of DEFAULT_GROUPS) {
      let parentId = null;
      let path = g.name;
      if (g.parentCode && byCode[g.parentCode]) {
        parentId = byCode[g.parentCode]._id;
        path = `${byCode[g.parentCode].path}/${g.name}`;
      }
      const doc = await AccountGroup.findOneAndUpdate(
        { companyId, code: g.code },
        {
          companyId,
          code: g.code,
          name: g.name,
          nature: g.nature,
          normalBalance: g.normalBalance,
          parentGroupId: parentId,
          level: g.level,
          path,
          affectsGrossProfit: !!g.affectsGrossProfit,
          isSystem: true,
          isActive: true,
        },
        { upsert: true, new: true }
      );
      byCode[g.code] = doc;
    }
    return byCode;
  }

  async seedSystemLedgers(companyId) {
    const groups = await this.seedDefaultGroups(companyId);
    const created = [];
    for (const t of SYSTEM_LEDGERS) {
      const groupDoc = groups[t.groupCode] || null;
      const ledger = await LedgerMaster.findOneAndUpdate(
        { companyId, name: t.name },
        {
          companyId,
          name: t.name,
          group: t.group,
          subGroup: t.subGroup,
          accountType: t.accountType,
          nature: t.nature,
          accountGroupId: groupDoc?._id || null,
          gstMapping: t.gstMapping || undefined,
          isSystemLedger: true,
          isActive: true,
          allowManualEntry: t.accountType !== 'System',
        },
        { upsert: true, new: true }
      );
      created.push(ledger);
    }
    return created;
  }

  async createGroup(companyId, payload, userId = null) {
    let level = 1;
    let path = payload.name;
    if (payload.parentGroupId) {
      const parent = await AccountGroup.findOne({ _id: payload.parentGroupId, companyId });
      if (!parent) throw new Error('Parent account group not found');
      level = (parent.level || 1) + 1;
      path = `${parent.path}/${payload.name}`;
    }
    const nature = payload.nature;
    const normalBalance = payload.normalBalance || (['Assets', 'Expenses'].includes(nature) ? 'Dr' : 'Cr');
    const group = await AccountGroup.create({
      companyId,
      code: payload.code,
      name: payload.name,
      nature,
      normalBalance,
      parentGroupId: payload.parentGroupId || null,
      level,
      path,
      sortOrder: payload.sortOrder || 0,
      description: payload.description || '',
      affectsGrossProfit: !!payload.affectsGrossProfit,
      createdBy: userId,
    });
    await auditService.logSystem({
      companyId, userId, action: 'CREATE', module: 'AccountGroup',
      referenceId: group._id, after: group.toObject(),
    });
    return group;
  }

  async listGroups(companyId, { nature, tree } = {}) {
    const filter = { companyId };
    if (nature) filter.nature = nature;
    const groups = await AccountGroup.find(filter).sort({ sortOrder: 1, code: 1 }).lean();
    if (!tree) return groups;
    return this._buildTree(groups);
  }

  _buildTree(groups) {
    const map = {};
    groups.forEach((g) => { map[g._id.toString()] = { ...g, children: [] }; });
    const roots = [];
    groups.forEach((g) => {
      const node = map[g._id.toString()];
      if (g.parentGroupId && map[g.parentGroupId.toString()]) {
        map[g.parentGroupId.toString()].children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  async createLedger(companyId, payload, userId = null) {
    const group = payload.group;
    if (!group) throw new Error('Account group (nature) is required');
    const nature = payload.nature || defaultNatureForGroup(group === 'Equity' ? 'Capital' : group);

    if (payload.parentLedgerId) {
      const parent = await LedgerMaster.findOne({ _id: payload.parentLedgerId, companyId });
      if (!parent) throw new Error('Parent ledger not found');
    }

    const ledger = await LedgerMaster.create({
      companyId,
      code: payload.code || '',
      name: payload.name,
      group: group === 'Equity' ? 'Capital' : group,
      subGroup: payload.subGroup || '',
      accountGroupId: payload.accountGroupId || null,
      parentLedgerId: payload.parentLedgerId || null,
      nature,
      openingBalance: payload.openingBalance || 0,
      openingBalanceType: payload.openingBalanceType || nature,
      linkedPartyId: payload.linkedPartyId || null,
      linkedBankAccount: payload.linkedBankAccount || undefined,
      accountType: payload.accountType || 'General',
      costCenterId: payload.costCenterId || null,
      gstMapping: payload.gstMapping || undefined,
      tdsMapping: payload.tdsMapping || undefined,
      isActive: payload.isActive !== false,
      allowManualEntry: payload.allowManualEntry !== false,
      description: payload.description || '',
      createdBy: userId,
    });

    await auditService.logSystem({
      companyId, userId, action: 'CREATE', module: 'LedgerMaster',
      referenceId: ledger._id, after: ledger.toObject(),
    });
    return ledger;
  }

  async updateLedger(companyId, ledgerId, payload, userId = null) {
    const ledger = await LedgerMaster.findOne({ _id: ledgerId, companyId });
    if (!ledger) throw new Error('Ledger not found');
    if (ledger.isSystemLedger) {
      const blocked = ['name', 'group', 'isSystemLedger'];
      for (const k of blocked) {
        if (payload[k] !== undefined && payload[k] !== ledger[k]) {
          throw new Error(`Cannot change ${k} on system ledger`);
        }
      }
    }

    const before = ledger.toObject();
    const allowed = [
      'code', 'subGroup', 'accountGroupId', 'parentLedgerId', 'nature',
      'linkedBankAccount', 'accountType', 'costCenterId', 'gstMapping', 'tdsMapping',
      'isActive', 'allowManualEntry', 'description',
    ];
    // Opening balance only if no opening journal yet
    if (!ledger.openingEntryId && payload.openingBalance !== undefined) {
      ledger.openingBalance = payload.openingBalance;
      if (payload.openingBalanceType) ledger.openingBalanceType = payload.openingBalanceType;
    }
    for (const k of allowed) {
      if (payload[k] !== undefined) ledger[k] = payload[k];
    }
    if (payload.name && !ledger.isSystemLedger) ledger.name = payload.name;
    if (payload.group && !ledger.isSystemLedger) {
      ledger.group = payload.group === 'Equity' ? 'Capital' : payload.group;
    }
    ledger.updatedBy = userId;
    await ledger.save();
    await auditService.logSystem({
      companyId, userId, action: 'UPDATE', module: 'LedgerMaster',
      referenceId: ledger._id, before, after: ledger.toObject(),
    });
    return ledger;
  }

  async softDeleteLedger(companyId, ledgerId, userId = null) {
    const ledger = await LedgerMaster.findOne({ _id: ledgerId, companyId });
    if (!ledger) throw new Error('Ledger not found');
    if (ledger.isSystemLedger) throw new Error('System ledgers cannot be deleted');
    await ledger.softDelete(userId);
    await auditService.logSystem({
      companyId, userId, action: 'SOFT_DELETE', module: 'LedgerMaster',
      referenceId: ledger._id, before: { name: ledger.name },
    });
    return ledger;
  }

  async listLedgers(companyId, query = {}) {
    const filter = { companyId };
    if (query.group) {
      if (query.group === 'Equity') filter.group = { $in: ['Capital', 'Equity'] };
      else filter.group = query.group;
    }
    if (query.accountType) filter.accountType = query.accountType;
    if (query.accountGroupId) filter.accountGroupId = query.accountGroupId;
    if (query.partyId) filter.linkedPartyId = query.partyId;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };
    return LedgerMaster.find(filter).sort({ group: 1, name: 1 }).lean();
  }

  async getHierarchy(companyId) {
    const groups = await this.listGroups(companyId, { tree: true });
    const ledgers = await LedgerMaster.find({ companyId, isActive: true }).lean();
    const attach = (nodes) => nodes.map((n) => ({
      ...n,
      ledgers: ledgers.filter((l) => l.accountGroupId && l.accountGroupId.toString() === n._id.toString()),
      children: attach(n.children || []),
    }));
    return attach(groups);
  }

  async pipeline(companyId) {
    const [groupCount, ledgerCount, inactive] = await Promise.all([
      AccountGroup.countDocuments({ companyId }),
      LedgerMaster.countDocuments({ companyId }),
      LedgerMaster.countDocuments({ companyId, isActive: false }),
    ]);
    return {
      groups: groupCount,
      ledgers: ledgerCount,
      inactiveLedgers: inactive,
      seeded: groupCount >= DEFAULT_GROUPS.length,
    };
  }
}

module.exports = new ChartOfAccountsService();
module.exports.SYSTEM_LEDGERS = SYSTEM_LEDGERS;
module.exports.DEFAULT_GROUPS = DEFAULT_GROUPS;
