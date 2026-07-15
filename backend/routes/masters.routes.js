const express = require('express');
const router = express.Router();
const masterDataController = require('../controllers/masterDataController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');

router.post('/merge/parties', requirePermission('masters', 'update'), masterDataController.mergeParties);
router.post('/merge/items', requirePermission('masters', 'update'), masterDataController.mergeItems);
router.post('/import', requirePermission('masters', 'create'), masterDataController.importMasters);
router.get('/export', requirePermission('masters', 'read'), masterDataController.exportMasters);

router.get('/financial-years', requirePermission('masters', 'read'), masterDataController.listFinancialYears);
router.post('/financial-years', requirePermission('masters', 'create'), masterDataController.createFinancialYear);
router.put('/financial-years/:id/activate', requirePermission('masters', 'update'), objectIdParam, masterDataController.activateFinancialYear);

router.get('/voucher-series', requirePermission('masters', 'read'), masterDataController.listVoucherSeries);
router.post('/voucher-series', requirePermission('masters', 'create'), masterDataController.createVoucherSeries);

module.exports = router;

