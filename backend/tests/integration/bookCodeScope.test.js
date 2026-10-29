/**
 * Book Id (code) is checked within the company, not across companies. In-memory MongoDB only.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader } = require('../helpers/setup');

describe('Book code uniqueness is per company (isolated DB)', () => {
  let app; let request; let shutdown; let a; let b;

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = async (n) => authHeader((await request(app).post('/api/auth/register').send({
      name: `Owner ${n}`, email: `book-${n}-${Date.now()}@example.com`, password: 'TestPass123!', companyName: `Book Co ${n}`,
    })).body.token);
    a = await reg('a');
    b = await reg('b');
    // load the default books once, as the screen does
    await request(app).get('/api/books?module=sales').set(a);
  });
  after(async () => { if (shutdown) await shutdown(); });

  const create = (h, module, code, name) => request(app).post('/api/books').set(h).send({ name, code, module });

  it('another company may use the same code', async () => {
    assert.equal((await create(a, 'sales', '150', 'A SALES 150')).status, 201);
    const res = await create(b, 'sales', '150', 'B SALES 150');
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  it('the same company cannot reuse a code, in any module', async () => {
    const res = await create(a, 'purchase', '150', 'A PURCHASE 150');
    assert.equal(res.status, 400);
    assert.match(res.body.message, /already in use/);
  });

  it("a system book's code in that module is still refused", async () => {
    const res = await create(b, 'sales', '101', 'B SALES 101');
    assert.equal(res.status, 400);
  });
});
