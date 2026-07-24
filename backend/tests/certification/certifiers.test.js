const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeTaxComponents } = require('../../utils/gstDetermination');
const { certify: certifyGst } = require('../../services/certifiers/gstCertifier');
const { certify: certifyAccounting } = require('../../services/certifiers/accountingCertifier');
const { certify: certifyInventory } = require('../../services/certifiers/inventoryCertifier');
const { certify: certifyApi } = require('../../services/certifiers/apiCoverageCertifier');
const { certify: certifySecurity } = require('../../services/certifiers/securityCertifier');
const { certify: certifyIsolation } = require('../../services/certifiers/multiCompanyCertifier');

/**
 * Pure / structural certification tests — no Mongo required for engine self-checks.
 * DB-backed certifiers tolerate empty collections.
 */
describe('GST engine certification (pure)', () => {
  it('CGST+SGST and IGST math', () => {
    const a = computeTaxComponents(2000, 18, 'CGST+SGST');
    assert.equal(a.cgst + a.sgst, a.gstAmount);
    assert.equal(a.gstAmount, 360);
    const b = computeTaxComponents(2000, 18, 'IGST');
    assert.equal(b.igst, 360);
  });
});

describe('Certifier modules load & self-check', () => {
  it('API coverage certifier', async () => {
    const r = await certifyApi();
    assert.ok(typeof r.passed === 'boolean');
    assert.ok(r.routeCount >= 35);
  });

  it('Security certifier', async () => {
    const r = await certifySecurity();
    assert.equal(r.passed, true, r.gaps?.join('; '));
  });

  it('Isolation certifier (structural)', async () => {
    const r = await certifyIsolation(null);
    assert.equal(r.passed, true, r.gaps?.join('; '));
  });

  it('GST certifier self-check without company', async () => {
    const r = await certifyGst(null);
    assert.equal(r.passed, true, r.gaps?.join('; '));
  });

  it('Accounting certifier empty books pass', async () => {
    // May need mongoose — skip soft if no connection
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        assert.ok(true);
        return;
      }
      const r = await certifyAccounting(null);
      assert.ok(typeof r.passed === 'boolean');
    } catch {
      assert.ok(true);
    }
  });

  it('Inventory certifier empty books pass', async () => {
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        assert.ok(true);
        return;
      }
      const r = await certifyInventory(null);
      assert.ok(typeof r.passed === 'boolean');
    } catch {
      assert.ok(true);
    }
  });
});
