const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateGstin,
  determineGstType,
  computeTaxComponents,
  placeOfSupply,
  stateCodeFromGstin,
  normalizeGstin,
  periodKey,
  filingPeriodFp,
} = require('../../utils/gstDetermination');

describe('gstDetermination — GSTIN validation', () => {
  it('accepts valid GSTIN', () => {
    const r = validateGstin('24AAAAA0000A1Z5');
    assert.equal(r.ok, true);
    assert.equal(r.stateCode, '24');
  });

  it('rejects empty / short / invalid format', () => {
    assert.equal(validateGstin('').ok, false);
    assert.equal(validateGstin('24AAAAA').ok, false);
    assert.equal(validateGstin('XXAAAAA0000A1Z5').ok, false);
  });

  it('normalizes lowercase gstin', () => {
    assert.equal(normalizeGstin('24aaaaa0000a1z5'), '24AAAAA0000A1Z5');
  });
});

describe('gstDetermination — place of supply & type', () => {
  it('intra-state → CGST+SGST', () => {
    assert.equal(
      determineGstType({ companyStateCode: '24', partyStateCode: '24' }),
      'CGST+SGST'
    );
  });

  it('inter-state → IGST', () => {
    assert.equal(
      determineGstType({ companyGstin: '24AAAAA0000A1Z5', partyGstin: '27AAAAA0000A1Z5' }),
      'IGST'
    );
  });

  it('forceType overrides', () => {
    assert.equal(
      determineGstType({ companyStateCode: '24', partyStateCode: '24', forceType: 'IGST' }),
      'IGST'
    );
  });

  it('placeOfSupply from party GSTIN', () => {
    const pos = placeOfSupply({ partyGstin: '27AAAAA0000A1Z5' });
    assert.equal(pos.stateCode, '27');
    assert.ok(pos.stateName);
  });

  it('stateCodeFromGstin', () => {
    assert.equal(stateCodeFromGstin('33AAAAA0000A1Z5'), '33');
  });
});

describe('gstDetermination — tax components', () => {
  it('CGST+SGST splits evenly', () => {
    const t = computeTaxComponents(1000, 5, 'CGST+SGST');
    assert.equal(t.cgst, 25);
    assert.equal(t.sgst, 25);
    assert.equal(t.igst, 0);
    assert.equal(t.gstAmount, 50);
  });

  it('IGST full rate', () => {
    const t = computeTaxComponents(1000, 12, 'IGST');
    assert.equal(t.igst, 120);
    assert.equal(t.cgst, 0);
    assert.equal(t.sgst, 0);
  });

  it('Exempt / NilRated zero tax', () => {
    const t = computeTaxComponents(1000, 5, 'Exempt');
    assert.equal(t.gstAmount, 0);
  });

  it('cess applied', () => {
    const t = computeTaxComponents(1000, 5, 'IGST', 1);
    assert.equal(t.cess, 10);
    assert.equal(t.igst, 50);
  });

  it('handles odd split rounding (cgst+sgst = total)', () => {
    const t = computeTaxComponents(100.33, 5, 'CGST+SGST');
    assert.equal(Number((t.cgst + t.sgst).toFixed(2)), t.gstAmount);
  });
});

describe('gstDetermination — periods', () => {
  it('periodKey and filingPeriodFp', () => {
    const key = periodKey(new Date('2026-07-15'));
    assert.equal(key, '2026-07');
    assert.equal(filingPeriodFp('2026-07'), '072026');
  });
});
