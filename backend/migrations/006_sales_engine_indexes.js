/**
 * 006 — Sprint 2.5 Sales Engine indexes
 */
module.exports = {
  name: 'Sales engine quotes challans allocation',

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

    await ensure('salesquotations', { companyId: 1, quoteNo: 1 }, { unique: true, name: 'uniq_sq_no' });
    await ensure('deliverychallans', { companyId: 1, challanNo: 1 }, { unique: true, name: 'uniq_dc_no' });
    await ensure('deliverychallans', { companyId: 1, orderId: 1, status: 1 }, { name: 'idx_dc_order_status' });
    await ensure('sales', { companyId: 1, orderId: 1 }, { name: 'idx_sales_order' });
    await ensure('sales', { companyId: 1, challanId: 1 }, { name: 'idx_sales_challan' });
    await ensure('orders', { companyId: 1, orderType: 1, status: 1 }, { name: 'idx_order_type_status' });
  },

  async down() {
    console.log('    down: skipped');
  },
};
