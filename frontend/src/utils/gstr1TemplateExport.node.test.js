// Run: node --test src/utils/gstr1TemplateExport.node.test.js
// The workbook must carry, per template version, exactly the template's own sheets, header rows and
// column set — checked against the real offline-utility templates when they are on this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import XLSX from 'xlsx';
import { buildGstr1TemplateWorkbook, GSTR1_TEMPLATE_VERSIONS } from './gstr1TemplateExport.js';

const DATA = {
  b2bRows: [{ gstin: '24AAAAA0000A1Z5', partyName: 'P', invoiceNo: '1', date: '01-May-2026', netAmount: 105, stateName: '24-Gujarat', taxRate: 5, taxableAmount: 100, cess: 0 }],
  hsnRows: [{ hsn_sc: '5208', desc: 'x', uqc: 'MTR', qty: 10, val: 105, rt: 5, txval: 100, iamt: 0, camt: 2.5, samt: 2.5, csamt: 0 }],
};
const aoa = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
const FILES = { v1_7: 'GSTR1_V1.7', v1_9: 'GSTR1_V1.9', v2_0: 'GSTR1_V2_0' };

test('v1.7 HSN has no Rate column; v1.9 and v2.0 do', () => {
  const cols = (v) => aoa(buildGstr1TemplateWorkbook(DATA, v), 'hsn')[3];
  assert.ok(!cols('v1_7').includes('Rate'));
  assert.ok(cols('v1_9').includes('Rate'));
  assert.ok(cols('v2_0').includes('Rate'));
});

test('data lands from row 5 under the right header, and totals are filled', () => {
  for (const v of GSTR1_TEMPLATE_VERSIONS) {
    const wb = buildGstr1TemplateWorkbook(DATA, v);
    const name = wb.SheetNames.find((n) => n.startsWith('b2b') && !n.startsWith('b2ba'));
    const rows = aoa(wb, name);
    assert.equal(rows[4][rows[3].indexOf('Invoice Number')], '1');
    assert.equal(rows[4][rows[3].indexOf('Taxable Value')], 100);
    assert.equal(rows[2][rows[1].indexOf('Total Invoice Value')], 105);
  }
});

test('v1.9 and v2.0 name the first sheet b2b,sez,de; v2.0 adds the e-commerce sheets', () => {
  assert.ok(buildGstr1TemplateWorkbook(DATA, 'v1_7').SheetNames.includes('b2b'));
  assert.ok(buildGstr1TemplateWorkbook(DATA, 'v1_9').SheetNames.includes('b2b,sez,de'));
  assert.ok(buildGstr1TemplateWorkbook(DATA, 'v2_0').SheetNames.includes('ecob2b'));
});

for (const [v, file] of Object.entries(FILES)) {
  const path = `D:/JsmAccount_TextDemo/JS_Reports_Cry/${file}.xlsx`;
  test(`${v}: sheet names and header rows equal the real ${file}.xlsx`, { skip: !fs.existsSync(path) }, () => {
    const real = XLSX.read(fs.readFileSync(path));
    const ours = buildGstr1TemplateWorkbook({}, v);
    const expected = real.SheetNames.filter((n) => !/help|master/i.test(n));
    assert.deepEqual(ours.SheetNames, expected);
    for (const n of expected) {
      const r = XLSX.utils.sheet_to_json(real.Sheets[n], { header: 1, defval: '', range: 3 })[0] || [];
      const o = aoa(ours, n)[3] || [];
      const trim = (a) => { const b = [...a]; while (b.length && b[b.length - 1] === '') b.pop(); return b.map(String); };
      assert.deepEqual(trim(o), trim(r), `${n} header row`);
    }
  });
}
