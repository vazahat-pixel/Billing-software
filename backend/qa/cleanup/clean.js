const User = require('../../models/User');
const Company = require('../../models/Company');
const Subscription = require('../../models/Subscription');
const License = require('../../models/License');
const { truncateTenant } = require('./truncate');

async function cleanQaTenant(companyId) {
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
