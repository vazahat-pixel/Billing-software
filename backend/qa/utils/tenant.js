const mongoose = require('mongoose');
const Company = require('../../models/Company');
const User = require('../../models/User');
const Plan = require('../../models/Plan');
const configService = require('../../services/configService');
const { loadEnv } = require('./db');

loadEnv();

async function ensureProPlan() {
  let plan = await Plan.findOne({ name: 'Pro' });
  if (!plan) {
    plan = await Plan.create({
      name: 'Pro',
      priceMonthly: 2999,
      priceYearly: 29999,
      features: {
        offlineMode: true,
        modules: {
          purchase: true,
          inventory: true,
          sales: true,
          jobWork: true,
          accounting: true,
          gst: true,
          reports: true,
          offline: true,
        },
      },
      limits: { users: 50, invoicesPerMonth: 50000, storageMb: 10240 },
    });
  }
  return plan;
}

async function findQaTenant(profileName) {
  return Company.findOne({ isQaTenant: true, qaProfile: profileName }).lean();
}

async function upgradeExistingTenantPlan(existing) {
  const proPlan = await ensureProPlan();
  if (String(existing.planId) !== String(proPlan._id)) {
    existing.planId = proPlan._id;
    await existing.save();
    const Subscription = require('../../models/Subscription');
    await Subscription.updateOne({ companyId: existing._id }, { planId: proPlan._id });
  }
}

async function getOrCreateQaTenant(profileName) {
  const existing = await Company.findOne({ isQaTenant: true, qaProfile: profileName });
  if (existing) {
    await upgradeExistingTenantPlan(existing);
    const owner = await User.findOne({ companyId: existing._id, companyRole: 'owner' });
    return { companyId: existing._id, userId: owner?._id, company: existing, created: false };
  }

  await ensureProPlan();
  const email = `qa.${profileName}@textileerp.dev`;
  const password = process.env.QA_DEFAULT_PASSWORD || 'QaTenant@123';
  const companyName = `QA ${profileName.toUpperCase()} Tenant`;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    await User.deleteOne({ _id: existingUser._id });
  }

  const authService = require('../../services/auth.service');
  const result = await authService.register('QA Owner', email, password, companyName);
  const proPlan = await ensureProPlan();
  const company = await Company.findById(result.user.companyId);
  company.planId = proPlan._id;
  company.isQaTenant = true;
  company.qaProfile = profileName;
  company.meta = {
    ...(company.meta || {}),
    industry: 'Textile',
    state: 'Gujarat',
    gstin: '24AAAAA0000A1Z5',
    city: 'Surat',
    address: 'QA Industrial Estate',
  };
  await company.save();

  const Subscription = require('../../models/Subscription');
  await Subscription.updateOne({ companyId: company._id }, { planId: proPlan._id });

  await configService.seedCompanyDefaults(company._id, result.user._id);

  return {
    companyId: company._id,
    userId: result.user._id,
    company,
    created: true,
    credentials: { email, password },
  };
}

async function resolveCompanyId(ctx) {
  if (ctx.companyId && mongoose.Types.ObjectId.isValid(ctx.companyId)) {
    const company = await Company.findById(ctx.companyId);
    if (!company) throw new Error(`Company not found: ${ctx.companyId}`);
    const owner = await User.findOne({ companyId: company._id, companyRole: 'owner' });
    ctx.userId = owner?._id;
    return company._id;
  }
  const tenant = await getOrCreateQaTenant(ctx.profile.name);
  ctx.companyId = tenant.companyId;
  ctx.userId = tenant.userId;
  ctx.masters.tenant = tenant;
  return tenant.companyId;
}

module.exports = {
  findQaTenant,
  getOrCreateQaTenant,
  resolveCompanyId,
  ensureProPlan,
};
