'use strict';

/**
 * Portable mongod launcher for standalone desktop.
 * Order: vendor binary → PATH scan → mongodb-memory-server (persistent dbPath).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

let mongodProc = null;
let startedByUs = false;
let memoryServer = null;

function exists(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolveMongodBinary(paths) {
  const candidates = [];
  if (paths.resourcesPath) {
    candidates.push(path.join(paths.resourcesPath, 'vendor', 'mongodb', 'bin', 'mongod.exe'));
    candidates.push(path.join(paths.resourcesPath, 'vendor', 'mongodb', 'bin', 'mongod'));
  }
  if (paths.desktopRoot) {
    candidates.push(path.join(paths.desktopRoot, 'vendor', 'mongodb', 'bin', 'mongod.exe'));
    candidates.push(path.join(paths.desktopRoot, 'vendor', 'mongodb', 'bin', 'mongod'));
  }
  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (home) {
    candidates.push(path.join(home, '.cache', 'mongodb-binaries'));
    candidates.push(path.join(home, 'AppData', 'Local', 'mongodb-binaries'));
  }
  for (const c of candidates) {
    if (exists(c) && fs.statSync(c).isFile()) return c;
    if (exists(c) && fs.statSync(c).isDirectory()) {
      try {
        const entries = fs.readdirSync(c);
        for (const e of entries) {
          const bin = path.join(c, e, process.platform === 'win32' ? 'mongod.exe' : 'mongod');
          if (exists(bin)) return bin;
          const nested = path.join(c, e, 'bin', process.platform === 'win32' ? 'mongod.exe' : 'mongod');
          if (exists(nested)) return nested;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`mongod did not accept connections on ${host}:${port} within ${timeoutMs}ms`));
        } else {
          setTimeout(tryOnce, 400);
        }
      });
    };
    tryOnce();
  });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function resolveMemoryServerModule(desktopRoot) {
  const candidates = [
    path.join(desktopRoot, '..', 'backend', 'node_modules', 'mongodb-memory-server'),
    path.join(desktopRoot, 'node_modules', 'mongodb-memory-server'),
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* next */
    }
  }
  try {
    return require('mongodb-memory-server');
  } catch {
    return null;
  }
}

/**
 * Initiate single-node replica set so local Express can use real ACID transactions.
 * Safe to call repeatedly (already-initiated sets are ignored).
 */
async function ensureReplicaSet(port, replSetName = 'rs0') {
  let MongoClient;
  try {
    ({ MongoClient } = require('mongodb'));
  } catch {
    try {
      ({ MongoClient } = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'mongodb')));
    } catch (err) {
      console.warn('[localRuntime] mongodb driver missing; skipping rs.initiate:', err.message);
      return false;
    }
  }
  const uri = `mongodb://127.0.0.1:${port}/?directConnection=true`;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const admin = client.db().admin();
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      if (status?.ok) return true;
    } catch {
      /* not initiated yet */
    }
    await admin.command({
      replSetInitiate: {
        _id: replSetName,
        members: [{ _id: 0, host: `127.0.0.1:${port}` }],
      },
    });
    // Wait until primary is elected
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      try {
        const st = await admin.command({ replSetGetStatus: 1 });
        const self = (st.members || []).find((m) => m.self) || (st.members || [])[0];
        if (self && (self.stateStr === 'PRIMARY' || self.state === 1)) return true;
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.warn('[localRuntime] replica set initiated but primary not confirmed in time');
    return true;
  } catch (err) {
    console.warn('[localRuntime] ensureReplicaSet failed:', err.message);
    return false;
  } finally {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {{ dataDir: string, port?: number, resourcesPath?: string, desktopRoot?: string, logPath?: string, replicaSet?: boolean|string }} opts
 */
async function startMongo(opts) {
  const port = Number(opts.port || 27017);
  const dataDir = opts.dataDir;
  const replSetName =
    opts.replicaSet === false
      ? null
      : typeof opts.replicaSet === 'string'
        ? opts.replicaSet
        : 'rs0';
  fs.mkdirSync(dataDir, { recursive: true });
  if (opts.logPath) {
    fs.mkdirSync(path.dirname(opts.logPath), { recursive: true });
  }

  if (await portInUse(port)) {
    startedByUs = false;
    if (replSetName) {
      await ensureReplicaSet(port, replSetName);
    }
    const qs = replSetName ? `?replicaSet=${replSetName}` : '';
    return {
      port,
      uri: `mongodb://127.0.0.1:${port}/textile_erp_desktop${qs}`,
      reused: true,
      replicaSet: replSetName,
    };
  }

  const bin = resolveMongodBinary(opts);
  if (bin) {
    const args = [
      '--dbpath', dataDir,
      '--port', String(port),
      '--bind_ip', '127.0.0.1',
      '--storageEngine', 'wiredTiger',
    ];
    if (replSetName) {
      args.push('--replSet', replSetName);
    }
    if (opts.logPath) {
      args.push('--logpath', opts.logPath, '--logappend');
    }

    mongodProc = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env },
    });
    startedByUs = true;

    let stderr = '';
    mongodProc.stderr?.on('data', (d) => {
      stderr += String(d);
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    mongodProc.on('error', (err) => {
      console.error('[localRuntime] mongod spawn error', err.message);
    });
    mongodProc.on('exit', (code) => {
      if (startedByUs) console.error('[localRuntime] mongod exited', code, stderr.slice(-500));
      mongodProc = null;
    });

    try {
      await waitForPort(port, '127.0.0.1', 90000);
    } catch (err) {
      await stopMongo();
      throw new Error(`${err.message}\nTried binary: ${bin}\n${stderr.slice(-800)}`);
    }

    if (replSetName) {
      await ensureReplicaSet(port, replSetName);
    }

    const qs = replSetName ? `?replicaSet=${replSetName}` : '';
    return {
      port,
      uri: `mongodb://127.0.0.1:${port}/textile_erp_desktop${qs}`,
      reused: false,
      binary: bin,
      replicaSet: replSetName,
    };
  }

  const mms = resolveMemoryServerModule(opts.desktopRoot || path.join(__dirname, '..'));
  if (!mms) {
    throw new Error(
      'No mongod binary found. Run: node desktop/scripts/fetch-mongodb.cjs\n' +
        'Or install MongoDB and ensure mongod is on PATH.'
    );
  }

  console.log('[localRuntime] Starting Mongo via mongodb-memory-server (persistent dbPath)…');
  memoryServer = await mms.MongoMemoryServer.create({
    instance: {
      port,
      dbPath: dataDir,
      storageEngine: 'wiredTiger',
      launchTimeout: 120000,
    },
  });
  startedByUs = true;
  const uri = memoryServer.getUri('textile_erp_desktop');
  return {
    port,
    uri,
    reused: false,
    binary: 'mongodb-memory-server',
  };
}

async function stopMongo() {
  if (memoryServer) {
    try {
      await memoryServer.stop({ doCleanup: false, force: true });
    } catch (err) {
      console.error('[localRuntime] memoryServer stop', err.message);
    }
    memoryServer = null;
    startedByUs = false;
    return;
  }

  if (!startedByUs || !mongodProc) {
    mongodProc = null;
    startedByUs = false;
    return;
  }
  const proc = mongodProc;
  mongodProc = null;
  startedByUs = false;
  await new Promise((resolve) => {
    const done = () => resolve();
    proc.once('exit', done);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { windowsHide: true }).on('exit', done);
      } else {
        proc.kill('SIGTERM');
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            /* ignore */
          }
        }, 5000);
      }
    } catch {
      done();
    }
    setTimeout(done, 8000);
  });
}

module.exports = { startMongo, stopMongo, resolveMongodBinary, ensureReplicaSet };
