const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
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

module.exports = router;
