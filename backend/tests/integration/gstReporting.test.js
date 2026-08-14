/**
 * GST reporting — reconciliation suite (isolated in-memory MongoDB).
 *
 * The governing rule for every assertion here: the REPORT must equal the SAVED
 * TRANSACTIONS. Expected tax figures are never hardcoded — they are read back off the
 * stored Sales/Purchase/Note documents and compared against what the GST endpoints
 * return, so a difference of 0 proves the report has no independent calculation drifting
 * from the books.
 *
 * Covers: B2B vs B2C classification, multi-rate, GSTR-1 totals, GSTR-2/ITC totals,
 * CA-dashboard outward totals (regression guard for the B2C-outward-shows-zero bug),
 * date-range honouring (regression guard for the dropped endDate), settlement-discount
 * Credit/Debit Notes reaching CDNR/CDNUR, discount edit, and voucher reversal.
 */
'use strict';

const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-chars!!';

const assert = require('node:assert/strict');
const test = require('node:test');
const { describe, it, before, after } = test;
const mongoose = require(path.join(ROOT, 'node_modules/mongoose'));
const { MongoMemoryServer } = require(path.join(ROOT, 'node_modules/mongodb-memory-server'));
const request = require(path.join(ROOT, 'node_modules/supertest'));

let mongoServer, app, tok, companyId;
let regCustomerId, unregCustomerId, supplierId, itemId;
let regLedgerId, unregLedgerId, supplierLedgerId, bankLedgerId;
let Sales, Purchase, DebitCreditNote, LedgerMaster;

const P_FROM = '2026-09-01';
const P_TO = '2026-09-30';
const D = (d) => new Date(`2026-09-${d}T10:00:00.000Z`).toISOString();

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const unwrap = (res) => {
  if (res.body?.success === false) throw new Error(`API ${res.status}: ${res.body.message || ''}`);
  return res.body.data !== undefined ? res.body.data : res.body;
};
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const gstr1 = async (from = P_FROM, to = P_TO) =>
  unwrap(await request(app).get(`/api/gst/gstr1?startDate=${from}&endDate=${to}`).set(auth(tok)));
const gstr2 = async (from = P_FROM, to = P_TO) =>
  unwrap(await request(app).get(`/api/gst/gstr2?startDate=${from}&endDate=${to}`).set(auth(tok)));
const caDash = async (from = P_FROM, to = P_TO) =>
  unwrap(await request(app).get(`/api/gst/ca-dashboard?startDate=${from}&endDate=${to}`).set(auth(tok)));

async function bootstrap() {
  try {
  mongoServer = await MongoMemoryServer.create({ instance: { timeoutMs: 60_000 } });
  process.env.MONGO_URI = mongoServer.getUri();
  app = require(path.join(ROOT, 'server'));
  await new Promise((res, rej) => {
    if (mongoose.connection.readyState === 1) return res();
    const t = setTimeout(() => rej(new Error('connect timeout')), 20000);
    mongoose.connection.once('connected', () => { clearTimeout(t); res(); });
    mongoose.connection.once('error', (e) => { clearTimeout(t); rej(e); });
  });
  const real = mongoose.startSession.bind(mongoose);
  mongoose.startSession = async function () {
    const s = await real();
    s.startTransaction = () => {}; s.commitTransaction = async () => {};
    s.abortTransaction = async () => {}; s.inTransaction = () => false;
    return s;
  };

  Sales = require(path.join(ROOT, 'models/Sales'));
  Purchase = require(path.join(ROOT, 'models/Purchase'));
  DebitCreditNote = require(path.join(ROOT, 'models/DebitCreditNote'));
  LedgerMaster = require(path.join(ROOT, 'models/LedgerMaster'));
  const acct = require(path.join(ROOT, 'services/accountingService'));

  const reg = await request(app).post('/api/auth/register').send({
    name: 'GST Auditor', email: `gst-${Date.now()}@test.com`,
    password: 'TestPass123!', companyName: 'GST TEST CORP',
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  tok = reg.body.token;
  const me = unwrap(await request(app).get('/api/auth/me').set(auth(tok)));
  companyId = me.companyId || me.user?.companyId;
  assert.ok(companyId, 'companyId missing from /auth/me');
  await acct.seedSystemLedgers(companyId);

  // Registered (B2B) vs unregistered (B2C) customers — classification is driven purely
  // by whether the party carries a 15-char GSTIN.
  regCustomerId = unwrap(await request(app).post('/api/parties').set(auth(tok))
    .send({ name: 'Registered Buyer', type: 'Customer', gstin: '24AAACR5055K1Z5', stateCode: '24' }))._id;
  unregCustomerId = unwrap(await request(app).post('/api/parties').set(auth(tok))
    .send({ name: 'Walk-in Buyer', type: 'Customer' }))._id;
  supplierId = unwrap(await request(app).post('/api/parties').set(auth(tok))
    .send({ name: 'GST Supplier', type: 'Supplier', gstin: '24AAACS1234M1Z9', stateCode: '24' }))._id;
  itemId = unwrap(await request(app).post('/api/items').set(auth(tok))
    .send({ name: 'Taxable Fabric', category: 'Grey', gstRate: 5, unit: 'MTRS', hsnCode: '5407' }))._id;

  regLedgerId = (await acct.getOrCreatePartyLedger(companyId, regCustomerId))._id;
  unregLedgerId = (await acct.getOrCreatePartyLedger(companyId, unregCustomerId))._id;
  supplierLedgerId = (await acct.getOrCreatePartyLedger(companyId, supplierId))._id;
  const bank = await LedgerMaster.findOne({ companyId, name: 'Bank A/c' });
  if (bank.accountType !== 'Bank') { bank.accountType = 'Bank'; await bank.save(); }
  bankLedgerId = bank._id;
  } catch (e) {
    // node:test cancels every subtest without surfacing a failing hook's error, which
    // makes a broken bootstrap look like 15 mysteriously cancelled tests. Log it.
    console.error('BOOTSTRAP FAILED >>>', e && e.stack ? e.stack : e);
    throw e;
  }
}

async function teardown() {
  mongoose.connection.removeAllListeners('disconnected');
  try { await mongoose.connection.close(); } catch (_) {}
  try { await mongoServer.stop(); } catch (_) {}
}

let b2bSaleId, b2cSaleId, purchaseId;

test.describe('GST reporting — reconciliation against saved transactions', () => {
  test.before(bootstrap);
  test.after(teardown);

  test.it('SETUP: B2B sale (5%), B2C sale (12%), and a purchase (5%) are created', async () => {
    const s1 = await request(app).post('/api/sales').set(auth(tok)).send({
      customerId: regCustomerId, invoiceNo: 'AUTO', date: D('05'), gstType: 'CGST+SGST',
      items: [{ itemId, mts: 100, rate: 100, amount: 10000, gstRate: 5 }],
      taxableAmount: 10000, cgst: 250, sgst: 250, netAmount: 10500,
    });
    assert.equal(s1.status, 201, JSON.stringify(s1.body));
    b2bSaleId = unwrap(s1)._id;

    // gstRate must be given at INVOICE level: salesService recomputes tax server-side and
    // falls back to the Item master rate when the invoice does not state one, so a
    // line-only rate would silently be replaced by the item's 5%.
    const s2 = await request(app).post('/api/sales').set(auth(tok)).send({
      customerId: unregCustomerId, invoiceNo: 'AUTO', date: D('07'), gstType: 'CGST+SGST',
      gstRate: 12,
      items: [{ itemId, mts: 50, rate: 100, amount: 5000, gstRate: 12 }],
      taxableAmount: 5000, cgst: 300, sgst: 300, netAmount: 5600,
    });
    assert.equal(s2.status, 201, JSON.stringify(s2.body));
    b2cSaleId = unwrap(s2)._id;

    const p1 = await request(app).post('/api/purchases').set(auth(tok)).send({
      supplierId, invoiceNo: 'AUTO', date: D('06'), gstType: 'CGST+SGST',
      items: [{ itemId, mts: 200, rate: 50, amount: 10000, gstPer: 5 }],
      taxableAmount: 10000, cgst: 250, sgst: 250, netAmount: 10500,
    });
    assert.equal(p1.status, 201, JSON.stringify(p1.body));
    purchaseId = unwrap(p1)._id;
  });

  test.it('GSTR-1 totals reconcile EXACTLY with the saved Sales documents (difference = 0)', async () => {
    const saved = await Sales.find({ companyId, status: { $ne: 'cancelled' } });
    const exp = saved.reduce((a, s) => ({
      taxable: a.taxable + Number(s.taxableAmount || 0),
      cgst: a.cgst + Number(s.cgst || 0),
      sgst: a.sgst + Number(s.sgst || 0),
      igst: a.igst + Number(s.igst || 0),
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

    const g = await gstr1();
    const t = g.totals || {};
    assert.equal(r2(t.taxable), r2(exp.taxable), 'taxable must reconcile');
    assert.equal(r2(t.cgst), r2(exp.cgst), 'CGST must reconcile');
    assert.equal(r2(t.sgst), r2(exp.sgst), 'SGST must reconcile');
    assert.equal(r2(t.igst), r2(exp.igst), 'IGST must reconcile');
    assert.equal(t.invoiceCount, saved.length, 'invoice count must reconcile');
  });

  test.it('B2B vs B2C: registered customer lands in b2b, unregistered in b2cs — no invoice counted twice', async () => {
    const g = await gstr1();
    const b2bInv = (g.b2b || []).flatMap((p) => (p.inv || []).map((i) => ({ ctin: p.ctin, ...i })));
    assert.equal(b2bInv.length, 1, 'exactly one B2B invoice');
    assert.equal(b2bInv[0].ctin, '24AAACR5055K1Z5', 'grouped under the buyer GSTIN');

    const b2csTaxable = (g.b2cs || []).reduce((s, r) => s + Number(r.txval || 0), 0);
    const b2bTaxable = b2bInv.reduce((s, i) => s + Number(i.itms?.[0]?.itm_det?.txval || 0), 0);

    const saved = await Sales.find({ companyId });
    const grand = saved.reduce((s, x) => s + Number(x.taxableAmount || 0), 0);
    assert.equal(r2(b2bTaxable + b2csTaxable), r2(grand),
      'B2B + B2C must equal total sales exactly — no double count, nothing dropped');
  });

  test.it('multiple GST rates are preserved per section (5% B2B, 12% B2C)', async () => {
    const g = await gstr1();
    const b2bRate = g.b2b?.[0]?.inv?.[0]?.itms?.[0]?.itm_det?.rt;
    assert.equal(Number(b2bRate), 5, 'B2B invoice keeps its 5% rate');
    const rates = (g.b2cs || []).map((r) => Number(r.rt));
    assert.ok(rates.includes(12), `B2C should carry the 12% rate, got ${JSON.stringify(rates)}`);
  });

  test.it('GSTR-2 reconciles EXACTLY with saved Purchase documents (ITC side)', async () => {
    const saved = await Purchase.find({ companyId });
    const exp = saved.reduce((a, p) => ({
      taxable: a.taxable + Number(p.taxableAmount || 0),
      cgst: a.cgst + Number(p.cgst || 0),
      sgst: a.sgst + Number(p.sgst || 0),
      igst: a.igst + Number(p.igst || 0),
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

    const rows = await gstr2();
    const got = rows.reduce((a, p) => ({
      taxable: a.taxable + Number(p.taxable || 0),
      cgst: a.cgst + Number(p.cgst || 0),
      sgst: a.sgst + Number(p.sgst || 0),
      igst: a.igst + Number(p.igst || 0),
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

    assert.equal(rows.length, saved.length);
    assert.equal(r2(got.taxable), r2(exp.taxable));
    assert.equal(r2(got.cgst), r2(exp.cgst));
    assert.equal(r2(got.sgst), r2(exp.sgst));
    assert.equal(r2(got.igst), r2(exp.igst));
  });

  test.it('REGRESSION: CA-dashboard outward totals equal GSTR-1 totals even when sales are all/partly B2C', async () => {
    // Guards the bug where outward totals were summed from the B2B-only flattened list,
    // reporting zero outward tax for a B2C-heavy business and turning GSTR-3B into a
    // net credit instead of a liability.
    const g = await gstr1();
    const d = await caDash();
    assert.equal(r2(d.summary.outwardTaxable), r2(g.totals.taxable), 'outward taxable must match GSTR-1');
    assert.equal(
      r2(d.summary.outwardGst),
      r2(Number(g.totals.cgst) + Number(g.totals.sgst) + Number(g.totals.igst)),
      'outward GST must match GSTR-1'
    );
    assert.ok(d.summary.outwardTaxable > 0, 'outward must never be zero when sales exist');
    assert.equal(d.summary.salesCount, g.totals.invoiceCount, 'sales count must span all sections');
  });

  test.it('GSTR-3B outward/ITC/net derive from the same Sales and Purchase data', async () => {
    const d = await caDash();
    const g1 = await gstr1();
    const p = await gstr2();
    const itc = p.reduce((s, x) => s + Number(x.cgst || 0) + Number(x.sgst || 0) + Number(x.igst || 0), 0);
    const out = Number(g1.totals.cgst) + Number(g1.totals.sgst) + Number(g1.totals.igst);

    assert.equal(r2(d.gstr3b.outward.total), r2(out), '3B outward = GSTR-1 tax');
    assert.equal(r2(d.gstr3b.itc.total), r2(itc), '3B ITC = GSTR-2 tax');
    assert.equal(r2(d.gstr3b.net.total), r2(out - itc), '3B net = outward − ITC');
  });

  test.it('HSN summary reconciles with GSTR-1 taxable value (no line double-counted)', async () => {
    const g = await gstr1();
    const rows = g.hsn?.data || [];
    assert.ok(rows.length > 0, 'HSN rows expected — items carry hsnCode 5407');
    const hsnTaxable = rows.reduce((s, h) => s + Number(h.txval || 0), 0);
    assert.equal(r2(hsnTaxable), r2(g.totals.taxable), 'HSN taxable must equal GSTR-1 taxable');
  });

  test.it('REGRESSION: an explicit From/To range is honoured (multi-month range is not collapsed)', async () => {
    // Guards the bug where endDate was dropped and the sales side used only the month
    // containing startDate — a Aug-to-Sep range then reported zero September sales.
    const wide = await gstr1('2026-08-01', '2026-09-30');
    assert.equal(r2(wide.totals.taxable), r2((await gstr1()).totals.taxable),
      'range spanning the data month must include it');

    const outside = await gstr1('2026-11-01', '2026-11-30');
    assert.equal(r2(outside.totals.taxable), 0, 'a period with no transactions must report zero, not leak data');
    assert.equal(outside.totals.invoiceCount, 0);
  });

  let receiptId, autoNoteId;
  test.it('SETTLEMENT DISCOUNT (Sales): receipt + discount raises a Credit Note that reaches GSTR-1 notes', async () => {
    const bill = await Sales.findById(b2bSaleId);
    const due = Number(bill.netAmount);            // 10,500
    const discount = 500;
    const cash = r2(due - discount);               // 10,000

    const res = await request(app).post('/api/accounting/receipts').set(auth(tok)).send({
      partyLedgerId: regLedgerId, bankLedgerId, paymentMode: 'NEFT', bookKind: 'bank',
      accBill: 'B', status: 'Posted', amount: cash, date: D('20'),
      againstInvoices: [{ invoiceId: b2bSaleId, invoiceNo: bill.invoiceNo, amount: cash, discount }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    receiptId = unwrap(res)._id;

    const notes = await DebitCreditNote.find({ companyId, sourceVoucherId: receiptId, autoGenerated: true });
    assert.equal(notes.length, 1, 'exactly one auto Credit Note');
    assert.equal(notes[0].noteType, 'Credit');
    assert.equal(notes[0].noteSide, 'Sales');
    assert.equal(Number(notes[0].amount), discount);
    autoNoteId = notes[0]._id;

    // Registered buyer -> the note belongs in CDNR under that GSTIN.
    const g = await gstr1();
    const cdnrNotes = (g.cdnr || []).flatMap((c) => (c.nt || []).map((n) => ({ ctin: c.ctin, ...n })));
    const found = cdnrNotes.find((n) => n.nt_num === notes[0].noteNo);
    assert.ok(found, `auto Credit Note ${notes[0].noteNo} must appear in CDNR`);
    assert.equal(found.ntty, 'C', 'reported as a Credit note');
    assert.equal(found.ctin, '24AAACR5055K1Z5');
  });

  test.it('NO DOUBLE COUNT: the ₹500 discount does not inflate outward sales', async () => {
    // The discount must show up as a NOTE adjustment, never as an extra sale.
    const saved = await Sales.find({ companyId, status: { $ne: 'cancelled' } });
    const salesTaxable = saved.reduce((s, x) => s + Number(x.taxableAmount || 0), 0);
    const g = await gstr1();
    assert.equal(r2(g.totals.taxable), r2(salesTaxable),
      'GSTR-1 outward taxable must still equal invoice taxable — the discount is not a second sale');
    assert.equal(g.totals.invoiceCount, saved.length, 'the note must not be counted as an invoice');
  });

  test.it('EDIT: changing the discount 500 -> 300 leaves exactly one active note at the new value', async () => {
    const bill = await Sales.findById(b2bSaleId);
    const cash = r2(Number(bill.netAmount) - 300);

    const res = await request(app).put(`/api/accounting/payments/${receiptId}`).set(auth(tok)).send({
      partyLedgerId: regLedgerId, bankLedgerId, paymentMode: 'NEFT', bookKind: 'bank',
      accBill: 'B', status: 'Posted', amount: cash, date: D('20'),
      againstInvoices: [{ invoiceId: b2bSaleId, invoiceNo: bill.invoiceNo, amount: cash, discount: 300 }],
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const all = await DebitCreditNote.find({ companyId, sourceVoucherId: receiptId, autoGenerated: true });
    const active = all.filter((n) => n.status === 'Posted');
    assert.equal(active.length, 1, 'exactly one active note after edit');
    assert.equal(Number(active[0].amount), 300, 'note follows the edited discount');
    assert.ok(all.some((n) => String(n._id) === String(autoNoteId) && n.status === 'Reversed'),
      'the superseded 500 note is retired, not deleted');

    const g = await gstr1();
    const nums = (g.cdnr || []).flatMap((c) => (c.nt || []).map((n) => n.nt_num));
    const retired = all.find((n) => String(n._id) === String(autoNoteId));
    assert.ok(nums.includes(active[0].noteNo), 'the ₹300 note is reported');
    assert.ok(!nums.includes(retired.noteNo), 'the reversed ₹500 note must NOT be reported');
  });

  test.it('REVERSE: reversing the receipt removes its note from GSTR-1 entirely', async () => {
    const res = await request(app).post(`/api/accounting/payments/${receiptId}/reverse`)
      .set(auth(tok)).send({ reason: 'gst test' });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const all = await DebitCreditNote.find({ companyId, sourceVoucherId: receiptId, autoGenerated: true });
    assert.ok(all.every((n) => n.status === 'Reversed'), 'every linked note retired with the voucher');

    const g = await gstr1();
    const nums = (g.cdnr || []).flatMap((c) => (c.nt || []).map((n) => n.nt_num));
    for (const n of all) {
      assert.ok(!nums.includes(n.noteNo), `reversed note ${n.noteNo} must not appear in GSTR-1`);
    }

    // Outward sales are untouched by the reversal.
    const saved = await Sales.find({ companyId, status: { $ne: 'cancelled' } });
    const salesTaxable = saved.reduce((s, x) => s + Number(x.taxableAmount || 0), 0);
    assert.equal(r2(g.totals.taxable), r2(salesTaxable));
  });

  test.it('SETTLEMENT DISCOUNT (Purchase): payment + discount raises a Debit Note on the purchase side only', async () => {
    const bill = await Purchase.findById(purchaseId);
    const cash = r2(Number(bill.netAmount) - 200);

    const res = await request(app).post('/api/accounting/payments').set(auth(tok)).send({
      partyLedgerId: supplierLedgerId, bankLedgerId, paymentMode: 'NEFT', bookKind: 'bank',
      accBill: 'B', status: 'Posted', amount: cash, date: D('22'),
      againstInvoices: [{ invoiceId: purchaseId, invoiceNo: bill.invoiceNo, amount: cash, discount: 200 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const voucherId = unwrap(res)._id;

    const notes = await DebitCreditNote.find({ companyId, sourceVoucherId: voucherId, autoGenerated: true });
    assert.equal(notes.length, 1);
    assert.equal(notes[0].noteType, 'Debit');
    assert.equal(notes[0].noteSide, 'Purchase');

    // A purchase-side note adjusts ITC and must NEVER be filed as an outward supply.
    const g = await gstr1();
    const outwardNums = [
      ...(g.cdnr || []).flatMap((c) => (c.nt || []).map((n) => n.nt_num)),
      ...(g.cdnur || []).map((n) => n.nt_num),
    ];
    assert.ok(!outwardNums.includes(notes[0].noteNo),
      'purchase Debit Note must not leak into GSTR-1 outward sections');

    // And it must not inflate the purchase register either.
    const savedP = await Purchase.find({ companyId });
    const rows = await gstr2();
    assert.equal(rows.length, savedP.length, 'the note is not a second purchase bill');
  });

  test.it('company isolation: a second company sees none of this data', async () => {
    const other = await request(app).post('/api/auth/register').send({
      name: 'Other Co', email: `other-${Date.now()}@test.com`,
      password: 'TestPass123!', companyName: 'OTHER CORP',
    });
    assert.equal(other.status, 201);
    const otherTok = other.body.token;
    const g = unwrap(await request(app)
      .get(`/api/gst/gstr1?startDate=${P_FROM}&endDate=${P_TO}`).set(auth(otherTok)));
    assert.equal(r2(g.totals?.taxable || 0), 0, 'no cross-company leakage');
    assert.equal(g.totals?.invoiceCount || 0, 0);
  });
});
