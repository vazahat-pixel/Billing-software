/**
 * 003 — Sprint 2.1 Master Data Engine indexes
 */
module.exports = {
  name: 'Master data warehouses FY voucher series',

  async up(mongoose) {
    const db = mongoose.connection.db;
    const ensure = async (collection, keys, options = {}) => {
      try {
        await db.collection(collection).createIndex(keys, options);
        console.log(`    index ${collection}`, options.name || keys);
      } catch (err) {
        if ([67, 85, 86, 11000].includes(err.code)) {
          console.warn(`    skip ${collection}:`, err.message);
          return;
        }
        throw err;
      }
    };

    await ensure('warehouses', { companyId: 1, code: 1 }, { unique: true, name: 'uniq_wh_code' });
    await ensure('warehouses', { companyId: 1, type: 1, name: 1 }, { name: 'idx_wh_type_name' });
    await ensure('financialyears', { companyId: 1, code: 1 }, { unique: true, name: 'uniq_fy_code' });
    await ensure('voucherseries', { companyId: 1, module: 1, prefix: 1, financialYearCode: 1 }, {
      unique: true,
      name: 'uniq_voucher_series',
    });
    await ensure('inventorylots', { companyId: 1, warehouseId: 1 }, { name: 'idx_lot_warehouse' });
    await ensure('items', { companyId: 1, barcode: 1 }, {
      unique: true,
      name: 'uniq_item_barcode',
      partialFilterExpression: { barcode: { $type: 'string', $gt: '' } },
    });
  },

  async down() {
    console.log('    down: skipped');
  },
};
