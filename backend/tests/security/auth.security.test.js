const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

/**
 * Security certification — MUST use in-memory Mongo (never Atlas via .env).
 */
describe('Security certification — auth & injection guards', () => {
  let app;
  let request;
  let mongoose;
  let shutdown;
  let token;

  before(async () => {
    ({ app, request, mongoose, shutdown } = await bootIsolatedApp());
  });

  after(async () => {
    if (shutdown) await shutdown();
  });

  it('rejects protected routes without JWT', async () => {
    const res = await request(app).get('/api/parties');
    assert.ok([401, 403].includes(res.status));
  });

  it('rejects invalid JWT', async () => {
    const res = await request(app)
      .get('/api/parties')
      .set({ Authorization: 'Bearer not-a-real-token' });
    assert.ok([401, 403].includes(res.status));
  });

  it('registers and authenticates', async () => {
    const email = `sec-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sec Tester',
        email,
        password: 'SecPass123!',
        companyName: 'Sec Co',
      });
    assert.ok([200, 201].includes(res.status));
    token = res.body.token;
    assert.ok(token);
  });

  it('blocks NoSQL operator injection in login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } });
    assert.ok(res.status >= 400);
    assert.notEqual(res.status, 200);
  });

  it('does not reflect XSS payload as HTML script in JSON error', async () => {
    const payload = '<script>alert(1)</script>';
    const res = await request(app)
      .post('/api/parties')
      .set(authHeader(token))
      .send({ name: payload, type: 'Customer' });
    assert.ok(res.headers['content-type']?.includes('json'));
    const body = JSON.stringify(res.body);
    assert.ok(!body.includes('<html'));
  });

  it('company isolation strips spoofed companyId on create', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/parties')
      .set(authHeader(token))
      .send({ name: 'Isolation Party', type: 'Customer', companyId: fakeId });
    assert.ok([200, 201].includes(res.status));
    const data = unwrapBody(res);
    assert.ok(data._id || data.id);
    if (data.companyId) {
      assert.notEqual(String(data.companyId), fakeId);
    }
  });
});
