/**
 * 005 — Sprint 2.4 Production & Job Work Engine indexes
 */
module.exports = {
  name: 'Production engine chains mappings job steps',

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

    await ensure('processchaintemplates', { companyId: 1, code: 1 }, { unique: true, name: 'uniq_chain_code' });
    await ensure('itemprocessmappings', { companyId: 1, inputItemId: 1, processName: 1 }, {
      unique: true,
      name: 'uniq_item_process_map',
    });
    await ensure('inventorylots', { companyId: 1, parentLotId: 1 }, { name: 'idx_lot_parent' });
    await ensure('inventorylots', { companyId: 1, sourceJobId: 1 }, { name: 'idx_lot_source_job' });
    await ensure('jobs', { companyId: 1, 'steps.status': 1 }, { name: 'idx_job_step_status' });
  },

  async down() {
    console.log('    down: skipped');
  },
};
