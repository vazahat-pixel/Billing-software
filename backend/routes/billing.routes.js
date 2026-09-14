const express = require('express');
const billingController = require('../controllers/billing.controller');

/** Mounted at /api/billing/public — no auth */
const publicRouter = express.Router();
publicRouter.get('/plans', billingController.listPublicPlans);

/** Mounted at /api/billing — after auth + subscription */
const tenantRouter = express.Router();
tenantRouter.get('/me', billingController.getMyBilling);
tenantRouter.post('/checkout', billingController.createCheckout);
tenantRouter.post('/confirm', billingController.confirmCheckout);

module.exports = { publicRouter, tenantRouter };
