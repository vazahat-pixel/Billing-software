const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = 'http://127.0.0.1:5050/api';

async function req(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    ...options,
    headers
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runPhase5() {
  console.log('=== STARTING PHASE 5: SALES & TAX DETERMINATION VERIFICATION ===');
  const results = [];

  try {
    // 1. Authenticate QA User
    const loginRes = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'qa.dev.admin@textileerp.dev',
        password: 'Admin@123'
      })
    });

    const payload = loginRes.data.data || loginRes.data;
    const token = payload.token;
    const companyId = payload.user?.companyId;
    if (!token || !companyId) {
      throw new Error('QA User Login Failed: ' + JSON.stringify(loginRes.data));
    }
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    await mongoose.connect(process.env.MONGO_URI);
    const Party = require('../models/Party');
    const Item = require('../models/Item');
    const Book = require('../models/Book');
    const Sales = require('../models/Sales');
    const InventoryLot = require('../models/InventoryLot');
    const AccountingEntry = require('../models/AccountingEntry');

    // 2. Fetch Customers & Finished Fabric Item
    const finishedItem = await Item.findOne({ companyId, name: 'Finished Fabric' });
    const b2bIntrastateCustomer = await Party.findOne({ companyId, gstin: '24BBBBB0000B1Z5' }) ||
                                 await Party.findOne({ companyId, name: /B2B Customer \(Intrastate/i });
    const b2bInterstateCustomer = await Party.findOne({ companyId, gstin: '27CCCCC0000C1Z5' }) ||
                                 await Party.findOne({ companyId, name: /Interstate/i });
    const b2cCustomer = await Party.findOne({ companyId, gstin: '' }) ||
                        await Party.findOne({ companyId, name: /B2C/i });
    const salesBook = await Book.findOne({ companyId, code: 'SB01' }) ||
                      await Book.findOne({ companyId, type: 'Sales' });

    if (!finishedItem || !b2bIntrastateCustomer || !b2bInterstateCustomer || !b2cCustomer) {
      throw new Error(`Masters missing! FinishedItem: ${!!finishedItem}, Intrastate: ${!!b2bIntrastateCustomer}, Interstate: ${!!b2bInterstateCustomer}, B2C: ${!!b2cCustomer}`);
    }

    // 3. Find Finished Fabric Lot created from Job Work
    const finishedLot = await InventoryLot.findOne({
      companyId,
      itemId: finishedItem._id,
      remainingMtrs: { $gte: 300 }
    }).sort({ createdAt: -1 });

    if (!finishedLot) {
      throw new Error('No Finished Fabric lot with available stock (>= 300m) found!');
    }

    const initialStock = finishedLot.remainingMtrs;
    console.log(`[1] Selected Finished Fabric Lot: ${finishedLot.lotId}, Remaining Stock: ${initialStock}m, Rate: ₹${finishedLot.rate}/m`);

    // ==========================================
    // TEST 5.1: Intrastate B2B Sale (300m @ ₹120/m, GST 5%)
    // ==========================================
    console.log('\n[2] Executing Intrastate B2B Sale (300m @ ₹120/m, GST 5%)...');
    const invoiceNo1 = `QA-INV-INTRA-${Date.now()}`;
    const intraSalePayload = {
      bookId: salesBook?._id?.toString(),
      customerId: b2bIntrastateCustomer._id.toString(),
      customerName: b2bIntrastateCustomer.name,
      invoiceNo: invoiceNo1,
      billNo: invoiceNo1,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      gstType: 'CGST+SGST',
      invoiceType: 'Tax',
      items: [
        {
          itemId: finishedItem._id.toString(),
          itemName: finishedItem.name,
          lotId: finishedLot._id.toString(),
          quantity: 300,
          meters: 300,
          mts: 300,
          pcs: 0,
          rate: 120,
          unit: 'MTRS',
          amount: 36000,
          taxableAmount: 36000,
          gstRate: 5,
          cgstRate: 2.5,
          sgstRate: 2.5,
          cgstAmount: 900,
          sgstAmount: 900,
          totalAmount: 37800
        }
      ],
      taxableAmount: 36000,
      cgst: 900,
      sgst: 900,
      igst: 0,
      gstAmount: 1800,
      netAmount: 37800
    };

    const intraRes = await req(`${BASE_URL}/sales`, {
      method: 'POST',
      body: JSON.stringify(intraSalePayload),
      ...authHeaders
    });

    console.log('Intrastate Sale Response Status:', intraRes.status);
    if (!intraRes.ok || !intraRes.data.success) {
      throw new Error('Intrastate sale failed: ' + JSON.stringify(intraRes.data));
    }

    const createdIntraSale = intraRes.data.data;
    console.log(`  -> Intrastate Invoice Created! ID: ${createdIntraSale._id}, InvoiceNo: ${createdIntraSale.invoiceNo}, Net: ₹${createdIntraSale.netAmount}`);
    if (createdIntraSale.cgst === 900 && createdIntraSale.sgst === 900 && createdIntraSale.netAmount === 37800) {
      results.push({ test: 'Intrastate B2B Tax Calculation', status: 'PASS', details: `Taxable=₹36000, CGST=₹900, SGST=₹900, Net=₹37800` });
    } else {
      results.push({ test: 'Intrastate B2B Tax Calculation', status: 'FAIL', details: `CGST=${createdIntraSale.cgst}, SGST=${createdIntraSale.sgst}, Net=${createdIntraSale.netAmount}` });
    }

    // Verify Stock Reduction for Intrastate Sale
    const lotAfterIntra = await InventoryLot.findById(finishedLot._id);
    console.log(`  -> Finished Lot Stock after Intrastate Sale: ${lotAfterIntra.remainingMtrs}m (Expected: ${initialStock - 300}m)`);
    if (Math.abs(lotAfterIntra.remainingMtrs - (initialStock - 300)) < 0.01) {
      results.push({ test: 'Intrastate Sale Stock Deduction', status: 'PASS', details: `Deducted 300m: remaining ${lotAfterIntra.remainingMtrs}m` });
    } else {
      results.push({ test: 'Intrastate Sale Stock Deduction', status: 'FAIL', details: `Expected ${initialStock - 300}m, got ${lotAfterIntra.remainingMtrs}m` });
    }

    // Verify Accounting for Intrastate Sale
    const intraJournal = await AccountingEntry.findOne({
      companyId,
      $or: [{ _id: createdIntraSale.accountingEntryId }, { refId: createdIntraSale._id }]
    });

    if (intraJournal) {
      console.log(`  -> Intrastate Journal: ${intraJournal.entryNo || intraJournal.voucherNo}`);
      let dr = 0, cr = 0;
      for (const line of intraJournal.lines || []) {
        const d = line.type === 'Dr' ? (line.amount || line.debit || 0) : 0;
        const c = line.type === 'Cr' ? (line.amount || line.credit || 0) : 0;
        console.log(`     Line: ${line.accountName || line.ledgerName || line.ledgerId} | DR: ₹${d} | CR: ₹${c}`);
        dr += d;
        cr += c;
      }
      console.log(`  -> Total DR = ₹${dr} | Total CR = ₹${cr}`);
      if (Math.abs(dr - cr) < 0.01 && Math.abs(dr - 37800) < 0.01) {
        results.push({ test: 'Intrastate Double-Entry Journal', status: 'PASS', details: `Total DR: ₹${dr} == Total CR: ₹${cr}` });
      } else {
        results.push({ test: 'Intrastate Double-Entry Journal', status: 'FAIL', details: `DR: ₹${dr} != CR: ₹${cr}` });
      }
    } else {
      results.push({ test: 'Intrastate Double-Entry Journal', status: 'FAIL', details: 'No journal entry found' });
    }

    // ==========================================
    // TEST 5.2: Interstate B2B Sale (100m @ ₹120/m, GST 5% -> IGST 5%)
    // ==========================================
    console.log('\n[3] Executing Interstate B2B Sale (100m @ ₹120/m, IGST 5%)...');
    const invoiceNo2 = `QA-INV-INTER-${Date.now()}`;
    const interSalePayload = {
      bookId: salesBook?._id?.toString(),
      customerId: b2bInterstateCustomer._id.toString(),
      customerName: b2bInterstateCustomer.name,
      invoiceNo: invoiceNo2,
      billNo: invoiceNo2,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      gstType: 'IGST',
      invoiceType: 'Tax',
      items: [
        {
          itemId: finishedItem._id.toString(),
          itemName: finishedItem.name,
          lotId: finishedLot._id.toString(),
          quantity: 100,
          meters: 100,
          mts: 100,
          pcs: 0,
          rate: 120,
          unit: 'MTRS',
          amount: 12000,
          taxableAmount: 12000,
          gstRate: 5,
          cgstRate: 0,
          sgstRate: 0,
          igstRate: 5,
          igstAmount: 600,
          totalAmount: 12600
        }
      ],
      taxableAmount: 12000,
      cgst: 0,
      sgst: 0,
      igst: 600,
      gstAmount: 600,
      netAmount: 12600
    };

    const interRes = await req(`${BASE_URL}/sales`, {
      method: 'POST',
      body: JSON.stringify(interSalePayload),
      ...authHeaders
    });

    console.log('Interstate Sale Response Status:', interRes.status);
    if (!interRes.ok || !interRes.data.success) {
      throw new Error('Interstate sale failed: ' + JSON.stringify(interRes.data));
    }

    const createdInterSale = interRes.data.data;
    console.log(`  -> Interstate Invoice Created! ID: ${createdInterSale._id}, InvoiceNo: ${createdInterSale.invoiceNo}, IGST: ₹${createdInterSale.igst}, Net: ₹${createdInterSale.netAmount}`);
    if (createdInterSale.igst === 600 && createdInterSale.cgst === 0 && createdInterSale.sgst === 0 && createdInterSale.netAmount === 12600) {
      results.push({ test: 'Interstate B2B IGST Determination', status: 'PASS', details: `Taxable=₹12000, IGST=₹600 (CGST/SGST=0), Net=₹12600` });
    } else {
      results.push({ test: 'Interstate B2B IGST Determination', status: 'FAIL', details: `IGST=${createdInterSale.igst}, CGST=${createdInterSale.cgst}, SGST=${createdInterSale.sgst}` });
    }

    // Verify Accounting for Interstate Sale
    const interJournal = await AccountingEntry.findOne({
      companyId,
      $or: [{ _id: createdInterSale.accountingEntryId }, { refId: createdInterSale._id }]
    });

    if (interJournal) {
      console.log(`  -> Interstate Journal: ${interJournal.entryNo || interJournal.voucherNo}`);
      let dr = 0, cr = 0;
      for (const line of interJournal.lines || []) {
        const d = line.type === 'Dr' ? (line.amount || line.debit || 0) : 0;
        const c = line.type === 'Cr' ? (line.amount || line.credit || 0) : 0;
        console.log(`     Line: ${line.accountName || line.ledgerName || line.ledgerId} | DR: ₹${d} | CR: ₹${c}`);
        dr += d;
        cr += c;
      }
      console.log(`  -> Total DR = ₹${dr} | Total CR = ₹${cr}`);
      if (Math.abs(dr - cr) < 0.01 && Math.abs(dr - 12600) < 0.01) {
        results.push({ test: 'Interstate Double-Entry Journal', status: 'PASS', details: `Total DR: ₹${dr} == Total CR: ₹${cr}` });
      } else {
        results.push({ test: 'Interstate Double-Entry Journal', status: 'FAIL', details: `DR: ₹${dr} != CR: ₹${cr}` });
      }
    } else {
      results.push({ test: 'Interstate Double-Entry Journal', status: 'FAIL', details: 'No journal entry found' });
    }

    // ==========================================
    // TEST 5.3: B2C Retail Sale (Unregistered Customer, 50m @ ₹120/m, GST 5%)
    // ==========================================
    console.log('\n[4] Executing B2C Retail Sale (50m @ ₹120/m, GST 5%)...');
    const invoiceNo3 = `QA-INV-B2C-${Date.now()}`;
    const b2cSalePayload = {
      bookId: salesBook?._id?.toString(),
      customerId: b2cCustomer._id.toString(),
      customerName: b2cCustomer.name,
      invoiceNo: invoiceNo3,
      billNo: invoiceNo3,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      gstType: 'CGST+SGST',
      invoiceType: 'Retail',
      items: [
        {
          itemId: finishedItem._id.toString(),
          itemName: finishedItem.name,
          lotId: finishedLot._id.toString(),
          quantity: 50,
          meters: 50,
          mts: 50,
          pcs: 0,
          rate: 120,
          unit: 'MTRS',
          amount: 6000,
          taxableAmount: 6000,
          gstRate: 5,
          cgstRate: 2.5,
          sgstRate: 2.5,
          cgstAmount: 150,
          sgstAmount: 150,
          totalAmount: 6300
        }
      ],
      taxableAmount: 6000,
      cgst: 150,
      sgst: 150,
      igst: 0,
      gstAmount: 300,
      netAmount: 6300
    };

    const b2cRes = await req(`${BASE_URL}/sales`, {
      method: 'POST',
      body: JSON.stringify(b2cSalePayload),
      ...authHeaders
    });

    console.log('B2C Sale Response Status:', b2cRes.status);
    if (!b2cRes.ok || !b2cRes.data.success) {
      throw new Error('B2C sale failed: ' + JSON.stringify(b2cRes.data));
    }

    const createdB2cSale = b2cRes.data.data;
    console.log(`  -> B2C Invoice Created! ID: ${createdB2cSale._id}, InvoiceNo: ${createdB2cSale.invoiceNo}, Net: ₹${createdB2cSale.netAmount}`);
    if (createdB2cSale.cgst === 150 && createdB2cSale.sgst === 150 && createdB2cSale.netAmount === 6300) {
      results.push({ test: 'B2C Retail Tax Determination', status: 'PASS', details: `Taxable=₹6000, CGST=₹150, SGST=₹150, Net=₹6300` });
    } else {
      results.push({ test: 'B2C Retail Tax Determination', status: 'FAIL', details: `Net=${createdB2cSale.netAmount}` });
    }

    // ==========================================
    // TEST 5.4: Finished Stock Lot FIFO Balance Verification
    // ==========================================
    console.log('\n[5] Verifying Finished Stock Balance after 3 Sales...');
    const lotFinal = await InventoryLot.findById(finishedLot._id);
    const expectedFinalStock = initialStock - 300 - 100 - 50;
    console.log(`  -> Finished Lot Initial: ${initialStock}m, Consumed: 450m (300+100+50), Remaining: ${lotFinal.remainingMtrs}m (Expected: ${expectedFinalStock}m)`);
    if (Math.abs(lotFinal.remainingMtrs - expectedFinalStock) < 0.01) {
      results.push({ test: 'Cumulative Finished Stock Deduction', status: 'PASS', details: `Remaining stock ${lotFinal.remainingMtrs}m matches exact balance (${initialStock}m - 450m)` });
    } else {
      results.push({ test: 'Cumulative Finished Stock Deduction', status: 'FAIL', details: `Expected ${expectedFinalStock}m, got ${lotFinal.remainingMtrs}m` });
    }

    console.log('\n=== PHASE 5 SUMMARY ===');
    console.table(results);

  } catch (err) {
    console.error('Phase 5 Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runPhase5();
