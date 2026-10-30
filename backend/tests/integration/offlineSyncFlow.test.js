/**
 * The offline sync scenario end to end through the real app (auth, controllers, services, stock),
 * on an in-memory MongoDB only. Matches the real case: purchases 5 and 6 are made on the website
 * while a desktop is offline and also makes "6"; when the desktop syncs, its 6 becomes 7, and a
 * repeated send (reply lost) never saves twice or doubles stock.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

describe('Offline sync flow (isolated DB)', () => {
  let app; let request; let shutdown; let token; let supplierId; let customerId; let itemId;

  const purchase = (invoiceNo, mts = 100) => ({
    supplierId, invoiceNo, date: new Date().toISOString(), gstType: 'CGST+SGST',
    items: [{ itemId, mts, pcs: 0, rate: 70, amount: mts * 70 }],
    taxableAmount: mts * 70, netAmount: mts * 70 * 1.05,
  });
  const offline = (key) => ({ ...authHeader(token), 'Idempotency-Key': key, 'X-Offline-Sync': '1' });
  const stockMtrs = async () => Number(unwrapBody(
    await request(app).get(`/api/inventory/stock/${itemId}`).set(authHeader(token))
  ).totalMtrs || 0);
  const settle = () => new Promise((r) => setTimeout(r, 80));

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Sync Owner', email: `sync-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Sync Textile',
    });
    token = reg.body.token;
    supplierId = unwrapBody(await request(app).post('/api/parties').set(authHeader(token))
      .send({ name: 'Sync Supplier', type: 'Supplier', gstin: '24AAAAA0000A1Z5' }))._id;
    customerId = unwrapBody(await request(app).post('/api/parties').set(authHeader(token))
      .send({ name: 'Sync Customer', type: 'Customer', gstin: '24BBBBB0000B1Z5' }))._id;
    itemId = unwrapBody(await request(app).post('/api/items').set(authHeader(token))
      .send({ name: 'Sync Grey', category: 'Grey', gstRate: 5, unit: 'MTRS' }))._id;
  });

  after(async () => { if (shutdown) await shutdown(); });

  it('website makes purchases 5 and 6', async () => {
    for (const no of ['5', '6']) {
      const res = await request(app).post('/api/purchases').set(authHeader(token)).send(purchase(no));
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(String(unwrapBody(res).invoiceNo), no);
    }
    assert.equal(await stockMtrs(), 200);
  });

  it('a normal (online) save of 6 is still refused — nothing changed for online users', async () => {
    const res = await request(app).post('/api/purchases').set(authHeader(token)).send(purchase('6'));
    assert.ok(res.status >= 400, `expected refusal, got ${res.status}`);
    assert.equal(await stockMtrs(), 200);
  });

  let offlineId;
  it('desktop syncs its offline 6 → saved as 7, stock counted once', async () => {
    const res = await request(app).post('/api/purchases').set(offline('dev-op-6')).send({ ...purchase('6'), operationId: 'dev-op-6' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const saved = unwrapBody(res);
    offlineId = String(saved._id);
    assert.equal(String(saved.invoiceNo), '7');
    assert.equal(res.headers['x-renumbered-from'], '6');
    assert.equal(await stockMtrs(), 300);
  });

  it('same offline entry sent again (reply was lost) → same bill, no second save, stock unchanged', async () => {
    await settle();
    const res = await request(app).post('/api/purchases').set(offline('dev-op-6')).send({ ...purchase('6'), operationId: 'dev-op-6' });
    assert.equal(res.status, 201);
    assert.equal(String(unwrapBody(res)._id), offlineId);
    assert.equal(await stockMtrs(), 300);
    const list = unwrapBody(await request(app).get('/api/purchases?limit=50').set(authHeader(token)));
    const bills = (list.purchases || list.items || list).map((p) => String(p.invoiceNo)).sort();
    assert.deepEqual(bills, ['5', '6', '7']);
  });

  it('offline placeholder number takes the next real number (8)', async () => {
    const res = await request(app).post('/api/purchases').set(offline('dev-op-x')).send(purchase('OFF-PUR-1761300000000', 10));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(String(unwrapBody(res).invoiceNo), '8');
    assert.equal(await stockMtrs(), 310);
  });

  it('sales: cloud has 1, offline 1 syncs as 2', async () => {
    const lots = unwrapBody(await request(app).get(`/api/inventory/lots?itemId=${itemId}`).set(authHeader(token)));
    const lotId = lots[0]._id;
    const sale = (invoiceNo) => ({
      customerId, invoiceNo, date: new Date().toISOString(), gstType: 'CGST+SGST',
      items: [{ itemId, lotId, mts: 5, pcs: 0, rate: 85, amount: 425 }], taxableAmount: 425, netAmount: 446.25,
    });
    const cloud = await request(app).post('/api/sales').set(authHeader(token)).send(sale('1'));
    assert.equal(cloud.status, 201, JSON.stringify(cloud.body));
    const off = await request(app).post('/api/sales').set(offline('dev-sale-1')).send({ ...sale('1'), operationId: 'dev-sale-1' });
    assert.equal(off.status, 201, JSON.stringify(off.body));
    assert.equal(String(unwrapBody(off).invoiceNo), '2');
    await settle();
    const again = await request(app).post('/api/sales').set(offline('dev-sale-1')).send({ ...sale('1'), operationId: 'dev-sale-1' });
    assert.equal(String(unwrapBody(again)._id), String(unwrapBody(off)._id));
    assert.equal(await stockMtrs(), 300); // 310 - 5 - 5, the repeat deducted nothing
  });
});
