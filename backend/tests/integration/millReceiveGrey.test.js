/**
 * Mill Receive balance in GREY returned, as in JSM — in-memory MongoDB only.
 *   1000 grey sent, 1000 grey back, 950 finish -> challan complete, no wastage, 950 in stock.
 * Receives that send no grey keep the previous behaviour exactly (grey = finish).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

describe('Mill Receive grey balance (isolated DB)', () => {
  let app; let request; let shutdown; let h; let millId; let lotId; let Job; let InventoryLot;
  let challan = 700;

  const issue = async (qty, pcs = 10) => {
    challan += 1;
    const res = await request(app).post('/api/jobs/issue').set(h).send({
      jobCardNo: String(challan), challanNo: String(challan), issueDate: new Date().toISOString(), lotId,
      workerId: millId, processType: 'Process Charge', issueQty: qty, issuePcs: pcs, purchaseRate: 50, jobRate: 10,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return unwrapBody(res)._id;
  };
  const receive = (body) => request(app).post('/api/jobs/receive').set(h).send({ billGpNo: `B${challan}`, workerId: millId, ...body });
  const job = async (id) => (await Job.findById(id)).toJSON(); // toJSON includes the pending virtuals

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Grey Owner', email: `grey-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Grey Co',
    });
    h = authHeader(reg.body.token);
    const supplierId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Weaver G', type: 'Supplier' }))._id;
    millId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Dye Mill', type: 'Job Worker' }))._id;
    const itemId = unwrapBody(await request(app).post('/api/items').set(h).send({ name: 'Grey 92', category: 'Grey', gstRate: 5, unit: 'MTRS' }))._id;
    const pur = await request(app).post('/api/purchases').set(h).send({
      supplierId, invoiceNo: 'AUTO', date: new Date().toISOString(), gstType: 'CGST+SGST',
      items: [{ itemId, mts: 10000, pcs: 100, rate: 50, amount: 500000 }], taxableAmount: 500000, netAmount: 525000,
    });
    assert.equal(pur.status, 201, JSON.stringify(pur.body));
    lotId = unwrapBody(await request(app).get(`/api/inventory/lots?itemId=${itemId}`).set(h))[0]._id;
    Job = require('../../models/Job');
    InventoryLot = require('../../models/InventoryLot');
  });
  after(async () => { if (shutdown) await shutdown(); });

  it('JSM case: 1000 grey back, 950 finish -> complete, no wastage, 950 finished stock', async () => {
    const id = await issue(1000);
    const res = await receive({ jobId: id, receivedGreyQty: 1000, receivedGreyPcs: 10, receivedQty: 950, receivedPcs: 10, charges: 9500, isFinal: true, jobUnit: 'Q', receivedFinalQty: 940, receivedKgs: 200, receivedGreyKgs: 210, receiveDesc1: 'D1' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const j = await job(id);
    assert.equal(j.status, 'Received');
    assert.equal(j.wastage, 0);
    assert.equal(j.receivedQty, 950);
    assert.equal(j.receivedGreyQty, 1000);
    assert.equal(j.pendingQty, 0);
    assert.equal(j.receivedFinalQty, 940);
    assert.equal(j.receivedKgs, 200);
    assert.equal(j.receivedGreyKgs, 210);
    assert.equal(j.jobUnit, 'Q');
    assert.equal(j.receiveDesc1, 'D1');
    const fin = await InventoryLot.findById(j.finishedLotId).lean();
    assert.equal(fin.totalMtrs, 950);
    // Finished cost = grey consumed (1000 x 50) + charges 9500, over 950 finished metres.
    assert.equal(Number(fin.rate.toFixed(2)), Number(((1000 * 50 + 9500) / 950).toFixed(2)));
  });

  it('partial receipts: balance follows grey (600 then 400)', async () => {
    const id = await issue(1000);
    let res = await receive({ jobId: id, receivedGreyQty: 600, receivedGreyPcs: 6, receivedQty: 570, receivedPcs: 6, charges: 5700, isFinal: false });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    let j = await job(id);
    assert.equal(j.status, 'Partial');
    assert.equal(j.pendingQty, 400);
    assert.equal(j.pendingPcs, 4);
    res = await receive({ jobId: id, receivedGreyQty: 400, receivedGreyPcs: 4, receivedQty: 380, receivedPcs: 4, charges: 3800, isFinal: true });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    j = await job(id);
    assert.equal(j.status, 'Received');
    assert.equal(j.receivedGreyQty, 1000);
    assert.equal(j.receivedQty, 950);
    assert.equal(j.wastage, 0);
  });

  it('grey above the balance is refused', async () => {
    const id = await issue(100);
    const res = await receive({ jobId: id, receivedGreyQty: 120, receivedQty: 110 });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /grey quantity \(120\) cannot exceed the pending balance \(100\)/);
  });

  it('a receive without grey behaves exactly as before (grey = finish, gap is wastage)', async () => {
    const id = await issue(1000);
    const res = await receive({ jobId: id, receivedQty: 950, receivedPcs: 10, charges: 9500, isFinal: true });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const j = await job(id);
    assert.equal(j.wastage, 50);
    assert.equal(j.receivedGreyQty, 950);
    assert.equal(j.pendingQty, 50);
  });

  it('editing a receipt keeps the grey balance', async () => {
    const id = await issue(1000);
    await receive({ jobId: id, receivedGreyQty: 1000, receivedQty: 950, receivedPcs: 10, charges: 9500, isFinal: true });
    const res = await request(app).put('/api/jobs/receive').set(h).send({
      jobId: id, receivedGreyQty: 1000, receivedGreyPcs: 10, receivedQty: 940, receivedPcs: 10, charges: 9400, isFinal: true, jobUnit: 'F', receivedFinalQty: 930,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const j = await job(id);
    assert.equal(j.receivedQty, 940);
    assert.equal(j.receivedGreyQty, 1000);
    assert.equal(j.wastage, 0);
    assert.equal(j.jobUnit, 'F');
    assert.equal(j.receivedFinalQty, 930);
  });
});
