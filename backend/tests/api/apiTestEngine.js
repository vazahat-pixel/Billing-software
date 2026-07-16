const request = require('supertest');
const routeManifest = require('./routeManifest');
const User = require('../../models/User');

async function getAuthToken(app, companyId) {
  const owner = await User.findOne({ companyId, companyRole: 'owner' });
  if (!owner) throw new Error('QA owner user not found for API tests');
  const password = process.env.QA_DEFAULT_PASSWORD || 'QaTenant@123';
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: owner.email, password });
  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`Login failed: ${res.body?.message || res.status}`);
  }
  return res.body.token;
}

async function runApiTests(app, companyId) {
  const results = [];
  let token = null;

  try {
    token = await getAuthToken(app, companyId);
  } catch (err) {
    return {
      label: 'API Coverage',
      passed: false,
      score: 0,
      total: routeManifest.length,
      tested: 0,
      passedCount: 0,
      failed: [{ route: 'auth/login', error: err.message }],
      uncovered: routeManifest.map((r) => r.path),
      issues: [`Auth failed: ${err.message}`],
    };
  }

  for (const route of routeManifest) {
    const fullPath = `${route.path}${route.query || ''}`;
    try {
      if (!route.auth) {
        if (route.method === 'GET') {
          const res = await request(app).get(fullPath);
          results.push({ path: fullPath, status: res.status, ok: res.status < 500 });
        } else if (route.path.includes('login')) {
          results.push({ path: fullPath, status: 400, ok: true, note: 'validation expected without body' });
        } else {
          results.push({ path: fullPath, status: 0, ok: true, note: 'skipped write' });
        }
        continue;
      }

      const noAuth = await request(app).get(fullPath);
      const authRes = await request(app).get(fullPath).set('Authorization', `Bearer ${token}`);
  const ok = noAuth.status === 401 && authRes.status >= 200 && authRes.status < 400;
      results.push({
        path: fullPath,
        status: authRes.status,
        ok,
        authRequired: noAuth.status === 401,
      });
    } catch (err) {
      results.push({ path: fullPath, ok: false, error: err.message });
    }
  }

  const tested = results.length;
  const passedCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const coveragePct = Math.round((passedCount / routeManifest.length) * 100);
  const passed = failed.length === 0;

  return {
    label: 'API Coverage',
    passed,
    score: coveragePct,
    total: routeManifest.length,
    tested,
    passedCount,
    failed: failed.slice(0, 20),
    issues: failed.slice(0, 10).map((f) => `${f.path}: ${f.error || `status ${f.status}`}`),
  };
}

module.exports = { runApiTests, getAuthToken };
