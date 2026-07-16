const fs = require('fs');
const path = require('path');

let logFile = null;

function initLogger(outputDir) {
  if (!outputDir) return;
  fs.mkdirSync(outputDir, { recursive: true });
  logFile = path.join(outputDir, 'qa.log');
}

function write(level, msg, meta = {}) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}${
    Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  }`;
  if (level === 'error') console.error(line);
  else console.log(line);
  if (logFile) {
    fs.appendFileSync(logFile, `${line}\n`);
  }
}

module.exports = {
  initLogger,
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
