const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { assertProductionEnv } = require('../../utils/startupChecks');

describe('startupChecks', () => {
  it('allows test environment without production secret length check', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    assert.doesNotThrow(() => assertProductionEnv());
    process.env.NODE_ENV = prev;
  });

  it('blocks weak JWT_SECRET in production', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secret';
    assert.throws(() => assertProductionEnv(), /JWT_SECRET/);
    process.env.NODE_ENV = prevEnv;
    process.env.JWT_SECRET = prevSecret;
  });
});

describe('inventoryStockHelper', () => {
  it('exports reverse helpers', () => {
    const helpers = require('../../utils/inventoryStockHelper');
    assert.equal(typeof helpers.reverseSaleStock, 'function');
    assert.equal(typeof helpers.reversePurchaseStock, 'function');
  });
});
