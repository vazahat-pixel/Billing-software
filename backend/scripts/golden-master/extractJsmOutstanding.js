/**
 * Read-only: golden data for JSM's Outstanding family (Rpt_Jsm_Os_Sales / _Purchase / _Process /
 * _Jobwork). Pulls each kind's own JSM_VW_OS_<X>_SUMMARY rows, and the order JSM itself lists
 * them in for every Category Wise option, exactly as the decompiled forms build it:
 *
 *   1-Normal      '' AS JS_GROUP            order by A.Q_TYPE, A.BILL_DATE, A.BILL_NO, A.CBILL_NO, A.NCBILL_NO
 *   2-Party       A.PARTY AS JS_GROUP       order by A.PARTY, ...
 *   3-Broker      A.BROKER AS JS_GROUP      order by A.BROKER, A.PARTY, ...
 *   4-City        A.STATION AS JS_GROUP     order by A.STATION, A.PARTY, ...
 *   5-Main Group  A.PARTY_MN_GROUP          order by A.PARTY_MN_GROUP, A.PARTY, ...
 *
 *   node scripts/golden-master/extractJsmOutstanding.js --db JsmSql2_DEMO2026 --co SC27
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSql2_DEMO2026');
const CO = arg('co', 'SC27');
const OUT = arg('out', path.join(__dirname, '../../tests/golden/fixtures', `jsm_${CO.toLowerCase()}_outstanding.json`));
const SEP = '\u0001';
if (!/^[A-Za-z0-9_]+$/.test(CO)) throw new Error('--co must be alphanumeric');

const SQLCMD = [
  'C:\\Program Files (x86)\\Microsoft SQL Server\\100\\Tools\\Binn\\sqlcmd.exe',
  'sqlcmd',
].find((p) => { try { execFileSync(p, ['-?'], { stdio: 'ignore' }); return true; } catch { return false; } });
if (!SQLCMD) throw new Error('sqlcmd not found');

function query(sql, cols) {
  const out = execFileSync(SQLCMD, ['-S', SERVER, '-E', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q', `SET NOCOUNT ON; ${sql}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  // sqlcmd reports some failures as "Sqlcmd: Error:" rather than "Msg nnn" — without this an
  // errored scenario is silently recorded as an empty expected result.
  if (/^Msg \d+/m.test(out) || /^Sqlcmd: Error/m.test(out)) throw new Error(out);
  return out.split(/\r?\n/).filter((l) => l.includes(SEP)).map((line) => {
    const c = line.split(SEP);
    return Object.fromEntries(cols.map((k, i) => [k, (c[i] ?? '').trim()]));
  });
}

/** JSM column -> the name sources/outstanding.js gives it. */
const MAP = {
  Q_TYPE: 'Q_TYPE',
  PARTY: 'PARTY', BROKER: 'BROKER', STATION: 'STATION', PARTY_MN_GROUP: 'MAINGROUP',
  BOOK: 'BOOK', HASTE: 'HASTE', BILL_DATE: 'BILL_DATE', NCBILL_NO: 'NCBILL_NO',
  NET_TOT: 'NET_TOT', ADJUST: 'ADJUST', SLR_AMT: 'GOODS_RTN', TOT_DISC: 'TOT_DISC',
  Q_UNADJ: 'Q_UNADJ', TOT_BALANCE: 'TOT_BALANCE', CO_ENT_NO: '_billId',
};
const NUMERIC = new Set(['NET_TOT', 'ADJUST', 'SLR_AMT', 'TOT_DISC', 'Q_UNADJ', 'TOT_BALANCE']);
const sel = (c) => (c === 'BILL_DATE' ? 'CONVERT(varchar(10), BILL_DATE, 120)' : `ISNULL(CONVERT(varchar(100), ${c}), '')`);

/**
 * Q_TYPE is JSM's row kind (the bill itself vs an adjustment line booked against it), and it is
 * part of the sort on every category except Main Group — where the Sales screen keeps it and the
 * Purchase screen drops it. Reproduced here exactly as each decompiled form has it.
 */
const BILLNO = 'A.BILL_DATE, A.BILL_NO, A.CBILL_NO, A.NCBILL_NO';
const CATS = {
  1: { group: null, order: `A.Q_TYPE, ${BILLNO}` },
  2: { group: 'A.PARTY', order: `A.PARTY, A.Q_TYPE, ${BILLNO}` },
  3: { group: 'A.BROKER', order: `A.BROKER, A.PARTY, A.Q_TYPE, ${BILLNO}` },
  4: { group: 'A.STATION', order: `A.STATION, A.PARTY, A.Q_TYPE, ${BILLNO}` },
  5: { group: 'A.PARTY_MN_GROUP', order: `A.PARTY_MN_GROUP, A.PARTY, {QT}${BILLNO}` },
};

const KINDS = [
  { key: 'sales', view: 'JSM_VW_OS_SALES_SUMMARY', cats: [1, 2, 3, 4, 5], qtypeInMainGroup: true },
  { key: 'purchase', view: 'JSM_VW_OS_PURCHASE_SUMMARY', cats: [1, 2, 3, 4, 5], qtypeInMainGroup: false },
];

/** Not every Outstanding view carries every column (purchase has no SLR_AMT, for one). */
function columnsOf(view) {
  // A second column so every line carries the separator query() splits on.
  const rows = query(`SELECT COLUMN_NAME, '' FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${view}'`, ['COLUMN_NAME', '_']);
  return new Set(rows.map((r) => r.COLUMN_NAME));
}

const out = { co: CO, db: DB, kinds: {} };
for (const k of KINDS) {
  const have = columnsOf(k.view);
  const jsmCols = Object.keys(MAP).filter((c) => have.has(c));
  const raw = query(`SELECT ${jsmCols.map(sel).join(', ')} FROM ${k.view} WHERE CO_PATH='${CO}'`, jsmCols);
  const rows = raw.map((r) => {
    const o = {};
    for (const jsm of jsmCols) o[MAP[jsm]] = NUMERIC.has(jsm) ? Number(r[jsm] || 0) : r[jsm];
    return o;
  });

  const scenarios = [];
  for (const cat of k.cats) {
    const c = CATS[cat];
    const order = c.order.replace('{QT}', k.qtypeInMainGroup ? 'A.Q_TYPE, ' : '');
    const cols = ['JS_GROUP', 'NCBILL_NO', 'BILL_DATE', 'PARTY', 'TOT_BALANCE'];
    scenarios.push({
      category: cat,
      expected: query(`SELECT ${c.group || "''"}, NCBILL_NO, CONVERT(varchar(10), BILL_DATE, 120), PARTY, TOT_BALANCE
        FROM ${k.view} A WHERE A.CO_PATH='${CO}' ORDER BY ${order}`, cols),
    });
  }
  out.kinds[k.key] = { rows, scenarios };
  console.log(k.key.padEnd(10), rows.length, 'bills,', scenarios.length, 'scenarios');
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
