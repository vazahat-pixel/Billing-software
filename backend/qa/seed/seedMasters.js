const FinancialYear = require('../../models/FinancialYear');
const Warehouse = require('../../models/Warehouse');
const SubMaster = require('../../models/SubMaster');
const HsnMaster = require('../../models/HsnMaster');
const Party = require('../../models/Party');
const CompanySettings = require('../../models/CompanySettings');
const GstConfig = require('../../models/GstConfig');
const VoucherSeries = require('../../models/VoucherSeries');
const { resolveCompanyId } = require('../utils/tenant');
const { partyName, gstinForState, pick, STATES } = require('../utils/faker');
const gstConfigService = require('../../services/gstConfigService');
const logger = require('../utils/logger');

const PARTY_TYPES = [
  { type: 'Supplier', count: 8 },
  { type: 'Customer', count: 8 },
  { type: 'Broker', count: 3 },
  { type: 'Transport', count: 2 },
  { type: 'Job Worker', count: 5 },
  { type: 'Employee', count: 4 },
];

const SUBMASTER_TYPES = [
  { type: 'Unit', values: ['MTRS', 'PCS', 'KG', 'ROLL'] },
  { type: 'ItemGroup', values: ['Grey Fabric', 'Finished Fabric', 'Yarn', 'Accessories'] },
  { type: 'Process', values: ['Printing', 'Dyeing', 'Embroidery', 'Packing', 'Mill Issue', 'Mill Receive'] },
  { type: 'PaymentTerms', values: ['Net 15', 'Net 30', 'Net 45', 'Advance'] },
];

const HSN_ROWS = [
  { code: '5208', description: 'Woven cotton grey fabric', gstRate: 5 },
  { code: '5407', description: 'Synthetic woven fabric', gstRate: 5 },
  { code: '6204', description: 'Finished garments', gstRate: 12 },
  { code: '5509', description: 'Yarn of synthetic staple', gstRate: 5 },
];

async function upsertFinancialYear(companyId) {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const code = `${startYear}-${String(startYear + 1).slice(-2)}`;
  const startDate = new Date(startYear, 3, 1);
  const endDate = new Date(startYear + 1, 2, 31, 23, 59, 59);

  await FinancialYear.updateOne(
    { companyId, code },
    {
      $set: {
        label: `FY ${code}`,
        startDate,
        endDate,
        isActive: true,
        isLocked: false,
        isClosed: false,
      },
    },
    { upsert: true }
  );
  return { code, startDate, endDate };
}

async function seedWarehouses(companyId) {
  const wh = await Warehouse.findOneAndUpdate(
    { companyId, code: 'MAIN' },
    { name: 'Main Warehouse', type: 'Warehouse', isDefault: true, status: 'Active' },
    { upsert: true, new: true }
  );
  const godown = await Warehouse.findOneAndUpdate(
    { companyId, code: 'GD-A' },
    { name: 'Godown A', type: 'Godown', parentId: wh._id, status: 'Active' },
    { upsert: true, new: true }
  );
  await Warehouse.findOneAndUpdate(
    { companyId, code: 'RACK-01' },
    { name: 'Rack 01', type: 'Rack', parentId: godown._id, status: 'Active' },
    { upsert: true, new: true }
  );
  return { warehouseId: wh._id, godownId: godown._id };
}

async function seedSubMasters(companyId) {
  const groups = {};
  for (const block of SUBMASTER_TYPES) {
    for (const value of block.values) {
      const doc = await SubMaster.findOneAndUpdate(
        { companyId, type: block.type, name: value },
        { name: value, type: block.type },
        { upsert: true, new: true }
      );
      if (block.type === 'ItemGroup') groups[value] = doc._id;
    }
  }
  return groups;
}

async function seedHsn(companyId) {
  for (const row of HSN_ROWS) {
    await HsnMaster.updateOne(
      { companyId, code: row.code, type: 'HSN' },
      { $set: { description: row.description, gstRate: row.gstRate, isActive: true } },
      { upsert: true }
    );
  }
}

async function seedParties(companyId) {
  const parties = { suppliers: [], customers: [], jobWorkers: [], brokers: [], transporters: [] };
  let seq = 1;
  for (const block of PARTY_TYPES) {
    for (let i = 1; i <= block.count; i += 1) {
      const state = pick(STATES);
      const name = partyName(block.type, seq);
      const gstin = gstinForState(state.name, seq);
      const doc = await Party.findOneAndUpdate(
        { companyId, name },
        {
          type: block.type,
          gstin,
          state: state.name,
          stateCode: state.code,
          city: 'Surat',
          address: 'QA Address Line',
          mobile: `98${String(seq).padStart(8, '0')}`,
          creditLimit: block.type === 'Customer' ? 500000 : 0,
        },
        { upsert: true, new: true }
      );
      if (block.type === 'Supplier') parties.suppliers.push(doc);
      if (block.type === 'Customer') parties.customers.push(doc);
      if (block.type === 'Job Worker') parties.jobWorkers.push(doc);
      if (block.type === 'Broker') parties.brokers.push(doc);
      if (block.type === 'Transport') parties.transporters.push(doc);
      seq += 1;
    }
  }
  return parties;
}

async function seedVoucherSeries(companyId, fyCode) {
  const yearCode = fyCode || `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`;
  const modules = [
    { module: 'purchase', prefix: 'PUR' },
    { module: 'sales', prefix: 'INV' },
    { module: 'payment', prefix: 'PV' },
    { module: 'receipt', prefix: 'RV' },
    { module: 'journal', prefix: 'JNL' },
  ];
  for (const row of modules) {
    await VoucherSeries.updateOne(
      { companyId, module: row.module, prefix: row.prefix, financialYearCode: yearCode },
      {
        $setOnInsert: {
          name: `QA ${row.module} series`,
          padLength: 4,
          isDefault: true,
          status: 'Active',
        },
      },
      { upsert: true }
    );
  }
}

async function seedCompanyMeta(companyId) {
  await CompanySettings.findOneAndUpdate(
    { companyId },
    { $setOnInsert: { legalName: 'QA Textile Mills Pvt Ltd', gstRegistered: true } },
    { upsert: true }
  );
  await gstConfigService.getOrCreate(companyId);
  await GstConfig.updateOne(
    { companyId },
    {
      $set: {
        gstin: '24AAAAA0000A1Z5',
        stateCode: '24',
        registrationType: 'Regular',
        isActive: true,
      },
    }
  );
}

async function seedMasters(ctx) {
  const companyId = await resolveCompanyId(ctx);
  logger.info('Seeding masters', { companyId: String(companyId) });

  const fy = await upsertFinancialYear(companyId);
  const warehouses = await seedWarehouses(companyId);
  const itemGroups = await seedSubMasters(companyId);
  await seedHsn(companyId);
  const parties = await seedParties(companyId);
  await seedVoucherSeries(companyId, fy.code);
  await seedCompanyMeta(companyId);

  ctx.masters = {
    ...ctx.masters,
    companyId,
    fy,
    warehouses,
    itemGroups,
    parties,
  };

  return ctx.masters;
}

module.exports = { seedMasters };
