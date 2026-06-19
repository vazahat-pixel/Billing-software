/**
 * Backfill dynamic config for all existing companies.
 * Run: node backend/scripts/seedDynamicConfig.js
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Company = require('../models/Company');
const configService = require('../services/configService');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software');
  console.log('Connected to MongoDB');

  const companies = await Company.find({});
  console.log(`Found ${companies.length} companies`);

  for (const company of companies) {
    console.log(`Seeding config for: ${company.name} (${company._id})`);
    await configService.seedCompanyDefaults(company._id);
    const bundle = await configService.getActiveConfigBundle(company._id);
    console.log(`  → bundle v${bundle.bundleVersion}, hash ${bundle.configHash}`);
  }

  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
