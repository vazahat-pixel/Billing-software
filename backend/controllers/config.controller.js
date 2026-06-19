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
