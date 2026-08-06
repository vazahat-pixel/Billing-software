const mongoose = require('mongoose');
const Company = require('./models/Company');
const User = require('./models/User');
const Purchase = require('./models/Purchase');
const Sales = require('./models/Sales');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('\n=== SEARCHING FOR YOUR OLD COMPANY DATA ===\n');

    // Search by email
    const ownerUser = await User.findOne({email: 'owner208432@textileerp.com'}).select('companyId name email');

    if (ownerUser) {
      console.log(`✅ Found user: ${ownerUser.email}`);
      console.log(`   Company ID: ${ownerUser.companyId}`);

      const company = await Company.findById(ownerUser.companyId).select('name _id');
      if (company) {
        console.log(`   Company: ${company.name}`);

        // Count data
        const purchases = await Purchase.countDocuments({companyId: company._id});
        const sales = await Sales.countDocuments({companyId: company._id});

        console.log(`\n   📊 Data in this company:`);
        console.log(`   - Purchases: ${purchases}`);
        console.log(`   - Sales: ${sales}`);

        if (purchases > 0 || sales > 0) {
          console.log(`\n   ✅ OLD DATA FOUND! Use Company ID: ${company._id}`);
          process.exit(0);
        }
      }
    }

    // If not found, search all companies
    console.log('\n=== ALL COMPANIES WITH DATA ===');
    const allCompanies = await Company.find().select('_id name');

    for (const company of allCompanies) {
      const purchases = await Purchase.countDocuments({companyId: company._id});
      const sales = await Sales.countDocuments({companyId: company._id});

      if (purchases > 0 || sales > 0) {
        console.log(`\n✅ ${company.name} (${company._id})`);
        console.log(`   Purchases: ${purchases}, Sales: ${sales}`);
      }
    }

    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
