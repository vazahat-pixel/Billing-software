/**
 * Deep offline integration tests — DB chain, auth payload, API sync path, unit logic.
 * Run: node backend/scripts/testOfflineIntegration.js
 */
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => console.log(`  ❌ ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
let failed = 0;
const check = (ok, okMsg, failMsg) => {
  if (ok) pass(okMsg);
  else { fail(failMsg); failed++; }
};

const canUseOfflineMode = (plan, settings) => {
  const planAllows = !!(plan?.offlineMode || plan?.modules?.offline);
  if (!planAllows) return false;
  return settings?.offlineModeEnabled === true;
};

function testSyncHelpers() {
  console.log('\n── A. Sync helper logic (unit) ──');

  const isDuplicateError = (err) => {
    const msg = (err?.response?.data?.message || err?.message || '').toLowerCase();
    return msg.includes('duplicate') || msg.includes('already exists') || msg.includes('unique');
  };

  const renameInvoiceNo = (payload) => {
    const current = payload.invoiceNo;
    if (!current || current === 'AUTO') return { ...payload, invoiceNo: 'AUTO' };
    return { ...payload, invoiceNo: `${current}-OFF${Date.now().toString().slice(-4)}` };
  };

  check(isDuplicateError({ message: 'Duplicate invoice number' }), 'Detects duplicate invoice error', 'Duplicate detection broken');
  check(isDuplicateError({ message: 'Network Error' }) === false, 'Ignores network errors for rename', 'False positive duplicate');

  const renamed = renameInvoiceNo({ invoiceNo: 'INV-101' });
  check(renamed.invoiceNo.startsWith('INV-101-OFF'), 'Renames conflicting invoice no', 'Invoice rename broken');
  check(renameInvoiceNo({ invoiceNo: 'AUTO' }).invoiceNo === 'AUTO', 'AUTO invoice stays AUTO', 'AUTO rename broken');

  const mergePending = (pending, serverList) => {
    const serverIds = new Set(serverList.map((r) => r.id || r._id));
    const activePending = pending.filter((p) => p.offlinePending && !serverIds.has(p.id));
    return [...activePending, ...serverList];
  };

  const pending = [{ id: 'local-1', offlinePending: true, invoiceNo: 'OFF-1' }];
  const server = [{ id: 'srv-1', invoiceNo: 'INV-1' }];
  const merged = mergePending(pending, server);
  check(merged.length === 2, 'Merge keeps pending + server sales', 'Merge logic broken');
  check(merged[0].id === 'local-1', 'Pending sale listed first', 'Merge order wrong');
}

async function testCompanyChains() {
  console.log('\n── B. Per-company offline chain (DB) ──');

  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software');

  const Company = require('../models/Company');
  const Plan = require('../models/Plan');
  const Subscription = require('../models/Subscription');
  const CompanySettings = require('../models/CompanySettings');
  const User = require('../models/User');

  const companies = await Company.find({}).populate('planId');
  check(companies.length > 0, `Checking ${companies.length} companies`, 'No companies found');

  for (const company of companies) {
    const name = company.name || company._id;
    const plan = company.planId;
    const sub = await Subscription.findOne({ companyId: company._id });
    const settings = await CompanySettings.findOne({ companyId: company._id });
    const user = await User.findOne({ companyId: company._id, role: 'user' });

    const planOk = !!(plan?.features?.offlineMode || plan?.features?.modules?.offline);
    const subOk = sub?.offlineModeEnabled === true;
    const settingsOk = settings?.offlineModeEnabled === true;
    const gateOk = canUseOfflineMode(plan?.features || plan, settings);

    const allOk = planOk && subOk && settingsOk && gateOk;
    if (allOk) {
      pass(`${name}: plan✓ sub✓ settings✓ gate✓${user ? ` (user: ${user.email})` : ''}`);
    } else {
      fail(`${name}: plan=${planOk} sub=${subOk} settings=${settingsOk} gate=${gateOk}`);
    }
  }

  await mongoose.disconnect();
}

async function testAuthLoginPayload() {
  console.log('\n── C. Auth login returns offline-capable payload ──');

  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software');

  const User = require('../models/User');
  const authService = require('../services/auth.service');

  const candidates = [
    'user@textileerp.com',
    process.env.TEST_USER_EMAIL
  ].filter(Boolean);

  let tested = 0;
  for (const email of candidates) {
    const user = await User.findOne({ email });
    if (!user) continue;

    try {
      const result = await authService.login(email, process.env.TEST_USER_PASSWORD || 'User@123');
      const plan = result.user?.plan;
      const settings = result.user?.settings;
      const allowed = canUseOfflineMode(plan, settings);

      check(!!result.token, `Login OK: ${email}`, `Login failed: ${email}`);
      check(!!plan, `${email}: plan features in response`, `${email}: plan missing in login response`);
      check(allowed, `${email}: offline gate OPEN after login`, `${email}: offline gate CLOSED — user cannot save offline`);
      tested++;
    } catch (err) {
      if (err.message === 'Invalid credentials') {
        warn(`Skip ${email}: wrong password (set TEST_USER_PASSWORD in .env)`);
      } else {
        fail(`${email}: ${err.message}`);
      }
    }
  }

  if (tested === 0) {
    const anyUser = await User.findOne({ role: 'user', companyId: { $ne: null } });
    if (anyUser) {
      warn(`No test login succeeded. Found user ${anyUser.email} — set TEST_USER_PASSWORD to test login payload.`);
    } else {
      warn('No tenant users in DB to test login payload');
    }
  }

  await mongoose.disconnect();
}

async function isServerUp(port = 5000) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/auth/me`, (res) => {
      resolve(res.statusCode === 401 || res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function testLiveApi() {
  console.log('\n── D. Live API (server must be running on :5000) ──');

  const up = await isServerUp(5000);
  if (!up) {
    warn('Backend not running — skip API tests. Start with: cd backend && npm run dev');
    return;
  }

  pass('Backend reachable on port 5000');

  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software');
  const User = require('../models/User');

  const user = await User.findOne({ email: process.env.TEST_USER_EMAIL || 'user@textileerp.com' })
    || await User.findOne({ role: 'user', companyId: { $ne: null } });
  if (!user) {
    warn('No user for API test');
    await mongoose.disconnect();
    return;
  }

  const password = process.env.TEST_USER_PASSWORD || 'User@123';
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password })
  });

  if (!loginRes.ok) {
    warn(`API login failed (${loginRes.status}) for ${user.email} — set TEST_USER_PASSWORD`);
    await mongoose.disconnect();
    return;
  }

  const { token, user: loginUser } = await loginRes.json();
  check(!!token, 'API login returns JWT', 'No token from API login');

  const plan = loginUser?.plan;
  const settings = loginUser?.settings;
  check(canUseOfflineMode(plan, settings), 'API login user can use offline mode', 'API login user CANNOT use offline');

  const salesRes = await fetch('http://localhost:5000/api/sales', {
    headers: { Authorization: `Bearer ${token}` }
  });
  check(salesRes.ok, `GET /sales → ${salesRes.status}`, `GET /sales failed: ${salesRes.status}`);

  const partiesRes = await fetch('http://localhost:5000/api/parties', {
    headers: { Authorization: `Bearer ${token}` }
  });
  check(partiesRes.ok, `GET /parties → ${partiesRes.status} (cache source for offline)`, `GET /parties failed`);

  const itemsRes = await fetch('http://localhost:5000/api/items', {
    headers: { Authorization: `Bearer ${token}` }
  });
  check(itemsRes.ok, `GET /items → ${itemsRes.status} (cache source for offline)`, `GET /items failed`);

  await mongoose.disconnect();
}

async function runStaticSuite() {
  console.log('\n── E. Static suite (testOfflineFeature.js) ──');
  const { spawnSync } = require('child_process');
  const result = spawnSync('node', [path.join(__dirname, 'testOfflineFeature.js')], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  if (result.stdout) console.log(result.stdout);
  if (result.status !== 0) {
    fail('Static offline test suite failed');
    if (result.stderr) console.error(result.stderr);
  } else {
    pass('Static offline test suite passed');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  OFFLINE — DEEP INTEGRATION TEST');
  console.log('═══════════════════════════════════════════════════');

  testSyncHelpers();
  await testCompanyChains();
  await testAuthLoginPayload();
  await testLiveApi();

  console.log('\n── F. Browser-only (manual) ──');
  warn('DevTools → Network → Offline → create sale → Pending Sync → Online → sync');
  warn('DevTools → Application → IndexedDB → billing-offline');
  warn('DevTools → Application → Service Workers → sw.js activated');

  console.log('\n═══════════════════════════════════════════════════');
  if (failed === 0) {
    console.log('  INTEGRATION RESULT: ALL PASSED ✅');
  } else {
    console.log(`  INTEGRATION RESULT: ${failed} FAILED ❌`);
  }
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
