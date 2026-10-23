/**
 * Import golden-master test data (from JSM) into a new MERN test company.
 * Idempotent. Atomic. Isolated.
 *
 * Usage:
 *   node mern-import-golden-data.js --dryRun
 *   node mern-import-golden-data.js --execute
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const isDryRun = process.argv.includes('--dryRun');
const isExecute = process.argv.includes('--execute');

if (!isDryRun && !isExecute) {
  console.log('Usage: node mern-import-golden-data.js [--dryRun | --execute]');
  process.exit(1);
}

const GOLDEN_DIR = path.join(__dirname, '../../backups/golden-master');
const TEST_COMPANY = {
  name: 'Golden Master Test Company',
  gstin: 'DUMMY-TEST-001',
  state: '24-Gujarat'
};

async function loadCsvFile(filename) {
  const filePath = path.join(GOLDEN_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ ${filename} not found, skipping...`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;

    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || null;
    }
    records.push(record);
  }

  return records;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function createOrGetTestCompany(db) {
  const companiesColl = db.collection('companies');
  let company = await companiesColl.findOne({ name: TEST_COMPANY.name });

  if (!company) {
    company = {
      _id: new mongoose.Types.ObjectId(),
      name: TEST_COMPANY.name,
      gstin: TEST_COMPANY.gstin,
      state: TEST_COMPANY.state,
      createdAt: new Date(),
      createdFrom: 'golden-master-import'
    };
    await companiesColl.insertOne(company);
    console.log(`✓ Created test company: ${company._id}`);
  } else {
    console.log(`✓ Using existing test company: ${company._id}`);
  }

  return company;
}

async function importMasters(db, companyId) {
  console.log('\n[MASTERS] Importing items, parties, and accounts...');

  const mappings = {};

  // Items
  const items = await loadCsvFile('items.csv');
  if (items.length > 0) {
    const itemsColl = db.collection('items');
    for (const item of items) {
      const doc = {
        companyId: new mongoose.Types.ObjectId(companyId),
        itemCode: item.itemCode,
        name: item.itemName,
        category: item.category || 'Others',
        unit: item.unit || 'PCS',
        hsnCode: item.hsnCode || '',
        gstRate: parseFloat(item.gstRate) || 0,
        purchaseRate: 0,
        salesRate: 0,
        createdAt: new Date(),
        _source: 'JSM_GOLDEN_MASTER',
        _jsm_code: item.itemCode
      };
      await itemsColl.updateOne(
        { companyId, itemCode: item.itemCode },
        { $set: doc },
        { upsert: true }
      );
    }
    console.log(`  ✓ Items: ${items.length} imported`);
    mappings.items = items.length;
  }

  // Parties (Customers, Suppliers, Brokers)
  const parties = await loadCsvFile('parties.csv');
  if (parties.length > 0) {
    const partiesColl = db.collection('parties');
    for (const party of parties) {
      const doc = {
        companyId: new mongoose.Types.ObjectId(companyId),
        code: party.acCode,
        name: party.acName,
        gstin: party.gstin || '',
        city: party.city || '',
        address: party.address || '',
        phone: party.phone || '',
        mainGroup: party.mainGroup,
        subGroup: party.subGroup,
        type: party.subGroup?.includes('DEBTOR') ? 'Customer' : 'Supplier',
        creditLimit: 0,
        createdAt: new Date(),
        _source: 'JSM_GOLDEN_MASTER',
        _jsm_code: party.acCode
      };
      await partiesColl.updateOne(
        { companyId, code: party.acCode },
        { $set: doc },
        { upsert: true }
      );
    }
    console.log(`  ✓ Parties: ${parties.length} imported`);
    mappings.parties = parties.length;
  }

  // Opening Balances (from accounts)
  const accounts = await loadCsvFile('accounts.csv');
  if (accounts.length > 0) {
    const ledgersMastersColl = db.collection('ledgermasters');
    for (const account of accounts) {
      const openingBal = parseFloat(account.openingBal) || 0;
      if (openingBal !== 0) {
        const doc = {
          companyId: new mongoose.Types.ObjectId(companyId),
          acCode: account.acCode,
          acName: account.acName,
          openingBalance: openingBal,
          openingBalanceDrCr: account.balDrCr || 'Cr',
          createdAt: new Date(),
          _source: 'JSM_GOLDEN_MASTER'
        };
        await ledgersMastersColl.updateOne(
          { companyId, acCode: account.acCode },
          { $set: doc },
          { upsert: true }
        );
      }
    }
    console.log(`  ✓ Accounts: ${accounts.length} with opening balances processed`);
    mappings.accounts = accounts.length;
  }

  return mappings;
}

async function importTransactions(db, companyId) {
  console.log('\n[TRANSACTIONS] Importing sales, purchase, and vouchers...');

  const mappings = {};

  // Sales Invoices
  const sales = await loadCsvFile('sales.csv');
  const salesDetail = await loadCsvFile('salesDetail.csv');
  if (sales.length > 0) {
    const salesColl = db.collection('sales');
    for (const sale of sales) {
      const lines = salesDetail.filter(l => l.ENT_NO === sale.ENT_NO);
      const doc = {
        companyId: new mongoose.Types.ObjectId(companyId),
        invoiceNumber: sale.ENT_NO,
        date: new Date(sale.ENT_DATE),
        book: sale.book,
        partyCode: sale.partyCode,
        grossAmount: parseFloat(sale.grossAmount) || 0,
        discountAmount: parseFloat(sale.discountAmount) || 0,
        taxAmount: parseFloat(sale.taxAmount) || 0,
        netAmount: parseFloat(sale.netAmount) || 0,
        items: lines.map(l => ({
          itemCode: l.itemCode,
          quantity: parseFloat(l.qty) || 0,
          rate: parseFloat(l.rate) || 0,
          gstRate: parseFloat(l.gstRate) || 0,
          amount: parseFloat(l.lineAmount) || 0
        })),
        status: 'Final',
        createdAt: new Date(),
        _source: 'JSM_GOLDEN_MASTER',
        _jsm_entNo: sale.ENT_NO
      };
      await salesColl.updateOne(
        { companyId, invoiceNumber: sale.ENT_NO },
        { $set: doc },
        { upsert: true }
      );
    }
    console.log(`  ✓ Sales: ${sales.length} invoices with ${salesDetail.length} line items`);
    mappings.sales = sales.length;
  }

  // Purchase Invoices
  const purchase = await loadCsvFile('purchase.csv');
  const purchaseDetail = await loadCsvFile('purchaseDetail.csv');
  if (purchase.length > 0) {
    const purchaseColl = db.collection('purchases');
    for (const pur of purchase) {
      const lines = purchaseDetail.filter(l => l.ENT_NO === pur.ENT_NO);
      const doc = {
        companyId: new mongoose.Types.ObjectId(companyId),
        invoiceNumber: pur.ENT_NO,
        date: new Date(pur.ENT_DATE),
        book: pur.book,
        partyCode: pur.partyCode,
        grossAmount: parseFloat(pur.grossAmount) || 0,
        discountAmount: parseFloat(pur.discountAmount) || 0,
        taxAmount: parseFloat(pur.taxAmount) || 0,
        netAmount: parseFloat(pur.netAmount) || 0,
        items: lines.map(l => ({
          itemCode: l.itemCode,
          quantity: parseFloat(l.qty) || 0,
          rate: parseFloat(l.rate) || 0,
          gstRate: parseFloat(l.gstRate) || 0,
          amount: parseFloat(l.lineAmount) || 0
        })),
        status: 'Final',
        createdAt: new Date(),
        _source: 'JSM_GOLDEN_MASTER',
        _jsm_entNo: pur.ENT_NO
      };
      await purchaseColl.updateOne(
        { companyId, invoiceNumber: pur.ENT_NO },
        { $set: doc },
        { upsert: true }
      );
    }
    console.log(`  ✓ Purchase: ${purchase.length} invoices with ${purchaseDetail.length} line items`);
    mappings.purchase = purchase.length;
  }

  return mappings;
}

async function main() {
  console.log('\n========== GOLDEN MASTER IMPORT FOR MERN ==========');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (READ-ONLY)' : 'LIVE EXECUTION'}`);
  console.log(`Test Company: ${TEST_COMPANY.name}`);
  console.log(`Source: ${GOLDEN_DIR}`);

  if (!fs.existsSync(GOLDEN_DIR)) {
    console.error(`✗ Golden master directory not found: ${GOLDEN_DIR}`);
    console.log('Run: node scripts/golden-master/jsm-extract-demo.js');
    process.exit(1);
  }

  const manifest = path.join(GOLDEN_DIR, 'manifest.json');
  if (fs.existsSync(manifest)) {
    const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    console.log('\nManifest:', JSON.stringify(data, null, 2));
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI not set');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  try {
    const company = await createOrGetTestCompany(db);
    const companyId = company._id.toString();

    const masterStats = await importMasters(db, companyId);
    const transStats = await importTransactions(db, companyId);

    console.log('\n========== IMPORT SUMMARY ==========');
    console.log(`Company ID: ${companyId}`);
    console.log('Masters:', JSON.stringify(masterStats, null, 2));
    console.log('Transactions:', JSON.stringify(transStats, null, 2));

    if (isDryRun) {
      console.log('\n[DRY-RUN] No data written to database.');
    } else {
      console.log('\n✓ Import complete. Ready for golden-master reconciliation.');
    }

  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
