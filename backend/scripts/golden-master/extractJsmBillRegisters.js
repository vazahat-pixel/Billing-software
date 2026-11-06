/**
 * Read-only: golden data for JSM's four bill registers (Rpt_Jsm_Sales / _Purchase /
 * _Sales_Return / _Purchase_Return).
 *
 * Pulls the company's own JSM_VW_<X>_SMRY / _DTL rows AND the output of JSM's own SQL for each of
 * its three modes and every Category Wise option, exactly as the decompiled form builds them
 * (jsm-blueprint/.spec-local/Rpt_Jsm_Sales.json → Genrate_Reports):
 *
 *   Summary  ("Summary Reports" ticked)  GROUP BY the category, ORDER BY GROUP1,GROUP2
 *   Register ("Summary Reports" unticked) one row per bill,  ORDER BY <group>,BILL_DATE,BILL_NO,CBILL_NO,NCBILL_NO
 *   Detail   (the Detail menu entry)      one row per line,  ... same, then SR_NO
 *
 *   node scripts/golden-master/extractJsmBillRegisters.js --db JsmSql2_DEMO2026 --co SC27
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSql2_DEMO2026');
const CO = arg('co', 'SC27');
const OUT = arg('out', path.join(__dirname, '../../tests/golden/fixtures', `jsm_${CO.toLowerCase()}_bill_registers.json`));
const SEP = '\u0001';
if (!/^[A-Za-z0-9_]+$/.test(CO)) throw new Error('--co must be alphanumeric');

// The tools JSM itself installed first: a newer sqlcmd on PATH does not default to the Windows
// login this instance trusts, and fails with "Login failed for user".
const SQLCMD = [
  'C:\\Program Files (x86)\\Microsoft SQL Server\\100\\Tools\\Binn\\sqlcmd.exe',
  'sqlcmd',
].find((p) => p === 'sqlcmd' || fs.existsSync(p));
if (!SQLCMD) throw new Error('sqlcmd not found');

function query(sql, cols) {
  const out = execFileSync(SQLCMD, ['-S', SERVER, '-E', '-l', '60', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q', `SET NOCOUNT ON; ${sql}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  // sqlcmd reports some failures as "Sqlcmd: Error:" rather than "Msg nnn" — without this an
  // errored scenario is silently recorded as an empty expected result.
  if (/^Msg \d+/m.test(out) || /^Sqlcmd: Error/m.test(out)) throw new Error(out);
  return out.split(/\r?\n/).filter((l) => l.includes(SEP)).map((line) => {
    const c = line.split(SEP);
    return Object.fromEntries(cols.map((k, i) => [k, (c[i] ?? '').trim()]));
  });
}

/**
 * JSM column -> the name this software's register rows use. Only the Sales views carry JSM's own
 * BILL_NO/CBILL_NO pair; Purchase and both Returns sort on SRAL_NO,NCBILL_NO instead (their own
 * `order by` strings in the decompiled forms confirm it).
 */
const HEAD = {
  ENT_NO: 'ENT_NO', SRAL_NO: 'SRAL_NO', NCBILL_NO: 'NCBILL_NO',
  BILL_DATE: 'BILL_DATE', BOOK: 'REGISTER', PARTY: 'PARTY', BROKER: 'BROKER', STATION: 'STATION',
  PARTY_MN_GROUP: 'MAINGROUP', HASTE: 'HASTE', TRANSPORT: 'TRANSPORT',
  TO_PCS: 'TO_PCS', TO_QTY: 'TO_QTY', SUB_TOT: 'SUB_TOT', T_ADD: 'T_ADD', T_LESS: 'T_LESS',
  TAXABLE_AMT: 'TAXABLE_AMT', NET_TOT: 'NET_TOT',
};
const LINE = { SR_NO: 'SR_NO', ITEM_NAME: 'ITEM_NAME', IT_PCS: 'IT_PCS', IT_QTY: 'IT_QTY', IT_RATE: 'IT_RATE', IT_AMOUNT: 'IT_AMOUNT', IT_DISC1: 'IT_DISC1', UNIT_NAME: 'UNIT_NAME' };
const NUMERIC = new Set(['TO_PCS', 'TO_QTY', 'SUB_TOT', 'T_ADD', 'T_LESS', 'TAXABLE_AMT', 'NET_TOT', 'IT_PCS', 'IT_QTY', 'IT_RATE', 'IT_AMOUNT', 'SR_NO', 'BILL_NO', 'ENT_NO']);

const sel = (c) => (c === 'BILL_DATE' ? 'CONVERT(varchar(10), BILL_DATE, 120)' : `ISNULL(CONVERT(varchar(100), ${c}), '')`);
const cast = (o, map) => {
  const out = {};
  for (const [jsm, ours] of Object.entries(map)) out[ours] = NUMERIC.has(jsm) ? Number(o[jsm] || 0) : o[jsm];
  return out;
};

/** The GST total JSM's view splits across the three heads; no register layout shows it. */
const GST = 'ISNULL(SGST_AMT,0)+ISNULL(CGST_AMT,0)+ISNULL(IGST_AMT,0)';

function buildRows(smryView, dtlView) {
  const hCols = Object.keys(HEAD);
  const heads = query(
    `SELECT ${hCols.map(sel).join(', ')}, ${GST} FROM ${smryView} WHERE CO_PATH='${CO}'`,
    [...hCols, 'GST_AMT']
  );
  const lCols = ['ENT_NO', ...Object.keys(LINE)];
  const lines = query(
    `SELECT ${lCols.map(sel).join(', ')} FROM ${dtlView} WHERE CO_PATH='${CO}'`,
    lCols
  );
  const byEnt = new Map();
  for (const l of lines) {
    const k = String(l.ENT_NO);
    if (!byEnt.has(k)) byEnt.set(k, []);
    byEnt.get(k).push(cast(l, LINE));
  }
  return heads.map((h) => {
    const row = cast(h, HEAD);
    row.GST_AMT = Number(h.GST_AMT || 0);
    row.CO_ENT_NO = `${CO}-${h.ENT_NO}`;
    row._lines = (byEnt.get(String(h.ENT_NO)) || []).sort((a, b) => a.SR_NO - b.SR_NO);
    return row;
  });
}

/** JSM's own GROUP1 / GROUP2 expression per Category Wise option. */
const CATS = {
  1: { g1: "''", g2: 'A.BOOK', by: 'A.BOOK', order: 'A.BOOK' },
  2: { g1: "''", g2: 'A.PARTY', by: 'A.PARTY', order: 'A.PARTY' },
  3: { g1: "''", g2: 'A.BROKER', by: 'A.BROKER', order: 'A.BROKER' },
  4: { g1: "''", g2: 'A.STATION', by: 'A.STATION', order: 'A.STATION' },
  5: { g1: 'A.PARTY_MN_GROUP', g2: 'A.PARTY', by: 'A.PARTY_MN_GROUP,A.PARTY', order: 'A.PARTY_MN_GROUP,A.PARTY' },
};
/** The column JSM groups the Register / Detail listing under (JS_GROUP). */
const GROUP_COL = { 1: 'A.BOOK', 2: 'A.PARTY', 3: 'A.BROKER', 4: 'A.STATION', 5: 'A.PARTY_MN_GROUP', 6: 'A.ITEM_NAME', 7: 'A.ITEM_NAME' };

const period = (p) => `(A.BILL_DATE >='${p.from}' AND A.BILL_DATE <='${p.to}')`;
const where = (p) => `A.CO_PATH IN ('${CO}') AND ${period(p)}`;

function summary(view, cat, p) {
  const c = CATS[cat];
  const cols = ['GROUP1', 'GROUP2', 'TO_PCS', 'TO_QTY', 'SUB_TOT', 'T_ADD', 'T_LESS', 'NET_TOT'];
  return query(`SELECT GROUP1, GROUP2, TO_PCS, TO_QTY, SUB_TOT, T_ADD, T_LESS, NET_TOT FROM (
      SELECT ${c.g1} AS GROUP1, ${c.g2} AS GROUP2,
             SUM(A.TO_PCS) AS TO_PCS, SUM(A.TO_QTY) AS TO_QTY, SUM(A.SUB_TOT) AS SUB_TOT,
             SUM(A.T_ADD) AS T_ADD, SUM(A.T_LESS) AS T_LESS, SUM(A.NET_TOT) AS NET_TOT
      FROM ${view} A WHERE ${where(p)} GROUP BY ${c.by}) X ORDER BY GROUP1, GROUP2`, cols);
}

/**
 * JSM's own tie-break: the bill's own number pair, with the party sorted first on the categories
 * whose ORDER BY names it — Broker Wise (`A.BROKER,A.PARTY,…`) and Item+Party (`A.ITEM_NAME,
 * a.PARTY,…`).
 */
const tieBreak = (billPair, cat) => [[3, 7].includes(cat) ? 'A.PARTY' : null, 'A.BILL_DATE', ...billPair]
  .filter(Boolean).join(', ');

function register(view, billPair, cat, p) {
  const cols = ['JS_GROUP', 'NCBILL_NO', 'BILL_DATE', 'PARTY', 'TO_PCS', 'TO_QTY', 'SUB_TOT', 'T_ADD', 'T_LESS', 'NET_TOT'];
  return query(`SELECT ${GROUP_COL[cat]}, NCBILL_NO, CONVERT(varchar(10), BILL_DATE, 120), PARTY,
      TO_PCS, TO_QTY, SUB_TOT, T_ADD, T_LESS, NET_TOT
    FROM ${view} A WHERE ${where(p)}
    ORDER BY ${GROUP_COL[cat]}, ${tieBreak(billPair, cat)}`, cols);
}

function detail(view, billPair, cat, p) {
  const cols = ['JS_GROUP', 'NCBILL_NO', 'BILL_DATE', 'PARTY', 'ITEM_NAME', 'IT_PCS', 'IT_QTY', 'IT_AMOUNT'];
  return query(`SELECT ${GROUP_COL[cat]}, NCBILL_NO, CONVERT(varchar(10), BILL_DATE, 120), PARTY,
      ITEM_NAME, IT_PCS, IT_QTY, IT_AMOUNT
    FROM ${view} A WHERE ${where(p)}
    ORDER BY ${GROUP_COL[cat]}, ${tieBreak(billPair, cat)}, A.SR_NO`, cols);
}

/**
 * The Item Wise Summary screens (Rpt_Jsm_Sales_ItemSummary / _Purchase_ItemSummary) aggregate the
 * same _DTL rows. JSM's own GROUP1/GROUP2/GROUP3 per category, and its AVG_RATE worked out on the
 * summed row with a zero divisor treated as 1.
 */
const ITEM_CATS = {
  1: ["''", 'A.BOOK', "''"],
  2: ["''", 'A.ITEM_NAME', "''"],
  3: ['A.PARTY', 'A.ITEM_NAME', "''"],
  4: ['A.BROKER', 'A.ITEM_NAME', "''"],
  5: ['A.BROKER', 'A.PARTY', 'A.ITEM_NAME'],
  6: ["''", 'A.PARTY', "''"],
  7: ['A.ITEM_NAME', 'A.BOOK', "''"],
  8: ['A.STATION', 'A.ITEM_NAME', "''"],
  9: ['A.BROKER', 'A.PARTY', "''"],
};
const AVG_RATE = `CASE UNIT_NAME WHEN 'PCS' THEN (IT_AMOUNT/CASE IT_PCS WHEN 0 THEN 1 ELSE IT_PCS END)
  ELSE (IT_AMOUNT/CASE IT_QTY WHEN 0 THEN 1 ELSE IT_QTY END) END`;

function itemSummary(view, cat, p) {
  const [g1, g2, g3] = ITEM_CATS[cat];
  const by = [g1, g2, g3].filter((g) => g !== "''").join(', ');
  const cols = ['GROUP1', 'GROUP2', 'GROUP3', 'IT_PCS', 'IT_QTY', 'IT_AMOUNT', 'AVG_RATE'];
  return query(`SELECT GROUP1, GROUP2, GROUP3, IT_PCS, IT_QTY, IT_AMOUNT, ${AVG_RATE} FROM (
      SELECT ${g1} AS GROUP1, ${g2} AS GROUP2, ${g3} AS GROUP3,
             SUM(A.IT_PCS) AS IT_PCS, SUM(A.IT_QTY) AS IT_QTY, SUM(A.IT_AMOUNT) AS IT_AMOUNT,
             MIN(A.UNIT_NAME) AS UNIT_NAME
      FROM ${view} A WHERE ${where(p)}${by ? ` GROUP BY ${by}` : ''}) X
    ORDER BY GROUP1, GROUP2, GROUP3`, cols);
}

const SRAL_PAIR = ['A.SRAL_NO', 'A.NCBILL_NO'];
const REGISTERS = [
  { key: 'sales', smry: 'JSM_VW_SALES_SMRY', dtl: 'JSM_VW_SALES_DTL', cats: [1, 2, 3, 4, 5, 6, 7], pair: ['A.BILL_NO', 'A.CBILL_NO', 'A.NCBILL_NO'] },
  { key: 'purchase', smry: 'JSM_VW_PURCHASE_SMRY', dtl: 'JSM_VW_PURCHASE_DTL', cats: [1, 2, 3, 4, 5, 6], pair: SRAL_PAIR },
  { key: 'salesReturn', smry: 'JSM_VW_SALES1_RETURN_SMRY', dtl: 'JSM_VW_SALES1_RETURN_DTL', cats: [1, 2, 3, 4, 5, 6], pair: SRAL_PAIR },
  { key: 'purchaseReturn', smry: 'JSM_VW_PURCHASE1_RETURN_SMRY', dtl: 'JSM_VW_PURCHASE1_RETURN_DTL', cats: [1, 2, 3, 4, 5, 6], pair: SRAL_PAIR },
];

const P = { from: arg('from', '2026-04-01'), to: arg('to', '2027-03-31') };
const out = { co: CO, db: DB, period: P, registers: {} };

for (const r of REGISTERS) {
  const rows = buildRows(r.smry, r.dtl);
  const scenarios = [];
  for (const cat of r.cats) {
    // Item / Item+Party exist only on the Detail listing — the bill-level SMRY view has no item.
    if (CATS[cat]) scenarios.push({ mode: 'summary', category: cat, expected: summary(r.smry, cat, P) });
    if (CATS[cat]) scenarios.push({ mode: 'register', category: cat, expected: register(r.smry, r.pair, cat, P) });
    scenarios.push({ mode: 'detail', category: cat, expected: detail(r.dtl, r.pair, cat, P) });
  }
  const itemCats = r.key === 'sales' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : (r.key === 'purchase' ? [1, 2, 3, 4, 5] : []);
  const itemScenarios = itemCats.map((cat) => ({ category: cat, expected: itemSummary(r.dtl, cat, P) }));

  out.registers[r.key] = { rows, scenarios, itemScenarios };
  console.log(r.key.padEnd(15), rows.length, 'bills,', scenarios.length, 'scenarios,', itemScenarios.length, 'item-summary');
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
