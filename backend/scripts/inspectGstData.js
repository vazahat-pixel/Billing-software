const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Company = require('../models/Company');
    const Sales = require('../models/Sales');
    const Purchase = require('../models/Purchase');
    const Party = require('../models/Party');

    const companies = await Company.find({ isDeleted: { $ne: true } }).lean();
    console.log(`FOUND ${companies.length} COMPANIES:`);
    for (const c of companies) {
      const salesCount = await Sales.countDocuments({ companyId: c._id });
      const purchCount = await Purchase.countDocuments({ companyId: c._id });
      const partyCount = await Party.countDocuments({ companyId: c._id });
      console.log(`- Company: "${c.name || c.legalName}" | ID: ${c._id} | GSTIN: ${c.gstin || 'NONE'} | Sales: ${salesCount} | Purchases: ${purchCount} | Parties: ${partyCount}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
