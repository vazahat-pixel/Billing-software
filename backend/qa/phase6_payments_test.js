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

async function runPhase6() {
  console.log('=== STARTING PHASE 6: PAYMENTS, RECEIPTS & BANK/CASH VERIFICATION ===');
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
    const LedgerMaster = require('../models/LedgerMaster');
    const Sales = require('../models/Sales');
    const Purchase = require('../models/Purchase');
    const AccountingEntry = require('../models/AccountingEntry');

    // 2. Fetch Bank & Cash Ledgers + Parties
    const bankLedger = await LedgerMaster.findOne({ companyId, accountType: 'Bank' }) ||
                       await LedgerMaster.findOne({ companyId, name: /Bank/i });
    const cashLedger = await LedgerMaster.findOne({ companyId, accountType: 'Cash' }) ||
                       await LedgerMaster.findOne({ companyId, name: /Cash/i });

    const customer = await Party.findOne({ companyId, gstin: '24BBBBB0000B1Z5' }) ||
                     await Party.findOne({ companyId, name: /B2B Customer/i });
    const supplier = await Party.findOne({ companyId, gstin: '24AAAAA0000A1Z5' }) ||
                     await Party.findOne({ companyId, name: /Supplier/i });
    const jobWorker = await Party.findOne({ companyId, name: /Job Worker|Worker|Dyer/i });

    const customerLedger = await LedgerMaster.findOne({ companyId, linkedPartyId: customer._id }) ||
                           await LedgerMaster.findOne({ companyId, name: customer.name });
    const supplierLedger = await LedgerMaster.findOne({ companyId, linkedPartyId: supplier._id }) ||
                           await LedgerMaster.findOne({ companyId, name: supplier.name });
    const jobWorkerLedger = await LedgerMaster.findOne({ companyId, linkedPartyId: jobWorker._id }) ||
                            await LedgerMaster.findOne({ companyId, name: jobWorker.name });

    if (!bankLedger || !cashLedger || !customerLedger || !supplierLedger || !jobWorkerLedger) {
      throw new Error(`Ledgers missing! Bank: ${!!bankLedger}, Cash: ${!!cashLedger}, CustLedger: ${!!customerLedger}, SuppLedger: ${!!supplierLedger}, JobLedger: ${!!jobWorkerLedger}`);
    }

    // ==========================================
    // TEST 6.1: Customer Partial Receipt (Bank - NEFT ₹20,000)
    // ==========================================
    console.log('[1] Executing Customer Partial Receipt (₹20,000 via Bank NEFT)...');
    const receipt1Payload = {
      partyLedgerId: customerLedger._id.toString(),
      bankCashLedgerId: bankLedger._id.toString(),
      amount: 20000,
      paymentMode: 'NEFT',
      utrNo: `UTR-NEFT-${Date.now()}`,
      accBill: 'A',
      date: new Date().toISOString().split('T')[0],
      narration: 'QA Customer Partial Payment NEFT'
    };

    const rcpt1Res = await req(`${BASE_URL}/accounting/receipts`, {
      method: 'POST',
      body: JSON.stringify(receipt1Payload),
      ...authHeaders
    });

    console.log('Customer Receipt 1 Response Status:', rcpt1Res.status);
    if (!rcpt1Res.ok || !rcpt1Res.data.success) {
      throw new Error('Customer receipt 1 failed: ' + JSON.stringify(rcpt1Res.data));
    }

    const rcpt1 = rcpt1Res.data.data;
    console.log(`  -> Receipt Voucher 1 Created! Voucher: ${rcpt1.voucherNo}, Amount: ₹${rcpt1.amount}`);
    results.push({ test: 'Customer Partial Bank Receipt', status: 'PASS', details: `Voucher ${rcpt1.voucherNo}: ₹20000 received via Bank NEFT` });

    // ==========================================
    // TEST 6.2: Customer Settlement Receipt (Cash ₹17,800)
    // ==========================================
    console.log('\n[2] Executing Customer Settlement Receipt (₹17,800 via Cash)...');
    const receipt2Payload = {
      partyLedgerId: customerLedger._id.toString(),
      bankCashLedgerId: cashLedger._id.toString(),
      amount: 17800,
      paymentMode: 'Cash',
      accBill: 'A',
      date: new Date().toISOString().split('T')[0],
      narration: 'QA Customer Settlement Cash'
    };

    const rcpt2Res = await req(`${BASE_URL}/accounting/receipts`, {
      method: 'POST',
      body: JSON.stringify(receipt2Payload),
      ...authHeaders
    });

    console.log('Customer Receipt 2 Response Status:', rcpt2Res.status);
    if (!rcpt2Res.ok || !rcpt2Res.data.success) {
      throw new Error('Customer receipt 2 failed: ' + JSON.stringify(rcpt2Res.data));
    }

    const rcpt2 = rcpt2Res.data.data;
    console.log(`  -> Receipt Voucher 2 Created! Voucher: ${rcpt2.voucherNo}, Amount: ₹${rcpt2.amount}`);
    results.push({ test: 'Customer Settlement Cash Receipt', status: 'PASS', details: `Voucher ${rcpt2.voucherNo}: ₹17800 received via Cash` });

    // ==========================================
    // TEST 6.3: Supplier Payment (Bank - RTGS ₹52,500)
    // ==========================================
    console.log('\n[3] Executing Supplier Payment (₹52,500 via Bank RTGS)...');
    const payment1Payload = {
      partyLedgerId: supplierLedger._id.toString(),
      bankCashLedgerId: bankLedger._id.toString(),
      amount: 52500,
      paymentMode: 'RTGS',
      utrNo: `UTR-RTGS-${Date.now()}`,
      accBill: 'A',
      date: new Date().toISOString().split('T')[0],
      narration: 'QA Supplier Payment RTGS'
    };

    const pmt1Res = await req(`${BASE_URL}/accounting/payments`, {
      method: 'POST',
      body: JSON.stringify(payment1Payload),
      ...authHeaders
    });

    console.log('Supplier Payment Response Status:', pmt1Res.status);
    if (!pmt1Res.ok || !pmt1Res.data.success) {
      throw new Error('Supplier payment failed: ' + JSON.stringify(pmt1Res.data));
    }

    const pmt1 = pmt1Res.data.data;
    console.log(`  -> Payment Voucher 1 Created! Voucher: ${pmt1.voucherNo}, Amount: ₹${pmt1.amount}`);
    results.push({ test: 'Supplier Bank Payment', status: 'PASS', details: `Voucher ${pmt1.voucherNo}: ₹52500 paid via Bank RTGS` });

    // ==========================================
    // TEST 6.4: Job Worker Payment (Bank ₹6,090)
    // ==========================================
    console.log('\n[4] Executing Job Worker Payment (₹6,090 via Bank)...');
    const payment2Payload = {
      partyLedgerId: jobWorkerLedger._id.toString(),
      bankCashLedgerId: bankLedger._id.toString(),
      amount: 6090,
      paymentMode: 'NEFT',
      utrNo: `UTR-JW-${Date.now()}`,
      accBill: 'A',
      date: new Date().toISOString().split('T')[0],
      narration: 'QA Job Worker Charges Payment'
    };

    const pmt2Res = await req(`${BASE_URL}/accounting/payments`, {
      method: 'POST',
      body: JSON.stringify(payment2Payload),
      ...authHeaders
    });

    console.log('Job Worker Payment Response Status:', pmt2Res.status);
    if (!pmt2Res.ok || !pmt2Res.data.success) {
      throw new Error('Job worker payment failed: ' + JSON.stringify(pmt2Res.data));
    }

    const pmt2 = pmt2Res.data.data;
    console.log(`  -> Payment Voucher 2 Created! Voucher: ${pmt2.voucherNo}, Amount: ₹${pmt2.amount}`);
    results.push({ test: 'Job Worker Bank Payment', status: 'PASS', details: `Voucher ${pmt2.voucherNo}: ₹6090 paid via Bank` });

    // ==========================================
    // TEST 6.5: Verify Double-Entry Balance for All Payment/Receipt Vouchers
    // ==========================================
    console.log('\n[5] Verifying Double-Entry Accounting on All Payment & Receipt Vouchers...');
    const vouchers = [rcpt1, rcpt2, pmt1, pmt2];
    let allBalanced = true;

    for (const v of vouchers) {
      const jnl = await AccountingEntry.findOne({ companyId, refId: v._id }) ||
                  await AccountingEntry.findOne({ companyId, voucherNo: v.voucherNo });
      if (jnl) {
        let dr = 0, cr = 0;
        for (const line of jnl.lines || []) {
          dr += (line.type === 'Dr' ? (line.amount || line.debit || 0) : 0);
          cr += (line.type === 'Cr' ? (line.amount || line.credit || 0) : 0);
        }
        console.log(`  -> Voucher ${v.voucherNo}: DR=₹${dr}, CR=₹${cr} (Balanced: ${Math.abs(dr - cr) < 0.01})`);
        if (Math.abs(dr - cr) > 0.01 || Math.abs(dr - v.amount) > 0.01) {
          allBalanced = false;
        }
      }
    }

    if (allBalanced) {
      results.push({ test: 'Payment & Receipt Double-Entry', status: 'PASS', details: 'All vouchers perfectly balanced: Total DR == Total CR' });
    } else {
      results.push({ test: 'Payment & Receipt Double-Entry', status: 'FAIL', details: 'Unbalanced voucher journal detected' });
    }

    console.log('\n=== PHASE 6 SUMMARY ===');
    console.table(results);

  } catch (err) {
    console.error('Phase 6 Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runPhase6();
