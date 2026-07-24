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
const userRoutes = require('./user.routes');
const configRoutes = require('./config.routes');
const dashboardRoutes = require('./dashboard.routes');
const integrityRoutes = require('./integrity.routes');
const warehouseRoutes = require('./warehouse.routes');
const mastersRoutes = require('./masters.routes');
const authMiddleware = require('../middlewares/auth.middleware');
const subscriptionMiddleware = require('../middlewares/subscription.middleware');
const companyIsolationMiddleware = require('../middlewares/companyIsolation.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');

// Public auth (rate-limited)
router.use('/auth', authLimiter, authRoutes);

// Authenticated tenant surface
router.use(authMiddleware);
router.use(subscriptionMiddleware);
router.use(companyIsolationMiddleware);

router.use('/dashboard', dashboardRoutes);
router.use('/integrity', integrityRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/masters', mastersRoutes);
router.use('/purchase-engine', require('./purchaseEngine.routes'));
router.use('/inventory-engine', require('./inventoryEngine.routes'));
router.use('/production-engine', require('./productionEngine.routes'));
router.use('/sales-engine', require('./salesEngine.routes'));
router.use('/business-automation', require('./businessAutomation.routes'));
router.use('/stage2', require('./stage2Ops.routes'));
router.use('/stage3', require('./stage3Finance.routes'));
router.use('/stage4', require('./stage4Compliance.routes'));
router.use('/stage6', require('./stage6Enterprise.routes'));
router.use('/stage7', require('./stage7Infra.routes'));
router.use('/stage8', require('./stage8Commercial.routes'));
router.use('/purchases', purchaseRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/admin', adminRoutes);
router.use('/parties', partyRoutes);
router.use('/items', itemRoutes);
router.use('/jobs', jobRoutes);
router.use('/sales', salesRoutes);
// DEPRECATED: legacy LedgerEntry path (empty writers) — kept for API compatibility with deprecation header
router.use('/ledgers', (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
  res.setHeader('Link', '</api/accounting/ledgers>; rel="successor-version"');
  next();
}, ledgerRoutes);
router.use('/accounting', accountingRoutes);
router.use('/gst', gstRoutes);
router.use('/reports', reportRoutes);
router.use('/books', bookRoutes);
router.use('/visits', visitRoutes);
router.use('/submasters', subMasterRoutes);
router.use('/orders', orderRoutes);
router.use('/returns', returnRoutes);
router.use('/notes', noteRoutes);
router.use('/users', userRoutes);
router.use('/config', configRoutes);
router.use('/festivals', require('./festival.routes'));
router.use('/developer/qa', require('../developer/routes/qa.routes'));

module.exports = router;
