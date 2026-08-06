const mongoose = require('mongoose');
const User = require('./models/User');
const Company = require('./models/Company');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = 'owner208432@textileerp.com';
    const password = 'Owner@i9z92o9';
    const name = 'Owner User';

    console.log(`Creating user for: ${email}`);

    // Find or create company
    let company = await Company.findOne().sort({createdAt: -1});

    if (!company) {
      console.log('No company found. Creating new one...');
      company = await Company.create({
        name: 'Textile Company',
        status: 'active'
      });
    }

    console.log(`Using company: ${company.name} (${company._id})`);

    // Delete if exists
    await User.deleteOne({email});

    // Create user with plain password (will be hashed by pre-save hook)
    const user = new User({
      name,
      email,
      password, // Plain password
      role: 'user',
      companyRole: 'owner',
      companyId: company._id,
      isActive: true
    });

    await user.save(); // pre-save hook hashes password

    console.log(`✅ User created successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Company: ${company.name}`);
    console.log(`Company ID: ${company._id}`);

    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
