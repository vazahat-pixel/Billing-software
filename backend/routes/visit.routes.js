const express = require('express');
const router = express.Router();
const { createVisit, getVisits, getVisitById } = require('../controllers/visit.controller');
const { requirePermission } = require('../middlewares/permission.middleware');

const read = requirePermission('masters', 'read');
const write = requirePermission('masters', 'create');

router.post('/', write, createVisit);
router.get('/', read, getVisits);
router.get('/:id', read, getVisitById);

module.exports = router;
