'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseNumber, parseAmountWithSide, parseSide, parseGstRate, safeHeaderKey } = require('../../utils/importParsers');

describe('import value parsers', () => {
  it('parseNumber reads Indian digit grouping, currency signs and negatives', () => {
    assert.equal(parseNumber('1,50,000'), 150000);
    assert.equal(parseNumber('₹ 2,500.50'), 2500.5);
    assert.equal(parseNumber('Rs. 99'), 99);
    assert.equal(parseNumber('(500)'), -500);
    assert.equal(parseNumber('500-'), -500);
    assert.equal(parseNumber('-12.5'), -12.5);
    assert.equal(parseNumber(42), 42);
    assert.equal(parseNumber(''), null);
    assert.equal(parseNumber('abc'), null);
    assert.equal(parseNumber(null), null);
  });

  it('parseAmountWithSide splits the Dr/Cr suffix', () => {
    assert.deepEqual(parseAmountWithSide('1,50,000 Cr'), { amount: 150000, side: 'Cr', negative: false });
    assert.deepEqual(parseAmountWithSide('5000 Dr.'), { amount: 5000, side: 'Dr', negative: false });
    assert.deepEqual(parseAmountWithSide('2500C'), { amount: 2500, side: 'Cr', negative: false });
    assert.deepEqual(parseAmountWithSide(-750), { amount: 750, side: null, negative: true });
    assert.deepEqual(parseAmountWithSide('300'), { amount: 300, side: null, negative: false });
    assert.deepEqual(parseAmountWithSide(''), { amount: null, side: null, negative: false });
  });

  it('parseSide understands Dr / Cr words', () => {
    assert.equal(parseSide('cr'), 'Cr');
    assert.equal(parseSide('CREDIT'), 'Cr');
    assert.equal(parseSide('Dr.'), 'Dr');
    assert.equal(parseSide('debit'), 'Dr');
    assert.equal(parseSide(''), null);
    assert.equal(parseSide('x'), null);
  });

  it('parseGstRate: percent text, Excel percent cells, exempt words, blank -> default', () => {
    assert.equal(parseGstRate('12%'), 12);
    assert.equal(parseGstRate('GST 18 %'), 18);
    assert.equal(parseGstRate('IGST @ 5'), 5);
    assert.equal(parseGstRate(5), 5);
    assert.equal(parseGstRate(0.05), 5); // a 5% cell in Excel is stored as 0.05
    assert.equal(parseGstRate(0.12), 12);
    assert.equal(parseGstRate(0), 0);
    assert.equal(parseGstRate('Exempt'), 0);
    assert.equal(parseGstRate('Nil Rated'), 0);
    assert.equal(parseGstRate(''), 5);
    assert.equal(parseGstRate('   '), 5);
    assert.equal(parseGstRate('', 0), 0);
    assert.equal(parseGstRate('n/a'), 5);
  });

  it('safeHeaderKey removes the dot MongoDB sanitizing would strip', () => {
    assert.ok(!safeHeaderKey('Mobile No.').includes('.'));
    assert.ok(!safeHeaderKey('$ Amount').startsWith('$'));
    assert.equal(safeHeaderKey('Party Name'), 'Party Name');
  });
});
