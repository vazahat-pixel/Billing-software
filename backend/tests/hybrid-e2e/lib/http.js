'use strict';

const http = require('http');
const { URL } = require('url');

function request(baseUrl, method, path, { token, body, headers = {}, deviceId } = {}) {
  const url = new URL(path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path}`);
  const payload = body != null ? JSON.stringify(body) : null;
  const hdrs = {
    Accept: 'application/json',
    ...(payload ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(deviceId ? { 'X-Device-Id': deviceId } : {}),
    ...headers,
  };
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: hdrs,
        timeout: 30000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode, body: json, raw, headers: res.headers });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('request timeout'));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const api = (base) => ({
  get: (p, opts) => request(base, 'GET', p, opts),
  post: (p, opts) => request(base, 'POST', p, opts),
  put: (p, opts) => request(base, 'PUT', p, opts),
  patch: (p, opts) => request(base, 'PATCH', p, opts),
});

module.exports = { request, api };
