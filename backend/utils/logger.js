/**
 * Lightweight structured logger — upgrade to Winston/Pino later without API churn.
 */
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const current = levels[process.env.LOG_LEVEL || 'info'] ?? 2;

const stamp = () => new Date().toISOString();

const write = (level, message, meta) => {
  if ((levels[level] ?? 9) > current) return;
  const payload = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line = `[${stamp()}] [${level.toUpperCase()}] ${message}${payload}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

module.exports = {
  error: (msg, meta = {}) => write('error', msg, meta),
  warn: (msg, meta = {}) => write('warn', msg, meta),
  info: (msg, meta = {}) => write('info', msg, meta),
  debug: (msg, meta = {}) => write('debug', msg, meta),
};
