/**
 * Module-gate shadow report.
 *
 * Run this after leaving the gate in shadow mode for a few days to see what
 * enforcement would actually block, before flipping MODULE_GATE_ENFORCE=true.
 *
 *   node scripts/moduleGateReport.js
 *
 * It reads no logs — it recomputes entitlements for every company, so it shows
 * the same verdict the gate would reach on the next request.
 */
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI missing in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const Company = require('../models/Company');
  const Plan = require('../models/Plan');
  const entitlementService = require('../services/entitlementService');
  const { MODULE_LABELS } = require('../middlewares/moduleGate.middleware');

  const plans = await Plan.find().lean();
  console.log(`\nPLANS (${plans.length})`);
  console.log('-'.repeat(78));
  for (const p of plans) {
    const m = p.features?.modules || {};
    const sold = Object.entries(m).filter(([, v]) => v === true).map(([k]) => k);
    const notSold = Object.entries(m).filter(([, v]) => v !== true).map(([k]) => k);
    console.log(`${String(p.name).padEnd(10)} sells: ${sold.join(', ') || '(nothing)'}`);
    if (notSold.length) console.log(`${' '.repeat(10)} locks: ${notSold.join(', ')}`);
  }

  const companies = await Company.find().populate('planId').lean();
  console.log(`\nCOMPANIES (${companies.length}) — verdict if MODULE_GATE_ENFORCE=true`);
  console.log('-'.repeat(78));

  let atRisk = 0;
  for (const c of companies) {
    const ent = await entitlementService.resolve(c._id, { fresh: true });
    const blocked = Object.entries(ent.modules)
      .filter(([, v]) => v === false)
      .map(([k]) => MODULE_LABELS[k] || k);

    const severe = blocked.length >= 5 || !ent.isUsable;
    if (severe) atRisk += 1;

    console.log(
      `${String(c.name).slice(0, 22).padEnd(22)} ` +
      `plan=${String(c.planId?.name || 'NONE').padEnd(9)} ` +
      `status=${ent.status.padEnd(9)} ` +
      `days=${String(ent.daysLeft ?? '-').padEnd(4)} ` +
      `blocked=[${blocked.join(', ') || 'none'}]` +
      (severe ? '   <-- REVIEW BEFORE ENFORCING' : '')
    );
  }

  console.log('-'.repeat(78));
  if (atRisk) {
    console.log(`\n${atRisk} company(ies) would lose most of the product. Fix their plan or`);
    console.log('company status before setting MODULE_GATE_ENFORCE=true.\n');
  } else {
    console.log('\nNo company would be badly affected. Safe to enforce.\n');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('Report failed:', e.message);
  process.exit(1);
});
