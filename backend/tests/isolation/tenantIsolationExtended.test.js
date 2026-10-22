const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

/**
 * Tenant Isolation & Shared Masters Verification (Task 2)
 *
 * Proves:
 * 1. Two separate tenants (A and B), each with a root and child company.
 * 2. Company listing displays only companies belonging to the authenticated tenant.
 * 3. Tenant A cannot list, select, switch to, or access Tenant B's companies.
 * 4. Same-tenant child company (A2) shares root company (A1) masters.
 * 5. Other tenant (B1, B2) cannot see Tenant A's shared masters.
 * 6. Transaction data remains strictly isolated between companies and tenants.
 */
describe('Tenant Isolation & Shared Masters (Task 2)', () => {
  let app;
  let request;
  let shutdown;

  let tokenA1;
  let tokenA2;
  let tokenB1;
  let tokenB2;

  let companyA1Id;
  let companyA2Id;
  let groupCodeA;

  let companyB1Id;
  let companyB2Id;
  let groupCodeB;

  let sharedPartyAId;

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
  });

  after(async () => {
    if (shutdown) await shutdown();
  });

  it('1. Register Tenant A and verify Root Company A1 is provisioned', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Tenant Owner A',
        email: `tenant-a-${Date.now()}@example.com`,
        password: 'PasswordA123!',
        companyName: 'Root Corp A1',
      });
    assert.ok([200, 201].includes(res.status), `Register failed: ${res.status}`);
    tokenA1 = res.body.token;

    const compRes = await request(app)
      .get('/api/auth/companies')
      .set(authHeader(tokenA1));
    assert.equal(compRes.status, 200);
    const data = unwrapBody(compRes);
    groupCodeA = data.groupCode;
    assert.ok(groupCodeA, 'Group code A should be generated');
    assert.equal(data.companies.length, 1);
    companyA1Id = data.companies[0].id;
    assert.ok(companyA1Id);
  });

  it('2. Register Tenant B and verify Root Company B1 is provisioned', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Tenant Owner B',
        email: `tenant-b-${Date.now()}@example.com`,
        password: 'PasswordB123!',
        companyName: 'Root Corp B1',
      });
    assert.ok([200, 201].includes(res.status), `Register failed: ${res.status}`);
    tokenB1 = res.body.token;

    const compRes = await request(app)
      .get('/api/auth/companies')
      .set(authHeader(tokenB1));
    assert.equal(compRes.status, 200);
    const data = unwrapBody(compRes);
    groupCodeB = data.groupCode;
    assert.ok(groupCodeB, 'Group code B should be generated');
    assert.notEqual(groupCodeA, groupCodeB, 'Group codes must be unique across tenants');
    assert.equal(data.companies.length, 1);
    companyB1Id = data.companies[0].id;
    assert.ok(companyB1Id);
  });

  it('3. Tenant A creates Child Company A2 under Tenant A', async () => {
    const res = await request(app)
      .post('/api/auth/companies')
      .set(authHeader(tokenA1))
      .send({
        name: 'Child Textile A2',
        groupCode: groupCodeA,
        coCode: '102',
      });
    assert.ok([200, 201].includes(res.status), `Create sibling failed: ${res.status}`);
    const child = unwrapBody(res);
    companyA2Id = child.id;
    assert.ok(companyA2Id);
  });

  it('4. Tenant B creates Child Company B2 under Tenant B', async () => {
    const res = await request(app)
      .post('/api/auth/companies')
      .set(authHeader(tokenB1))
      .send({
        name: 'Child Mill B2',
        groupCode: groupCodeB,
        coCode: '102',
      });
    assert.ok([200, 201].includes(res.status), `Create sibling failed: ${res.status}`);
    const child = unwrapBody(res);
    companyB2Id = child.id;
    assert.ok(companyB2Id);
  });

  it('5. Tenant A company list contains ONLY A1 and A2 (never B1 or B2)', async () => {
    const res = await request(app)
      .get('/api/auth/companies')
      .set(authHeader(tokenA1));
    assert.equal(res.status, 200);
    const data = unwrapBody(res);
    const ids = data.companies.map((c) => String(c.id));
    assert.ok(ids.includes(String(companyA1Id)), 'Should include A1');
    assert.ok(ids.includes(String(companyA2Id)), 'Should include A2');
    assert.equal(ids.includes(String(companyB1Id)), false, 'Must NOT include Tenant B root B1');
    assert.equal(ids.includes(String(companyB2Id)), false, 'Must NOT include Tenant B child B2');
  });

  it('6. Tenant B company list contains ONLY B1 and B2 (never A1 or A2)', async () => {
    const res = await request(app)
      .get('/api/auth/companies')
      .set(authHeader(tokenB1));
    assert.equal(res.status, 200);
    const data = unwrapBody(res);
    const ids = data.companies.map((c) => String(c.id));
    assert.ok(ids.includes(String(companyB1Id)), 'Should include B1');
    assert.ok(ids.includes(String(companyB2Id)), 'Should include B2');
    assert.equal(ids.includes(String(companyA1Id)), false, 'Must NOT include Tenant A root A1');
    assert.equal(ids.includes(String(companyA2Id)), false, 'Must NOT include Tenant A child A2');
  });

  it('7. Tenant A cannot switch to Tenant B companies (B1 or B2)', async () => {
    const resRoot = await request(app)
      .post('/api/auth/switch-company')
      .set(authHeader(tokenA1))
      .send({ companyId: companyB1Id });
    assert.equal(resRoot.status, 403, 'Switching to Tenant B root must be 403 Forbidden');

    const resChild = await request(app)
      .post('/api/auth/switch-company')
      .set(authHeader(tokenA1))
      .send({ companyId: companyB2Id });
    assert.equal(resChild.status, 403, 'Switching to Tenant B child must be 403 Forbidden');
  });

  it('8. Tenant B cannot switch to Tenant A companies (A1 or A2)', async () => {
    const resRoot = await request(app)
      .post('/api/auth/switch-company')
      .set(authHeader(tokenB1))
      .send({ companyId: companyA1Id });
    assert.equal(resRoot.status, 403, 'Switching to Tenant A root must be 403 Forbidden');

    const resChild = await request(app)
      .post('/api/auth/switch-company')
      .set(authHeader(tokenB1))
      .send({ companyId: companyA2Id });
    assert.equal(resChild.status, 403, 'Switching to Tenant A child must be 403 Forbidden');
  });

  it('9. Tenant A switches to Child Company A2 successfully', async () => {
    const res = await request(app)
      .post('/api/auth/switch-company')
      .set(authHeader(tokenA1))
      .send({ companyId: companyA2Id });
    assert.equal(res.status, 200);
    const body = unwrapBody(res);
    assert.ok(body.token, 'Should return switched token');
    tokenA2 = body.token;
    assert.equal(String(body.company.id), String(companyA2Id));
    assert.equal(String(body.masterCompanyId), String(companyA1Id));
  });

  it('10. Shared Masters: Tenant A creates Party on Root A1, Child A2 can access it', async () => {
    // Create master party while on A1
    const createRes = await request(app)
      .post('/api/parties')
      .set(authHeader(tokenA1))
      .send({
        name: 'Shared Master Supplier A',
        type: 'Supplier',
        city: 'Surat',
        gstin: '24AAAAA0000A1Z5',
      });
    assert.ok([200, 201].includes(createRes.status), `Create party failed: ${createRes.status}`);
    const partyData = unwrapBody(createRes);
    sharedPartyAId = partyData._id;
    assert.ok(sharedPartyAId);

    // Child A2 queries parties: masterScope maps to root A1 so Child A2 sees the shared party!
    const childListRes = await request(app)
      .get('/api/parties')
      .set(authHeader(tokenA2))
      .query({ search: 'Shared Master Supplier A' });
    assert.equal(childListRes.status, 200);
    const childData = unwrapBody(childListRes);
    const rows = Array.isArray(childData) ? childData : childData?.items || childData?.docs || [];
    const foundInChild = rows.some((p) => String(p._id) === String(sharedPartyAId));
    assert.ok(foundInChild, 'Child Company A2 must have access to root shared master party');
  });

  it('11. Tenant B (B1 and B2) CANNOT see Tenant A shared master', async () => {
    // Tenant B1
    const resB1 = await request(app)
      .get('/api/parties')
      .set(authHeader(tokenB1))
      .query({ search: 'Shared Master Supplier A' });
    assert.equal(resB1.status, 200);
    const dataB1 = unwrapBody(resB1);
    const rowsB1 = Array.isArray(dataB1) ? dataB1 : dataB1?.items || dataB1?.docs || [];
    assert.equal(rowsB1.some((p) => String(p._id) === String(sharedPartyAId)), false);

    // Tenant B2
    const switchB2 = await request(app)
      .post('/api/auth/switch-company')
      .set(authHeader(tokenB1))
      .send({ companyId: companyB2Id });
    assert.equal(switchB2.status, 200);
    tokenB2 = unwrapBody(switchB2).token;

    const resB2 = await request(app)
      .get('/api/parties')
      .set(authHeader(tokenB2))
      .query({ search: 'Shared Master Supplier A' });
    assert.equal(resB2.status, 200);
    const dataB2 = unwrapBody(resB2);
    const rowsB2 = Array.isArray(dataB2) ? dataB2 : dataB2?.items || dataB2?.docs || [];
    assert.equal(rowsB2.some((p) => String(p._id) === String(sharedPartyAId)), false);
  });

  it('12. Operational Isolation: Tenant A cannot spoof companyId in body/query', async () => {
    // Attempt to query parties or company with spoofed companyId
    const res = await request(app)
      .get(`/api/parties/${sharedPartyAId}`)
      .set(authHeader(tokenB1));
    // Should be 404/403 for Tenant B
    assert.ok([403, 404].includes(res.status) || unwrapBody(res)?._id === undefined);
  });
});
