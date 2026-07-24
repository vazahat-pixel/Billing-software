const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-characters-long';
if (!process.env.MONGO_URI) {
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/billing_test_security';
}

const mongoose = require('mongoose');
const request = require('supertest');
const { waitForMongo, authHeader, unwrapBody } = require('../helpers/setup');
const app = require('../../server');

describe('Security certification — auth & injection guards', () => {
  let token;

  before(async () => {
    await waitForMongo();
  });

  after(async () => {
    await mongoose.connection.close();
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
    // Either created or validated — response must be JSON, not executed HTML
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
    // Spoofed companyId must not win — created under JWT company
    if (data.companyId) {
      assert.notEqual(String(data.companyId), fakeId);
    }
  });
});
