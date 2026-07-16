/**
 * Blocks QA engine execution in production unless explicitly allowed.
 */
function assertQaAllowed() {
  if (process.env.NODE_ENV === 'production' && process.env.QA_ALLOW !== 'true') {
    throw new Error(
      'QA engine blocked in production. Set QA_ALLOW=true only on dedicated QA infrastructure.'
    );
  }
}

module.exports = { assertQaAllowed };
