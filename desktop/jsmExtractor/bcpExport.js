'use strict';

/**
 * Exports the result of one SELECT with bcp (the bulk tool that ships with SQL Server) to a UTF-16 text
 * file and parses it back into rows. Read-only: only SELECTs are ever passed in.
 * Terminators are strings that cannot occur in real data, so addresses with line breaks stay intact.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

// Plain ASCII on purpose: the Windows command line does not carry odd symbols or line breaks reliably,
// and nobody types these into an address or a name.
const FIELD = '<~F~>';
const ROW = '<~R~>';

function runBcp({ bcp, server, user, password, query, outFile, timeoutMs = 10 * 60 * 1000 }) {
  // bcp has no environment variable for the password, so it is passed as an argument (not through a shell).
  const args = [query, 'queryout', outFile, '-S', server, '-U', user, '-P', password, '-w', '-t', FIELD, '-r', ROW];
  return new Promise((resolve, reject) => {
    execFile(bcp, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = `${stdout || ''}${stderr || ''}`.replace(password, '***').trim().split(/\r?\n/).slice(0, 4).join(' | ');
        return reject(new Error(`bcp failed: ${msg || err.message}`));
      }
      return resolve(stdout);
    });
  });
}

/** Parses a bcp -w file: UTF-16LE text, fields separated by FIELD, rows by ROW. */
function parseBcpFile(file, columns) {
  const buf = fs.readFileSync(file);
  const start = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe ? 2 : 0;
  const text = buf.toString('utf16le', start);
  const rows = [];
  const rowSep = ROW;
  let pos = 0;
  while (pos < text.length) {
    const end = text.indexOf(rowSep, pos);
    if (end < 0) break;
    const parts = text.slice(pos, end).split(FIELD);
    const obj = {};
    // bcp writes an empty string as a single NUL; fixed-width char columns come space-padded (SQL ignores that padding)
    columns.forEach((c, i) => { obj[c] = parts[i] === undefined ? null : parts[i].replace(/\u0000/g, '').replace(/\s+$/, ''); });
    rows.push(obj);
    pos = end + rowSep.length;
  }
  return rows;
}

/**
 * Runs the query and returns an array of objects. `columns` are the column names in SELECT order.
 * NULLs come back as empty strings in bcp text files, which is what the old data means anyway.
 */
async function exportQuery(conn, query, columns) {
  const outFile = path.join(os.tmpdir(), `jsm_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}.dat`);
  try {
    await runBcp({ ...conn, query, outFile });
    return parseBcpFile(outFile, columns);
  } finally {
    try { fs.unlinkSync(outFile); } catch { /* already gone */ }
  }
}

/** Column names of a table in the order SELECT * returns them. */
async function listColumns(conn, db, table) {
  const rows = await exportQuery(conn, `SELECT COLUMN_NAME FROM ${db}.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' ORDER BY ORDINAL_POSITION`, ['name']);
  return rows.map((r) => r.name);
}

/** SELECT every column of a table (optionally filtered) -> array of objects with the real column names. */
async function exportTable(conn, db, table, where = '') {
  const columns = await listColumns(conn, db, table);
  if (!columns.length) throw new Error(`table ${table} not found in ${db}`);
  const list = columns.map((c) => `[${c}]`).join(', ');
  return exportQuery(conn, `SELECT ${list} FROM ${db}.dbo.[${table}]${where ? ` WHERE ${where}` : ''}`, columns);
}

module.exports = { exportQuery, exportTable, listColumns, runBcp, parseBcpFile, FIELD, ROW };
