// Run: node --test src/utils/ewayBulkJson.node.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEwayBulkJson } from './ewayBulkJson.js';

const base = {
  DOC_NO: '12', DOC_DATE: '05/07/2026', FRM_GSTN: '24AAAAA0000A1Z5', FRM_PINCODE: '395002', FRM_ACT_STATE_CODE: 24,
  TO_GSTN: '27BBBBB0000B1Z5', TO_PINCODE: '400001', TO_ACT_STATE_CODE: 27, TOT_INV_VALUE: 2100, PRO_UNIT: 'MTRS',
};

test('item lines of one document become one bill with summed values', () => {
  const out = buildEwayBulkJson([
    { ...base, PRO_NAME: 'A', PRO_HSN: '5407', PRO_QTY: 100, ACC_VALUE: 1000, TAX_RATE: 5, CGST_AMT: 25, SGST_AMT: 25, IGST_AMT: 0 },
    { ...base, PRO_NAME: 'B', PRO_HSN: '5208', PRO_QTY: 50, ACC_VALUE: 1000, TAX_RATE: 5, CGST_AMT: 25, SGST_AMT: 25, IGST_AMT: 0 },
    { ...base, DOC_NO: '13', PRO_NAME: 'C', PRO_HSN: '5407', PRO_QTY: 10, ACC_VALUE: 200, TAX_RATE: 12, CGST_AMT: 0, SGST_AMT: 0, IGST_AMT: 24 },
  ]);
  assert.equal(out.billLists.length, 2);
  const [b12, b13] = out.billLists;
  assert.equal(b12.itemList.length, 2);
  assert.equal(b12.totalValue, 2000);
  assert.equal(b12.cgstValue, 50);
  assert.equal(b12.itemList[0].cgstRate, 2.5);
  assert.equal(b12.itemList[0].qtyUnit, 'MTR');
  assert.equal(b13.igstValue, 24);
  assert.equal(b13.itemList[0].igstRate, 12);
  assert.equal(b13.itemList[0].cgstRate, 0);
});

test('bill keys and constants follow the JSON JSM itself writes', () => {
  const out = buildEwayBulkJson([{ ...base, PRO_NAME: 'A', PRO_HSN: '5407', PRO_QTY: 3, ACC_VALUE: 518.62, TAX_RATE: 5, CGST_AMT: 0, SGST_AMT: 0, IGST_AMT: 25.93, TOT_INV_VALUE: 545 }]);
  assert.equal(out.version, '1.0.0421');
  const b = out.billLists[0];
  assert.deepEqual(Object.keys(b).slice(0, 8), ['genMode', 'userGstin', 'supplyType', 'subSupplyType', 'docType', 'docNo', 'docDate', 'transType']);
  assert.equal(b.genMode, 'Excel');
  assert.equal(b.totInvValue, '545.00');
  assert.equal(b.TotNonAdvolVal, 1);
  assert.equal(b.transDistance, 0);
  assert.equal(b.transDocDate, '05/07/2026');
  assert.equal(b.itemList[0].cessNonAdvol, 0);
  assert.equal(b.itemList[0].igstRate, 5);
});
