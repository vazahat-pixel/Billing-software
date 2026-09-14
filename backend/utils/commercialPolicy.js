/**
 * Per-tenant commercial policy — protects existing business tenants.
 *
 *   legacy_open   — existing customers: global MODULE_GATE / PLAN_LIMIT flags
 *                   may log, but never hard-block (sales/purchase/GST keep working).
 *   saas_enforced — new SaaS signups / admin-provisioned SaaS tenants: when the
 *                   matching global flag is true, gates actually refuse.
 */
const Company = require('../models/Company');

const POLICY_LEGACY = 'legacy_open';
const POLICY_SAAS = 'saas_enforced';

async function getCommercialPolicy(companyId) {
  if (!companyId) return POLICY_LEGACY;
  const c = await Company.findById(companyId).select('commercialPolicy').lean();
  return c?.commercialPolicy === POLICY_SAAS ? POLICY_SAAS : POLICY_LEGACY;
}

/**
 * Hard-block only when BOTH the env flag is on AND the company opted into SaaS enforcement.
 * Legacy tenants never lose write access from a production flip of MODULE_GATE_ENFORCE.
 */
async function shouldHardEnforce(companyId, envFlagName) {
  const flagOn = String(process.env[envFlagName] || '').toLowerCase() === 'true';
  if (!flagOn) return false;
  const policy = await getCommercialPolicy(companyId);
  return policy === POLICY_SAAS;
}

module.exports = {
  POLICY_LEGACY,
  POLICY_SAAS,
  getCommercialPolicy,
  shouldHardEnforce,
};
