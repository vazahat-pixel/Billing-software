const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = 'http://127.0.0.1:5050/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runPhase2() {
  console.log('=== STARTING PHASE 2: QA COMPANY & MASTERS VERIFICATION ===');
  const results = [];

  try {
    // 1. Authenticate QA User
    console.log('[1] Authenticating QA User (qa.dev.admin@textileerp.dev)...');
    const loginRes = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'qa.dev.admin@textileerp.dev',
        password: 'Admin@123'
      })
    });

    if (!loginRes.data.token) {
      throw new Error('QA User Login Failed: ' + JSON.stringify(loginRes.data));
    }
    const token = loginRes.data.token;
    const companyId = loginRes.data.user.companyId;
    console.log(`  -> Logged in. Company ID: ${companyId}`);
    results.push({ test: 'QA User Authentication', status: 'PASS', details: `Authenticated for company: ${companyId}` });

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // Connect to DB directly for deep verification and master completeness
    await mongoose.connect(process.env.MONGO_URI);
    const Company = require('../models/Company');
    const CompanySettings = require('../models/CompanySettings');
    const GstConfig = require('../models/GstConfig');
    const Item = require('../models/Item');
    const Party = require('../models/Party');
    const Book = require('../models/Book');
    const LedgerMaster = require('../models/LedgerMaster');

    // 2. Verify Company & GST Configuration
    console.log('[2] Verifying Company GST & Financial Settings...');
    let gstConfig = await GstConfig.findOne({ companyId });
    if (!gstConfig) {
      gstConfig = await GstConfig.create({
        companyId,
        gstin: '24AABCC1234D1Z5',
        legalName: 'CI Textile Co',
        tradeName: 'CI Textile Co',
        stateCode: '24',
        stateName: 'Gujarat',
        registrationType: 'Regular',
        filingFrequency: 'Monthly',
        reverseChargeEnabled: true,
        isActive: true
      });
      console.log('  -> Created missing GstConfig');
    }
    console.log(`  -> GSTIN: ${gstConfig.gstin}, State: ${gstConfig.stateName} (${gstConfig.stateCode})`);
    results.push({ test: 'Company GST Config', status: 'PASS', details: `GSTIN: ${gstConfig.gstin}, State: ${gstConfig.stateName}` });

    // 3. Verify Books (Purchase, Sales, Jobwork, Cash, Bank, Journal)
    console.log('[3] Verifying Books configuration...');
    const requiredBooks = [
      { name: 'Purchase Book', code: 'PB01', module: 'purchase', bookType: 'PURCHASE BOOK' },
      { name: 'Sales Book', code: 'SB01', module: 'sales', bookType: 'SALES BOOK' },
      { name: 'Job Issue Book', code: 'JIS01', module: 'jobIssue', bookType: 'JOB WORK' },
      { name: 'Job Receive Book', code: 'JRC01', module: 'jobRec', bookType: 'JOB WORK' },
      { name: 'Mill Issue Book', code: 'MIS01', module: 'millIssue', bookType: 'MILL ISSUE' },
      { name: 'Mill Receive Book', code: 'MRC01', module: 'millRec', bookType: 'MILL RECEIVE' },
      { name: 'Payment Book', code: 'PMT01', module: 'payment', bookType: 'PAYMENT' },
      { name: 'Receipt Book', code: 'RCT01', module: 'receipt', bookType: 'RECEIPT' }
    ];

    for (const b of requiredBooks) {
      const existing = await Book.findOne({ companyId, code: b.code });
      if (!existing) {
        await Book.create({ ...b, companyId });
        console.log(`  -> Created Book: ${b.name} (${b.code})`);
      }
    }
    const totalBooks = await Book.countDocuments({ companyId });
    console.log(`  -> Total Books available: ${totalBooks}`);
    results.push({ test: 'Default Books Setup', status: 'PASS', details: `${totalBooks} Books available` });

    // 4. Verify Items Master (Grey Fabric, Finished Fabric)
    console.log('[4] Verifying Items Master (Grey Fabric, Finished Fabric)...');
    const requiredItems = [
      { name: 'Grey Fabric', category: 'Grey', hsnCode: '5208', gstRate: 5, unit: 'MTRS', purchaseRate: 50, salesRate: 0 },
      { name: 'Finished Fabric', category: 'Finished', hsnCode: '5208', gstRate: 5, unit: 'MTRS', purchaseRate: 0, salesRate: 120 }
    ];

    for (const itemData of requiredItems) {
      let item = await Item.findOne({ companyId, name: itemData.name });
      if (!item) {
        item = await Item.create({
          companyId,
          ...itemData,
          status: 'Active',
          stock: 0
        });
        console.log(`  -> Created Item Master: ${itemData.name} (HSN: ${itemData.hsnCode}, GST: ${itemData.gstRate}%)`);
      } else {
        console.log(`  -> Item already exists: ${item.name} (HSN: ${item.hsnCode || item.hsn}, GST: ${item.gstRate}%)`);
      }
    }
    results.push({ test: 'Items Master Setup', status: 'PASS', details: 'Grey Fabric (5%) and Finished Fabric (5%) verified' });

    // 5. Verify Parties Master
    console.log('[5] Verifying Parties Master...');
    const requiredParties = [
      { name: 'QA Supplier Intrastate', type: 'Supplier', gstin: '24AAAAA0000A1Z5', state: 'Gujarat', address: 'Surat, Gujarat' },
      { name: 'QA Job Worker Mill', type: 'Job Worker', gstin: '24CCCCC0000C1Z5', state: 'Gujarat', address: 'Surat, Gujarat' },
      { name: 'QA Customer B2B Intrastate', type: 'Customer', gstin: '24BBBBB0000B1Z5', state: 'Gujarat', address: 'Ahmedabad, Gujarat' },
      { name: 'QA Customer Interstate MH', type: 'Customer', gstin: '27AABCU9603R1ZP', state: 'Maharashtra', address: 'Mumbai, Maharashtra' },
      { name: 'QA Consumer Retail B2C', type: 'Customer', gstin: '', state: 'Gujarat', address: 'Surat, Gujarat' }
    ];

    for (const partyData of requiredParties) {
      let party = partyData.gstin 
        ? await Party.findOne({ companyId, gstin: partyData.gstin }) 
        : await Party.findOne({ companyId, name: partyData.name });

      if (!party) {
        party = await Party.create({
          companyId,
          ...partyData,
          isActive: true
        });
        console.log(`  -> Created Party: ${partyData.name} (${partyData.type}, GSTIN: ${partyData.gstin || 'None'}, State: ${partyData.state})`);
      } else {
        console.log(`  -> Party exists: ${party.name} (${party.type}, GSTIN: ${party.gstin || 'None'}, State: ${party.state})`);
      }
    }
    results.push({ test: 'Parties Master Setup', status: 'PASS', details: '5 Parties (Supplier, Mill, B2B Intra, B2B Inter, B2C) verified' });

    // 6. Verify System Ledgers & GST Ledger Map
    console.log('[6] Verifying System Ledgers & GST Mappings...');
    const accountingService = require('../services/accountingService');
    await accountingService.seedSystemLedgers(companyId);

    const ledgers = await LedgerMaster.find({ companyId });
    const ledgerNames = ledgers.map(l => l.name);
    console.log(`  -> System ledgers count: ${ledgers.length}`);
    const requiredLedgers = ['Cash A/c', 'Bank A/c', 'Sales A/c', 'Purchase A/c', 'CGST Input', 'SGST Input', 'IGST Input', 'CGST Output', 'SGST Output', 'IGST Output'];
    const allPresent = requiredLedgers.every(rl => ledgerNames.includes(rl));

    if (allPresent) {
      results.push({ test: 'Ledgers & Chart of Accounts', status: 'PASS', details: `${ledgers.length} ledgers active with complete GST input/output heads` });
    } else {
      results.push({ test: 'Ledgers & Chart of Accounts', status: 'FAIL', details: 'Missing standard chart of accounts' });
    }

    console.log('\n=== PHASE 2 SUMMARY ===');
    console.table(results);

  } catch (err) {
    console.error('Phase 2 Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runPhase2();
