const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { lineAmount, recalcSalesTotals } = require('../../utils/salesTotals');

describe('salesTotals', () => {
  it('lineAmount applies discount', () => {
    assert.equal(lineAmount({ mts: 10, rate: 100, discount: 50 }), 950);
  });

  it('intra-state invoice totals', () => {
    const r = recalcSalesTotals(
      [{ mts: 100, rate: 10, gstRate: 5 }],
      {
        gstType: 'CGST+SGST',
        companyStateCode: '24',
        partyStateCode: '24',
      }
    );
    assert.equal(r.taxableAmount, 1000);
    assert.equal(r.cgst, 25);
    assert.equal(r.sgst, 25);
    assert.equal(r.igst, 0);
    assert.equal(r.netAmount, 1050);
  });

  it('inter-state IGST when gstType forced to IGST', () => {
    const r = recalcSalesTotals(
      [{ mts: 100, rate: 10 }],
      {
        gstRate: 5,
        gstType: 'IGST',
        companyGstin: '24AAAAA0000A1Z5',
        partyGstin: '27AAAAA0000A1Z5',
      }
    );
    assert.equal(r.gstType, 'IGST');
    assert.equal(r.igst, 50);
    assert.equal(r.cgst, 0);
  });

  it('auto-determines IGST from state codes when gstType not forced', () => {
    // salesTotals only auto-resolves when gstType is outside the force list
    const { determineGstType } = require('../../utils/gstDetermination');
    assert.equal(
      determineGstType({
        companyGstin: '24AAAAA0000A1Z5',
        partyGstin: '27AAAAA0000A1Z5',
      }),
      'IGST'
    );
  });

  it('export / zero rated', () => {
    const r = recalcSalesTotals([{ mts: 50, rate: 20 }], {
      gstType: 'Export',
      extras: { isExport: true },
    });
    assert.equal(r.gstAmount, 0);
    assert.equal(r.netAmount, 1000);
  });

  it('freight and less adjustments', () => {
    const r = recalcSalesTotals([{ mts: 10, rate: 100 }], {
      gstType: 'CGST+SGST',
      gstRate: 5,
      extras: { freight: 100, lessAmt: 50 },
      companyStateCode: '24',
      partyStateCode: '24',
    });
    // taxable = 1000 - 50 + 100 = 1050; gst 5% = 52.5
    assert.equal(r.taxableAmount, 1050);
    assert.equal(r.gstAmount, 52.5);
  });

  it('never trusts negative net from over-discount', () => {
    const r = recalcSalesTotals([{ mts: 1, rate: 10, discount: 100 }], {
      gstType: 'CGST+SGST',
      companyStateCode: '24',
      partyStateCode: '24',
    });
    assert.ok(r.taxableAmount >= 0);
    assert.ok(r.netAmount >= 0);
  });
});
