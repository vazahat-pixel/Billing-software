/**
 * Subscription dunning — remind owners before expiry, suspend after grace.
 * Manual renew remains admin-driven (no payment gateway).
 */
const Company = require('../models/Company');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const License = require('../models/License');
const entitlementService = require('./entitlementService');
const emailService = require('./emailService');
const auditService = require('./auditService');
const logger = require('../utils/logger');

const REMIND_DAYS = [14, 7, 3, 1];

function reminderKey(daysLeft) {
  return `dunning_remind_${daysLeft}`;
}

async function runDunningSweep() {
  const companies = await Company.find({ isActive: { $ne: false } }).select('_id name status ownerId').lean();
  const results = { checked: 0, reminded: 0, suspended: 0, errors: 0 };

  for (const c of companies) {
    results.checked += 1;
    try {
      const ent = await entitlementService.resolve(c._id, { fresh: true });
      const owner = c.ownerId
        ? await User.findById(c.ownerId).select('name email').lean()
        : await User.findOne({ companyId: c._id, companyRole: 'owner' }).select('name email').lean();

      if (!owner?.email) continue;

      const daysLeft = ent.daysLeft == null ? null : Number(ent.daysLeft);
      const status = ent.status || 'unknown';

      // Suspend when expired (beyond grace)
      if (status === 'expired' || (daysLeft != null && daysLeft < -Number(process.env.DUNNING_GRACE_DAYS || 7))) {
        if (c.status !== 'suspended') {
          await Company.findByIdAndUpdate(c._id, { status: 'suspended' });
          await Subscription.updateOne(
            { companyId: c._id },
            { $set: { status: 'expired' } }
          );
          await emailService.sendSubscriptionReminder({
            to: owner.email,
            name: owner.name,
            companyName: c.name,
            daysLeft: daysLeft ?? -1,
            status: 'suspended',
            renewHint: 'Account suspended. Ask your platform admin to renew licence/subscription.',
          });
          await auditService.logSystem({
            companyId: c._id,
            action: 'suspend',
            module: 'subscription',
            reason: 'dunning_expired',
            after: { status: 'suspended', daysLeft },
          });
          results.suspended += 1;
        }
        continue;
      }

      if (daysLeft == null) continue;
      if (!REMIND_DAYS.includes(daysLeft) && !(status === 'grace' && daysLeft <= 0)) continue;

      const metaKey = reminderKey(status === 'grace' ? 0 : daysLeft);
      const companyDoc = await Company.findById(c._id).select('meta');
      const meta = (companyDoc?.meta && typeof companyDoc.meta === 'object') ? { ...companyDoc.meta } : {};
      if (meta[metaKey]) continue; // already reminded for this bucket

      await emailService.sendSubscriptionReminder({
        to: owner.email,
        name: owner.name,
        companyName: c.name,
        daysLeft,
        status,
      });
      meta[metaKey] = new Date().toISOString();
      await Company.findByIdAndUpdate(c._id, { meta });
      results.reminded += 1;
    } catch (err) {
      results.errors += 1;
      logger.warn('dunning.company.failed', { companyId: String(c._id), error: err.message });
    }
  }

  logger.info('dunning.sweep.done', results);
  return results;
}

/** Clear dunning reminder flags after a successful renew. */
async function clearDunningFlags(companyId) {
  const company = await Company.findById(companyId).select('meta');
  if (!company) return;
  const meta = (company.meta && typeof company.meta === 'object') ? { ...company.meta } : {};
  Object.keys(meta).forEach((k) => {
    if (k.startsWith('dunning_')) delete meta[k];
  });
  company.meta = meta;
  company.markModified('meta');
  await company.save();
}

module.exports = {
  runDunningSweep,
  clearDunningFlags,
  REMIND_DAYS,
};
