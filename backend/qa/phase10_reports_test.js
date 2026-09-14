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

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runPhase10() {
  console.log('=== STARTING PHASE 10: REPORT & EXPORT CERTIFICATION ===');
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

    // 10.1 Stock Report
    console.log('[1] Verifying Stock Report...');
    const stockRes = await req(`${BASE_URL}/reports/stock?companyId=${companyId}`, { ...authHeaders });
    assert(stockRes.status === 200, `Stock report returned status ${stockRes.status}`);
    assert(stockRes.data?.success === true, 'Stock report success should be true');
    const stockData = stockRes.data?.data;
    console.log('  Stock Report Items:', Array.isArray(stockData) ? stockData.length : Object.keys(stockData || {}));
    results.push({ test: 'Stock Report Verification', status: 'PASS' });

    // 10.2 Sales Register
    console.log('[2] Verifying Sales Register...');
    const salesRes = await req(`${BASE_URL}/reports/sales?companyId=${companyId}`, { ...authHeaders });
    assert(salesRes.status === 200, `Sales register returned status ${salesRes.status}`);
    assert(salesRes.data?.success === true, 'Sales register success should be true');
    const salesData = salesRes.data?.data;
    console.log('  Sales Register entries:', Array.isArray(salesData) ? salesData.length : 'Object');
    results.push({ test: 'Sales Register Verification', status: 'PASS' });

    // 10.3 Purchase Register
    console.log('[3] Verifying Purchase Register...');
    const purRes = await req(`${BASE_URL}/reports/purchases?companyId=${companyId}`, { ...authHeaders });
    assert(purRes.status === 200, `Purchase register returned status ${purRes.status}`);
    assert(purRes.data?.success === true, 'Purchase register success should be true');
    const purData = purRes.data?.data;
    console.log('  Purchase Register entries:', Array.isArray(purData) ? purData.length : 'Object');
    results.push({ test: 'Purchase Register Verification', status: 'PASS' });

    // 10.4 Outstanding Receivables & Payables
    console.log('[4] Verifying Outstanding Reports...');
    const recvRes = await req(`${BASE_URL}/reports/outstanding?companyId=${companyId}&type=receivable`, { ...authHeaders });
    assert(recvRes.status === 200, `Receivables returned status ${recvRes.status}`);
    assert(recvRes.data?.success === true, 'Receivables success should be true');

    const payRes = await req(`${BASE_URL}/reports/outstanding?companyId=${companyId}&type=payable`, { ...authHeaders });
    assert(payRes.status === 200, `Payables returned status ${payRes.status}`);
    assert(payRes.data?.success === true, 'Payables success should be true');

    const filterOptsRes = await req(`${BASE_URL}/reports/outstanding/filter-options?companyId=${companyId}&type=receivable`, { ...authHeaders });
    assert(filterOptsRes.status === 200, `Outstanding filter options returned status ${filterOptsRes.status}`);
    results.push({ test: 'Outstanding Receivables & Payables Verification', status: 'PASS' });

    // 10.5 Job Work Report
    console.log('[5] Verifying Job Work Process Report...');
    const jwRes = await req(`${BASE_URL}/reports/jobwork?companyId=${companyId}`, { ...authHeaders });
    assert(jwRes.status === 200, `Job work report returned status ${jwRes.status}`);
    assert(jwRes.data?.success === true, 'Job work report success should be true');
    results.push({ test: 'Job Work Process Report Verification', status: 'PASS' });

    // 10.6 Profit & Loss Report
    console.log('[6] Verifying Profit & Loss Report...');
    const plRes = await req(`${BASE_URL}/reports/pl?companyId=${companyId}`, { ...authHeaders });
    assert(plRes.status === 200, `P&L report returned status ${plRes.status}`);
    assert(plRes.data?.success === true, 'P&L report success should be true');
    console.log('  P&L data summary:', plRes.data?.data);
    results.push({ test: 'Profit & Loss Statement Report Verification', status: 'PASS' });

    // 10.7 Daily Transactions & Master Summary
    console.log('[7] Verifying Daily Transactions & Master Summary...');
    const dailyRes = await req(`${BASE_URL}/reports/daily?companyId=${companyId}`, { ...authHeaders });
    assert(dailyRes.status === 200, `Daily report returned status ${dailyRes.status}`);
    assert(dailyRes.data?.success === true, 'Daily report success should be true');

    const masterRes = await req(`${BASE_URL}/reports/masters?companyId=${companyId}`, { ...authHeaders });
    assert(masterRes.status === 200, `Master summary returned status ${masterRes.status}`);
    assert(masterRes.data?.success === true, 'Master summary success should be true');
    results.push({ test: 'Daily Transactions & Master Summary Verification', status: 'PASS' });

    // 10.8 Report Bundle (Aggregated Reporting)
    console.log('[8] Verifying Aggregated Report Bundle...');
    const bundleRes = await req(`${BASE_URL}/reports/bundle?companyId=${companyId}`, { ...authHeaders });
    assert(bundleRes.status === 200, `Report bundle returned status ${bundleRes.status}`);
    assert(bundleRes.data?.success === true, 'Report bundle success should be true');
    console.log('  Bundle sections present:', Object.keys(bundleRes.data?.data || {}));
    results.push({ test: 'Aggregated Report Bundle Verification', status: 'PASS' });

    console.log('\n==================================================');
    console.log('🏆 ALL PHASE 10 REPORT & EXPORT CERTIFICATIONS PASSED');
    console.table(results);
    console.log('==================================================\n');
  } catch (err) {
    console.error('❌ Phase 10 Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase10();
}

module.exports = { runPhase10 };
