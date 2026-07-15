/**
 * 002 — Sync Mongoose schema indexes for transactional collections
 */
module.exports = {
  name: 'Sync mongoose model indexes',

  async up() {
    const models = [
      require('../models/Party'),
      require('../models/Item'),
      require('../models/Purchase'),
      require('../models/Sales'),
      require('../models/InventoryLot'),
      require('../models/StockMovement'),
      require('../models/AccountingEntry'),
      require('../models/LedgerMaster'),
      require('../models/PaymentVoucher'),
      require('../models/Job'),
      require('../models/ReturnInvoice'),
      require('../models/AuditLog'),
      require('../models/DomainEvent'),
      require('../models/Book'),
      require('../models/Subscription'),
    ];

    for (const Model of models) {
      try {
        await Model.syncIndexes();
        console.log(`    syncIndexes ${Model.modelName}`);
      } catch (err) {
        console.warn(`    syncIndexes warn ${Model.modelName}:`, err.message);
      }
    }
  },

  async down() {
    console.log('    down: skipped');
  },
};
