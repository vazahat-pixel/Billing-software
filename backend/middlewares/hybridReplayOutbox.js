'use strict';

/**
 * Desktop hybrid: queue a replay of this request so the cloud runs the SAME controller later.
 *
 * Six services (sales, purchase, job, party, item, warehouse) enqueue typed outbox rows that
 * syncPushService applies through their business services. Everything else — receipts, payments,
 * journal, notes, returns, ledgers, and any edit or delete of a bill — has its logic in controllers,
 * so duplicating it on the push side would risk the cloud and the desktop calculating differently.
 *
 * Instead we record the request itself (method, path, body) and the agent replays it against the
 * central API with the user's token. The cloud then runs its own normal controller, so an offline
 * entry lands exactly as if it had been made online.
 *
 * Only the paths listed here are captured; anything already covered by a typed outbox row is
 * deliberately absent, or it would be applied twice.
 */

const syncOutboxService = require('../services/syncOutboxService');

const ID = '[0-9a-fA-F]{24}';

/** method + path patterns to replay, relative to /api. */
const REPLAY_ROUTES = [
  // Cash / bank vouchers and journal — accountingController, no outbox of their own
  ['POST', new RegExp(`^/accounting/payments$`)],
  ['POST', new RegExp(`^/accounting/receipts$`)],
  ['PUT', new RegExp(`^/accounting/payments/${ID}$`)],
  ['POST', new RegExp(`^/accounting/payments/${ID}/reverse$`)],
  ['POST', new RegExp(`^/accounting/journal$`)],
  ['POST', new RegExp(`^/accounting/ledgers$`)],

  // Journal / contra on the stage3 finance routes
  ['POST', new RegExp(`^/stage3/journals$`)],
  ['POST', new RegExp(`^/stage3/journals/contra$`)],
  ['POST', new RegExp(`^/stage3/journals/${ID}/reverse$`)],

  // Debit / credit notes
  ['POST', new RegExp(`^/notes$`)],
  ['PUT', new RegExp(`^/notes/${ID}$`)],
  ['POST', new RegExp(`^/notes/${ID}/reverse$`)],

  // Sales / purchase returns
  ['POST', new RegExp(`^/returns$`)],

  // Edits and deletes of bills — the typed outbox only carries creates
  ['PUT', new RegExp(`^/sales/${ID}$`)],
  ['PUT', new RegExp(`^/sales/${ID}/status$`)],
  ['DELETE', new RegExp(`^/sales/${ID}$`)],
  ['PUT', new RegExp(`^/purchases/${ID}$`)],
  ['PUT', new RegExp(`^/purchases/${ID}/status$`)],
  ['DELETE', new RegExp(`^/purchases/${ID}$`)],
];

function isHybridDesktop() {
  return (
    String(process.env.DESKTOP_HYBRID || '').toLowerCase() === 'true' &&
    String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true'
  );
}

/** The path this request should be replayed at, or null when it is not on the allowlist. */
function replayPathFor(method, url) {
  const path = String(url || '').split('?')[0].replace(/\/+$/, '') || '/';
  for (const [m, re] of REPLAY_ROUTES) {
    if (m === method && re.test(path)) return path;
  }
  return null;
}

/**
 * Enqueues after the response is sent, and only for a 2xx — a request the local API rejected must
 * never be replayed. A failure to enqueue is logged, never allowed to break the local write.
 */
function hybridReplayOutbox(req, res, next) {
  if (!isHybridDesktop()) return next();

  const method = String(req.method || '').toUpperCase();
  const path = replayPathFor(method, req.originalUrl || req.url);
  if (!path) return next();

  // Something the agent itself pushed down must not bounce back up.
  if (String(req.headers['x-from-sync'] || '').toLowerCase() === 'true') return next();

  const body = req.body && typeof req.body === 'object' ? JSON.parse(JSON.stringify(req.body)) : undefined;

  // The id the local API gave a document this request CREATED. Once the replay reaches the cloud,
  // local -> cloud is recorded for it, so a later edit or reverse of the same receipt/note can be
  // rewritten too. Edits and deletes already carry their target in the path, so they get none.
  let createdId = '';
  if (method === 'POST' && !/\/reverse$/.test(path)) {
    const json = res.json.bind(res);
    res.json = (out) => {
      const data = out && typeof out === 'object' ? (out.data ?? out) : null;
      const id = data && typeof data === 'object' ? (data._id || data.id) : null;
      if (id) createdId = String(id);
      return json(out);
    };
  }

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const companyId = req.user?.companyId;
    if (!companyId) return;
    syncOutboxService
      .enqueue({
        companyId,
        userId: req.user?._id || req.user?.id || null,
        deviceId: String(req.headers['x-device-id'] || ''),
        entityType: 'rest',
        entityId: createdId,
        operationType: 'replay',
        payload: { method, path, body },
      })
      .catch((err) => console.warn('[hybridReplayOutbox] enqueue failed:', err.message));
  });

  return next();
}

module.exports = hybridReplayOutbox;
module.exports.replayPathFor = replayPathFor;
module.exports.REPLAY_ROUTES = REPLAY_ROUTES;
