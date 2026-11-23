/**
 * A lot's optimistic-lock `version` is not always 1: the JSM data migration saves lots with version 0
 * and very old lots have none. Selling from such a lot must work (it used to fail with
 * "Concurrent stock update detected — please retry"), while a genuinely stale version must still be refused.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('stock movement on lots with unusual versions', () => {
  let InventoryLot; let applyLotMovement; let companyId; let itemId;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    InventoryLot = require('../../models/InventoryLot');
    ({ applyLotMovement } = require('../../utils/inventoryStockHelper'));
    companyId = new mongoose.Types.ObjectId();
    itemId = new mongoose.Types.ObjectId();
  });
  test.after(async () => { await stopMemoryDb(); });

  const raw = (extra) => ({
    companyId, itemId, lotId: `L-${Math.random().toString(36).slice(2, 8)}`, source: 'opening',
    totalMtrs: 100, remainingMtrs: 100, totalPcs: 10, remainingPcs: 10, status: 'Available', holdStatus: 'None',
    reservedMtrs: 0, reservedPcs: 0, isDeleted: false, ...extra,
  });
  const sell = async (_id) => {
    const lot = await InventoryLot.findOne({ _id, companyId });
    return applyLotMovement({ lot, companyId, deltaMts: -10, deltaPcs: -1, type: 'SALE', referenceId: _id });
  };

  for (const [label, extra] of [['version 0 (migrated)', { version: 0 }], ['no version field (legacy)', {}], ['version 1', { version: 1 }], ['version 5', { version: 5 }]]) {
    test(`sells from a lot with ${label}`, async () => {
      const { insertedId } = await InventoryLot.collection.insertOne(raw(extra));
      const first = await sell(insertedId);
      assert.equal(first.remainingMtrs, 90);
      const second = await sell(insertedId); // and again right after
      assert.equal(second.remainingMtrs, 80);
    });
  }

  test('still refuses a stale lot', async () => {
    const { insertedId } = await InventoryLot.collection.insertOne(raw({ version: 3 }));
    const stale = await InventoryLot.findOne({ _id: insertedId, companyId });
    await sell(insertedId); // someone else gets there first
    await assert.rejects(
      applyLotMovement({ lot: stale, companyId, deltaMts: -10, deltaPcs: -1, type: 'SALE', referenceId: insertedId }),
      /Concurrent stock update/
    );
  });

  test('a Job inserted with version 0 (migration) saves after an edit', async () => {
    const mongoose = require('mongoose');
    const Job = require('../../models/Job');
    const { insertedId } = await Job.collection.insertOne({ companyId, workerId: new mongoose.Types.ObjectId(), jobCardNo: 'M1', lotId: new mongoose.Types.ObjectId(), issueQty: 10, processType: 'Dyeing', status: 'Issued', isDeleted: false, version: 0 });
    const job = await Job.findById(insertedId);
    job.billGpNo = 'X1';
    await job.save();
    assert.equal((await Job.findById(insertedId)).billGpNo, 'X1');
  });
});
