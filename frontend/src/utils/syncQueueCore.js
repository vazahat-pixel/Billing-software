/**
 * Pure rules of the offline sync queue (no browser APIs, unit-tested with `node --test`).
 * syncQueue.js does the IndexedDB / network work around these.
 */

export const isLocalId = (id) => typeof id === 'string' && id.startsWith('local-');

/** Fields that only exist on the device copy and must never be sent to the server. */
const DEVICE_ONLY = ['offlinePending', 'offlineDeleted', '_cachedAt', 'localId'];

const DEFAULT_ENDPOINTS = {
  sales: '/sales',
  purchases: '/purchases',
  parties: '/parties',
  items: '/items',
  payments: '/accounting/payments',
  receipts: '/accounting/receipts',
  jobs: '/jobs/issue',
  ledgers: '/accounting/ledgers',
  notes: '/notes',
};

/** Bill-number field per entity, used to tell the user "offline 6 was saved as 7". */
const NUMBER_FIELD = { sales: 'invoiceNo', purchases: 'invoiceNo', jobs: 'jobCardNo' };

/** Replace every local id (strings, {_id}, nested arrays/objects) using `idMap` (local -> server). */
export function remapLocalIds(value, idMap) {
  if (!idMap || idMap.size === 0) return value;
  if (typeof value === 'string') return idMap.has(value) ? idMap.get(value) : value;
  if (Array.isArray(value)) return value.map((v) => remapLocalIds(v, idMap));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = remapLocalIds(v, idMap);
    return out;
  }
  return value;
}

/**
 * Local ids an entry still points at (e.g. a sale for a party created offline). Such an entry must
 * wait until those masters are on the server, or the server would reject the unknown id.
 */
export function pendingLocalRefs(payload, ownId) {
  const found = new Set();
  const OWN_KEYS = new Set(['_id', 'id', 'localId']);
  const walk = (v, key, depth) => {
    if (typeof v === 'string') {
      // Only the entry's own top-level id is not a reference; customerId: { _id: 'local-…' } is.
      if (isLocalId(v) && v !== ownId && !(depth === 1 && OWN_KEYS.has(key))) found.add(v);
    } else if (Array.isArray(v)) {
      v.forEach((x) => walk(x, key, depth));
    } else if (v && typeof v === 'object') {
      Object.entries(v).forEach(([k, x]) => walk(x, k, depth + 1));
    }
  };
  walk(payload, '', 0);
  return [...found];
}

/** Payload as the server should see it: no device-only fields, no local ids as record ids. */
export function cleanPayloadForSend(payload) {
  const out = { ...payload };
  for (const f of DEVICE_ONLY) delete out[f];
  if (isLocalId(out._id)) delete out._id;
  if (isLocalId(out.id)) delete out.id;
  return out;
}

/**
 * The exact request a queued entry replays. New entries carry `endpoint`; older entries saved by
 * earlier versions are routed here (offline receive, contra and journal were queued wrongly).
 */
export function resolveRequest(item) {
  const action = item.action || 'create';
  const payload = item.payload || {};
  const targetId = item.serverId || item.localId;

  if (action === 'delete') {
    return { method: 'delete', url: `${item.endpoint || DEFAULT_ENDPOINTS[item.entityType]}/${targetId}` };
  }

  if (action === 'update') {
    if (item.entityType === 'jobs') {
      return { method: 'put', url: payload.action === 'updateReceive' ? '/jobs/receive' : '/jobs/process', data: cleanPayloadForSend(payload) };
    }
    const base = item.endpoint || DEFAULT_ENDPOINTS[item.entityType];
    if (payload.status && Object.keys(payload).length === 1) {
      return { method: 'put', url: `${base}/${targetId}/status`, data: payload };
    }
    return { method: 'put', url: `${base}/${targetId}`, data: cleanPayloadForSend(payload) };
  }

  // create
  if (item.endpoint) return { method: item.method || 'post', url: item.endpoint, data: cleanPayloadForSend(payload) };

  if (item.entityType === 'jobs' && payload.action === 'updateReceive') {
    // Legacy offline Mill/Job Receive: replay the receive, not a new issue.
    const { action: _a, status: _s, ...rest } = payload;
    const body = { ...rest, jobId: rest.jobId || rest._id || rest.id };
    delete body._id;
    delete body.id;
    return { method: 'post', url: '/jobs/receive', data: cleanPayloadForSend(body) };
  }
  if (item.entityType === 'payments' && payload.voucherType === 'Contra') {
    return { method: 'post', url: '/stage3/journals/contra', data: cleanPayloadForSend(payload) };
  }
  if (item.entityType === 'payments' && payload.voucherType === 'Journal') {
    return { method: 'post', url: '/accounting/journal', data: cleanPayloadForSend(payload) };
  }
  const data = cleanPayloadForSend(payload);
  // A number the device made up (OFF-INV-…, local-…) is sent as is; the server swaps it for the
  // next number of the series (X-Offline-Sync).
  return { method: 'post', url: DEFAULT_ENDPOINTS[item.entityType], data };
}

/** Same key on every attempt, so the server applies the entry exactly once. */
export const idempotencyKeyOf = (item) => String(item.payload?.operationId || item.opKey || item.id);

/** What to do after a failed attempt. */
export function classifyError(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.code;
  if (!err?.response) return 'offline'; // no reply: network down / server unreachable
  if (status === 409 && code === 'IDEMPOTENCY_IN_PROGRESS') return 'retry';
  if (status === 408 || status === 429 || status >= 500) return 'retry';
  return 'rejected'; // the server refused this entry (validation, stock…): needs the user
}

/** "Offline purchase 6 was saved as 7" when the server had to take the next number. */
export function renumberNotice(item, saved) {
  const field = NUMBER_FIELD[item.entityType];
  if (!field || (item.action || 'create') !== 'create' || !saved) return null;
  const before = String(item.payload?.[field] ?? item.payload?.challanNo ?? '').trim();
  const after = String(saved[field] ?? saved.challanNo ?? '').trim();
  if (!after || before === after) return null;
  return { entityType: item.entityType, from: before, to: after };
}
