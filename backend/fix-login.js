const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Check if user exists
    const email = 'qa.dev.admin@textileerp.dev';
    const user = await User.findOne({email});

    if (!user) {
      console.log('User NOT found. Creating now...');
      const password = 'QaTenant@123';
      const hash = await bcrypt.hash(password, 10);

      // Get a company ID from database
      const Company = require('./models/Company');
      const company = await Company.findOne().select('_id');

      if (!company) {
        console.log('ERROR: No company found. Run seed:all first!');
        process.exit(1);
      }

      const newUser = await User.create({
        email,
        name: 'QA Admin User',
        password: hash,
        role: 'user',
        companyRole: 'admin',
        companyId: company._id,
        isActive: true,
      });

      console.log('✅ User created successfully!');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      console.log(`Company: ${company._id}`);
    } else {
      console.log('✅ User exists!');
      console.log(`Email: ${user.email}`);
      console.log(`Name: ${user.name}`);
      console.log(`Role: ${user.companyRole}`);
      console.log(`Company: ${user.companyId}`);

      // Reset password just to be sure
      const password = 'QaTenant@123';
      const hash = await bcrypt.hash(password, 10);
      user.password = hash;
      await user.save();
      console.log(`✅ Password reset to: ${password}`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Done! Try logging in now.');
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
