const mongoose = require('mongoose');

const COLLECTIONS_BY_COMPANY = [
  'stockmovements',
  'inventorylots',
  'stockreservations',
  'stockadjustments',
  'stocktransfers',
  'sales',
  'purchases',
  'jobs',
  'accountingentries',
  'paymentvouchers',
  'billsettlements',
  'orders',
  'deliverychallans',
  'returninvoices',
  'salesquotations',
  'auditlogs',
  'certificationruns',
  'reconciliationruns',
  'parties',
  'items',
  'warehouses',
  'submasters',
  'hsnmasters',
  'financialyears',
  'voucherseries',
  'processchaintemplates',
  'itemprocessmappings',
  'permissionmatrices',
  'companysettings',
  'gstconfigs',
  'gstperiods',
  'gstreturnsnapshots',
];

async function truncateTenant(companyId) {
  const oid = typeof companyId === 'string' ? new mongoose.Types.ObjectId(companyId) : companyId;
  const db = mongoose.connection.db;
  const results = {};
  for (const coll of COLLECTIONS_BY_COMPANY) {
    try {
      const res = await db.collection(coll).deleteMany({ companyId: oid });
      results[coll] = res.deletedCount;
    } catch {
      results[coll] = 0;
    }
  }
  return results;
}

module.exports = { truncateTenant, COLLECTIONS_BY_COMPANY };
