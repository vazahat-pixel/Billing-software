/**
 * Mill goods-with-mill posting: new challans go Dr/Cr the mill party; challans whose issue was posted the
 * old way (Job Work In Progress) close against Job Work In Progress, so no ledger keeps a one-sided amount.
 * In-memory MongoDB only.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

describe('Mill receive closes against the ledger its issue used (isolated DB)', () => {
  let app; let request; let shutdown; let h; let companyId; let millId; let lotId;
  let AccountingEntry; let accountingService;

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Ledger Owner', email: `mlg-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Ledger Co',
    });
    h = authHeader(reg.body.token);
    const me = unwrapBody(await request(app).get('/api/auth/me').set(h));
    companyId = me.companyId || me.user?.companyId;
    AccountingEntry = require('../../models/AccountingEntry');
    accountingService = require('../../services/accountingService');
    await accountingService.seedSystemLedgers(companyId);
    const supplierId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Weaver A', type: 'Supplier' }))._id;
    millId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Process Mill', type: 'Job Worker' }))._id;
    const itemId = unwrapBody(await request(app).post('/api/items').set(h).send({ name: 'Grey 60', category: 'Grey', gstRate: 5, unit: 'MTRS' }))._id;
    const pur = await request(app).post('/api/purchases').set(h).send({
      supplierId, invoiceNo: 'AUTO', date: new Date().toISOString(), gstType: 'CGST+SGST',
      items: [{ itemId, mts: 200, pcs: 2, rate: 50, amount: 10000 }], taxableAmount: 10000,
    });
    assert.equal(pur.status, 201, JSON.stringify(pur.body));
    lotId = unwrapBody(await request(app).get(`/api/inventory/lots?itemId=${itemId}`).set(h))[0]._id;
  });
  after(async () => { if (shutdown) await shutdown(); });

  const issue = async (no) => {
    const res = await request(app).post('/api/jobs/issue').set(h).send({
      jobCardNo: no, challanNo: no, issueDate: new Date().toISOString(), lotId, workerId: millId,
      processType: 'Process Charge', issueQty: 100, issuePcs: 1, jobRate: 8,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return unwrapBody(res)._id;
  };
  const receive = async (jobId) => {
    const res = await request(app).post('/api/jobs/receive').set(h).send({
      jobId, receivedQty: 100, receivedPcs: 1, charges: 0, gstAmount: 0, isFinal: true,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  };
  const totals = (entries, ledgerId) => {
    let dr = 0; let cr = 0;
    for (const e of entries) for (const l of e.lines) {
      if (String(l.ledgerId) !== String(ledgerId)) continue;
      if (l.type === 'Dr') dr += Number(l.amount); else cr += Number(l.amount);
    }
    return { dr: Math.round(dr * 100) / 100, cr: Math.round(cr * 100) / 100 };
  };

  it('new challan: issue and receive both on the mill party, which nets to zero', async () => {
    const jobId = await issue('801');
    const mill = await accountingService.getOrCreatePartyLedger(companyId, millId);
    const iss = await AccountingEntry.findOne({ companyId, refType: 'JobIssue', refId: jobId }).lean();
    assert.equal(String(iss.lines.find((l) => l.type === 'Dr').ledgerId), String(mill._id));
    await receive(jobId);
    const rec = await AccountingEntry.findOne({ companyId, refType: 'JobReceive', refId: jobId }).lean();
    assert.equal(String(rec.lines.find((l) => l.type === 'Cr').ledgerId), String(mill._id));
    // goods with the mill (issue + receive) net to zero on the party; job charges are a separate entry
    const goods = await AccountingEntry.find({ companyId, refId: jobId, refType: { $in: ['JobIssue', 'JobReceive'] } }).lean();
    assert.deepEqual(totals(goods, mill._id), { dr: 5000, cr: 5000 });
  });

  it('challan issued the old way (Job Work In Progress) closes on Job Work In Progress, not on the party', async () => {
    const jobId = await issue('802');
    const mill = await accountingService.getOrCreatePartyLedger(companyId, millId);
    const jwip = await accountingService.getSystemLedger(companyId, 'Job Work In Progress');
    // what the issue posting looked like before the change (raw update: posted journals are locked)
    await AccountingEntry.collection.updateOne(
      { refType: 'JobIssue', refId: new (require('mongoose').Types.ObjectId)(String(jobId)) },
      { $set: { 'lines.$[d].ledgerId': jwip._id, 'lines.$[d].ledgerName': jwip.name } },
      { arrayFilters: [{ 'd.type': 'Dr' }] },
    );

    await receive(jobId);
    const rec = await AccountingEntry.findOne({ companyId, refType: 'JobReceive', refId: jobId }).lean();
    assert.equal(String(rec.lines.find((l) => l.type === 'Cr').ledgerId), String(jwip._id));
    const goods = await AccountingEntry.find({ companyId, refId: jobId, refType: { $in: ['JobIssue', 'JobReceive'] } }).lean();
    assert.deepEqual(totals(goods, jwip._id), { dr: 5000, cr: 5000 });
    assert.deepEqual(totals(goods, mill._id), { dr: 0, cr: 0 });
  });
});
