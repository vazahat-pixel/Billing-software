/**
 * Read-only: pulls one JSM company's sales/returns/purchases and JSM's own GSTR-1 export into a JSON
 * fixture used by tests/golden/*.test.js. Talks to SQL Server through the sqlcmd CLI (no npm driver),
 * and never writes to JSM or to MongoDB.
 *
 *   node scripts/golden-master/extractJsmFixtures.js --server .\JSMR2 --db JsmSql2_DEMO2026 --co SC27 \
 *     --gstr1 "D:/0JsmGstinCSV/SANCHAL CREATION_24DZPPB8552M2ZS_None_2026_2027_GSTR1_V3_2_2.xlsx"
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSql2_DEMO2026');
const CO = arg('co', 'SC27');
const GSTR1_XLSX = arg('gstr1', '');
const OUT = arg('out', path.join(__dirname, '../../tests/golden/fixtures', `jsm_${CO.toLowerCase()}.json`));
const SEP = '\u0001';

if (!/^[A-Za-z0-9_]+$/.test(CO)) throw new Error('--co must be alphanumeric');

function query(sql, columns) {
  const out = execFileSync('sqlcmd', ['-S', SERVER, '-E', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q', `SET NOCOUNT ON; ${sql}`], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return out.split(/\r?\n/).filter((l) => l.includes(SEP) || (columns.length === 1 && l.trim())).map((line) => {
    const cells = line.split(SEP);
    const row = {};
    columns.forEach((c, i) => {
      const v = (cells[i] ?? '').trim();
      row[c] = v === 'NULL' ? null : v;
    });
    return row;
  });
}

const num = (v) => (v === null || v === '' ? 0 : Number(v));

function select(table, cols, where, order) {
  const sql = `SELECT ${cols.map((c) => (c.includes(' AS ') ? c : `ISNULL(CONVERT(varchar(400), ${c}, 120), '')`)).join(', ')} FROM ${table} WHERE ${where} ORDER BY ${order}`;
  const names = cols.map((c) => (c.includes(' AS ') ? c.split(' AS ')[1].trim() : c.replace(/^[A-Z]\./, '')));
  return query(sql, names);
}

const headerCols = [
  'A.ENT_NO', 'A.BILL_NO', 'A.NCBILL_NO', 'A.BILL_DATE', 'A.TR_CODE', 'A.AC_CODE', 'A.TY_CODE', 'A.SL_STATE_CODE',
  'A.SUB_TOT', 'A.TAXABLE_AMT', 'A.T_ADD', 'A.T_LESS', 'A.FREIGHT', 'A.SGST_AMT', 'A.CGST_AMT', 'A.IGST_AMT',
  'A.CESS_AMT', 'A.TCS_AMT', 'A.ROUND_OFF', 'A.NET_TOT', 'A.STATUS',
];
const itemCols = [
  'A.ENT_NO', 'A.SR_NO', 'A.ITEM_CODE', 'A.UNIT_CODE', 'A.IT_PCS', 'A.IT_QTY', 'A.IT_QTY1', 'A.IT_KGS', 'A.IT_RATE', 'A.IT_AMOUNT',
  'A.FOLD_PER',
  'A.DISC_AMT1', 'A.DIS_AMT1', 'A.DIS_AMT2', 'A.RD_AMT1', 'A.ADD_AMT1', 'A.TOT_GST_P', 'A.SGST_A', 'A.CGST_A',
  'A.IGST_A', 'A.CESS_A', 'A.HSN_CODE',
];

const where = `A.CO_PATH='${CO}'`;
const accounts = Object.fromEntries(select('MST_AC_MAST A',
  ['A.AC_CODE', 'A.AC_NAME', 'A.NW_GST_NO', 'A.STATE_CODE', 'A.ADD_1', 'A.HEAD2'], where, 'A.AC_CODE')
  .map((r) => [r.AC_CODE, r]));
const items = Object.fromEntries(select('MST_IT_MAST A', ['A.ITEM_CODE', 'A.ITEM_NAME', 'A.HSN_CODE'], where, 'A.ITEM_CODE')
  .map((r) => [r.ITEM_CODE, r]));
const units = Object.fromEntries(select('MST_UNIT A', ['A.UNIT_CODE', 'A.UNIT_NAME', 'A.QUC'], where, 'A.UNIT_CODE')
  .map((r) => [r.UNIT_CODE, r]));
const company = query(`SELECT CO_NAME FROM J_COMPANY WHERE CO_PATH='${CO}'`, ['CO_NAME'])[0];

function line(r) {
  const it = items[r.ITEM_CODE] || {};
  const un = units[r.UNIT_CODE] || {};
  return {
    srNo: num(r.SR_NO),
    itemName: it.ITEM_NAME || '',
    hsnCode: r.HSN_CODE || it.HSN_CODE || '',
    unit: un.UNIT_NAME || '',
    quc: un.QUC || '',
    pcs: num(r.IT_PCS),
    qty: num(r.IT_QTY),
    netQty: num(r.IT_QTY1),
    foldPer: num(r.FOLD_PER),
    rate: num(r.IT_RATE),
    amount: num(r.IT_AMOUNT),
    foldAmt: num(r.DISC_AMT1),
    dis1Amt: num(r.DIS_AMT1),
    dis2Amt: num(r.DIS_AMT2),
    rdAmt: num(r.RD_AMT1),
    addAmt: num(r.ADD_AMT1),
    gstPer: num(r.TOT_GST_P),
    cgst: num(r.CGST_A),
    sgst: num(r.SGST_A),
    igst: num(r.IGST_A),
    cess: num(r.CESS_A),
  };
}

function header(r, lines) {
  const party = accounts[r.AC_CODE] || {};
  const book = accounts[r.TR_CODE] || {};
  return {
    entNo: num(r.ENT_NO),
    billNo: num(r.BILL_NO),
    invoiceNo: r.NCBILL_NO || String(r.BILL_NO),
    date: String(r.BILL_DATE).slice(0, 10),
    book: book.AC_NAME || '',
    bookIsChallan: (book.ADD_1 || '').toUpperCase() === 'CHALLAN',
    bookNoGst: (book.HEAD2 || '').toUpperCase() === 'NOGST',
    partyName: party.AC_NAME || '',
    partyGstin: party.NW_GST_NO || '',
    partyStateCode: String(party.STATE_CODE || '').padStart(2, '0'),
    ecomStateCode: num(r.SL_STATE_CODE),
    taxable: num(r.TAXABLE_AMT),
    subTotal: num(r.SUB_TOT),
    tAdd: num(r.T_ADD),
    tLess: num(r.T_LESS),
    cgst: num(r.CGST_AMT),
    sgst: num(r.SGST_AMT),
    igst: num(r.IGST_AMT),
    cess: num(r.CESS_AMT),
    tcs: num(r.TCS_AMT),
    roundOff: num(r.ROUND_OFF),
    net: num(r.NET_TOT),
    status: r.STATUS || '',
    lines: lines.filter((l) => l.ENT_NO === r.ENT_NO).map(line),
  };
}

const salesLines = select('T_SL_ITEM A', itemCols, where, 'A.ENT_NO, A.SR_NO');
const sales = select('T_SALES A', headerCols, where, 'A.BILL_DATE, A.ENT_NO').map((r) => header(r, salesLines));

const retCols = headerCols.filter((c) => !['A.BILL_NO', 'A.STATUS'].includes(c));
const retLines = select('T_SLR_ITEM A', itemCols.filter((c) => !['A.IT_KGS', 'A.IT_QTY1', 'A.FOLD_PER'].includes(c)), where, 'A.ENT_NO, A.SR_NO');
const salesReturns = select('T_SL_RETU A', retCols, where, 'A.BILL_DATE, A.ENT_NO').map((r) => header(r, retLines));

function readGstr1Export(file) {
  if (!file) return null;
  const XLSX = require(path.join(__dirname, '../../../frontend/node_modules/xlsx'));
  const wb = XLSX.readFile(file);
  const sheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: '' })
    .filter((r) => r.some((c) => c !== ''));
  const body = (name, headerRowIdx = 3) => {
    const rows = sheet(name);
    const head = rows[headerRowIdx] || [];
    return rows.slice(headerRowIdx + 1).map((r) => Object.fromEntries(head.map((h, i) => [String(h).trim(), r[i]])));
  };
  return {
    source: path.basename(file),
    b2b: body('b2b,sez,de'),
    b2cl: body('b2cl'),
    b2cs: body('b2cs'),
    cdnr: body('cdnr'),
    cdnur: body('cdnur'),
    hsnB2b: body('hsn(b2b)'),
    hsnB2c: body('hsn(b2c)'),
    docs: body('docs'),
    exemp: body('exemp'),
  };
}

const fixture = {
  source: { server: SERVER, db: DB, coPath: CO, extractedAt: new Date().toISOString() },
  company: { name: company?.CO_NAME || '' },
  sales,
  salesReturns,
  jsmGstr1Export: readGstr1Export(GSTR1_XLSX),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`wrote ${OUT}: ${sales.length} sales, ${salesReturns.length} returns, export=${fixture.jsmGstr1Export ? 'yes' : 'no'}`);
