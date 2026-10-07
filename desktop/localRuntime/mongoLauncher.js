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
let lastStartedPort = null;
let lastDataDir = null;

function exists(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolveMongodBinary(paths = {}) {
  const candidates = [];
  const resPath = paths?.resourcesPath || (typeof process !== 'undefined' && process.resourcesPath);
  if (resPath) {
    candidates.push(path.join(resPath, 'vendor', 'mongodb', 'bin', 'mongod.exe'));
    candidates.push(path.join(resPath, 'vendor', 'mongodb', 'bin', 'mongod'));
    candidates.push(path.join(resPath, 'app.asar.unpacked', 'vendor', 'mongodb', 'bin', 'mongod.exe'));
  }
  if (paths?.desktopRoot) {
    candidates.push(path.join(paths.desktopRoot, 'vendor', 'mongodb', 'bin', 'mongod.exe'));
    candidates.push(path.join(paths.desktopRoot, 'vendor', 'mongodb', 'bin', 'mongod'));
  }
  if (typeof process !== 'undefined' && process.execPath) {
    const execDir = path.dirname(process.execPath);
    candidates.push(path.join(execDir, 'resources', 'vendor', 'mongodb', 'bin', 'mongod.exe'));
    candidates.push(path.join(execDir, 'vendor', 'mongodb', 'bin', 'mongod.exe'));
    candidates.push(path.join(execDir, 'bin', 'mongod.exe'));
  }
  candidates.push(path.join(__dirname, '..', 'vendor', 'mongodb', 'bin', 'mongod.exe'));
  candidates.push(path.join(__dirname, '..', '..', 'vendor', 'mongodb', 'bin', 'mongod.exe'));
  candidates.push(path.join(__dirname, '..', 'resources', 'vendor', 'mongodb', 'bin', 'mongod.exe'));
  if (typeof process !== 'undefined' && process.cwd) {
    candidates.push(path.join(process.cwd(), 'vendor', 'mongodb', 'bin', 'mongod.exe'));
    candidates.push(path.join(process.cwd(), 'resources', 'vendor', 'mongodb', 'bin', 'mongod.exe'));
  }

  // Check standard Windows Program Files install paths
  const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const mongoBase = path.join(progFiles, 'MongoDB', 'Server');
  if (exists(mongoBase)) {
    try {
      const versions = fs.readdirSync(mongoBase);
      for (const v of versions) {
        candidates.push(path.join(mongoBase, v, 'bin', 'mongod.exe'));
      }
    } catch {
      /* ignore */
    }
  }

  // System PATH discovery via where.exe / which
  try {
    const { execSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where.exe mongod' : 'which mongod';
    const out = execSync(cmd, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) {
      const firstLine = out.split(/\r?\n/)[0].trim();
      if (firstLine && exists(firstLine)) candidates.push(firstLine);
    }
  } catch {
    /* ignore if not on PATH */
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
          const direct = path.join(c, e);
          if (exists(direct) && fs.statSync(direct).isFile() && /^mongod.*\.exe$/i.test(e)) return direct;
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

function waitForPort(port, host = '127.0.0.1', timeoutMs = 60000, proc = null, logPath = null) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    let finished = false;
    let timer = null;

    if (proc) {
      proc.once('exit', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        let logTail = '';
        if (logPath && fs.existsSync(logPath)) {
          try {
            logTail = fs.readFileSync(logPath, 'utf8').split('\n').slice(-30).join('\n');
          } catch {
            /* ignore */
          }
        }
        reject(new Error(`mongod process exited prematurely with code ${code}.\n${logTail}`));
      });
    }

    const tryOnce = () => {
      if (finished) return;
      const socket = net.connect({ port, host }, () => {
        finished = true;
        clearTimeout(timer);
        socket.end();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        if (finished) return;
        if (Date.now() - start > timeoutMs) {
          finished = true;
          let logTail = '';
          if (logPath && fs.existsSync(logPath)) {
            try {
              logTail = fs.readFileSync(logPath, 'utf8').split('\n').slice(-30).join('\n');
            } catch {
              /* ignore */
            }
          }
          reject(new Error(`mongod did not accept connections on ${host}:${port} within ${timeoutMs}ms.\n${logTail}`));
        } else {
          timer = setTimeout(tryOnce, 300);
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
    let needsInitiate = false;
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      const self = (status.members || []).find((m) => m.self) || (status.members || [])[0];
      if (self && (self.stateStr === 'PRIMARY' || self.state === 1)) {
        return true;
      }
    } catch {
      needsInitiate = true;
    }

    if (needsInitiate) {
      try {
        await admin.command({
          replSetInitiate: {
            _id: replSetName,
            members: [{ _id: 0, host: `127.0.0.1:${port}` }],
          },
        });
      } catch (e) {
        /* already initiated or in progress */
      }
    }

    // Wait until primary is elected (handle REMOVED state if port changed across boots)
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      try {
        const st = await admin.command({ replSetGetStatus: 1 });
        const self = (st.members || []).find((m) => m.self) || (st.members || [])[0];
        if (self && (self.stateStr === 'PRIMARY' || self.state === 1)) return true;
        if (self && (self.stateStr === 'REMOVED' || self.state === 10)) {
          try {
            const conf = await admin.command({ replSetGetConfig: 1 });
            if (conf?.config) {
              conf.config.version = (conf.config.version || 1) + 1;
              conf.config.members[0].host = `127.0.0.1:${port}`;
              await admin.command({ replSetReconfig: conf.config, force: true });
            }
          } catch {
            /* retry */
          }
        }
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
  lastStartedPort = port;
  const dataDir = opts.dataDir;
  lastDataDir = dataDir;
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
    try {
      const { execFileSync } = require('child_process');
      execFileSync(bin, ['--version'], { timeout: 3000, windowsHide: true, stdio: 'ignore' });
    } catch (probeErr) {
      console.warn('[localRuntime] mongod binary execution probe failed:', probeErr.message);
      throw new Error(`mongod binary cannot execute on this system: ${probeErr.message}\nTried binary: ${bin}`);
    }

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

    let stdout = '';
    let stderr = '';
    mongodProc.stdout?.on('data', (d) => {
      stdout += String(d);
      if (stdout.length > 8000) stdout = stdout.slice(-4000);
    });
    mongodProc.stderr?.on('data', (d) => {
      stderr += String(d);
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    mongodProc.on('error', (err) => {
      console.error('[localRuntime] mongod spawn error', err.message);
    });
    mongodProc.on('exit', (code) => {
      if (startedByUs) console.error('[localRuntime] mongod exited', code, (stderr || stdout).slice(-500));
      mongodProc = null;
    });

    try {
      await waitForPort(port, '127.0.0.1', 10000, mongodProc, opts.logPath);
    } catch (err) {
      await stopMongo();
      throw new Error(`${err.message}\nTried binary: ${bin}\nStdout:\n${stdout.slice(-800)}\nStderr:\n${stderr.slice(-800)}`);
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
      'Embedded MongoDB engine could not be initialized.\n' +
        'Please ensure Textile ERP was installed completely with bundled dependencies,\n' +
        'or install MongoDB Community Server on this computer.'
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
    let finished = false;
    const done = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };
    proc.once('exit', done);
    try {
      if (process.platform === 'win32') {
        try {
          const { execSync } = require('child_process');
          execSync(`taskkill /pid ${proc.pid} /f /t`, { windowsHide: true, stdio: 'ignore' });
        } catch {
          /* ignore if already dead */
        }
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
    setTimeout(done, 5000);
  });

  // Ensure socket teardown is complete before resolving
  if (lastStartedPort) {
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await portInUse(lastStartedPort))) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // Ensure mongod.lock is fully released by the OS before returning
  if (lastDataDir) {
    const lockFile = path.join(lastDataDir, 'mongod.lock');
    for (let i = 0; i < 20; i++) {
      try {
        if (!fs.existsSync(lockFile)) break;
        const fd = fs.openSync(lockFile, 'r+');
        fs.closeSync(fd);
        break;
      } catch {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
}

module.exports = { startMongo, stopMongo, resolveMongodBinary, ensureReplicaSet };
