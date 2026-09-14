const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const Purchase = require('../models/Purchase');
  const Party = require('../models/Party');
  const Item = require('../models/Item');

  const supplier = await Party.findOne({ name: 'Test Supplier' });
  const item = await Item.findOne({ name: 'Grey Fabric' });

  console.log('Supplier:', supplier?._id, 'Item:', item?._id);

  const doc = new Purchase({
    companyId: supplier.companyId,
    supplierId: supplier._id,
    invoiceNo: 'TEST-PUR-001',
    taxableAmount: 50000,
    netAmount: 52500,
    items: [
      {
        itemId: item._id,
        quantity: 1000,
        rate: 50,
        amount: 50000
      }
    ]
  });

  const err = doc.validateSync();
  console.log('Validate sync error:', err ? err.errors : 'NONE');

  const purchaseService = require('../services/purchaseService');
  try {
    const res = await purchaseService.createPurchase({
      companyId: supplier.companyId,
      supplierId: supplier._id,
      invoiceNo: `QA-TEST-${Date.now()}`,
      items: [
        {
          itemId: item._id,
          quantity: 1000,
          rate: 50,
          amount: 50000
        }
      ]
    });
    console.log('PurchaseService createPurchase success! ID:', res._id);
  } catch (e) {
    console.error('PurchaseService error:', e);
  }

  await mongoose.disconnect();
  process.exit(0);
}

test();
