'use strict';

/**
 * INSTALLED-DESKTOP OFFLINE CERTIFICATION
 * =======================================
 * The desktop side is what the installer ships, not the repo: desktop/resources/backend (run
 * `npm run prepare:backend` first), the bundled mongod and node, started by the real
 * desktop/localRuntime with its real production settings. Only the cloud is a test server.
 *
 *   1 sign in online, download the company      2 cloud OFF: every kind of entry
 *   3 every JSM report opens offline            4 app closed and reopened, still offline
 *   5 cloud ON: uploads BY ITSELF (no button)   6 document-by-document + report-by-report equality
 *
 * NEVER connects to production. Usage: node tests/hybrid-e2e/modules/packaged/run.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.MONGOMS_SPAWN_TIMEOUT = '60000';
delete process.env.MONGO_URI;
delete process.env.CENTRAL_API_BASE_URL;
delete process.env.ELECTRON_RUN_AS_NODE;

const DESKTOP = path.join(__dirname, '..', '..', '..', '..', '..', 'desktop');
const PACKAGED = path.join(DESKTOP, 'resources');
process.env.DESKTOP_NODE_PATH = path.join(DESKTOP, 'vendor', 'node', 'node.exe');

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient, BSON } = require('mongodb');
const { spawnApi, stopProc, waitHealth, findFreePort } = require('../../lib/env');
const { seedCentralFixtures, withMongoose } = require('../../lib/fixtures');
const { api, request } = require('../../lib/http');
const { assertNotProduction } = require('../../../helpers/memoryDb');
const scope = require('../../../../services/replication/scope');
const { bootLocalStack, shutdownLocalStack } = require(path.join(DESKTOP, 'localRuntime'));

const { EJSON } = BSON;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const failures = [];
async function test(label, fn) {
  const t = Date.now();
  try {
    const note = await fn();
    passed += 1;
    console.log(`  v ${label}${note ? `  [${note}]` : ''}  (${Date.now() - t} ms)`);
  } catch (err) {
    failures.push(`${label}: ${err.message}`);
    console.log(`  x ${label}\n      ${String(err.message).slice(0, 1500).split('\n').join('\n      ')}`);
  }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const data = (res) => res.body?.data ?? res.body;
const ok = (res, what) => { assert(res.status >= 200 && res.status < 300, `${what}: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 500)}`); return data(res); };

async function withDb(uri, fn) {
  const c = new MongoClient(uri);
  await c.connect();
  try { return await fn(c.db(new URL(uri).pathname.replace('/', '') || 'test')); } finally { await c.close(); }
}
async function diffMirror(localUri, centralUri, companyIds, collections) {
  const read = (uri) => withDb(uri, async (db) => {
    const out = {};
    for (const c of collections) {
      const docs = await db.collection(c).find(scope.scopeFilter(c, companyIds)).toArray();
      out[c] = new Map(docs.map((d) => [EJSON.stringify(d._id), EJSON.stringify(d, { relaxed: false })]));
    }
    return out;
  });
  const [L, C] = await Promise.all([read(localUri), read(centralUri)]);
  const diffs = []; let n = 0;
  for (const c of collections) {
    for (const [id, s] of L[c]) { n += 1; if (!C[c].has(id)) diffs.push(`${c} ${id}: only on desktop`); else if (C[c].get(id) !== s) diffs.push(`${c} ${id}: content differs`); }
    for (const id of C[c].keys()) if (!L[c].has(id)) diffs.push(`${c} ${id}: only on cloud`);
  }
  return { diffs, n };
}

async function main() {
  const stamp = Date.now();
  const deskVersion = path.join(PACKAGED, 'backend', 'server.js');
  if (!fs.existsSync(deskVersion)) throw new Error('run "npm run prepare:backend" in desktop/ first');
  if (fs.existsSync(path.join(PACKAGED, 'backend', '.env'))) throw new Error('packaged backend contains .env');

  const cloudMms = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await cloudMms.waitUntilRunning();
  const centralUri = cloudMms.getUri(`central_packaged_e2e_test_${stamp}`);
  assertNotProduction(centralUri);
  const centralPort = await findFreePort();
  const centralBase = `http://127.0.0.1:${centralPort}/api`;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-packaged-test-'));
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ mode: 'hybrid', centralApiBaseUrl: centralBase, apiBaseUrl: centralBase, apiPort: 5960, mongoPort: 27960 }));

  // The cloud stand-in loads the repo's .env: blank everything in it that could reach the outside world.
  const blank = {};
  for (const k of (fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '.env'), 'utf8').match(/^[A-Z_0-9]+(?==)/gm) || [])) {
    if (/^(SMS|WHATSAPP|EWAY|SMTP|MAIL|RAZORPAY|CLOUDINARY|AWS|REDIS)/.test(k)) blank[k] = '';
  }
  let centralProc = null;
  const startCentral = async () => {
    centralProc = spawnApi({ name: 'central', mongoUri: centralUri, port: centralPort, extraEnv: { ...blank, DESKTOP_LOCAL: 'false', MONGO_REPLICA_SET: 'true', MODULE_GATE_ENFORCE: 'false', DEVICE_BINDING_ENFORCE: 'false' } });
    await waitHealth(centralPort, 90000, centralProc);
  };
  const stopCentral = async () => { await stopProc(centralProc); centralProc = null; };

  let stack = null;
  let local = null;
  const bootDesktop = async () => {
    stack = await bootLocalStack({ userData, desktopRoot: DESKTOP, resourcesPath: PACKAGED, isPackaged: true });
    assert(stack.mode === 'hybrid', `desktop booted in ${stack.mode}`);
    assert(/resources.backend$/.test(stack.api.backendRoot), `wrong backend: ${stack.api.backendRoot}`);
    // The real desktop database name is not a "test" name, so check what matters: this PC, this test's folder.
    assert(new URL(stack.mongoUri).hostname === '127.0.0.1' && !stack.mongoUri.includes(','), 'desktop database is not local');
    assert(fs.existsSync(path.join(userData, 'data', 'mongo', 'WiredTiger')), 'desktop database is not in the test folder');
    local = api(stack.apiBaseUrl);
  };
  const central = api(centralBase);
  const pending = async () => data(await local.get('/desktop/sync-pending'));

  try {
    const fx = await seedCentralFixtures(centralUri, stamp);
    const companyIds = [fx.companyId];
    await withMongoose(centralUri, async () => {
      const mongoose = require('mongoose');
      const modelsDir = path.join(__dirname, '..', '..', '..', '..', 'models');
      for (const f of fs.readdirSync(modelsDir)) if (f.endsWith('.js')) { try { require(path.join(modelsDir, f)); } catch { /* optional */ } }
      for (const n of mongoose.modelNames()) await mongoose.model(n).init().catch(() => {});
      await require('../../../../services/accountingService').seedSystemLedgers(fx.companyId);
      const on = {};
      for (const m of ['sales', 'purchase', 'inventory', 'accounting', 'gst', 'masters', 'reports', 'jobWork', 'utilities']) on[m] = true;
      await require('../../../../models/Plan').updateMany({}, { $set: { 'features.modules': on } });
      await require('../../../../models/CompanyModuleConfig').updateOne({ companyId: fx.companyId }, { $set: Object.fromEntries(Object.entries(on).map(([k, v]) => [`modules.${k}`, v])) });
    });
    await startCentral();
    const webToken = ok(await central.post('/auth/login', { body: { email: fx.email, password: fx.password, deviceId: 'WEB', deviceName: 'WEB' } }), 'web login').token;

    console.log('\n[1] Installed desktop: start, sign in online, download');
    let tok = '';
    await test('desktop starts in offline (hybrid) mode with the packaged backend', async () => { await bootDesktop(); });
    if (!local) throw new Error('desktop did not start');
    await test('first sign-in downloads the company', async () => {
      tok = ok(await local.post('/desktop/auto-activate', { body: { email: fx.email, password: fx.password, deviceId: fx.deviceId, deviceName: 'OFFICE-PC' } }), 'activate').token;
      const end = Date.now() + 120000;
      for (;;) { const s = await pending(); if (s?.snapshot === 'done') break; assert(s?.snapshot !== 'failed' && Date.now() < end, `download: ${JSON.stringify(s)}`); await sleep(500); }
      const d = await diffMirror(stack.mongoUri, centralUri, companyIds, scope.ALL.filter((c) => c !== 'users'));
      assert(!d.diffs.length, d.diffs.slice(0, 10).join('\n'));
      return `${d.n} documents identical`;
    });

    console.log('\n[2] NET OFF — every kind of entry');
    await stopCentral();
    const L = (p, body) => local.post(p, { token: tok, body });
    // Each entry a minute after the last, as in real work (equal times have no defined order).
    let clock = Date.now() - 3 * 3600e3;
    const now = () => { clock += 60000; return new Date(clock).toISOString(); };
    const id = {};
    let bankId; let cashId; let custLedger; let suppLedger; let millLedger;
    const ledgers = async (cli = local, t = tok) => { const r = ok(await cli.get('/accounting/ledgers', { token: t }), 'ledgers'); return Array.isArray(r) ? r : (r.ledgers || r.items || []); };
    const mk = (k, label, fn) => test(label, async () => { const d = await fn(); id[k] = String(d?._id || d?.job?._id || d?.voucher?._id || ''); return d?.invoiceNo || d?.voucherNo || d?.challanNo || ''; });

    await mk('city', 'master: City', async () => ok(await L('/submasters', { type: 'City', name: 'OFFLINE CITY' }), 'city'));
    await mk('broker', 'master: Broker', async () => ok(await L('/parties', { name: 'OFF BROKER', type: 'Broker', group: 'BROKER' }), 'broker'));
    await mk('cust', 'master: Customer', async () => ok(await L('/parties', { name: 'OFF CUSTOMER', type: 'Customer', group: 'SUNDRY DEBTORS', state: 'Gujarat', stateCode: '24', city: 'OFFLINE CITY', brokerId: id.broker }), 'customer'));
    await mk('supp', 'master: Supplier', async () => ok(await L('/parties', { name: 'OFF SUPPLIER', type: 'Supplier', group: 'SUNDRY CREDITORS', state: 'Gujarat', stateCode: '24' }), 'supplier'));
    await mk('mill', 'master: Mill', async () => ok(await L('/parties', { name: 'OFF MILL', type: 'Job Worker', state: 'Gujarat', stateCode: '24' }), 'mill'));
    await mk('worker', 'master: Job Worker', async () => ok(await L('/parties', { name: 'OFF JOB WORKER', type: 'Job Worker', state: 'Gujarat', stateCode: '24' }), 'worker'));
    await mk('item', 'master: Item', async () => ok(await L('/items', { name: 'OFF GREY CLOTH', category: 'Grey', gstRate: 5, unit: 'MTRS' }), 'item'));

    const purBody = (rate) => ({ supplierId: id.supp, invoiceNo: 'AUTO', supplierInvoiceNo: 'S-1', date: now(), gstType: 'CGST+SGST', items: [{ itemId: id.item, mts: 400, pcs: 4, rate, amount: 400 * rate }], taxableAmount: 400 * rate, cgst: 10 * rate, sgst: 10 * rate, netAmount: 420 * rate });
    await mk('pur', 'Purchase bill', async () => ok(await L('/purchases', purBody(50)), 'purchase'));
    await mk('purEdit', 'Purchase bill edited (rate 50 to 52)', async () => { const b = purBody(52); delete b.invoiceNo; const d = ok(await local.put(`/purchases/${id.pur}`, { token: tok, body: b }), 'purchase edit'); const g = ok(await local.get(`/purchases/${id.pur}`, { token: tok }), 'get'); assert(Number(g.netAmount) === 21840, `net ${g.netAmount}`); return d; });
    const lotOf = async (itemId) => { const r = ok(await local.get(`/inventory/lots?itemId=${itemId}`, { token: tok }), 'lots'); return (Array.isArray(r) ? r : r.lots || r.items).reduce((a, b) => (Number(b.remainingMtrs) > Number(a.remainingMtrs) ? b : a)); };
    await mk('mi', 'Mill Issue', async () => ok(await L('/jobs/issue', { workerId: id.mill, lotId: (await lotOf(id.item))._id, issueQty: 100, issuePcs: 1, processType: 'Dyeing', jobRate: 10, challanNo: 'MILL-1', date: now() }), 'mill issue'));
    await mk('mr', 'Mill Receive (part, then final)', async () => {
      ok(await L('/jobs/receive', { jobId: id.mi, receivedQty: 50, receivedPcs: 0, charges: 500, gstAmount: 25, isFinal: false }), 'mill receive 1');
      return ok(await L('/jobs/receive', { jobId: id.mi, receivedQty: 48, receivedPcs: 1, charges: 480, gstAmount: 24, isFinal: true }), 'mill receive 2');
    });
    await mk('ji', 'Job Issue', async () => ok(await L('/jobs/issue', { workerId: id.worker, lotId: (await lotOf(id.item))._id, issueQty: 60, issuePcs: 1, processType: 'Embroidery', jobRate: 12, challanNo: 'JOB-1', date: now() }), 'job issue'));
    await mk('jr', 'Job Receive', async () => ok(await L('/jobs/receive', { jobId: id.ji, receivedQty: 60, receivedPcs: 1, charges: 720, gstAmount: 36, isFinal: true }), 'job receive'));
    const sale = (mts, extra = {}) => ({ customerId: id.cust, invoiceNo: 'AUTO', invoiceType: 'Tax', paymentMode: 'CREDIT', date: now(), gstType: 'CGST+SGST', gstRate: 5, items: [{ itemId: id.item, mts, pcs: 0, rate: 150, amount: mts * 150 }], ...extra });
    let saleNo;
    await mk('sale', 'Sale bill', async () => { const d = ok(await L('/sales', sale(80)), 'sale'); saleNo = d.invoiceNo; return d; });
    await mk('sale2', 'second Sale bill gets the next number', async () => { const d = ok(await L('/sales', sale(10)), 'sale 2'); assert(String(d.invoiceNo) !== String(saleNo), `same number ${saleNo}`); return d; });
    await mk('saleEdit', 'Sale bill edited (10 to 12 mts)', async () => { const b = sale(12, { taxableAmount: 1800, cgst: 45, sgst: 45, netAmount: 1890 }); delete b.invoiceNo; const d = ok(await local.put(`/sales/${id.sale2}`, { token: tok, body: b }), 'sale edit'); const g = ok(await local.get(`/sales/${id.sale2}`, { token: tok }), 'get'); assert(Number(g.taxableAmount) === 1800, `taxable ${g.taxableAmount}`); return d; });
    await mk('sale3', 'Sale bill made and deleted', async () => { const d = ok(await L('/sales', sale(5)), 'sale 3'); ok(await request(stack.apiBaseUrl, 'DELETE', `/sales/${d._id}`, { token: tok }), 'sale delete'); return d; });
    await mk('sret', 'Sales Return', async () => ok(await L('/returns', { returnType: 'Sales', invoiceNo: 'AUTO', originalInvoiceNo: saleNo, originalInvoiceId: id.sale, partyId: id.cust, date: now(), items: [{ itemId: id.item, mts: 5, pcs: 0, rate: 150, amount: 750 }], taxableAmount: 750, gstAmount: 37.5, netAmount: 787.5 }), 'sales return'));
    await test('ledgers: bank, cash and party accounts exist offline', async () => {
      const all = await ledgers();
      const find = (re) => all.find((l) => re.test(l.name));
      bankId = find(/^bank a\/c$/i)?._id; cashId = find(/^cash a\/c$/i)?._id;
      const byParty = (p, n) => (all.find((l) => String(l.partyId || '') === p) || all.find((l) => l.name === n))?._id;
      custLedger = byParty(id.cust, 'OFF CUSTOMER'); suppLedger = byParty(id.supp, 'OFF SUPPLIER'); millLedger = byParty(id.mill, 'OFF MILL');
      assert(bankId && cashId && custLedger && suppLedger && millLedger, JSON.stringify({ bankId, cashId, custLedger, suppLedger, millLedger }));
    });
    await mk('brec', 'Bank Receipt against sale bill', async () => ok(await L('/accounting/receipts', { partyLedgerId: custLedger, bankLedgerId: bankId, paymentMode: 'NEFT', bookKind: 'bank', accBill: 'B', status: 'Posted', amount: 5000, date: now(), againstInvoices: [{ invoiceId: id.sale, invoiceNo: saleNo, amount: 5000 }] }), 'bank receipt'));
    await mk('bpay', 'Bank Payment against purchase bill', async () => ok(await L('/accounting/payments', { partyLedgerId: suppLedger, bankLedgerId: bankId, paymentMode: 'NEFT', bookKind: 'bank', accBill: 'B', status: 'Posted', amount: 8000, date: now(), againstInvoices: [{ invoiceId: id.pur, invoiceNo: 'n/a', amount: 8000 }] }), 'bank payment'));
    await mk('mpay', 'Bank Payment to mill', async () => ok(await L('/accounting/payments', { partyLedgerId: millLedger, bankLedgerId: bankId, paymentMode: 'NEFT', bookKind: 'bank', accBill: 'A', status: 'Posted', amount: 300, date: now() }), 'mill payment'));
    await mk('crec', 'Cash Receipt', async () => ok(await L('/accounting/receipts', { partyId: id.cust, amount: 1000, date: now(), paymentMode: 'Cash', bookKind: 'cash', accBill: 'A', status: 'Posted' }), 'cash receipt'));
    await mk('cpay', 'Cash Payment', async () => ok(await L('/accounting/payments', { partyId: id.supp, amount: 400, date: now(), paymentMode: 'Cash', bookKind: 'cash', accBill: 'A', status: 'Posted' }), 'cash payment'));
    await mk('contra', 'Contra (cash to bank)', async () => ok(await L('/stage3/journals/contra', { fromLedgerId: cashId, toLedgerId: bankId, amount: 200, entryDate: now(), narration: 'deposit' }), 'contra'));
    await mk('jv', 'Journal Voucher', async () => ok(await L('/accounting/journal', { entryDate: now(), narration: 'jv', lines: [{ ledgerId: suppLedger, type: 'Dr', amount: 75 }, { ledgerId: cashId, type: 'Cr', amount: 75 }] }), 'journal'));
    await mk('cn', 'Credit Note', async () => ok(await L('/notes', { noteType: 'Credit', noteSide: 'Sales', partyLedgerId: custLedger, amount: 105, date: now(), reason: 'rate diff', status: 'Posted', gstType: 'CGST+SGST', gstRate: 5, taxableAmount: 100 }), 'credit note'));
    await mk('dn', 'Debit Note', async () => ok(await L('/notes', { noteType: 'Debit', noteSide: 'Purchase', partyLedgerId: suppLedger, amount: 105, date: now(), reason: 'short', status: 'Posted', gstType: 'CGST+SGST', gstRate: 5, taxableAmount: 100 }), 'debit note'));
    await mk('order', 'Sales Order', async () => ok(await L('/orders', { orderType: 'Sales', type: 'Sales', partyId: id.cust, customerId: id.cust, orderNo: 'AUTO', date: now(), items: [{ itemId: id.item, mts: 20, pcs: 0, rate: 150, amount: 3000, quantity: 20 }], totalAmount: 3000 }), 'order'));

    console.log('\n[3] NET OFF — every report');
    const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const P = { from: `${y}-04-01`, to: `${y + 1}-03-31`, fromText: `01/04/${y}`, toText: `31/03/${y + 1}`, asOn: `${y + 1}-03-31`, accounts: ['OFF CUSTOMER', 'OFF SUPPLIER', 'OFF MILL', 'OFF JOB WORKER', 'Bank A/c', 'Cash A/c'], ledgers: ['OFF CUSTOMER', 'OFF SUPPLIER', 'OFF MILL', 'Bank A/c', 'Cash A/c'], account: 'OFF CUSTOMER' };
    const reportIds = require('../../../../services/jsmReports').ids();
    const VOLATILE = /^(asOn|generatedAt|printedAt|runAt|tookMs)$/;
    // Reports show dates, not times: a summary line carries the time of whichever bill came first that day.
    const day = (x) => (typeof x === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$/.test(x) ? x.slice(0, 10) : x);
    const norm = (v) => JSON.stringify(v ?? null, (k, x) => (VOLATILE.test(k) ? undefined : day(x)));
    // Same lines in another order is not a wrong figure: compare contents, report order separately.
    const canon = (v) => {
      if (Array.isArray(v)) return v.map(canon).map((x) => [JSON.stringify(x), x]).sort((p, q) => (p[0] < q[0] ? -1 : 1)).map((x) => x[1]);
      if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
      return v;
    };
    const canonText = (v) => JSON.stringify(canon(JSON.parse(norm(v))));
    const same = (p, q) => norm(p) === norm(q) || canonText(p) === canonText(q);
    const orderOnly = (a, b) => Object.keys(a).filter((k) => norm(a[k].body) !== norm(b[k].body) && same(a[k].body, b[k].body));
    const where = (x, z) => { const p = canonText(x); const t = canonText(z); let i = 0; while (i < p.length && p[i] === t[i]) i += 1; return `\n  one   ...${p.slice(Math.max(0, i - 90), i + 120)}\n  other ...${t.slice(Math.max(0, i - 90), i + 120)}`; };
    const rowsOf = (d) => { let best = 0; JSON.stringify(d ?? null, (k, x) => { if (Array.isArray(x)) best = Math.max(best, x.length); return x; }); return best; };
    const runAll = async (cli, t) => {
      const out = {};
      for (const r of reportIds) { const res = await cli.post(`/reports/jsm/${r}`, { token: t, body: P }); out[r] = { status: res.status, body: data(res), msg: res.body?.message }; }
      return out;
    };
    const CORE = ['/accounting/trial-balance', '/accounting/profit-loss', '/accounting/balance-sheet', '/accounting/outstanding', '/sales?limit=200', '/purchases?limit=200', '/jobs', '/notes', '/returns', '/accounting/payments', '/accounting/entries', '/reports/stock', '/reports/daily', '/reports/jobwork'];
    let offline; let offCore;
    const core = async (cli, t) => { const o = {}; for (const p of CORE) { const r = await cli.get(p, { token: t }); o[p] = { status: r.status, body: data(r) }; } for (const [n, l] of [['customer', custLedger], ['supplier', suppLedger], ['mill', millLedger], ['bank', bankId], ['cash', cashId]]) { const r = await cli.get(`/accounting/ledgers/${l}/statement`, { token: t }); o[`ledger statement: ${n}`] = { status: r.status, body: data(r) }; } return o; };
    await test('core reports, lists and ledger statements open offline', async () => {
      offCore = await core(local, tok);
      const bad = Object.entries(offCore).filter(([, v]) => v.status !== 200);
      assert(!bad.length, bad.map(([k, v]) => `${k} HTTP ${v.status} ${JSON.stringify(v.body).slice(0, 120)}`).join('\n'));
      return `${Object.keys(offCore).length} opened`;
    });
    await test('JSM reports: none crashes offline', async () => {
      offline = await runAll(local, tok);
      const crash = Object.entries(offline).filter(([, v]) => v.status >= 500);
      const refuse = Object.entries(offline).filter(([, v]) => v.status >= 400 && v.status < 500);
      const okc = Object.entries(offline).filter(([, v]) => v.status === 200);
      console.log(`      ${reportIds.length} reports: ${okc.length} ran (${okc.filter(([, v]) => rowsOf(v.body) > 0).length} with rows), ${refuse.length} asked for more input, ${crash.length} crashed`);
      for (const [k, v] of refuse) console.log(`        needs input: ${k} - ${v.status} ${String(v.msg).slice(0, 90)}`);
      assert(!crash.length, crash.map(([k, v]) => `${k}: ${v.status} ${v.msg}`).join('\n'));
    });
    await test('trial balance tallies offline (debit = credit)', async () => {
      const rows = []; JSON.stringify(offCore['/accounting/trial-balance'].body, (k, x) => { if (x && typeof x === 'object' && !Array.isArray(x) && (x.debit != null || x.credit != null) && (x.ledgerId || x.name || x._id)) rows.push(x); return x; });
      const dr = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0); const cr = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
      assert(rows.length && Math.abs(dr - cr) < 0.01, `rows ${rows.length} debit ${dr} credit ${cr}`);
      return `Dr ${dr.toFixed(2)} = Cr ${cr.toFixed(2)}`;
    });

    console.log('\n[4] App closed and reopened, still no net');
    await test('entries waiting are counted, cloud known to be unreachable', async () => { const s = await pending(); assert(s.pending > 0, JSON.stringify(s)); return `${s.pending} waiting`; });
    await test('close, reopen, sign in with no internet, everything still there', async () => {
      await shutdownLocalStack(); await sleep(2500); await bootDesktop();
      tok = ok(await local.post('/auth/login', { body: { email: fx.email, password: fx.password, deviceId: fx.deviceId } }), 'offline login').token;
      const again = await core(local, tok);
      const diff = Object.keys(offCore).filter((k) => !same(again[k].body, offCore[k].body));
      assert(!diff.length, diff.map((k) => `changed after restart: ${k}${where(offCore[k].body, again[k].body)}`).join('\n'));
      const s = await pending(); assert(s.pending > 0, `waiting entries lost: ${JSON.stringify(s)}`);
      return `${s.pending} still waiting`;
    });
    await mk('after', 'a new Sale bill after the restart', async () => ok(await L('/sales', sale(3)), 'sale after restart'));

    console.log('\n[5] NET ON — no button pressed');
    await startCentral();
    await test('everything uploads by itself', async () => {
      const t0 = Date.now(); let s;
      for (;;) { s = await pending(); if (s.pending === 0 && s.online !== false) break; assert(Date.now() - t0 < 240000, `still waiting after 4 min: ${JSON.stringify(s)}`); await sleep(2000); }
      return `${Math.round((Date.now() - t0) / 1000)} s`;
    });

    console.log('\n[6] Desktop = cloud');
    await test('every document identical on both sides', async () => {
      let d; for (let i = 0; i < 10; i++) { d = await diffMirror(stack.mongoUri, centralUri, companyIds, scope.BOTH); if (!d.diffs.length) break; await sleep(3000); }
      assert(!d.diffs.length, `${d.diffs.length} of ${d.n}:\n${d.diffs.slice(0, 20).join('\n')}`);
      return `${d.n} documents in ${scope.BOTH.length} collections`;
    });
    await test('collections written on the desktop but NOT part of the sync', async () => {
      const count = (uri) => withDb(uri, async (db) => { const o = {}; for (const c of await db.listCollections().toArray()) { if (scope.ALL.includes(c.name) || /^system\./.test(c.name)) continue; const q = await db.collection(c.name).countDocuments({ companyId: { $in: companyIds.flatMap((x) => [x, new BSON.ObjectId(x)]) } }); if (q) o[c.name] = q; } return o; });
      const a = await count(stack.mongoUri); const b = await count(centralUri);
      console.log(`      desktop-only collections: ${JSON.stringify(a)}\n      cloud: ${JSON.stringify(b)}`);
    });
    let webTok = webToken;
    await test('web sign-in sees the offline entries', async () => {
      webTok = ok(await central.post('/auth/login', { body: { email: fx.email, password: fx.password, deviceId: 'WEB', deviceName: 'WEB' } }), 'web login').token;
      const r = await central.get(`/sales/${id.sale}`, { token: webTok }); ok(r, 'offline sale on web');
      const p = await central.get(`/purchases/${id.pur}`, { token: webTok }); ok(p, 'offline purchase on web');
    });
    await test('core reports, lists and ledgers: desktop = cloud', async () => {
      const a = await core(local, tok); const b = await core(central, webTok);
      const bad = Object.keys(a).filter((k) => a[k].status !== b[k].status || !same(a[k].body, b[k].body));
      assert(!bad.length, bad.map((k) => k + where(a[k].body, b[k].body)).join('\n'));
      return `${Object.keys(a).length} equal; line order differs in: ${orderOnly(a, b).join(', ') || 'none'}`;
    });
    await test('JSM reports: desktop = cloud', async () => {
      const a = await runAll(local, tok); const b = await runAll(central, webTok);
      const bad = reportIds.filter((k) => a[k].status !== b[k].status || !same(a[k].body, b[k].body));

      assert(!bad.length, bad.slice(0, 8).map((k) => `${k} ${a[k].status}/${b[k].status}${where(a[k].body, b[k].body)}`).join('\n') + (bad.length > 8 ? `\n...and ${bad.length - 8} more: ${bad.slice(8).join(', ')}` : ''));
      return `${reportIds.length} equal; line order differs in: ${orderOnly(a, b).join(', ') || 'none'}`;
    });
    await test('no duplicate bill numbers or ledgers on the cloud', async () => withDb(centralUri, async (db) => {
      for (const [c, f] of [['sales', 'invoiceNo'], ['ledgermasters', 'name']]) {
        const dup = await db.collection(c).aggregate([{ $match: { ...scope.scopeFilter(c, companyIds) } }, { $group: { _id: { b: '$bookId', n: `$${f}` }, k: { $sum: 1 } } }, { $match: { k: { $gt: 1 } } }]).toArray();
        assert(!dup.length, `${c}: ${JSON.stringify(dup)}`);
      }
    }));
    await test('web makes a bill → it comes to the desktop by itself, next desktop number does not clash', async () => {
      const w = ok(await central.post('/sales', { token: webTok, body: sale(2) }), 'web sale');
      const t0 = Date.now();
      for (;;) { const r = await local.get(`/sales/${w._id}`, { token: tok }); if (r.status === 200) break; assert(Date.now() - t0 < 180000, 'web bill did not reach the desktop in 3 min'); await sleep(2000); }
      const n = ok(await L('/sales', sale(2)), 'next desktop sale');
      assert(String(n.invoiceNo) !== String(w.invoiceNo), `clash on ${w.invoiceNo}`);
      return `web ${w.invoiceNo}, arrived in ${Math.round((Date.now() - t0) / 1000)} s, desktop next ${n.invoiceNo}`;
    });

    console.log('\n[7] Same number on both sides: desktop offline AND web making bills');
    let offNo; let webNo; let offId; let webId;
    await test('desktop (offline) and web each make a bill', async () => {
      for (let i = 0; i < 30 && (await pending()).pending > 0; i += 1) await sleep(1000);
      await stopCentral();
      const d = ok(await L('/sales', sale(4)), 'offline sale'); offNo = d.invoiceNo; offId = d._id;
      await shutdownLocalStack(); await sleep(2500);
      await startCentral();
      const w = ok(await central.post('/sales', { token: webTok, body: sale(6) }), 'web sale'); webNo = w.invoiceNo; webId = w._id;
      return `desktop ${offNo}, web ${webNo}`;
    });
    await test('after reconnecting, no bill is lost and the owner is told which one clashes', async () => {
      await bootDesktop();
      tok = ok(await local.post('/auth/login', { body: { email: fx.email, password: fx.password, deviceId: fx.deviceId } }), 'login').token;
      await sleep(45000);
      const s = await pending();
      const rows = async (uri) => withDb(uri, async (db) => (await db.collection('sales').find({ _id: { $in: [new BSON.ObjectId(offId), new BSON.ObjectId(webId)] } }).toArray()).map((x) => `${String(x._id) === String(offId) ? 'desktop-bill' : 'web-bill'} no ${x.invoiceNo}`).sort());
      const onDesk = await rows(stack.mongoUri); const onCloud = await rows(centralUri);
      const full = ok(await local.get('/sync/mirror/status', { token: tok }), 'status');
      console.log(`      on desktop: ${onDesk.join(', ')}\n      on cloud:   ${onCloud.join(', ')}\n      refused: ${JSON.stringify(full.failing.map((x) => x.help))}`);
      assert(onDesk.some((x) => x.startsWith('desktop-bill')) && onCloud.some((x) => x.startsWith('web-bill')), 'a bill was lost');
      assert(String(offNo) === String(webNo), `test did not produce a clash: ${offNo} / ${webNo}`);
      assert(s.pending > 0 && full.failing.some((x) => x.code === 'DUPLICATE' && x.help.includes(`"${offNo}"`)), 'owner is not told which bill');
    });
    await test('left online: the desktop does not use up the server request limit', async () => {
      const left = async () => Number((await central.get('/sales?limit=1', { token: webTok })).headers['ratelimit-remaining']);
      const x = await left(); await sleep(60000); const y = await left();
      assert(x - y <= 12, `${x - y} requests in one minute`);
      return `${x - y - 1} requests a minute (limit 1000 in 15 minutes)`;
    });
    await test('with "Desktop-only Entries" ON the web refuses, so it cannot happen', async () => {
      ok(await local.put('/sync/mirror/lock', { token: tok, body: { desktopOnly: true } }), 'lock');
      const r = await central.post('/sales', { token: webTok, body: sale(1) });
      assert(r.status === 423, `expected 423, got ${r.status}`);
    });
  } catch (err) {
    failures.push(`harness: ${err.message}`);
    console.error('HARNESS ERROR', err.message, '\ncentral log:', centralProc?._hybridLogs?.stderr?.slice(-800));
  } finally {
    await shutdownLocalStack().catch(() => {});
    await stopCentral().catch(() => {});
    await cloudMms.stop().catch(() => {});
    await sleep(2500);
    try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 6, retryDelay: 800 }); } catch (e) { console.log('cleanup', userData, e.code); }
  }
  console.log(`\nINSTALLED DESKTOP OFFLINE: ${failures.length ? 'FAIL' : 'PASS'}   passed ${passed}  failed ${failures.length}`);
  for (const f of failures) console.log(`  - ${f.split('\n')[0].slice(0, 200)}`);
  process.exit(failures.length ? 1 : 0);
}
main();
