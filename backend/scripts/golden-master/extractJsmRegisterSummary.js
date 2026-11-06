/**
 * Read-only: golden data for JSM's Sales Summary / Purchase Summary screens
 * (Rpt_SalesRegisterSummary_Report / Rpt_PurchaseRegisterSummary_Report).
 *
 * Replays the SQL the decompiled form builds in btn_screen_Click: both Order By combos become
 * ZGROUP1 / ZGROUP2, the bills are summed over them, and the rows come back in whichever order
 * the screen's own rules give (Month first when a combo is Month; by amount when the Asc/Desc
 * radio is on).
 *
 *   node scripts/golden-master/extractJsmRegisterSummary.js --db JsmSql2_DEMO2026 --co SC27
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSql2_DEMO2026');
const CO = arg('co', 'SC27');
const OUT = arg('out', path.join(__dirname, '../../tests/golden/fixtures', `jsm_${CO.toLowerCase()}_register_summary.json`));
const SEP = '\u0001';
if (!/^[A-Za-z0-9_]+$/.test(CO)) throw new Error('--co must be alphanumeric');

const SQLCMD = [
  'C:\\Program Files (x86)\\Microsoft SQL Server\\100\\Tools\\Binn\\sqlcmd.exe',
  'sqlcmd',
].find((p) => p === 'sqlcmd' || fs.existsSync(p));
if (!SQLCMD) throw new Error('sqlcmd not found');

function query(sql, cols) {
  const out = execFileSync(SQLCMD, ['-S', SERVER, '-E', '-l', '60', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q', `SET NOCOUNT ON; ${sql}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (/^Msg \d+/m.test(out) || /^Sqlcmd: Error/m.test(out)) throw new Error(out);
  return out.split(/\r?\n/).filter((l) => l.includes(SEP)).map((line) => {
    const c = line.split(SEP);
    return Object.fromEntries(cols.map((k, i) => [k, (c[i] ?? '').trim()]));
  });
}

/** JSM column -> the name this software's bill rows use. */
const MAP = {
  BOOK: 'REGISTER', PARTY: 'PARTY', BROKER: 'BROKER', STATION: 'STATION', MAINGROUP: 'MAINGROUP',
  HASTE: 'HASTE', TRANSPORT: 'TRANSPORT', MONTH: 'MONTH', MONTH_NO: 'MONTH_NO', YEAR_NO: 'YEAR_NO',
  BILL_DATE: 'BILL_DATE', SRAL_NO: 'SRAL_NO', NCBILL_NO: 'NCBILL_NO',
  TO_PCS: 'TO_PCS', TO_QTY: 'TO_QTY', TO_QTY1: 'TO_QTY1', SUB_TOT: 'SUB_TOT',
  TAXABLE_AMT: 'TAXABLE_AMT', NET_TOT: 'NET_TOT', T_ADD: 'T_ADD', T_LESS: 'T_LESS',
  SGST_AMT: 'SGST_AMT', CGST_AMT: 'CGST_AMT', IGST_AMT: 'IGST_AMT', TCS_AMT: 'TCS_AMT',
};
const NUMERIC = new Set(['MONTH_NO', 'YEAR_NO', 'TO_PCS', 'TO_QTY', 'TO_QTY1', 'SUB_TOT',
  'TAXABLE_AMT', 'NET_TOT', 'T_ADD', 'T_LESS', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'TCS_AMT']);
const sel = (c) => (c === 'BILL_DATE' ? 'CONVERT(varchar(10), BILL_DATE, 120)' : `ISNULL(CONVERT(varchar(100), ${c}), '')`);

/** JSM's Order By choice -> the view column it groups on. */
const BY = {
  Register: 'A.BOOK', Party: 'A.PARTY', Broker: 'A.BROKER', Station: 'A.STATION',
  MainGroup: 'A.MAINGROUP', Haste: 'A.HASTE', Transport: 'A.TRANSPORT', Month: 'A.MONTH',
  DateWise: 'A.BILL_DATE', None: null,
};

const SUMS = `SUM(A.TO_PCS) AS TO_PCS, SUM(A.TO_QTY) AS TO_QTY, SUM(A.TO_QTY1) AS TO_QTY1,
  SUM(A.SUB_TOT) AS SUB_TOT, SUM(A.TAXABLE_AMT) AS TAXABLE_AMT, SUM(A.NET_TOT) AS NET_TOT,
  SUM(A.T_ADD) AS T_ADD, SUM(A.T_LESS) AS T_LESS`;

const P = { from: arg('from', '2026-04-01'), to: arg('to', '2027-03-31') };
const where = `A.CO_PATH='${CO}' AND A.BILL_DATE >= '${P.from}' AND A.BILL_DATE <= '${P.to}'`;

/** The screen's own ORDER BY, per the decompiled form. */
function orderBy(by1, by2, sort) {
  if (sort === 'asc' || sort === 'desc') return `ZGROUP1, NET_TOT ${sort.toUpperCase()}, ZGROUP2`;
  if (by1 === 'Month') return 'YEAR_NO, MONTH_NO ASC, ZGROUP1';
  if (by2 === 'Month') return 'ZGROUP1, YEAR_NO, MONTH_NO ASC, ZGROUP2';
  return 'ZGROUP1, ZGROUP2, YEAR_NO, MONTH_NO';
}

function summary(view, by1, by2, sort) {
  const g1 = BY[by1];
  const g2 = BY[by2];
  const group = [g1, g2].filter(Boolean).join(', ');
  const cols = ['ZGROUP1', 'ZGROUP2', 'TO_PCS', 'TO_QTY', 'TO_QTY1', 'SUB_TOT', 'TAXABLE_AMT', 'NET_TOT', 'T_ADD', 'T_LESS'];
  return query(`SELECT ZGROUP1, ZGROUP2, TO_PCS, TO_QTY, TO_QTY1, SUB_TOT, TAXABLE_AMT, NET_TOT, T_ADD, T_LESS FROM (
      SELECT ${g1 || "''"} AS ZGROUP1, ${g2 || "''"} AS ZGROUP2,
             MAX(A.YEAR_NO) AS YEAR_NO, MAX(A.MONTH_NO) AS MONTH_NO, ${SUMS}
      FROM ${view} A WHERE ${where}${group ? ` GROUP BY ${group}` : ''}) X
    ORDER BY ${orderBy(by1, by2, sort)}`, cols);
}

const SCREENS = [
  { key: 'sales', view: 'JSM_VW_REGISTER_SALES_SUMMARY' },
  { key: 'purchase', view: 'JSM_VW_REGISTER_PURCHASE_SUMMARY' },
];
/** A spread of the combinations the screen offers, including both Month positions and both sorts. */
const CASES = [
  ['Register', 'None', null], ['Register', 'Month', null], ['Party', 'None', null],
  ['Party', 'Month', null], ['Broker', 'Party', null], ['Station', 'None', null],
  ['MainGroup', 'Party', null], ['Month', 'Party', null], ['Haste', 'None', null],
  ['Transport', 'None', null], ['Register', 'Party', 'asc'], ['Register', 'Party', 'desc'],
];

const out = { co: CO, db: DB, period: P, screens: {} };
for (const s of SCREENS) {
  const jsmCols = Object.keys(MAP);
  const raw = query(`SELECT ${jsmCols.map(sel).join(', ')} FROM ${s.view} A WHERE ${where}`, jsmCols);
  const rows = raw.map((r) => {
    const o = {};
    for (const jsm of jsmCols) o[MAP[jsm]] = NUMERIC.has(jsm) ? Number(r[jsm] || 0) : r[jsm];
    o._lines = [];
    return o;
  });
  const scenarios = CASES.map(([by1, by2, sort]) => ({
    orderBy1: by1, orderBy2: by2, sort, expected: summary(s.view, by1, by2, sort),
  }));
  out.screens[s.key] = { rows, scenarios };
  console.log(s.key.padEnd(10), rows.length, 'bills,', scenarios.length, 'scenarios');
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
