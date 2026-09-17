/**
 * Verify sale/purchase GST accuracy against the same totals engines the API uses.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { recalcSalesTotals } = require('../utils/salesTotals');
const { recalcPurchaseTotals } = require('../utils/purchaseTotals');
const { validateGstin } = require('../utils/gstDetermination');

const round2 = (n) => Number(Number(n || 0).toFixed(2));
const nearly = (a, b, tol = 0.05) => Math.abs(Number(a || 0) - Number(b || 0)) <= tol;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Company = require('../models/Company');
  const CompanySettings = require('../models/CompanySettings');
  const Sales = require('../models/Sales');
  const Purchase = require('../models/Purchase');
  const Party = require('../models/Party');

  const company = await Company.findOne({ isQaTenant: true, qaProfile: 'demo' });
  if (!company) throw new Error('demo company missing');
  const companyId = company._id;
  const settings = await CompanySettings.findOne({ companyId }).lean();
  const companyGstin = settings?.gstin || '';
  const companyState = settings?.stateCode || '24';

  const sales = await Sales.find({ companyId, status: { $ne: 'cancelled' }, isDeleted: { $ne: true } }).lean();
  const purchases = await Purchase.find({ companyId, status: { $ne: 'cancelled' }, isDeleted: { $ne: true } }).lean();

  const partyIds = [
    ...new Set([
      ...sales.map((s) => String(s.customerId || '')),
      ...purchases.map((p) => String(p.supplierId || '')),
    ].filter(Boolean)),
  ];
  const parties = await Party.find({ _id: { $in: partyIds } }).lean();
  const partyMap = new Map(parties.map((p) => [String(p._id), p]));

  function checkSale(doc) {
    const party = partyMap.get(String(doc.customerId));
    const expected = recalcSalesTotals(doc.items || [], {
      gstType: doc.gstType,
      gstRate: doc.gstRate || 5,
      companyGstin,
      companyStateCode: companyState,
      partyGstin: party?.gstin,
      partyStateCode: party?.stateCode || party?.state,
      extras: {
        freight: doc.freight,
        foldLess: doc.foldLess,
        foldLessSign: doc.foldLessSign,
        rdAmt: doc.rdAmt,
        rdAmtSign: doc.rdAmtSign,
        discountAmt: doc.discountAmt,
        discountSign: doc.discountSign,
        lessAmt: doc.lessAmt,
        lessSign: doc.lessSign,
        addAmt: doc.addAmt,
        addSign: doc.addSign,
        tcsAmount: doc.tcsAmount,
        roundOff: doc.roundOff,
        cessRate: doc.cessRate,
      },
    });
    const issues = [];
    if (!nearly(doc.taxableAmount, expected.taxableAmount, 1)) {
      issues.push({ field: 'header.taxableAmount', invoice: doc.invoiceNo, got: doc.taxableAmount, expected: expected.taxableAmount });
    }
    if (!nearly(doc.cgst, expected.cgst, 1)) {
      issues.push({ field: 'header.cgst', invoice: doc.invoiceNo, got: doc.cgst, expected: expected.cgst });
    }
    if (!nearly(doc.sgst, expected.sgst, 1)) {
      issues.push({ field: 'header.sgst', invoice: doc.invoiceNo, got: doc.sgst, expected: expected.sgst });
    }
    if (!nearly(doc.igst, expected.igst, 1)) {
      issues.push({ field: 'header.igst', invoice: doc.invoiceNo, got: doc.igst, expected: expected.igst });
    }
    if (doc.gstAmount != null && !nearly(doc.gstAmount, expected.gstAmount, 0.5)) {
      issues.push({ field: 'header.gstAmount', invoice: doc.invoiceNo, got: doc.gstAmount, expected: expected.gstAmount });
    }
    const type = String(doc.gstType || '');
    if (type.includes('IGST') && (Number(doc.cgst || 0) > 0.05 || Number(doc.sgst || 0) > 0.05)) {
      issues.push({ field: 'gstType', invoice: doc.invoiceNo, got: 'IGST with CGST/SGST', expected: 'IGST only' });
    }
    if (type.includes('CGST') && Number(doc.igst || 0) > 0.05) {
      issues.push({ field: 'gstType', invoice: doc.invoiceNo, got: 'CGST+SGST with IGST', expected: 'no IGST' });
    }
    return issues;
  }

  function checkPurchase(doc) {
    const party = partyMap.get(String(doc.supplierId));
    const expected = recalcPurchaseTotals(doc.items || [], {
      gstType: doc.gstType,
      gstRate: doc.gstRate || 5,
      companyGstin,
      companyStateCode: companyState,
      partyGstin: party?.gstin,
      partyStateCode: party?.stateCode || party?.state,
      reverseCharge: doc.reverseCharge === 'Yes' || doc.rcmCharge,
      extras: {
        invoiceType: doc.invoiceType,
        freight: doc.freight,
        discountAmt: doc.discountAmt,
        discountSign: doc.discountSign,
        lessAmt: doc.lessAmt,
        lessSign: doc.lessSign,
        addAmt: doc.addAmt,
        addSign: doc.addSign,
        octroi: doc.octroi,
        octroiSign: doc.octroiSign,
        rdAmt: doc.rdAmt,
        tdsAmount: doc.tdsAmount,
        tcsAmt: doc.tcsAmt,
        roundOff: doc.roundOff,
        cessRate: doc.cessRate,
        reverseCharge: doc.reverseCharge,
        rcmCharge: doc.rcmCharge,
      },
    });
    const issues = [];
    if (!nearly(doc.taxableAmount, expected.taxableAmount, 1)) {
      issues.push({ field: 'header.taxableAmount', invoice: doc.invoiceNo, got: doc.taxableAmount, expected: expected.taxableAmount });
    }
    if (!nearly(doc.cgst, expected.cgst, 1)) {
      issues.push({ field: 'header.cgst', invoice: doc.invoiceNo, got: doc.cgst, expected: expected.cgst });
    }
    if (!nearly(doc.sgst, expected.sgst, 1)) {
      issues.push({ field: 'header.sgst', invoice: doc.invoiceNo, got: doc.sgst, expected: expected.sgst });
    }
    if (!nearly(doc.igst, expected.igst, 1)) {
      issues.push({ field: 'header.igst', invoice: doc.invoiceNo, got: doc.igst, expected: expected.igst });
    }
    if (doc.gstAmount != null && !nearly(doc.gstAmount, expected.gstAmount, 0.5)) {
      issues.push({ field: 'header.gstAmount', invoice: doc.invoiceNo, got: doc.gstAmount, expected: expected.gstAmount });
    }
    return issues;
  }

  const saleIssues = sales.flatMap(checkSale);
  const purchaseIssues = purchases.flatMap(checkPurchase);

  let api = { ok: false };
  try {
    const base = process.env.API_BASE || 'http://127.0.0.1:5050';
    const email = process.env.DEMO_ADMIN_EMAIL || 'qa.dev.admin@textileerp.dev';
    const password = process.env.DEMO_ADMIN_PASSWORD || 'Admin@123';
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson?.token || loginJson?.data?.token;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const [salesRes, purRes, g1Res] = await Promise.all([
      fetch(`${base}/api/sales?limit=500`, { headers }).then((r) => r.json()),
      fetch(`${base}/api/purchases?limit=500`, { headers }).then((r) => r.json()),
      fetch(`${base}/api/gst/gstr1?period=2026-09`, { headers }).then((r) => r.json()).catch(() => null),
    ]);
    const salesList = salesRes?.data?.docs || salesRes?.data || salesRes?.docs || [];
    const purList = purRes?.data?.docs || purRes?.data || purRes?.docs || [];
    const salesArr = Array.isArray(salesList) ? salesList : [];
    const purArr = Array.isArray(purList) ? purList : [];
    const dbSaleTaxable = round2(sales.reduce((a, s) => a + Number(s.taxableAmount || 0), 0));
    const dbPurTaxable = round2(purchases.reduce((a, s) => a + Number(s.taxableAmount || 0), 0));
    const salesApiTaxable = round2(salesArr.reduce((a, s) => a + Number(s.taxableAmount || 0), 0));
    const purchaseApiTaxable = round2(purArr.reduce((a, s) => a + Number(s.taxableAmount || 0), 0));
    api = {
      ok: true,
      loginCompany: String(loginJson?.user?.companyId || loginJson?.data?.user?.companyId || ''),
      salesApiCount: salesArr.length,
      purchaseApiCount: purArr.length,
      salesApiTaxable,
      purchaseApiTaxable,
      dbSaleTaxable,
      dbPurTaxable,
      salesApiMatchesDb: nearly(salesApiTaxable, dbSaleTaxable, 1),
      purchaseApiMatchesDb: nearly(purchaseApiTaxable, dbPurTaxable, 1),
      gstr1Status: !!(g1Res?.success || g1Res?.data),
      gstr1Taxable: g1Res?.data?.totals?.taxable ?? g1Res?.data?.totals?.taxableSupply ?? null,
    };
  } catch (err) {
    api = { ok: false, error: err.message };
  }

  const out = {
    company: company.name,
    companyGstinValid: String(companyGstin).length === 15,
    counts: { sales: sales.length, purchases: purchases.length },
    accuracy: {
      saleIssueCount: saleIssues.length,
      purchaseIssueCount: purchaseIssues.length,
      saleSampleIssues: saleIssues.slice(0, 5),
      purchaseSampleIssues: purchaseIssues.slice(0, 5),
      salesAccurate: saleIssues.length === 0,
      purchasesAccurate: purchaseIssues.length === 0,
    },
    api,
  };
  console.log(JSON.stringify(out, null, 2));
  await mongoose.disconnect();
  process.exit(out.accuracy.salesAccurate && out.accuracy.purchasesAccurate ? 0 : 2);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
