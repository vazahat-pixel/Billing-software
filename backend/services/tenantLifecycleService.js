/**
 * Admin tenant lifecycle helpers — export, hard-delete, plan change (no payments).
 */
const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const License = require('../models/License');
const CompanyModuleConfig = require('../models/CompanyModuleConfig');
const CompanySettings = require('../models/CompanySettings');
const defaults = require('../config/defaultConfigs');
const auditService = require('./auditService');
const dunningService = require('./dunningService');
const AppError = require('../utils/AppError');

const EXPORT_MODELS = [
  { key: 'company', model: () => Company },
  { key: 'users', model: () => User, project: { password: 0, passwordResetToken: 0, totpSecret: 0 } },
  { key: 'subscription', model: () => Subscription },
  { key: 'licenses', model: () => License },
  { key: 'moduleConfig', model: () => CompanyModuleConfig },
  { key: 'settings', model: () => CompanySettings },
  { key: 'parties', model: () => require('../models/Party') },
  { key: 'items', model: () => require('../models/Item') },
  { key: 'sales', model: () => require('../models/Sales'), limit: 5000 },
  { key: 'purchases', model: () => require('../models/Purchase'), limit: 5000 },
  { key: 'returns', model: () => require('../models/ReturnInvoice'), limit: 2000 },
  { key: 'jobs', model: () => require('../models/Job'), limit: 2000 },
  { key: 'inventoryLots', model: () => require('../models/InventoryLot'), limit: 5000 },
  { key: 'ledgerMasters', model: () => require('../models/LedgerMaster') },
  { key: 'accountingEntries', model: () => require('../models/AccountingEntry'), limit: 5000 },
];

async function exportCompanyData(companyId) {
  if (!mongoose.Types.ObjectId.isValid(String(companyId))) {
    throw AppError.badRequest('Invalid company id');
  }
  const company = await Company.findById(companyId).lean();
  if (!company) throw AppError.notFound('Company not found');

  const bundle = {
    exportedAt: new Date().toISOString(),
    companyId: String(companyId),
    companyName: company.name,
    collections: {},
  };

  for (const spec of EXPORT_MODELS) {
    try {
      const Model = spec.model();
      const filter = spec.key === 'company' ? { _id: companyId } : { companyId };
      let q = Model.find(filter);
      if (spec.project) q = q.select(spec.project);
      if (spec.limit) q = q.limit(spec.limit);
      const rows = await q.lean();
      bundle.collections[spec.key] = rows;
    } catch (err) {
      bundle.collections[spec.key] = { error: err.message };
    }
  }

  return bundle;
}

/**
 * Destructive delete — removes tenant commercial + operational docs.
 * Prefer lock for soft offboard; use this for churn wipe.
 */
async function deleteCompanyCascade(companyId, { req, confirmName } = {}) {
  const company = await Company.findById(companyId);
  if (!company) throw AppError.notFound('Company not found');
  if (confirmName && String(confirmName).trim() !== String(company.name).trim()) {
    throw AppError.badRequest('confirmName must exactly match company name');
  }

  const before = { name: company.name, id: company._id };

  const collections = [
    'parties', 'items', 'sales', 'purchases', 'returninvoices', 'jobs',
    'ledgerMasters', 'accountingentries', 'paymentvouchers', 'debitcreditnotes',
    'inventorylots', 'usages', 'companymoduleconfigs', 'companysettings',
    'subscriptions', 'licenses', 'featureflags', 'formconfigs', 'billconfigs',
    'columnconfigs', 'notificationconfigs', 'reportconfigs', 'permissionmatrices',
  ];

  for (const name of collections) {
    try {
      if (mongoose.connection.collections[name]) {
        await mongoose.connection.collections[name].deleteMany({ companyId: company._id });
      }
    } catch {
      /* collection may not exist */
    }
  }

  // Also try model-based deletes for casing variants
  await Promise.allSettled([
    Subscription.deleteMany({ companyId: company._id }),
    License.deleteMany({ companyId: company._id }),
    CompanyModuleConfig.deleteMany({ companyId: company._id }),
    CompanySettings.deleteMany({ companyId: company._id }),
    User.deleteMany({ companyId: company._id, role: 'user' }),
  ]);

  await Company.findByIdAndDelete(company._id);

  await auditService.log(req || {}, 'delete', 'company', company._id, before, null, 'admin_cascade_delete');
  return { deleted: true, companyId: String(companyId), name: before.name };
}

async function changeCompanyPlan(companyId, planId, { req, reconcileModules = true } = {}) {
  const company = await Company.findById(companyId);
  if (!company) throw AppError.notFound('Company not found');
  const plan = await Plan.findById(planId);
  if (!plan) throw AppError.notFound('Plan not found');

  const before = { planId: company.planId };
  company.planId = plan._id;
  await company.save();

  await Subscription.findOneAndUpdate(
    { companyId },
    { planId: plan._id },
    { sort: { createdAt: -1 } }
  );

  if (reconcileModules) {
    const planMods = plan.features?.modules || {};
    const modules = { ...defaults.DEFAULT_MODULES };
    for (const key of Object.keys(modules)) {
      if (key === 'masters' || key === 'utilities') continue;
      if (Object.prototype.hasOwnProperty.call(planMods, key)) {
        modules[key] = planMods[key] === true;
      }
    }
    await CompanyModuleConfig.findOneAndUpdate(
      { companyId },
      { $set: { modules, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  await dunningService.clearDunningFlags(companyId);
  await auditService.log(req || {}, 'update', 'subscription', companyId, before, { planId, planName: plan.name }, 'plan_change');

  return {
    companyId,
    plan: { id: plan._id, name: plan.name },
    modulesReconciled: !!reconcileModules,
  };
}

module.exports = {
  exportCompanyData,
  deleteCompanyCascade,
  changeCompanyPlan,
};
