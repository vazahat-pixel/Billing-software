/**
 * Desktop activation smoke: seed admin company → pack → activate → login → sale/GSTR.
 * Usage: called from desktop/scripts/smoke-local-boot.js with SMOKE_LIVE_URL set.
 */
'use strict';

const path = require('path');

async function request(base, method, p, body, token) {
  const url = `${base.replace(/\/$/, '')}${p.startsWith('/') ? p : `/${p}`}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function pass(name, detail) {
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  throw new Error(`FAIL: ${name}`);
}

async function seedCompanyOnLocalApi(apiBase) {
  // Direct mongoose against same MONGO_URI the local API uses
  const mongoose = require('mongoose');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI required for desktop activation smoke seed');
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
  }

  const Plan = require('../models/Plan');
  const User = require('../models/User');
  const Company = require('../models/Company');
  const License = require('../models/License');
  const Subscription = require('../models/Subscription');
  const { generateLicenseKey } = require('../utils/license');
  const crypto = require('crypto');
  const provisioning = require('../services/provisioningPackService');

  const stamp = Date.now();
  let plan = await Plan.findOne({ slug: 'smoke-desktop-plan' });
  if (!plan) {
    plan = await Plan.create({
      name: 'Smoke Desktop Plan',
      slug: 'smoke-desktop-plan',
      priceMonthly: 1,
      priceYearly: 10,
      trialDays: 0,
      features: { sales: true, purchase: true, gst: true, inventory: true },
      limits: { users: 10 },
    });
  }

  const email = `smoke.owner.${stamp}@desktop.local`;
  const owner = await User.create({
    name: 'Smoke Owner',
    email,
    password: 'TempSeedOnly1!',
    role: 'user',
    companyRole: 'owner',
    isActive: true,
  });

  const company = await Company.create({
    name: `Smoke Textile ${stamp}`,
    ownerId: owner._id,
    planId: plan._id,
    status: 'active',
    isActive: true,
    commercialPolicy: 'saas_enforced',
  });
  owner.companyId = company._id;
  await owner.save();

  const key = generateLicenseKey(String(company._id));
  const checksum = crypto
    .createHash('sha256')
    .update(`${company._id}:${key}:${process.env.JWT_SECRET || ''}`)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 2);

  await License.create({
    companyId: company._id,
    licenseKey: key,
    expiresAt,
    checksum,
    isActive: true,
    planTier: 'pro',
    maxDevices: 1,
  });
  await Subscription.create({
    companyId: company._id,
    planId: plan._id,
    status: 'active',
    startDate: new Date(),
    endDate: expiresAt,
    billingCycle: 'yearly',
    offlineModeEnabled: true,
  });
  await Company.findByIdAndUpdate(company._id, { licenseKey: key });

  const pack = await provisioning.buildProvisioningPack(company._id);
  return { pack, email, companyName: company.name, companyId: String(company._id) };
}

async function main() {
  const apiBase = process.env.SMOKE_LIVE_URL;
  if (!apiBase) {
    console.error('Set SMOKE_LIVE_URL (e.g. http://127.0.0.1:5050/api)');
    process.exit(1);
  }

  console.log('Desktop activation smoke against', apiBase);

  // Status before
  let st = await request(apiBase, 'GET', '/desktop/activation-status');
  if (st.status !== 200) fail('activation-status', JSON.stringify(st.data));
  pass('activation-status (pre)', st.data?.data?.activated ? 'already activated' : 'not activated');

  const { pack, email, companyName } = await seedCompanyOnLocalApi(apiBase);
  pass('seed + build pack', companyName);

  // Tamper check
  const bad = JSON.parse(JSON.stringify(pack));
  bad.payload.company.name = 'TAMPERED';
  const tamper = await request(apiBase, 'POST', '/desktop/validate-pack', { pack: bad });
  if (tamper.status < 400) fail('tampered pack rejected', JSON.stringify(tamper.data));
  pass('tampered pack rejected', String(tamper.status));

  const valid = await request(apiBase, 'POST', '/desktop/validate-pack', { pack });
  if (valid.status !== 200 || !(valid.data?.data?.ok || valid.data?.ok)) {
    fail('validate pack', JSON.stringify(valid.data));
  }
  pass('validate pack', valid.data?.data?.companyName || companyName);

  const password = 'SmokeDesktop@12345';
  const act = await request(apiBase, 'POST', '/desktop/activate', {
    pack,
    password,
    deviceId: `smoke-device-${Date.now()}`,
    deviceName: 'Smoke Desktop',
  });
  if (act.status !== 200) fail('activate', JSON.stringify(act.data));
  pass('activate', act.data?.data?.companyName || companyName);

  const replay = await request(apiBase, 'POST', '/desktop/activate', {
    pack,
    password,
    deviceId: `smoke-device-replay`,
    deviceName: 'Smoke Desktop',
  });
  if (replay.status < 400) fail('replay blocked', JSON.stringify(replay.data));
  pass('replay activation blocked', String(replay.status));

  const reg = await request(apiBase, 'POST', '/auth/register', {
    name: 'Nope',
    email: `nope.${Date.now()}@x.local`,
    password: 'NopePass123!',
    companyName: 'Nope Co',
  });
  if (reg.status !== 403) fail('register blocked on desktop', JSON.stringify(reg.data));
  pass('register blocked on desktop', String(reg.status));

  const login = await request(apiBase, 'POST', '/auth/login', { email, password });
  const token = login.data?.token || login.data?.data?.token;
  if (!token) fail('login after activate', JSON.stringify(login.data));
  pass('login after activate', email);

  // Minimal ERP touch (party + item) — no formula changes
  const party = await request(
    apiBase,
    'POST',
    '/parties',
    {
      name: `Smoke Party ${Date.now()}`,
      type: 'Customer',
      gstin: '',
      state: 'Gujarat',
      stateCode: '24',
    },
    token
  );
  if (party.status >= 400) fail('create party', JSON.stringify(party.data));
  pass('create party');

  st = await request(apiBase, 'GET', '/desktop/activation-status');
  if (!st.data?.data?.activated && !st.data?.activated) fail('persisted activation', JSON.stringify(st.data));
  pass('activation persists');

  console.log('\nDesktop activation smoke: ALL PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
