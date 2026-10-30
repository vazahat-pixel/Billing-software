/**
 * Duplicate Entries utility — read-only scan for entries saved twice. In-memory MongoDB only.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

describe('Duplicate entries scan (isolated DB)', () => {
  let app; let request; let shutdown; let h; let customerId; let supplierId; let millId; let itemId; let lotId;
  const today = new Date().toISOString();

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Dup Owner', email: `dup-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Dup Co',
    });
    h = authHeader(reg.body.token);
    supplierId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Weaver A', type: 'Supplier' }))._id;
    customerId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Buyer B', type: 'Customer' }))._id;
    millId = unwrapBody(await request(app).post('/api/parties').set(h).send({ name: 'Process Mill', type: 'Job Worker' }))._id;
    itemId = unwrapBody(await request(app).post('/api/items').set(h).send({ name: 'Grey 60', category: 'Grey', gstRate: 5, unit: 'MTRS' }))._id;
  });
  after(async () => { if (shutdown) await shutdown(); });

  const purchase = (billNo, mts) => request(app).post('/api/purchases').set(h).send({
    supplierId, invoiceNo: 'AUTO', supplierInvoiceNo: billNo, date: today, gstType: 'CGST+SGST',
    items: [{ itemId, mts, pcs: 5, rate: 50, amount: mts * 50 }], taxableAmount: mts * 50,
  });
  const sale = (mts) => request(app).post('/api/sales').set(h).send({
    customerId, invoiceNo: 'AUTO', date: today, gstType: 'CGST+SGST',
    items: [{ itemId, mts, pcs: 1, rate: 70, amount: mts * 70 }], taxableAmount: mts * 70,
  });

  it('clean data: nothing reported', async () => {
    assert.equal((await purchase('S-1', 1000)).status, 201);
    assert.equal((await purchase('S-2', 400)).status, 201); // different bill, different amount
    assert.equal((await sale(100)).status, 201);
    assert.equal((await sale(120)).status, 201);
    const r = unwrapBody(await request(app).get('/api/utilities/duplicate-entries').set(h));
    assert.equal(r.totalGroups, 0, JSON.stringify(r.groups));
  });

  it('finds a sale and a mill issue saved twice, and touches nothing', async () => {
    const s1 = await sale(100); // same party, day and amount as the first sale
    assert.equal(s1.status, 201, JSON.stringify(s1.body));
    lotId = unwrapBody(await request(app).get(`/api/inventory/lots?itemId=${itemId}`).set(h))[0]._id;
    const issue = (no) => request(app).post('/api/jobs/issue').set(h).send({
      jobCardNo: no, challanNo: no, issueDate: today, lotId, workerId: millId,
      processType: 'Process Charge', issueQty: 50, issuePcs: 1, jobRate: 8,
    });
    assert.equal((await issue('701')).status, 201);
    assert.equal((await issue('702')).status, 201);

    const Sales = require('../../models/Sales');
    const before = await Sales.countDocuments({});
    const r = unwrapBody(await request(app).get('/api/utilities/duplicate-entries').set(h));
    const kinds = r.groups.map((g) => g.kind).sort();
    assert.deepEqual(kinds, ['Mill Issue', 'Sales'], JSON.stringify(r.groups));
    const sg = r.groups.find((g) => g.kind === 'Sales');
    assert.equal(sg.count, 2);
    assert.equal(sg.party, 'Buyer B');
    assert.equal(sg.amount, 7350); // 7000 + 5% GST
    assert.equal(sg.likelyDoubleSave, true);
    const jg = r.groups.find((g) => g.kind === 'Mill Issue');
    assert.deepEqual(jg.entries.map((e) => e.no).sort(), ['701', '702']);
    assert.equal(await Sales.countDocuments({}), before); // read-only
  });

  it('same supplier bill no entered twice is reported even with a different amount', async () => {
    assert.equal((await purchase('S-1', 999)).status, 201);
    const r = unwrapBody(await request(app).get('/api/utilities/duplicate-entries').set(h));
    const pg = r.groups.filter((g) => g.kind === 'Purchase');
    assert.equal(pg.length, 1, JSON.stringify(pg));
    assert.equal(pg[0].reason, 'same party bill no');
    assert.deepEqual(pg[0].entries.map((e) => e.supplierBillNo), ['S-1', 'S-1']);
  });
});
