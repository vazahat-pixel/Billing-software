'use strict';

const net = require('net');

/**
 * Find a free TCP port on 127.0.0.1, preferring `preferred` when free.
 */
function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findFreePort(preferred = 5050, host = '127.0.0.1') {
  const start = Number(preferred) || 5050;
  for (let p = start; p < start + 40; p++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(p, host)) return p;
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.listen(0, host, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.once('error', reject);
  });
}

module.exports = { findFreePort, isPortFree };
