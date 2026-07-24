const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { engineSurfaceOk } = require('../../services/certifiers/businessFlowCertifier');

describe('businessFlowCertifier', () => {
  it('engine surface is complete', () => {
    const r = engineSurfaceOk();
    assert.equal(r.ok, true, r.missing?.join(', '));
  });
});
