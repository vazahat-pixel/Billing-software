const mongoose = require('mongoose');
const Party = require('./models/Party');
const Purchase = require('./models/Purchase');
const Sales = require('./models/Sales');
const Job = require('./models/Job');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const companyId = '6a71c3388e5cfd215ae02377';

    const partyCount = await Party.countDocuments({companyId});
    const purchaseCount = await Purchase.countDocuments({companyId});
    const salesCount = await Sales.countDocuments({companyId});
    const jobCount = await Job.countDocuments({companyId});

    const suppliers = await Party.countDocuments({companyId, type: 'Supplier'});
    const customers = await Party.countDocuments({companyId, type: 'Customer'});
    const jobWorkers = await Party.countDocuments({companyId, type: 'Job Worker'});

    console.log('\n=== DATA VERIFICATION ===');
    console.log(`Total Parties: ${partyCount}`);
    console.log(`  - Suppliers: ${suppliers}`);
    console.log(`  - Customers: ${customers}`);
    console.log(`  - Job Workers: ${jobWorkers}`);
    console.log(`Total Purchase Bills: ${purchaseCount}`);
    console.log(`Total Sales Invoices: ${salesCount}`);
    console.log(`Total Job Issues: ${jobCount}`);
    console.log('Company ID: ' + companyId);
    console.log('===========================\n');

    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
