/**
 * Boots the real API against an ISOLATED in-memory MongoDB, seeded with a minimal but
 * realistic dataset, so the browser suite can drive the actual UI end to end.
 *
 * Production safety:
 *   - MONGO_URI is overwritten with the in-memory URI BEFORE the app is required
 *   - the production guard in tests/helpers/memoryDb.js still runs and will throw if the
 *     target ever looks like a real database
 *   - nothing here reads or writes the configured Atlas cluster
 *
 * Usage:  node scripts/testServer.js        (listens on TEST_PORT, default 5099)
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';

const path = require('path');
const { startMemoryDb, assertNotProduction } = require(path.join(__dirname, '..', 'tests', 'helpers', 'memoryDb'));

const TEST_PORT = Number(process.env.TEST_PORT || 5099);

async function seed() {
  const mongoose = require('mongoose');
  const Plan = require('../models/Plan');
  const User = require('../models/User');
  const Company = require('../models/Company');
  const FinancialYear = require('../models/FinancialYear');
  const Party = require('../models/Party');
  const LedgerMaster = require('../models/LedgerMaster');
  const Sales = require('../models/Sales');
  const Purchase = require('../models/Purchase');
  const Book = require('../models/Book');

  const ownerId = new mongoose.Types.ObjectId();

  // 'Pro' unlocks every module gate — the browser suite needs all screens reachable.
  const plan = await Plan.create({ name: 'Pro', priceMonthly: 0, priceYearly: 0 });

  const company = await Company.create({
    name: 'TEST TEXTILES PVT LTD', ownerId, planId: plan._id, status: 'active',
  });
  const companyId = company._id;

  const user = await User.create({
    name: 'Test Operator',
    email: 'test@erp.local',
    password: 'Test@12345',
    role: 'user',
    companyId,
    isActive: true,
  });
  await Company.updateOne({ _id: companyId }, { ownerId: user._id });

  await FinancialYear.create({
    companyId, code: '26-27',
    startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'),
    isActive: true,
  });

  // Chart of accounts — real Cash/Bank ledgers so the book filters have something to find.
  const [bankLedger, cashLedger] = await LedgerMaster.create([
    { companyId, name: 'HDFC BANK', group: 'Assets', subGroup: 'Cash & Bank', accountType: 'Bank', nature: 'Dr' },
    { companyId, name: 'CASH BOOK', group: 'Assets', subGroup: 'Cash & Bank', accountType: 'Cash', nature: 'Dr' },
  ]);
  await LedgerMaster.create([
    { companyId, name: 'Sales A/c', group: 'Income', subGroup: 'Direct Income', accountType: 'System', nature: 'Cr' },
    { companyId, name: 'Sales Return A/c', group: 'Income', subGroup: 'Direct Income', accountType: 'System', nature: 'Cr' },
    { companyId, name: 'Purchase A/c', group: 'Expenses', subGroup: 'Direct Expenses', accountType: 'System', nature: 'Dr' },
    { companyId, name: 'Purchase Return A/c', group: 'Expenses', subGroup: 'Direct Expenses', accountType: 'System', nature: 'Cr' },
    { companyId, name: 'CGST Output', group: 'Liabilities', subGroup: 'Tax', accountType: 'Tax', nature: 'Cr' },
    { companyId, name: 'SGST Output', group: 'Liabilities', subGroup: 'Tax', accountType: 'Tax', nature: 'Cr' },
    { companyId, name: 'CGST Input', group: 'Assets', subGroup: 'Tax', accountType: 'Tax', nature: 'Dr' },
    { companyId, name: 'SGST Input', group: 'Assets', subGroup: 'Tax', accountType: 'Tax', nature: 'Dr' },
    { companyId, name: 'Round Off', group: 'Expenses', subGroup: 'Indirect Expenses', accountType: 'System', nature: 'Dr' },
    { companyId, name: 'TDS Payable', group: 'Liabilities', subGroup: 'Current Liabilities', accountType: 'Tax', nature: 'Cr' },
    { companyId, name: 'TDS Receivable', group: 'Assets', subGroup: 'Current Assets', accountType: 'Tax', nature: 'Dr' },
  ]);

  await Book.create([
    { companyId, name: 'HDFC BANK', code: 'BNK1', module: 'receipt', bookType: 'BANK BOOK' },
    { companyId, name: 'CASH BOOK', code: 'CSH1', module: 'receipt', bookType: 'CASH BOOK' },
    { companyId, name: 'SALES BOOK', code: 'SLS1', module: 'sales', bookType: 'SALES BOOK' },
  ]);

  const customer = await Party.create({
    companyId, name: 'RAJA TEX', type: 'Customer', state: 'Gujarat',
    gstin: '24AAAAA0000A1Z5', address: '12 Ring Road, Surat', city: 'Surat', mobile: '9900011122',
  });
  const supplier = await Party.create({
    companyId, name: 'MAHESH TEX', type: 'Supplier', state: 'Gujarat',
    gstin: '24BBBBB1111B1Z6', address: '48 Mill Compound, Surat', city: 'Surat', mobile: '9900033344',
  });

  const mkSale = (invoiceNo, netAmount, date) => ({
    companyId, customerId: customer._id, invoiceNo, date: new Date(date),
    taxableAmount: netAmount, gstAmount: 0, netAmount, paidAmount: 0, status: 'active',
  });

  // Three bills so the browser can see UNPAID / PART PAID / FULLY PAID side by side.
  const sales = await Sales.create([
    mkSale('S-UNPAID', 100000, '2026-06-05'),
    mkSale('S-PART', 50000, '2026-06-12'),
    mkSale('S-FULL', 25000, '2026-06-20'),
  ]);

  const purchase = await Purchase.create({
    companyId, supplierId: supplier._id, invoiceNo: 'P-001', date: new Date('2026-06-08'),
    taxableAmount: 80000, gstAmount: 0, netAmount: 80000, paidAmount: 0, status: 'active',
  });

  return {
    companyId: String(companyId),
    userEmail: 'test@erp.local',
    userPassword: 'Test@12345',
    customerId: String(customer._id),
    supplierId: String(supplier._id),
    bankLedgerId: String(bankLedger._id),
    cashLedgerId: String(cashLedger._id),
    salesIds: sales.map((s) => String(s._id)),
    purchaseId: String(purchase._id),
  };
}

(async () => {
  const uri = await startMemoryDb();
  assertNotProduction(uri);
  assertNotProduction(process.env.MONGO_URI);

  const info = await seed();

  // Require the app only AFTER MONGO_URI points at the sandbox.
  const app = require('../server');
  app.listen(TEST_PORT, () => {
    console.log('TEST_SERVER_READY ' + JSON.stringify({ port: TEST_PORT, uri, ...info }));
  });
})().catch((err) => {
  console.error('TEST_SERVER_FAILED', err);
  process.exit(1);
});
