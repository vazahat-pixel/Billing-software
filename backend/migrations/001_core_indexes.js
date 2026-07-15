/**
 * 001 — Core production indexes & unique constraints (Sprint 1.4)
 * Idempotent: createIndex is safe to re-run.
 */
module.exports = {
  name: 'Core indexes and unique constraints',

  async up(mongoose) {
    const db = mongoose.connection.db;

    const ensure = async (collection, keys, options = {}) => {
      try {
        await db.collection(collection).createIndex(keys, options);
        console.log(`    index ${collection}`, keys, options.name || '');
      } catch (err) {
        // Index option conflicts / unsupported expr → warn and continue
        if (err.code === 85 || err.code === 86 || err.code === 67) {
          console.warn(`    index exists/conflict ${collection}:`, err.message);
          return;
        }
        // Duplicate key while building unique index → leave warning for ops
        if (err.code === 11000) {
          console.warn(`    UNIQUE BUILD FAILED (duplicate data) ${collection}:`, err.message);
          return;
        }
        throw err;
      }
    };

    // Parties — GSTIN uniqueness when present
    await ensure('parties', { companyId: 1, gstin: 1 }, {
      unique: true,
      name: 'uniq_company_gstin',
      partialFilterExpression: { gstin: { $type: 'string', $gt: '' } },
    });
    await ensure('parties', { companyId: 1, mobile: 1 }, { name: 'idx_company_mobile', sparse: true });
    await ensure('parties', { companyId: 1, email: 1 }, { name: 'idx_company_email', sparse: true });

    // Purchase — supplier invoice uniqueness + date queries
    await ensure('purchases', { companyId: 1, supplierId: 1, supplierInvoiceNo: 1 }, {
      unique: true,
      name: 'uniq_supplier_invoice',
      partialFilterExpression: { supplierInvoiceNo: { $type: 'string', $gt: '' } },
    });
    await ensure('purchases', { companyId: 1, date: -1, status: 1 }, { name: 'idx_purchase_date_status' });
    await ensure('purchases', { companyId: 1, isDeleted: 1 }, { name: 'idx_purchase_soft' });

    // Sales
    await ensure('sales', { companyId: 1, date: -1, status: 1 }, { name: 'idx_sales_date_status' });
    await ensure('sales', { companyId: 1, isDeleted: 1 }, { name: 'idx_sales_soft' });

    // Inventory / movements
    await ensure('inventorylots', { companyId: 1, itemId: 1, status: 1 }, { name: 'idx_lot_item_status' });
    await ensure('inventorylots', { companyId: 1, purchaseId: 1 }, { name: 'idx_lot_purchase', sparse: true });
    await ensure('stockmovements', { companyId: 1, referenceId: 1, type: 1 }, { name: 'idx_movement_ref' });
    await ensure('stockmovements', { companyId: 1, lotId: 1, createdAt: 1 }, { name: 'idx_movement_lot_time' });
    await ensure('stockmovements', { companyId: 1, idempotencyKey: 1 }, {
      unique: true,
      name: 'uniq_movement_idempotency',
      partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } },
    });

    // Accounting
    await ensure('accountingentries', { companyId: 1, refId: 1, voucherType: 1 }, { name: 'idx_entry_ref' });
    await ensure('accountingentries', { companyId: 1, isDeleted: 1 }, { name: 'idx_entry_soft' });

    // Payments / jobs / visits / SaaS
    await ensure('paymentvouchers', { companyId: 1, date: -1 }, { name: 'idx_voucher_date' });
    await ensure('jobs', { companyId: 1, status: 1, issueDate: -1 }, { name: 'idx_job_status_date' });
    await ensure('visits', { companyId: 1, visitDate: -1 }, { name: 'idx_visit_date' });
    await ensure('subscriptions', { companyId: 1, status: 1 }, { name: 'idx_sub_company_status' });
    await ensure('licenses', { companyId: 1 }, { name: 'idx_license_company' });
    await ensure('users', { companyId: 1, email: 1 }, { name: 'idx_user_company_email', sparse: true });

    // Books — unique code when companyId is ObjectId (Mongo forbids $ne:null in partial indexes)
    await ensure('books', { companyId: 1, code: 1 }, {
      unique: true,
      name: 'uniq_book_code',
      partialFilterExpression: { companyId: { $type: 'objectId' } },
    });

    // Items — HSN search (not unique — shared HSN is valid)
    await ensure('items', { companyId: 1, hsnCode: 1 }, { name: 'idx_item_hsn', sparse: true });

    // Audit + events + reconciliation
    await ensure('auditlogs', { companyId: 1, createdAt: -1 }, { name: 'idx_audit_company_time' });
    await ensure('auditlogs', { companyId: 1, module: 1, action: 1 }, { name: 'idx_audit_module' });
    await ensure('auditlogs', { referenceId: 1 }, { name: 'idx_audit_ref', sparse: true });
    await ensure('domain_events', { companyId: 1, eventType: 1, createdAt: -1 }, { name: 'idx_domain_event' });
    await ensure('reconciliationruns', { companyId: 1, createdAt: -1 }, { name: 'idx_recon_runs' });
  },

  async down() {
    console.log('    down: index drops skipped (manual ops only)');
  },
};
