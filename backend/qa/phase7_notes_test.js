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

async function runPhase7() {
  console.log('=== STARTING PHASE 7: CREDIT NOTE & DEBIT NOTE VERIFICATION ===');
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
    const Sales = require('../models/Sales');
    const Purchase = require('../models/Purchase');
    const InventoryLot = require('../models/InventoryLot');
    const AccountingEntry = require('../models/AccountingEntry');
    const DebitCreditNote = require('../models/DebitCreditNote');

    // 2. Fetch Masters & Recent Documents
    const customer = await Party.findOne({ companyId, gstin: '24BBBBB0000B1Z5' }) ||
                     await Party.findOne({ companyId, name: /B2B Customer/i });
    const supplier = await Party.findOne({ companyId, gstin: '24AAAAA0000A1Z5' }) ||
                     await Party.findOne({ companyId, name: /Supplier/i });
    const finishedItem = await Item.findOne({ companyId, name: 'Finished Fabric' });
    const finishedLot = await InventoryLot.findOne({ companyId, itemId: finishedItem._id }).sort({ createdAt: -1 });

    const recentSale = await Sales.findOne({ companyId, customerId: customer._id }).sort({ createdAt: -1 });
    const recentPurchase = await Purchase.findOne({ companyId, supplierId: supplier._id }).sort({ createdAt: -1 });

    // ==========================================
    // TEST 7.1: Financial Sales Credit Note (Rate Difference ₹2,000 + GST 5%)
    // ==========================================
    console.log('[1] Executing Financial Sales Credit Note (Rate Difference ₹2,000 + GST 5%)...');
    const cnPayload = {
      noteType: 'Credit',
      noteSide: 'Sales',
      partyId: customer._id.toString(),
      partyName: customer.name,
      reason: 'Rate Difference',
      amount: 2000,
      amountMode: 'Exclusive',
      taxableAmount: 2000,
      gstRate: 5,
      cgst: 50,
      sgst: 50,
      igst: 0,
      gstAmount: 100,
      totalAmount: 2100,
      netAmount: 2100,
      gstType: 'CGST+SGST',
      status: 'Posted',
      date: new Date().toISOString().split('T')[0],
      originalBillNo: recentSale?.invoiceNo || '',
      originalBillId: recentSale?._id?.toString() || undefined,
      narration: 'QA Financial Rate Difference Credit Note'
    };

    const cnRes = await req(`${BASE_URL}/notes`, {
      method: 'POST',
      body: JSON.stringify(cnPayload),
      ...authHeaders
    });

    console.log('Credit Note Response Status:', cnRes.status);
    if (!cnRes.ok || !cnRes.data.success) {
      throw new Error('Credit note failed: ' + JSON.stringify(cnRes.data));
    }

    const createdCn = cnRes.data.data;
    console.log(`  -> Credit Note Created! NoteNo: ${createdCn.noteNo}, Net: ₹${createdCn.netAmount || createdCn.totalAmount}`);
    results.push({ test: 'Sales Credit Note Creation', status: 'PASS', details: `Note ${createdCn.noteNo}: Taxable ₹2000, GST ₹100, Net ₹2100` });

    // Verify Double-Entry for Sales Credit Note
    const cnJournal = await AccountingEntry.findOne({
      companyId,
      $or: [{ refId: createdCn._id }, { voucherNo: createdCn.noteNo }]
    });

    if (cnJournal) {
      console.log(`  -> CN Journal: ${cnJournal.entryNo || cnJournal.voucherNo}`);
      let dr = 0, cr = 0;
      for (const line of cnJournal.lines || []) {
        const d = line.type === 'Dr' ? (line.amount || line.debit || 0) : 0;
        const c = line.type === 'Cr' ? (line.amount || line.credit || 0) : 0;
        console.log(`     Line: ${line.accountName || line.ledgerName || line.ledgerId} | DR: ₹${d} | CR: ₹${c}`);
        dr += d;
        cr += c;
      }
      console.log(`  -> Total DR = ₹${dr} | Total CR = ₹${cr}`);
      if (Math.abs(dr - cr) < 0.01 && Math.abs(dr - 2100) < 0.01) {
        results.push({ test: 'Sales Credit Note Accounting', status: 'PASS', details: `Total DR: ₹${dr} == Total CR: ₹${cr}` });
      } else {
        results.push({ test: 'Sales Credit Note Accounting', status: 'FAIL', details: `DR: ₹${dr} != CR: ₹${cr}` });
      }
    } else {
      results.push({ test: 'Sales Credit Note Accounting', status: 'FAIL', details: 'No journal entry found for Credit Note' });
    }

    // ==========================================
    // TEST 7.2: Purchase Debit Note (Rate Difference ₹1,000 + GST 5%)
    // ==========================================
    console.log('\n[2] Executing Purchase Debit Note (Rate Difference ₹1,000 + GST 5%)...');
    const dnPayload = {
      noteType: 'Debit',
      noteSide: 'Purchase',
      partyId: supplier._id.toString(),
      partyName: supplier.name,
      reason: 'Rate Difference',
      amount: 1000,
      amountMode: 'Exclusive',
      taxableAmount: 1000,
      gstRate: 5,
      cgst: 25,
      sgst: 25,
      igst: 0,
      gstAmount: 50,
      totalAmount: 1050,
      netAmount: 1050,
      gstType: 'CGST+SGST',
      status: 'Posted',
      date: new Date().toISOString().split('T')[0],
      originalBillNo: recentPurchase?.invoiceNo || '',
      originalBillId: recentPurchase?._id?.toString() || undefined,
      narration: 'QA Purchase Rate Difference Debit Note'
    };

    const dnRes = await req(`${BASE_URL}/notes`, {
      method: 'POST',
      body: JSON.stringify(dnPayload),
      ...authHeaders
    });

    console.log('Debit Note Response Status:', dnRes.status);
    if (!dnRes.ok || !dnRes.data.success) {
      throw new Error('Debit note failed: ' + JSON.stringify(dnRes.data));
    }

    const createdDn = dnRes.data.data;
    console.log(`  -> Debit Note Created! NoteNo: ${createdDn.noteNo}, Net: ₹${createdDn.netAmount || createdDn.totalAmount}`);
    results.push({ test: 'Purchase Debit Note Creation', status: 'PASS', details: `Note ${createdDn.noteNo}: Taxable ₹1000, GST ₹50, Net ₹1050` });

    // Verify Double-Entry for Purchase Debit Note
    const dnJournal = await AccountingEntry.findOne({
      companyId,
      $or: [{ refId: createdDn._id }, { voucherNo: createdDn.noteNo }]
    });

    if (dnJournal) {
      console.log(`  -> DN Journal: ${dnJournal.entryNo || dnJournal.voucherNo}`);
      let dr = 0, cr = 0;
      for (const line of dnJournal.lines || []) {
        const d = line.type === 'Dr' ? (line.amount || line.debit || 0) : 0;
        const c = line.type === 'Cr' ? (line.amount || line.credit || 0) : 0;
        console.log(`     Line: ${line.accountName || line.ledgerName || line.ledgerId} | DR: ₹${d} | CR: ₹${c}`);
        dr += d;
        cr += c;
      }
      console.log(`  -> Total DR = ₹${dr} | Total CR = ₹${cr}`);
      if (Math.abs(dr - cr) < 0.01 && Math.abs(dr - 1050) < 0.01) {
        results.push({ test: 'Purchase Debit Note Accounting', status: 'PASS', details: `Total DR: ₹${dr} == Total CR: ₹${cr}` });
      } else {
        results.push({ test: 'Purchase Debit Note Accounting', status: 'FAIL', details: `DR: ₹${dr} != CR: ₹${cr}` });
      }
    } else {
      results.push({ test: 'Purchase Debit Note Accounting', status: 'FAIL', details: 'No journal entry found for Debit Note' });
    }

    // ==========================================
    // TEST 7.3: Physical Sales Return (20m @ ₹120/m = ₹2,400 + GST 5% = ₹2,520 with Stock Impact)
    // ==========================================
    console.log('\n[3] Executing Physical Sales Return (20m Finished Fabric)...');
    const initialLotStock = finishedLot.remainingMtrs;
    const returnPayload = {
      returnType: 'Sales',
      partyId: customer._id.toString(),
      partyName: customer.name,
      originalInvoiceNo: recentSale?.invoiceNo || '',
      originalSaleId: recentSale?._id?.toString() || undefined,
      date: new Date().toISOString().split('T')[0],
      gstType: 'CGST+SGST',
      gstRate: 5,
      items: [
        {
          itemId: finishedItem._id.toString(),
          itemName: finishedItem.name,
          lotId: finishedLot._id.toString(),
          quantity: 20,
          meters: 20,
          mts: 20,
          pcs: 0,
          rate: 120,
          unit: 'MTRS',
          amount: 2400,
          taxableAmount: 2400,
          gstRate: 5,
          cgstRate: 2.5,
          sgstRate: 2.5,
          cgstAmount: 60,
          sgstAmount: 60,
          totalAmount: 2520
        }
      ],
      taxableAmount: 2400,
      gstAmount: 120,
      cgst: 60,
      sgst: 60,
      igst: 0,
      netAmount: 2520
    };

    const retRes = await req(`${BASE_URL}/returns`, {
      method: 'POST',
      body: JSON.stringify(returnPayload),
      ...authHeaders
    });

    console.log('Return Response Status:', retRes.status);
    if (!retRes.ok || !retRes.data.success) {
      throw new Error('Return creation failed: ' + JSON.stringify(retRes.data));
    }

    const createdRet = retRes.data.data;
    console.log(`  -> Sales Return Created! InvoiceNo: ${createdRet.invoiceNo}, Net: ₹${createdRet.netAmount}`);
    results.push({ test: 'Physical Sales Return Creation', status: 'PASS', details: `Return ${createdRet.invoiceNo}: 20m @ ₹120/m returned` });

    // Verify Stock Restoration (+20m)
    const lotAfterReturn = await InventoryLot.findById(finishedLot._id);
    const expectedStock = initialLotStock + 20;
    console.log(`  -> Finished Lot Stock after Return: ${lotAfterReturn.remainingMtrs}m (Expected: ${expectedStock}m)`);
    if (Math.abs(lotAfterReturn.remainingMtrs - expectedStock) < 0.01) {
      results.push({ test: 'Sales Return Stock Restoration', status: 'PASS', details: `Stock increased from ${initialLotStock}m to ${lotAfterReturn.remainingMtrs}m (+20m)` });
    } else {
      results.push({ test: 'Sales Return Stock Restoration', status: 'FAIL', details: `Expected ${expectedStock}m, got ${lotAfterReturn.remainingMtrs}m` });
    }

    console.log('\n=== PHASE 7 SUMMARY ===');
    console.table(results);

  } catch (err) {
    console.error('Phase 7 Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runPhase7();
