const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  availableMtrs,
  availablePcs,
  assertLotIssuable,
} = require('../../utils/inventoryStockHelper');
const AppError = require('../../utils/AppError');

describe('inventoryStockHelper — availability', () => {
  it('availableMtrs subtracts reservations', () => {
    assert.equal(availableMtrs({ remainingMtrs: 100, reservedMtrs: 30 }), 70);
    assert.equal(availableMtrs({ remainingMtrs: 10, reservedMtrs: 50 }), 0);
  });

  it('availablePcs never negative', () => {
    assert.equal(availablePcs({ remainingPcs: 5, reservedPcs: 2 }), 3);
    assert.equal(availablePcs({ remainingPcs: 1, reservedPcs: 5 }), 0);
  });
});

describe('inventoryStockHelper — assertLotIssuable', () => {
  it('rejects missing / deleted / held lots', () => {
    assert.throws(() => assertLotIssuable(null), AppError);
    assert.throws(() => assertLotIssuable({ isDeleted: true }), AppError);
    assert.throws(() => assertLotIssuable({ holdStatus: 'QC Hold', lotId: 'L1' }), AppError);
  });

  it('allows available lot', () => {
    assert.doesNotThrow(() => assertLotIssuable({ lotId: 'L1', holdStatus: 'None', isDeleted: false }));
  });
});
