/**
 * testBusinessFlow.js
 * Comprehensive integration test script to validate the complete ERP Business Flow.
 * 
 * Flow:
 * 1. Setup clean test company ("Test Business Flow Corp") & test user.
 * 2. Seed system ledgers.
 * 3. Create items (Grey Fabric, Finished Fabric) and parties (Supplier, Customer, Job Worker).
 * 4. Purchase 1000m Grey Fabric @ ₹50 + 5% GST.
 * 5. Issue 600m Grey Fabric to Job Worker for Dyeing/Printing.
 * 6. Receive 580m Finished Fabric from Job Worker, with 10m wastage and 10m production loss.
 *    Pay Job Work Charges @ ₹5/meter + 5% GST.
 * 7. Sells 300m Finished Fabric to Customer @ ₹120 + 5% GST.
 * 8. Verify Trial Balance (debits = credits = ₹93,845) and specific ledger accounts.
 * 9. Verify GSTR-1 and GSTR-2 reporting.
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software';

async function run() {
  try {
    console.log('Starting Business Flow Integration Test...');
    console.log('Connecting to MongoDB at:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Drop old indexes if non-sparse or non-compound unique constraints are active on DB
    const dropIndexSafely = async (coll, name) => {
      try {
        await mongoose.connection.db.collection(coll).dropIndex(name);
        console.log(`✅ Dropped index ${name} from ${coll}`);
      } catch (err) {
        // Ignore if index doesn't exist
      }
    };
    await dropIndexSafely('companies', 'licenseKey_1');
    await dropIndexSafely('accountingentries', 'entryNo_1');
    await dropIndexSafely('paymentvouchers', 'voucherNo_1');
    await dropIndexSafely('jobs', 'jobCardNo_1');
    await dropIndexSafely('inventorylots', 'lotId_1');

    // 1. CLEANUP & SETUP
    const User = require('./models/User');
    const Company = require('./models/Company');
    const Plan = require('./models/Plan');
    const Subscription = require('./models/Subscription');
    const License = require('./models/License');
    const Item = require('./models/Item');
    const Party = require('./models/Party');
    const InventoryLot = require('./models/InventoryLot');
    const StockMovement = require('./models/StockMovement');
    const AccountingEntry = require('./models/AccountingEntry');
    const LedgerMaster = require('./models/LedgerMaster');
    const Job = require('./models/Job');
    const Sales = require('./models/Sales');
    const Purchase = require('./models/Purchase');
    const PaymentVoucher = require('./models/PaymentVoucher');

    const testEmail = 'testflow@textileerp.com';
    const existingUser = await User.findOne({ email: testEmail });
    let companyId;

    if (existingUser) {
      companyId = existingUser.companyId;
      console.log(`Cleaning up existing test company data for companyId: ${companyId}`);
      await Sales.deleteMany({ companyId });
      await Purchase.deleteMany({ companyId });
      await Job.deleteMany({ companyId });
      await InventoryLot.deleteMany({ companyId });
      await StockMovement.deleteMany({ companyId });
      await AccountingEntry.deleteMany({ companyId });
      await LedgerMaster.deleteMany({ companyId });
      await Party.deleteMany({ companyId });
      await Item.deleteMany({ companyId });
      await PaymentVoucher.deleteMany({ companyId });
      await Company.deleteOne({ _id: companyId });
      await Subscription.deleteMany({ companyId });
      await License.deleteMany({ companyId });
      await User.deleteOne({ _id: existingUser._id });
      console.log('✅ Cleanup completed');
    }

    // Ensure Pro plan exists
    let proPlan = await Plan.findOne({ name: 'Pro' });
    if (!proPlan) {
      proPlan = await Plan.create({
        name: 'Pro',
        priceMonthly: 2999,
        priceYearly: 29999,
        features: {
          modules: { purchase: true, inventory: true, sales: true, jobWork: true, accounting: true, gst: true, reports: true },
          fields: { purchase: { broker: true, lrNo: true }, sales: { bale: true, weight: true, challan: true } }
        },
        limits: { users: 10, invoicesPerMonth: 5000, storageMb: 5120 }
      });
      console.log('✅ Pro Plan created');
    }

    // Register User & Company
    const authService = require('./services/auth.service');
    const registerResult = await authService.register(
      'Test Flow User',
      testEmail,
      'TestFlowPassword123',
      'Test Business Flow Corp'
    );
    companyId = registerResult.user.companyId;
    console.log(`✅ Test User registered. Company ID: ${companyId}`);

    // Upgrade to Pro plan
    await Company.findByIdAndUpdate(companyId, { planId: proPlan._id });
    console.log('✅ Upgraded test company to Pro plan');

    // Ensure system ledgers are seeded
    const accountingService = require('./services/accountingService');
    await accountingService.seedSystemLedgers(companyId);
    console.log('✅ Seeded system ledgers');

    // 2. MASTER DATA CREATION (ITEMS & PARTIES)
    const greyFabricItem = await Item.create({
      name: 'Grey Fabric 40x40',
      category: 'Grey',
      hsnCode: '5208',
      gstRate: 5,
      unit: 'MTRS',
      purchaseRate: 50,
      salesRate: 0,
      companyId
    });

    const finishedFabricItem = await Item.create({
      name: 'Finished Printed Satin',
      category: 'Finished',
      hsnCode: '5208',
      gstRate: 5,
      unit: 'MTRS',
      purchaseRate: 0,
      salesRate: 120,
      companyId
    });
    console.log('✅ Master items created');

    const supplier = await Party.create({
      name: 'Supplier A Ltd',
      type: 'Supplier',
      gstin: '24ABCDE1234F1Z5',
      mobile: '9876543210',
      address: '123 Supplier St',
      city: 'Ahmedabad',
      state: 'Gujarat',
      companyId
    });

    const customer = await Party.create({
      name: 'Customer B Corp',
      type: 'Customer',
      gstin: '24BCDEF5678G2Z6',
      mobile: '9876543211',
      address: '456 Customer Ave',
      city: 'Surat',
      state: 'Gujarat',
      companyId
    });

    const jobWorker = await Party.create({
      name: 'Mill C Dyeing & Printing',
      type: 'Job Worker',
      gstin: '24CDEFG9012H3Z7',
      mobile: '9876543212',
      address: '789 Processing Zone',
      city: 'Surat',
      state: 'Gujarat',
      companyId
    });
    console.log('✅ Master parties created');

    // 3. TRANSACTION 1: PURCHASE BILL FLOW
    console.log('\n--- Step 1: Processing Purchase Bill ---');
    const purchaseService = require('./services/purchaseService');
    const purchasePayload = {
      companyId,
      supplierId: supplier._id,
      invoiceNo: 'PUR-TEST-001',
      date: new Date(),
      items: [{
        itemId: greyFabricItem._id,
        pcs: 10,
        mts: 1000,
        rate: 50,
        amount: 50000,
        gstPer: 5,
        gstAmt: 2500
      }],
      taxableAmount: 50000,
      gstType: 'CGST+SGST',
      cgst: 1250,
      sgst: 1250,
      igst: 0,
      gstAmount: 2500,
      netAmount: 52500,
      status: 'active'
    };

    const purchaseResult = await purchaseService.createPurchase(purchasePayload);
    console.log('Purchase saved with Voucher Invoice No:', purchaseResult.invoiceNo);

    // Verify inventory lot
    const lotId = purchaseResult.items[0].lotId;
    if (!lotId) throw new Error('Lot ID was not generated for purchase item');
    const lot = await InventoryLot.findOne({ lotId, companyId });
    if (!lot) throw new Error(`Inventory Lot was not created for Lot ID: ${lotId}`);
    console.log(`Verified inventory lot: ${lot.lotId}, Quantity: ${lot.totalMtrs} meters, Status: ${lot.status}`);
    if (lot.remainingMtrs !== 1000 || lot.status !== 'Available') {
      throw new Error(`Inventory lot validation failed: remaining=${lot.remainingMtrs}, status=${lot.status}`);
    }

    // Verify stock movement
    const purchaseMovement = await StockMovement.findOne({ lotId: lot._id, type: 'PURCHASE', companyId });
    if (!purchaseMovement || purchaseMovement.qtyMtrs !== 1000) {
      throw new Error(`StockMovement incorrect: qty=${purchaseMovement?.qtyMtrs}`);
    }
    console.log('Verified stock movement for Purchase');

    // Verify accounting entry
    const purchaseEntry = await AccountingEntry.findById(purchaseResult.accountingEntryId);
    if (!purchaseEntry || purchaseEntry.totalDebit !== 52500 || purchaseEntry.totalCredit !== 52500) {
      throw new Error('Accounting entry for purchase incorrect or unbalanced');
    }
    const supplierLedger = await LedgerMaster.findOne({ linkedPartyId: supplier._id, companyId });
    if (!supplierLedger) throw new Error('Supplier Ledger master not created');
    const crLine = purchaseEntry.lines.find(l => l.ledgerId.toString() === supplierLedger._id.toString());
    if (!crLine || crLine.type !== 'Cr' || crLine.amount !== 52500) {
      throw new Error('Purchase entry is missing correct credit posting to Supplier');
    }
    console.log('Verified Purchase Accounting entry successfully');

    // 4. TRANSACTION 2: MILL ISSUE (JOB WORK ISSUE) FLOW
    console.log('\n--- Step 2: Processing Mill Issue ---');
    const jobService = require('./services/jobService');
    const issuePayload = {
      lotId: lot._id,
      itemId: greyFabricItem._id,
      workerId: jobWorker._id,
      issueQty: 600,
      issuePcs: 6,
      chargesRate: 5,
      processType: 'Dyeing',
      companyId,
      date: new Date(),
      jobCardNo: 'AUTO'
    };

    const jobIssueResult = await jobService.issueToJob(issuePayload);
    console.log('Mill Issue saved with Job Card No:', jobIssueResult.jobCardNo);

    // Verify original lot reduction
    const lotAfterIssue = await InventoryLot.findById(lot._id);
    console.log(`Original lot remaining after issue: ${lotAfterIssue.remainingMtrs} meters, remaining pieces: ${lotAfterIssue.remainingPcs}`);
    if (lotAfterIssue.remainingMtrs !== 400 || lotAfterIssue.remainingPcs !== 4) {
      throw new Error(`Original lot quantity did not reduce correctly: ${lotAfterIssue.remainingMtrs}m, ${lotAfterIssue.remainingPcs}pcs`);
    }

    // Verify StockMovement ISSUE
    const issueMovement = await StockMovement.findOne({ lotId: lot._id, type: 'ISSUE', companyId });
    if (!issueMovement || issueMovement.qtyMtrs !== -600) {
      throw new Error('StockMovement for Job Issue incorrect or missing');
    }
    console.log('Verified StockMovement for Mill Issue');

    // 5. TRANSACTION 3: MILL RECEIVE (JOB WORK RECEIVE) FLOW
    console.log('\n--- Step 3: Processing Mill Receive ---');
    const receivePayload = {
      jobId: jobIssueResult._id,
      receivedQty: 580,
      receivedPcs: 6,
      wastage: 10, // Abnormal wastage
      charges: 2900, // 580 meters * ₹5
      gstAmount: 145, // 5% GST
      companyId
    };

    const jobReceiveResult = await jobService.receiveFromJob(receivePayload);
    console.log('Job Receive processed successfully');

    // Verify finished inventory lot
    const finishedLot = await InventoryLot.findById(jobReceiveResult.newLot._id);
    if (!finishedLot || finishedLot.totalMtrs !== 580 || finishedLot.status !== 'Available') {
      throw new Error(`Finished lot creation failed: total=${finishedLot?.totalMtrs}, status=${finishedLot?.status}`);
    }
    console.log(`Verified finished lot created: ${finishedLot.lotId}, Quantity: ${finishedLot.totalMtrs} meters`);

    // Verify StockMovement RECEIVE
    const receiveMovement = await StockMovement.findOne({ lotId: finishedLot._id, type: 'RECEIVE', companyId });
    if (!receiveMovement || receiveMovement.qtyMtrs !== 580) {
      throw new Error('StockMovement for Job Receive incorrect or missing');
    }
    console.log('Verified StockMovement for Mill Receive');

    // Verify job work charges accounting entry
    const jobWorkEntry = await AccountingEntry.findOne({ refType: 'JobReceive', refId: jobIssueResult._id, companyId });
    if (!jobWorkEntry || jobWorkEntry.totalDebit !== 3045) {
      throw new Error(`Job work charges accounting entry missing or incorrect: Dr=${jobWorkEntry?.totalDebit}`);
    }
    const millLedger = await LedgerMaster.findOne({ linkedPartyId: jobWorker._id, companyId });
    if (!millLedger) throw new Error('Mill Ledger master not created');
    const millCrLine = jobWorkEntry.lines.find(l => l.ledgerId.toString() === millLedger._id.toString());
    if (!millCrLine || millCrLine.type !== 'Cr' || millCrLine.amount !== 3045) {
      throw new Error('Job work entry is missing correct credit posting to Mill');
    }
    console.log('Verified Job Work Charges accounting entry successfully');

    // Verify abnormal wastage accounting entry (10m * ₹50 purchase cost = ₹500)
    const wastageEntry = await AccountingEntry.findOne({ refType: 'Journal', refId: jobIssueResult._id, voucherType: 'WastageAuto', companyId });
    if (!wastageEntry || wastageEntry.totalDebit !== 500) {
      throw new Error(`Abnormal wastage accounting entry missing or incorrect: Dr=${wastageEntry?.totalDebit}`);
    }
    const lossLine = wastageEntry.lines.find(l => l.ledgerName === 'Production Loss A/c');
    const stockLine = wastageEntry.lines.find(l => l.ledgerName === 'Stock A/c');
    if (!lossLine || lossLine.amount !== 500 || !stockLine || stockLine.amount !== 500) {
      throw new Error('Abnormal wastage double entry lines incorrect');
    }
    console.log('Verified Abnormal Wastage accounting entry successfully');

    // 6. TRANSACTION 4: SALES INVOICE FLOW
    console.log('\n--- Step 4: Processing Sales Invoice ---');
    const salesService = require('./services/salesService');
    const salesPayload = {
      companyId,
      customerId: customer._id,
      invoiceNo: 'SAL-TEST-001',
      date: new Date(),
      items: [{
        itemId: finishedFabricItem._id,
        lotId: finishedLot._id,
        pcs: 3,
        mts: 300,
        rate: 120,
        amount: 36000
      }],
      taxableAmount: 36000,
      gstType: 'CGST+SGST',
      cgst: 900,
      sgst: 900,
      igst: 0,
      gstAmount: 1800,
      netAmount: 37800,
      status: 'active'
    };

    const salesResult = await salesService.createInvoice(salesPayload);
    console.log('Sales Invoice saved with Invoice No:', salesResult.invoiceNo);

    // Verify finished lot reduction
    const finishedLotAfterSale = await InventoryLot.findById(finishedLot._id);
    console.log(`Finished lot remaining after sale: ${finishedLotAfterSale.remainingMtrs} meters, remaining pieces: ${finishedLotAfterSale.remainingPcs}`);
    if (finishedLotAfterSale.remainingMtrs !== 280 || finishedLotAfterSale.remainingPcs !== 3) {
      throw new Error(`Finished lot quantity did not reduce correctly: ${finishedLotAfterSale.remainingMtrs}m, ${finishedLotAfterSale.remainingPcs}pcs`);
    }

    // Verify StockMovement SALE
    const saleMovement = await StockMovement.findOne({ lotId: finishedLot._id, type: 'SALE', companyId });
    if (!saleMovement || saleMovement.qtyMtrs !== -300) {
      throw new Error('StockMovement for Sale incorrect or missing');
    }
    console.log('Verified StockMovement for Sale');

    // Verify Sales accounting entry
    const salesEntry = await AccountingEntry.findById(salesResult.accountingEntryId);
    if (!salesEntry || salesEntry.totalDebit !== 37800) {
      throw new Error('Accounting entry for sale incorrect or unbalanced');
    }
    const customerLedger = await LedgerMaster.findOne({ linkedPartyId: customer._id, companyId });
    if (!customerLedger) throw new Error('Customer Ledger master not created');
    const customerDrLine = salesEntry.lines.find(l => l.ledgerId.toString() === customerLedger._id.toString());
    if (!customerDrLine || customerDrLine.type !== 'Dr' || customerDrLine.amount !== 37800) {
      throw new Error('Sales entry is missing correct debit posting to Customer');
    }
    console.log('Verified Sales Accounting entry successfully');

    // 7. COMPLIANCE & REPORTS VERIFICATION
    console.log('\n--- Step 5: Verifying Reports ---');

    // Trial Balance
    const accountingController = require('./controllers/accountingController');
    let trialBalanceData;
    const reqTB = { companyId, query: {} };
    const resTB = {
      status: () => ({
        json: (res) => { trialBalanceData = res.data; }
      })
    };
    await accountingController.getTrialBalance(reqTB, resTB);

    let totalDr = 0;
    let totalCr = 0;
    trialBalanceData.forEach(tb => {
      if (tb.type === 'Dr') totalDr += tb.balance;
      else totalCr += tb.balance;
    });

    console.log(`Trial Balance Total Dr: ₹${totalDr.toFixed(2)}, Cr: ₹${totalCr.toFixed(2)}`);
    if (Math.abs(totalDr - totalCr) > 0.01) {
      throw new Error(`Trial Balance is not balancing! Dr=${totalDr}, Cr=${totalCr}`);
    }
    if (Math.round(totalDr) !== 93845) {
      throw new Error(`Trial Balance sum incorrect. Expected ₹93845, got ₹${totalDr}`);
    }

    const assertLedger = (name, val, type) => {
      const row = trialBalanceData.find(tb => tb.ledger.name === name);
      if (!row) throw new Error(`Ledger not found in TB: ${name}`);
      if (Math.abs(row.balance - val) > 0.01 || row.type !== type) {
        throw new Error(`Ledger balance mismatch for ${name}: Expected ${val} ${type}, got ${row.balance} ${row.type}`);
      }
      console.log(`Verified Ledger: ${name.padEnd(25)} | Balance: ₹${row.balance.toFixed(2).padStart(8)} [${row.type}]`);
    };

    assertLedger('Purchase A/c', 50000, 'Dr');
    assertLedger('Sales A/c', 36000, 'Cr');
    assertLedger('CGST Input', 1322.50, 'Dr'); // 1250 from purchase + 72.50 from jobwork
    assertLedger('SGST Input', 1322.50, 'Dr'); // 1250 from purchase + 72.50 from jobwork
    assertLedger('CGST Output', 900, 'Cr');   // 900 from sales
    assertLedger('SGST Output', 900, 'Cr');   // 900 from sales
    assertLedger('Job Work Charges', 2900, 'Dr');
    assertLedger('Production Loss A/c', 500, 'Dr');
    assertLedger('Stock A/c', 500, 'Cr');
    assertLedger('Supplier A Ltd', 52500, 'Cr');
    assertLedger('Customer B Corp', 37800, 'Dr');
    assertLedger('Mill C Dyeing & Printing', 3045, 'Cr');
    console.log('✅ Trial Balance validation successful');

    // GSTR-1 Verification
    const gstController = require('./controllers/gstController');
    let gstr1Data;
    const reqG1 = { companyId, query: {} };
    const resG1 = {
      status: () => ({
        json: (res) => { gstr1Data = res.data; }
      })
    };
    await gstController.getGstr1(reqG1, resG1);

    if (!gstr1Data || gstr1Data.b2b.length !== 1) {
      throw new Error('GSTR-1 report validation failed: B2B list should contain exactly 1 entry');
    }
    const b2bRow = gstr1Data.b2b[0];
    if (b2bRow.inum !== 'SAL-TEST-001' || b2bRow.txval !== 36000 || b2bRow.camt !== 900 || b2bRow.samt !== 900) {
      throw new Error('GSTR-1 invoice data values mismatch');
    }
    console.log('✅ GSTR-1 report validation successful');

    // GSTR-2 Verification
    let gstr2Data;
    const reqG2 = { companyId, query: {} };
    const resG2 = {
      status: () => ({
        json: (res) => { gstr2Data = res.data; }
      })
    };
    await gstController.getGstr2(reqG2, resG2);

    if (!gstr2Data || gstr2Data.length !== 1) {
      throw new Error('GSTR-2 report validation failed: list should contain exactly 1 entry');
    }
    const g2Row = gstr2Data[0];
    if (g2Row.invoiceNo !== 'PUR-TEST-001' || g2Row.taxable !== 50000 || g2Row.cgst !== 1250 || g2Row.sgst !== 1250) {
      throw new Error('GSTR-2 invoice data values mismatch');
    }
    console.log('✅ GSTR-2 report validation successful');

    console.log('\n==========================================');
    console.log('🎉 ALL BUSINESS FLOW INTEGRATION TESTS PASSED!');
    console.log('==========================================');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ INTEGRATION TEST FAILED:', err);
    try {
      await mongoose.connection.close();
    } catch (_) {}
    process.exit(1);
  }
}

run();
