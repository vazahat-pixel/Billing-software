'use strict';

/**
 * Desktop only: no entry may be saved until the company has been downloaded from the cloud.
 *
 * Until then the local bill and voucher counters are not the cloud's, so a bill saved now could
 * take a number the cloud already used, and masters made now would sit beside the cloud's copies.
 * Reads stay open; writes get 503 with a message the screen shows while the download runs.
 */

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isReplicationDesktop() {
  return (
    String(process.env.DESKTOP_REPLICATION || '').toLowerCase() === 'true' &&
    String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true'
  );
}

async function mirrorSnapshotGuard(req, res, next) {
  if (!isReplicationDesktop() || !WRITE.has(req.method)) return next();
  if (/^\/(auth|desktop|sync)(\/|$)/.test(req.path)) return next();
  try {
    const desktop = require('../services/replication/desktopSync');
    if (await desktop.isSnapshotDone()) return next();
  } catch {
    return next();
  }
  return res.status(503).json({
    success: false,
    code: 'MIRROR_DOWNLOADING',
    message: 'Your company data is still being downloaded to this computer. Entries can be made as soon as it finishes.',
  });
}

module.exports = mirrorSnapshotGuard;
