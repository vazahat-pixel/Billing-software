'use strict';

/**
 * Pure rules for rewriting local ids into central ids before a replayed request is sent.
 * No database access here so these can be unit-tested directly; syncIdMapService does the IO.
 *
 * Unlike the browser queue (frontend/src/utils/syncQueueCore.js) a hybrid desktop's local ids are
 * real ObjectIds, indistinguishable by shape from central ones. So we never guess: an id is only
 * rewritten when the map says so, and an operation is only held back when we positively know the
 * referenced document has not reached the cloud yet.
 */

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const isObjectId = (v) => typeof v === 'string' && OBJECT_ID.test(v);

/** Fields that exist only on the device copy and must never be sent. */
const DEVICE_ONLY = ['__v', 'operationId', 'syncVersion', 'localOnly', 'pendingSync'];

/** Every ObjectId-looking string anywhere in `value`. */
function collectIds(value, found = new Set()) {
  if (isObjectId(value)) {
    found.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectIds(v, found);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectIds(v, found);
  }
  return found;
}

/** Replace every id present in `idMap` (local -> server), at any depth. */
function remapIds(value, idMap) {
  if (!idMap || idMap.size === 0) return value;
  if (isObjectId(value)) return idMap.has(value) ? idMap.get(value) : value;
  if (Array.isArray(value)) return value.map((v) => remapIds(v, idMap));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = remapIds(v, idMap);
    return out;
  }
  return value;
}

/** Rewrite the ids embedded in a request path, e.g. /sales/<localId>/status. */
function remapPath(path, idMap) {
  if (!idMap || idMap.size === 0) return path;
  return String(path)
    .split('/')
    .map((seg) => (idMap.has(seg) ? idMap.get(seg) : seg))
    .join('/');
}

/**
 * Ids this operation points at that are known NOT to be on the cloud yet, so the operation has to
 * wait. `unsyncedLocalIds` is the set of local ids with an outbox row that has not synced.
 */
function blockingRefs({ path, body }, idMap, unsyncedLocalIds) {
  if (!unsyncedLocalIds || unsyncedLocalIds.size === 0) return [];
  const ids = collectIds(body);
  for (const seg of String(path).split('/')) if (isObjectId(seg)) ids.add(seg);
  return [...ids].filter((id) => !idMap?.has(id) && unsyncedLocalIds.has(id));
}

/** Body as the cloud should see it. */
function cleanBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const out = { ...body };
  for (const f of DEVICE_ONLY) delete out[f];
  // The cloud derives the tenant from the JWT; a body companyId must never override it.
  delete out.companyId;
  return out;
}

/**
 * The exact request to send for a replay outbox row, with ids rewritten.
 * @returns {{ ready: boolean, waitingOn?: string[], method?: string, path?: string, body?: object }}
 */
function buildReplayRequest(row, idMap, unsyncedLocalIds) {
  const payload = row.payload || {};
  const method = String(payload.method || 'POST').toUpperCase();
  const path = payload.path || '';
  const body = payload.body;

  const waitingOn = blockingRefs({ path, body }, idMap, unsyncedLocalIds);
  if (waitingOn.length) return { ready: false, waitingOn };

  return {
    ready: true,
    method,
    path: remapPath(path, idMap),
    body: method === 'DELETE' ? undefined : remapIds(cleanBody(body), idMap),
  };
}

module.exports = { isObjectId, collectIds, remapIds, remapPath, blockingRefs, cleanBody, buildReplayRequest };
