const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = 'http://127.0.0.1:5050/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function debug() {
  await mongoose.connect(process.env.MONGO_URI);
  const Party = require('../models/Party');
  const Item = require('../models/Item');
  const Book = require('../models/Book');

  const supplier = await Party.findOne({ name: 'Test Supplier' });
  const greyItem = await Item.findOne({ name: 'Grey Fabric' });
  const purchaseBook = await Book.findOne({ code: 'PB01' });

  const loginRes = await req(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'qa.dev.admin@textileerp.dev',
      password: 'Admin@123'
    })
  });
  const token = (loginRes.data.data || loginRes.data).token;

  console.log('Testing HTTP POST /purchases with:');
  console.log('Supplier ID:', supplier._id.toString());
  console.log('Item ID:', greyItem._id.toString());

  const payload = {
    bookId: purchaseBook._id.toString(),
    supplierId: supplier._id.toString(),
    supplierName: supplier.name,
    invoiceNo: `QA-DBG-${Date.now()}`,
    items: [
      {
        itemId: greyItem._id.toString(),
        itemName: greyItem.name,
        quantity: 1000,
        rate: 50,
        amount: 50000,
        taxableAmount: 50000,
        gstRate: 5
      }
    ],
    taxableAmount: 50000,
    netAmount: 52500
  };

  const res = await req(`${BASE_URL}/purchases`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });

  console.log('Response Status:', res.status);
  console.log('Response Data:', JSON.stringify(res.data, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

debug();
