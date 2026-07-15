const express = require('express');
const multer = require('multer');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { guard } = require('../utils/featureGuard');
const { purchaseStatus, objectIdParam } = require('../validators');
const { requirePermission } = require('../middlewares/permission.middleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^image\//.test(file.mimetype) ||
      file.mimetype === 'application/pdf' ||
      /\.(pdf|jpe?g|png|webp|bmp|gif)$/i.test(file.originalname || '');
    cb(ok ? null : new Error('Only PDF or image bills allowed'), ok);
  },
});

router.use(guard('purchase'));

router.post('/', requirePermission('purchase', 'create'), purchaseController.createPurchase);
router.get('/', requirePermission('purchase', 'read'), purchaseController.getPurchases);
/** Must be before /:id so "parse-bill" is not treated as an id */
router.post(
  '/parse-bill',
  requirePermission('purchase', 'create'),
  upload.single('bill'),
  purchaseController.parseBill
);
router.get('/:id', requirePermission('purchase', 'read'), objectIdParam, purchaseController.getPurchase);
router.put('/:id/status', requirePermission('purchase', 'update'), objectIdParam, purchaseStatus, purchaseController.updatePurchaseStatus);
router.delete('/:id', requirePermission('purchase', 'delete'), objectIdParam, purchaseController.deletePurchase);

module.exports = router;
