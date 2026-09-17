'use strict';

/**
 * Desktop-local activation routes (no JWT — first-run only).
 * Mounted only for activation; ERP routes still require auth after activate.
 */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/provisioning.controller');

router.get('/activation-status', ctrl.activationStatus);
router.post('/validate-pack', ctrl.validatePack);
router.post('/activate', ctrl.activateDesktop);

module.exports = router;
