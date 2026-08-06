const mongoose = require('mongoose');
const Company = require('./models/Company');
const Party = require('./models/Party');
const Purchase = require('./models/Purchase');
const Sales = require('./models/Sales');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const companies = await Company.find().select('_id name').sort({_id: -1}).limit(3);

    console.log('=== COMPANIES ===');
    for (const c of companies) {
      const parties = await Party.countDocuments({companyId: c._id});
      const purchases = await Purchase.countDocuments({companyId: c._id});
      const sales = await Sales.countDocuments({companyId: c._id});
      console.log(`\nID: ${c._id}`);
      console.log(`Name: ${c.name}`);
      console.log(`Parties: ${parties}, Purchases: ${purchases}, Sales: ${sales}`);
    }

    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
