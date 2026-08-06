const mongoose = require('mongoose');
const Company = require('./models/Company');
const Purchase = require('./models/Purchase');
const Sales = require('./models/Sales');
const Job = require('./models/Job');
const PaymentVoucher = require('./models/PaymentVoucher');
const User = require('./models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Get user's company
    const user = await User.findOne({email: 'owner208432@textileerp.com'});
    if (!user) {
      console.log('User not found!');
      process.exit(1);
    }

    const userCompanyId = user.companyId;
    console.log(`User company: ${userCompanyId}`);

    // Get newly created company (the one with most data)
    const newCompanies = await Company.find().sort({createdAt: -1}).limit(2);
    let newCompanyId = null;

    for (const c of newCompanies) {
      const count = await Purchase.countDocuments({companyId: c._id});
      if (count >= 40) {
        newCompanyId = c._id;
        console.log(`Found new company with data: ${newCompanyId}`);
        break;
      }
    }

    if (!newCompanyId) {
      console.log('No new company with data found!');
      process.exit(1);
    }

    // Migrate data
    console.log(`\nMigrating data from ${newCompanyId} to ${userCompanyId}...`);

    const purchases = await Purchase.updateMany(
      {companyId: newCompanyId},
      {$set: {companyId: userCompanyId}}
    );
    console.log(`✅ Purchases updated: ${purchases.modifiedCount}`);

    const sales = await Sales.updateMany(
      {companyId: newCompanyId},
      {$set: {companyId: userCompanyId}}
    );
    console.log(`✅ Sales updated: ${sales.modifiedCount}`);

    const jobs = await Job.updateMany(
      {companyId: newCompanyId},
      {$set: {companyId: userCompanyId}}
    );
    console.log(`✅ Jobs updated: ${jobs.modifiedCount}`);

    const payments = await PaymentVoucher.updateMany(
      {companyId: newCompanyId},
      {$set: {companyId: userCompanyId}}
    );
    console.log(`✅ Payments updated: ${payments.modifiedCount}`);

    console.log(`\n✅ MIGRATION COMPLETE!`);
    console.log(`All data now belongs to: ${userCompanyId}`);

    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
