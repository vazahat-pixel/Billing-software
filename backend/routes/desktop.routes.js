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

const fs = require('fs');
const path = require('path');

function getInstallerPath() {
  const candidates = [
    path.resolve(__dirname, '../public/downloads/BillingSoftware-Setup.exe'),
    path.resolve(__dirname, '../public/downloads/TextileERP-Setup-1.0.0.exe'),
    path.resolve(__dirname, '../../frontend/public/downloads/BillingSoftware-Setup.exe'),
    path.resolve(__dirname, '../../desktop/dist/TextileERP-Setup-1.0.0.exe'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Public metadata about latest desktop build */
router.get('/download-info', (req, res) => {
  const installerPath = getInstallerPath();
  if (!installerPath) {
    return res.status(404).json({
      success: false,
      message: 'Desktop installer is currently being built or unavailable.',
      data: { available: false },
    });
  }
  const stat = fs.statSync(installerPath);
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(1) + ' MB';
  return res.json({
    success: true,
    data: {
      available: true,
      version: '1.0.0',
      fileName: 'BillingSoftware-Setup.exe',
      sizeBytes: stat.size,
      sizeMB,
      releaseDate: '2026-10-02',
      os: 'Windows 10 / 11 (64-bit)',
      downloadUrl: '/api/desktop/download',
      directUrl: '/downloads/BillingSoftware-Setup.exe',
    },
  });
});

/** Direct binary download for desktop installer */
router.get('/download', (req, res) => {
  const installerPath = getInstallerPath();
  if (!installerPath) {
    return res.status(404).json({
      success: false,
      message: 'Desktop setup file not found. Please contact support.',
    });
  }
  res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
  res.setHeader('Content-Disposition', 'attachment; filename="BillingSoftware-Setup.exe"');
  return res.download(installerPath, 'BillingSoftware-Setup.exe');
});

module.exports = router;

