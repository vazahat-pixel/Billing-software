const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { guard } = require('../utils/featureGuard');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('accounting'));

const read = requirePermission('accounting', 'read');
const write = requirePermission('accounting', 'create');

router.get('/', read, noteController.getNotes);
router.get('/:id', read, noteController.getNoteById);
router.post('/', write, noteController.createNote);
// Edit re-posts atomically (reverse + repost, note number kept); delete is a reversal.
router.put('/:id', requirePermission('accounting', 'update'), noteController.updateNote);
router.post('/:id/reverse', requirePermission('accounting', 'delete'), noteController.reverseNote);

module.exports = router;

