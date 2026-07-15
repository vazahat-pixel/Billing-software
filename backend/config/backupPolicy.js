/**
 * Backup & recovery runbook — procedural (ops), not automated cloud snapshots.
 * See Sprint 1.4 report for full plan.
 *
 * Suggested cron (mongodump):
 *   daily:   mongodump --uri="$MONGO_URI" --out=/backups/daily/$(date +%F)
 *   weekly:  copy latest daily → /backups/weekly/
 *   monthly: copy → /backups/monthly/
 *
 * Company restore (selective):
 *   mongoexport filters by companyId for collections:
 *   parties, items, purchases, sales, inventorylots, stockmovements,
 *   accountingentries, ledgermasters, jobs, paymentvouchers, ...
 */
module.exports = {
  collectionsCritical: [
    'companies',
    'users',
    'parties',
    'items',
    'purchases',
    'sales',
    'inventorylots',
    'stockmovements',
    'accountingentries',
    'ledgermasters',
    'paymentvouchers',
    'jobs',
    'counters',
    'subscriptions',
    'auditlogs',
    'domain_events',
  ],
  rpoHours: 24,
  rtoHours: 4,
};
