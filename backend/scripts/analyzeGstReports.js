/**
 * GST books analysis for demo tenant — aggregated totals only (no party PII dump).
 * Usage: node scripts/analyzeGstReports.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { periodKey, periodBounds, validateGstin } = require('../utils/gstDetermination');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Company = require('../models/Company');
  const CompanySettings = require('../models/CompanySettings');
  const Sales = require('../models/Sales');
  const Purchase = require('../models/Purchase');
  const Party = require('../models/Party');
  const gstReturnService = require('../services/gstReturnService');
  const gstService = require('../services/gstService');
  const gstinReportService = require('../services/gstinReportService');

  const company = await Company.findOne({ isQaTenant: true, qaProfile: 'demo' });
  if (!company) {
    console.error('Demo company not found');
    process.exit(1);
  }
  const companyId = company._id;
  const settings = await CompanySettings.findOne({ companyId }).lean();
  const companyGstinOk = validateGstin(settings?.gstin || company?.meta?.gstin || '');

  const [saleDates, purchaseDates] = await Promise.all([
    Sales.aggregate([
      { $match: { companyId, status: { $ne: 'cancelled' }, isDeleted: { $ne: true } } },
      { $group: { _id: null, min: { $min: '$date' }, max: { $max: '$date' }, n: { $sum: 1 } } },
    ]),
    Purchase.aggregate([
      { $match: { companyId, status: { $ne: 'cancelled' }, isDeleted: { $ne: true } } },
      { $group: { _id: null, min: { $min: '$date' }, max: { $max: '$date' }, n: { $sum: 1 } } },
    ]),
  ]);

  const minDate = new Date(
    Math.min(
      saleDates[0]?.min?.getTime() || Date.now(),
      purchaseDates[0]?.min?.getTime() || Date.now()
    )
  );
  const maxDate = new Date(
    Math.max(
      saleDates[0]?.max?.getTime() || Date.now(),
      purchaseDates[0]?.max?.getTime() || Date.now()
    )
  );

  // Build month list YYYY-MM
  const months = [];
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const endM = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (cursor <= endM) {
    months.push(periodKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const monthly = [];
  for (const period of months) {
    const g1 = await gstReturnService.buildGstr1(companyId, period);
    const g3 = await gstReturnService.buildGstr3b(companyId, period);
    const { startDate, endDate } = periodBounds(period);
    const g2 = await gstService.getGstr2(companyId, startDate, endDate);

    const b2bInv = (g1.payload.b2b || []).reduce((s, p) => s + (p.inv || []).length, 0);
    const b2cs = g1.payload.b2cs || [];
    const b2cl = g1.payload.b2cl || [];
    const cdnr = g1.payload.cdnr || [];
    const hsn = g1.payload.hsn?.data || g1.payload.hsn || [];
    const hsnRows = Array.isArray(hsn) ? hsn.length : 0;

    const g2Taxable = round2(g2.reduce((s, r) => s + Number(r.taxable || 0), 0));
    const g2Cgst = round2(g2.reduce((s, r) => s + Number(r.cgst || 0), 0));
    const g2Sgst = round2(g2.reduce((s, r) => s + Number(r.sgst || 0), 0));
    const g2Igst = round2(g2.reduce((s, r) => s + Number(r.igst || 0), 0));

    const t31 = g3.payload?.sup_details?.osup_det || g3.payload?.table31?.osup_det || null;
    const outward = g3.payload?.outward || g3.totals?.outward || {
      taxable: t31?.txval,
      cgst: t31?.camt,
      sgst: t31?.samt,
      igst: t31?.iamt,
    };
    const itc = g3.payload?.itc || g3.totals?.itc || g3.payload?.itc_elg?.itc_avl?.[0] || null;

    monthly.push({
      period,
      salesInPeriod: g1.totals?.invoiceCount ?? null,
      gstr1: {
        b2bInvoices: b2bInv,
        b2bParties: (g1.payload.b2b || []).length,
        b2csRows: Array.isArray(b2cs) ? b2cs.length : 0,
        b2clRows: Array.isArray(b2cl) ? b2cl.length : 0,
        cdnrParties: Array.isArray(cdnr) ? cdnr.length : 0,
        hsnRows,
        totals: g1.totals || null,
      },
      gstr2: {
        purchaseBills: g2.length,
        taxable: g2Taxable,
        cgst: g2Cgst,
        sgst: g2Sgst,
        igst: g2Igst,
        tax: round2(g2Cgst + g2Sgst + g2Igst),
      },
      gstr3b: {
        outwardTaxable: round2(outward?.taxable ?? outward?.txval ?? 0),
        outwardCgst: round2(outward?.cgst ?? outward?.camt ?? 0),
        outwardSgst: round2(outward?.sgst ?? outward?.samt ?? 0),
        outwardIgst: round2(outward?.igst ?? outward?.iamt ?? 0),
        itcCgst: round2(itc?.cgst ?? itc?.camt ?? 0),
        itcSgst: round2(itc?.sgst ?? itc?.samt ?? 0),
        itcIgst: round2(itc?.igst ?? itc?.iamt ?? 0),
        rawKeys: Object.keys(g3.payload || {}),
      },
    });
  }

  // Full-range books vs GSTR-1 reconciliation
  const from = minDate;
  const to = new Date(maxDate);
  to.setHours(23, 59, 59, 999);

  const sales = await Sales.find({
    companyId,
    status: { $ne: 'cancelled' },
    isDeleted: { $ne: true },
    date: { $gte: from, $lte: to },
  }).lean();

  const booksOutward = {
    count: sales.length,
    taxable: round2(sales.reduce((s, x) => s + Number(x.taxableAmount || 0), 0)),
    cgst: round2(sales.reduce((s, x) => s + Number(x.cgst || 0), 0)),
    sgst: round2(sales.reduce((s, x) => s + Number(x.sgst || 0), 0)),
    igst: round2(sales.reduce((s, x) => s + Number(x.igst || 0), 0)),
    withGstin: 0,
    withoutGstin: 0,
    igstInvoices: sales.filter((x) => String(x.gstType || '').includes('IGST')).length,
    cgstInvoices: sales.filter((x) => String(x.gstType || '').includes('CGST')).length,
  };

  const partyIds = [...new Set(sales.map((s) => String(s.customerId || '')).filter(Boolean))];
  const parties = await Party.find({ _id: { $in: partyIds } }).select('gstin').lean();
  const gstinMap = new Map(parties.map((p) => [String(p._id), p.gstin]));
  for (const s of sales) {
    if (gstinMap.get(String(s.customerId))) booksOutward.withGstin += 1;
    else booksOutward.withoutGstin += 1;
  }

  const gstr1Full = await gstService.getGstr1(companyId, from, to);
  const g1Taxable = round2(
    (gstr1Full.totals?.taxableAmount ?? gstr1Full.totals?.taxable ?? null) != null
      ? Number(gstr1Full.totals.taxableAmount ?? gstr1Full.totals.taxable)
      : (gstr1Full.invoices || []).reduce((s, r) => s + Number(r.taxable || 0), 0)
  );
  const g1Cgst = round2(
    gstr1Full.totals?.cgst ??
      (gstr1Full.invoices || []).reduce((s, r) => s + Number(r.cgst || 0), 0)
  );
  const g1Sgst = round2(
    gstr1Full.totals?.sgst ??
      (gstr1Full.invoices || []).reduce((s, r) => s + Number(r.sgst || 0), 0)
  );
  const g1Igst = round2(
    gstr1Full.totals?.igst ??
      (gstr1Full.invoices || []).reduce((s, r) => s + Number(r.igst || 0), 0)
  );

  let gstr1Errors = { errorCount: null, categories: [] };
  try {
    const err = await gstinReportService.checkGstr1Errors(companyId, from, to);
    const errors = err?.errors || err?.data?.errors || [];
    gstr1Errors = {
      errorCount: Array.isArray(errors) ? errors.length : null,
      categories: Array.isArray(errors)
        ? [...new Set(errors.map((e) => e.category || e.type || e.code || 'other'))].slice(0, 12)
        : [],
    };
  } catch (e) {
    gstr1Errors = { errorCount: null, categories: [], note: e.message };
  }

  // Zero-tax invoices (risk)
  const zeroTaxSales = sales.filter((s) => {
    const tax = Number(s.cgst || 0) + Number(s.sgst || 0) + Number(s.igst || 0) + Number(s.gstAmount || 0);
    return Number(s.taxableAmount || 0) > 0 && tax === 0;
  }).length;

  const zeroTaxPurchases = await Purchase.countDocuments({
    companyId,
    status: { $ne: 'cancelled' },
    isDeleted: { $ne: true },
    taxableAmount: { $gt: 0 },
    $expr: {
      $eq: [
        { $add: [{ $ifNull: ['$cgst', 0] }, { $ifNull: ['$sgst', 0] }, { $ifNull: ['$igst', 0] }] },
        0,
      ],
    },
  });

  const sumMonthlyOut = monthly.reduce(
    (a, m) => ({
      taxable: round2(a.taxable + m.gstr3b.outwardTaxable),
      cgst: round2(a.cgst + m.gstr3b.outwardCgst),
      sgst: round2(a.sgst + m.gstr3b.outwardSgst),
      igst: round2(a.igst + m.gstr3b.outwardIgst),
      itcCgst: round2(a.itcCgst + m.gstr3b.itcCgst),
      itcSgst: round2(a.itcSgst + m.gstr3b.itcSgst),
      itcIgst: round2(a.itcIgst + m.gstr3b.itcIgst),
      purchaseTax: round2(a.purchaseTax + m.gstr2.tax),
      purchaseTaxable: round2(a.purchaseTaxable + m.gstr2.taxable),
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, itcCgst: 0, itcSgst: 0, itcIgst: 0, purchaseTax: 0, purchaseTaxable: 0 }
  );

  const netPayable = {
    cgst: round2(sumMonthlyOut.cgst - sumMonthlyOut.itcCgst),
    sgst: round2(sumMonthlyOut.sgst - sumMonthlyOut.itcSgst),
    igst: round2(sumMonthlyOut.igst - sumMonthlyOut.itcIgst),
  };
  netPayable.total = round2(netPayable.cgst + netPayable.sgst + netPayable.igst);

  const report = {
    company: settings?.legalName || company.name,
    companyGstinValid: companyGstinOk.ok,
    dateRange: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    monthsCovered: months,
    books: {
      salesCount: saleDates[0]?.n || 0,
      purchaseCount: purchaseDates[0]?.n || 0,
      outward: booksOutward,
    },
    reconciliation: {
      booksTaxable: booksOutward.taxable,
      gstr1Taxable: g1Taxable,
      taxableDiff: round2(booksOutward.taxable - g1Taxable),
      booksCgst: booksOutward.cgst,
      gstr1Cgst: g1Cgst,
      cgstDiff: round2(booksOutward.cgst - g1Cgst),
      booksSgst: booksOutward.sgst,
      gstr1Sgst: g1Sgst,
      sgstDiff: round2(booksOutward.sgst - g1Sgst),
      booksIgst: booksOutward.igst,
      gstr1Igst: g1Igst,
      igstDiff: round2(booksOutward.igst - g1Igst),
    },
    fyRollup: sumMonthlyOut,
    netPayableApprox: netPayable,
    risks: {
      zeroTaxSales,
      zeroTaxPurchases,
      gstr1Errors,
    },
    monthly,
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
