const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');

router.get('/active', configController.getActiveConfig);
router.get('/version', configController.getConfigVersion);

router.get('/bills', configController.listBillConfigs);
router.get('/bills/:billType', configController.getBillConfig);
router.put('/bills/:billType', configController.requireCompanyAdmin, configController.saveBillConfig);

router.get('/settings', configController.getCompanySettings);
router.put('/settings', configController.requireCompanyAdmin, configController.saveCompanySettings);

router.get('/modules', configController.getModuleConfig);
router.put('/modules', configController.requireCompanyAdmin, configController.saveModuleConfig);

router.get('/columns', configController.listColumnConfigs);
router.put('/columns/:tableKey', configController.requireCompanyAdmin, configController.saveColumnConfig);

router.get('/features', configController.listFeatureFlags);
router.put('/features/:flagKey', configController.requireCompanyAdmin, configController.saveFeatureFlag);

router.get('/forms', configController.listFormConfigs);
router.get('/forms/:formKey', configController.getFormConfig);
router.put('/forms/:formKey', configController.requireCompanyAdmin, configController.saveFormConfig);

router.get('/reports', configController.listReportConfigs);
router.put('/reports/:reportKey', configController.requireCompanyAdmin, configController.saveReportConfig);

router.get('/notifications', configController.listNotificationRules);
router.put('/notifications/:ruleKey', configController.requireCompanyAdmin, configController.saveNotificationRule);

router.get('/permissions', configController.getPermissionMatrix);
router.put('/permissions', configController.requireCompanyAdmin, configController.savePermissionMatrix);

module.exports = router;
