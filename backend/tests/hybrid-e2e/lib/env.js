'use strict';

/**
 * Dual isolated MongoMemoryServer + Express child processes for hybrid E2E.
 * Never points at Atlas / production DB names.
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const net = require('net');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { assertNotProduction } = require('../../helpers/memoryDb');

const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function waitHealth(port, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/api/health/live', timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve(true);
          if (Date.now() - start > timeoutMs) {
            return reject(new Error(`health timeout HTTP ${res.statusCode} :${port}`));
          }
          setTimeout(tick, 400);
        }
      );
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`health timeout :${port}`));
        else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

async function cloneDatabase(srcUri, destUri) {
  assertNotProduction(srcUri);
  assertNotProduction(destUri);
  const src = new MongoClient(srcUri);
  const dest = new MongoClient(destUri);
  await src.connect();
  await dest.connect();
  try {
    const srcDb = src.db();
    const destDb = dest.db();
    const cols = await srcDb.listCollections().toArray();
    for (const c of cols) {
      const name = c.name;
      if (name.startsWith('system.')) continue;
      const docs = await srcDb.collection(name).find({}).toArray();
      if (!docs.length) continue;
      await destDb.collection(name).deleteMany({});
      await destDb.collection(name).insertMany(docs);
    }
  } finally {
    await src.close();
    await dest.close();
  }
}

function spawnApi({ name, mongoUri, port, extraEnv = {} }) {
  assertNotProduction(mongoUri);
  const logs = { stdout: '', stderr: '' };
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    HOST: '127.0.0.1',
    MONGO_URI: mongoUri,
    JWT_SECRET: 'hybrid-e2e-jwt-secret-minimum-32-characters!!',
    PROVISIONING_PACK_SECRET: 'hybrid-e2e-pack-secret-minimum-32chars!!',
    ALLOW_PUBLIC_REGISTER: 'false',
    ALLOW_SUBSCRIPTION_BYPASS: 'true',
    DUNNING_INTERVAL_MS: '0',
    MONGO_REPLICA_SET: 'false',
    HYBRID_E2E: 'true',
    SKIP_PRODUCTION_ENV_CHECK: 'true',
    ...extraEnv,
  };
  // Force disposable URI — ignore parent shell Atlas settings
  env.MONGO_URI = mongoUri;
  const proc = spawn(process.execPath, [path.join(BACKEND_ROOT, 'server.js')], {
    cwd: BACKEND_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  proc.stdout.on('data', (d) => {
    logs.stdout += String(d);
    if (logs.stdout.length > 50000) logs.stdout = logs.stdout.slice(-25000);
  });
  proc.stderr.on('data', (d) => {
    logs.stderr += String(d);
    if (logs.stderr.length > 50000) logs.stderr = logs.stderr.slice(-25000);
  });
  proc._hybridLogs = logs;
  proc._hybridName = name;
  proc._hybridPort = port;
  proc._hybridMongoUri = mongoUri;
  proc._hybridEnv = extraEnv;
  return proc;
}

async function stopProc(proc) {
  if (!proc || proc.killed) return;
  await new Promise((resolve) => {
    const done = () => resolve();
    proc.once('exit', done);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { windowsHide: true }).on(
          'exit',
          done
        );
      } else {
        proc.kill('SIGTERM');
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            /* ignore */
          }
        }, 3000);
      }
    } catch {
      done();
    }
    setTimeout(done, 8000);
  });
}

/**
 * Boot full dual stack.
 */
async function bootHybridE2eEnv() {
  const stamp = Date.now();
  const centralMms = await MongoMemoryServer.create();
  const localMms = await MongoMemoryServer.create();
  const centralUri = centralMms.getUri(`central_hybrid_e2e_test_${stamp}`);
  const localUri = localMms.getUri(`local_hybrid_e2e_test_${stamp}`);
  assertNotProduction(centralUri);
  assertNotProduction(localUri);

  const centralPort = await findFreePort();
  const localPort = await findFreePort();

  return {
    stamp,
    centralUri,
    localUri,
    centralPort,
    localPort,
    centralMms,
    localMms,
    centralProc: null,
    localProc: null,
    async startCentral(extraEnv = {}) {
      await stopProc(this.centralProc);
      this.centralProc = spawnApi({
        name: 'central',
        mongoUri: this.centralUri,
        port: this.centralPort,
        extraEnv: {
          HYBRID_SYNC_ENABLED: 'true',
          DESKTOP_LOCAL: 'false',
          DESKTOP_HYBRID: 'false',
          MODULE_GATE_ENFORCE: extraEnv.MODULE_GATE_ENFORCE || 'false',
          DEVICE_BINDING_ENFORCE: extraEnv.DEVICE_BINDING_ENFORCE || 'false',
          ...extraEnv,
        },
      });
      try {
        await waitHealth(this.centralPort);
      } catch (err) {
        const logs = this.centralProc?._hybridLogs;
        throw new Error(
          `${err.message}\n--- central stderr ---\n${(logs?.stderr || '').slice(-2000)}\n--- stdout ---\n${(logs?.stdout || '').slice(-2000)}`
        );
      }
      return this.centralBase();
    },
    async stopCentral() {
      await stopProc(this.centralProc);
      this.centralProc = null;
    },
    async startLocal(extraEnv = {}) {
      await stopProc(this.localProc);
      this.localProc = spawnApi({
        name: 'local',
        mongoUri: this.localUri,
        port: this.localPort,
        extraEnv: {
          DESKTOP_LOCAL: 'true',
          DESKTOP_HYBRID: 'true',
          HYBRID_SYNC_ENABLED: 'true',
          CENTRAL_API_BASE_URL: this.centralBase(),
          MODULE_GATE_ENFORCE: extraEnv.MODULE_GATE_ENFORCE || 'false',
          DEVICE_BINDING_ENFORCE: extraEnv.DEVICE_BINDING_ENFORCE || 'false',
          SYNC_AGENT_INTERVAL_MS: '3600000', // harness drives ticks explicitly
          ...extraEnv,
        },
      });
      await waitHealth(this.localPort);
      return this.localBase();
    },
    async stopLocal() {
      await stopProc(this.localProc);
      this.localProc = null;
    },
    async restartLocal() {
      const env = { ...(this.localProc?._hybridEnv || {}) };
      await this.stopLocal();
      return this.startLocal(env);
    },
    centralBase() {
      return `http://127.0.0.1:${this.centralPort}/api`;
    },
    localBase() {
      return `http://127.0.0.1:${this.localPort}/api`;
    },
    async cloneCentralToLocal() {
      await cloneDatabase(this.centralUri, this.localUri);
    },
    async shutdown({ keepData = false } = {}) {
      await this.stopLocal();
      await this.stopCentral();
      if (!keepData) {
        try {
          await this.centralMms.stop();
        } catch {
          /* ignore */
        }
        try {
          await this.localMms.stop();
        } catch {
          /* ignore */
        }
      }
    },
    logs() {
      return {
        central: this.centralProc?._hybridLogs || null,
        local: this.localProc?._hybridLogs || null,
      };
    },
  };
}

module.exports = {
  bootHybridE2eEnv,
  cloneDatabase,
  findFreePort,
  waitHealth,
  BACKEND_ROOT,
};
