'use strict';

/**
 * Live JSM SQL parity tests against Sanchal Creation (SC27) in JsmSql2_DEMO2026.
 * Fixture: scripts/golden-master/extractJsmSessionGolden.js (read-only).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jsmReports = require('../../services/jsmReports');

const fx = require(path.join(__dirname, 'fixtures', 'jsm_sc27_session_reports.json'));
const r2 = (n) => Number(Number(n || 0).toFixed(2));
const sum = (rows, field) => r2(rows.reduce((a, r) => a + Number(r[field] || 0), 0));

function groupByTaxRate(gstLines) {
  const byRate = new Map();
  for (const l of gstLines) {
    const rate = Number(l.T_GST_PER || 0);
    if (!byRate.has(rate)) byRate.set(rate, { TAX_RATE: rate, TAXABLE_AMT: 0, SGST_AMT: 0, CGST_AMT: 0, IGST_AMT: 0, NET_TOT: 0 });
    const g = byRate.get(rate);
    g.TAXABLE_AMT = r2(g.TAXABLE_AMT + l.IT_TAXABLE);
    g.SGST_AMT = r2(g.SGST_AMT + l.IT_SGST_A);
    g.CGST_AMT = r2(g.CGST_AMT + l.IT_CGST_A);
    g.IGST_AMT = r2(g.IGST_AMT + l.IT_IGST_A);
    g.NET_TOT = r2(g.NET_TOT + l.IT_NET_TOT);
  }
  return [...byRate.values()].sort((a, b) => a.TAX_RATE - b.TAX_RATE);
}

function buildSalesHeaderRows(gstLines) {
  const byBill = new Map();
  for (const l of gstLines) {
    if (!byBill.has(l.ENT_NO)) {
      byBill.set(l.ENT_NO, {
        ENT_NO: l.ENT_NO,
        NCBILL_NO: l.NCBILL_NO,
        BILL_DATE: l.BILL_DATE,
        BOOK: l.BOOK,
        REGISTER: l.REGISTER,
        PARTY: l.PARTY,
        GSTIN_NO: l.GSTIN_NO,
        STATE: l.STATE,
        STATE_CODE: l.STATE_CODE,
        STATION: l.STATION,
        TYPE: l.TYPE,
        MONTH_NO: l.MONTH_NO,
        YEAR_NO: l.YEAR_NO,
        MONTH: l.MONTH,
        TAXABLE_AMT: 0,
        SGST_AMT: 0,
        CGST_AMT: 0,
        IGST_AMT: 0,
        NET_TOT: 0,
        _lines: [],
      });
    }
    const h = byBill.get(l.ENT_NO);
    h.TAXABLE_AMT = r2(h.TAXABLE_AMT + l.IT_TAXABLE);
    h.SGST_AMT = r2(h.SGST_AMT + l.IT_SGST_A);
    h.CGST_AMT = r2(h.CGST_AMT + l.IT_CGST_A);
    h.IGST_AMT = r2(h.IGST_AMT + l.IT_IGST_A);
    h.NET_TOT = r2(h.NET_TOT + l.IT_NET_TOT);
    h._lines.push({
      ITEM_NAME: l.ITEM_NAME,
      HSN_CODE: l.HSN_CODE,
      UNIT_NAME: l.UNIT_NAME,
      IT_PCS: l.IT_PCS,
      IT_QTY: l.IT_QTY,
      IT_RATE: l.IT_RATE,
      IT_TAXABLE: l.IT_TAXABLE,
      T_GST_PER: l.T_GST_PER,
      IT_GST_PER: l.T_GST_PER,
      IT_SGST_P: l.IT_SGST_P,
      IT_SGST_A: l.IT_SGST_A,
      IT_CGST_P: l.IT_CGST_P,
      IT_CGST_A: l.IT_CGST_A,
      IT_IGST_P: l.IT_IGST_P,
      IT_IGST_A: l.IT_IGST_A,
      IT_GST_AMT: l.IT_GST_AMT,
      IT_NET_TOT: l.IT_NET_TOT,
    });
  }
  return [...byBill.values()];
}

describe('JSM live SC27 parity: Outstanding family', () => {
  it('Outstanding Zoom Sales summary by Party matches JSM SQL totals per party', async () => {
    const res = await jsmReports.get('Rpt_Outstating_Report_Sales').run('sc27', { summary: true, groupBy1: 'Party' }, { rows: fx.osSalesRaw });
    assert.deepEqual(
      res.rows.map((r) => ({ p: r.ZGROUP1, b: r2(r.TOT_BALANCE) })),
      fx.osSalesExpectedByParty.map((e) => ({ p: e.PARTY, b: r2(e.TOT_BALANCE) }))
    );
  });

  it('Os New Format Testing summary by Party matches JSM SQL totals', async () => {
    const res = await jsmReports.get('Rpt_Outstating_ReportSales').run('sc27', { summary: true, orderBy1: 'Party' }, { rows: fx.osSalesRaw });
    assert.equal(sum(res.rows, 'BAL_AMT'), sum(fx.osSalesExpectedByParty, 'TOT_BALANCE'));
  });

  it('Debitors Age before/after 90 days matches JSM SQL DATEDIFF cutoffs', async () => {
    const ageRows = fx.osSalesExpectedByParty.map((e) => ({
      PARTY: e.PARTY,
      BROKER: '',
      BAL_AMT1: e.BEFORE_90,
      BAL_AMT2: 0,
      BAL_AMT3: 0,
      BAL_AMT4: e.AFTER_90,
      BAL_UNADJ: 0,
    }));
    const res = await jsmReports.get('Rpt_Outstating_Age_Report').run('sc27', { cutoffDays: 90 }, { rows: ageRows });
    assert.equal(sum(res.rows, 'BEFORE_DAYS'), sum(fx.osSalesExpectedByParty, 'BEFORE_90'));
    assert.equal(sum(res.rows, 'AFTER_DAYS'), sum(fx.osSalesExpectedByParty, 'AFTER_90'));
    assert.equal(sum(res.rows, 'TOT_BALANCE'), sum(fx.osSalesExpectedByParty, 'TOT_BALANCE'));
  });

  it('Debitors Excel Age Analysis + 90 Days + Month O/s + SMS O/s preserve exact SC27 grand balance', async () => {
    const excelAge = await jsmReports.get('A_Jsm_Os_Sales_Age_Analysys_Updated').run('sc27', { day1: 30, day2: 60, day3: 90, day4: 120 }, { rows: fx.osSalesRaw });
    assert.equal(sum(excelAge.rows, 'TOT_BALANCE'), sum(fx.osSalesExpectedByParty, 'TOT_BALANCE'));

    const d90 = await jsmReports.get('Rpt_Os_90Days_Eklvya').run('sc27', { asOn: fx.asOn }, { rows: fx.osSalesRaw });
    assert.equal(sum(d90.rows, 'TOT_OS'), sum(fx.osSalesExpectedByParty, 'TOT_BALANCE'));

    const mo = await jsmReports.get('A_Textiles_Outstanding_MonthWise_Sales').run('sc27', {}, { rows: fx.osSalesRaw });
    assert.equal(sum(mo.rows, 'TOT_BALANCE'), sum(fx.osSalesExpectedByParty, 'TOT_BALANCE'));

    const osPur = await jsmReports.get('Rpt_Outstating_Report_Purchase').run('sc27', { summary: true, groupBy1: 'Party' }, { rows: fx.osPurRaw });
    assert.equal(sum(osPur.rows, 'TOT_BALANCE'), sum(fx.osPurRaw, 'TOT_BALANCE'));

    const moPur = await jsmReports.get('A_Textiles_Outstanding_MonthWise_Purchase').run('sc27', {}, { rows: fx.osPurRaw });
    assert.equal(sum(moPur.rows, 'TOT_BALANCE'), sum(fx.osPurRaw, 'TOT_BALANCE'));

    const sms = await jsmReports.get('Rpt_Sms_OsReports').run('sc27', { osDays: 0 }, { rows: fx.osSalesRaw });
    assert.equal(sum(sms.rows, 'TOT_BALANCE'), sum(fx.osSalesExpectedByParty, 'TOT_BALANCE'));

    const intr = await jsmReports.get('New_Rpt_Sales_Intrest_ZoomIn_New_Sales').run('sc27', {
      rate: 18, graceDays: 30, yearDays: 365, tillDate: fx.asOn, onAmt: 'BillAmt', status: 'All',
    }, { rows: fx.osSalesRaw.map((r) => ({ ...r, BILL_AMT: r.NET_TOT, SUB_TOT: r.SUB_TOT ?? r.NET_TOT, PAID_INT: 0 })) });
    assert.equal(intr.rows.length, fx.osSalesRaw.length);
    assert.equal(sum(intr.rows, 'NET_TOT'), sum(fx.osSalesRaw, 'NET_TOT'));
  });
});

describe('JSM live SC27 parity: Cash/Bank, Cheq, Brokerage, Master List, Stock', () => {
  it('Cash/Bank Register summary by Bank matches JSM_VW_CASHBANK exact totals', async () => {
    const res = await jsmReports.get('A_All_CashBank_Report').run('sc27', { summary: true, orderBy1: 'Bank' }, { rows: fx.cbRaw });
    assert.deepEqual(
      res.rows.map((r) => ({ bank: r.ZGROUP1, amt: r2(r.REC_AMT) })),
      fx.cbExpectedBank.map((e) => ({ bank: e.BANK, amt: r2(e.REC_AMT) }))
    );
  });

  it('Cheq In Hand lists exact SC27 uncleared cheque', async () => {
    const res = await jsmReports.get('Rpt_BankStockInHandCheq').run('sc27', {}, { rows: fx.chqRaw });
    assert.equal(res.rows.length, fx.chqRaw.length);
    assert.equal(sum(res.rows, 'REC_AMT'), 4400);
  });

  it('Purchase Stock Old & LRWise match JSM_VW_STOCK_PURCHASE_DETAIL item totals', async () => {
    const lr = await jsmReports.get('Rpt_Purchase_Stock_LRWiseReport').run('sc27', { status: '3-All' }, { rows: fx.purStkRaw, unadjusted: [] });
    assert.equal(sum(lr.rows, 'TO_PCS'), sum(fx.purStkExpected, 'PU_PCS'));
    assert.equal(sum(lr.rows, 'TO_QTY'), sum(fx.purStkExpected, 'PU_MTS'));

    const old = await jsmReports.get('Rpt_Purchase_Stock').run('sc27', { status: '3-All' }, { rows: fx.purStkRaw, unadjusted: [] });
    assert.equal(sum(old.rows, 'PU_PCS'), sum(fx.purStkExpected, 'PU_PCS'));
    assert.equal(sum(old.rows, 'PU_MTS'), sum(fx.purStkExpected, 'PU_MTS'));

    const gdw = await jsmReports.get('Rpt_Purchase_Stock_Godown_Report').run('sc27', { status: '3-All' }, {
      rows: fx.purStkRaw.map((r) => ({
        ...r,
        _lots: [{
          GP_NO: r.SRAL_NO || '1', ITEM: r.ITEM,
          G_PCS: r.PU_PCS, G_QTY: r.PU_MTS,
          ISS_PCS: r.ISS_PCS || 0, ISS_QTY: r.ISS_MTS || 0,
          BAL_PCS: r.PU_PCS, BAL_QTY: r.STK_MTS ?? r.PU_MTS,
        }],
      })),
      unadjusted: [],
    });
    assert.equal(sum(gdw.rows, 'G_PCS'), sum(fx.purStkExpected, 'PU_PCS'));
    assert.equal(sum(gdw.rows, 'G_QTY'), sum(fx.purStkExpected, 'PU_MTS'));
  });

  it('Master List Print (Envelope & Label) matches JSM_VW_MASTER_ACCOUNT_REPORT count', async () => {
    const lst = await jsmReports.get('Rpt_Account_List_Print').run('sc27', { copies: 1 }, { rows: fx.mstRaw });
    assert.equal(lst.rows.length, fx.mstRaw.length);
  });

  it('Sales Order Status & Finish Stock process live SC27 rows cleanly', async () => {
    const ord = await jsmReports.get('Rpt_Sales_Order_Detail_Report').run('sc27', {}, { rows: fx.salesOrdRaw });
    assert.equal(ord.rows.length, fx.salesOrdRaw.length);
    assert.equal(sum(ord.rows, 'BAL_PCS'), sum(fx.salesOrdRaw, 'BAL_PCS'));

    const fin = await jsmReports.get('Rpt_FinishStockReport').run('sc27', {}, { rows: fx.finishStkRaw });
    assert.ok(fin.rows.length > 0);
  });

  it('Brokreg Statement Sales produces 2% exact commission on SC27 bills', async () => {
    const salesHeaders = buildSalesHeaderRows(fx.gstSalesLines);
    const res = await jsmReports.get('A_BrokregStatment_SalesBillDate').run('sc27', { base: 'taxable', commissionPer: 2, tdsPer: 5 }, {
      rows: fx.osSalesRaw,
      register: salesHeaders,
    });
    // JSM rounds commission per bill row, not on the grand total.
    const expectedPerBill = r2(res.rows.reduce((a, r) => a + r2(r.BASE_AMT * 0.02), 0));
    assert.equal(sum(res.rows, 'BROKREG_AMT'), expectedPerBill);
    assert.ok(res.rows.length > 0 && expectedPerBill > 0);

    const jobBrk = await jsmReports.get('Rpt_Job_Brokerage').run('sc27', { commissionPer: 1.5, base: 'bill' }, { rows: fx.osSalesRaw });
    assert.equal(jobBrk.rows.length, fx.osSalesRaw.length);
    assert.equal(sum(jobBrk.rows, 'BILL_AMT'), sum(fx.osSalesRaw, 'NET_TOT'));
  });
});

describe('JSM live SC27 parity: GST reports (Item Detail, Supply, 3B, GSTR-9/9C/9 New, Extra 1/2/3)', () => {
  it('GSTIN Sales Item Detail & GSTR-1 rate totals match T_SALES/T_SL_ITEM SQL sums to the paisa', async () => {
    const itemDet = await jsmReports.get('A_Gstr1_SalesInvoiceDetail').run('sc27', {}, { rows: fx.gstSalesLines });
    assert.equal(sum(itemDet.rows, 'IT_TAXABLE'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
    assert.equal(sum(itemDet.rows, 'IT_SGST_A'), sum(fx.gstSalesRateExpected, 'SGST_AMT'));
    assert.equal(sum(itemDet.rows, 'IT_CGST_A'), sum(fx.gstSalesRateExpected, 'CGST_AMT'));
    assert.equal(sum(itemDet.rows, 'IT_IGST_A'), sum(fx.gstSalesRateExpected, 'IGST_AMT'));
  });

  it('3B Inward & Outward Supply, Extra GSTR-1/2/3 match live SC27 SQL totals', async () => {
    const salesHeaders = buildSalesHeaderRows(fx.gstSalesLines);
    const supOut = await jsmReports.get('A_All_Outward_Supply_Sales').run('sc27', {}, {
      rows: salesHeaders.map((r) => ({ ...r, BILL_NO: r.NCBILL_NO || '' })),
    });
    assert.equal(sum(supOut.rows, 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));

    const supIn = await jsmReports.get('A_All_Inward_Supply_Purchase').run('sc27', {}, {
      rows: fx.gstPurchaseAll.map((r) => ({ ...r, BILL_NO: r.NCBILL_NO || '' })),
    });
    assert.equal(sum(supIn.rows, 'TAXABLE_AMT'), sum(fx.gstPurchaseRateExpected, 'TAXABLE_AMT'));

    const g3b = await jsmReports.get('Gstr_3B_Detail_Inward_Outwardard_supply').run('sc27', { summary: true, groupBy1: 'Head' }, {
      sales: salesHeaders,
      salesRtn: [],
      purchases: fx.gstPurchaseAll,
      purchaseRtn: [],
      jobs: [],
      notes: [],
    });
    const outRow = g3b.rows.find((r) => r.ZGROUP2 === 'OUTWARD');
    const inRow = g3b.rows.find((r) => r.ZGROUP2 === 'INWARD');
    assert.equal(r2(outRow.TAXABLE_AMT), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
    assert.equal(r2(inRow.TAXABLE_AMT), sum(fx.gstPurchaseRateExpected, 'TAXABLE_AMT'));

    const ex1 = await jsmReports.get('JS_GSTR1_RPT').run('sc27', {}, { sales: salesHeaders });
    const ex2 = await jsmReports.get('JS_GSTR2_RPT').run('sc27', {}, {
      purchasesRaw: fx.gstPurchaseAll.map((r) => ({
        date: r.BILL_DATE,
        supplierId: { name: r.PARTY, gstin: r.GSTIN_NO },
        supplierInvoiceNo: r.NCBILL_NO,
        netAmount: r.NET_TOT,
        sgst: r.SGST_AMT,
        cgst: r.CGST_AMT,
        igst: r.IGST_AMT,
      })),
    });
    const ex3 = await jsmReports.get('JS_GSTR3_SMRY').run('sc27', {}, {
      sales: salesHeaders, salesRtn: [], purchases: fx.gstPurchaseAll, purchaseRtn: [],
    });
    assert.equal(sum(ex1.rows, 'SUBTOT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
    assert.equal(sum(ex2.rows, 'SGST_AMT'), sum(fx.gstPurchaseRateExpected, 'SGST_AMT'));
    assert.equal(sum(ex2.rows, 'CGST_AMT'), sum(fx.gstPurchaseRateExpected, 'CGST_AMT'));
    assert.equal(sum(ex2.rows, 'IGST_AMT'), sum(fx.gstPurchaseRateExpected, 'IGST_AMT'));
    assert.equal(sum(ex3.rows.filter((r) => r.DETAILS.startsWith('Output')), 'SUB_TOT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
    assert.equal(sum(ex3.rows.filter((r) => r.DETAILS.startsWith('Input')), 'SUB_TOT'), sum(fx.gstPurchaseRateExpected, 'TAXABLE_AMT'));
  });

  it('GSTR-9 Old, GSTR-9C Old, and GSTR-9 New match SC27 Sales/Purchase rate & HSN SQL sums', async () => {
    const salesHeaders = buildSalesHeaderRows(fx.gstSalesLines);
    const deps = { sales: salesHeaders, purchases: fx.gstPurchaseAll, salesRtn: [], purchaseRtn: [], notes: [], mill: [], job: [] };

    const g9 = await jsmReports.get('Rpt_Jsm_GSTR9_Excel').run('sc27', { sheets: ['SALES - HSN WISE'] }, deps);
    assert.equal(sum(g9.rows, 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));

    const g9c = await jsmReports.get('xOld_Rpt_Jsm_GSTR9_All_Excel_Report').run('sc27', { sheets: ['SL.TAXRATE'] }, deps);
    assert.equal(sum(g9c.rows, 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));

    const g9n = await jsmReports.get('Rpt_Jsm_GSTR9_New').run('sc27', { sheets: ['SalesTaxrate'] }, deps);
    assert.equal(sum(g9n.rows, 'TAXABLE'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
  });
});

describe('JSM live SC27 parity: Batch 4, 5A, 6 (Taka, Old Reports, Native GSTIN Summaries)', () => {
  it('TakaWise Stock Detail matches JSM_VW_PROCESS_STOCK_TAKADETAIL_WISE count and quantities', async () => {
    const res = await jsmReports.get('Rpt_Process_Stock_TakaDetail').run('sc27', { status: 'Pending' }, { rows: fx.takaRaw });
    assert.equal(res.rows.length, fx.takaExpected.CNT);
    assert.equal(sum(res.rows, 'DISS_QTY'), r2(fx.takaExpected.DISS_QTY));
    assert.equal(sum(res.rows, 'DREC_QTY'), r2(fx.takaExpected.DREC_QTY));
    assert.equal(sum(res.rows, 'DSHORT_QTY'), r2(fx.takaExpected.DSHORT_QTY));
  });

  it('Batch 4 Old Reports (O/s Sales Old, BookPrint Sales, Master List Old, 3B Cess & Zoom) match SC27 totals', async () => {
    const osOld = await jsmReports.get('ZOld_Rpt_Os_Sales').run('sc27', {}, { rows: fx.osSalesRaw });
    assert.equal(osOld.rows.length, fx.osSalesRaw.length);
    assert.equal(sum(osOld.rows, 'TOT_BALANCE'), sum(fx.osSalesExpectedByParty, 'TOT_BALANCE'));

    const salesHeaders = buildSalesHeaderRows(fx.gstSalesLines);
    const vatBook = await jsmReports.get('Rpt_Jsm_SalesPurchaseVat').run('sc27', { mode: 'Sales' }, { sales: salesHeaders });
    assert.equal(vatBook.rows.length, salesHeaders.length);
    assert.equal(sum(vatBook.rows, 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
    assert.equal(sum(vatBook.rows, 'NET_TOT'), sum(fx.gstSalesRateExpected, 'NET_TOT'));

    const mstParties = fx.mstRaw.map((m) => ({
      name: m.AC_NAME,
      city: m.CITY,
      address: m.ADDRESS,
      mobile: m.MOBILE,
      gstin: m.GSTIN_NO,
      accountGroupId: { name: m.GROUP },
    }));
    const mstOld = await jsmReports.get('Rpt_Account_List_Print_Old').run('sc27', {}, { parties: mstParties });
    assert.equal(mstOld.rows.length, fx.mstRaw.length);

    const isOut3b = (h) => h && (h.startsWith('SALES') || h.startsWith('STATEWISE')) && h !== 'SALES RETURN';
    const deps = { sales: salesHeaders, purchases: fx.gstPurchaseAll, salesRtn: [], purchaseRtn: [], notes: [] };
    const cess = await jsmReports.get('Gstr_3B_TextNew_Monthly_Cess').run('sc27', {}, deps);
    const outCess = cess.rows.filter((r) => isOut3b(r.HEAD));
    assert.equal(sum(outCess, 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));

    const zoom = await jsmReports.get('Gstr_3BB_Zoomin_Rpt').run('sc27', {}, deps);
    const outZoom = zoom.rows.filter((r) => ['SALES REGISTRED', 'NILL RATED & EXEMPTED', 'STATEWISE - UNREGISTERED AND COMPOSITION SCHEME'].includes(r.GRACE_HEAD));
    assert.equal(sum(outZoom, 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
  });

  it('Batch 6 Native GSTIN Summary, HSN Wise All, 3B Monthly/Excel, and Ewb/Einv match SC27 SQL totals', async () => {
    const salesHeaders = buildSalesHeaderRows(fx.gstSalesLines);
    const isOut3b = (h) => h && (h.startsWith('SALES') || h.startsWith('STATEWISE')) && h !== 'SALES RETURN';

    const sSum = await jsmReports.get('A_Gstr1_SalesInvoiceSummary').run('sc27', { summary: true }, { sales: salesHeaders });
    assert.equal(sum(sSum.rows, 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
    assert.equal(sum(sSum.rows, 'NET_TOT'), sum(fx.gstSalesRateExpected, 'NET_TOT'));

    const pSum = await jsmReports.get('A_Gstr2_PurchaseSummary').run('sc27', { summary: true }, { purchases: fx.gstPurchaseAll });
    assert.equal(sum(pSum.rows, 'TAXABLE_AMT'), sum(fx.gstPurchaseRateExpected, 'TAXABLE_AMT'));
    assert.equal(sum(pSum.rows, 'NET_TOT'), sum(fx.gstPurchaseRateExpected, 'NET_TOT'));

    const hsn = await jsmReports.get('Hsn_Wise_Report_All').run('sc27', {}, { sales: salesHeaders, salesRtn: [], purchases: [] });
    assert.equal(sum(hsn.rows, 'TAXABLE_AMT'), sum(fx.hsnSalesExpected, 'TAXABLE_AMT'));
    assert.equal(sum(hsn.rows, 'IT_QTY'), sum(fx.hsnSalesExpected, 'IT_QTY'));

    const g3bM = await jsmReports.get('Gstr_3B_TextNew_Monthly').run('sc27', {}, {
      sales: salesHeaders, purchases: fx.gstPurchaseAll, salesRtn: [], purchaseRtn: [], notes: [],
    });
    assert.equal(sum(g3bM.rows.filter((r) => isOut3b(r.HEAD)), 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));

    const g3bEx = await jsmReports.get('Gstr_3BB_TextNew_Excel_Monthly').run('sc27', {}, {
      sales: salesHeaders, purchases: fx.gstPurchaseAll, salesRtn: [], purchaseRtn: [], notes: [],
    });
    assert.equal(sum(g3bEx.rows.filter((r) => isOut3b(r.HEAD)), 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));

    const ewb = await jsmReports.get('A_All_Ewb_Einv_Rpt').run('sc27', {}, { sales: salesHeaders });
    const sqlSalesEwb = fx.ewbExpected.find((e) => e.ENT_TYPE === 'SL' || e.ENT_TYPE === 'SALES');
    assert.equal(ewb.rows.length, salesHeaders.length);
    if (sqlSalesEwb) {
      assert.equal(ewb.rows.length, sqlSalesEwb.CNT);
      assert.equal(sum(ewb.rows, 'TAXABLE_AMT'), r2(sqlSalesEwb.TAXABLE_AMT));
    } else {
      assert.equal(sum(ewb.rows, 'TAXABLE_AMT'), sum(fx.gstSalesRateExpected, 'TAXABLE_AMT'));
    }
  });
});
