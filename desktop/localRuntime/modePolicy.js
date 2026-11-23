'use strict';

/**
 * Which mode an offline-capable desktop should be in. Pure functions over config.json, so the rules
 * can be tested without Electron.
 *
 * Offline entries made in "remote" mode wait in the window's own queue, which hybrid mode does not
 * read. So a PC may only (re)enter hybrid while that queue is EMPTY.
 */
const modeOf = (cfg) => String(cfg?.mode || '').toLowerCase();

/** What this PC is meant to run: its saved mode, else the mode shipped in the installer. */
const wantsHybrid = (userCfg, shipped) => (modeOf(userCfg) || modeOf(shipped)) === 'hybrid';

/**
 * Offer to move a remote PC to offline mode — once per app version, so a PC that an older installer
 * switched and then dropped back to remote is not stuck there for good.
 */
const shouldOfferMirror = (userCfg, shipped, appVersion) =>
  modeOf(shipped) === 'hybrid' &&
  modeOf(userCfg) === 'remote' &&
  !userCfg.hybridRetry &&
  userCfg.mirrorSwitchVersion !== appVersion;

/** Offline start failed: work on the cloud now, and remember to try offline mode again. */
const afterFailedStart = (userCfg, shipped, cloudUrl, message, now = new Date()) => ({
  ...userCfg,
  mode: 'remote',
  apiBaseUrl: cloudUrl,
  centralApiBaseUrl: cloudUrl,
  ...(wantsHybrid(userCfg, shipped)
    ? {
        hybridRetry: true,
        hybridFailCount: (Number(userCfg?.hybridFailCount) || 0) + 1,
        hybridLastError: String(message || '').slice(0, 500),
        hybridLastFailedAt: now.toISOString(),
      }
    : {}),
});

/**
 * The window reported its queue. Returns the config to save, or null if nothing changes: empty queue
 * = next start may try offline mode again; anything waiting = stay remote until it has uploaded.
 */
const onQueueReport = (userCfg, pending) => {
  if (!userCfg?.hybridRetry) return null;
  const mode = pending > 0 ? 'remote' : 'hybrid';
  return modeOf(userCfg) === mode ? null : { ...userCfg, mode };
};

/** Offline mode started: forget earlier failures. Null if there were none. */
const afterGoodStart = (userCfg) => {
  if (!userCfg?.hybridRetry && !userCfg?.hybridFailCount) return null;
  const rest = { ...userCfg };
  for (const k of ['hybridRetry', 'hybridFailCount', 'hybridLastError', 'hybridLastFailedAt']) delete rest[k];
  return rest;
};

module.exports = { wantsHybrid, shouldOfferMirror, afterFailedStart, onQueueReport, afterGoodStart };
