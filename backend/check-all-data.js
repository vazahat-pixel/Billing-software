const mongoose = require('mongoose');
const Purchase = require('./models/Purchase');
const Sales = require('./models/Sales');
const Party = require('./models/Party');
const Job = require('./models/Job');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Get all data across all companies
    const totalPurchases = await Purchase.countDocuments();
    const totalSales = await Sales.countDocuments();
    const totalParties = await Party.countDocuments();
    const totalJobs = await Job.countDocuments();

    console.log('\n=== GLOBAL DATA COUNT ===');
    console.log(`Total Purchases: ${totalPurchases}`);
    console.log(`Total Sales: ${totalSales}`);
    console.log(`Total Parties: ${totalParties}`);
    console.log(`Total Jobs: ${totalJobs}`);

    // Get companies with the most data
    const purchasesByCompany = await Purchase.aggregate([
      { $group: { _id: '$companyId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    if (purchasesByCompany.length > 0) {
      const companyId = purchasesByCompany[0]._id;
      const count = purchasesByCompany[0].count;
      console.log(`\nLargest company by purchases: ${companyId} (${count} purchases)`);

      const purchases = await Purchase.countDocuments({companyId});
      const sales = await Sales.countDocuments({companyId});
      const parties = await Party.countDocuments({companyId});
      const jobs = await Job.countDocuments({companyId});

      console.log(`  - Sales: ${sales}`);
      console.log(`  - Parties: ${parties}`);
      console.log(`  - Jobs: ${jobs}`);
    }

    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
