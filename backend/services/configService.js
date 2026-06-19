const crypto = require('crypto');
const Company = require('../models/Company');
const CompanyModuleConfig = require('../models/CompanyModuleConfig');
const CompanySettings = require('../models/CompanySettings');
const FormConfig = require('../models/FormConfig');
const ColumnConfig = require('../models/ColumnConfig');
const BillConfig = require('../models/BillConfig');
const FeatureFlag = require('../models/FeatureFlag');
const PricingRuleConfig = require('../models/PricingRuleConfig');
const NotificationConfig = require('../models/NotificationConfig');
const ReportConfig = require('../models/ReportConfig');
const PermissionMatrix = require('../models/PermissionMatrix');
const ConfigChangeLog = require('../models/ConfigChangeLog');
const defaults = require('../config/defaultConfigs');

const mapToObject = (mapVal) => {
  if (!mapVal) return {};
  if (mapVal instanceof Map) return Object.fromEntries(mapVal);
  if (typeof mapVal === 'object') return mapVal;
  return {};
};

const computeBundleHash = (payload) =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').substring(0, 16);

const logConfigChange = async ({
  companyId, configType, configKey, configId, version, action, actorId, before, after, req
}) => {
  await ConfigChangeLog.create({
    companyId,
    configType,
    configKey,
    configId,
    version,
    action,
    actorId: actorId || null,
    before,
    after,
    ip: req?.ip,
    userAgent: req?.get?.('user-agent')
  });
};

const bumpMeta = (doc, actorId) => {
  const nextVersion = (doc?.version || 0) + 1;
  return {
    version: nextVersion,
    publishedAt: new Date(),
    updatedBy: actorId || null,
    isActive: true,
    deletedAt: null,
    configHash: ''
  };
};

/** Seed all dynamic config documents for a new company. */
exports.seedCompanyDefaults = async (companyId, actorId = null, req = null) => {
  const companyObjectId = companyId;

  const moduleConfig = await CompanyModuleConfig.findOneAndUpdate(
    { companyId: companyObjectId },
    {
      companyId: companyObjectId,
      modules: defaults.DEFAULT_MODULES,
      subMenus: defaults.DEFAULT_SUB_MENUS,
      fields: defaults.DEFAULT_MODULE_FIELDS,
      version: 1,
      publishedAt: new Date(),
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const settings = await CompanySettings.findOneAndUpdate(
    { companyId: companyObjectId },
    { companyId: companyObjectId, version: 1, publishedAt: new Date(), isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  for (const form of defaults.DEFAULT_FORM_CONFIGS) {
    await FormConfig.findOneAndUpdate(
      { companyId: companyObjectId, formKey: form.formKey },
      { companyId: companyObjectId, ...form, version: 1, publishedAt: new Date(), isActive: true },
      { upsert: true, new: true }
    );
  }

  for (const bill of [defaults.SALES_BILL_CONFIG, defaults.PURCHASE_BILL_CONFIG]) {
    await BillConfig.findOneAndUpdate(
      { companyId: companyObjectId, billType: bill.billType },
      { companyId: companyObjectId, ...bill, version: 1, publishedAt: new Date(), isActive: true },
      { upsert: true, new: true }
    );
  }

  for (const col of defaults.DEFAULT_COLUMN_CONFIGS) {
    await ColumnConfig.findOneAndUpdate(
      { companyId: companyObjectId, tableKey: col.tableKey },
      { companyId: companyObjectId, ...col, version: 1, publishedAt: new Date(), isActive: true },
      { upsert: true, new: true }
    );
  }

  for (const flag of defaults.DEFAULT_FEATURE_FLAGS) {
    await FeatureFlag.findOneAndUpdate(
      { companyId: companyObjectId, flagKey: flag.flagKey },
      { companyId: companyObjectId, ...flag, version: 1, publishedAt: new Date(), isActive: true },
      { upsert: true, new: true }
    );
  }

  for (const rule of defaults.DEFAULT_NOTIFICATION_RULES) {
    await NotificationConfig.findOneAndUpdate(
      { companyId: companyObjectId, ruleKey: rule.ruleKey },
      { companyId: companyObjectId, ...rule, version: 1, publishedAt: new Date(), isActive: true },
      { upsert: true, new: true }
    );
  }

  for (const report of defaults.DEFAULT_REPORT_CONFIGS) {
    await ReportConfig.findOneAndUpdate(
      { companyId: companyObjectId, reportKey: report.reportKey },
      { companyId: companyObjectId, ...report, version: 1, publishedAt: new Date(), isActive: true },
      { upsert: true, new: true }
    );
  }

  await PermissionMatrix.findOneAndUpdate(
    { companyId: companyObjectId },
    {
      companyId: companyObjectId,
      roles: defaults.DEFAULT_PERMISSION_MATRIX.roles,
      sections: defaults.DEFAULT_PERMISSION_MATRIX.sections,
      version: 1,
      publishedAt: new Date(),
      isActive: true
    },
    { upsert: true, new: true }
  );

  await logConfigChange({
    companyId: companyObjectId,
    configType: 'module',
    configKey: 'bundle',
    configId: moduleConfig._id,
    version: 1,
    action: 'seed',
    actorId,
    before: null,
    after: { seeded: true },
    req
  });

  return { moduleConfig, settings };
};

/** Merge all active config into one bundle for the user panel (Phase 3). */
exports.getActiveConfigBundle = async (companyId) => {
  const company = await Company.findById(companyId).select('name status isActive planId').lean();

  const [
    moduleConfig,
    companySettings,
    forms,
    columns,
    bills,
    featureFlags,
    pricingRules,
    notifications,
    reports,
    permissions
  ] = await Promise.all([
    CompanyModuleConfig.findOne({ companyId, isActive: true, deletedAt: null }).lean(),
    CompanySettings.findOne({ companyId, isActive: true, deletedAt: null }).lean(),
    FormConfig.find({ companyId, isActive: true, deletedAt: null }).lean(),
    ColumnConfig.find({ companyId, isActive: true, deletedAt: null }).lean(),
    BillConfig.find({ companyId, isActive: true, deletedAt: null }).lean(),
    FeatureFlag.find({ companyId, isActive: true, deletedAt: null }).lean(),
    PricingRuleConfig.find({ companyId, isActive: true, deletedAt: null }).sort({ priority: 1 }).lean(),
    NotificationConfig.find({ companyId, isActive: true, deletedAt: null }).lean(),
    ReportConfig.find({ companyId, isActive: true, deletedAt: null }).lean(),
    PermissionMatrix.findOne({ companyId, isActive: true, deletedAt: null }).lean()
  ]);

  if (!moduleConfig) {
    await exports.seedCompanyDefaults(companyId);
    return exports.getActiveConfigBundle(companyId);
  }

  const modules = mapToObject(moduleConfig.modules);
  const subMenus = mapToObject(moduleConfig.subMenus);
  const fields = mapToObject(moduleConfig.fields);

  const formsMap = {};
  forms.forEach((f) => { formsMap[f.formKey] = f; });

  const columnsMap = {};
  columns.forEach((c) => { columnsMap[c.tableKey] = c; });

  const billsMap = { sales: null, purchase: null };
  bills.forEach((b) => { billsMap[b.billType] = b; });

  const flagsMap = {};
  featureFlags.forEach((f) => { flagsMap[f.flagKey] = f.enabled; });

  const versions = [
    moduleConfig.version,
    companySettings?.version,
    ...forms.map(f => f.version),
    ...columns.map(c => c.version),
    ...bills.map(b => b.version),
    permissions?.version
  ].filter(Boolean);

  const bundleVersion = Math.max(...versions, 1);

  const payload = {
    companyId: String(companyId),
    bundleVersion,
    publishedAt: new Date().toISOString(),
    company: {
      name: company?.name,
      status: company?.status,
      isActive: company?.isActive !== false,
      isLocked: company?.status === 'suspended' || companySettings?.isLocked === true
    },
    modules,
    subMenus,
    fields,
    forms: formsMap,
    columns: columnsMap,
    bills: billsMap,
    featureFlags: flagsMap,
    pricingRules,
    notifications,
    reports,
    permissions: permissions ? {
      roles: mapToObject(permissions.roles),
      sections: mapToObject(permissions.sections),
      version: permissions.version
    } : defaults.DEFAULT_PERMISSION_MATRIX,
    companySettings: companySettings || {}
  };

  payload.configHash = computeBundleHash(payload);
  return payload;
};

exports.saveModuleConfig = async (companyId, body, actorId, req) => {
  const existing = await CompanyModuleConfig.findOne({ companyId });
  const meta = bumpMeta(existing, actorId);
  const updated = await CompanyModuleConfig.findOneAndUpdate(
    { companyId },
    {
      ...body,
      companyId,
      ...meta,
      configHash: computeBundleHash(body)
    },
    { upsert: true, new: true }
  );

  await logConfigChange({
    companyId,
    configType: 'module',
    configKey: 'module',
    configId: updated._id,
    version: updated.version,
    action: existing ? 'update' : 'create',
    actorId,
    before: existing?.toObject?.() || null,
    after: updated.toObject(),
    req
  });

  return updated;
};

exports.saveBillConfig = async (companyId, billType, body, actorId, req) => {
  const existing = await BillConfig.findOne({ companyId, billType });
  const meta = bumpMeta(existing, actorId);
  const updated = await BillConfig.findOneAndUpdate(
    { companyId, billType },
    { ...body, companyId, billType, ...meta, configHash: computeBundleHash(body) },
    { upsert: true, new: true }
  );

  await logConfigChange({
    companyId,
    configType: 'bill',
    configKey: billType,
    configId: updated._id,
    version: updated.version,
    action: existing ? 'update' : 'create',
    actorId,
    before: existing?.toObject?.() || null,
    after: updated.toObject(),
    req
  });

  return updated;
};

exports.saveFormConfig = async (companyId, formKey, body, actorId, req) => {
  const existing = await FormConfig.findOne({ companyId, formKey });
  const meta = bumpMeta(existing, actorId);
  const updated = await FormConfig.findOneAndUpdate(
    { companyId, formKey },
    { ...body, companyId, formKey, ...meta, configHash: computeBundleHash(body) },
    { upsert: true, new: true }
  );

  await logConfigChange({
    companyId,
    configType: 'form',
    configKey: formKey,
    configId: updated._id,
    version: updated.version,
    action: existing ? 'update' : 'create',
    actorId,
    before: existing?.toObject?.() || null,
    after: updated.toObject(),
    req
  });

  return updated;
};

exports.saveColumnConfig = async (companyId, tableKey, body, actorId, req) => {
  const existing = await ColumnConfig.findOne({ companyId, tableKey });
  const meta = bumpMeta(existing, actorId);
  const updated = await ColumnConfig.findOneAndUpdate(
    { companyId, tableKey },
    { ...body, companyId, tableKey, ...meta, configHash: computeBundleHash(body) },
    { upsert: true, new: true }
  );

  await logConfigChange({
    companyId,
    configType: 'column',
    configKey: tableKey,
    configId: updated._id,
    version: updated.version,
    action: existing ? 'update' : 'create',
    actorId,
    before: existing?.toObject?.() || null,
    after: updated.toObject(),
    req
  });

  return updated;
};

exports.getConfigChangeLogs = async (companyId, limit = 50) =>
  ConfigChangeLog.find({ companyId }).sort({ createdAt: -1 }).limit(limit).populate('actorId', 'name email');

module.exports.mapToObject = mapToObject;
