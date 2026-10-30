'use strict';

/**
 * Read-only probe: finds JSM and the SQL tools on this PC, connects, lists the databases and the companies/years.
 * Usage: node probe.js
 */
const { execFileSync } = require('child_process');
const loc = require('./locator');

function sql(config, tool, db, query) {
  const env = { ...process.env, SQLCMDPASSWORD: config.password };
  return execFileSync(tool, ['-S', config.server, '-U', config.user, ...(db ? ['-d', db] : []), '-h', '-1', '-W', '-s', '|', '-Q', `SET NOCOUNT ON; ${query}`], {
    encoding: 'utf8', env, timeout: 30000, windowsHide: true,
  }).trim();
}

const installs = loc.findJsmInstalls();
console.log('JSM installs found:', installs.map((i) => i.folder));
const sqlcmd = loc.findSqlTool('sqlcmd');
const bcp = loc.findSqlTool('bcp');
console.log('sqlcmd:', sqlcmd, '\nbcp   :', bcp);

for (const inst of installs) {
  const cfg = loc.readJsmConfig(inst.iniPath);
  console.log('\nconfig:', JSON.stringify(loc.describe(cfg)));
  if (!sqlcmd) { console.log('no sqlcmd: cannot read the database'); continue; }
  try {
    console.log('databases:', sql(cfg, sqlcmd, '', "SELECT name FROM sys.databases WHERE name LIKE 'Jsm%'").split(/\r?\n/).join(', '));
  } catch (e) {
    console.log('connect failed:', String(e.message).split('\n')[0]);
  }
}
