const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { lineAmount, lineTaxable, recalcPurchaseTotals } = require('../../utils/purchaseTotals');

describe('purchaseTotals', () => {
  it('lineAmount is gross qty × rate (discount applied downstream in lineTaxable)', () => {
    assert.equal(lineAmount({ mts: 20, rate: 50 }), 1000);
  });

  it('lineAmount uses pcs qty for PCS-unit lines', () => {
    assert.equal(lineAmount({ unit: 'PCS', pcs: 4, mts: 0, rate: 50 }), 200);
  });

  it('lineTaxable applies discount to the gross amount', () => {
    assert.equal(lineTaxable({ amount: 1000, discount: 100 }), 900);
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
    const r = recalcPurchaseTotals([{ qty: 10, rate: 100, amount: 1000, gstRate: 12 }], {
      gstRate: 12,
      gstType: 'IGST',
      companyGstin: '24AAAAA0000A1Z5',
      partyGstin: '09AAAAA0000A1Z5',
    });
    assert.equal(r.gstType, 'IGST');
    assert.equal(r.igst, 120);
  });

  it('mixed line rates roll up per-line GST', () => {
    const r = recalcPurchaseTotals([
      { amount: 1000, gstRate: 5 },
      { amount: 1000, gstRate: 12 },
    ], {
      gstType: 'CGST+SGST',
      companyStateCode: '24',
      partyStateCode: '24',
    });
    assert.equal(r.taxableAmount, 2000);
    // 5% of 1000 = 50, 12% of 1000 = 120 → total GST 170 → half CGST/SGST
    assert.equal(r.gstAmount, 170);
    assert.equal(r.items[0].gstAmt, 50);
    assert.equal(r.items[1].gstAmt, 120);
  });

  it('footer less reduces taxable and GST', () => {
    const r = recalcPurchaseTotals([{ amount: 1000, gstRate: 5 }], {
      gstType: 'CGST+SGST',
      companyStateCode: '24',
      partyStateCode: '24',
      extras: { lessAmt: 100, lessSign: '-' },
    });
    assert.equal(r.taxableAmount, 900);
    assert.equal(r.gstAmount, 45);
  });

  it('dummy gstPer:0 falls back to invoice/default rate (not silent zero tax)', () => {
    const r = recalcPurchaseTotals([{ amount: 1000, gstPer: 0 }], {
      gstType: 'CGST+SGST',
      gstRate: 5,
      companyStateCode: '24',
      partyStateCode: '24',
    });
    assert.equal(r.gstAmount, 50);
  });

  it('unregistered invoice keeps zero GST even if rates missing', () => {
    const r = recalcPurchaseTotals([{ amount: 1000, gstPer: 0 }], {
      gstType: 'CGST+SGST',
      companyStateCode: '24',
      partyStateCode: '24',
      extras: { invoiceType: 'UNREGISTERED' },
    });
    assert.equal(r.gstAmount, 0);
  });
});
