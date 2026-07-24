const configService = require('../services/configService');
const Company = require('../models/Company');

/** GET /api/config/active — merged config bundle for logged-in user's company */
exports.getActiveConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company context required' });
    }

    const company = await Company.findById(companyId).select('status isActive');
    if (!company || company.status === 'suspended' || company.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Company account is locked or suspended',
        code: 'COMPANY_LOCKED'
      });
    }

    const bundle = await configService.getActiveConfigBundle(companyId);
    res.set('Cache-Control', 'private, max-age=5');
    res.set('X-Config-Version', String(bundle.bundleVersion));
    res.set('X-Config-Hash', bundle.configHash);
    res.status(200).json({ success: true, data: bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/config/version — lightweight poll for live-reload (Phase 3) */
exports.getConfigVersion = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({
      success: true,
      data: {
        bundleVersion: bundle.bundleVersion,
        configHash: bundle.configHash,
        publishedAt: bundle.publishedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const requireCompanyAdmin = (req, res, next) => {
  const role = req.user?.companyRole || 'owner';
  if (req.user?.role === 'super_admin' || ['owner', 'admin'].includes(role)) return next();
  return res.status(403).json({ success: false, message: 'Only Owner or Admin can change company settings' });
};

/** GET /api/config/bills — all bill field configs for tenant */
exports.listBillConfigs = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const list = await configService.listBillConfigsForCompany(companyId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/config/bills/:billType */
exports.getBillConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const bill = await configService.getBillConfigForCompany(companyId, req.params.billType);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill config not found' });
    res.status(200).json({ success: true, data: bill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /api/config/bills/:billType — owner/admin only */
exports.saveBillConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.saveBillConfig(companyId, req.params.billType, req.body, actorId, req);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/config/settings */
exports.getCompanySettings = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const settings = await configService.getCompanySettings(companyId);
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /api/config/settings — owner/admin only */
exports.saveCompanySettings = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.saveCompanySettings(companyId, req.body, actorId, req);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/config/modules */
exports.getModuleConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const data = await configService.getModuleConfigForCompany(companyId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /api/config/modules */
exports.saveModuleConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.saveModuleConfig(companyId, req.body, actorId, req);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/config/columns */
exports.listColumnConfigs = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const list = await configService.listColumnConfigsForCompany(companyId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /api/config/columns/:tableKey */
exports.saveColumnConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.saveColumnConfig(companyId, req.params.tableKey, req.body, actorId, req);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/config/features */
exports.listFeatureFlags = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const list = await configService.listFeatureFlagsForCompany(companyId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /api/config/features/:flagKey */
exports.saveFeatureFlag = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.saveFeatureFlagForCompany(companyId, req.params.flagKey, req.body, actorId);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listFormConfigs = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const list = await configService.listFormConfigsForCompany(companyId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFormConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const form = await configService.getFormConfigForCompany(companyId, req.params.formKey);
    if (!form) return res.status(404).json({ success: false, message: 'Form config not found' });
    res.status(200).json({ success: true, data: form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveFormConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.saveFormConfig(companyId, req.params.formKey, req.body, actorId, req);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listReportConfigs = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const list = await configService.listReportConfigsForCompany(companyId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveReportConfig = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.saveReportConfigForCompany(companyId, req.params.reportKey, req.body, actorId);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listNotificationRules = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const list = await configService.listNotificationRulesForCompany(companyId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveNotificationRule = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.saveNotificationRuleForCompany(companyId, req.params.ruleKey, req.body, actorId);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPermissionMatrix = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const matrix = await configService.getPermissionMatrixForCompany(companyId);
    res.status(200).json({ success: true, data: matrix });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.savePermissionMatrix = async (req, res) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const actorId = req.user?.id || req.user?._id;
    const updated = await configService.savePermissionMatrixForCompany(companyId, req.body, actorId, req);
    const bundle = await configService.getActiveConfigBundle(companyId);
    res.status(200).json({ success: true, data: updated, bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.requireCompanyAdmin = requireCompanyAdmin;
