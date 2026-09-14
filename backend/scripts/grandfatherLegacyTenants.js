/**
 * One-shot: mark all existing companies as legacy_open so flipping
 * MODULE_GATE_ENFORCE / PLAN_LIMIT_ENFORCE never breaks live books.
 *
 *   node scripts/grandfatherLegacyTenants.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('../models/Company');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software';
  await mongoose.connect(uri);
  const r = await Company.updateMany(
    { $or: [{ commercialPolicy: { $exists: false } }, { commercialPolicy: null }] },
    { $set: { commercialPolicy: 'legacy_open' } }
  );
  console.log(`Grandfathered ${r.modifiedCount} companies as legacy_open (${r.matchedCount} matched).`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
