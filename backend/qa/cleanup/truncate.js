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

  // SAFETY SHIELD: Never truncate active companies unless explicitly marked as disposable QA tenant
  const comp = await db.collection('companies').findOne({ _id: oid });
  if (comp && comp.isQaTenant !== true && process.env.ALLOW_TENANT_TRUNCATE !== 'true') {
    console.warn(`⚠️ [SAFETY SHIELD] Prevented truncateTenant on protected company: "${comp.name}" (${oid})`);
    return { error: 'Company is protected against deletion. Set ALLOW_TENANT_TRUNCATE=true to override.' };
  }

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
