'use strict';

/**
 * Desktop: notice every change to a mirrored collection and remember it until it is uploaded.
 *
 * Uses a MongoDB change stream on the local replica set, so it sees every write regardless of the
 * code path that made it — service, controller, bulk update, native driver. Each change marks the
 * document "dirty" in sync_dirty (one row per document, newest change wins). The upload step reads
 * the CURRENT document at send time, so ten edits to one bill offline become one upload.
 *
 * The change stream's resume token is saved after the dirty row is written. If the app is closed or
 * crashes, the next start resumes from that token and MongoDB replays anything not yet recorded —
 * no entry made on this PC can be missed.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { BSON } = require('mongodb');
const scope = require('./scope');

const { EJSON } = BSON;
const DIRTY = 'sync_dirty';
const RESUME_KEY = 'mirror:resume';

let stream = null;
let chain = Promise.resolve();
let lastSeq = 0;
let status = { running: false, available: null, error: null, lastEventAt: null };

/** Documents just written by a pull: their change event must not be uploaded back. */
const ignored = new Map(); // key -> { hash | 'DELETE', at }
const IGNORE_TTL_MS = 10 * 60 * 1000;

const db = () => mongoose.connection.db;
const keyOf = (coll, id) => `${coll}|${EJSON.stringify(id, { relaxed: false })}`;
const hashOf = (doc) => crypto.createHash('sha1').update(EJSON.stringify(doc, { relaxed: false })).digest('hex');

function nextSeq() {
  lastSeq = Math.max(Date.now() * 1000, lastSeq + 1);
  return lastSeq;
}

function isReplicationDesktop() {
  return (
    String(process.env.DESKTOP_REPLICATION || '').toLowerCase() === 'true' &&
    String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true'
  );
}

/** Called by the pull step just before it writes a document from the cloud. */
function ignoreNextChange(coll, id, docOrNull) {
  ignored.set(keyOf(coll, id), { hash: docOrNull ? hashOf(docOrNull) : 'DELETE', at: Date.now() });
}

function shouldIgnore(key, ev) {
  const hit = ignored.get(key);
  if (!hit) return false;
  if (Date.now() - hit.at > IGNORE_TTL_MS) {
    ignored.delete(key);
    return false;
  }
  const same = ev.operationType === 'delete'
    ? hit.hash === 'DELETE'
    : !!ev.fullDocument && hit.hash === hashOf(ev.fullDocument);
  if (same) ignored.delete(key);
  return same;
}

async function markDirty(coll, id) {
  const key = keyOf(coll, id);
  await db().collection(DIRTY).updateOne(
    { _id: key },
    {
      $set: { coll, id: EJSON.stringify(id, { relaxed: false }), seq: nextSeq(), at: new Date() },
      $setOnInsert: { attempts: 0 },
    },
    { upsert: true }
  );
}

async function saveResumeToken(token) {
  await db().collection('sync_state').updateOne(
    { key: RESUME_KEY },
    { $set: { key: RESUME_KEY, value: { token: EJSON.stringify(token, { relaxed: false }) }, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function loadResumeToken() {
  const row = await db().collection('sync_state').findOne({ key: RESUME_KEY });
  return row?.value?.token ? EJSON.parse(row.value.token, { relaxed: false }) : null;
}

async function handle(ev) {
  const coll = ev?.ns?.coll;
  if (!coll || !scope.isBoth(coll)) return;
  const id = ev.documentKey?._id;
  if (id === undefined) return;
  const key = keyOf(coll, id);
  if (!shouldIgnore(key, ev)) await markDirty(coll, id);
  await saveResumeToken(ev._id);
  status.lastEventAt = new Date().toISOString();
}

/**
 * Every in-scope document becomes dirty. Used only when MongoDB no longer has the history to
 * resume from (the app was closed for a very long time with heavy use), so the next upload
 * re-sends everything — slow but complete, and safe because the cloud stores by _id.
 */
async function markEverythingDirty() {
  for (const coll of scope.BOTH) {
    const cursor = db().collection(coll).find({}, { projection: { _id: 1 } });
    for await (const d of cursor) await markDirty(coll, d._id);
  }
}

/**
 * @param {{ startAtOperationTime?: import('mongodb').Timestamp }} opts
 *   startAtOperationTime: the cluster time right after a snapshot import, so the import itself is
 *   not seen as local changes.
 */
async function start(opts = {}) {
  if (!isReplicationDesktop() || stream) return status;

  const pipeline = [
    { $match: { 'ns.coll': { $in: scope.BOTH }, operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } },
  ];
  const watchOpts = { fullDocument: 'updateLookup' };
  const token = await loadResumeToken();
  if (token) watchOpts.resumeAfter = token;
  else if (opts.startAtOperationTime) watchOpts.startAtOperationTime = opts.startAtOperationTime;

  try {
    stream = db().watch(pipeline, watchOpts);
  } catch (err) {
    status = { ...status, running: false, available: false, error: err.message };
    return status;
  }

  stream.on('change', (ev) => {
    chain = chain.then(() => handle(ev)).catch((err) => {
      status.error = `capture: ${err.message}`;
      console.warn('[mirror] capture failed for one change:', err.message);
    });
  });

  stream.on('error', async (err) => {
    const code = err?.code;
    console.warn('[mirror] change stream error:', code, err.message);
    status = { ...status, running: false, error: err.message };
    try { await stream.close(); } catch { /* already closed */ }
    stream = null;

    if (code === 40573 || /only supported on replica sets/i.test(err.message)) {
      // Standalone mongod: changes cannot be observed, so nothing would ever upload. Say so loudly.
      status.available = false;
      status.error = 'Local database is not running as a replica set — entries on this PC cannot be uploaded.';
      return;
    }
    if (code === 286 || code === 280 || /resume/i.test(err.message)) {
      await db().collection('sync_state').deleteOne({ key: RESUME_KEY }).catch(() => {});
      await markEverythingDirty().catch((e) => console.warn('[mirror] full re-mark failed:', e.message));
    }
    setTimeout(() => start().catch(() => {}), 3000);
  });

  status = { ...status, running: true, available: true, error: null };
  return status;
}

async function stop() {
  if (stream) {
    try { await stream.close(); } catch { /* ignore */ }
    stream = null;
  }
  await chain.catch(() => {});
  status.running = false;
}

/** Wait until every change delivered so far has been recorded (tests, and before an upload). */
async function flush() {
  await chain.catch(() => {});
}

const getStatus = () => ({ ...status });

module.exports = {
  DIRTY, start, stop, flush, getStatus, ignoreNextChange, markDirty, keyOf, isReplicationDesktop,
};
