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
const authMiddleware = require('../middlewares/auth.middleware');
const subscriptionMiddleware = require('../middlewares/subscription.middleware');

router.use('/auth', authRoutes);

// Protected Routes
router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.use('/purchases', purchaseRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/admin', adminRoutes);
router.use('/parties', partyRoutes);
router.use('/items', itemRoutes);
router.use('/jobs', jobRoutes);
router.use('/sales', salesRoutes);
router.use('/ledgers', ledgerRoutes);
router.use('/accounting', accountingRoutes);
router.use('/gst', gstRoutes);
router.use('/reports', reportRoutes);
router.use('/books', bookRoutes);
router.use('/visits', visitRoutes);

module.exports = router;
