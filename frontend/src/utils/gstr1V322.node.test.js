// Run: node --test src/utils/gstr1V322.node.test.js
// GSTR-1 v3.2.2: sheet names and header rows must equal the workbook JSM itself produced
// (D:/0JsmGstinCSV/*GSTR1_V3_2_2.xlsx) when that file is on this machine; data lands from row 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import XLSX from 'xlsx';
import { buildGstr1TemplateWorkbook } from './gstr1TemplateExport.js';

const DIR = 'D:/0JsmGstinCSV';
const file = fs.existsSync(DIR) ? fs.readdirSync(DIR).find((f) => /GSTR1_V3_2_2\.xlsx$/.test(f)) : null;
const aoa = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
const trim = (a) => { const b = [...a]; while (b.length && b[b.length - 1] === '') b.pop(); return b.map(String); };

test('v3.2.2 sheet names and rows 1-4 equal the workbook JSM produced', { skip: !file }, () => {
  const real = XLSX.read(fs.readFileSync(`${DIR}/${file}`), { sheetRows: 5 });
  const ours = buildGstr1TemplateWorkbook({}, 'v3_2_2');
  const expected = real.SheetNames.filter((n) => !/help|master/i.test(n));
  assert.deepEqual(ours.SheetNames, expected);
  for (const n of expected) {
    const r = aoa(real, n);
    const o = aoa(ours, n);
    for (const i of [0, 1, 3]) assert.deepEqual(trim(o[i] || []), trim(r[i] || []), `${n} row ${i + 1}`);
  }
});

test('v3.2.2 fills both HSN sheets from their own data and keeps data on row 5', () => {
  const wb = buildGstr1TemplateWorkbook({
    b2bRows: [{ gstin: '24AAAAA0000A1Z5', invoiceNo: '9', date: '01-May-2026', netAmount: 105, taxRate: 5, taxableAmount: 100 }],
    hsnRows: [{ hsn_sc: '5208', qty: 1, val: 105, rt: 5, txval: 100, camt: 2.5, samt: 2.5 }],
    hsnB2cRows: [{ hsn_sc: '5407', qty: 2, val: 210, rt: 5, txval: 200, camt: 5, samt: 5 }],
  }, 'v3_2_2');
  const b2b = aoa(wb, 'b2b,sez,de');
  assert.equal(b2b[4][b2b[3].indexOf('Invoice Number')], '9');
  assert.equal(aoa(wb, 'hsn(b2b)')[4][0], '5208');
  assert.equal(aoa(wb, 'hsn(b2c)')[4][0], '5407');
});
