'use strict';

const provisioning = require('../services/provisioningPackService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

/** Super Admin — generate signed provisioning pack for a company */
exports.generateProvisioningPack = asyncHandler(async (req, res) => {
  const pack = await provisioning.buildProvisioningPack(req.params.id, {
    issuedBy: req.user?._id || req.user?.id,
  });
  return ok(res, pack, 'Provisioning pack generated');
});

/** Desktop local — activation status */
exports.activationStatus = asyncHandler(async (req, res) => {
  if (String(process.env.DESKTOP_LOCAL || '').toLowerCase() !== 'true') {
    throw AppError.forbidden('Desktop activation endpoints only available in DESKTOP_LOCAL mode');
  }
  const status = await provisioning.getLocalActivationStatus();
  return ok(res, status);
});

/** Desktop local — validate pack without writing */
exports.validatePack = asyncHandler(async (req, res) => {
  if (String(process.env.DESKTOP_LOCAL || '').toLowerCase() !== 'true') {
    throw AppError.forbidden('Desktop activation endpoints only available in DESKTOP_LOCAL mode');
  }
  const summary = provisioning.validateProvisioningPack(req.body.pack || req.body);
  return ok(res, summary);
});

/** Desktop local — import pack + set owner password + bind device */
exports.activateDesktop = asyncHandler(async (req, res) => {
  if (String(process.env.DESKTOP_LOCAL || '').toLowerCase() !== 'true') {
    throw AppError.forbidden('Desktop activation endpoints only available in DESKTOP_LOCAL mode');
  }
  const { pack, password, deviceId, deviceName } = req.body || {};
  if (!pack) throw AppError.badRequest('pack required');
  const result = await provisioning.applyProvisioningPack(pack, {
    password,
    deviceId: deviceId || 'desktop-unknown',
    deviceName: deviceName || 'Textile ERP Desktop',
  });
  return ok(res, result, 'Desktop activated');
});
