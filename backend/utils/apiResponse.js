/**
 * Standard API envelope — keep field names stable for frontend.
 * Success: { success, message, data, meta, errors }
 * Error shaped by error.middleware.js
 */
const ok = (res, data = null, message = '', meta = {}, status = 200) =>
  res.status(status).json({
    success: true,
    message,
    data,
    meta,
    errors: [],
  });

const created = (res, data = null, message = 'Created', meta = {}) =>
  ok(res, data, message, meta, 201);

const fail = (res, status, message, { errorCode = 'ERROR', errors = [] } = {}) =>
  res.status(status).json({
    success: false,
    message,
    errorCode,
    errors,
    data: null,
    meta: {},
  });

module.exports = { ok, created, fail };
