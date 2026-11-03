'use strict';

/**
 * Cloud side of desktop mirroring.
 *
 *  snapshotPage   — a desktop downloads its company group, collection by collection, _id order.
 *  applyBatch     — a desktop uploads the documents it changed; stored verbatim by _id.
 *  getLock/setLock — "Desktop-only entries": while ON the web cannot write business data, so the
 *                   desktop is the only writer and nothing can conflict.
 *
 * Documents travel as EJSON strings: express-mongo-sanitize strips "$"-keys from request bodies,
 * and EJSON's $oid / $date / $numberDecimal keys are what keep ObjectId, Date and Decimal128 exact.
 */

const mongoose = require('mongoose');
const { BSON } = require('mongodb');
const scope = require('./scope');
const Company = require('../../models/Company');
const SyncState = require('../../models/SyncState');

const { EJSON } = BSON;
const PAGE_MAX = 1000;

const db = () => mongoose.connection.db;

/** Root company plus every company sharing its masters — what one login can see. */
async function groupCompanyIds(companyId) {
  const home = await Company.findById(companyId).select('masterCompanyId').lean();
  if (!home) return [String(companyId)];
  const root = home.masterCompanyId || home._id;
  const rows = await Company.find({ $or: [{ _id: root }, { masterCompanyId: root }] }).select('_id').lean();
  const ids = new Set(rows.map((r) => String(r._id)));
  ids.add(String(companyId));
  return [...ids];
}

async function manifest(companyId) {
  const companyIds = await groupCompanyIds(companyId);
  const collections = [];
  for (const name of scope.ALL) {
    const count = await db().collection(name).countDocuments(scope.scopeFilter(name, companyIds));
    collections.push({ name, count, direction: scope.isBoth(name) ? 'both' : 'down' });
  }
  return { companyIds, collections, serverTime: new Date().toISOString() };
}

/**
 * One page of a collection. `after` is the EJSON of the last _id received; `since`/`until`
 * (ISO) restrict to documents changed in that window, which is how the desktop catches up on
 * web entries when the lock is off.
 */
async function snapshotPage(companyId, { collection, after, limit, since, until } = {}) {
  if (!scope.isMirrored(collection)) {
    const err = new Error(`collection ${collection} is not mirrored`);
    err.status = 400;
    throw err;
  }
  const companyIds = await groupCompanyIds(companyId);
  const filter = scope.scopeFilter(collection, companyIds);
  if (after) {
    const afterId = EJSON.parse(after, { relaxed: false });
    // counters / companies already scope on _id — add the cursor to that condition
    filter._id = filter._id ? { ...filter._id, $gt: afterId } : { $gt: afterId };
  }
  if (since || until) {
    filter.updatedAt = {};
    if (since) filter.updatedAt.$gt = new Date(since);
    if (until) filter.updatedAt.$lte = new Date(until);
  }
  const n = Math.min(Math.max(Number(limit) || 500, 1), PAGE_MAX);
  const docs = await db().collection(collection).find(filter).sort({ _id: 1 }).limit(n).toArray();
  const last = docs.length ? docs[docs.length - 1]._id : null;
  return {
    collection,
    docs: EJSON.stringify(docs, { relaxed: false }),
    count: docs.length,
    nextAfter: last === null ? null : EJSON.stringify(last, { relaxed: false }),
    done: docs.length < n,
  };
}

/**
 * Store what a desktop changed. Each item: { coll, op: 'upsert'|'delete', id, doc }.
 * Per item, never all-or-nothing: one bad document must not stop the rest of a day's work.
 */
async function applyBatch(companyId, payloadString) {
  const items = EJSON.parse(String(payloadString || '[]'), { relaxed: false });
  if (!Array.isArray(items)) {
    const err = new Error('payload must be an array');
    err.status = 400;
    throw err;
  }
  const companyIds = await groupCompanyIds(companyId);
  const results = [];

  for (const item of items) {
    const key = item?.key || null;
    const reject = (code, message) => results.push({ key, ok: false, code, message });
    const coll = String(item?.coll || '');

    if (!scope.isBoth(coll)) {
      reject('NOT_MIRRORED', `${coll} cannot be uploaded from a desktop`);
      continue;
    }

    try {
      if (item.op === 'delete') {
        // Counters are never deleted by the app; deleting one would restart bill numbering at 1
        // and hand out numbers the company has already issued.
        if (coll === 'counters') {
          reject('NOT_ALLOWED', 'a number counter cannot be deleted');
          continue;
        }
        // Scope check on the stored copy, so a desktop can only delete its own group's documents.
        const filter = { _id: item.id };
        const existing = await db().collection(coll).findOne(filter);
        if (existing && !scope.docInScope(coll, existing, companyIds)) {
          reject('OUT_OF_SCOPE', 'document belongs to another company');
          continue;
        }
        if (existing) await db().collection(coll).deleteOne(filter);
        results.push({ key, ok: true });
        continue;
      }

      const doc = item.doc;
      if (!doc || doc._id === undefined) {
        reject('BAD_DOC', 'missing document');
        continue;
      }
      if (!scope.docInScope(coll, doc, companyIds)) {
        reject('OUT_OF_SCOPE', 'document is not for this company');
        continue;
      }

      if (coll === 'counters') {
        // Numbers only ever move forward on either side; the counter's other fields are copied.
        const { _id, seq, ...rest } = doc;
        await db().collection('counters').updateOne(
          { _id },
          { $max: { seq: seq ?? 0 }, ...(Object.keys(rest).length ? { $set: rest } : {}) },
          { upsert: true }
        );
        results.push({ key, ok: true });
        continue;
      }

      // Same _id may exist for another tenant only through tampering; refuse to touch it.
      const existing = await db().collection(coll).findOne({ _id: doc._id }, { projection: { companyId: 1 } });
      if (existing && !scope.docInScope(coll, { ...existing, _id: doc._id }, companyIds)) {
        reject('OUT_OF_SCOPE', 'document belongs to another company');
        continue;
      }
      await db().collection(coll).replaceOne({ _id: doc._id }, doc, { upsert: true });
      results.push({ key, ok: true });
    } catch (err) {
      // E11000 here is a real clash (e.g. the same bill number entered on web meanwhile).
      reject(err?.code === 11000 ? 'DUPLICATE' : 'ERROR', String(err.message || err).slice(0, 500));
    }
  }

  return { results, accepted: results.filter((r) => r.ok).length, rejected: results.filter((r) => !r.ok).length };
}

// ---------------------------------------------------------------------------
// "Desktop-only entries" lock
// ---------------------------------------------------------------------------

const lockKey = (companyId) => `desktop-lock:${companyId}`;
const lockCache = new Map(); // companyId -> { on, at }
const LOCK_CACHE_MS = 15000;

async function getLock(companyId) {
  const row = await SyncState.findOne({ key: lockKey(companyId) }).lean();
  return {
    desktopOnly: !!row?.value?.desktopOnly,
    changedAt: row?.value?.changedAt || null,
    changedBy: row?.value?.changedBy || null,
  };
}

async function setLock(companyId, desktopOnly, userName = '') {
  const value = { desktopOnly: !!desktopOnly, changedAt: new Date().toISOString(), changedBy: userName || '' };
  await SyncState.findOneAndUpdate(
    { key: lockKey(companyId) },
    { $set: { value, companyId } },
    { upsert: true }
  );
  lockCache.set(String(companyId), { on: value.desktopOnly, at: Date.now() });
  return getLock(companyId);
}

/** Cached for a few seconds — it is checked on every web write. */
async function isLocked(companyId) {
  const k = String(companyId || '');
  if (!k) return false;
  const hit = lockCache.get(k);
  if (hit && Date.now() - hit.at < LOCK_CACHE_MS) return hit.on;
  const { desktopOnly } = await getLock(k);
  lockCache.set(k, { on: desktopOnly, at: Date.now() });
  return desktopOnly;
}

module.exports = { groupCompanyIds, manifest, snapshotPage, applyBatch, getLock, setLock, isLocked };
