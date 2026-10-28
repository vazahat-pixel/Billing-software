// Run: node --test src/pages/masters/jsm/jsmSubMasterForms.node.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSM_SUBMASTER_FORMS, recordToValues, valuesToPayload, nextCodeOf, isValidGstin } from './jsmSubMasterForms.js';

test('a record saved by the older screen opens with its values, and fields this screen lacks survive a save', () => {
  const cfg = JSM_SUBMASTER_FORMS.Transport;
  const old = { _id: '1', name: 'VRL', extraFields: { transporterId: '24AAACV1234F1Z5', phone: '999', contactPerson: 'RAJ', route: 'SURAT-MUMBAI', code: '7' } };
  const v = recordToValues(cfg, old);
  assert.equal(v.txt_name, 'VRL');
  assert.equal(v.txt_gstn_no, '24AAACV1234F1Z5');
  assert.equal(v.txt_ph1, '999');
  const p = valuesToPayload(cfg, 'Transport', { ...v, TXT_MODE: 'Road' }, old, 9);
  assert.equal(p.extraFields.contactPerson, 'RAJ'); // not on the JSM form, kept
  assert.equal(p.extraFields.route, 'SURAT-MUMBAI');
  assert.equal(p.extraFields.mode, 'Road');
  assert.equal(p.extraFields.code, '7'); // existing code kept
});

test('new record gets the next code; tax slab rates are numbers and gstRate follows IGST', () => {
  const cfg = JSM_SUBMASTER_FORMS.ItemTaxSlab;
  const v = { ...recordToValues(cfg, null), txt_slab_name: ' GST 12% ', txt_sgst_per: '6.000', txt_cgst_per: '6.000', txt_igst_per: '12' };
  const p = valuesToPayload(cfg, 'ItemTaxSlab', v, null, nextCodeOf([{ extraFields: { code: '3' } }, { extraFields: { code: 'X' } }]));
  assert.equal(p.name, 'GST 12%');
  assert.deepEqual([p.extraFields.sgstRate, p.extraFields.igstRate, p.extraFields.gstRate, p.extraFields.code], [6, 12, 12, '4']);
  assert.equal(p.extraFields.category, undefined); // the older Goods/Services field is not invented
  assert.equal(recordToValues(cfg, { name: 'x', extraFields: { sgstRate: 2.5, igstRate: 5 } }).txt_sgst_per, '2.500');
});

test('GSTIN check digit', () => {
  assert.equal(isValidGstin('27AAPFU0939F1ZV'), true);
  assert.equal(isValidGstin('27aapfu0939f1zv'), true);
  assert.equal(isValidGstin('27AAPFU0939F1ZW'), false);
  assert.equal(isValidGstin('27AAPFU0939F1Z'), false);
});
