const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminConfigController = require('../controllers/adminConfig.controller');
const roleMiddleware = require('../middlewares/role.middleware');

// All routes require super_admin role
router.use(roleMiddleware(['super_admin']));

// DASHBOARD
router.get('/stats', adminController.getAdminStats);

// COMPANIES
router.get('/companies', adminController.getAllCompanies);
router.post('/company', adminController.createCompany);
router.put('/company/:id', adminController.updateCompany);
router.put('/company/:id/lock', adminController.lockCompany);
router.put('/company/:id/unlock', adminController.unlockCompany);

// PLANS
router.get('/plans', adminController.getAllPlans);
router.post('/plans', adminController.createPlan);
router.put('/plans/:id', adminController.updatePlan);
router.delete('/plans/:id', adminController.deletePlan);

// SUBSCRIPTIONS
router.get('/subscriptions', adminController.getAllSubscriptions);
router.put('/subscription/:companyId', adminController.updateSubscription);

// LICENSE
router.post('/license/generate', adminController.generateLicense);
router.put('/license/:companyId/renew', adminController.renewLicense);

// USAGE
router.get('/usage', adminController.getUsage);

// AUDIT
router.get('/audit', adminController.getAuditLogs);

// MODULE CONFIG (per-company dynamic module access)
router.get('/company/:id/module-config', adminController.getModuleConfig);
router.put('/company/:id/module-config', adminConfigController.saveModuleConfig);

// DYNAMIC CONFIG LAYER (Phase 1)
router.get('/company/:id/config/bundle', adminConfigController.getActiveBundle);
router.post('/company/:id/config/seed', adminConfigController.seedCompanyConfig);
router.get('/company/:id/config/logs', adminConfigController.getConfigLogs);

router.get('/company/:id/config/forms', adminConfigController.listFormConfigs);
router.put('/company/:id/config/forms/:formKey', adminConfigController.saveFormConfig);

router.get('/company/:id/config/columns', adminConfigController.listColumnConfigs);
router.put('/company/:id/config/columns/:tableKey', adminConfigController.saveColumnConfig);

router.get('/company/:id/config/bills/:billType', adminConfigController.getBillConfig);
router.put('/company/:id/config/bills/:billType', adminConfigController.saveBillConfig);

router.get('/company/:id/config/feature-flags', adminConfigController.listFeatureFlags);
router.put('/company/:id/config/feature-flags/:flagKey', adminConfigController.saveFeatureFlag);

router.get('/company/:id/config/permissions', adminConfigController.getPermissionMatrix);
router.put('/company/:id/config/permissions', adminConfigController.savePermissionMatrix);

router.get('/company/:id/config/pricing-rules', adminConfigController.listPricingRules);
router.put('/company/:id/config/pricing-rules/:ruleKey', adminConfigController.savePricingRule);

router.get('/company/:id/config/notifications', adminConfigController.listNotificationRules);
router.put('/company/:id/config/notifications/:ruleKey', adminConfigController.saveNotificationRule);

router.get('/company/:id/config/reports', adminConfigController.listReportConfigs);
router.put('/company/:id/config/reports/:reportKey', adminConfigController.saveReportConfig);

// COMPANY SETTINGS/CONFIG
router.get('/company/:id/config', adminController.getCompanyConfig);
router.put('/company/:id/config', adminController.saveCompanyConfig);

// USER MANAGEMENT (per company)
router.get('/company/:id/users', adminController.getCompanyUsers);
router.post('/company/:id/user', adminController.addCompanyUser);
router.put('/user/:userId/role', adminController.updateUserRole);
router.put('/user/:userId/toggle-active', adminController.toggleUserActive);
router.delete('/user/:userId', adminController.deleteCompanyUser);

module.exports = router;
