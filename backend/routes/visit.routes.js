const express = require('express');
const router = express.Router();
const { createVisit, getVisits, getVisitById } = require('../controllers/visit.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/', createVisit);
router.get('/', getVisits);
router.get('/:id', getVisitById);

module.exports = router;
