'use strict';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const user = await User.findOne({ email: 'qa.dev.admin@textileerp.dev' });
  console.log('Found user:', user ? { _id: user._id, email: user.email, name: user.name, companyId: user.companyId, hasPassword: !!user.password } : 'NONE');
  if (user) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('QaTenant@123', salt);
    await User.updateOne({ _id: user._id }, { $set: { password: hash } });
    console.log('Updated password to QaTenant@123 successfully!');
  } else {
    console.log('User not found!');
  }
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
