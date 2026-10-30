'use strict';

/**
 * What the desktop app offers the "Import from JSM" screen. Everything is read-only against JSM.
 * The JSM login stays inside this process: callers get an install index, never the password.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const loc = require('./locator');
const { exportQuery } = require('./bcpExport');
const { writePackage, listCompanies } = require('./packageWriter');

let installs = []; // [{ folder, cfg }]
const conn = (cfg, bcp) => ({ bcp, server: cfg.server, user: cfg.user, password: cfg.password });

/** Years that belong together: JSM links each year to the previous / next one (LAST_YR_CO_CODE / NEXT_YR_CO_CODE). */
function groupCompanies(years) {
  const byCode = new Map(years.map((y) => [y.coCode, y]));
  const parent = new Map(years.map((y) => [y.coCode, y.coCode]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const y of years) for (const link of [y.lastYearCoCode, y.nextYearCoCode]) if (link && byCode.has(link)) parent.set(find(link), find(y.coCode));
  const groups = new Map();
  for (const y of years) { const k = find(y.coCode); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(y); }
  return [...groups.values()].map((list) => {
    list.sort((a, b) => String(a.from).localeCompare(String(b.from)));
    return { name: list[list.length - 1].name, years: list };
  });
}

/** Finds JSM, its databases and every company with its years. */
async function detect() {
  const tools = { sqlcmd: loc.findSqlTool('sqlcmd'), bcp: loc.findSqlTool('bcp') };
  if (!tools.bcp) return { ok: false, reason: 'tools', message: 'The SQL Server tools that come with JSM (bcp.exe) were not found on this computer.', installs: [] };
  installs = loc.findJsmInstalls().map((i) => ({ folder: i.folder, cfg: loc.readJsmConfig(i.iniPath) }));
  if (!installs.length) return { ok: false, reason: 'notfound', message: 'JSM was not found on this computer (no Jsm_txt_set.ini). Is JSM installed here?', installs: [] };
  const out = [];
  for (const [index, inst] of installs.entries()) {
    const entry = { index, folder: inst.folder, server: inst.cfg.server, databases: [], error: '' };
    try {
      const dbs = await exportQuery(conn(inst.cfg, tools.bcp), "SELECT name FROM sys.databases WHERE name LIKE 'Jsm%' AND name NOT LIKE 'JsmSet%' ORDER BY name", ['name']);
      for (const d of dbs) {
        try {
          const years = await listCompanies(conn(inst.cfg, tools.bcp), d.name);
          if (years.length) entry.databases.push({ name: d.name, companies: groupCompanies(years) });
        } catch { /* a Jsm database without companies is not a data database */ }
      }
    } catch (e) {
      entry.error = String(e.message).replace(inst.cfg.password || '\u0000', '***').slice(0, 200);
    }
    out.push(entry);
  }
  return { ok: out.some((e) => e.databases.length), installs: out, message: out.some((e) => e.databases.length) ? '' : 'JSM was found but its database could not be opened. Open JSM once so its database service is running, then try again.' };
}

/** Exports the chosen years into a temp package file. onProgress({ table, doneTables, totalTables, rows }). */
async function exportPackage({ install, db, coPaths }, onProgress) {
  const inst = installs[install];
  if (!inst) throw new Error('Run the JSM search first');
  const bcp = loc.findSqlTool('bcp');
  const file = path.join(os.tmpdir(), `jsm_export_${Date.now()}.ndjson.gz`);
  const res = await writePackage(conn(inst.cfg, bcp), db, coPaths, file, onProgress);
  return { file, bytes: fs.statSync(file).size, totalRows: res.totalRows, tables: res.tables };
}

/** One slice of the package for upload. */
function readChunk(file, index, size) {
  if (!String(file).startsWith(os.tmpdir()) || !/jsm_export_\d+\.ndjson\.gz$/.test(file)) throw new Error('Not an export file');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size);
    const n = fs.readSync(fd, buf, 0, size, index * size);
    // A copy of exactly n bytes: a view on the larger buffer crosses IPC with its whole 6 MB backing store.
    const out = new Uint8Array(n);
    out.set(buf.subarray(0, n));
    return out;
  } finally { fs.closeSync(fd); }
}

function removeExport(file) {
  if (/jsm_export_\d+\.ndjson\.gz$/.test(file) && String(file).startsWith(os.tmpdir())) { try { fs.unlinkSync(file); } catch { /* gone */ } }
}

module.exports = { detect, exportPackage, readChunk, removeExport, groupCompanies };
