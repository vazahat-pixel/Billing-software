/**
 * Migration 011 — hybrid sync indexes (additive, non-destructive).
 */
async function up(db) {
  const ensure = async (name, keys, opts = {}) => {
    try {
      await db.collection(name).createIndex(keys, opts);
    } catch (err) {
      if (err?.code !== 85 && err?.code !== 86) {
        console.warn(`[011] index ${name}`, err.message);
      }
    }
  };

  await ensure('processed_operations', { companyId: 1, operationId: 1 }, { unique: true });
  await ensure('sync_outbox', { companyId: 1, operationId: 1 }, { unique: true });
  await ensure('sync_outbox', { companyId: 1, status: 1, sequenceNumber: 1 });
  await ensure('number_range_leases', { leaseId: 1 }, { unique: true });
  await ensure('number_range_leases', { companyId: 1, deviceId: 1, module: 1, status: 1 });
  await ensure('sync_device_state', { companyId: 1, deviceId: 1 }, { unique: true });
  await ensure(
    'sales',
    { companyId: 1, operationId: 1 },
    {
      unique: true,
      partialFilterExpression: { operationId: { $type: 'string', $gt: '' } },
      name: 'companyId_1_operationId_1_partial',
    }
  );
  await ensure('parties', { companyId: 1, updatedAt: 1 });
  await ensure('items', { companyId: 1, updatedAt: 1 });
  await ensure('inventorylots', { companyId: 1, updatedAt: 1 });
  await ensure('sales', { companyId: 1, updatedAt: 1 });
}

module.exports = { up };
