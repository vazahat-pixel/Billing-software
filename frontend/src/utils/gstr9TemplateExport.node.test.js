import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import XLSX from 'xlsx';
import { buildGstr9TemplateWorkbook } from './gstr9TemplateExport.js';

const aoa = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });

test('GSTR_9 workbook writes rows below exact template header row and appends TOTAL row', () => {
  const wb = buildGstr9TemplateWorkbook([
    { SHEET: 'SALES - BOOK WISE', BOOK: 'LOCAL SALES', NET_TOT: 1050, TAXABLE_AMT: 1000, IGST_AMT: 0, CGST_AMT: 25, SGST_AMT: 25, CESS_AMT: 0, BILL_AMOUNT: 50, MONTH_NAME: 'April' },
  ], 'gstr9');
  assert.equal(wb.SheetNames.length, 25);
  const rows = aoa(wb, 'SALES - BOOK WISE');
  assert.equal(rows[1][0], 'BOOK NAME');
  assert.equal(rows[2][0], 'LOCAL SALES');
  assert.equal(rows[2][2], 1000);
  assert.equal(rows[3][0], 'TOTAL :-');
  assert.equal(rows[3][2], 1000);
});

test('GSTR_9C workbook places monthly data in sparse A,B,D,F,H,J,K columns at row 8', () => {
  const wb = buildGstr9TemplateWorkbook([
    { SHEET: 'OUTWARD SUPPLY - B2B', MONTH_NAME: 'April', TAXABLE_AMT: 2000, IGST_AMT: 100, CGST_AMT: 0, SGST_AMT: 0, NET_TOT: 2100, BOOK: 'IGST SALES' },
  ], 'gstr9c');
  assert.equal(wb.SheetNames.length, 15);
  const rows = aoa(wb, 'OUTWARD SUPPLY - B2B');
  assert.equal(rows[7][0], 'April');
  assert.equal(rows[7][1], 2000);
  assert.equal(rows[7][3], 100);
  assert.equal(rows[7][9], 2100);
  assert.equal(rows[7][10], 'IGST SALES');
});

for (const [kind, file] of [['gstr9', 'GSTR_9'], ['gstr9c', 'GSTR_9C']]) {
  const path = `D:/JsmAccount_TextDemo/JS_Reports_Cry/${file}.xlsx`;
  test(`${kind}: sheet names and header rows match real ${file}.xlsx`, { skip: !fs.existsSync(path) }, () => {
    const real = XLSX.read(fs.readFileSync(path));
    const ours = buildGstr9TemplateWorkbook([], kind);
    assert.deepEqual(ours.SheetNames, real.SheetNames);
    const trim = (a) => { const b = [...a]; while (b.length && b[b.length - 1] === '') b.pop(); return b.map(String); };
    for (const s of real.SheetNames) {
      const rRows = aoa(real, s);
      const oRows = aoa(ours, s);
      for (let i = 0; i < oRows.length; i++) {
        assert.deepEqual(trim(oRows[i]), trim(rRows[i] || []), `${s} header row ${i}`);
      }
    }
  });
}

