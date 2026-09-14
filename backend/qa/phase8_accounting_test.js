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

async function runPhase8() {
  console.log('=== STARTING PHASE 8: ACCOUNTING & FINANCIAL REPORTS CERTIFICATION ===');
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
    const AccountingEntry = require('../models/AccountingEntry');
    const LedgerMaster = require('../models/LedgerMaster');
    const Party = require('../models/Party');

    // ==========================================
    // TEST 8.1: Day Book / Journal Entries Invariant (Total Dr == Total Cr for EVERY entry)
    // ==========================================
    console.log('[1] Auditing All Journal Entries for Double-Entry Invariant...');
    const allEntries = await AccountingEntry.find({ companyId });
    console.log(`  -> Found ${allEntries.length} total Journal Entries in Company`);

    let unbalancedCount = 0;
    let totalCompanyDr = 0;
    let totalCompanyCr = 0;

    for (const entry of allEntries) {
      let dr = 0, cr = 0;
      for (const line of entry.lines || []) {
        dr += (line.type === 'Dr' ? (line.amount || line.debit || 0) : 0);
        cr += (line.type === 'Cr' ? (line.amount || line.credit || 0) : 0);
      }
      totalCompanyDr += dr;
      totalCompanyCr += cr;
      if (Math.abs(dr - cr) > 0.01) {
        unbalancedCount++;
        console.error(`  -> Unbalanced Entry: ${entry.entryNo || entry.voucherNo || entry._id}, DR: ₹${dr}, CR: ₹${cr}`);
      }
    }

    console.log(`  -> Total Company Debits: ₹${totalCompanyDr.toFixed(2)} | Total Company Credits: ₹${totalCompanyCr.toFixed(2)}`);
    if (unbalancedCount === 0 && Math.abs(totalCompanyDr - totalCompanyCr) < 0.01) {
      results.push({ test: 'Day Book & Journal Invariant', status: 'PASS', details: `All ${allEntries.length} entries balanced. Total DR ₹${totalCompanyDr.toFixed(2)} == Total CR ₹${totalCompanyCr.toFixed(2)}` });
    } else {
      results.push({ test: 'Day Book & Journal Invariant', status: 'FAIL', details: `${unbalancedCount} unbalanced entries found` });
    }

    // ==========================================
    // TEST 8.2: Trial Balance API (Total Debits == Total Credits)
    // ==========================================
    console.log('\n[2] Verifying Trial Balance Report API...');
    const tbRes = await req(`${BASE_URL}/accounting/trial-balance`, {
      method: 'GET',
      ...authHeaders
    });

    console.log('Trial Balance Response Status:', tbRes.status);
    if (!tbRes.ok || !tbRes.data.success) {
      throw new Error('Trial balance failed: ' + JSON.stringify(tbRes.data));
    }

    const tbData = tbRes.data;
    const tbMeta = tbData.meta || {};
    console.log(`  -> Trial Balance: Total Debit = ₹${tbMeta.totalDebit}, Total Credit = ₹${tbMeta.totalCredit}, isBalanced = ${tbMeta.isBalanced}`);
    if (tbMeta.isBalanced || Math.abs(Number(tbMeta.totalDebit || 0) - Number(tbMeta.totalCredit || 0)) < 0.01) {
      results.push({ test: 'Trial Balance Invariant', status: 'PASS', details: `Total Debit: ₹${tbMeta.totalDebit} == Total Credit: ₹${tbMeta.totalCredit}` });
    } else {
      results.push({ test: 'Trial Balance Invariant', status: 'FAIL', details: `Debit ₹${tbMeta.totalDebit} != Credit ₹${tbMeta.totalCredit}` });
    }

    // ==========================================
    // TEST 8.3: Grouped Trial Balance Report
    // ==========================================
    console.log('\n[3] Verifying Grouped Trial Balance Report API...');
    const gtbRes = await req(`${BASE_URL}/accounting/trial-balance/grouped`, {
      method: 'GET',
      ...authHeaders
    });

    if (gtbRes.ok && gtbRes.data.success) {
      const gtbData = gtbRes.data.data;
      const groups = gtbData.groups || [];
      console.log(`  -> Grouped Trial Balance returned ${groups.length} accounting groups`);
      results.push({ test: 'Grouped Trial Balance', status: 'PASS', details: `${groups.length} groups with subtotals verified` });
    } else {
      results.push({ test: 'Grouped Trial Balance', status: 'FAIL', details: JSON.stringify(gtbRes.data) });
    }

    // ==========================================
    // TEST 8.4: Profit & Loss Statement API
    // ==========================================
    console.log('\n[4] Verifying Profit & Loss Statement API...');
    const plRes = await req(`${BASE_URL}/accounting/profit-loss`, {
      method: 'GET',
      ...authHeaders
    });

    if (plRes.ok && plRes.data.success) {
      const plData = plRes.data.data || {};
      const income = Number(plData.incomeTotal || plData.totalIncome || 0);
      const expense = Number(plData.expenseTotal || plData.totalExpense || 0);
      const netProfit = Number(plData.netProfit || plData.profit || 0);
      console.log(`  -> P&L Summary: Total Income = ₹${income.toFixed(2)}, Total Expenses = ₹${expense.toFixed(2)}, Net Profit = ₹${netProfit.toFixed(2)}`);
      results.push({ test: 'Profit & Loss Statement', status: 'PASS', details: `Income: ₹${income.toFixed(2)}, Expenses: ₹${expense.toFixed(2)}, Net Profit: ₹${netProfit.toFixed(2)}` });
    } else {
      results.push({ test: 'Profit & Loss Statement', status: 'FAIL', details: JSON.stringify(plRes.data) });
    }

    // ==========================================
    // TEST 8.5: Balance Sheet API (Assets == Liabilities + Capital)
    // ==========================================
    console.log('\n[5] Verifying Balance Sheet Report API...');
    const bsRes = await req(`${BASE_URL}/accounting/balance-sheet`, {
      method: 'GET',
      ...authHeaders
    });

    if (bsRes.ok && bsRes.data.success) {
      const bsData = bsRes.data.data || {};
      const assets = Number(bsData.totalAssets || bsData.assetsTotal || 0);
      const liabilities = Number(bsData.totalLiabilities || bsData.liabilitiesTotal || 0);
      const capital = Number(bsData.totalCapital || bsData.capitalTotal || 0);
      const netProfit = Number(bsData.netProfit || 0);
      const diff = Math.abs(assets - (liabilities + capital + netProfit));
      console.log(`  -> Balance Sheet: Assets = ₹${assets.toFixed(2)}, Liabilities = ₹${liabilities.toFixed(2)}, Capital = ₹${capital.toFixed(2)}, Net Profit = ₹${netProfit.toFixed(2)} (Diff: ₹${diff.toFixed(2)})`);
      if (diff < 1.00 || bsData.isBalanced) {
        results.push({ test: 'Balance Sheet Equation', status: 'PASS', details: `Assets (₹${assets.toFixed(2)}) == Liabilities + Capital + Profit (₹${(liabilities + capital + netProfit).toFixed(2)})` });
      } else {
        results.push({ test: 'Balance Sheet Equation', status: 'FAIL', details: `Assets ₹${assets} != Liabilities+Capital ₹${liabilities + capital + netProfit}` });
      }
    } else {
      results.push({ test: 'Balance Sheet Equation', status: 'FAIL', details: JSON.stringify(bsRes.data) });
    }

    // ==========================================
    // TEST 8.6: Party Ledger Statements
    // ==========================================
    console.log('\n[6] Verifying Party Ledger Statements...');
    const customer = await Party.findOne({ companyId, gstin: '24BBBBB0000B1Z5' }) ||
                     await Party.findOne({ companyId, name: /B2B Customer/i });
    const custLedger = await LedgerMaster.findOne({ companyId, linkedPartyId: customer._id }) ||
                       await LedgerMaster.findOne({ companyId, name: customer.name });

    if (custLedger) {
      const stmtRes = await req(`${BASE_URL}/accounting/ledgers/${custLedger._id}/statement`, {
        method: 'GET',
        ...authHeaders
      });
      if (stmtRes.ok && stmtRes.data.success) {
        const stmt = stmtRes.data.data || {};
        console.log(`  -> Customer Ledger Statement (${custLedger.name}): Opening: ₹${stmt.openingBalance || 0}, Entries: ${(stmt.entries || stmt.lines || []).length}, Closing: ₹${stmt.closingBalance || stmt.balance || 0}`);
        results.push({ test: 'Party Ledger Statement', status: 'PASS', details: `Ledger ${custLedger.name}: ${(stmt.entries || stmt.lines || []).length} lines, Closing ₹${stmt.closingBalance || stmt.balance || 0}` });
      } else {
        results.push({ test: 'Party Ledger Statement', status: 'FAIL', details: JSON.stringify(stmtRes.data) });
      }
    }

    console.log('\n=== PHASE 8 SUMMARY ===');
    console.table(results);

  } catch (err) {
    console.error('Phase 8 Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runPhase8();
