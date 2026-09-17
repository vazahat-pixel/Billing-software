/**
 * Guardrails against wiping live tenant data.
 * QA/cleanup scripts MUST call assertDestructiveQaAllowed() before deleteMany / clean.
 */
const mongoose = require('mongoose');

function mongoDbName() {
  try {
    return mongoose.connection?.name || '';
  } catch {
    return '';
  }
}

function mongoHost() {
  try {
    return String(mongoose.connection?.host || '');
  } catch {
    return '';
  }
}

function isAtlasHost(host = mongoHost()) {
  return /mongodb\.net|atlas/i.test(host);
}

function isDisposableDbName(name = mongoDbName()) {
  const n = String(name || '').toLowerCase();
  return (
    n.includes('memory') ||
    n.startsWith('qa_') ||
    n.endsWith('_qa') ||
    n === 'billing_qa' ||
    n === 'billing-software-qa'
  );
}

/**
 * Destructive QA (clean / reset / truncate / delete users) only when explicitly allowed.
 * Blocks by default on Atlas and on the shared `test` database.
 */
function assertDestructiveQaAllowed(action = 'destructive QA') {
  if (String(process.env.ALLOW_DESTRUCTIVE_QA || '').toLowerCase() === 'true') {
    return { allowed: true, reason: 'ALLOW_DESTRUCTIVE_QA=true' };
  }

  const db = mongoDbName();
  const host = mongoHost();

  // In-memory / dedicated QA DB names are OK without the flag
  if (isDisposableDbName(db) && !isAtlasHost(host)) {
    return { allowed: true, reason: `local disposable db=${db}` };
  }

  const err = new Error(
    `[SAFETY] Blocked ${action} on MongoDB "${db}" @ ${host || 'unknown'}. ` +
      'This looks like a shared/live database (e.g. Atlas db "test"). ' +
      'QA clean/reset must never wipe real companies. ' +
      'Use a separate DB (e.g. billing_qa) or set ALLOW_DESTRUCTIVE_QA=true only on a disposable DB.'
  );
  err.code = 'DESTRUCTIVE_QA_BLOCKED';
  throw err;
}

function warnIfSharedLiveDatabase() {
  const db = mongoDbName();
  const host = mongoHost();
  if (!db) return null;

  if (isAtlasHost(host) && (db === 'test' || db === 'billing_software' || !db.includes('qa'))) {
    const msg =
      `MongoDB is Atlas database "${db}". QA scripts and shared "test" DB can delete users/companies. ` +
      'Create a dedicated Atlas DB (e.g. textile_erp_prod) and point MONGO_URI at it. ' +
      'Never run npm run clean / reset / truncate against this URI without ALLOW_DESTRUCTIVE_QA.';
    return msg;
  }
  return null;
}

module.exports = {
  mongoDbName,
  mongoHost,
  isAtlasHost,
  isDisposableDbName,
  assertDestructiveQaAllowed,
  warnIfSharedLiveDatabase,
};
