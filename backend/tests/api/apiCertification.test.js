const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-characters-long';
if (!process.env.MONGO_URI) {
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/billing_test_api_cert';
}

const mongoose = require('mongoose');
const request = require('supertest');
const { waitForMongo, authHeader } = require('../helpers/setup');
const app = require('../../server');
const routes = require('../api/routeManifest');

describe('API certification — authenticated GET coverage', () => {
  let token;

  before(async () => {
    await waitForMongo();
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
    await mongoose.connection.close();
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
