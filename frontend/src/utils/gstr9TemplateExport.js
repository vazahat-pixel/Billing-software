import * as XLSX from 'xlsx';
import templates from './gstr9Templates.json' with { type: 'json' };

/**
 * Multi-sheet GSTR-9 (GSTR_9.xlsx, 25 sheets) and GSTR-9C (GSTR_9C.xlsx, 15 sheets) Excel builders.
 *
 * Preserves exact sheet names, title rows and column headers captured in gstr9Templates.json,
 * writing rows straight into the template's data cells (row 3 in GSTR_9.xlsx and the HSN/rate/exempt
 * sheets of GSTR_9C.xlsx; row 8 at A,B,D,F,H,J,K in the GSTR_9C monthly summary sheets).
 * Sheets JSM builds from data absent in MERN (RCM / ITC journal heads / GST challan) keep their
 * headers untouched rather than being guessed.
 */
const n = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
const dmy = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
};

function appendTotalRow(body, numericCols, labelCol = 0) {
  if (!body.length || !numericCols.length) return body;
  const maxCol = Math.max(labelCol, ...numericCols);
  const tot = new Array(maxCol + 1).fill('');
  tot[labelCol] = 'TOTAL :-';
  for (const c of numericCols) {
    tot[c] = n(body.reduce((s, r) => s + Number(r[c] || 0), 0));
  }
  return [...body, tot];
}

const G9_MAPPERS = {
  bookWise: (rows) => appendTotalRow(
    rows.map((r) => [r.BOOK || '', n(r.NET_TOT), n(r.TAXABLE_AMT), n(r.IGST_AMT), n(r.CGST_AMT), n(r.SGST_AMT), n(r.CESS_AMT), n(r.BILL_AMOUNT), r.MONTH_NAME || '']),
    [1, 2, 3, 4, 5, 6, 7],
  ),
  b2cUnreg: (rows) => appendTotalRow(
    rows.map((r) => [r.TYPE || '', r.PARTY || '', r.NCBILL_NO || '', dmy(r.BILL_DATE), n(r.NET_TOT), r.HSN_CODE || '', r.A_TAX_RATE || '', n(r.SGST_AMT), n(r.CGST_AMT), n(r.IGST_AMT), n(r.TAX_RATE), n(r.TAXABLE_AMT), n(r.CESS_AMOUNT), r.ECOMM || '', r.MONTH_NAME || '']),
    [4, 7, 8, 9, 11, 12],
  ),
  b2cNonGst: (rows) => appendTotalRow(
    rows.map((r) => [r.PARTY || '', r.NCBILL_NO || '', dmy(r.BILL_DATE), n(r.NET_TOT), r.STATE_NAME || '', r.A_TAX_RATE || '', n(r.TAX_RATE), n(r.TAXABLE_AMT), n(r.CESS_AMOUNT), r.ECOMM || '', r.MONTH_NAME || '']),
    [3, 7, 8],
  ),
  b2cHsn: (rows) => appendTotalRow(
    rows.map((r) => [r.HSN_CODE || '', n(r.NET_QTY), n(r.TAXABLE_AMT), n(r.NET_VALUE), n(r.IGST_AMT), n(r.CGST_AMT), n(r.SGST_AMT), r.TYPE || '']),
    [1, 2, 3, 4, 5, 6],
  ),
  note: (rows) => appendTotalRow(
    rows.map((r) => [r.TYPE || '', r.MONTH_NAME || '', r.MONTH_NO || '', n(r.BILL_AMT), n(r.TAXABLE_AMT), n(r.IGST_AMT), n(r.CGST_AMT), n(r.SGST_AMT)]),
    [3, 4, 5, 6, 7],
  ),
  hsn: (rows) => appendTotalRow(
    rows.map((r) => [r.TYPE || '', r.HSN_CODE || '', r.QUC || '', n(r.NET_QTY), n(r.TAXABLE_AMT), n(r.NET_AMOUNT), n(r.IGST_AMT), n(r.CGST_AMT), n(r.SGST_AMT), n(r.TAX_RATE)]),
    [3, 4, 5, 6, 7, 8],
  ),
  rate: (rows) => appendTotalRow(
    rows.map((r) => [n(r.TAX_RATE), n(r.TAXABLE_AMT), n(r.IGST_AMT), n(r.CGST_AMT), n(r.SGST_AMT), n(r.CESS)]),
    [1, 2, 3, 4, 5],
  ),
};

const G9_SHEET_KIND = {
  'SALES - BOOK WISE': 'bookWise',
  'PURCHASE - BOOK WISE': 'bookWise',
  'SL.NONGST': 'bookWise',
  'PU.NONGST': 'bookWise',
  'B2C(UNREG)': 'b2cUnreg',
  'B2C - HSN WISE(UNREG)': 'b2cHsn',
  'B2CREG.NONGST': 'b2cNonGst',
  'B2CHSN.NONGST': 'b2cHsn',
  'CDNR - REG': 'note',
  'CDNR - UNREG': 'note',
  'DBNR - REG': 'note',
  'DBNR - UNREG': 'note',
  'DBCDNR.NONGST': 'note',
  'SALES - HSN WISE': 'hsn',
  'PURCHASE - HSN WISE': 'hsn',
  'SL.HSN.NONGST': 'hsn',
  'PU.HSN.NONGST': 'hsn',
  'SALES TAX RATE WISE': 'rate',
  'PURCHASE - TAXRATE WISE': 'rate',
  'SL.TAX.NONGST': 'rate',
  'PU.TAX.NONGST': 'rate',
};

const g9cSparseRow = (r, includeBook) => {
  const row = new Array(includeBook ? 11 : 10).fill('');
  row[0] = r.MONTH_NAME || '';
  row[1] = n(r.TAXABLE_AMT);
  row[3] = n(r.IGST_AMT);
  row[5] = n(r.CGST_AMT);
  row[7] = n(r.SGST_AMT);
  row[9] = n(r.NET_TOT ?? r.NET_AMOUNT);
  if (includeBook) row[10] = r.BOOK || r.TYPE || '';
  return row;
};

const G9C_MAPPERS = {
  monthlyBook: (rows) => appendTotalRow(rows.map((r) => g9cSparseRow(r, true)), [1, 3, 5, 7, 9]),
  monthlyNote: (rows) => appendTotalRow(rows.map((r) => g9cSparseRow(r, false)), [1, 3, 5, 7, 9]),
  hsn: G9_MAPPERS.hsn,
  rate: G9_MAPPERS.rate,
  exemp: (rows) => appendTotalRow(
    rows.map((r) => [r.TYPE || '', r.MONTH_NAME || '', n(r.TAXABLE_AMT), n(r.SGST_AMT), n(r.CGST_AMT), n(r.IGST_AMT), n(r.NET_TOT ?? r.NET_VALUE)]),
    [2, 3, 4, 5, 6],
  ),
};

const G9C_SHEET_KIND = {
  'OUTWARD SUPPLY - B2B': 'monthlyBook',
  'OUTWARD SUPPLY - B2C': 'monthlyBook',
  'DEBIT NOTE': 'monthlyNote',
  'CREDIT NOTE': 'monthlyNote',
  'OUTWARD SUPPLY - HSN': 'hsn',
  'INWARD SUPPLY - HSN': 'hsn',
  'EXEMP.ALL': 'exemp',
  'SL.TAXRATE': 'rate',
  'PU.TAXRATE': 'rate',
};

function groupRowsBySheet(rows = []) {
  const map = {};
  for (const r of rows) {
    const k = r.SHEET;
    if (!k) continue;
    (map[k] ||= []).push(r);
  }
  return map;
}

export function buildGstr9TemplateWorkbook(rows = [], kind = 'gstr9') {
  const tpl = templates[kind];
  if (!tpl) throw new Error(`Unknown GSTR-9 template kind: ${kind}`);
  const mappers = kind === 'gstr9c' ? G9C_MAPPERS : G9_MAPPERS;
  const kindMap = kind === 'gstr9c' ? G9C_SHEET_KIND : G9_SHEET_KIND;
  const bySheet = Array.isArray(rows) ? groupRowsBySheet(rows) : rows;
  const wb = XLSX.utils.book_new();
  for (const sheet of tpl.sheets) {
    const aoa = sheet.headerRows.map((r) => [...r]);
    const mapper = mappers[kindMap[sheet.name]];
    const sheetRows = bySheet?.[sheet.name] || [];
    if (mapper && sheetRows.length) aoa.push(...mapper(sheetRows));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet.name);
  }
  return wb;
}

export function downloadGstr9TemplateWorkbook(rows, kind = 'gstr9', companyName = '') {
  const wb = buildGstr9TemplateWorkbook(rows, kind);
  const safe = String(companyName || 'Company').replace(/[^\w ]+/g, '').trim() || 'Company';
  XLSX.writeFile(wb, `${safe}_${kind === 'gstr9c' ? 'GSTR_9C' : 'GSTR_9'}.xlsx`);
}

