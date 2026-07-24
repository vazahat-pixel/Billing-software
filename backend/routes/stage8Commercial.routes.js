const express = require('express');
const router = express.Router();
const c = require('../controllers/stage8CommercialController');
const { requirePermission } = require('../middlewares/permission.middleware');

const read = requirePermission('reports', 'read');
const write = requirePermission('reports', 'create');
const update = requirePermission('reports', 'update');

router.get('/overview', read, c.overview);

// Business flows & QA
router.get('/flows/certify', read, c.flowCert);
router.post('/flows/certify', write, c.flowCertExecute);
router.get('/qa/inventory', read, c.qaInventory);
router.post('/qa/smoke', write, c.qaSmoke);
router.get('/uiux/checklist', read, c.uiuxChecklist);

// Licensing
router.get('/license/status', read, c.licenseStatus);
router.post('/license/activate', write, c.licenseActivate);
router.post('/license/activate-offline', write, c.licenseActivateOffline);
router.post('/license/offline-code', write, c.licenseOfflineCode);
router.post('/license/devices/:deviceId/deactivate', update, c.licenseDeactivateDevice);
router.post('/license/renew', update, c.licenseRenew);
router.post('/license/upgrade', update, c.licenseUpgrade);
router.post('/license/issue', write, c.licenseIssue);
router.get('/license/audit', read, c.licenseAudit);

// Onboarding
router.get('/onboarding', read, c.onboardingStatus);
router.get('/onboarding/wizard', read, c.onboardingWizard);
router.post('/onboarding/step', write, c.onboardingStep);
router.post('/onboarding/quick-setup', write, c.onboardingQuick);
router.post('/onboarding/skip', update, c.onboardingSkip);

// Release
router.get('/release/version', read, c.releaseVersion);
router.get('/release', read, c.releaseList);
router.get('/release/latest', read, c.releaseLatest);
router.post('/release', write, c.releaseUpsert);
router.post('/release/:version/approve', write, c.releaseApprove);
router.post('/release/:version/ship', write, c.releaseShip);
router.post('/release/ensure-v1', write, c.releaseEnsureV1);
router.get('/docs', read, c.docsIndex);
router.get('/desktop', read, c.desktopStatus);

// Certification
router.post('/certification/run', write, c.certRun);
router.get('/certification/latest', read, c.certLatest);
router.get('/certification', read, c.certList);

// 8.11 Enterprise Testing Platform
router.get('/testing/catalog', read, c.testingCatalog);
router.get('/testing/dashboard', read, c.testingDashboard);
router.get('/testing/scaffold', read, c.testingScaffold);
router.get('/testing/gates', read, c.testingGates);
router.post('/testing/certify', write, c.testingCertify);
router.get('/testing/latest', read, c.testingLatest);
router.get('/testing/runs', read, c.testingList);

module.exports = router;
