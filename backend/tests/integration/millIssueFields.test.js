/**
 * Mill Issue keeps the JSM header fields (broker, kgs, master, transport, LR, marka, HSN) —
 * in-memory MongoDB only. Before, transport / LR / marka / HSN were sent but dropped on save.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

describe('Mill Issue fields (isolated DB)', () => {
  let app; let request; let shutdown; let token; let millId; let lotId;

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Mill Owner', email: `mill-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Mill Co',
    });
    token = reg.body.token;
    const h = authHeader(token);
    const supplierId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Weaver A', type: 'Supplier' }))._id;
    millId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Process Mill', type: 'Job Worker' }))._id;
    const itemId = unwrapBody(await request(app).post('/api/items').set(h).send({ name: 'Grey 60', category: 'Grey', gstRate: 5, unit: 'MTRS' }))._id;
    const pur = await request(app).post('/api/purchases').set(h).send({
      supplierId, invoiceNo: 'AUTO', date: new Date().toISOString(), gstType: 'CGST+SGST',
      items: [{ itemId, mts: 500, pcs: 5, rate: 50, amount: 25000 }], taxableAmount: 25000, netAmount: 26250,
    });
    assert.equal(pur.status, 201, JSON.stringify(pur.body));
    lotId = unwrapBody(await request(app).get(`/api/inventory/lots?itemId=${itemId}`).set(h))[0]._id;
  });
  after(async () => { if (shutdown) await shutdown(); });

  it('saves and returns the header fields', async () => {
    const res = await request(app).post('/api/jobs/issue').set(authHeader(token)).send({
      jobCardNo: '501', challanNo: '501', issueDate: new Date().toISOString(), lotId, workerId: millId,
      processType: 'Process Charge', issueQty: 100, issuePcs: 1, weaver: 'Weaver A', purchaseBillNo: '1',
      purchaseRate: 50, jobRate: 8,
      broker: 'RAMESH BROKER', issueKgs: 42.5, masterName: 'SURESH', transport: 'VRL', lrNo: 'LR-9', markaNo: 'M-7', hsnCode: '5407',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const job = unwrapBody(res);
    const Job = require('../../models/Job');
    const saved = await Job.findById(job._id).lean();
    assert.equal(saved.broker, 'RAMESH BROKER');
    assert.equal(saved.issueKgs, 42.5);
    assert.equal(saved.masterName, 'SURESH');
    assert.equal(saved.transport, 'VRL');
    assert.equal(saved.lrNo, 'LR-9');
    assert.equal(saved.markaNo, 'M-7');
    assert.equal(saved.hsnCode, '5407');
    assert.equal(saved.issueQty, 100); // quantities unchanged
  });
});
