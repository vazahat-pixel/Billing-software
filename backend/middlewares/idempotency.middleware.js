const IdempotencyRecord = require('../models/IdempotencyRecord');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// A crashed first attempt leaves a 'pending' record; after this long a retry may take it over.
const STALE_PENDING_MS = 10 * 60 * 1000;

/**
 * Exactly-once writes for requests that carry an Idempotency-Key header (the offline sync queue
 * sends one per queued entry). Runs after auth, so keys are scoped to the caller's company.
 *  - first request: runs normally; a 2xx reply is stored, any other reply frees the key for a retry
 *  - repeat after success: the stored reply is returned, nothing is written again
 *  - repeat while the first is still running: 409 IDEMPOTENCY_IN_PROGRESS (client retries later)
 * Requests without the header are untouched.
 */
async function idempotency(req, res, next) {
  const key = String(req.headers['idempotency-key'] || '').trim();
  if (!key || key.length > 200 || !WRITE_METHODS.has(req.method) || !req.companyId) return next();

  const scope = { companyId: String(req.companyId), key };
  const method = req.method;
  const path = req.originalUrl.split('?')[0];
  let record;
  try {
    record = await IdempotencyRecord.create({ ...scope, method, path, state: 'pending' });
  } catch (err) {
    if (err?.code !== 11000) return next(err);
    const existing = await IdempotencyRecord.findOne(scope).lean();
    if (!existing) return next(); // expired between the two calls — treat as new below on retry
    if (existing.method !== method || existing.path !== path) {
      return res.status(422).json({
        success: false,
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This Idempotency-Key was already used for a different request.',
      });
    }
    if (existing.state === 'done') {
      res.set('Idempotent-Replay', 'true');
      return res.status(existing.status || 200).json(existing.body);
    }
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age < STALE_PENDING_MS) {
      return res.status(409).json({
        success: false,
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'This entry is already being saved. It will be retried automatically.',
      });
    }
    record = await IdempotencyRecord.findOneAndUpdate(
      { _id: existing._id, state: 'pending', createdAt: existing.createdAt },
      { $set: { createdAt: new Date() } },
      { new: true }
    );
    if (!record) {
      return res.status(409).json({ success: false, code: 'IDEMPOTENCY_IN_PROGRESS', message: 'Retry shortly.' });
    }
  }

  let settled = false;
  const settle = (status, body) => {
    if (settled) return;
    settled = true;
    if (status >= 200 && status < 300) {
      const snapshot = body === undefined ? null : JSON.parse(JSON.stringify(body));
      IdempotencyRecord.updateOne({ _id: record._id }, { $set: { state: 'done', status, body: snapshot } }).catch(() => {});
    } else {
      IdempotencyRecord.deleteOne({ _id: record._id }).catch(() => {});
    }
  };
  const json = res.json.bind(res);
  res.json = (body) => {
    settle(res.statusCode, body);
    return json(body);
  };
  // Settles from the handler's own reply even if the client has already disconnected: a write that
  // committed must be remembered, or the retry after a dropped connection would save it twice.
  res.on('finish', () => settle(res.statusCode, undefined));
  return next();
}

module.exports = idempotency;
