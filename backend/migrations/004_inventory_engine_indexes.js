/**
 * 004 — Sprint 2.3 Inventory Engine indexes
 */
module.exports = {
  name: 'Inventory engine reservations transfers adjustments',

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

    await ensure('inventorylots', { companyId: 1, holdStatus: 1 }, { name: 'idx_lot_hold' });
    await ensure('inventorylots', { companyId: 1, itemId: 1, holdStatus: 1 }, { name: 'idx_lot_item_hold' });
    await ensure('stockreservations', { companyId: 1, reservationNo: 1 }, { unique: true, name: 'uniq_rsv_no' });
    await ensure('stockreservations', { companyId: 1, lotId: 1, status: 1 }, { name: 'idx_rsv_lot_status' });
    await ensure('stocktransfers', { companyId: 1, transferNo: 1 }, { unique: true, name: 'uniq_trf_no' });
    await ensure('stockadjustments', { companyId: 1, adjustNo: 1 }, { unique: true, name: 'uniq_adj_no' });
    await ensure('stockmovements', { companyId: 1, lotId: 1, type: 1 }, { name: 'idx_move_lot_type' });
  },

  async down() {
    console.log('    down: skipped');
  },
};
