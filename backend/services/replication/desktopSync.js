'use strict';

/**
 * Desktop: keep the local database an exact copy of the company on the cloud.
 *
 *  importSnapshot — first run: download the whole company group, same _id for every document, and
 *                   remove anything local the cloud does not have. No entry can be made until this
 *                   finishes (see snapshotGuard), so local numbering starts exactly where the
 *                   cloud's is.
 *  push           — upload every document changed on this PC since the last upload, verbatim.
 *  pull           — download what changed on the cloud (settings edited on the web, and entries
 *                   when "Desktop-only entries" is OFF). A document still waiting to upload from this
 *                   PC is never overwritten: the desktop's version wins.
 */

const mongoose = require('mongoose');
const { BSON } = require('mongodb');
const scope = require('./scope');
const capture = require('./desktopCapture');

const { EJSON } = BSON;
const DIRTY = capture.DIRTY;
const STATE = 'sync_state';
const UPLOAD_BYTES = 900 * 1024; // the cloud accepts 2 MB request bodies
/** Replaced in place during the download (same _id on both sides) instead of cleared first. */
const KEEP_DURING_IMPORT = new Set(['users', 'companies', 'plans']);

const db = () => mongoose.connection.db;

// ---------------------------------------------------------------------------
// small persisted state (local sync_state collection)
// ---------------------------------------------------------------------------

async function getState(key, fallback = {}) {
  const row = await db().collection(STATE).findOne({ key });
  return row?.value ?? fallback;
}

async function setState(key, patch) {
  const current = await getState(key, {});
  const value = { ...current, ...patch };
  await db().collection(STATE).updateOne(
    { key },
    { $set: { key, value, updatedAt: new Date() } },
    { upsert: true }
  );
  return value;
}

const snapshotState = () => getState('mirror:snapshot', { state: 'pending' });

/**
 * A mirrored desktop holds ONE company (group). Signing in here with another company's account made
 * this PC create that company's default ledgers and settings on its own; the cloud already had them
 * under other ids, so they could never upload and blocked the sync. Refuse it with a clear message.
 */
async function assertThisPcCompany(companyId) {
  const snap = await snapshotState();
  const ids = (snap.companyIds || []).map(String);
  if (!ids.length || !companyId || ids.includes(String(companyId))) return;
  let name = '';
  try {
    const co = await db().collection('companies').findOne({ _id: new mongoose.Types.ObjectId(ids[0]) }, { projection: { name: 1 } });
    name = co?.name || '';
  } catch { /* message without the name */ }
  const err = new Error(
    `This computer is set up for ${name ? `"${name}"` : 'another company'}. Sign in here with that company's account. ` +
    'For any other company, use the website (app.dealingindia.com) or another computer.'
  );
  err.status = 403;
  err.code = 'OTHER_COMPANY_ON_THIS_PC';
  throw err;
}
const isSnapshotDone = async () => (await snapshotState()).state === 'done';

// ---------------------------------------------------------------------------
// talking to the cloud
// ---------------------------------------------------------------------------

function centralBase() {
  return String(process.env.CENTRAL_API_BASE_URL || '').replace(/\/$/, '');
}

async function agentContext() {
  return getState('hybrid:agent', {});
}

async function refreshToken(ctx) {
  if (!ctx.refreshToken) return null;
  const res = await fetch(`${centralBase()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': ctx.deviceId || '' },
    body: JSON.stringify({ refreshToken: ctx.refreshToken }),
  });
  const json = await res.json().catch(() => ({}));
  const data = json?.data || json;
  if (!res.ok || !data?.token) return null;
  await setState('hybrid:agent', { token: data.token, refreshToken: data.refreshToken || ctx.refreshToken });
  return data.token;
}

/** Calls the cloud with the stored login; renews the 8-hour token once when it has expired. */
async function central(path, { method = 'GET', body } = {}) {
  const base = centralBase();
  if (!base) throw new Error('CENTRAL_API_BASE_URL not configured');
  let ctx = await agentContext();
  if (!ctx.token) {
    const err = new Error('Sign in once with internet so this PC can reach the cloud.');
    err.code = 'NO_LOGIN';
    throw err;
  }
  const call = (token) => fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Device-Id': ctx.deviceId || '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  let res = await call(ctx.token);
  if (res.status === 401) {
    const fresh = await refreshToken(ctx);
    if (fresh) res = await call(fresh);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.message || `Cloud replied HTTP ${res.status}`);
    err.status = res.status;
    err.code = json?.code;
    throw err;
  }
  return json?.data ?? json;
}

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------

let snapshotRunning = null;

const isDupError = (err) =>
  err?.code === 11000 || (err?.writeErrors || []).some((w) => w?.code === 11000) || /E11000/.test(String(err?.message || ''));

const getPath = (obj, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj);

/**
 * Store cloud documents exactly. Only for the first download, where nothing local is real: if a
 * placeholder made meanwhile holds the same unique key (one-per-company rows), it is removed and
 * the cloud's copy written.
 */
async function upsertExact(coll, docs) {
  try {
    await coll.bulkWrite(
      docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })),
      { ordered: false }
    );
    return;
  } catch (err) {
    if (!isDupError(err)) throw err;
  }
  const uniques = (await coll.indexes())
    .filter((ix) => ix.unique && ix.name !== '_id_')
    .map((ix) => Object.keys(ix.key));
  for (const d of docs) {
    try {
      await coll.replaceOne({ _id: d._id }, d, { upsert: true });
    } catch (err) {
      if (!isDupError(err)) throw err;
      for (const keys of uniques) {
        const filter = {};
        let usable = true;
        for (const k of keys) {
          const v = getPath(d, k);
          if (v === undefined) { usable = false; break; }
          filter[k] = v;
        }
        if (usable) await coll.deleteMany({ ...filter, _id: { $ne: d._id } });
      }
      await coll.replaceOne({ _id: d._id }, d, { upsert: true });
    }
  }
}

async function clusterTimeNow() {
  const r = await db().command({ ping: 1 });
  return r?.operationTime || r?.$clusterTime?.clusterTime || null;
}

async function importSnapshotOnce() {
  await capture.stop();
  const manifest = await central('/sync/mirror/manifest');
  const total = manifest.collections.reduce((n, c) => n + c.count, 0);
  await setState('mirror:snapshot', {
    state: 'running', done: 0, total, error: null, startedAt: new Date().toISOString(),
    companyIds: manifest.companyIds,
  });

  // Before the download, everything this company has locally is a placeholder made by activation
  // and the first sign-in (security config, settings, …) — no entry can be made until the download
  // finishes. Remove those first: the cloud's own documents carry different _ids for the same
  // "one per company" rows, and keeping both would break unique indexes or show the wrong copy.
  // The signed-in user and the company row keep their _ids (they are the cloud's), so they are
  // replaced in place instead and the current login stays valid throughout.
  for (const { name } of manifest.collections) {
    if (KEEP_DURING_IMPORT.has(name)) continue;
    await db().collection(name).deleteMany(scope.scopeFilter(name, manifest.companyIds));
  }

  let done = 0;
  for (const { name } of manifest.collections) {
    const coll = db().collection(name);
    const keep = [];
    let after = null;
    for (;;) {
      const qs = new URLSearchParams({ collection: name, limit: '500' });
      if (after) qs.set('after', after);
      const page = await central(`/sync/mirror/page?${qs}`);
      const docs = EJSON.parse(page.docs, { relaxed: false });
      if (docs.length) {
        await upsertExact(coll, docs);
        for (const d of docs) keep.push(d._id);
        done += docs.length;
        await setState('mirror:snapshot', { done });
      }
      if (page.done || !page.nextAfter) break;
      after = page.nextAfter;
    }
    // Anything local for this company the cloud does not have — e.g. the settings row made by
    // activation — would sit next to the cloud's copy and be read instead of it.
    if (name !== 'plans') {
      await coll.deleteMany({ ...scope.scopeFilter(name, manifest.companyIds), _id: { $nin: keep } });
    }
  }

  // Every collection and index must exist before the first entry: a bill saved inside a
  // transaction while MongoDB is still creating its collection fails ("catalog changes").
  for (const name of mongoose.modelNames()) {
    await mongoose.model(name).init().catch(() => {});
  }

  // Nothing written so far is a "local change". Start watching from here.
  await db().collection(DIRTY).deleteMany({});
  await db().collection(STATE).deleteOne({ key: 'mirror:resume' });
  const at = await clusterTimeNow();
  await setState('mirror:pull', { since: manifest.serverTime });
  await setState('mirror:snapshot', { state: 'done', done, total, finishedAt: new Date().toISOString(), error: null });
  await capture.start({ startAtOperationTime: at });
  return { done, total };
}

/** Download the company once. Safe to call repeatedly; concurrent calls share one run. */
async function importSnapshot() {
  if (snapshotRunning) return snapshotRunning;
  snapshotRunning = importSnapshotOnce()
    .catch(async (err) => {
      // Nobody has signed in on this PC yet: the download has not started, so it has not failed either.
      if (err.code === 'NO_LOGIN') throw err;
      await setState('mirror:snapshot', { state: 'failed', error: err.message }).catch(() => {});
      throw err;
    })
    .finally(() => { snapshotRunning = null; });
  return snapshotRunning;
}

// ---------------------------------------------------------------------------
// upload
// ---------------------------------------------------------------------------

const PUSH_ROWS = 1000;
let progress = null; // { total, done } from the cloud answering until the whole round (download too) is over

/** Upload everything waiting. A long offline day is more than one batch; do not wait a round for each. */
async function push() {
  const sum = { pushed: 0, failed: 0 };
  await capture.flush();
  const total = await pendingCount();
  if (!total) return sum;
  await central('/sync/status'); // the cloud really answers: only now tell the screen it is uploading
  progress = { total, done: 0 };
  for (;;) {
    const r = await pushOnce();
    sum.pushed += r.pushed;
    sum.failed += r.failed;
    if (r.rows < PUSH_ROWS || !r.pushed) return sum;
  }
}

/**
 * The built-in books (SALES BOOK, CASH RECEIPT BOOK, ...) belong to no company and every install makes
 * its own; bills refer to them by name. They are not company data, so they are not uploaded.
 */
const isSystemBook = (coll, doc) => coll === 'books' && !!doc && (doc.companyId === null || doc.companyId === undefined);

async function pushOnce() {
  await capture.flush();
  const rows = await db().collection(DIRTY).find({}).sort({ seq: 1 }).limit(PUSH_ROWS).toArray();
  if (!rows.length) return { pushed: 0, failed: 0, rows: 0 };

  const { companyIds = [] } = await snapshotState();
  const items = [];
  for (const row of rows) {
    const id = EJSON.parse(row.id, { relaxed: false });
    const doc = await db().collection(row.coll).findOne({ _id: id });
    // Left over from signing in here with another company: it can never be accepted, so it must not
    // keep the real company's sync looking stuck.
    if (doc && companyIds.length && !scope.docInScope(row.coll, doc, companyIds)) {
      await db().collection(DIRTY).deleteOne({ _id: row._id, seq: row.seq });
      continue;
    }
    if (isSystemBook(row.coll, doc)) {
      await db().collection(DIRTY).deleteOne({ _id: row._id, seq: row.seq });
      continue;
    }
    items.push({ key: row._id, seq: row.seq, coll: row.coll, id, op: doc ? 'upsert' : 'delete', doc: doc || undefined });
  }

  if (!items.length) return { pushed: 0, failed: 0, rows: rows.length };

  // Batches under the cloud's body limit.
  const batches = [];
  let batch = [];
  let size = 0;
  for (const it of items) {
    const s = EJSON.stringify(it, { relaxed: false }).length;
    if (batch.length && size + s > UPLOAD_BYTES) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(it);
    size += s;
  }
  if (batch.length) batches.push(batch);

  let pushed = 0;
  let failed = 0;
  for (const b of batches) {
    const payload = EJSON.stringify(b.map(({ seq, ...rest }) => rest), { relaxed: false });
    const out = await central('/sync/mirror/apply', { method: 'POST', body: { payload } });
    const bySeq = new Map(b.map((it) => [it.key, it.seq]));
    for (const r of out.results || []) {
      if (r.ok) {
        // Only if not changed again while uploading — otherwise the newer change stays queued.
        await db().collection(DIRTY).deleteOne({ _id: r.key, seq: bySeq.get(r.key) });
        pushed += 1;
        if (progress) progress.done += 1;
      } else {
        failed += 1;
        await db().collection(DIRTY).updateOne(
          { _id: r.key },
          { $set: { lastCode: r.code, lastError: r.message, lastTriedAt: new Date() }, $inc: { attempts: 1 } }
        );
      }
    }
  }
  await setState('mirror:push', { lastAt: new Date().toISOString(), lastPushed: pushed, lastFailed: failed });
  return { pushed, failed, rows: rows.length };
}

// ---------------------------------------------------------------------------
// download changes
// ---------------------------------------------------------------------------

async function pull() {
  const { since } = await getState('mirror:pull', {});
  let bundle = null;
  if (since) {
    try {
      bundle = await central(`/sync/mirror/changes?${new URLSearchParams({ since })}`);
    } catch (err) {
      if (err.status !== 404) throw err; // a cloud not updated yet: read collection by collection as before
    }
  }
  const until = bundle?.serverTime || (await central('/sync/status'))?.serverTime || new Date().toISOString();
  if (bundle?.lock) await setState('mirror:lock', { ...bundle.lock, checkedAt: new Date().toISOString() });
  let applied = 0;
  const conflicts = [];

  // Counters first: a bill from the web must never be here before the counter that covers it, or the
  // next bill on this PC is offered a number that is already taken.
  const bundled = new Map((bundle?.collections || []).map((c) => [c.collection, c]));
  const names = ['counters', ...scope.ALL.filter((c) => c !== 'counters')].filter((n) => !bundle || bundled.has(n));
  for (const name of names) {
    // Counters carry no updatedAt: always read them, and only ever move them forward.
    const windowed = name !== 'counters';
    let after = null;
    let first = bundled.get(name) || null;
    for (;;) {
      const qs = new URLSearchParams({ collection: name, limit: '500' });
      if (after) qs.set('after', after);
      if (windowed && since) qs.set('since', since);
      if (windowed) qs.set('until', until);
      const page = first || await central(`/sync/mirror/page?${qs}`);
      const unread = first && !first.done && !first.nextAfter; // did not fit in the bundle: read from its start
      first = null;
      if (unread) continue;
      const docs = EJSON.parse(page.docs, { relaxed: false });
      for (const d of docs) {
        if (name === 'counters') {
          const { _id, seq, ...rest } = d;
          await db().collection('counters').updateOne(
            { _id },
            { $max: { seq: seq ?? 0 }, ...(Object.keys(rest).length ? { $set: rest } : {}) },
            { upsert: true }
          );
          continue;
        }
        const pending = await db().collection(DIRTY).findOne({ _id: capture.keyOf(name, d._id) });
        if (pending) continue; // this PC changed it and has not uploaded yet — desktop wins
        capture.ignoreNextChange(name, d._id, d);
        try {
          await db().collection(name).replaceOne({ _id: d._id }, d, { upsert: true });
          applied += 1;
        } catch (err) {
          if (!isDupError(err)) throw err;
          // A different document here already holds that key (e.g. the same bill number entered
          // on the web and on this PC while the lock was OFF). Never overwrite or delete a local
          // entry — keep both sides as they are and show it so the owner can fix one of them.
          conflicts.push({ collection: name, id: EJSON.stringify(d._id), message: String(err.message).slice(0, 300) });
        }
      }
      if (page.done || !page.nextAfter) break;
      after = page.nextAfter;
    }
  }
  // A web entry that could not be stored here stays listed (later rounds would otherwise forget it) until
  // it is here. It is sent again when it is next changed on the cloud.
  const { conflicts: earlier = [] } = await getState('mirror:pull', {});
  for (const c of earlier) {
    if (conflicts.some((x) => x.id === c.id)) continue;
    const here = await db().collection(c.collection).findOne({ _id: EJSON.parse(c.id, { relaxed: false }) }, { projection: { _id: 1 } });
    if (!here) conflicts.push(c);
  }
  await setState('mirror:pull', {
    since: until, lastAt: new Date().toISOString(), lastApplied: applied, conflicts: conflicts.slice(0, 50),
  });
  return { applied, conflicts: conflicts.length, lockRead: !!bundle?.lock };
}

// ---------------------------------------------------------------------------
// lock, status, tick
// ---------------------------------------------------------------------------

async function getLock({ refresh = false } = {}) {
  if (refresh) {
    try {
      const lock = await central('/sync/mirror/lock');
      await setState('mirror:lock', { ...lock, checkedAt: new Date().toISOString() });
      return lock;
    } catch { /* offline: fall back to what we knew */ }
  }
  return getState('mirror:lock', { desktopOnly: false });
}

async function setLock(desktopOnly) {
  const lock = await central('/sync/mirror/lock', { method: 'PUT', body: { desktopOnly: !!desktopOnly } });
  await setState('mirror:lock', { ...lock, checkedAt: new Date().toISOString() });
  return lock;
}

async function pendingCount() {
  return db().collection(DIRTY).countDocuments({});
}

const KIND = {
  sales: 'Sale bill', purchases: 'Purchase bill', jobs: 'Challan', paymentvouchers: 'Voucher', debitcreditnotes: 'Note',
  accountingentries: 'Journal entry', parties: 'Account', items: 'Item', ledgermasters: 'Ledger', returns: 'Return', orders: 'Order',
};

/** A refused entry in the owner's words: which bill, and what to do. */
async function describeFailure(f) {
  let label = '';
  try {
    const d = await db().collection(f.coll).findOne({ _id: EJSON.parse(f.id, { relaxed: false }) });
    label = String(d?.invoiceNo || d?.challanNo || d?.voucherNo || d?.noteNo || d?.returnNo || d?.orderNo || d?.entryNo || d?.name || '');
  } catch { /* shown without a number */ }
  const what = `${KIND[f.coll] || f.coll}${label ? ` "${label}"` : ''}`;
  const help = f.lastCode === 'DUPLICATE'
    ? `${what}: this number has also been used on the web, so it was not uploaded. Please contact support, and keep Desktop-only Entries ON in Settings.`
    : `${what}: ${f.lastError || f.lastCode}`;
  return { collection: f.coll, label, code: f.lastCode, message: f.lastError, help, attempts: f.attempts };
}

async function status() {
  const [snapshot, pushState, pullState, lock, pending, failing, failingCount] = await Promise.all([
    snapshotState(),
    getState('mirror:push', {}),
    getState('mirror:pull', {}),
    getState('mirror:lock', { desktopOnly: false }),
    pendingCount(),
    db().collection(DIRTY).find({ lastCode: { $exists: true } }).sort({ seq: 1 }).limit(20).toArray(),
    db().collection(DIRTY).countDocuments({ lastCode: { $exists: true } }),
  ]);
  const tick = await getState('mirror:tick', {});
  return {
    snapshot,
    pending,
    progress,
    failing: await Promise.all(failing.map(describeFailure)),
    failingCount,
    lastPushAt: pushState.lastAt || null,
    lastPullAt: pullState.lastAt || null,
    conflicts: pullState.conflicts || [],
    lastError: tick.lastError || null,
    online: tick.online ?? null,
    lastTickAt: tick.at || null,
    lock,
    capture: capture.getStatus(),
  };
}

let ticking = null;

async function tickOnce() {
  try {
    const snap = await snapshotState();
    if (snap.state !== 'done') {
      await importSnapshot();
    } else if (!capture.getStatus().running) {
      await capture.start();
    }
    await push();
    const pulled = await pull();
    if (!pulled.lockRead) await getLock({ refresh: true });
    await setState('mirror:tick', { at: new Date().toISOString(), online: true, lastError: null });
  } catch (err) {
    // Only a failed connection means "no internet"; anything else is shown as itself.
    const msg = `${err?.message || ''} ${err?.cause?.code || ''} ${err?.name || ''}`;
    const offline = !err.status && /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|UND_ERR|AbortError|TimeoutError|network/i.test(msg);
    if (!offline) console.warn('[mirror] sync round failed:', err?.stack || err?.message);
    await setState('mirror:tick', {
      at: new Date().toISOString(),
      online: offline ? false : true,
      lastError: offline ? 'No internet — entries are kept on this PC and upload automatically.' : err.message,
    }).catch(() => {});
  } finally {
    progress = null;
  }
}

/** One sync round; overlapping callers share it. */
function tick() {
  if (!ticking) ticking = tickOnce().finally(() => { ticking = null; });
  return ticking;
}

module.exports = {
  assertThisPcCompany,
  importSnapshot, push, pull, tick, status, pendingCount, getLock, setLock, isSnapshotDone, central,
};
