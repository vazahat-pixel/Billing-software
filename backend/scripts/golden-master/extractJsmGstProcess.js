/**
 * Read-only golden data for the GSTIN Process / JobWork receipt screens: rows of JSM_VW_GST_PROCESS_RECEIPT_SUMMARY and
 * JSM_VW_GST_JOBWORK_RECEIPT_SUMMARY plus JSM's own SUM per BOOK.
 *   node scripts/golden-master/extractJsmGstProcess.js --server .\JSMR2 --db JsmSql2_DEMO2026 --co SC27
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSql2_DEMO2026');
const CO = arg('co', 'SC27');
if (!/^[A-Za-z0-9_]+$/.test(CO)) throw new Error('--co must be alphanumeric');
const SEP = '\u0001';
const s = (c) => `ISNULL(CONVERT(varchar(100), ${c}), '')`;

function rowsOf(sql, cols) {
  const o = execFileSync('sqlcmd', ['-S', SERVER, '-E', '-d', DB, '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${sql}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (/^Msg \d+/m.test(o)) throw new Error(o.split(/\r?\n/).filter(Boolean).pop());
  return o.split(/\r?\n/).filter((l) => l.includes(SEP)).map((l) => Object.fromEntries(l.split(SEP).map((v, i) => [cols[i], v.trim()])));
}

const COLS = ['BOOK', 'PARTY', 'NCBILL_NO', 'BILL_DATE', 'TO_PCS', 'TO_REC_QTY', 'SUB_TOT', 'TDS_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT', 'GSTIN_NO'];
const sel = COLS.map((c) => (c === 'BILL_DATE' ? `CONVERT(varchar(10), ${c}, 120)` : s(c))).join(`+'${SEP}'+`);
const SUMS = ['TO_PCS', 'TO_REC_QTY', 'SUB_TOT', 'TDS_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT'];
const out = { co: CO };
for (const [key, view] of [['process', 'JSM_VW_GST_PROCESS_RECEIPT_SUMMARY'], ['jobwork', 'JSM_VW_GST_JOBWORK_RECEIPT_SUMMARY']]) {
  out[key] = {
    rows: rowsOf(`SELECT ${sel} FROM ${view} WHERE CO_PATH='${CO}'`, COLS),
    sums: rowsOf(`SELECT ${s('BOOK')}+'${SEP}'+${SUMS.map((c) => s(`SUM(${c})`)).join(`+'${SEP}'+`)} FROM ${view} WHERE CO_PATH='${CO}' GROUP BY BOOK`, ['BOOK', ...SUMS]),
  };
}
fs.writeFileSync(path.join(__dirname, '..', '..', 'tests', 'golden', 'fixtures', 'jsm_sc27_gst_process.json'), JSON.stringify(out, null, 1));
console.log('process', out.process.rows.length, out.process.sums.length, '| jobwork', out.jobwork.rows.length, out.jobwork.sums.length);
