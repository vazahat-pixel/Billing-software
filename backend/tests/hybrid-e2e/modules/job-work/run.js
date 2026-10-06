'use strict';

/**
 * HYBRID JOB WORK E2E CERTIFICATION SUITE
 * Phase 2: Job Work module — mirrors the Sales and Purchase golden references.
 * NEVER connect to production.
 */

const crypto = require('crypto');
const path = require('path');
const { bootHybridE2eEnv } = require('../../lib/env');
const { seedCentralFixtures, withMongoose } = require('../../lib/fixtures');
const { api } = require('../../lib/http');
const { assertNotProduction } = require('../../../helpers/memoryDb');

const MODULE = 'job_work';

// ─── helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

async function test(label, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write(`  v ${label}\n`);
  } catch (err) {
    failed++;
    failures.push({ label, error: err.message });
    process.stdout.write(`  x ${label}\n    ${err.message}\n`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function login(base, email, password, deviceId) {
  const res = await api(base).post('/auth/login', {
    body: { email, password, deviceId, isDesktop: true, deviceName: 'HYBRID-E2E' },
    deviceId,
  });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  const payload = res.body?.data || res.body;
  return { token: payload.token, refreshToken: payload.refreshToken, user: payload.user };
}

async function agentTick(base, token, deviceId) {
  return api(base).post('/sync/agent-tick', { token, deviceId, body: {} });
}

async function withClient(uri, fn) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri);
  await client.connect();
  const dbName = new URL(uri).pathname.replace('/', '') || 'test';
  const db = client.db(dbName);
  try {
    return await fn(db);
  } finally {
    await client.close();
  }
}

function toOid(val) {
  const { ObjectId } = require('mongodb');
  try { return new ObjectId(String(val)); } catch { return val; }
}

async function countJobs(uri, companyId) {
  return withClient(uri, async (db) => {
    return db.collection('jobs').countDocuments({ companyId: toOid(companyId) });
  });
}

async function findJobByOp(uri, companyId, operationId) {
  return withClient(uri, async (db) => {
    const job = await db.collection('jobs').findOne({ companyId: toOid(companyId), operationId });
    const outbox = await db.collection('sync_outbox').findOne({ companyId: toOid(companyId), operationId });
    const processed = await db.collection('processed_operations').findOne({ companyId: toOid(companyId), operationId });
    const movements = job ? await db.collection('stockmovements').find({
      companyId: toOid(companyId),
      referenceId: job._id,
    }).toArray() : [];
    return { job, movements, outbox, processed };
  });
}

async function seedCentralTokenOnLocal(localUri, { companyId, token, refreshToken, deviceId }) {
  return withClient(localUri, async (db) => {
    const key = 'hybrid:agent';
    const existing = await db.collection('sync_state').findOne({ key });
    const current = existing?.value || {};
    await db.collection('sync_state').updateOne(
      { key },
      {
        $set: {
          value: {
            ...current,
            companyId: String(companyId),
            token,
            refreshToken: refreshToken || '',
            deviceId: String(deviceId || ''),
            updatedAt: new Date().toISOString(),
          },
        },
      },
      { upsert: true }
    );
  });
}

async function waitCentralJob(centralUri, localBase, localToken, deviceId, companyId, operationId, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const { job } = await findJobByOp(centralUri, companyId, operationId);
    if (job) return job;
    await api(localBase).post('/sync/agent-tick', { token: localToken, deviceId, body: {} });
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

// ─── suite runner ─────────────────────────────────────────────────────────────

async function runJobWorkSuite({ keepData = false } = {}) {
  console.log('\n====================================================');
  console.log('  HYBRID JOB WORK E2E CERTIFICATION');
  console.log('====================================================\n');

  passed = 0;
  failed = 0;
  failures.length = 0;

  let env;
  try {
    env = await bootHybridE2eEnv();
  } catch (err) {
    console.error('FATAL: failed to boot hybrid env:', err);
    process.exit(1);
  }

  const { centralUri, localUri } = env;
  let fx, centralToken, localToken;
  const issueOpId = crypto.randomUUID();
  let offlineJobId = null;

  try {
    await test('Security preconditions (no Atlas URIs)', () => {
      assertNotProduction(centralUri);
      assertNotProduction(localUri);
    });

    await test('MongoDB: central URI reachable', async () => {
      const { MongoClient } = require('mongodb');
      const c = new MongoClient(centralUri);
      await c.connect(); await c.db().command({ ping: 1 }); await c.close();
    });

    await test('MongoDB: local URI reachable', async () => {
      const { MongoClient } = require('mongodb');
      const c = new MongoClient(localUri);
      await c.connect(); await c.db().command({ ping: 1 }); await c.close();
    });

    await test('Seed central fixtures (company, worker party, lot)', async () => {
      fx = await seedCentralFixtures(centralUri, `JOB-${Date.now()}`);
      await withMongoose(centralUri, async () => {
        const CompanyModuleConfig = require('../../../../models/CompanyModuleConfig');
        await CompanyModuleConfig.updateOne(
          { companyId: fx.companyId },
          { $set: { 'modules.jobWork': true } },
          { upsert: true }
        );
        const Party = require('../../../../models/Party');
        const worker = await Party.create({
          companyId: fx.companyId,
          name: `${fx.tag}-MILL-WORKER`,
          type: 'Job Worker',
          state: 'Gujarat',
          stateCode: '24',
        });
        fx.workerId = String(worker._id);
      });
      assert(fx.companyId, 'companyId present');
      assert(fx.workerId, 'workerId present');
      assert(fx.lotId, 'lotId present');
    });

    await test('Central API startup', async () => {
      await env.startCentral({ MODULE_GATE_ENFORCE: 'false' });
    });

    await test('Local API startup (clone central fixtures)', async () => {
      await env.cloneCentralToLocal();
      await env.startLocal({ MODULE_GATE_ENFORCE: 'false' });
    });

    await test('Online job work baseline (central)', async () => {
      const localAuth = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      const centralAuth = await login(env.centralBase(), fx.email, fx.password, fx.deviceId);
      centralToken = centralAuth.token;
      localToken = localAuth.token;

      await seedCentralTokenOnLocal(localUri, {
        companyId: fx.companyId,
        token: centralToken,
        refreshToken: centralAuth.refreshToken,
        deviceId: fx.deviceId,
      });

      const res = await api(env.centralBase()).post('/jobs/issue', {
        token: centralToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId,
          workerId: fx.workerId,
          lotId: fx.lotId,
          processType: 'Dyeing',
          issueQty: 50,
          issuePcs: 5,
          jobRate: 10,
          challanNo: 'CHL-ONLINE-001',
          date: new Date(),
        },
      });
      assert(res.status === 201 || res.status === 200, `Expected 200/201 got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    await test('Offline mode: stop central', async () => {
      await env.stopCentral();
    });

    await test('Local API available while central offline', async () => {
      const res = await api(env.localBase()).get('/health/live');
      assert(res.status === 200, `Expected 200 got ${res.status}`);
    });

    await test('Offline job issue creation (local)', async () => {
      const res = await api(env.localBase()).post('/jobs/issue', {
        token: localToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId,
          workerId: fx.workerId,
          lotId: fx.lotId,
          operationId: issueOpId,
          processType: 'Printing',
          issueQty: 100,
          issuePcs: 10,
          jobRate: 15,
          challanNo: `CHL-OFFLINE-${Date.now()}`,
          date: new Date(),
        },
      });
      assert(res.status === 201 || res.status === 200, `Offline job issue failed: ${res.status}: ${JSON.stringify(res.body)}`);
      offlineJobId = res.body?.data?._id || res.body?.data?.id;
      assert(offlineJobId, 'offlineJobId returned');
    });

    await test('Local Job persisted in local MongoDB', async () => {
      const { job } = await findJobByOp(localUri, fx.companyId, issueOpId);
      assert(job, 'Job with operationId found in local DB');
      assert(Number(job.issueQty) === 100, `issueQty mismatch: ${job.issueQty}`);
    });

    await test('SyncOutbox PENDING for offline job issue', async () => {
      const { outbox } = await findJobByOp(localUri, fx.companyId, issueOpId);
      assert(outbox, 'Outbox entry found');
      assert(['PENDING','SYNCING'].includes(outbox.status), `Expected PENDING/SYNCING got ${outbox.status}`);
      assert(outbox.entityType === 'job_issue', `entityType ${outbox.entityType}`);
    });

    await test('Local stock movement created for offline job issue', async () => {
      const { movements } = await findJobByOp(localUri, fx.companyId, issueOpId);
      assert(movements && movements.length > 0, 'Expected StockMovement created');
    });

    await test('Application restart: local restarts cleanly', async () => {
      await env.restartLocal();
    });

    await test('Job data survives local restart', async () => {
      const { job } = await findJobByOp(localUri, fx.companyId, issueOpId);
      assert(job, 'Job still in local DB after restart');
    });

    await test('SyncOutbox survives local restart', async () => {
      const { outbox } = await findJobByOp(localUri, fx.companyId, issueOpId);
      assert(outbox, 'Outbox still present after restart');
    });

    await test('Offline job receive creation (local)', async () => {
      const localAuth = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      localToken = localAuth.token;

      const recvOpId = crypto.randomUUID();
      const res = await api(env.localBase()).post('/jobs/receive', {
        token: localToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId,
          jobId: offlineJobId,
          receivedQty: 98,
          receivedPcs: 10,
          charges: 1500,
          gstRate: 5,
          isFinal: true,
          operationId: recvOpId,
        },
      });
      assert(res.status === 201 || res.status === 200, `Offline job receive failed: ${res.status}: ${JSON.stringify(res.body)}`);
    });

    await test('SyncOutbox PENDING for offline job receive', async () => {
      const outboxRows = await withClient(localUri, async (db) => {
        return db.collection('sync_outbox').find({ companyId: toOid(fx.companyId), entityType: 'job_receive' }).toArray();
      });
      assert(outboxRows.length >= 1, 'Job receive outbox row present');
    });

    await test('Connectivity restored: restart central', async () => {
      await env.startCentral({ MODULE_GATE_ENFORCE: 'false' });
      const localAuth = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      const centralAuth = await login(env.centralBase(), fx.email, fx.password, fx.deviceId);
      centralToken = centralAuth.token;
      localToken = localAuth.token;
      await seedCentralTokenOnLocal(localUri, {
        companyId: fx.companyId,
        token: centralToken,
        refreshToken: centralAuth.refreshToken,
        deviceId: fx.deviceId,
      });
    });

    await test('Agent-tick triggers synchronization', async () => {
      const res = await agentTick(env.localBase(), localToken, fx.deviceId);
      assert(res.status === 200 || res.status === 204, `tick HTTP ${res.status}`);
      await new Promise(r => setTimeout(r, 1500));
    });

    await test('Job Issue synced to central MongoDB', async () => {
      const centralJob = await waitCentralJob(
        centralUri, env.localBase(), localToken, fx.deviceId, fx.companyId, issueOpId
      );
      assert(centralJob, 'Job with operationId found in central DB');
      assert(Number(centralJob.issueQty) === 100, `central issueQty ${centralJob.issueQty}`);
    });

    await test('Outbox entry marked SYNCED after sync', async () => {
      const { outbox } = await findJobByOp(localUri, fx.companyId, issueOpId);
      assert(outbox && outbox.status === 'SYNCED', `Expected SYNCED got ${outbox?.status}`);
    });

    await test('Idempotency: duplicate push returns duplicate=true', async () => {
      const { job } = await findJobByOp(localUri, fx.companyId, issueOpId);
      const pushRes = await api(env.centralBase()).post('/sync/push', {
        token: centralToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId, deviceId: fx.deviceId,
          operations: [{ operationId: issueOpId, entityType: 'job_issue', operationType: 'create',
            payload: { ...job, companyId: fx.companyId, operationId: issueOpId } }],
        },
      });
      assert(pushRes.status === 200, `Push HTTP ${pushRes.status}`);
      const accepted = pushRes.body?.acceptedOperations || pushRes.body?.data?.acceptedOperations || [];
      const op = accepted.find(o => o.operationId === issueOpId);
      assert(op?.duplicate === true, `Expected duplicate=true got ${op?.duplicate}`);
    });

    await test('Idempotency: no duplicate Job in central', async () => {
      const cnt = await withClient(centralUri, async (db) => {
        return db.collection('jobs').countDocuments({ companyId: toOid(fx.companyId), operationId: issueOpId });
      });
      assert(cnt === 1, `Expected exactly 1 job with operationId, got ${cnt}`);
    });

    await test('Retry handling: RETRY outbox re-processes without duplicate', async () => {
      await withClient(localUri, async (db) => {
        await db.collection('sync_outbox').updateOne(
          { companyId: toOid(fx.companyId), operationId: issueOpId },
          { $set: { status: 'RETRY' } }
        );
      });
      const before = await countJobs(centralUri, fx.companyId);
      await agentTick(env.localBase(), localToken, fx.deviceId);
      await new Promise(r => setTimeout(r, 1500));
      const after = await countJobs(centralUri, fx.companyId);
      assert(after === before, `Count changed on retry: ${before} -> ${after}`);
    });

    await test('Crash recovery: kill+restart+tick, count stable', async () => {
      const before = await countJobs(centralUri, fx.companyId);
      await env.stopLocal();
      await env.startLocal({ MODULE_GATE_ENFORCE: 'false' });
      const localAuth = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      const centralAuth = await login(env.centralBase(), fx.email, fx.password, fx.deviceId);
      localToken = localAuth.token;
      centralToken = centralAuth.token;
      await seedCentralTokenOnLocal(localUri, {
        companyId: fx.companyId,
        token: centralToken,
        refreshToken: centralAuth.refreshToken,
        deviceId: fx.deviceId,
      });
      await agentTick(env.localBase(), localToken, fx.deviceId);
      await new Promise(r => setTimeout(r, 1500));
      const after = await countJobs(centralUri, fx.companyId);
      assert(after === before, `Count changed on crash recovery: ${before} -> ${after}`);
    });

    await test('Company isolation: Company B sees 0 jobs with this operationId', async () => {
      const cnt = await withClient(centralUri, async (db) => {
        return db.collection('jobs').countDocuments({ companyId: toOid(fx.companyBId), operationId: issueOpId });
      });
      assert(cnt === 0, `Company B sees ${cnt} jobs (should be 0)`);
    });

    await test('Failed-operation recovery: FAILED outbox retries and syncs', async () => {
      const failId = crypto.randomUUID();
      const res = await api(env.localBase()).post('/jobs/issue', {
        token: localToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId,
          workerId: fx.workerId,
          lotId: fx.lotId,
          operationId: failId,
          processType: 'Ironing',
          issueQty: 10,
          issuePcs: 1,
          jobRate: 5,
          challanNo: `CHL-FAIL-${Date.now()}`,
          date: new Date(),
        },
      });
      assert(res.status === 201 || res.status === 200, `Create failed: ${res.status}`);
      await withClient(localUri, async (db) => {
        await db.collection('sync_outbox').updateOne(
          { companyId: toOid(fx.companyId), operationId: failId },
          { $set: { status: 'FAILED', retryCount: 0 } }
        );
      });
      const recovered = await waitCentralJob(
        centralUri, env.localBase(), localToken, fx.deviceId, fx.companyId, failId
      );
      assert(recovered, 'Failed-op recovery: job synced to central');
    });

  } finally {
    if (failures.length) {
      const logs = env?.logs?.();
      console.log('\n--- Central stdout ---\n', logs?.central?.stdout?.slice(-2000));
      console.log('\n--- Central stderr ---\n', logs?.central?.stderr?.slice(-2000));
      console.log('\n--- Local stdout ---\n', logs?.local?.stdout?.slice(-2000));
      console.log('\n--- Local stderr ---\n', logs?.local?.stderr?.slice(-2000));
    }
    await env.shutdown({ keepData });
  }

  const total = passed + failed;
  console.log('\n====================================================');
  console.log(`  JOB WORK CERTIFICATION: ${failed === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  Scenarios: ${total} | Passed: ${passed} | Failed: ${failed}`);
  if (failures.length) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(`  x ${f.label}\n    ${f.error}`));
  }
  console.log('====================================================\n');
  return { passed, failed, failures, total, module: MODULE };
}

if (require.main === module) {
  const keepData = process.argv.includes('--keep');
  runJobWorkSuite({ keepData }).then(({ failed: f }) => process.exit(f > 0 ? 1 : 0))
    .catch(err => { console.error('JOB WORK SUITE FATAL:', err); process.exit(1); });
}

module.exports = { runJobWorkSuite };
