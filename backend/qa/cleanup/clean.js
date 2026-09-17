const User = require('../../models/User');
const Company = require('../../models/Company');
const Subscription = require('../../models/Subscription');
const License = require('../../models/License');
const { truncateTenant } = require('./truncate');
const { assertDestructiveQaAllowed } = require('../../utils/mongoSafety');

async function cleanQaTenant(companyId) {
  assertDestructiveQaAllowed('cleanQaTenant');
  const comp = await Company.findById(companyId);
  if (comp && comp.isQaTenant !== true && process.env.ALLOW_TENANT_TRUNCATE !== 'true') {
    console.warn(`⚠️ [SAFETY SHIELD] Refusing to clean protected company: ${comp.name}`);
    return { companyId: String(companyId), cleaned: false, reason: 'Company is protected against deletion' };
  }
  await truncateTenant(companyId);
  await User.deleteMany({ companyId });
  await Subscription.deleteMany({ companyId });
  await License.deleteMany({ companyId });
  await Company.deleteOne({ _id: companyId });
  return { companyId: String(companyId), cleaned: true };
}

async function cleanByProfile(profileName) {
  const company = await Company.findOne({ isQaTenant: true, qaProfile: profileName });
  if (!company) return { cleaned: false, reason: 'No QA tenant for profile' };
  return cleanQaTenant(company._id);
}

module.exports = { cleanQaTenant, cleanByProfile };
