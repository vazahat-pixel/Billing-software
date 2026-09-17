/**
 * Diagnose + repair super admin login (dev only).
 * Usage: node scripts/fixSuperAdmin.js
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'admin@textileerp.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software');
  console.log('connected', mongoose.connection.host, mongoose.connection.name);

  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    console.log('admin missing — creating');
    user = await User.create({
      name: 'Super Admin',
      email,
      password,
      role: 'super_admin',
      isActive: true,
    });
    user = await User.findById(user._id).select('+password');
  }

  const looksHashed = /^\$2[aby]\$/.test(String(user.password || ''));
  const match = looksHashed ? await bcrypt.compare(password, user.password) : false;

  console.log({
    id: String(user._id),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    failedLoginAttempts: user.failedLoginAttempts,
    lockUntil: user.lockUntil,
    totpEnabled: user.totpEnabled,
    passwordLooksHashed: looksHashed,
    passwordMatchesDemo: match,
  });

  if (user.role !== 'super_admin' || !user.isActive || user.isLocked?.() || !match) {
    user.role = 'super_admin';
    user.isActive = true;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.totpEnabled = false;
    user.totpSecret = '';
    user.password = password; // pre-save hook will hash
    await user.save();
    console.log('REPAIRED: password reset to demo Admin@123, unlocked, role=super_admin');
  } else {
    console.log('OK: credentials already valid');
  }

  const verify = await User.findOne({ email }).select('+password');
  console.log('verify match', await bcrypt.compare(password, verify.password));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
