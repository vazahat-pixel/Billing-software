'use strict';

/**
 * Desktop sync status + central connectivity probe (main-process side).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

let status = {
  mode: 'local',
  connectivity: 'unknown',
  syncState: 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
  centralReachable: false,
  authValid: false,
};

let probeTimer = null;
let listeners = [];

function getStatus() {
  return { ...status };
}

function setStatus(patch) {
  status = { ...status, ...patch };
  for (const fn of listeners) {
    try {
      fn(getStatus());
    } catch {
      /* ignore */
    }
  }
}

function onStatus(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}

function httpGet(url, headers = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      return reject(err);
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search || ''}`,
        method: 'GET',
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        resolve({ statusCode: res.statusCode });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Fully online only when central sync endpoint is reachable.
 * 200 = online+auth; 401 = central up but auth invalid (degraded).
 */
async function probeCentral({ centralApiBaseUrl, token } = {}) {
  if (!centralApiBaseUrl) {
    setStatus({
      connectivity: 'offline',
      centralReachable: false,
      authValid: false,
    });
    return getStatus();
  }
  const base = String(centralApiBaseUrl).replace(/\/$/, '');
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await httpGet(`${base}/sync/status`, headers);
    if (res.statusCode === 200) {
      setStatus({
        centralReachable: true,
        authValid: true,
        connectivity: 'online',
        lastError: null,
      });
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      setStatus({
        centralReachable: true,
        authValid: false,
        connectivity: 'degraded',
        lastError: `auth ${res.statusCode}`,
      });
    } else {
      setStatus({
        centralReachable: false,
        authValid: false,
        connectivity: 'offline',
        lastError: `HTTP ${res.statusCode}`,
      });
    }
  } catch (err) {
    setStatus({
      centralReachable: false,
      authValid: false,
      connectivity: 'offline',
      lastError: err.message,
    });
  }
  return getStatus();
}

function startProbing(opts, intervalMs = 15000) {
  stopProbing();
  const tick = () => {
    probeCentral(opts).catch(() => {});
  };
  tick();
  probeTimer = setInterval(tick, intervalMs);
  if (probeTimer.unref) probeTimer.unref();
}

function stopProbing() {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
}

module.exports = {
  getStatus,
  setStatus,
  onStatus,
  probeCentral,
  startProbing,
  stopProbing,
};
