const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runDiscovery() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const User = require('../models/User');
    const Company = require('../models/Company');
    const Party = require('../models/Party');
    const Item = require('../models/Item');
    const GstConfig = require('../models/GstConfig');
    const Book = require('../models/Book');
    const LedgerMaster = require('../models/LedgerMaster');
    const Warehouse = require('../models/Warehouse');

    console.log('--- USER LOOKUP ---');
    const user = await User.findOne({ email: 'qa.dev.admin@textileerp.dev' }).lean();
    if (!user) {
      console.log('User qa.dev.admin@textileerp.dev NOT FOUND!');
      const anyUsers = await User.find({}).limit(5).select('email role companyId').lean();
      console.log('Sample users:', anyUsers);
    } else {
      console.log('Found user:', { id: user._id, email: user.email, name: user.name, role: user.role, companyId: user.companyId });
      
      const company = await Company.findById(user.companyId).lean();
      console.log('\n--- COMPANY LOOKUP ---');
      console.log(company);

      const gstConfig = await GstConfig.findOne({ companyId: user.companyId }).lean();
      console.log('\n--- GST CONFIG ---');
      console.log(gstConfig);

      const parties = await Party.find({ companyId: user.companyId }).limit(10).lean();
      console.log(`\n--- PARTIES (${parties.length}) ---`);
      parties.forEach(p => console.log(`- ${p.name} | Type: ${p.partyType || p.type} | GSTIN: ${p.gstin} | State: ${p.state}`));

      const items = await Item.find({ companyId: user.companyId }).limit(10).lean();
      console.log(`\n--- ITEMS (${items.length}) ---`);
      items.forEach(i => console.log(`- ${i.name} | HSN: ${i.hsn || i.hsnCode} | GST%: ${i.gstRate || i.taxRate}`));

      const books = await Book.find({ companyId: user.companyId }).lean();
      console.log(`\n--- BOOKS (${books.length}) ---`);
      books.forEach(b => console.log(`- ${b.name} | Type: ${b.bookType || b.type}`));

      const ledgers = await LedgerMaster.find({ companyId: user.companyId }).limit(10).lean();
      console.log(`\n--- LEDGERS (${ledgers.length}) ---`);
      ledgers.forEach(l => console.log(`- ${l.name} | Group: ${l.group || l.accountGroup}`));

      const warehouses = await Warehouse.find({ companyId: user.companyId }).lean();
      console.log(`\n--- WAREHOUSES (${warehouses.length}) ---`);
      warehouses.forEach(w => console.log(`- ${w.name} | Code: ${w.code}`));
    }
  } catch (err) {
    console.error('Discovery error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runDiscovery();
