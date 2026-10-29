'use strict';

/**
 * Writes the "MERN Migration Package": one gzip file of newline-delimited JSON.
 *   line 1  {"_":"header", format, version, source:"JSM", extractedAt, companies:[...], tables:{name:rowCount}}
 *   then    {"_":"row", "t":"T_SALES", "k":"SC27:T_SALES:1", "r":{...every column as exported...}}
 * The package holds the JSM tables AS THEY ARE (lossless). Turning them into MERN records happens on the
 * server, where it can be fixed and tested without a new desktop release.
 */

const fs = require('fs');
const zlib = require('zlib');
const { exportQuery, exportTable, listColumns } = require('./bcpExport');

const FORMAT = 'mern-migration-package';
const VERSION = 1;

// Tables that are never business data: per-PC scratch grids, caches, temp copies, audit/log, login/settings.
const SKIP_TABLE = /^(TMP_|TEMP_|PC[A-Z0-9_]*_|A_REPORT|A_STOCK|A_TEMP|AA_TEMP|T_TEST|WEB_|XRUNTIME|JSM_VW_|R_LOG|J_LOGIN|J_USER|J_SMS|J_TAXPRO|J_TRANSFER_LOCK|J_FREEZEDATA|J_SQLTABLE|STP_|IMG_|J_AC_MAST$|tmp_)/i;

/** Global tables (no CO_PATH column) that master data refers to. */
const GLOBAL_TABLES = ['MST_ACG_MAST', 'MST_STATE', 'MST_BOOK_MN', 'J_AddLessSetup'];

// Columns that hold logins or passwords (e-way bill / e-invoice / SMS credentials live in J_COMPANY) are never exported.
const SECRET_COLUMN = /(PASS|PWD|USER_?I|E_USER|SECRET|TOKEN|API_?KEY)/i;
const sqlList = (paths) => paths.map((p) => `'${String(p).replace(/'/g, "''")}'`).join(',');

/** User tables of the database that carry a CO_PATH column (= company/year data). */
async function companyTables(conn, db) {
  const rows = await exportQuery(
    conn,
    `SELECT DISTINCT c.TABLE_NAME FROM ${db}.INFORMATION_SCHEMA.COLUMNS c JOIN ${db}.INFORMATION_SCHEMA.TABLES t ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE' WHERE c.COLUMN_NAME = 'CO_PATH' ORDER BY c.TABLE_NAME`,
    ['name'],
  );
  return rows.map((r) => r.name).filter((n) => !SKIP_TABLE.test(n));
}

/** The company-years in the database (J_COMPANY), newest data last. */
async function listCompanies(conn, db) {
  const rows = await exportTable(conn, db, 'J_COMPANY');
  return rows.map((r) => ({
    coPath: r.CO_PATH,
    coCode: Number(r.CO_CODE),
    name: r.CO_NAME,
    gstin: r.CO_GST_NO || r.CO_GSTIN || '',
    from: (r.CO_FR_DATE || '').slice(0, 10),
    to: (r.CO_TO_DATE || '').slice(0, 10),
    lastYearCoCode: Number(r.LAST_YR_CO_CODE) || 0,
    nextYearCoCode: Number(r.NEXT_YR_CO_CODE) || 0,
  }));
}

/**
 * Exports every company table for the chosen CO_PATHs (plus the global tables) into `outFile`.
 * onProgress({ table, rows, doneTables, totalTables }) is called after each table.
 * Returns { tables: {name: rows}, totalRows }.
 */
async function writePackage(conn, db, coPaths, outFile, onProgress = () => {}) {
  if (!coPaths?.length) throw new Error('Choose at least one company/year');
  const companies = (await listCompanies(conn, db)).filter((c) => coPaths.includes(c.coPath));
  if (!companies.length) throw new Error('The chosen company/year was not found in J_COMPANY');

  const names = await companyTables(conn, db);
  const all = [...names.map((n) => ({ name: n, global: false })), ...GLOBAL_TABLES.map((n) => ({ name: n, global: true }))];

  const gz = zlib.createGzip({ level: 6 });
  const file = fs.createWriteStream(outFile);
  gz.pipe(file);
  let failure = null;
  gz.on('error', (e) => { failure = e; });
  file.on('error', (e) => { failure = e; });
  const write = (obj) => new Promise((resolve, reject) => {
    if (failure) return reject(failure);
    const ok = gz.write(`${JSON.stringify(obj)}\n`, (err) => { if (err) reject(err); });
    if (ok) return resolve();
    return gz.once('drain', resolve); // wait for the compressor, so a large table never piles up in memory
  });

  const counts = {};
  let totalRows = 0;
  let done = 0;
  // header first (table counts are filled in a trailer line, as they are only known at the end)
  await write({ _: 'header', format: FORMAT, version: VERSION, source: 'JSM', extractedAt: new Date().toISOString(), db, companies });

  for (const t of all) {
    const where = t.global ? '' : `CO_PATH IN (${sqlList(coPaths)})`;
    let rows = [];
    try {
      rows = await exportTable(conn, db, t.name, where);
      for (const r of rows) for (const c of Object.keys(r)) if (SECRET_COLUMN.test(c)) delete r[c];
    } catch (err) {
      if (!/not found/.test(err.message)) throw err;
    }
    counts[t.name] = rows.length;
    for (const r of rows) {
      const key = t.global ? `${t.name}` : `${String(r.CO_PATH || '').trim()}:${t.name}`;
      await write({ _: 'row', t: t.name, k: key, r });
    }
    totalRows += rows.length;
    done += 1;
    onProgress({ table: t.name, rows: rows.length, doneTables: done, totalTables: all.length });
  }
  await write({ _: 'trailer', tables: counts, totalRows });

  await new Promise((resolve, reject) => {
    file.on('finish', resolve);
    file.on('error', reject);
    gz.end();
  });
  return { tables: counts, totalRows };
}

module.exports = { writePackage, listCompanies, companyTables, listColumns, FORMAT, VERSION, SKIP_TABLE, GLOBAL_TABLES };
