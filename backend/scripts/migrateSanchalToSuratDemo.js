/**
 * Standalone Migration Script: Safely Add All Sanchal Creation Masters into Surat Demo Textile Company.
 * 
 * Rules:
 * 1. Zero modifications to existing application files or business logic.
 * 2. Operates strictly on companyId: '6aaa80eab327c5ec12031bcc' (Surat Demo Textile Mills Pvt Ltd).
 * 3. Atomic execution wrapped in a multi-document ACID transaction.
 * 4. Pre-import backup taken to ./backend/backups/pre_sanchal_import_<timestamp>/.
 * 5. Full idempotency tracked in 'jsm_master_mappings' collection.
 * 6. Zero opening balances, transactions, or inventory stock movements imported.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TARGET_COMPANY_ID = new mongoose.Types.ObjectId('6aaa80eab327c5ec12031bcc');
const BATCH_ID = 'SANCHAL-MIGRATION-20261014';

// Sanchal Master Data Definitions extracted from SQL Server (SC27 & SCC28)
const SANCHAL_DATA = {
  units: [
    { sourceKey: 'SC27:1', name: 'PCS', quc: 'PCS-PIECES', action: 'REUSE', matchName: 'PCS' },
    { sourceKey: 'SC27:2', name: 'QTY', quc: 'MTR-METERS', action: 'REUSE', matchName: 'MTRS' },
    { sourceKey: 'SC27:3', name: 'KGS', quc: 'KGS-KILOGRAMS', action: 'REUSE', matchName: 'KG' },
    { sourceKey: 'SC27:101', name: 'NETQTY', quc: 'MTR-METERS', action: 'INSERT' }
  ],
  itemGroups: [
    { sourceKey: 'SC27:1', name: 'GRAY STOCK', category: 'Grey' },
    { sourceKey: 'SC27:2', name: 'FINISH STOCK', category: 'Finished' }
  ],
  stations: [
    { sourceKey: 'SC27:1', name: 'SURAT', stateCode: '24' },
    { sourceKey: 'SC27:2', name: 'UJJAIN', stateCode: '23' },
    { sourceKey: 'SC27:3', name: 'MALGEGAON', stateCode: '27' }
  ],
  types: [
    { sourceKey: 'SC27:501', name: 'INVOICE (IN STATE)', regGst: 'LOCAL (WITHIN STATE)', taxGst: 'TAX INVOICE' },
    { sourceKey: 'SC27:502', name: 'INVOICE (OUT OF STATE)', regGst: 'CENTRAL (OUT OF STATE)', taxGst: 'TAX INVOICE' },
    { sourceKey: 'SC27:503', name: 'UNREGISTERED INVOICE(IN STATE)', regGst: 'LOCAL (WITHIN STATE)', taxGst: 'UNREGISTERED INVOICE' },
    { sourceKey: 'SC27:504', name: 'UNREGISTERED INVOICE(OUT OF STATE)', regGst: 'CENTRAL (OUT OF STATE)', taxGst: 'UNREGISTERED INVOICE' },
    { sourceKey: 'SC27:511', name: 'COMPOSITION SCHEME', regGst: 'COMPOSITION SCHEME', taxGst: 'TAX INVOICE' },
    { sourceKey: 'SC27:512', name: 'EXEMPT AND NIL RATED', regGst: 'EXEMPT AND NIL RATED', taxGst: 'TAX INVOICE' }
  ],
  accountGroups: [
    { sourceKey: 'ACG:1', code: '1', name: 'CAPITAL ACCOUNT', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:2', code: '2', name: 'RESERVES & SURPLUS', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:3', code: '3', name: 'SECURED LOANS', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:4', code: '4', name: 'UNSECURED LOANS', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:5', code: '5', name: 'FIXED ASSETS', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:6', code: '6', name: 'INVESTMENTS', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:7', code: '7', name: 'CURRENT ASSETS', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:8', code: '8', name: 'LOANS & ADVANCES (ASSET)', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:9', code: '9', name: 'CURRENT LIABILITIES', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:10', code: '10', name: 'PROVISIONS', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:11', code: '11', name: 'MISC. EXPENSES', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:12', code: '12', name: 'SALES ACCOUNTS', gracType: 'INCOME', normalBalance: 'Cr' },
    { sourceKey: 'ACG:13', code: '13', name: 'PURCHASE ACCOUNTS', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:14', code: '14', name: 'DIRECT EXPENSES', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:15', code: '15', name: 'INDIRECT EXPENSES', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:16', code: '16', name: 'INDIRECT INCOMES', gracType: 'INCOME', normalBalance: 'Cr' },
    { sourceKey: 'ACG:17', code: '17', name: 'BANK BALANCE', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:18', code: '18', name: 'CASH-IN-HAND', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:19', code: '19', name: 'DEPOSITS (ASSET)', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:20', code: '20', name: 'LOANS & ADVANCES (LIABILITY)', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:21', code: '21', name: 'STOCK-IN-HAND', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:22', code: '22', name: 'SUNDRY DEBTORS (TRADING)', gracType: 'ASSETS', normalBalance: 'Dr' },
    { sourceKey: 'ACG:23', code: '23', name: 'DUTIES & TAXES', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:24', code: '24', name: 'SUNDRY CREDITORS (EXPENSES)', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:25', code: '25', name: 'SUNDRY CREDITORS (CAPITAL GOODS)', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:26', code: '26', name: 'BRANCH / DIVISIONS', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:27', code: '27', name: 'SUSPENSE A/C', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:28', code: '28', name: 'DIRECT INCOMES', gracType: 'INCOME', normalBalance: 'Cr' },
    { sourceKey: 'ACG:29', code: '29', name: 'TRADING INCOME', gracType: 'INCOME', normalBalance: 'Cr' },
    { sourceKey: 'ACG:30', code: '30', name: 'PROFIT & LOSS INCOME', gracType: 'INCOME', normalBalance: 'Cr' },
    { sourceKey: 'ACG:31', code: '31', name: 'TRADING EXPENSE', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:32', code: '32', name: 'PROFIT & LOSS EXPENSE', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:33', code: '33', name: 'RAW MATERIAL PURCHASE', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:34', code: '34', name: 'YARN PURCHASE', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:35', code: '35', name: 'SUNDRY CREDITORS', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:36', code: '36', name: 'GREY PURCHASE', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:37', code: '37', name: 'JOBWORK CHARGES (EXPENSE)', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:38', code: '38', name: 'CREDITORS FOR PROCESS', gracType: 'LIABILITY', normalBalance: 'Cr' },
    { sourceKey: 'ACG:39', code: '39', name: 'JOBWORK CHARGES (INCOME)', gracType: 'INCOME', normalBalance: 'Cr' },
    { sourceKey: 'ACG:40', code: '40', name: 'COMMISSION EXPENSE', gracType: 'EXPENSE', normalBalance: 'Dr' },
    { sourceKey: 'ACG:41', code: '41', name: 'COMMISSION INCOME', gracType: 'INCOME', normalBalance: 'Cr' },
    { sourceKey: 'ACG:42', code: '42', name: 'SUNDRY DEBTORS', gracType: 'ASSETS', normalBalance: 'Dr' }
  ],
  tradeParties: [
    { sourceKey: 'SC27:105', accd: 105, name: 'RAJA TEX', type: 'Customer', stateCode: '24', stateName: '24-Gujarat', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(IN STATE)', gstin: '' },
    { sourceKey: 'SC27:106', accd: 106, name: 'NAVKAR TEX', type: 'Customer', stateCode: '24', stateName: '24-Gujarat', city: 'SURAT', gstType: 'INVOICE (IN STATE)', gstin: '24AILPB9933A1ZK' },
    { sourceKey: 'SC27:108', accd: 108, name: 'MAHESH SIR', type: 'Supplier', stateCode: '24', stateName: '24-Gujarat', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(IN STATE)', gstin: '' },
    { sourceKey: 'SC27:110', accd: 110, name: 'MAHESH TEX', type: 'Customer', stateCode: '24', stateName: '24-Gujarat', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(IN STATE)', gstin: '' },
    { sourceKey: 'SC27:111', accd: 111, name: 'SHREE LAV', type: 'Supplier', stateCode: '24', stateName: '24-Gujarat', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(IN STATE)', gstin: '' },
    { sourceKey: 'SC27:112', accd: 112, name: 'BROKER', type: 'Broker', stateCode: '24', stateName: '24-Gujarat', city: 'SURAT', gstType: 'INVOICE (IN STATE)', gstin: '24AAAGM0289C1ZP' },
    { sourceKey: 'SC27:115', accd: 115, name: 'VISHAL TEXTILES', type: 'Customer', stateCode: '23', stateName: '23-Madhya Pradesh', city: 'UJJAIN', gstType: 'UNREGISTERED INVOICE(OUT OF STATE)', gstin: '' },
    { sourceKey: 'SC27:116', accd: 116, name: 'RAJESH ENTERPRISE', type: 'Supplier', stateCode: '27', stateName: '27-Maharashtra', city: 'MALGEGAON', gstType: 'UNREGISTERED INVOICE(OUT OF STATE)', gstin: '' },
    { sourceKey: 'SC27:117', accd: 117, name: 'SHREE VASUDEV', type: 'Supplier', stateCode: '24', stateName: '24-Gujarat', city: 'SURAT', gstType: 'INVOICE (IN STATE)', gstin: '24AHAPL5464E1ZM' },
    { sourceKey: 'SC27:118', accd: 118, name: 'BABA TEXTILE', type: 'Customer', stateCode: '23', stateName: '23-Madhya Pradesh', city: 'UJJAIN', gstType: 'UNREGISTERED INVOICE(OUT OF STATE)', gstin: '' },
    { sourceKey: 'SC27:119', accd: 119, name: 'SHREE BUSINESSES', type: 'Customer', stateCode: '24', stateName: '24-Gujarat', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(IN STATE)', gstin: '' },
    { sourceKey: 'SC27:120', accd: 120, name: 'ADDU CUSTOMER', type: 'Customer', stateCode: '23', stateName: '23-Madhya Pradesh', city: 'UJJAIN', gstType: 'INVOICE (OUT OF STATE)', gstin: '' },
    { sourceKey: 'SC27:121', accd: 121, name: 'LALA SUPPLIER', type: 'Supplier', stateCode: '23', stateName: '23-Madhya Pradesh', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(OUT OF STATE)', gstin: '' },
    { sourceKey: 'SC27:124', accd: 124, name: 'FASK SUPPLIER', type: 'Supplier', stateCode: '32', stateName: '32-Kerala', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(OUT OF STATE)', gstin: '' },
    { sourceKey: 'SC27:125', accd: 125, name: 'NEW MILL', type: 'Supplier', stateCode: '23', stateName: '23-Madhya Pradesh', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(OUT OF STATE)', gstin: '' },
    { sourceKey: 'SC27:126', accd: 126, name: 'NEW JOB PARTY', type: 'Job Worker', stateCode: '32', stateName: '32-Kerala', city: 'SURAT', gstType: 'UNREGISTERED INVOICE(OUT OF STATE)', gstin: '' }
  ],
  nonTradeLedgers: [
    { sourceKey: 'SC27:107', code: '107', name: 'HDFC BANK', group: 'Assets', subGroup: 'Bank Accounts', accountType: 'Bank', nature: 'Dr' },
    { sourceKey: 'SC27:113', code: '113', name: 'IDFC BANK', group: 'Assets', subGroup: 'Bank Accounts', accountType: 'Bank', nature: 'Dr' },
    { sourceKey: 'SC27:114', code: '114', name: 'IDFC', group: 'Assets', subGroup: 'Bank Accounts', accountType: 'Bank', nature: 'Dr' },
    { sourceKey: 'SC27:72', code: '72', name: 'SGST(RCM)PAYABLE A/C', group: 'Liabilities', subGroup: 'Duties & Taxes', accountType: 'Tax', nature: 'Cr' },
    { sourceKey: 'SC27:73', code: '73', name: 'SGST(RCM)RECEIVABLE A/C', group: 'Assets', subGroup: 'Duties & Taxes', accountType: 'Tax', nature: 'Dr' },
    { sourceKey: 'SC27:75', code: '75', name: 'CGST(RCM)PAYABLE A/C', group: 'Liabilities', subGroup: 'Duties & Taxes', accountType: 'Tax', nature: 'Cr' },
    { sourceKey: 'SC27:76', code: '76', name: 'CGST(RCM)RECEIVABLE A/C', group: 'Assets', subGroup: 'Duties & Taxes', accountType: 'Tax', nature: 'Dr' },
    { sourceKey: 'SC27:78', code: '78', name: 'IGST(RCM)RECEIVABLE A/C', group: 'Assets', subGroup: 'Duties & Taxes', accountType: 'Tax', nature: 'Dr' },
    { sourceKey: 'SC27:79', code: '79', name: 'IGST(RCM)PAYABLE A/C', group: 'Liabilities', subGroup: 'Duties & Taxes', accountType: 'Tax', nature: 'Cr' },
    { sourceKey: 'SC27:82', code: '82', name: 'OTHER PURCHASE', group: 'Expenses', subGroup: 'Direct Expenses', accountType: 'General', nature: 'Dr' }
  ],
  items: [
    { sourceKey: 'SC27:1', itemCode: '1', name: 'DOBBY', category: 'Others', categoryLabel: 'DOBBY', unit: 'MTRS', hsnCode: '', gstRate: 5, purchaseRate: 0, salesRate: 0 },
    { sourceKey: 'SC27:2', itemCode: '2', name: 'BLOUSE', category: 'Finished', categoryLabel: 'FINISH STOCK', unit: 'PCS', hsnCode: '5407', gstRate: 5, purchaseRate: 0, salesRate: 50 },
    { sourceKey: 'SC27:3', itemCode: '3', name: 'GRAY MICRO', category: 'Grey', categoryLabel: 'GRAY STOCK', unit: 'PCS', hsnCode: '5407', gstRate: 5, purchaseRate: 0, salesRate: 0 },
    { sourceKey: 'SC27:4', itemCode: '4', name: 'TEST FABRIC', category: 'Others', categoryLabel: 'TEST FABRIC', unit: 'MTRS', hsnCode: '5407', gstRate: 5, purchaseRate: 200, salesRate: 0 },
    { sourceKey: 'SC27:5', itemCode: '5', name: 'SHIRT COTTON', category: 'Others', categoryLabel: 'SHIRT COTTON', unit: 'MTRS', hsnCode: '5407', gstRate: 5, purchaseRate: 0, salesRate: 0 },
    { sourceKey: 'SC27:6', itemCode: '6', name: 'GRY SHIRT', category: 'Others', categoryLabel: 'GRY SHIRT', unit: 'PCS', hsnCode: '5407', gstRate: 5, purchaseRate: 0, salesRate: 0 }
  ]
};

async function executeBackup(db) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../backups', `pre_sanchal_import_${ts}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const collections = ['parties', 'items', 'submasters', 'ledgermasters', 'warehouses', 'books'];
  const summary = {};

  for (const collName of collections) {
    const docs = await db.collection(collName).find({
      $or: [{ companyId: TARGET_COMPANY_ID }, { companyId: null }]
    }).toArray();
    const filePath = path.join(backupDir, `${collName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    summary[collName] = docs.length;
  }

  console.log(`[BACKUP] Successfully created restorable pre-import snapshot at: ${backupDir}`);
  console.log('[BACKUP] Snapshot Document Counts:', JSON.stringify(summary, null, 2));
  return { backupDir, summary };
}

async function runMigration({ isDryRun = true }) {
  console.log(`\n======================================================================`);
  console.log(` SANCHAL MASTER IMPORT RUNNER — MODE: ${isDryRun ? 'DRY-RUN (NO WRITES)' : 'LIVE EXECUTION'}`);
  console.log(` Target Company: Surat Demo Textile Mills Pvt Ltd (${TARGET_COMPANY_ID})`);
  console.log(`======================================================================\n`);

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from environment.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Verify Backup
  const backup = await executeBackup(db);

  if (isDryRun) {
    console.log('\n[DRY-RUN] Dry run completed successfully. Zero database writes performed.');
    await mongoose.disconnect();
    return { success: true, isDryRun: true, backup };
  }

  // 2. Start Multi-Document ACID Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const mappingsColl = db.collection('jsm_master_mappings');
    await mappingsColl.createIndex({ companyId: 1, sourceTable: 1, sourceKey: 1 }, { unique: true });

    let stats = {
      submastersCreated: 0,
      submastersReused: 0,
      partiesCreated: 0,
      partiesUpdated: 0,
      ledgersCreated: 0,
      itemsCreated: 0,
      mappingsRecorded: 0
    };

    // PHASE 1: SubMaster Units
    console.log('\n[PHASE 1] Importing Units...');
    const unitsColl = db.collection('submasters');
    for (const u of SANCHAL_DATA.units) {
      const existingMapping = await mappingsColl.findOne({ companyId: TARGET_COMPANY_ID, sourceTable: 'MST_UNIT', sourceKey: u.sourceKey }, { session });
      if (existingMapping) continue;

      if (u.action === 'REUSE') {
        const existingDoc = await unitsColl.findOne({ companyId: TARGET_COMPANY_ID, type: 'Unit', name: u.matchName }, { session });
        if (existingDoc) {
          await mappingsColl.insertOne({
            companyId: TARGET_COMPANY_ID,
            sourceDatabase: 'JsmSql2_DEMO2026',
            sourceTable: 'MST_UNIT',
            sourceKey: u.sourceKey,
            targetModel: 'SubMaster',
            targetId: existingDoc._id,
            action: 'REUSE',
            importBatch: BATCH_ID,
            createdAt: new Date()
          }, { session });
          stats.submastersReused++;
          stats.mappingsRecorded++;
        }
      } else {
        const res = await unitsColl.insertOne({
          companyId: TARGET_COMPANY_ID,
          type: 'Unit',
          name: u.name,
          extraFields: { quc: u.quc },
          isFavorite: false,
          lastUsedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }, { session });
        await mappingsColl.insertOne({
          companyId: TARGET_COMPANY_ID,
          sourceDatabase: 'JsmSql2_DEMO2026',
          sourceTable: 'MST_UNIT',
          sourceKey: u.sourceKey,
          targetModel: 'SubMaster',
          targetId: res.insertedId,
          action: 'INSERT',
          importBatch: BATCH_ID,
          createdAt: new Date()
        }, { session });
        stats.submastersCreated++;
        stats.mappingsRecorded++;
      }
    }

    // PHASE 2: SubMaster ItemGroups, Stations, Types, AccountGroups
    console.log('[PHASE 2] Importing ItemGroups, Stations, Types, AccountGroups...');
    for (const g of SANCHAL_DATA.itemGroups) {
      const existing = await unitsColl.findOne({ companyId: TARGET_COMPANY_ID, type: 'ItemGroup', name: g.name }, { session });
      const targetId = existing?._id || (await unitsColl.insertOne({
        companyId: TARGET_COMPANY_ID,
        type: 'ItemGroup',
        name: g.name,
        extraFields: { category: g.category },
        createdAt: new Date(),
        updatedAt: new Date()
      }, { session })).insertedId;
      if (!existing) stats.submastersCreated++;
      await mappingsColl.updateOne(
        { companyId: TARGET_COMPANY_ID, sourceTable: 'MST_ITG_MAST', sourceKey: g.sourceKey },
        { $setOnInsert: { companyId: TARGET_COMPANY_ID, sourceDatabase: 'JsmSql2_DEMO2026', sourceTable: 'MST_ITG_MAST', sourceKey: g.sourceKey, targetModel: 'SubMaster', targetId, action: existing ? 'REUSE' : 'INSERT', importBatch: BATCH_ID, createdAt: new Date() } },
        { upsert: true, session }
      );
      stats.mappingsRecorded++;
    }

    for (const st of SANCHAL_DATA.stations) {
      const existing = await unitsColl.findOne({ companyId: TARGET_COMPANY_ID, type: 'City', name: st.name }, { session });
      const targetId = existing?._id || (await unitsColl.insertOne({
        companyId: TARGET_COMPANY_ID,
        type: 'City',
        name: st.name,
        extraFields: { stateCode: st.stateCode },
        createdAt: new Date(),
        updatedAt: new Date()
      }, { session })).insertedId;
      if (!existing) stats.submastersCreated++;
      await mappingsColl.updateOne(
        { companyId: TARGET_COMPANY_ID, sourceTable: 'MST_STATION', sourceKey: st.sourceKey },
        { $setOnInsert: { companyId: TARGET_COMPANY_ID, sourceDatabase: 'JsmSql2_DEMO2026', sourceTable: 'MST_STATION', sourceKey: st.sourceKey, targetModel: 'SubMaster', targetId, action: existing ? 'REUSE' : 'INSERT', importBatch: BATCH_ID, createdAt: new Date() } },
        { upsert: true, session }
      );
      stats.mappingsRecorded++;
    }

    for (const ty of SANCHAL_DATA.types) {
      const existing = await unitsColl.findOne({ companyId: TARGET_COMPANY_ID, type: 'Type', name: ty.name }, { session });
      const targetId = existing?._id || (await unitsColl.insertOne({
        companyId: TARGET_COMPANY_ID,
        type: 'Type',
        name: ty.name,
        extraFields: { regGst: ty.regGst, taxGst: ty.taxGst },
        createdAt: new Date(),
        updatedAt: new Date()
      }, { session })).insertedId;
      if (!existing) stats.submastersCreated++;
      await mappingsColl.updateOne(
        { companyId: TARGET_COMPANY_ID, sourceTable: 'MST_TYPE', sourceKey: ty.sourceKey },
        { $setOnInsert: { companyId: TARGET_COMPANY_ID, sourceDatabase: 'JsmSql2_DEMO2026', sourceTable: 'MST_TYPE', sourceKey: ty.sourceKey, targetModel: 'SubMaster', targetId, action: existing ? 'REUSE' : 'INSERT', importBatch: BATCH_ID, createdAt: new Date() } },
        { upsert: true, session }
      );
      stats.mappingsRecorded++;
    }

    for (const ag of SANCHAL_DATA.accountGroups) {
      const existing = await unitsColl.findOne({ companyId: TARGET_COMPANY_ID, type: 'AccountGroup', name: ag.name }, { session });
      const targetId = existing?._id || (await unitsColl.insertOne({
        companyId: TARGET_COMPANY_ID,
        type: 'AccountGroup',
        name: ag.name,
        extraFields: { gracCode: ag.code, gracType: ag.gracType, normalBalance: ag.normalBalance },
        createdAt: new Date(),
        updatedAt: new Date()
      }, { session })).insertedId;
      if (!existing) stats.submastersCreated++;
      await mappingsColl.updateOne(
        { companyId: TARGET_COMPANY_ID, sourceTable: 'MST_ACG_MAST', sourceKey: ag.sourceKey },
        { $setOnInsert: { companyId: TARGET_COMPANY_ID, sourceDatabase: 'JsmSql2_DEMO2026', sourceTable: 'MST_ACG_MAST', sourceKey: ag.sourceKey, targetModel: 'SubMaster', targetId, action: existing ? 'REUSE' : 'INSERT', importBatch: BATCH_ID, createdAt: new Date() } },
        { upsert: true, session }
      );
      stats.mappingsRecorded++;
    }

    // PHASE 3: Explicit Conflict Resolution for PADMAVATI PRINT and VRAJ TEXTILES
    console.log('[PHASE 3] Resolving Conflicts for PADMAVATI PRINT and VRAJ TEXTILES...');
    const partiesColl = db.collection('parties');
    const ledgersColl = db.collection('ledgermasters');

    // 1. PADMAVATI PRINT: Convert 0-transaction test customer to Sanchal Creditor
    const padmavatiExisting = await partiesColl.findOne({ companyId: TARGET_COMPANY_ID, name: { $regex: /^padmavati print$/i } }, { session });
    if (padmavatiExisting) {
      const padmavatiLedger = await ledgersColl.findOne({ linkedPartyId: padmavatiExisting._id }, { session });
      await partiesColl.updateOne(
        { _id: padmavatiExisting._id },
        {
          $set: {
            name: 'PADMAVATI PRINT',
            type: 'Supplier',
            accd: 109,
            city: 'SURAT',
            stateCode: '24',
            stateName: '24-Gujarat',
            gstType: 'UNREGISTERED INVOICE(IN STATE)',
            updatedAt: new Date()
          }
        },
        { session }
      );
      if (padmavatiLedger) {
        await ledgersColl.updateOne(
          { _id: padmavatiLedger._id },
          {
            $set: {
              name: 'PADMAVATI PRINT',
              group: 'Liabilities',
              subGroup: 'Sundry Creditors',
              nature: 'Cr',
              updatedAt: new Date()
            }
          },
          { session }
        );
      }
      await mappingsColl.updateOne(
        { companyId: TARGET_COMPANY_ID, sourceTable: 'MST_AC_MAST', sourceKey: 'SC27:109' },
        {
          $set: {
            companyId: TARGET_COMPANY_ID,
            sourceDatabase: 'JsmSql2_DEMO2026',
            sourceTable: 'MST_AC_MAST',
            sourceKey: 'SC27:109',
            targetModel: 'Party',
            targetId: padmavatiExisting._id,
            action: 'UPDATE',
            preImportPartySnapshot: padmavatiExisting,
            preImportLedgerSnapshot: padmavatiLedger,
            importBatch: BATCH_ID,
            createdAt: new Date()
          }
        },
        { upsert: true, session }
      );
      stats.partiesUpdated++;
      stats.mappingsRecorded++;
    }

    // 2. VRAJ TEXTILES: Preserve existing GSTIN ('24DGFPA0143G1Z5') and assign accd: 123
    const vrajExisting = await partiesColl.findOne({ companyId: TARGET_COMPANY_ID, name: { $regex: /^vraj textile(s)?$/i } }, { session });
    if (vrajExisting) {
      const vrajLedger = await ledgersColl.findOne({ linkedPartyId: vrajExisting._id }, { session });
      const preservedGstin = vrajExisting.gstin || '24DGFPA0143G1Z5';
      await partiesColl.updateOne(
        { _id: vrajExisting._id },
        {
          $set: {
            name: 'VRAJ TEXTILES',
            accd: 123,
            gstin: preservedGstin,
            updatedAt: new Date()
          }
        },
        { session }
      );
      if (vrajLedger) {
        await ledgersColl.updateOne(
          { _id: vrajLedger._id },
          { $set: { name: 'VRAJ TEXTILES', updatedAt: new Date() } },
          { session }
        );
      }
      await mappingsColl.updateOne(
        { companyId: TARGET_COMPANY_ID, sourceTable: 'MST_AC_MAST', sourceKey: 'SC27:123' },
        {
          $set: {
            companyId: TARGET_COMPANY_ID,
            sourceDatabase: 'JsmSql2_DEMO2026',
            sourceTable: 'MST_AC_MAST',
            sourceKey: 'SC27:123',
            targetModel: 'Party',
            targetId: vrajExisting._id,
            action: 'UPDATE',
            preImportPartySnapshot: vrajExisting,
            preImportLedgerSnapshot: vrajLedger,
            importBatch: BATCH_ID,
            createdAt: new Date()
          }
        },
        { upsert: true, session }
      );
      stats.partiesUpdated++;
      stats.mappingsRecorded++;
    }

    // PHASE 4: Trade Parties (16 Safe Additions)
    console.log('[PHASE 4] Importing Trade Parties...');
    for (const p of SANCHAL_DATA.tradeParties) {
      const existingMapping = await mappingsColl.findOne({ companyId: TARGET_COMPANY_ID, sourceTable: 'MST_AC_MAST', sourceKey: p.sourceKey }, { session });
      if (existingMapping) continue;

      const pDoc = {
        name: p.name,
        type: p.type,
        accd: p.accd,
        gstin: p.gstin || '',
        pan: p.gstin ? p.gstin.slice(2, 12) : '',
        mobile: '',
        email: '',
        address: '',
        city: p.city,
        state: p.stateName,
        stateCode: p.stateCode,
        stateName: p.stateName,
        gstType: p.gstType,
        creditLimit: 0,
        openingBalance: 0,
        openingBalanceType: 'Dr',
        status: 'Active',
        isFavorite: false,
        banks: [],
        companyId: TARGET_COMPANY_ID,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const pRes = await partiesColl.insertOne(pDoc, { session });
      const partyId = pRes.insertedId;

      // Auto-create linked LedgerMaster (lockstep with partyService.syncOpeningToLedger)
      const isCreditor = ['Supplier', 'Both', 'Job Worker', 'Broker', 'Transport'].includes(p.type);
      const lDoc = {
        companyId: TARGET_COMPANY_ID,
        name: p.name,
        code: String(p.accd),
        group: isCreditor ? 'Liabilities' : 'Assets',
        subGroup: isCreditor ? 'Sundry Creditors' : 'Sundry Debtors',
        linkedPartyId: partyId,
        accountType: 'Party',
        nature: isCreditor ? 'Cr' : 'Dr',
        openingBalance: 0,
        openingBalanceType: isCreditor ? 'Cr' : 'Dr',
        isSystemLedger: false,
        isActive: true,
        allowManualEntry: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await ledgersColl.insertOne(lDoc, { session });

      await mappingsColl.insertOne({
        companyId: TARGET_COMPANY_ID,
        sourceDatabase: 'JsmSql2_DEMO2026',
        sourceTable: 'MST_AC_MAST',
        sourceKey: p.sourceKey,
        targetModel: 'Party',
        targetId: partyId,
        action: 'INSERT',
        importBatch: BATCH_ID,
        createdAt: new Date()
      }, { session });

      stats.partiesCreated++;
      stats.mappingsRecorded++;
    }

    // PHASE 5: Non-Trade Ledgers (Banks, RCM Taxes, Expenses)
    console.log('[PHASE 5] Importing Non-Trade Ledgers (Banks, RCM Taxes, Expense)...');
    for (const l of SANCHAL_DATA.nonTradeLedgers) {
      const existingMapping = await mappingsColl.findOne({ companyId: TARGET_COMPANY_ID, sourceTable: 'MST_AC_MAST', sourceKey: l.sourceKey }, { session });
      if (existingMapping) continue;

      const lDoc = {
        companyId: TARGET_COMPANY_ID,
        name: l.name,
        code: l.code,
        group: l.group,
        subGroup: l.subGroup,
        accountType: l.accountType,
        nature: l.nature,
        openingBalance: 0,
        openingBalanceType: l.nature,
        isSystemLedger: false,
        isActive: true,
        allowManualEntry: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const lRes = await ledgersColl.insertOne(lDoc, { session });
      await mappingsColl.insertOne({
        companyId: TARGET_COMPANY_ID,
        sourceDatabase: 'JsmSql2_DEMO2026',
        sourceTable: 'MST_AC_MAST',
        sourceKey: l.sourceKey,
        targetModel: 'LedgerMaster',
        targetId: lRes.insertedId,
        action: 'INSERT',
        importBatch: BATCH_ID,
        createdAt: new Date()
      }, { session });

      stats.ledgersCreated++;
      stats.mappingsRecorded++;
    }

    // PHASE 6: Items (Fabric & Yarn Quality Masters)
    console.log('[PHASE 6] Importing Items...');
    const itemsColl = db.collection('items');
    for (const it of SANCHAL_DATA.items) {
      const existingMapping = await mappingsColl.findOne({ companyId: TARGET_COMPANY_ID, sourceTable: 'MST_IT_MAST', sourceKey: it.sourceKey }, { session });
      if (existingMapping) continue;

      const itDoc = {
        name: it.name,
        itemCode: it.itemCode,
        category: it.category,
        categoryLabel: it.categoryLabel,
        unit: it.unit,
        hsnCode: it.hsnCode,
        gstRate: it.gstRate,
        purchaseRate: it.purchaseRate,
        salesRate: it.salesRate,
        openingStock: 0,
        openingPcs: 0,
        openingQty: 0,
        openingRate: 0,
        openingValue: 0,
        companyId: TARGET_COMPANY_ID,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const itRes = await itemsColl.insertOne(itDoc, { session });
      await mappingsColl.insertOne({
        companyId: TARGET_COMPANY_ID,
        sourceDatabase: 'JsmSql2_DEMO2026',
        sourceTable: 'MST_IT_MAST',
        sourceKey: it.sourceKey,
        targetModel: 'Item',
        targetId: itRes.insertedId,
        action: 'INSERT',
        importBatch: BATCH_ID,
        createdAt: new Date()
      }, { session });

      stats.itemsCreated++;
      stats.mappingsRecorded++;
    }

    // Commit Transaction
    await session.commitTransaction();
    console.log('\n[TRANSACTION COMMITTED] All Sanchal masters successfully imported!');
    console.log('[MIGRATION SUMMARY]', JSON.stringify(stats, null, 2));

    await mongoose.disconnect();
    return { success: true, stats, backup };
  } catch (err) {
    await session.abortTransaction();
    console.error('\n[TRANSACTION ABORTED] Error during migration:', err.message);
    await mongoose.disconnect();
    throw err;
  } finally {
    session.endSession();
  }
}

if (require.main === module) {
  const isExecute = process.argv.includes('--execute');
  runMigration({ isDryRun: !isExecute })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMigration, executeBackup, SANCHAL_DATA };
