/**
 * Read-only: JSM "Process Reports › Send" golden data. Pulls the company's JSM_VW_PROCESS_ISSUE rows and
 * the output of JSM's own SQL (as built by Rpt_Process_Issue_Report.btn_screen_Click) for several settings.
 *   node scripts/golden-master/extractJsmProcessSend.js --server .\JSMR2 --db JsmSql2_DEMO2026 --co SC27
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSql2_DEMO2026');
const CO = arg('co', 'SC27');
const OUT = arg('out', path.join(__dirname, '../../tests/golden/fixtures', `jsm_${CO.toLowerCase()}_process_send.json`));
const SEP = '\u0001';
if (!/^[A-Za-z0-9_]+$/.test(CO)) throw new Error('--co must be alphanumeric');

function query(sql, cols) {
  const out = execFileSync('sqlcmd', ['-S', SERVER, '-E', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q', `SET NOCOUNT ON; ${sql}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (/^Msg \d+/m.test(out)) throw new Error(out);
  return out.split(/\r?\n/).filter((l) => l.includes(SEP)).map((line) => {
    const c = line.split(SEP);
    return Object.fromEntries(cols.map((k, i) => [k, (c[i] ?? '').trim()]));
  });
}

const VIEW_COLS = ['BOOK', 'REGISTER', 'MILL', 'PURPARTY', 'ITEM', 'MONTH', 'MONTH_NO', 'YEAR_NO', 'RE_FINISH', 'CHLN_NO',
  'NCCHLN_NO', 'CHLN_DATE', 'ISS_PCS', 'ISS_QTY', 'ISS_KGS', 'PU_RATE', 'PU_AMOUNT', 'LOT_NO', 'REMARK_1', 'REMARK_2', 'PU_BILLNO'];
const sel = (c) => (c === 'CHLN_DATE' ? 'CONVERT(varchar(10), CHLN_DATE, 120)' : `ISNULL(CONVERT(varchar(100), ${c}), '')`);

const rows = query(`SELECT ${VIEW_COLS.map(sel).join(', ')} FROM JSM_VW_PROCESS_ISSUE WHERE CO_PATH='${CO}' ORDER BY ENT_NO`, VIEW_COLS);

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const inList = (field, vals) => (vals && vals.length ? `A.${field} IN (${vals.map(q).join(',')})` : `A.${field} NOT IN ('X9999')`);

function where(p) {
  return [
    `A.CO_PATH IN ('${CO}')`,
    "A.BOOK NOT IN ('X9999')",
    `(A.CHLN_DATE >='${p.from}' AND A.CHLN_DATE <='${p.to}')`,
    inList('MILL', p.mills), inList('PURPARTY', p.purParties), inList('ITEM', p.items),
    inList('REMARK_1', p.remark1), inList('REMARK_2', p.remark2),
    "A.RE_FINISH<>'X'",
  ].join(' AND ');
}

function detail(p) {
  const fix = 'BOOK AS XREGISTER, MILL AS XMILL, PURPARTY AS XPURPARTY, ITEM AS XITEM, CHLN_DATE AS XDateWise, MONTH AS XMONTH';
  const order = [`X${p.orderBy1}`, p.orderBy2 !== 'None' ? `X${p.orderBy2}` : null, 'CHLN_DATE', 'CHLN_NO', 'NCCHLN_NO'].filter(Boolean).join(',');
  const cols = ['NCCHLN_NO', 'CHLN_DATE', 'MILL', 'ITEM', 'PURPARTY', 'ISS_PCS', 'ISS_QTY'];
  return query(`SELECT NCCHLN_NO, CONVERT(varchar(10), CHLN_DATE, 120), MILL, ITEM, PURPARTY, ISS_PCS, ISS_QTY, ${fix}
    FROM JSM_VW_PROCESS_ISSUE A WHERE ${where(p)} ORDER BY ${order}`, cols);
}

function summary(p) {
  const g1 = p.orderBy1;
  const g2 = p.orderBy2;
  const head = g2 === 'None'
    ? `SELECT 'SUMMARY' AS REGISTER,'' AS ZGROUP, ${g1} AS ZGROUP2`
    : `SELECT 'SUMMARY' AS REGISTER, ${g1} AS ZGROUP, ${g2} AS ZGROUP2`;
  const groupBy = g2 === 'None' ? g1 : `${g1},${g2}`;
  const order = g1 === 'Month' ? 'YEAR_NO,MONTH_NO ASC,ZGROUP,ZGROUP2'
    : (g2 === 'Month' ? 'ZGROUP,YEAR_NO,MONTH_NO ASC' : 'ZGROUP,ZGROUP2,YEAR_NO,MONTH_NO ASC');
  const cols = ['ZGROUP', 'ZGROUP2', 'ISS_PCS', 'ISS_QTY', 'PU_AMOUNT', 'AVG_PU_RATE'];
  return query(`SELECT ZGROUP, ZGROUP2, ISS_PCS, ISS_QTY, PU_AMOUNT, AVG_PU_RATE FROM (
    ${head}, MAX(YEAR_NO) AS YEAR_NO, MAX(MONTH_NO) AS MONTH_NO,
    SUM(A.ISS_PCS) AS ISS_PCS, SUM(A.ISS_QTY) AS ISS_QTY, SUM(A.ISS_KGS) AS ISS_KGS, SUM(A.PU_AMOUNT) AS PU_AMOUNT, AVG(A.PU_RATE) AS AVG_PU_RATE
    FROM JSM_VW_PROCESS_ISSUE A WHERE ${where(p)} GROUP BY ${groupBy}) X ORDER BY ${order}`, cols);
}

const base = { from: '2026-04-01', to: '2027-03-31', orderBy2: 'None' };
const scenarios = [
  { name: 'detail register', params: { ...base, orderBy1: 'Register' } },
  { name: 'detail mill + item', params: { ...base, orderBy1: 'Mill', orderBy2: 'Item' } },
  { name: 'detail purparty + month', params: { ...base, orderBy1: 'PurParty', orderBy2: 'Month' } },
  { name: 'detail month + datewise', params: { ...base, orderBy1: 'Month', orderBy2: 'DateWise' } },
  { name: 'detail filtered mill & item', params: { ...base, orderBy1: 'Item', mills: ['SHREE LAV'], items: ['GRAY MICRO', 'BLOUSE'] } },
  { name: 'detail date range', params: { ...base, orderBy1: 'Register', from: '2026-08-01', to: '2026-08-05' } },
  { name: 'summary mill', params: { ...base, orderBy1: 'Mill', summary: true } },
  { name: 'summary item + month', params: { ...base, orderBy1: 'Item', orderBy2: 'Month', summary: true } },
  { name: 'summary month + mill', params: { ...base, orderBy1: 'Month', orderBy2: 'Mill', summary: true } },
].map((s) => {
  try {
    return { ...s, expected: s.params.summary ? summary(s.params) : detail(s.params) };
  } catch (e) {
    // JSM's own query fails for this setting; record SQL Server's message as the expected outcome.
    const lines = String(e.message).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return { ...s, expectedError: lines[lines.length - 1] };
  }
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({ source: { db: DB, coPath: CO }, rows, scenarios }, null, 1)}\n`);
console.log(`wrote ${OUT}: ${rows.length} rows, ${scenarios.length} scenarios (${scenarios.map((s) => (s.expected ? s.expected.length : 'error')).join('/')})`);
