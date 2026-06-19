const configService = require('../services/configService');
const FormConfig = require('../models/FormConfig');
const ColumnConfig = require('../models/ColumnConfig');
const BillConfig = require('../models/BillConfig');
const FeatureFlag = require('../models/FeatureFlag');
const PricingRuleConfig = require('../models/PricingRuleConfig');
const NotificationConfig = require('../models/NotificationConfig');
const ReportConfig = require('../models/ReportConfig');
const PermissionMatrix = require('../models/PermissionMatrix');
const CompanySettings = require('../models/CompanySettings');
const Company = require('../models/Company');

const actorId = (req) => req.user?.id || req.user?._id;

exports.getActiveBundle = async (req, res) => {
  try {
    const bundle = await configService.getActiveConfigBundle(req.params.id);
    res.json({ success: true, data: bundle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.seedCompanyConfig = async (req, res) => {
  try {
    const result = await configService.seedCompanyDefaults(req.params.id, actorId(req), req);
    const bundle = await configService.getActiveConfigBundle(req.params.id);
    res.status(201).json({ success: true, data: bundle, seeded: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getConfigLogs = async (req, res) => {
  try {
    const logs = await configService.getConfigChangeLogs(req.params.id, parseInt(req.query.limit, 10) || 50);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveModuleConfig = async (req, res) => {
  try {
    const updated = await configService.saveModuleConfig(req.params.id, req.body, actorId(req), req);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listFormConfigs = async (req, res) => {
  try {
    const list = await FormConfig.find({ companyId: req.params.id, deletedAt: null });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveFormConfig = async (req, res) => {
  try {
    const updated = await configService.saveFormConfig(req.params.id, req.params.formKey, req.body, actorId(req), req);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listColumnConfigs = async (req, res) => {
  try {
    const list = await ColumnConfig.find({ companyId: req.params.id, deletedAt: null });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveColumnConfig = async (req, res) => {
  try {
    const updated = await configService.saveColumnConfig(req.params.id, req.params.tableKey, req.body, actorId(req), req);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBillConfig = async (req, res) => {
  try {
    const bill = await BillConfig.findOne({ companyId: req.params.id, billType: req.params.billType });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill config not found' });
    res.json({ success: true, data: bill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveBillConfig = async (req, res) => {
  try {
    const updated = await configService.saveBillConfig(req.params.id, req.params.billType, req.body, actorId(req), req);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listFeatureFlags = async (req, res) => {
  try {
    const list = await FeatureFlag.find({ companyId: req.params.id, deletedAt: null });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveFeatureFlag = async (req, res) => {
  try {
    const { flagKey, ...body } = req.body;
    const key = req.params.flagKey || flagKey;
    const existing = await FeatureFlag.findOne({ companyId: req.params.id, flagKey: key });
    const meta = { version: (existing?.version || 0) + 1, publishedAt: new Date(), updatedBy: actorId(req) };
    const updated = await FeatureFlag.findOneAndUpdate(
      { companyId: req.params.id, flagKey: key },
      { ...body, flagKey: key, companyId: req.params.id, ...meta },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPermissionMatrix = async (req, res) => {
  try {
    const matrix = await PermissionMatrix.findOne({ companyId: req.params.id });
    res.json({ success: true, data: matrix });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.savePermissionMatrix = async (req, res) => {
  try {
    const existing = await PermissionMatrix.findOne({ companyId: req.params.id });
    const meta = { version: (existing?.version || 0) + 1, publishedAt: new Date(), updatedBy: actorId(req) };
    const updated = await PermissionMatrix.findOneAndUpdate(
      { companyId: req.params.id },
      { ...req.body, companyId: req.params.id, ...meta },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.lockCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended' },
      { new: true }
    );
    await CompanySettings.findOneAndUpdate(
      { companyId: req.params.id },
      { isLocked: true, lockReason: req.body.reason || 'Suspended by admin' },
      { upsert: true }
    );
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.unlockCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    );
    await CompanySettings.findOneAndUpdate(
      { companyId: req.params.id },
      { isLocked: false, lockReason: '' },
      { upsert: true }
    );
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Pricing, Notification, Report list/save (admin CRUD)
exports.listPricingRules = async (req, res) => {
  try {
    const list = await PricingRuleConfig.find({ companyId: req.params.id }).sort({ priority: 1 });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.savePricingRule = async (req, res) => {
  try {
    const { ruleKey, ...body } = req.body;
    const key = req.params.ruleKey || ruleKey;
    const updated = await PricingRuleConfig.findOneAndUpdate(
      { companyId: req.params.id, ruleKey: key },
      { ...body, ruleKey: key, companyId: req.params.id },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listNotificationRules = async (req, res) => {
  try {
    const list = await NotificationConfig.find({ companyId: req.params.id });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveNotificationRule = async (req, res) => {
  try {
    const { ruleKey, ...body } = req.body;
    const key = req.params.ruleKey || ruleKey;
    const updated = await NotificationConfig.findOneAndUpdate(
      { companyId: req.params.id, ruleKey: key },
      { ...body, ruleKey: key, companyId: req.params.id },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listReportConfigs = async (req, res) => {
  try {
    const list = await ReportConfig.find({ companyId: req.params.id });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveReportConfig = async (req, res) => {
  try {
    const { reportKey, ...body } = req.body;
    const key = req.params.reportKey || reportKey;
    const updated = await ReportConfig.findOneAndUpdate(
      { companyId: req.params.id, reportKey: key },
      { ...body, reportKey: key, companyId: req.params.id },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
