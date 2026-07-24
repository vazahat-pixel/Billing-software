const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-characters-long';
if (!process.env.MONGO_URI) {
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/billing_test_isolation';
}

const mongoose = require('mongoose');
const request = require('supertest');
const { waitForMongo, authHeader, unwrapBody } = require('../helpers/setup');
const app = require('../../server');

/**
 * Multi-tenant isolation — Company A must never read Company B data.
 */
describe('Multi-company isolation', () => {
  let tokenA;
  let tokenB;
  let partyAId;
  let companyAId;

  before(async () => {
    await waitForMongo();
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('creates company A owner', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Owner A',
        email: `iso-a-${Date.now()}@example.com`,
        password: 'IsoPass123!',
        companyName: 'Company A Isolation',
      });
    assert.ok([200, 201].includes(res.status));
    tokenA = res.body.token;
    const me = await request(app).get('/api/auth/me').set(authHeader(tokenA));
    const user = unwrapBody(me) || me.body?.user || me.body;
    companyAId = user?.companyId || user?.company?._id || user?.data?.companyId;
  });

  it('creates company B owner', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Owner B',
        email: `iso-b-${Date.now()}@example.com`,
        password: 'IsoPass123!',
        companyName: 'Company B Isolation',
      });
    assert.ok([200, 201].includes(res.status));
    tokenB = res.body.token;
  });

  it('company A creates a party', async () => {
    const res = await request(app)
      .post('/api/parties')
      .set(authHeader(tokenA))
      .send({ name: 'Secret Party A Only', type: 'Customer', gstin: '24AAAAA0000A1Z5' });
    assert.ok([200, 201].includes(res.status));
    partyAId = unwrapBody(res)._id;
    assert.ok(partyAId);
  });

  it('company B list does not include company A party', async () => {
    const res = await request(app)
      .get('/api/parties')
      .set(authHeader(tokenB))
      .query({ page: 1, limit: 100, search: 'Secret Party A Only' });
    assert.equal(res.status, 200);
    const data = unwrapBody(res);
    const rows = Array.isArray(data) ? data : data?.items || data?.docs || data?.results || [];
    const leak = rows.some((p) => String(p._id) === String(partyAId) || /Secret Party A Only/i.test(p.name || ''));
    assert.equal(leak, false, 'Cross-company party leakage detected');
  });

  it('company B cannot fetch company A party by id', async () => {
    const res = await request(app)
      .get(`/api/parties/${partyAId}`)
      .set(authHeader(tokenB));
    assert.ok([403, 404].includes(res.status) || unwrapBody(res)?._id === undefined);
    if (res.status === 200) {
      const data = unwrapBody(res);
      assert.notEqual(String(data?._id), String(partyAId));
    }
  });

  it('tenant cannot switch company via X-Company-Id spoof', async () => {
    if (!companyAId) return;
    const res = await request(app)
      .get('/api/parties')
      .set({ ...authHeader(tokenB), 'X-Company-Id': String(companyAId) })
      .query({ search: 'Secret Party A Only' });
    assert.equal(res.status, 200);
    const data = unwrapBody(res);
    const rows = Array.isArray(data) ? data : data?.items || data?.docs || data?.results || [];
    const leak = rows.some((p) => String(p._id) === String(partyAId));
    assert.equal(leak, false, 'X-Company-Id spoof allowed tenant cross-access');
  });
});
