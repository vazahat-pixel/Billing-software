const express = require('express');
const router = express.Router();
const c = require('../controllers/stage4ComplianceController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');
const { guard } = require('../utils/featureGuard');

router.use(guard('gst'));

const read = requirePermission('gst', 'read');
const write = requirePermission('gst', 'create');
const update = requirePermission('gst', 'update');

// 4.1 Config
router.get('/config', read, c.getConfig);
router.put('/config', update, c.updateConfig);
router.post('/config/map-ledgers', write, c.mapLedgers);
router.get('/periods', read, c.listPeriods);
router.post('/periods/lock', write, c.lockPeriod);
router.post('/periods/unlock', write, c.unlockPeriod);

// 4.3 Returns
router.get('/returns/gstr1', read, c.gstr1);
router.get('/returns/gstr3b', read, c.gstr3b);
router.get('/returns/gstr9', read, c.gstr9);
router.post('/returns/snapshot', write, c.snapshotReturn);
router.get('/returns/export/:type', read, c.exportReturn);

// 4.4 HSN
router.get('/hsn', read, c.hsnList);
router.post('/hsn', write, c.hsnUpsert);
router.post('/hsn/sync', write, c.hsnSync);
router.get('/hsn/summary', read, c.hsnSummary);

// 4.5 TDS/TCS
router.get('/tds/sections', read, c.tdsSections);
router.post('/tds/compute', read, c.tdsCompute);
router.post('/tds', write, c.tdsPost);
router.post('/tcs', write, c.tcsPost);
router.get('/tds', read, c.tdsList);
router.get('/tds/report', read, c.tdsReport);
router.post('/tds/:id/certificate', write, objectIdParam, c.tdsCertificate);

// 4.6 E-Invoice / E-Way
router.get('/einvoice', read, c.einvoiceList);
router.get('/einvoice/payload/:salesId', read, c.einvoicePayload);
router.post('/einvoice/generate', write, c.einvoiceGenerate);
router.post('/einvoice/:id/cancel', write, objectIdParam, c.einvoiceCancel);
router.get('/eway', read, c.ewayList);
router.post('/eway/generate', write, c.ewayGenerate);

// 4.7 CA Workspace
router.get('/ca/overview', read, c.caOverview);
router.get('/ca/trial-balance', read, c.caTrialBalance);
router.get('/ca/profit-loss', read, c.caPL);
router.get('/ca/balance-sheet', read, c.caBS);
router.get('/ca/journals', read, c.caJournals);
router.get('/ca/ledgers/:id', read, objectIdParam, c.caLedger);
router.get('/ca/gst', read, c.caGst);
router.get('/ca/audit-pack', read, c.caAuditPack);
router.get('/ca/exports', read, c.caExports);

// 4.8 Reconciliation
router.post('/reconcile/2b/import', write, c.import2b);
router.post('/reconcile/2b/:id', write, objectIdParam, c.reconcile2b);
router.get('/reconcile/full', read, c.fullReconcile);
router.get('/reconcile/sales-gstr1', read, c.salesVsGstr1);

// 4.9 Dashboard
router.get('/dashboard', read, c.dashboard);
router.get('/filing-calendar', read, c.filingCalendar);

// 4.10 Certification
router.post('/certification/run', write, c.certRun);
router.get('/certification/latest', read, c.certLatest);
router.get('/certification', read, c.certList);

module.exports = router;
