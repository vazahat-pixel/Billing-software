const mongoose = require('mongoose');
const User = require('./models/User');
const Company = require('./models/Company');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Get existing company
    const company = await Company.findOne().select('_id');
    if (!company) {
      console.log('ERROR: No company exists. Run seed:all first!');
      process.exit(1);
    }

    // Delete old incorrect user
    await User.deleteOne({email: 'qa.dev.admin@textileerp.dev'});
    console.log('Deleted old user');

    // Create NEW user properly (password will be hashed by pre-save hook)
    const user = new User({
      name: 'QA Admin',
      email: 'qa.dev.admin@textileerp.dev',
      password: 'QaTenant@123', // Plain password - will be hashed by pre-save
      role: 'user',
      companyRole: 'admin',
      companyId: company._id,
      isActive: true
    });

    await user.save(); // This triggers the pre-save hook that hashes the password

    console.log('✅ User created successfully!');
    console.log(`Email: qa.dev.admin@textileerp.dev`);
    console.log(`Password: QaTenant@123`);
    console.log(`Company: ${company._id}`);

    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
