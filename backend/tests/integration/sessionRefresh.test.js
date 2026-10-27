/**
 * Session renewal used by the app after the 8-hour access token expires — in-memory MongoDB only.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader } = require('../helpers/setup');

describe('Session refresh (isolated DB)', () => {
  let app; let request; let shutdown;
  const email = `refresh-${Date.now()}@example.com`;
  const password = 'TestPass123!';

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({ name: 'Refresh Owner', email, password, companyName: 'Refresh Co' });
    assert.equal(reg.status, 201);
  });
  after(async () => { if (shutdown) await shutdown(); });

  let login;
  it('login returns a refresh token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    login = res.body.data && res.body.data.token ? res.body.data : res.body;
    assert.ok(login.token);
    assert.ok(login.refreshToken, 'refreshToken missing from login reply');
  });

  let renewed;
  it('refresh gives a new access token that works, same company', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: login.refreshToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    renewed = res.body;
    assert.ok(renewed.token);
    assert.ok(renewed.refreshToken);
    const me = await request(app).get('/api/auth/me').set(authHeader(renewed.token));
    assert.equal(me.status, 200);
    const payload = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
    assert.equal(String(payload(renewed.token).companyId), String(payload(login.token).companyId));
  });

  it('a used refresh token cannot be used again (rotation)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: login.refreshToken });
    assert.equal(res.status, 401);
    const ok = await request(app).post('/api/auth/refresh').send({ refreshToken: renewed.refreshToken });
    assert.equal(ok.status, 200);
  });

  it('garbage refresh token → 401 (app then asks for login)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'nope' });
    assert.equal(res.status, 401);
  });
});
