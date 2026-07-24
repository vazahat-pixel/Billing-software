const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-characters-long';
if (!process.env.MONGO_URI) {
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/billing_test_flow';
}

const mongoose = require('mongoose');
const request = require('supertest');

const { waitForMongo, authHeader, unwrapBody } = require('../helpers/setup');
const app = require('../../server');

describe('ERP core billing flow', () => {
  let token;
  let supplierId;
  let customerId;
  let itemId;
  let lotOid;
  let purchaseId;
  let saleId;

  before(async () => {
    await waitForMongo();
    await mongoose.connection.db.dropDatabase();
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('health check', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.mongo, 'up');
  });

  it('registers company owner', async () => {
    const email = `test-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test Owner',
        email,
        password: 'TestPass123!',
        companyName: 'CI Textile Co',
      });
    assert.equal(res.status, 201);
    token = res.body.token;
    assert.ok(token);
  });

  it('creates supplier and customer', async () => {
    const sup = await request(app)
      .post('/api/parties')
      .set(authHeader(token))
      .send({ name: 'Test Supplier', type: 'Supplier', gstin: '24AAAAA0000A1Z5' });
    assert.equal(sup.status, 201);
    supplierId = unwrapBody(sup)._id;

    const cust = await request(app)
      .post('/api/parties')
      .set(authHeader(token))
      .send({ name: 'Test Customer', type: 'Customer', gstin: '24BBBBB0000B1Z5' });
    assert.equal(cust.status, 201);
    customerId = unwrapBody(cust)._id;
  });

  it('creates item master', async () => {
    const res = await request(app)
      .post('/api/items')
      .set(authHeader(token))
      .send({ name: 'Grey Cotton Test', category: 'Grey', gstRate: 5, unit: 'MTRS' });
    assert.equal(res.status, 201);
    itemId = unwrapBody(res)._id;
  });

  it('creates purchase and increases stock', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set(authHeader(token))
      .send({
        supplierId,
        invoiceNo: 'AUTO',
        date: new Date().toISOString(),
        gstType: 'CGST+SGST',
        items: [{ itemId, mts: 100, pcs: 0, rate: 70, amount: 7000 }],
        taxableAmount: 7000,
        netAmount: 7350,
      });
    assert.equal(res.status, 201);
    const purchase = unwrapBody(res);
    purchaseId = purchase._id;

    const stock = await request(app)
      .get(`/api/inventory/stock/${itemId}`)
      .set(authHeader(token));
    assert.equal(stock.status, 200);
    const stockData = unwrapBody(stock);
    assert.ok(Number(unwrapBody(stock).totalMtrs || 0) >= 99);

    const lots = await request(app)
      .get(`/api/inventory/lots?itemId=${itemId}`)
      .set(authHeader(token));
    assert.equal(lots.status, 200);
    const lotList = unwrapBody(lots);
    assert.ok(Array.isArray(lotList) && lotList.length > 0);
    lotOid = lotList[0]._id;
  });

  it('creates sales invoice and deducts stock', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(authHeader(token))
      .send({
        customerId,
        invoiceNo: 'AUTO',
        date: new Date().toISOString(),
        gstType: 'CGST+SGST',
        items: [{ itemId, lotId: lotOid, mts: 40, pcs: 0, rate: 85, amount: 3400 }],
        taxableAmount: 3400,
        netAmount: 3570,
      });
    assert.equal(res.status, 201);
    saleId = unwrapBody(res)._id;

    const stock = await request(app)
      .get(`/api/inventory/stock/${itemId}`)
      .set(authHeader(token));
    const remaining = Number(unwrapBody(stock).totalMtrs || 0);
    assert.ok(remaining >= 59 && remaining <= 61);
  });

  it('cancels sale and restores stock', async () => {
    const del = await request(app)
      .delete(`/api/sales/${saleId}`)
      .set(authHeader(token));
    assert.ok([200, 204].includes(del.status));

    const stock = await request(app)
      .get(`/api/inventory/stock/${itemId}`)
      .set(authHeader(token));
    const remaining = Number(unwrapBody(stock).totalMtrs || 0);
    assert.ok(remaining >= 99);
  });

  it('cancels purchase and removes stock when unused', async () => {
    const del = await request(app)
      .delete(`/api/purchases/${purchaseId}`)
      .set(authHeader(token));
    assert.ok([200, 204].includes(del.status));

    const stock = await request(app)
      .get(`/api/inventory/stock/${itemId}`)
      .set(authHeader(token));
    const remaining = Number(unwrapBody(stock).totalMtrs || 0);
    assert.ok(remaining <= 1);
  });
});