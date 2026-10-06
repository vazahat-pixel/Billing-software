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
    path.resolve(__dirname, '../../desktop/dist/TextileERP-Setup-1.0.0.exe'),
    path.resolve(__dirname, '../public/downloads/BillingSoftware-Setup.exe'),
    path.resolve(__dirname, '../public/downloads/TextileERP-Setup-1.0.0.exe'),
    path.resolve('/var/www/billing-frontend/downloads/BillingSoftware-Setup.exe'),
    path.resolve('/var/www/billing-frontend/downloads/TextileERP-Setup-1.0.0.exe'),
    path.resolve(__dirname, '../../frontend/dist/downloads/BillingSoftware-Setup.exe'),
    path.resolve(__dirname, '../../frontend/dist/downloads/TextileERP-Setup-1.0.0.exe'),
    path.resolve(__dirname, '../../frontend/public/downloads/BillingSoftware-Setup.exe'),
    path.resolve(__dirname, '../../frontend/public/downloads/TextileERP-Setup-1.0.0.exe'),
  ];
  const found = [];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const stat = fs.statSync(candidate);
        if (stat.isFile() && stat.size > 1024 * 1024) {
          found.push({ filePath: candidate, size: stat.size, mtime: stat.mtimeMs });
        }
      } catch {
        // Continue checking other candidates
      }
    }
  }
  if (found.length === 0) return null;
  found.sort((a, b) => b.mtime - a.mtime || b.size - a.size);
  return found[0];
}

const getExternalUrl = () => process.env.DESKTOP_DOWNLOAD_URL || process.env.DESKTOP_INSTALLER_URL || null;

/** Public metadata about latest desktop build */
router.get('/download-info', (req, res) => {
  const installer = getInstallerPath();
  const externalUrl = getExternalUrl();

  if (!installer && !externalUrl) {
    return res.status(404).json({
      success: false,
      message: 'Desktop installer is currently being built or unavailable.',
      data: { available: false },
    });
  }

  const sizeBytes = installer ? installer.size : 250518424;
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB';
  const releaseDate = installer
    ? new Date(installer.mtime).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return res.json({
    success: true,
    data: {
      available: true,
      version: '1.0.0',
      fileName: 'BillingSoftware-Setup.exe',
      sizeBytes,
      sizeMB,
      releaseDate,
      os: 'Windows 10 / 11 (64-bit)',
      downloadUrl: '/api/desktop/download',
      directUrl: externalUrl || '/downloads/BillingSoftware-Setup.exe',
      sha256: '5FD407ABFB0C37CA7BC51DB4BC126F1C179ACE9781C2728153A385A2B1BE8D5E',
    },
  });
});

/** Direct binary download for desktop installer */
router.get('/download', (req, res) => {
  const installer = getInstallerPath();
  if (installer) {
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Content-Disposition', 'attachment; filename="BillingSoftware-Setup.exe"');
    res.setHeader('Content-Length', installer.size);
    res.setHeader('Accept-Ranges', 'bytes');
    return res.download(installer.filePath, 'BillingSoftware-Setup.exe');
  }

  const externalUrl = getExternalUrl();
  if (externalUrl) {
    return res.redirect(302, externalUrl);
  }

  return res.status(404).json({
    success: false,
    message: 'Desktop setup file not found. Please contact support.',
  });
});

module.exports = router;

