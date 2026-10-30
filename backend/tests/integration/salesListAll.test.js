/**
 * The sales list returns every bill when no page size is asked for (the sales screen, its Find list,
 * receipts' bill list and the LR list read it); an explicit page size still pages.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

describe('sales list: all bills unless a page size is given (isolated DB)', () => {
  let app; let request; let shutdown; let h;

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({ name: 'List Owner', email: `list-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'List Co' });
    h = authHeader(reg.body.token);
    // the company the signed-in user works in, read from a record it creates
    const probe = unwrapBody(await request(app).post('/api/migration/runs').set(h).send({})).id;
    const { companyId } = await require('../../models/MigrationRun').MigrationRun.findById(probe).lean();
    const Sales = require('../../models/Sales');
    const at = new Date('2026-05-01');
    await Sales.collection.insertMany(Array.from({ length: 120 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(), companyId, invoiceNo: String(i + 1), date: new Date(at.getTime() + i * 86400000),
      items: [], netAmount: 100 + i, status: 'active', isDeleted: false, createdAt: at, updatedAt: at,
    })));
  });
  after(async () => { if (shutdown) await shutdown(); });

  it('no page size: all 120 bills', async () => {
    const res = await request(app).get('/api/sales').set(h);
    assert.equal(res.status, 200);
    assert.equal(unwrapBody(res).length, 120);
  });

  it('explicit page size still pages', async () => {
    const res = await request(app).get('/api/sales?page=2&limit=50').set(h);
    assert.equal(unwrapBody(res).length, 50);
    const last = await request(app).get('/api/sales?page=3&limit=50').set(h);
    assert.equal(unwrapBody(last).length, 20);
  });
});
