/**
 * One-shot: upsert Harshika Tex Fab supplier + Finish CXP Border item
 * from sample purchase bill into all companies (or first if only one).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Party = require('../models/Party');
const Item = require('../models/Item');
const Company = require('../models/Company');

const SUPPLIER = {
  name: 'HARSHIKA TEX FAB',
  type: 'Supplier',
  gstin: '24HSVPB4011C1Z4',
  mobile: '8017599825',
  address: 'SHOP NO.-2023 SHREE KUBERJI DECK SAROLI ROAD, Surat SURAT 395010 GUJARAT',
  city: 'Surat',
  state: 'Gujarat',
  stateCode: '24',
  stateName: 'Gujarat',
  gstType: 'INVOICE (IN STATE)',
  status: 'Active',
};

const ITEM = {
  name: 'FINISH CXP BORDER',
  category: 'Finished',
  hsnCode: '60069000',
  gstRate: 5,
  unit: 'KGS',
  purchaseRate: 245,
  salesRate: 0,
};

async function upsertForCompany(companyId) {
  let party = await Party.findOne({
    companyId,
    $or: [{ gstin: SUPPLIER.gstin }, { name: SUPPLIER.name }],
  });
  if (party) {
    Object.assign(party, {
      name: SUPPLIER.name,
      type: party.type === 'Customer' ? 'Both' : party.type || 'Supplier',
      gstin: SUPPLIER.gstin,
      mobile: party.mobile || SUPPLIER.mobile,
      address: party.address || SUPPLIER.address,
      city: party.city || SUPPLIER.city,
      state: party.state || SUPPLIER.state,
      stateCode: party.stateCode || SUPPLIER.stateCode,
      stateName: party.stateName || SUPPLIER.stateName,
    });
    await party.save();
    console.log(`[${companyId}] party updated:`, party._id.toString());
  } else {
    const highest = await Party.findOne({ companyId }).sort({ accd: -1 });
    const nextAccd = highest && typeof highest.accd === 'number' ? highest.accd + 1 : 1001;
    party = await Party.create({ ...SUPPLIER, companyId, accd: nextAccd });
    console.log(`[${companyId}] party created:`, party._id.toString());
  }

  let item = await Item.findOne({
    companyId,
    $or: [{ name: ITEM.name }, { hsnCode: ITEM.hsnCode, name: new RegExp('CXP.?BORDER', 'i') }],
  });
  if (item) {
    Object.assign(item, {
      name: ITEM.name,
      hsnCode: ITEM.hsnCode,
      gstRate: ITEM.gstRate,
      purchaseRate: item.purchaseRate || ITEM.purchaseRate,
      unit: item.unit || ITEM.unit,
      category: item.category || ITEM.category,
    });
    await item.save();
    console.log(`[${companyId}] item updated:`, item._id.toString());
  } else {
    item = await Item.create({ ...ITEM, companyId });
    console.log(`[${companyId}] item created:`, item._id.toString());
  }

  return { partyId: party._id, itemId: item._id };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const companies = await Company.find({}).select('_id name').lean();
  if (!companies.length) {
    console.error('No companies found');
    process.exit(1);
  }
  console.log(`Companies: ${companies.length}`);
  for (const c of companies) {
    await upsertForCompany(c._id);
  }
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
