/**
 * Recompute purchase GST heads from company vs supplier geography (fixes demo misclassification).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { recalcPurchaseTotals } = require('../utils/purchaseTotals');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Company = require('../models/Company');
  const Purchase = require('../models/Purchase');
  const Party = require('../models/Party');
  const Item = require('../models/Item');
  const gstConfigService = require('../services/gstConfigService');

  const company = await Company.findOne({ isQaTenant: true, qaProfile: 'demo' });
  if (!company) throw new Error('demo company missing');
  const companyId = company._id;
  const cfg = await gstConfigService.getOrCreate(companyId);

  const purchases = await Purchase.find({
    companyId,
    status: { $ne: 'cancelled' },
    isDeleted: { $ne: true },
  });

  let fixed = 0;
  let unchanged = 0;
  for (const purchase of purchases) {
    const supplier = await Party.findOne({ _id: purchase.supplierId, companyId }).lean();
    let gstRate = purchase.gstRate || purchase.gstPer;
    if (gstRate == null && purchase.items?.[0]?.itemId) {
      const it = await Item.findOne({ _id: purchase.items[0].itemId, companyId }).select('gstRate').lean();
      gstRate = it?.gstRate ?? 5;
    }
    const totals = recalcPurchaseTotals(purchase.items || [], {
      gstType: purchase.gstType || 'CGST+SGST',
      gstRate: gstRate ?? 5,
      extras: purchase.toObject ? purchase.toObject() : purchase,
      companyGstin: cfg.gstin,
      companyStateCode: cfg.stateCode,
      partyGstin: supplier?.gstin,
      partyStateCode: supplier?.stateCode || supplier?.state,
      reverseCharge: purchase.reverseCharge === 'Yes' || purchase.reverseCharge === true || !!purchase.rcmCharge,
    });

    const before = `${purchase.gstType}|${purchase.cgst}|${purchase.sgst}|${purchase.igst}`;
    purchase.items = totals.items;
    purchase.taxableAmount = totals.taxableAmount;
    purchase.gstType = totals.gstType;
    purchase.cgst = totals.cgst;
    purchase.sgst = totals.sgst;
    purchase.igst = totals.igst;
    purchase.gstAmount = totals.gstAmount;
    purchase.netAmount = totals.netAmount;
    const after = `${purchase.gstType}|${purchase.cgst}|${purchase.sgst}|${purchase.igst}`;
    if (before !== after) {
      await purchase.save();
      fixed += 1;
    } else {
      unchanged += 1;
    }
  }

  console.log(JSON.stringify({ companyId: String(companyId), fixed, unchanged, total: purchases.length }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
