/**
 * 007 — Sprint 2.6 Business Automation indexes
 */
module.exports = {
  name: 'Business automation rules notifications profit snapshots',

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

    await ensure('businessrules', { companyId: 1, ruleKey: 1 }, { unique: true, name: 'uniq_rule_key' });
    await ensure('notifications', { companyId: 1, status: 1, createdAt: -1 }, { name: 'idx_notif_inbox' });
    await ensure('profitsnapshots', { companyId: 1, snapshotDate: -1 }, { name: 'idx_profit_snap' });
    await ensure('domain_events', { companyId: 1, eventType: 1, processedAt: 1 }, { name: 'idx_event_outbox' });
  },

  async down() {
    console.log('    down: skipped');
  },
};
