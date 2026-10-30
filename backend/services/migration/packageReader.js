'use strict';

/**
 * Reads a "MERN Migration Package" (gzip NDJSON, see desktop/jsmExtractor/packageWriter.js) and checks it is
 * complete before anything is imported: a header first, a trailer last, and the number of rows read for
 * every table equal to what the trailer says was exported. A package cut off by a dropped upload fails here.
 */

const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const FORMAT = 'mern-migration-package';
const SUPPORTED_VERSIONS = [1];

class PackageError extends Error {}

/**
 * Streams the file; every data row goes to onRow({ t, k, r }). Returns { header, trailer, counts, problems }.
 * `problems` is empty for a good package. Nothing is thrown for content problems, only for unreadable files.
 */
async function scanPackage(file, onRow = () => {}) {
  const input = fs.createReadStream(file).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let header = null;
  let trailer = null;
  let lineNo = 0;
  const counts = {};
  const problems = [];

  try {
    for await (const line of rl) {
      lineNo += 1;
      if (!line.trim()) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { problems.push(`line ${lineNo} is not valid JSON`); continue; }
      if (lineNo === 1) {
        if (obj._ !== 'header') problems.push('the first line is not a package header');
        else header = obj;
        continue;
      }
      if (obj._ === 'row') {
        counts[obj.t] = (counts[obj.t] || 0) + 1;
        await onRow({ t: obj.t, k: obj.k, r: obj.r });
      } else if (obj._ === 'trailer') {
        trailer = obj;
      } else {
        problems.push(`line ${lineNo} has an unknown record type`);
      }
    }
  } catch (err) {
    // gzip cut short (an upload that stopped half way) surfaces here
    problems.push(`the file could not be read to the end (${err.message})`);
  }

  if (!header) problems.push('the package header is missing');
  else {
    if (header.format !== FORMAT) problems.push(`not a ${FORMAT} file`);
    if (!SUPPORTED_VERSIONS.includes(header.version)) problems.push(`package version ${header.version} is not supported`);
  }
  if (!trailer) problems.push('the package trailer is missing (the file is incomplete)');
  else {
    const exported = trailer.tables || {};
    for (const [table, n] of Object.entries(exported)) {
      if ((counts[table] || 0) !== n) problems.push(`table ${table}: ${counts[table] || 0} rows read, ${n} exported`);
    }
    for (const table of Object.keys(counts)) {
      if (!(table in exported)) problems.push(`table ${table} has rows but is not listed in the trailer`);
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total !== trailer.totalRows) problems.push(`${total} rows read, ${trailer.totalRows} exported`);
  }
  return { header, trailer, counts, problems };
}

/** Loads a (small / medium) package completely: { header, tables: { NAME: [row, ...] } }. Throws PackageError if incomplete. */
async function loadPackage(file) {
  const tables = {};
  const result = await scanPackage(file, ({ t, r }) => { (tables[t] ||= []).push(r); });
  if (result.problems.length) throw new PackageError(result.problems.join('; '));
  return { header: result.header, trailer: result.trailer, tables };
}

module.exports = { scanPackage, loadPackage, PackageError, FORMAT, SUPPORTED_VERSIONS };
