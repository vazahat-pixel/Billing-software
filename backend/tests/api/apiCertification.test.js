const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader } = require('../helpers/setup');
const routes = require('../api/routeManifest');

/**
 * API certification — in-memory Mongo only (never Atlas via .env).
 */
describe('API certification — authenticated GET coverage', () => {
  let app;
  let request;
  let shutdown;
  let token;

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const email = `api-cert-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'API Cert',
        email,
        password: 'ApiCert123!',
        companyName: 'API Cert Co',
      });
    assert.ok([200, 201].includes(res.status));
    token = res.body.token;
  });

  after(async () => {
    if (shutdown) await shutdown();
  });

  it('manifest has ≥ 35 routes and required groups', () => {
    assert.ok(routes.length >= 35);
    const groups = new Set(routes.map((r) => r.group));
    for (const g of ['sales', 'purchases', 'inventory', 'accounting', 'gst', 'stage8']) {
      assert.ok(groups.has(g), `missing group ${g}`);
    }
  });

  it('health endpoint', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
  });

  const getRoutes = routes.filter((r) => r.method === 'GET' && r.auth && !r.path.includes(':'));
  for (const route of getRoutes.slice(0, 25)) {
    it(`${route.method} ${route.path} responds (not 500)`, async () => {
      const url = `${route.path}${route.query || ''}`;
      const res = await request(app).get(url).set(authHeader(token));
      assert.notEqual(res.status, 500, `${url} returned 500: ${JSON.stringify(res.body).slice(0, 200)}`);
      assert.ok(res.status < 600);
    });
  }
});
