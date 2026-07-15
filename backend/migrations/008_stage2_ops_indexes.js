/**
 * 008 — Sprint 2.7–2.10 document, workflow, certification indexes
 */
module.exports = {
  name: 'Stage2 docs workflow certification indexes',

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

    await ensure('documenttemplates', { companyId: 1, docType: 1, name: 1 }, { unique: true, name: 'uniq_doc_tpl' });
    await ensure('workflowdefinitions', { companyId: 1, code: 1 }, { unique: true, name: 'uniq_wf_def' });
    await ensure('workflowinstances', { companyId: 1, status: 1, createdAt: -1 }, { name: 'idx_wf_inst' });
    await ensure('certificationruns', { companyId: 1, createdAt: -1 }, { name: 'idx_cert_runs' });
  },

  async down() {
    console.log('    down: skipped');
  },
};
