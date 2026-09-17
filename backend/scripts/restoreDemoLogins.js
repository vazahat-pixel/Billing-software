/**
 * Restore stable demo logins after QA wipe / password drift.
 * Usage: node scripts/restoreDemoLogins.js
 *
 * Does NOT delete companies. Only upserts known demo users + unlocks them.
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Company = require('../models/Company');
const { warnIfSharedLiveDatabase } = require('../utils/mongoSafety');

const DEMO = {
  superAdmin: {
    email: process.env.ADMIN_EMAIL || 'admin@textileerp.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
    name: 'Super Admin',
    role: 'super_admin',
  },
  qaAdmin: {
    email: 'qa.dev.admin@textileerp.dev',
    password: process.env.QA_DEFAULT_PASSWORD || 'Admin@123',
    name: 'QA Admin',
    role: 'user',
    companyRole: 'admin',
  },
  owner: {
    email: 'user@textileerp.com',
    password: 'User@123',
    name: 'Test User',
    role: 'user',
    companyRole: 'owner',
  },
};

async function upsertUser(spec, companyId = null) {
  let user = await User.findOne({ email: spec.email }).select('+password');
  if (!user) {
    user = new User({
      name: spec.name,
      email: spec.email,
      password: spec.password,
      role: spec.role,
      companyRole: spec.companyRole || 'owner',
      companyId: companyId || null,
      isActive: true,
    });
  } else {
    user.name = spec.name;
    user.role = spec.role;
    if (spec.companyRole) user.companyRole = spec.companyRole;
    if (companyId) user.companyId = companyId;
    user.isActive = true;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.password = spec.password; // pre-save hashes
  }
  await user.save();
  return user;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software');
  console.log('connected', mongoose.connection.host, mongoose.connection.name);
  const warn = warnIfSharedLiveDatabase();
  if (warn) console.warn('[WARN]', warn);

  const admin = await upsertUser(DEMO.superAdmin, null);
  console.log('super_admin OK', admin.email);

  // Prefer an existing non-QA company for owner/qa, else any company
  let company =
    (await Company.findOne({ isQaTenant: { $ne: true } }).sort({ createdAt: -1 })) ||
    (await Company.findOne().sort({ createdAt: -1 }));

  if (!company) {
    console.warn('No company in DB — only super_admin restored. Create a company from Admin panel.');
  } else {
    console.log('using company', company.name, String(company._id));
    const qa = await upsertUser(DEMO.qaAdmin, company._id);
    console.log('qa admin OK', qa.email, 'password=', DEMO.qaAdmin.password);
    const owner = await upsertUser(DEMO.owner, company._id);
    console.log('owner OK', owner.email);
  }

  const companies = await Company.countDocuments();
  const users = await User.countDocuments();
  console.log({ companies, users });
  console.log('\nLogin with:');
  console.log('  Admin:', DEMO.superAdmin.email, '/', DEMO.superAdmin.password);
  console.log('  ERP:  ', DEMO.qaAdmin.email, '/', DEMO.qaAdmin.password);
  console.log('  Owner:', DEMO.owner.email, '/', DEMO.owner.password);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
