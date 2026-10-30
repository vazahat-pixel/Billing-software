'use strict';

/**
 * Finds a JSM installation on this PC and the SQL Server command-line tools it needs. Read-only:
 * nothing is written, no JSM file is changed. The JSM login (from Jsm_txt_set.ini) stays in memory;
 * callers must never log, store or upload it (use describe() for anything that is printed).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** key=value lines of the ini, keys upper-cased. */
function parseIni(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1].toUpperCase()] = m[2];
  }
  return out;
}

/** Connection details from the ini ('.\\jsmr2' style servers are kept as written). */
function readJsmConfig(iniPath) {
  const ini = parseIni(fs.readFileSync(iniPath, 'latin1'));
  return {
    iniPath,
    folder: path.dirname(iniPath),
    server: ini.SERVERNAME || '.\\JSMR2',
    db: ini.DB || '',
    dbSet: ini.DBSET || '',
    user: ini.USER || '',
    password: ini.PASS || '', // never print
    backupDrive: ini.BACKUP_DRIVE || '',
    dataPath: ini.PATH || '',
    network: /^yes$/i.test(ini.NETWORK || ''),
  };
}

/** Same as the config but safe to show or log (password removed). */
function describe(config) {
  const { password, ...safe } = config || {};
  return { ...safe, hasPassword: !!password };
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function driveRoots() {
  const roots = [];
  for (let c = 67; c <= 90; c += 1) { // C..Z
    const r = `${String.fromCharCode(c)}:\\`;
    if (exists(r)) roots.push(r);
  }
  return roots;
}

/** Folder of a running Jsm_Winsoft.exe, if JSM is open right now. */
function runningJsmFolder() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "(Get-Process -Name Jsm_Winsoft -ErrorAction SilentlyContinue | Select-Object -First 1).Path",
    ], { encoding: 'utf8', timeout: 8000, windowsHide: true }).trim();
    return out ? path.dirname(out) : null;
  } catch {
    return null;
  }
}

/**
 * Every folder that holds JSM's ini: the running program's folder first, then a shallow scan
 * (drive root and one level below) for Jsm_txt_set.ini / Jsm_Winsoft.exe.
 */
function findJsmInstalls({ extraFolders = [] } = {}) {
  const seen = new Set();
  const found = [];
  const consider = (folder) => {
    if (!folder) return;
    const ini = path.join(folder, 'Jsm_txt_set.ini');
    if (!exists(ini)) return;
    const key = ini.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ folder, iniPath: ini, hasProgram: exists(path.join(folder, 'Jsm_Winsoft.exe')) });
  };

  consider(runningJsmFolder());
  extraFolders.forEach(consider);

  for (const root of driveRoots()) {
    consider(root);
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { /* unreadable drive */ }
    for (const e of entries) {
      if (!e.isDirectory() || /^(windows|program files|program files \(x86\)|programdata|\$recycle\.bin|system volume information|users)$/i.test(e.name)) continue;
      consider(path.join(root, e.name));
    }
  }
  return found;
}

/** sqlcmd.exe / bcp.exe: PATH first, then the standard SQL Server tools folders (newest version first). */
function findSqlTool(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    const p = path.join(d, exe);
    if (exists(p)) return p;
  }
  const bases = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean)
    .map((b) => path.join(b, 'Microsoft SQL Server'));
  const candidates = [];
  for (const base of bases) {
    let versions = [];
    try { versions = fs.readdirSync(base); } catch { /* none */ }
    for (const v of versions) {
      const p = path.join(base, v, 'Tools', 'Binn', exe);
      if (exists(p)) candidates.push({ v: Number(v) || 0, p });
      const p2 = path.join(base, 'Client SDK', 'ODBC', v, 'Tools', 'Binn', exe);
      if (exists(p2)) candidates.push({ v: Number(v) || 0, p: p2 });
    }
  }
  candidates.sort((a, b) => b.v - a.v);
  return candidates[0]?.p || null;
}

module.exports = { parseIni, readJsmConfig, describe, findJsmInstalls, findSqlTool, runningJsmFolder };
