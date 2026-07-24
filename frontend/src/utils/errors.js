/**
 * Map API / business errors to operator-friendly messages.
 * Never show raw Axios / Mongo / stack jargon to end users.
 */

const TECHNICAL =
  /E11000|MongoServerError|Cast to ObjectId|ValidationError|JsonWebToken|TokenExpired|Request failed with status|Network Error|ERR_NETWORK|ETIMEDOUT|ECONNREFUSED|ECONNABORTED|axios|at Object\.|TypeError:|ReferenceError:/i;

const STATUS_MESSAGES = {
  400: 'Please check the details and try again.',
  401: 'Your session expired. Please sign in again.',
  403: 'You do not have permission for this action.',
  404: 'The requested record was not found. Refresh and try again.',
  408: 'Request timed out. Please try again.',
  409: 'This record already exists. Use different details or click New.',
  413: 'The file or data is too large to upload.',
  422: 'Some details are invalid. Please review and correct them.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again.',
  502: 'Server is temporarily unavailable. Please try again.',
  503: 'Service is under maintenance. Please try again shortly.',
  504: 'Server took too long to respond. Please try again.',
};

function firstFieldError(data) {
  if (!Array.isArray(data?.errors) || !data.errors.length) return '';
  const e = data.errors[0];
  return e?.message || e?.msg || '';
}

function looksTechnical(msg) {
  if (!msg || typeof msg !== 'string') return true;
  if (TECHNICAL.test(msg)) return true;
  if (msg.length > 220) return true;
  return false;
}

function sanitizeMessage(msg, fallback) {
  if (!msg || typeof msg !== 'string') return fallback;
  const cleaned = msg.replace(/\s+/g, ' ').trim();
  if (!cleaned || looksTechnical(cleaned)) return fallback;
  return cleaned;
}

export function parseApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return sanitizeMessage(err, fallback);

  // Already mapped
  if (err.friendlyMessage && !looksTechnical(err.friendlyMessage)) {
    return err.friendlyMessage;
  }

  const data = err.response?.data || err.data || {};
  const status = err.response?.status || err.status;
  const code = data.errorCode || data.code || err.code;
  const rawMsg = data.message || data.error || err.message;
  const fieldError = firstFieldError(data);

  const byCode = {
    AUTH_REQUIRED: 'Please sign in again to continue.',
    AUTH_INVALID: 'Your session expired. Please sign in again.',
    FORBIDDEN: 'You do not have permission for this action.',
    SUBSCRIPTION_EXPIRED: 'Your subscription has expired. Please renew to continue.',
    COMPANY_LOCKED: 'This company account is locked. Contact your administrator.',
    VALIDATION_ERROR: sanitizeMessage(rawMsg || fieldError, 'Please check the highlighted fields.'),
    DUPLICATE: 'This record already exists. Please use different details or click New.',
    CONFLICT: sanitizeMessage(rawMsg, 'This record already exists. Please use different details or click New.'),
    NEGATIVE_STOCK: 'Insufficient stock for this transaction.',
    GST_VALIDATION: sanitizeMessage(rawMsg, 'GST validation failed. Check party GSTIN and tax details.'),
    NETWORK_OFFLINE: 'You are offline. Changes will sync when connection returns.',
    TIMEOUT: 'Request timed out. Please try again.',
    NOT_FOUND: 'Record not found. Refresh the list and try again.',
    INTERNAL: 'Something went wrong. Please try again.',
  };

  if (code && byCode[code]) {
    if (
      (code === 'CONFLICT' || code === 'DUPLICATE' || code === 'VALIDATION_ERROR') &&
      rawMsg &&
      !looksTechnical(rawMsg)
    ) {
      return rawMsg;
    }
    return byCode[code];
  }

  if (status === 409) {
    if (rawMsg && !looksTechnical(rawMsg) && rawMsg !== 'Duplicate key conflict') return rawMsg;
    return 'This bill/voucher number already exists. Click New and save again.';
  }

  if (status && STATUS_MESSAGES[status]) {
    if (rawMsg && !looksTechnical(rawMsg) && status < 500) return rawMsg;
    return STATUS_MESSAGES[status];
  }

  if (fieldError && !looksTechnical(fieldError)) return fieldError;

  if (err.message === 'Network Error' || code === 'ERR_NETWORK' || err.isQueueBlocked) {
    return byCode.NETWORK_OFFLINE;
  }
  if (code === 'ECONNABORTED' || /timeout/i.test(String(rawMsg || ''))) {
    return byCode.TIMEOUT;
  }

  const safe = sanitizeMessage(rawMsg, fallback);
  return safe;
}

/** Use when showing any catch() value in UI */
export function toUserMessage(err, fallback) {
  return parseApiError(err, fallback);
}
