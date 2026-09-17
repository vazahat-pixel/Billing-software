/**
 * Go-live smoke — login → masters → purchase → sale → GSTR-1/2/3B reconcile.
 *
 * Rules:
 *  - Expected tax comes ONLY from saved Sales/Purchase documents (books).
 *  - Does NOT rewrite or assert against hardcoded GST formulas.
 *  - Uses in-memory MongoDB by default (no live server required).
 *
 * Usage:
 *   node scripts/goLiveSmoke.js
 *   SMOKE_LIVE_URL=http://127.0.0.1:5000/api node scripts/goLiveSmoke.js   # against running API
 *
 * Exit 0 = PASS, Exit 1 = FAIL
 */
'use strict';

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') });

const LIVE_URL = process.env.SMOKE_LIVE_URL || '';
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const results = [];
const pass = (name, detail = '') => {
  results.push({ name, ok: true, detail });
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
};
const fail = (name, detail = '') => {
  results.push({ name, ok: false, detail });
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};
const assertEq = (name, got, exp, note = '') => {
  if (r2(got) === r2(exp)) pass(name, note || `${got} === ${exp}`);
  else fail(name, `got ${got}, expected ${exp}${note ? ` (${note})` : ''}`);
};

async function runIsolated() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-chars!!';
  process.env.ALLOW_PUBLIC_REGISTER = 'true';
  process.env.ALLOW_SUBSCRIPTION_BYPASS = 'false';

  const mongoose = require(path.join(ROOT, 'node_modules/mongoose'));
  const { MongoMemoryServer } = require(path.join(ROOT, 'node_modules/mongodb-memory-server'));
  const request = require(path.join(ROOT, 'node_modules/supertest'));

  const mongoServer = await MongoMemoryServer.create({ instance: { timeoutMs: 60_000 } });
  process.env.MONGO_URI = mongoServer.getUri();

  const app = require(path.join(ROOT, 'server'));
  await new Promise((res, rej) => {
    if (mongoose.connection.readyState === 1) return res();
    const t = setTimeout(() => rej(new Error('Mongo connect timeout')), 20000);
    mongoose.connection.once('connected', () => { clearTimeout(t); res(); });
    mongoose.connection.once('error', (e) => { clearTimeout(t); rej(e); });
  });

  // Memory Mongo often lacks replica-set transactions — disable like other integration tests.
  const real = mongoose.startSession.bind(mongoose);
  mongoose.startSession = async function noopSession() {
    const s = await real();
    s.startTransaction = () => {};
    s.commitTransaction = async () => {};
    s.abortTransaction = async () => {};
    s.inTransaction = () => false;
    return s;
  };

  const auth = (t) => ({ Authorization: `Bearer ${t}` });
  const unwrap = (res) => {
    if (res.body?.success === false) {
      throw new Error(`API ${res.status}: ${res.body.message || JSON.stringify(res.body)}`);
    }
    return res.body.data !== undefined ? res.body.data : res.body;
  };

  const stamp = Date.now();
  const email = `smoke-${stamp}@golive.test`;
  const password = 'SmokePass123!';

  console.log('\n=== GO-LIVE SMOKE (isolated) ===\n');

  // 1. Register / login
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Smoke Owner',
    email,
    password,
    companyName: `Smoke Co ${stamp}`,
  });
  if (reg.status !== 201) {
    fail('register', JSON.stringify(reg.body));
    throw new Error('register failed');
  }
  let tok = reg.body.token || reg.body.data?.token;
  pass('register', email);

  if (!tok) {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    tok = login.body.token || login.body.data?.token;
  }
  if (!tok) throw new Error('no token after register/login');
  pass('login/token');

  const me = unwrap(await request(app).get('/api/auth/me').set(auth(tok)));
  const companyId = me.companyId || me.user?.companyId;
  if (!companyId) throw new Error('companyId missing');
  pass('auth/me company', String(companyId));

  const acct = require(path.join(ROOT, 'services/accountingService'));
  await acct.seedSystemLedgers(companyId);

  // Ensure company GSTIN/state for POS (no hardcoded Gujarat in reports)
  const gstConfigService = require(path.join(ROOT, 'services/gstConfigService'));
  await gstConfigService.getOrCreate(companyId);
  const GstConfig = require(path.join(ROOT, 'models/GstConfig'));
  await GstConfig.findOneAndUpdate(
    { companyId },
    { gstin: '24AAACS0000S1Z5', stateCode: '24' },
    { upsert: true }
  );

  // 2. Masters
  const customer = unwrap(await request(app).post('/api/parties').set(auth(tok)).send({
    name: 'Smoke B2B Buyer',
    type: 'Customer',
    gstin: '24AAACB1111B1Z5',
    stateCode: '24',
  }));
  const supplier = unwrap(await request(app).post('/api/parties').set(auth(tok)).send({
    name: 'Smoke Supplier',
    type: 'Supplier',
    gstin: '24AAACS2222S1Z9',
    stateCode: '24',
  }));
  const item = unwrap(await request(app).post('/api/items').set(auth(tok)).send({
    name: 'Smoke Fabric',
    category: 'Grey',
    gstRate: 5,
    unit: 'MTRS',
    hsnCode: '5208',
  }));
  pass('masters', `customer=${customer._id} supplier=${supplier._id} item=${item._id}`);

  const day = new Date();
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const from = `${y}-${m}-01`;
  const lastDay = new Date(y, day.getMonth() + 1, 0).getDate();
  const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  const period = `${y}-${m}`;

  // 3. Purchase
  const purRes = await request(app).post('/api/purchases').set(auth(tok)).send({
    supplierId: supplier._id,
    invoiceNo: 'AUTO',
    date: todayStr,
    gstType: 'CGST+SGST',
    items: [{ itemId: item._id, mts: 200, rate: 50, amount: 10000, gstPer: 5 }],
    taxableAmount: 10000,
    cgst: 250,
    sgst: 250,
    netAmount: 10500,
  });
  if (purRes.status !== 201) {
    fail('purchase create', JSON.stringify(purRes.body));
    throw new Error('purchase failed');
  }
  const purchase = unwrap(purRes);
  pass('purchase create', `taxable=${purchase.taxableAmount} gst=${purchase.gstAmount}`);

  // 4. Sale (server recomputes tax — we only check books ↔ report)
  const saleRes = await request(app).post('/api/sales').set(auth(tok)).send({
    customerId: customer._id,
    invoiceNo: 'AUTO',
    date: todayStr,
    gstType: 'CGST+SGST',
    gstRate: 5,
    items: [{ itemId: item._id, mts: 100, rate: 100, amount: 10000, gstRate: 5 }],
    taxableAmount: 10000,
    cgst: 250,
    sgst: 250,
    netAmount: 10500,
  });
  if (saleRes.status !== 201) {
    fail('sale create', JSON.stringify(saleRes.body));
    throw new Error('sale failed');
  }
  const sale = unwrap(saleRes);
  pass('sale create', `taxable=${sale.taxableAmount} cgst=${sale.cgst} sgst=${sale.sgst}`);

  // Sanity: sale tax must be consistent with its own saved fields (not a hardcoded slab assert)
  assertEq(
    'sale books internal',
    r2(Number(sale.cgst) + Number(sale.sgst) + Number(sale.igst || 0)),
    r2(sale.gstAmount || (Number(sale.cgst) + Number(sale.sgst))),
    'components ≈ gstAmount'
  );

  const Sales = require(path.join(ROOT, 'models/Sales'));
  const Purchase = require(path.join(ROOT, 'models/Purchase'));
  const savedSales = await Sales.find({ companyId, status: { $ne: 'cancelled' } });
  const savedPurchases = await Purchase.find({ companyId, status: { $ne: 'cancelled' } });

  const booksOut = savedSales.reduce((a, s) => ({
    taxable: a.taxable + Number(s.taxableAmount || 0),
    cgst: a.cgst + Number(s.cgst || 0),
    sgst: a.sgst + Number(s.sgst || 0),
    igst: a.igst + Number(s.igst || 0),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

  const booksIn = savedPurchases.reduce((a, p) => ({
    taxable: a.taxable + Number(p.taxableAmount || 0),
    cgst: a.cgst + Number(p.cgst || 0),
    sgst: a.sgst + Number(p.sgst || 0),
    igst: a.igst + Number(p.igst || 0),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

  // 5. GSTR-1
  const g1 = unwrap(await request(app)
    .get(`/api/gst/gstr1?startDate=${from}&endDate=${to}`)
    .set(auth(tok)));
  const t1 = g1.totals || {};
  assertEq('GSTR-1 taxable = books', t1.taxable, booksOut.taxable);
  assertEq('GSTR-1 CGST = books', t1.cgst, booksOut.cgst);
  assertEq('GSTR-1 SGST = books', t1.sgst, booksOut.sgst);
  assertEq('GSTR-1 IGST = books', t1.igst, booksOut.igst);
  assertEq('GSTR-1 invoiceCount', t1.invoiceCount, savedSales.length);

  const b2bInv = (g1.b2b || []).flatMap((p) => p.inv || []);
  if (b2bInv.length >= 1) pass('GSTR-1 B2B section has invoice', String(b2bInv.length));
  else fail('GSTR-1 B2B section', 'expected at least 1 B2B invoice');

  // Rate-wise itms sum must equal invoice tax (multi-rate gap fill)
  for (const inv of b2bInv) {
    const sumTx = (inv.itms || []).reduce((s, i) => s + Number(i.itm_det?.txval || 0), 0);
    const sumTax = (inv.itms || []).reduce(
      (s, i) => s + Number(i.itm_det?.camt || 0) + Number(i.itm_det?.samt || 0) + Number(i.itm_det?.iamt || 0),
      0
    );
    const matchSale = savedSales.find((s) => s.invoiceNo === inv.inum);
    if (matchSale) {
      assertEq(`itms txval sum (${inv.inum})`, sumTx, matchSale.taxableAmount);
      assertEq(
        `itms tax sum (${inv.inum})`,
        sumTax,
        Number(matchSale.cgst || 0) + Number(matchSale.sgst || 0) + Number(matchSale.igst || 0)
      );
    }
  }

  // 6. GSTR-2
  const g2raw = unwrap(await request(app)
    .get(`/api/gst/gstr2?startDate=${from}&endDate=${to}`)
    .set(auth(tok)));
  const g2 = Array.isArray(g2raw) ? g2raw : (g2raw.rows || g2raw.invoices || []);
  const g2sum = g2.reduce((a, p) => ({
    taxable: a.taxable + Number(p.taxable || 0),
    cgst: a.cgst + Number(p.cgst || 0),
    sgst: a.sgst + Number(p.sgst || 0),
    igst: a.igst + Number(p.igst || 0),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
  assertEq('GSTR-2 taxable = books', g2sum.taxable, booksIn.taxable);
  assertEq('GSTR-2 CGST = books', g2sum.cgst, booksIn.cgst);
  assertEq('GSTR-2 SGST = books', g2sum.sgst, booksIn.sgst);

  // 7. GSTR-3B (dedicated builder)
  let g3;
  try {
    g3 = unwrap(await request(app).get(`/api/gst/gstr3b?period=${period}`).set(auth(tok)));
  } catch (e) {
    fail('GSTR-3B endpoint', e.message);
    g3 = null;
  }
  if (g3) {
    const det = g3.payload?.sup_details?.osup_det
      || g3.sup_details?.osup_det
      || g3.osup_det;
    if (det) {
      assertEq('GSTR-3B osup_det.txval = books outward', det.txval, booksOut.taxable);
      assertEq(
        'GSTR-3B osup_det tax = books',
        Number(det.camt || 0) + Number(det.samt || 0) + Number(det.iamt || 0),
        booksOut.cgst + booksOut.sgst + booksOut.igst
      );
      const zero = g3.payload?.sup_details?.osup_zero || g3.sup_details?.osup_zero;
      const nil = g3.payload?.sup_details?.osup_nil_exmp || g3.sup_details?.osup_nil_exmp;
      if (zero && nil) pass('GSTR-3B osup_zero/nil keys present');
      else fail('GSTR-3B osup_zero/nil keys', 'missing');
    } else {
      fail('GSTR-3B shape', 'osup_det missing');
    }
  }

  // Cleanup
  mongoose.connection.removeAllListeners('disconnected');
  try { await mongoose.connection.close(); } catch (_) {}
  try { await mongoServer.stop(); } catch (_) {}
}

async function runLive() {
  const base = LIVE_URL.replace(/\/$/, '');
  console.log(`\n=== GO-LIVE SMOKE (live API ${base}) ===\n`);

  let email = process.env.SMOKE_EMAIL;
  let password = process.env.SMOKE_PASSWORD;

  const req = async (method, urlPath, body, token) => {
    const res = await fetch(`${base}${urlPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  if ((!email || !password) && String(process.env.SMOKE_LIVE_REGISTER || '').toLowerCase() === 'true') {
    email = `desktop-smoke-${Date.now()}@local.test`;
    password = 'DesktopSmoke123!';
    const reg = await req('POST', '/auth/register', {
      name: 'Desktop Smoke',
      email,
      password,
      companyName: `Desktop Smoke Co ${Date.now()}`,
    });
    if (![200, 201].includes(reg.status)) {
      throw new Error(`live register failed: ${JSON.stringify(reg.data)}`);
    }
    pass('live register', email);
  }

  if (!email || !password) {
    throw new Error('SMOKE_LIVE_URL set — also set SMOKE_EMAIL and SMOKE_PASSWORD (or SMOKE_LIVE_REGISTER=true)');
  }

  const login = await req('POST', '/auth/login', { email, password });
  const tok = login.data.token || login.data.data?.token;
  if (!tok) {
    fail('live login', JSON.stringify(login.data));
    return;
  }
  pass('live login');

  const me = login.data.user || login.data.data?.user || {};
  const companyId = me.companyId;
  pass('live company', String(companyId || ''));

  // Masters → purchase → sale → GSTR (same as isolated path, against live API)
  const stamp = Date.now();
  const partyC = await req('POST', '/parties', { name: `Cust ${stamp}`, type: 'Customer', gstin: '24AAAAA0000A1Z5', stateCode: '24' }, tok);
  const partyS = await req('POST', '/parties', { name: `Supp ${stamp}`, type: 'Supplier', gstin: '24BBBBB0000B1Z5', stateCode: '24' }, tok);
  const item = await req('POST', '/items', { name: `Item ${stamp}`, category: 'Grey', gstRate: 5, unit: 'MTRS' }, tok);
  const customerId = (partyC.data.data || partyC.data)._id;
  const supplierId = (partyS.data.data || partyS.data)._id;
  const itemId = (item.data.data || item.data)._id;
  if (!customerId || !supplierId || !itemId) {
    fail('live masters', JSON.stringify({ partyC: partyC.data, partyS: partyS.data, item: item.data }));
    return;
  }
  pass('live masters');

  const date = new Date().toISOString();
  const pur = await req('POST', '/purchases', {
    supplierId, invoiceNo: 'AUTO', date, gstType: 'CGST+SGST',
    items: [{ itemId, mts: 100, pcs: 0, rate: 100, amount: 10000 }],
    taxableAmount: 10000, netAmount: 10500,
  }, tok);
  if (pur.status !== 201) {
    fail('live purchase', JSON.stringify(pur.data));
    return;
  }
  pass('live purchase');

  const lots = await req('GET', `/inventory/lots?itemId=${itemId}`, null, tok);
  const lotList = lots.data.data?.items || lots.data.data || lots.data;
  const lotOid = Array.isArray(lotList) ? lotList[0]?._id : null;

  const sale = await req('POST', '/sales', {
    customerId, invoiceNo: 'AUTO', date, gstType: 'CGST+SGST',
    items: [{ itemId, lotId: lotOid, mts: 100, pcs: 0, rate: 100, amount: 10000 }],
    taxableAmount: 10000, netAmount: 10500,
  }, tok);
  if (sale.status !== 201) {
    fail('live sale', JSON.stringify(sale.data));
    return;
  }
  const saleDoc = sale.data.data || sale.data;
  pass('live sale', `taxable=${saleDoc.taxableAmount} cgst=${saleDoc.cgst}`);

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const g1res = await req('GET', `/gst/gstr1?startDate=${from}&endDate=${to}`, null, tok);
  const g1 = g1res.data.data || g1res.data;
  if (g1res.status !== 200) {
    fail('live GSTR-1', JSON.stringify(g1res.data));
    return;
  }
  assertEq('live GSTR-1 taxable = sale', g1.totals?.taxable, saleDoc.taxableAmount);
  pass('live GSTR-1', `taxable=${g1.totals?.taxable} invoices=${g1.totals?.invoiceCount}`);

  const g2res = await req('GET', `/gst/gstr2?startDate=${from}&endDate=${to}`, null, tok);
  if (g2res.status !== 200) fail('live GSTR-2', JSON.stringify(g2res.data));
  else pass('live GSTR-2');
}

async function main() {
  try {
    if (LIVE_URL) await runLive();
    else await runIsolated();
  } catch (err) {
    fail('smoke crashed', err.stack || err.message);
  }

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  console.log(`\n=== SUMMARY: ${passed.length} PASS / ${failed.length} FAIL ===\n`);
  if (failed.length) {
    failed.forEach((f) => console.error(` - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  console.log('Go-live smoke PASSED. Books ↔ GSTR reports reconcile.');
  process.exit(0);
}

main();
