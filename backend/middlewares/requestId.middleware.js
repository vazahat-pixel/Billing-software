const crypto = require('crypto');

/**
 * Attach X-Request-Id for tracing across logs and responses.
 */
const requestIdMiddleware = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id =
    (typeof incoming === 'string' && incoming.trim()) ||
    (crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

module.exports = requestIdMiddleware;
