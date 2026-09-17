/**
 * Full ERP demo seed — masters + purchases + job work + sales + payments/receipts.
 *
 * Usage:
 *   cd backend
 *   npm run seed:demo
 *
 * Login after seed:
 *   qa.dev.admin@textileerp.dev / Admin@123
 *   user@textileerp.com / User@123
 *   admin@textileerp.com / Admin@123  (super admin)
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { QaContext } = require('../qa/context');
const { seedAll } = require('../qa/seed/seedAll');
const { simulateBusinessFlow } = require('../qa/simulator/businessFlowSimulator');
const { getOrCreateQaTenant } = require('../qa/utils/tenant');
const { gstinForState } = require('../qa/utils/faker');
const { warnIfSharedLiveDatabase } = require('../utils/mongoSafety');

async function upsertLogin(email, password, fields) {
  const User = require('../models/User');
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, password, ...fields, isActive: true });
  } else {
    Object.assign(user, fields);
    user.isActive = true;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.password = password;
  }
  await user.save();
  return user;
}

async function printCoverage(companyId) {
  const Party = require('../models/Party');
  const Item = require('../models/Item');
  const Purchase = require('../models/Purchase');
  const Sales = require('../models/Sales');
  const Job = require('../models/Job');
  const PaymentVoucher = require('../models/PaymentVoucher');
  const InventoryLot = require('../models/InventoryLot');
  const AccountingEntry = require('../models/AccountingEntry');
  const LedgerMaster = require('../models/LedgerMaster');
  const Warehouse = require('../models/Warehouse');
  const CompanySettings = require('../models/CompanySettings');

  const [
    suppliers,
    customers,
    jobWorkers,
    items,
    purchases,
    sales,
    jobs,
    payments,
    receipts,
    lots,
    entries,
    ledgers,
    warehouses,
    settings,
  ] = await Promise.all([
    Party.countDocuments({ companyId, type: { $in: ['Supplier', 'Both'] } }),
    Party.countDocuments({ companyId, type: { $in: ['Customer', 'Both'] } }),
    Party.countDocuments({ companyId, type: 'Job Worker' }),
    Item.countDocuments({ companyId }),
    Purchase.countDocuments({ companyId }),
    Sales.countDocuments({ companyId }),
    Job.countDocuments({ companyId }),
    PaymentVoucher.countDocuments({ companyId, voucherType: 'Payment' }),
    PaymentVoucher.countDocuments({ companyId, voucherType: 'Receipt' }),
    InventoryLot.countDocuments({ companyId }),
    AccountingEntry.countDocuments({ companyId }),
    LedgerMaster.countDocuments({ companyId }),
    Warehouse.countDocuments({ companyId }),
    CompanySettings.findOne({ companyId }).lean(),
  ]);

  // voucherType enum may differ — fall back to total vouchers
  const vouchersTotal = await PaymentVoucher.countDocuments({ companyId });

  return {
    companyGstin: settings?.gstin || null,
    legalName: settings?.legalName || null,
    suppliers,
    customers,
    jobWorkers,
    items,
    purchases,
    sales,
    jobs,
    bankVouchers: vouchersTotal,
    payments,
    receipts,
    inventoryLots: lots,
    accountingEntries: entries,
    ledgers,
    warehouses,
  };
}

async function applyDemoIdentity(companyId) {
  const Company = require('../models/Company');
  const CompanySettings = require('../models/CompanySettings');
  const GstConfig = require('../models/GstConfig');
  const companyGstin = gstinForState('Gujarat', 77);
  await Company.findByIdAndUpdate(companyId, {
    name: 'Surat Demo Textile Mills Pvt Ltd',
    isQaTenant: true,
    qaProfile: 'demo',
    meta: {
      industry: 'Textile',
      state: 'Gujarat',
      gstin: companyGstin,
      city: 'Surat',
      address: 'Ring Road, Textile Market, Surat',
    },
  });
  await CompanySettings.findOneAndUpdate(
    { companyId },
    {
      $set: {
        legalName: 'Surat Demo Textile Mills Pvt Ltd',
        shortName: 'SDTM',
        gstin: companyGstin,
        pan: companyGstin.slice(2, 12),
        state: 'Gujarat',
        stateCode: '24',
        city: 'Surat',
        address: 'Ring Road, Textile Market, Surat',
        pincode: '395002',
        phone: '9825012345',
        email: 'accounts@suratdemo.textile',
        bankName: 'HDFC Bank',
        bankBranch: 'Ring Road Surat',
        accountNo: '50200012345678',
        ifsc: 'HDFC0001234',
        businessType: 'Textile',
        offlineModeEnabled: true,
        isActive: true,
        deletedAt: null,
      },
    },
    { upsert: true }
  );
  await GstConfig.findOneAndUpdate(
    { companyId },
    {
      $set: {
        gstin: companyGstin,
        stateCode: '24',
        stateName: 'Gujarat',
        registrationType: 'Regular',
        legalName: 'Surat Demo Textile Mills Pvt Ltd',
        tradeName: 'SDTM',
        isActive: true,
      },
    },
    { upsert: true }
  );
  return companyGstin;
}

async function main() {
  const profile = process.env.QA_PROFILE || 'demo';
  const ctx = new QaContext({ profile, args: {} });
  await ctx.connect();

  const warn = warnIfSharedLiveDatabase();
  if (warn) console.warn('[WARN]', warn);

  console.log('[seed:demo] ensuring demo tenant…');
  const tenant = await getOrCreateQaTenant(profile);
  ctx.companyId = tenant.companyId;
  ctx.userId = tenant.userId;

  // Identity BEFORE transactions so purchase/sales GST uses correct company GSTIN/state
  console.log('[seed:demo] applying company GSTIN / settings…');
  await applyDemoIdentity(ctx.companyId);

  console.log('[seed:demo] seeding masters + users + inventory…');
  await seedAll(ctx);
  await applyDemoIdentity(ctx.companyId);

  console.log('[seed:demo] simulating purchases / job work / sales / payments…');
  const sim = await simulateBusinessFlow(ctx);

  await applyDemoIdentity(ctx.companyId);

  // Stable ERP logins point at this demo company
  await upsertLogin('qa.dev.admin@textileerp.dev', process.env.QA_DEFAULT_PASSWORD || 'Admin@123', {
    name: 'Demo Admin',
    role: 'user',
    companyRole: 'admin',
    companyId: ctx.companyId,
  });
  await upsertLogin('user@textileerp.com', 'User@123', {
    name: 'Demo Owner',
    role: 'user',
    companyRole: 'owner',
    companyId: ctx.companyId,
  });
  await upsertLogin(process.env.ADMIN_EMAIL || 'admin@textileerp.com', process.env.ADMIN_PASSWORD || 'Admin@123', {
    name: 'Super Admin',
    role: 'super_admin',
    companyRole: 'owner',
    companyId: null,
  });

  const coverage = await printCoverage(ctx.companyId);
  console.log('\n========== DEMO SEED COMPLETE ==========');
  console.log('CompanyId:', String(ctx.companyId));
  console.log('Company:', coverage.legalName);
  console.log('Has GSTIN:', Boolean(coverage.companyGstin), coverage.companyGstin ? `(${String(coverage.companyGstin).slice(0, 2)}…${String(coverage.companyGstin).slice(-1)})` : '');
  console.log('Coverage:', {
    suppliers: coverage.suppliers,
    customers: coverage.customers,
    jobWorkers: coverage.jobWorkers,
    items: coverage.items,
    purchases: coverage.purchases,
    sales: coverage.sales,
    jobs: coverage.jobs,
    payments: coverage.payments,
    receipts: coverage.receipts,
    bankVouchers: coverage.bankVouchers,
    inventoryLots: coverage.inventoryLots,
    accountingEntries: coverage.accountingEntries,
    ledgers: coverage.ledgers,
    warehouses: coverage.warehouses,
  });
  console.log('Simulation steps:', (sim.steps || []).map((s) => `${s.name}:${s.success || 0}`).join(', '));
  console.log('\nLogin (ERP):');
  console.log('  qa.dev.admin@textileerp.dev / Admin@123');
  console.log('  user@textileerp.com / User@123');
  console.log('Login (Admin panel):');
  console.log('  admin@textileerp.com / Admin@123');
  console.log('========================================\n');

  await ctx.disconnect();
}

main().catch((err) => {
  console.error('[seed:demo] FAILED', err);
  process.exit(1);
});
