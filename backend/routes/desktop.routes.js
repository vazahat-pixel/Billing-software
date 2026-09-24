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

/** Hybrid: verify salted local credentials when offline (no plaintext stored) */
router.post('/offline-login', async (req, res, next) => {
  try {
    if (String(process.env.DESKTOP_LOCAL || '').toLowerCase() !== 'true') {
      return res.status(403).json({ success: false, message: 'Desktop local only' });
    }
    const offlineSession = require('../services/offlineSessionService');
    const result = await offlineSession.verifyLocalSession({
      email: req.body?.email,
      password: req.body?.password,
      deviceId: req.body?.deviceId || req.headers['x-device-id'],
    });
    if (!result.ok) {
      return res.status(401).json({ success: false, message: 'Offline login failed', data: { reason: result.reason } });
    }
    // Issue a short-lived local JWT via existing session path if user still exists
    const User = require('../models/User');
    const user = await User.findById(result.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Local user unavailable' });
    }
    const sessionService = require('../services/sessionService');
    const sessionBundle = await sessionService.createSession(user, req);
    return res.json({
      success: true,
      message: 'Offline session',
      data: {
        token: sessionBundle.accessToken,
        refreshToken: sessionBundle.refreshToken,
        offline: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyRole: user.companyRole,
          companyId: user.companyId,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
