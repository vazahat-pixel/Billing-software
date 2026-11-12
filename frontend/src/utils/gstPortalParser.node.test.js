import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseGstr1Json, parseGstr1Excel, parseGstr2bExcel } from './gstPortalParser.js';

test('parseGstr1Json extracts B2B and CDNR invoices with tax sums', () => {
  const sample = {
    b2b: [{
      ctin: '24AAAAA0000A1Z5',
      inv: [{ inum: 'INV-1', idt: '05-05-2026', val: 1050, itms: [{ itm_det: { rt: 5, txval: 1000, iamt: 0, camt: 25, samt: 25 } }] }],
    }],
    cdnr: [{
      ctin: '24AAAAA0000A1Z5',
      nt: [{ nt_num: 'CN-1', nt_dt: '10-05-2026', val: 105, itms: [{ itm_det: { rt: 5, txval: 100, iamt: 0, camt: 2.5, samt: 2.5 } }] }],
    }],
  };
  const rows = parseGstr1Json(JSON.stringify(sample));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].INV_NO, 'INV-1');
  assert.equal(rows[0].INV_DT, '2026-05-05');
  assert.equal(rows[0].CGST, 25);
  assert.equal(rows[1].SL_TYPE, 'CDNR');
});

test('parseGstr1Excel and parseGstr2bExcel parse standard portal workbook sheets', () => {
  const wb1 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb1, XLSX.utils.aoa_to_sheet([
    ['Title'], [], [], ['GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Rate', 'Taxable Value'],
    ['24AAAAA0000A1Z5', 'Buyer', 'S-10', '01-06-2026', 1050, 5, 1000],
  ]), 'b2b, sez, de');
  const buf1 = XLSX.write(wb1, { type: 'buffer', bookType: 'xlsx' });
  const r1 = parseGstr1Excel(buf1);
  assert.equal(r1.length, 1);
  assert.equal(r1[0].INV_NO, 'S-10');
  assert.equal(r1[0].TAX_AMT, 1000);

  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([
    [], [], ['GSTIN of supplier', 'Trade/Legal name', 'Invoice number', 'Invoice Date', 'Invoice Value', 'Rate', 'Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax'],
    ['24BBBBB1111B1Z2', 'Mill Co', 'M-5', '02/06/2026', 2100, 5, 2000, 0, 50, 50],
  ]), 'B2B');
  const buf2 = XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' });
  const r2 = parseGstr2bExcel(buf2);
  assert.equal(r2.length, 1);
  assert.equal(r2[0].XINV_NO, 'PU-M-5');
  assert.equal(r2[0].CGST, 50);
});
