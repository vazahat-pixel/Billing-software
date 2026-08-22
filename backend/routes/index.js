const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const purchaseRoutes = require('./purchase.routes');
const inventoryRoutes = require('./inventory.routes');
const adminRoutes = require('./admin.routes.js');
const partyRoutes = require('./partyRoutes');
const itemRoutes = require('./itemRoutes');
const jobRoutes = require('./jobRoutes');
const salesRoutes = require('./salesRoutes');
const ledgerRoutes = require('./ledgerRoutes');
const gstRoutes = require('./gstRoutes');
const reportRoutes = require('./reportRoutes');
const accountingRoutes = require('./accountingRoutes');
const bookRoutes = require('./bookRoutes');
const visitRoutes = require('./visit.routes');
const subMasterRoutes = require('./subMasterRoutes');
const orderRoutes = require('./orderRoutes');
const returnRoutes = require('./returnRoutes');
const noteRoutes = require('./noteRoutes');
const tdsRoutes = require('./tdsRoutes');
const utilityRoutes = require('./utilityRoutes');
const cuttingBeamRoutes = require('./cuttingBeamRoutes');
const userRoutes = require('./user.routes');
const configRoutes = require('./config.routes');
const dashboardRoutes = require('./dashboard.routes');
const integrityRoutes = require('./integrity.routes');
const warehouseRoutes = require('./warehouse.routes');
const mastersRoutes = require('./masters.routes');
const authMiddleware = require('../middlewares/auth.middleware');
const subscriptionMiddleware = require('../middlewares/subscription.middleware');
const companyIsolationMiddleware = require('../middlewares/companyIsolation.middleware');
const { requireModule, blockWritesWhenReadOnly } = require('../middlewares/moduleGate.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');

// Public health check route
router.get(['/health', '/health/live', '/health/ready'], (req, res) => {
  res.json({
    success: true,
    message: 'ok',
    data: {
      mongo: require('mongoose').connection.readyState === 1 ? 'up' : 'down',
      env: process.env.NODE_ENV || 'development',
    },
  });
});

// Public auth (rate-limited)
router.use('/auth', authLimiter, authRoutes);

// Authenticated tenant surface
router.use(authMiddleware);
router.use(subscriptionMiddleware);
router.use(companyIsolationMiddleware);

// Grace-period read-only guard — applies to every tenant write below.
router.use(blockWritesWhenReadOnly);

// --- Ungated: platform surface, not a sellable module -----------------------
// /dashboard, /admin, /config, /users, /integrity, /stage*, /developer must stay
// reachable even for a company whose modules are switched off, otherwise the
// app cannot boot, show its plan, or let the owner ask for an upgrade.
router.use('/dashboard', dashboardRoutes);
router.use('/integrity', integrityRoutes);
router.use('/stage2', require('./stage2Ops.routes'));
router.use('/stage3', require('./stage3Finance.routes'));
router.use('/stage4', require('./stage4Compliance.routes'));
router.use('/stage6', require('./stage6Enterprise.routes'));
router.use('/stage7', require('./stage7Infra.routes'));
router.use('/stage8', require('./stage8Commercial.routes'));
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/config', configRoutes);

// --- Masters: the shell of the product, shipped with every plan -------------
router.use('/masters', requireModule('masters'), mastersRoutes);
router.use('/parties', requireModule('masters'), partyRoutes);
router.use('/items', requireModule('masters'), itemRoutes);
router.use('/books', requireModule('masters'), bookRoutes);
router.use('/submasters', requireModule('masters'), subMasterRoutes);
router.use('/warehouses', requireModule('masters'), warehouseRoutes);

// --- Sellable modules -------------------------------------------------------
router.use('/sales', requireModule('sales'), salesRoutes);
router.use('/sales-engine', requireModule('sales'), require('./salesEngine.routes'));
router.use('/orders', requireModule('sales'), orderRoutes);
router.use('/visits', requireModule('sales'), visitRoutes);

router.use('/purchases', requireModule('purchase'), purchaseRoutes);
router.use('/purchase-engine', requireModule('purchase'), require('./purchaseEngine.routes'));

router.use('/jobs', requireModule('jobWork'), jobRoutes);
router.use('/production', requireModule('jobWork'), cuttingBeamRoutes);
router.use('/production-engine', requireModule('jobWork'), require('./productionEngine.routes'));

router.use('/inventory', requireModule('inventory'), inventoryRoutes);
router.use('/inventory-engine', requireModule('inventory'), require('./inventoryEngine.routes'));

router.use('/accounting', requireModule('accounting'), accountingRoutes);
router.use('/notes', requireModule('accounting'), noteRoutes);
router.use('/returns', requireModule('accounting'), returnRoutes);
router.use('/tds', requireModule('accounting'), tdsRoutes);

router.use('/gst', requireModule('gst'), gstRoutes);

router.use('/reports', requireModule('reports'), reportRoutes);

router.use('/utilities', requireModule('utilities'), utilityRoutes);
router.use('/business-automation', requireModule('utilities'), require('./businessAutomation.routes'));

// DEPRECATED: legacy LedgerEntry path (empty writers) — kept for API compatibility with deprecation header
router.use('/ledgers', requireModule('accounting'), (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
  res.setHeader('Link', '</api/accounting/ledgers>; rel="successor-version"');
  next();
}, ledgerRoutes);
router.use('/festivals', require('./festival.routes'));
router.use('/developer/qa', require('../developer/routes/qa.routes'));

module.exports = router;
