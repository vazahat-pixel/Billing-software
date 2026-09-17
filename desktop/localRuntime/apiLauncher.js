'use strict';

/**
 * Starts the Express API for desktop-local mode.
 * Prefers child_process with system/bundled Node (Electron ABI ≠ native addons).
 * Falls back to in-process require when DESKTOP_API_INPROCESS=1.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

let apiProc = null;
let inProcessHandle = null;

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolveBackendRoot(opts) {
  const candidates = [
    opts.backendRoot,
    opts.resourcesPath && path.join(opts.resourcesPath, 'backend'),
    path.join(opts.desktopRoot || '', '..', 'backend'),
    path.join(__dirname, '..', '..', 'backend'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (exists(path.join(c, 'server.js'))) return c;
  }
  throw new Error('Backend server.js not found for desktop local runtime');
}

function resolveNodeBinary(opts) {
  if (process.env.DESKTOP_NODE_PATH && exists(process.env.DESKTOP_NODE_PATH)) {
    return process.env.DESKTOP_NODE_PATH;
  }
  if (opts.resourcesPath) {
    const win = path.join(opts.resourcesPath, 'vendor', 'node', 'node.exe');
    const nix = path.join(opts.resourcesPath, 'vendor', 'node', 'node');
    if (exists(win)) return win;
    if (exists(nix)) return nix;
  }
  // Electron main can spawn itself as Node (no separate node.exe required on customer PCs)
  if (process.versions?.electron && process.execPath) {
    return process.execPath;
  }
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function waitForHealth(port, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/health/ready', timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve(true);
          if (Date.now() - start > timeoutMs) {
            return reject(new Error(`API health not ready (HTTP ${res.statusCode})`));
          }
          setTimeout(tick, 500);
        }
      );
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`API did not become ready on port ${port}`));
        } else {
          setTimeout(tick, 500);
        }
      });
    };
    tick();
  });
}

/**
 * @param {{
 *   port: number,
 *   mongoUri: string,
 *   userData: string,
 *   desktopRoot?: string,
 *   resourcesPath?: string,
 *   backendRoot?: string,
 *   jwtSecret?: string,
 * }} opts
 */
async function startApi(opts) {
  const port = Number(opts.port);
  const mongoUri = opts.mongoUri;
  const backendRoot = resolveBackendRoot(opts);

  const env = {
    ...process.env,
    NODE_ENV: process.env.DESKTOP_NODE_ENV || 'production',
    PORT: String(port),
    MONGO_URI: mongoUri,
    DESKTOP_LOCAL: 'true',
    ALLOW_PUBLIC_REGISTER: 'false',
    ALLOW_SUBSCRIPTION_BYPASS: 'false',
    DUNNING_INTERVAL_MS: '0',
    JWT_SECRET:
      opts.jwtSecret ||
      process.env.JWT_SECRET ||
      'desktop-local-jwt-secret-change-me-32chars!!',
    PROVISIONING_PACK_SECRET:
      process.env.PROVISIONING_PACK_SECRET ||
      opts.jwtSecret ||
      process.env.JWT_SECRET ||
      'desktop-local-jwt-secret-change-me-32chars!!',
    FRONTEND_URL: 'http://127.0.0.1',
    // Soft commercial gates — desktop is single-PC licensed locally
    MODULE_GATE_ENFORCE: process.env.MODULE_GATE_ENFORCE || 'false',
    PLAN_LIMIT_ENFORCE: process.env.PLAN_LIMIT_ENFORCE || 'false',
  };

  if (String(process.env.DESKTOP_API_INPROCESS || '').toLowerCase() === 'true') {
    process.env.MONGO_URI = mongoUri;
    process.env.PORT = String(port);
    process.env.DESKTOP_LOCAL = 'true';
    process.env.JWT_SECRET = env.JWT_SECRET;
    process.env.ALLOW_PUBLIC_REGISTER = 'true';
    process.env.DUNNING_INTERVAL_MS = '0';
    // Clear require cache for server if needed
    const serverPath = require.resolve(path.join(backendRoot, 'server.js'));
    delete require.cache[serverPath];
    const serverMod = require(serverPath);
    if (typeof serverMod.startServer !== 'function') {
      throw new Error('backend/server.js must export startServer for in-process mode');
    }
    inProcessHandle = await serverMod.startServer({ port, mongoUri });
    await waitForHealth(port);
    return { port, mode: 'inprocess', backendRoot };
  }

  const nodeBin = resolveNodeBinary(opts);
  const serverJs = path.join(backendRoot, 'server.js');
  const childEnv = { ...env };
  if (process.versions?.electron && nodeBin === process.execPath) {
    childEnv.ELECTRON_RUN_AS_NODE = '1';
  }
  apiProc = spawn(nodeBin, [serverJs], {
    cwd: backendRoot,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stderr = '';
  apiProc.stderr?.on('data', (d) => {
    stderr += String(d);
    if (stderr.length > 12000) stderr = stderr.slice(-6000);
    process.stderr.write(d);
  });
  apiProc.stdout?.on('data', (d) => {
    process.stdout.write(d);
  });
  apiProc.on('exit', (code) => {
    console.error('[localRuntime] API process exited', code);
    apiProc = null;
  });

  try {
    await waitForHealth(port, 120000);
  } catch (err) {
    await stopApi();
    throw new Error(`${err.message}\n${stderr.slice(-1000)}`);
  }

  return { port, mode: 'child', backendRoot, pid: apiProc.pid };
}

async function stopApi() {
  if (inProcessHandle && typeof inProcessHandle.stop === 'function') {
    try {
      await inProcessHandle.stop();
    } catch (err) {
      console.error('[localRuntime] in-process stop failed', err.message);
    }
    inProcessHandle = null;
  }
  if (!apiProc) return;
  const proc = apiProc;
  apiProc = null;
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
        }, 4000);
      }
    } catch {
      done();
    }
    setTimeout(done, 8000);
  });
}

module.exports = { startApi, stopApi, resolveBackendRoot };
