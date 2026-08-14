/**
 * Full ERP lifecycle — isolated in-memory MongoDB, driven entirely through real HTTP
 * routes (never direct model writes for the transactional steps), exactly mirroring how
 * a real user would move through the app:
 *
 *   Purchase (grey fabric) -> Job Issue -> Job Receive (partial, then final)
 *   -> Sale (finished fabric) -> Bank Receipt w/ discount -> Bank Payment w/ discount
 *   -> Job-work Charges Payment w/ discount -> Ledger / Trial Balance / Outstanding
 *
 * Every number below is hand-computed up front and asserted against what the API
 * actually returns and what lands in the real AccountingEntry/BillSettlement/Job
 * documents — nothing is asserted "because the code says so."
 */
'use strict';

const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-chars!!';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const mongoose = require(path.join(ROOT, 'node_modules/mongoose'));
const { MongoMemoryServer } = require(path.join(ROOT, 'node_modules/mongodb-memory-server'));
const request = require(path.join(ROOT, 'node_modules/supertest'));

let mongoServer, app;
let tok, companyId;
let supplierId, customerId, workerId, itemId;
let supplierLedgerId, customerLedgerId, workerLedgerId, bankLedgerId;
let Sales, Purchase, Job, PaymentVoucher, DebitCreditNote, AccountingEntry, InventoryLot, LedgerMaster;

function auth(t) { return { Authorization: `Bearer ${t}` }; }
function unwrap(res) {
  if (res.body?.success === false) throw new Error(`API ${res.status}: ${res.body.message || JSON.stringify(res.body)}`);
  return res.body.data !== undefined ? res.body.data : res.body;
}

before(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { timeoutMs: 60_000 } });
  process.env.MONGO_URI = mongoServer.getUri();
  app = require(path.join(ROOT, 'server'));

  await new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    const t = setTimeout(() => reject(new Error('Mongoose connect timeout')), 20000);
    mongoose.connection.once('connected', () => { clearTimeout(t); resolve(); });
    mongoose.connection.once('error', (e) => { clearTimeout(t); reject(e); });
  });

  const realStartSession = mongoose.startSession.bind(mongoose);
  mongoose.startSession = async function () {
    const session = await realStartSession();
    session.startTransaction = () => {};
    session.commitTransaction = async () => {};
    session.abortTransaction = async () => {};
    session.inTransaction = () => false;
    return session;
  };

  Sales = require(path.join(ROOT, 'models/Sales'));
  Purchase = require(path.join(ROOT, 'models/Purchase'));
  Job = require(path.join(ROOT, 'models/Job'));
  PaymentVoucher = require(path.join(ROOT, 'models/PaymentVoucher'));
  DebitCreditNote = require(path.join(ROOT, 'models/DebitCreditNote'));
  AccountingEntry = require(path.join(ROOT, 'models/AccountingEntry'));
  InventoryLot = require(path.join(ROOT, 'models/InventoryLot'));
  LedgerMaster = require(path.join(ROOT, 'models/LedgerMaster'));
  const accountingService = require(path.join(ROOT, 'services/accountingService'));

  const reg = await request(app).post('/api/auth/register').send({
    name: 'E2E Lifecycle Auditor', email: `e2e-lifecycle-${Date.now()}@test.com`,
    password: 'TestPass123!', companyName: 'E2E LIFECYCLE CORP',
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  tok = reg.body.token;

  const me = unwrap(await request(app).get('/api/auth/me').set(auth(tok)));
  companyId = me.companyId || me.user?.companyId;
  await accountingService.seedSystemLedgers(companyId);

  supplierId = unwrap(await request(app).post('/api/parties').set(auth(tok))
    .send({ name: 'Grey Fabric Supplier', type: 'Supplier' }))._id;
  customerId = unwrap(await request(app).post('/api/parties').set(auth(tok))
    .send({ name: 'Retail Customer Co', type: 'Customer' }))._id;
  workerId = unwrap(await request(app).post('/api/parties').set(auth(tok))
    .send({ name: 'Dyeing Job Worker', type: 'Job Worker' }))._id;
  itemId = unwrap(await request(app).post('/api/items').set(auth(tok))
    .send({ name: 'Cotton Fabric', category: 'Grey', gstRate: 5, unit: 'MTRS' }))._id;

  supplierLedgerId = (await accountingService.getOrCreatePartyLedger(companyId, supplierId))._id;
  customerLedgerId = (await accountingService.getOrCreatePartyLedger(companyId, customerId))._id;
  workerLedgerId = (await accountingService.getOrCreatePartyLedger(companyId, workerId))._id;

  const bank = await LedgerMaster.findOne({ companyId, name: 'Bank A/c' });
  if (bank.accountType !== 'Bank') { bank.accountType = 'Bank'; await bank.save(); }
  bankLedgerId = bank._id;
});

after(async () => {
  mongoose.connection.removeAllListeners('disconnected');
  try { await mongoose.connection.close(); } catch (_) {}
  try { await mongoServer.stop(); } catch (_) {}
});

const drCr = (entry) => {
  const dr = entry.lines.filter(l => l.type === 'Dr').reduce((s, l) => s + Number(l.amount), 0);
  const cr = entry.lines.filter(l => l.type === 'Cr').reduce((s, l) => s + Number(l.amount), 0);
  return { dr, cr };
};
const ledgerTotals = (entries, ledgerId) => {
  let dr = 0, cr = 0;
  for (const e of entries) for (const l of e.lines) {
    if (String(l.ledgerId) === String(ledgerId)) {
      if (l.type === 'Dr') dr += Number(l.amount); else cr += Number(l.amount);
    }
  }
  return { dr: Math.round(dr * 100) / 100, cr: Math.round(cr * 100) / 100 };
};

let purchaseId, greyLotId, jobId, saleId, financeLotId;

describe('Full lifecycle: Purchase -> Job Issue -> Job Receive -> Sale -> Payment -> Receipt -> Ledger', () => {

  it('STEP 1 — Purchase: 200 Mtrs grey fabric @ Rs50 + 5% GST = Rs10,500', async () => {
    const res = await request(app).post('/api/purchases').set(auth(tok)).send({
      supplierId, invoiceNo: 'AUTO', date: new Date('2026-08-01').toISOString(),
      gstType: 'CGST+SGST',
      items: [{ itemId, mts: 200, pcs: 0, rate: 50, amount: 10000 }],
      taxableAmount: 10000, cgst: 250, sgst: 250, netAmount: 10500,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const doc = unwrap(res);
    purchaseId = doc._id;
    assert.equal(Number(doc.taxableAmount), 10000);
    assert.equal(Number(doc.netAmount), 10500);

    const AE = await AccountingEntry.find({ companyId, refId: purchaseId });
    assert.equal(AE.length, 1);
    const { dr, cr } = drCr(AE[0]);
    assert.ok(Math.abs(dr - cr) < 0.01, `Purchase entry unbalanced Dr=${dr} Cr=${cr}`);
    assert.ok(Math.abs(dr - 10500) < 0.01, `Purchase Dr should be 10500, got ${dr}`);

    const lots = unwrap(await request(app).get(`/api/inventory/lots?itemId=${itemId}`).set(auth(tok)));
    const fresh = lots.reduce((a, b) => (Number(b.remainingMtrs) > Number(a.remainingMtrs) ? b : a));
    greyLotId = fresh._id;
    assert.ok(Number(fresh.remainingMtrs) >= 200, `grey lot should carry 200 Mtrs, got ${fresh.remainingMtrs}`);
  });

  it('STEP 2 — Job Issue: 100 Mtrs sent to job worker for Dyeing @ Rs10/Mtr job rate', async () => {
    const res = await request(app).post('/api/jobs/issue').set(auth(tok)).send({
      workerId, lotId: greyLotId, issueQty: 100, issuePcs: 0,
      processType: 'Dyeing', jobRate: 10, date: new Date('2026-08-02').toISOString(),
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const job = unwrap(res);
    jobId = job._id;
    assert.equal(job.status, 'Issued');
    assert.equal(Number(job.issueQty), 100);

    const lotAfter = await InventoryLot.findById(greyLotId);
    assert.ok(Math.abs(Number(lotAfter.remainingMtrs) - 100) < 0.01, `grey lot should have 100 Mtrs left, got ${lotAfter.remainingMtrs}`);
  });

  it('STEP 3 — Job Receive tranche 1: 50 Mtrs PARTIAL, pending balance correctly tracked', async () => {
    const res = await request(app).post('/api/jobs/receive').set(auth(tok)).send({
      jobId, receivedQty: 50, receivedPcs: 0, charges: 500, gstAmount: 25, isFinal: false,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const data = unwrap(res);
    assert.equal(data.job.status, 'Partial');
    assert.equal(data.pendingQty, 50);

    const job = await Job.findById(jobId);
    assert.equal(job.pendingQty, 50, 'virtual pendingQty reflects the true balance');

    // Re-fetch via GET /api/jobs (what the Receive screen re-opens against) to prove the
    // pending balance is what the frontend now auto-fills — this is the originally
    // reported bug, verified end-to-end here.
    const jobsList = unwrap(await request(app).get('/api/jobs').set(auth(tok)));
    const reopened = jobsList.find(j => String(j._id) === String(jobId));
    assert.equal(reopened.pendingQty, 50, 'Receive screen would now pre-fill 50, not the original 100');
  });

  it('STEP 4 — Job Receive tranche 2: 50 Mtrs FINAL, job closes, wastage = 0, stock posts once', async () => {
    const res = await request(app).post('/api/jobs/receive').set(auth(tok)).send({
      jobId, receivedQty: 50, receivedPcs: 0, charges: 500, gstAmount: 25, isFinal: true,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const data = unwrap(res);
    assert.equal(data.job.status, 'Received');
    assert.equal(data.pendingQty, 0);

    const job = await Job.findById(jobId);
    assert.equal(Number(job.receivedQty), 100);
    assert.equal(Number(job.wastage), 0, 'fully received across both tranches — no wastage');
    assert.equal(Number(job.processCharges), 1000, '500 + 500 across both tranches');
    assert.equal(Number(job.processGstAmount), 50, '25 + 25 across both tranches');

    financeLotId = job.finishedLotId;
    const finishedLot = await InventoryLot.findById(financeLotId);
    assert.equal(Number(finishedLot.totalMtrs), 100, 'ONE finished lot grew across both tranches, not two separate lots');
    assert.equal(Number(finishedLot.remainingMtrs), 100);

    const chargeEntries = await AccountingEntry.find({ companyId, refId: jobId, refType: 'JobWorkCharges' });
    assert.equal(chargeEntries.length, 2, 'one charges posting per tranche');
    const stockEntries = await AccountingEntry.find({ companyId, refId: jobId, refType: 'JobReceive' });
    assert.equal(stockEntries.length, 1, 'stock valuation posts exactly once, at final closure');
    const { dr, cr } = drCr(stockEntries[0]);
    assert.ok(Math.abs(dr - cr) < 0.01, `stock valuation entry unbalanced Dr=${dr} Cr=${cr}`);
  });

  it('STEP 5 — Sale: 80 Mtrs finished fabric to customer @ Rs150 + 5% GST = Rs12,600', async () => {
    const res = await request(app).post('/api/sales').set(auth(tok)).send({
      customerId, invoiceNo: 'AUTO', date: new Date('2026-08-05').toISOString(),
      gstType: 'CGST+SGST',
      items: [{ itemId, lotId: financeLotId, mts: 80, pcs: 0, rate: 150, amount: 12000 }],
      taxableAmount: 12000, cgst: 300, sgst: 300, netAmount: 12600,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const doc = unwrap(res);
    saleId = doc._id;
    assert.equal(Number(doc.netAmount), 12600);

    const AE = await AccountingEntry.find({ companyId, refId: saleId });
    assert.equal(AE.length, 1);
    const { dr, cr } = drCr(AE[0]);
    assert.ok(Math.abs(dr - cr) < 0.01);
    assert.ok(Math.abs(dr - 12600) < 0.01);
  });

  let receiptVoucherId, creditNoteId;
  it('STEP 6 — Bank Receipt: customer pays Rs12,100 + Rs500 discount -> auto Credit Note Rs500 with REAL 5% GST', async () => {
    const res = await request(app).post('/api/accounting/receipts').set(auth(tok)).send({
      partyLedgerId: customerLedgerId, bankLedgerId, paymentMode: 'NEFT', bookKind: 'bank',
      accBill: 'B', status: 'Posted', amount: 12100, date: new Date('2026-08-08').toISOString(),
      narration: 'Receipt against sale', chequeNo: undefined,
      againstInvoices: [{ invoiceId: saleId, invoiceNo: 'n/a', amount: 12100, discount: 500 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const voucher = unwrap(res);
    receiptVoucherId = voucher._id;

    const notes = await DebitCreditNote.find({ companyId, sourceVoucherId: voucher._id, autoGenerated: true });
    assert.equal(notes.length, 1);
    const note = notes[0];
    creditNoteId = note._id;
    assert.equal(note.noteType, 'Credit');
    assert.equal(note.noteSide, 'Sales');
    assert.equal(Number(note.amount), 500);
    // The GST-rate fix: derived from the sale's real taxable/GST amounts (600/12000*100),
    // not the possibly-stale doc.gstRate field. Must NOT be 0 on a genuinely taxed bill.
    assert.equal(Number(note.gstRate), 5, 'auto note must carry the REAL 5% rate, not 0%');
    assert.ok(Number(note.gstAmount) > 0, 'GST amount on the note must be non-zero');
    assert.ok(note.billNo && note.billNo.length > 0, 'Bill No must be carried over from the source invoice, not blank');

    const saleAfter = await Sales.findById(saleId);
    assert.equal(Number(saleAfter.paidAmount), 12600, '12,100 cash + 500 discount = full settlement');

    const { dr, cr } = drCr(await AccountingEntry.findById(voucher.accountingEntryId));
    assert.ok(Math.abs(dr - cr) < 0.01);
    assert.ok(Math.abs(dr - 12600) < 0.01);
  });

  let paymentVoucherId, debitNoteId;
  it('STEP 7 — Bank Payment: pay supplier Rs10,200 + Rs300 discount -> auto Debit Note Rs300 with REAL 5% GST', async () => {
    const res = await request(app).post('/api/accounting/payments').set(auth(tok)).send({
      partyLedgerId: supplierLedgerId, bankLedgerId, paymentMode: 'NEFT', bookKind: 'bank',
      accBill: 'B', status: 'Posted', amount: 10200, date: new Date('2026-08-09').toISOString(),
      narration: 'Payment against purchase',
      againstInvoices: [{ invoiceId: purchaseId, invoiceNo: 'n/a', amount: 10200, discount: 300 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const voucher = unwrap(res);
    paymentVoucherId = voucher._id;

    const notes = await DebitCreditNote.find({ companyId, sourceVoucherId: voucher._id, autoGenerated: true });
    assert.equal(notes.length, 1);
    const note = notes[0];
    debitNoteId = note._id;
    assert.equal(note.noteType, 'Debit');
    assert.equal(note.noteSide, 'Purchase');
    assert.equal(Number(note.amount), 300);
    assert.equal(Number(note.gstRate), 5, 'auto note must carry the REAL 5% rate, not 0%');
    assert.ok(note.billNo && note.billNo.length > 0);

    const purchaseAfter = await Purchase.findById(purchaseId);
    assert.equal(Number(purchaseAfter.paidAmount), 10500);
  });

  it('STEP 8 — Job-work Charges Payment: pay worker Rs1,030 + Rs20 discount -> auto Debit Note Rs20 (kind=job branch)', async () => {
    const res = await request(app).post('/api/accounting/payments').set(auth(tok)).send({
      partyLedgerId: workerLedgerId, bankLedgerId, paymentMode: 'NEFT', bookKind: 'bank',
      accBill: 'B', status: 'Posted', amount: 1030, date: new Date('2026-08-10').toISOString(),
      narration: 'Payment of job-work charges',
      againstInvoices: [{ invoiceId: jobId, invoiceNo: 'n/a', amount: 1030, discount: 20 }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const voucher = unwrap(res);

    const notes = await DebitCreditNote.find({ companyId, sourceVoucherId: voucher._id, autoGenerated: true });
    assert.equal(notes.length, 1, 'job-work charges discount also auto-raises a note (kind=job branch)');
    const note = notes[0];
    assert.equal(note.noteType, 'Debit');
    assert.equal(note.noteSide, 'Purchase');
    assert.equal(Number(note.amount), 20);
    // processGstAmount(50) / processCharges(1000) * 100 = 5% — same effective rate.
    assert.equal(Number(note.gstRate), 5);

    const jobAfter = await Job.findById(jobId);
    assert.equal(Number(jobAfter.chargesPaidAmount), 1050, '1030 cash + 20 discount = full 1050 charges bill');
  });

  it('STEP 9 — Outstanding: all three bills fully settled, zero balance', async () => {
    const sale = await Sales.findById(saleId);
    const purchase = await Purchase.findById(purchaseId);
    const job = await Job.findById(jobId);
    assert.equal(Number(sale.netAmount) - Number(sale.paidAmount), 0, 'sale outstanding');
    assert.equal(Number(purchase.netAmount) - Number(purchase.paidAmount), 0, 'purchase outstanding');
    assert.equal((Number(job.processCharges) + Number(job.processGstAmount)) - Number(job.chargesPaidAmount), 0, 'job charges outstanding');
  });

  it('STEP 10 — Party ledgers reconcile to zero balance', async () => {
    const allEntries = await AccountingEntry.find({ companyId });

    const cust = ledgerTotals(allEntries, customerLedgerId);
    assert.ok(Math.abs(cust.dr - cust.cr) < 0.01, `customer ledger must net to 0: Dr=${cust.dr} Cr=${cust.cr}`);
    assert.ok(Math.abs(cust.cr - 12600) < 0.01, `customer Cr should be 12600 (the sale), got ${cust.cr}`);

    const supp = ledgerTotals(allEntries, supplierLedgerId);
    assert.ok(Math.abs(supp.dr - supp.cr) < 0.01, `supplier ledger must net to 0: Dr=${supp.dr} Cr=${supp.cr}`);
    assert.ok(Math.abs(supp.cr - 10500) < 0.01, `supplier Cr should be 10500 (the purchase), got ${supp.cr}`);

    const worker = ledgerTotals(allEntries, workerLedgerId);
    assert.ok(Math.abs(worker.dr - worker.cr) < 0.01, `job worker ledger must net to 0: Dr=${worker.dr} Cr=${worker.cr}`);
    assert.ok(Math.abs(worker.cr - 1050) < 0.01, `worker Cr should be 1050 (job charges), got ${worker.cr}`);
  });

  it('STEP 11 — Trial Balance: grand total Dr = grand total Cr across the ENTIRE company', async () => {
    const entries = await AccountingEntry.find({ companyId });
    assert.ok(entries.length > 0);
    let Dr = 0, Cr = 0;
    for (const e of entries) for (const l of e.lines) {
      if (l.type === 'Dr') Dr += Number(l.amount); else Cr += Number(l.amount);
    }
    assert.ok(Math.abs(Dr - Cr) < 0.01, `Trial balance imbalance: Dr=${Dr.toFixed(2)} Cr=${Cr.toFixed(2)}`);
  });

  it('STEP 12 — Auto notes are excluded from double-counting and neither note independently posted a journal', async () => {
    for (const noteId of [creditNoteId, debitNoteId]) {
      const ownEntries = await AccountingEntry.find({ companyId, refId: noteId });
      assert.equal(ownEntries.length, 0, `note ${noteId} must not own an independent journal entry`);
    }
  });

  it('STEP 13 — Manual edit/reverse of either auto note is still safely rejected end-to-end', async () => {
    const editCredit = await request(app).put(`/api/notes/${creditNoteId}`).set(auth(tok)).send({ amount: 1 });
    assert.equal(editCredit.status, 400);
    assert.match(editCredit.body.message, /automatically generated/i);

    const editDebit = await request(app).put(`/api/notes/${debitNoteId}`).set(auth(tok)).send({ amount: 1 });
    assert.equal(editDebit.status, 400);
    assert.match(editDebit.body.message, /automatically generated/i);
  });
});
