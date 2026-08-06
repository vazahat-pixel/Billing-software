const mongoose = require('mongoose');
const Company = require('./models/Company');
const Purchase = require('./models/Purchase');
const Sales = require('./models/Sales');
const Party = require('./models/Party');
const Item = require('./models/Item');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('\n=== ALL COMPANIES ===');
    const companies = await Company.find().select('_id name createdAt').sort({createdAt: -1});
    companies.forEach((c, i) => {
      console.log(`${i+1}. ${c.name} | ID: ${c._id} | Created: ${c.createdAt.toDateString()}`);
    });

    // Check each company for data
    console.log('\n=== DATA COUNT BY COMPANY ===');
    for (const company of companies) {
      const purchases = await Purchase.countDocuments({companyId: company._id});
      const sales = await Sales.countDocuments({companyId: company._id});
      const parties = await Party.countDocuments({companyId: company._id});
      const items = await Item.countDocuments({companyId: company._id});

      console.log(`\n${company.name} (${company._id}):`);
      console.log(`  - Purchases: ${purchases}`);
      console.log(`  - Sales: ${sales}`);
      console.log(`  - Parties: ${parties}`);
      console.log(`  - Items: ${items}`);
    }

    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
