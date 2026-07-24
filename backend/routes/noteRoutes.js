const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { guard } = require('../utils/featureGuard');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('accounting'));

const read = requirePermission('accounting', 'read');
const write = requirePermission('accounting', 'create');

router.get('/', read, noteController.getNotes);
router.post('/', write, noteController.createNote);

module.exports = router;
