const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { lineAmount, recalcPurchaseTotals } = require('../../utils/purchaseTotals');

describe('purchaseTotals', () => {
  it('lineAmount', () => {
    assert.equal(lineAmount({ mts: 20, rate: 50, discount: 100 }), 900);
  });

  it('intra-state purchase', () => {
    const r = recalcPurchaseTotals([{ mts: 100, rate: 10 }], {
      gstRate: 5,
      companyStateCode: '24',
      partyStateCode: '24',
    });
    assert.equal(r.taxableAmount, 1000);
    assert.ok(r.cgst + r.sgst > 0 || r.gstAmount > 0);
  });

  it('inter-state purchase IGST', () => {
    const r = recalcPurchaseTotals([{ qty: 10, rate: 100 }], {
      gstRate: 12,
      gstType: 'IGST',
      companyGstin: '24AAAAA0000A1Z5',
      partyGstin: '09AAAAA0000A1Z5',
    });
    assert.equal(r.gstType, 'IGST');
    assert.equal(r.igst, 120);
  });
});
