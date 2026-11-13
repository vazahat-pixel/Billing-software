/**
 * Read-only golden data for the TDS / TCS registers: the rows of JSM's views for one company plus the result of
 * JSM's own GROUP BY / ORDER BY over them.   node scripts/golden-master/extractJsmTdsTcs.js --server .\JSMR2 --db JsmSql2_DEMO2026 --co SC27
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

function query(sql, cols) {
  const out = execFileSync('sqlcmd', ['-S', SERVER, '-E', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q', `SET NOCOUNT ON; ${sql}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (/^Msg \d+/m.test(out)) throw new Error(out.split(/\r?\n/).filter(Boolean).pop());
  return out.split(/\r?\n/).filter((l) => l.includes(SEP)).map((line) => {
    const c = line.split(SEP);
    return Object.fromEntries(cols.map((k, i) => [k, (c[i] ?? '').trim()]));
  });
}
const s = (c) => `ISNULL(CONVERT(varchar(100), ${c}), '')`;

const TCS_COLS = ['PARTY', 'PANNO', 'YEAR_NO', 'MONTH_NO', 'MONTH', 'TCS_PER', 'TCS_AMT', 'TAXABLE_AMT', 'NET_TOT', 'BILL_DATE', 'NCBILL_NO', 'ENT_NO', 'T_TDS_PER', 'T_TDS_AMT'];
const TDS_COLS = ['PARTY', 'PANNO', 'TDSHEAD', 'YEAR_NO', 'MONTH_NO', 'MONTH', 'ENT_DATE', 'AMOUNT', 'TDS_PER', 'TDS_AMT', 'NCBILL_NO', 'ENT_NO', 'SRAL_NO'];
const out = {
  co: CO,
  tcsSales: null,
  tcsPurchase: null,
};
// TCS rows: build the select with the separator between columns
const sel = (cols, dateCols = []) => cols.map((c) => (dateCols.includes(c) ? `CONVERT(varchar(10), ${c}, 120)` : s(c))).join(`+'${SEP}'+`);
const rowsOf = (sql, cols) => {
  const o = execFileSync('sqlcmd', ['-S', SERVER, '-E', '-d', DB, '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${sql}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (/^Msg \d+/m.test(o)) throw new Error(o.split(/\r?\n/).filter(Boolean).pop());
  return o.split(/\r?\n/).filter((l) => l.includes(SEP)).map((l) => Object.fromEntries(l.split(SEP).map((v, i) => [cols[i], v.trim()])));
};
const tcsFor = (view) => ({
  rows: rowsOf(`SELECT ${sel(TCS_COLS, ['BILL_DATE'])} FROM ${view} WHERE CO_PATH='${CO}'`, TCS_COLS),
  summary: rowsOf(`SELECT ${sel(['MONTH', 'TCSHEAD', 'PARTY', 'TCS_PER'], [])}+'${SEP}'+${s('SUM(TAXABLE_AMT)')}+'${SEP}'+${s('SUM(NET_TOT)')}+'${SEP}'+${s('SUM(TCS_AMT)')} FROM ${view} A WHERE CO_PATH='${CO}' AND (A.TCS_AMT<>0 OR A.T_TDS_AMT<>0) GROUP BY YEAR_NO, MONTH_NO, MONTH, TCSHEAD, PARTY, TCS_PER ORDER BY YEAR_NO, MONTH_NO, TCSHEAD, PARTY`,
  ['MONTH', 'TCSHEAD', 'PARTY', 'TCS_PER', 'TAXABLE_AMT', 'NET_TOT', 'TCS_AMT']),
});
out.tcsSales = tcsFor('JSM_VW_TCS_BOOK');
out.tcsPurchase = tcsFor('JSM_VW_TCS_BOOK_PURCHASE');
out.tds = {
  rows: rowsOf(`SELECT ${sel(TDS_COLS, ['ENT_DATE'])} FROM JSM_VW_TDS_BOOK WHERE CO_PATH='${CO}'`, TDS_COLS),
  summary: rowsOf(`SELECT ${s('MONTH')}+'${SEP}'+${s('TDSHEAD')}+'${SEP}'+${s('PARTY')}+'${SEP}'+${s('TDS_PER')}+'${SEP}'+${s('SUM(AMOUNT)')}+'${SEP}'+${s('SUM(TDS_AMT)')} FROM JSM_VW_TDS_BOOK WHERE CO_PATH='${CO}' GROUP BY YEAR_NO, MONTH_NO, MONTH, TDSHEAD, PARTY, TDS_PER ORDER BY YEAR_NO, MONTH_NO, TDSHEAD, PARTY`,
  ['MONTH', 'TDSHEAD', 'PARTY', 'TDS_PER', 'AMOUNT', 'TDS_AMT']),
};
fs.writeFileSync(path.join(__dirname, '..', '..', 'tests', 'golden', 'fixtures', 'jsm_sc27_tds_tcs.json'), JSON.stringify(out, null, 1));
console.log('tcs sales', out.tcsSales.rows.length, out.tcsSales.summary.length, '| tcs purchase', out.tcsPurchase.rows.length, out.tcsPurchase.summary.length, '| tds', out.tds.rows.length, out.tds.summary.length);
