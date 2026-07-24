const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const qualityGates = require('../../services/certifiers/qualityGates');
const platform = require('../../services/enterpriseTestingPlatformService');

describe('Stage 8.11 quality gates', () => {
  it('production gate is 95', () => {
    assert.equal(qualityGates.PRODUCTION_GATE, 95);
  });

  it('critical suites include accounting, inventory, gst, isolation, security', () => {
    for (const k of ['accounting', 'inventory', 'gst', 'isolation', 'security', 'business_flows']) {
      assert.equal(qualityGates.isCritical(k), true);
    }
  });

  it('evaluateCi blocks on failed critical suites', () => {
    const r = qualityGates.evaluateCi({
      unitFailed: false,
      integrationFailed: false,
      securityFailed: true,
      isolationFailed: false,
      certificationFailed: false,
      platformScore: 98,
      platformPassed: true,
    });
    assert.equal(r.passed, false);
    assert.equal(r.deployAllowed, false);
    assert.ok(r.failures.some((f) => /Security/i.test(f)));
  });

  it('evaluateCi passes when all green and score ≥ 95', () => {
    const r = qualityGates.evaluateCi({
      unitFailed: false,
      integrationFailed: false,
      securityFailed: false,
      isolationFailed: false,
      certificationFailed: false,
      apiFailed: false,
      platformScore: 96,
      platformPassed: true,
    });
    assert.equal(r.passed, true);
    assert.equal(r.deployAllowed, true);
  });

  it('evaluateCi blocks low production score', () => {
    const r = qualityGates.evaluateCi({ platformScore: 90, platformPassed: true });
    assert.equal(r.deployAllowed, false);
  });
});

describe('Enterprise testing platform catalog', () => {
  it('exposes 20 test types and suite inventory', () => {
    const cat = platform.catalog();
    assert.equal(cat.stage, '8.11');
    assert.ok(cat.testTypes.length >= 20);
    assert.ok(cat.suites.length >= 8);
    assert.equal(cat.productionGate, 95);
  });

  it('scaffold health reports artifacts', () => {
    const s = platform.scaffoldHealth();
    assert.ok(s.total >= 10);
    assert.ok(typeof s.healthy === 'boolean');
    assert.ok(Array.isArray(s.results));
  });
});
