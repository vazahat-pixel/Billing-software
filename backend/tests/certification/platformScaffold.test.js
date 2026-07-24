const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Stage 8.11 certifier modules load', () => {
  const modules = [
    'accountingCertifier',
    'inventoryCertifier',
    'gstCertifier',
    'multiCompanyCertifier',
    'securityCertifier',
    'apiCoverageCertifier',
    'desktopCertifier',
    'performanceCertifier',
    'offlineCertifier',
    'visualA11yCertifier',
    'qualityGates',
  ];

  for (const name of modules) {
    it(`loads ${name}`, () => {
      const mod = require(`../../services/certifiers/${name}`);
      assert.ok(mod);
      if (name !== 'qualityGates') {
        assert.equal(typeof mod.certify, 'function');
      }
    });
  }

  it('GST certifier self-checks pass without DB docs', async () => {
    const { certify } = require('../../services/certifiers/gstCertifier');
    // Use a non-existent company — still runs pure self-checks
    const r = await certify('000000000000000000000000');
    assert.equal(r.passed, true);
  });

  it('security certifier passes scaffold', async () => {
    const { certify } = require('../../services/certifiers/securityCertifier');
    const r = await certify();
    assert.equal(r.passed, true, r.gaps?.join('; '));
  });

  it('API coverage certifier sees expanded manifest', async () => {
    const { certify } = require('../../services/certifiers/apiCoverageCertifier');
    const r = await certify();
    assert.ok(r.routeCount >= 35, `expected ≥35 routes, got ${r.routeCount}`);
    assert.equal(r.passed, true, r.gaps?.join('; '));
  });
});
