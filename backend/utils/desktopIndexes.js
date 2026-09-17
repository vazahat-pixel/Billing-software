/**
 * Ensure high-traffic indexes for desktop / large datasets.
 * Safe to run repeatedly. Invoked optionally on DESKTOP_LOCAL boot.
 */
'use strict';

async function ensureDesktopIndexes(mongoose) {
  const jobs = [
    ['parties', [{ companyId: 1, name: 1 }, { companyId: 1, type: 1 }]],
    ['items', [{ companyId: 1, name: 1 }, { companyId: 1, itemCode: 1 }]],
    ['sales', [{ companyId: 1, date: -1 }, { companyId: 1, invoiceNo: 1 }]],
    ['purchases', [{ companyId: 1, date: -1 }, { companyId: 1, invoiceNo: 1 }]],
    ['inventorylots', [{ companyId: 1, itemId: 1 }, { companyId: 1, status: 1 }]],
    ['stockmovements', [{ companyId: 1, lotId: 1, createdAt: -1 }]],
  ];

  for (const [collName, indexes] of jobs) {
    try {
      const coll = mongoose.connection.collection(collName);
      for (const keys of indexes) {
        // eslint-disable-next-line no-await-in-loop
        await coll.createIndex(keys, { background: true });
      }
    } catch (err) {
      // Collection may not exist yet
      if (!/ns does not exist/i.test(err.message)) {
        console.warn('[desktopIndexes]', collName, err.message);
      }
    }
  }
}

module.exports = { ensureDesktopIndexes };
