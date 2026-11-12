'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const gstr9Old = require('../../services/jsmReports/reports/gstr9Old');
const gstr9cOld = require('../../services/jsmReports/reports/gstr9cOld');
const gstr9New = require('../../services/jsmReports/reports/gstr9New');
const g3b = require('../../services/jsmReports/reports/gstr3bInwardOutward');
const matching = require('../../services/jsmReports/reports/gstMatching');
const extra = require('../../services/jsmReports/reports/gstExtraReports');

const DEPS = {
  sales: [{
    ENT_NO: 's1', CO_PATH: 'CO1', NCBILL_NO: 'S-1', SRAL_NO: 'S-1', BILL_DATE: '2026-04-10',
    BOOK: 'LOCAL SALES', PARTY: 'Reg Buyer', GSTIN_NO: '24AAAAA0000A1Z5', STATE: 'Gujarat',
    TYPE: 'B2B', GST_RATE: 5, TAXABLE_AMT: 1000, SGST_AMT: 25, CGST_AMT: 25, IGST_AMT: 0, NET_TOT: 1050,
    TO_PCS: 10, TO_QTY: 100,
    _lines: [{ HSN_CODE: '5407', UNIT_NAME: 'MTR', IT_QTY: 100, IT_PCS: 10, IT_KGS: 12, IT_TAXABLE: 1000, IT_GST_PER: 5, IT_GST_AMT: 50, IT_SGST_P: 2.5, IT_SGST_A: 25, IT_CGST_P: 2.5, IT_CGST_A: 25, IT_IGST_P: 0, IT_IGST_A: 0 }],
  }, {
    ENT_NO: 's2', CO_PATH: 'CO1', NCBILL_NO: 'S-2', SRAL_NO: 'S-2', BILL_DATE: '2026-04-12',
    BOOK: 'EXEMPT SALES', PARTY: 'Unreg', GSTIN_NO: '', STATE: 'Gujarat',
    TYPE: 'B2C', GST_RATE: 0, TAXABLE_AMT: 500, SGST_AMT: 0, CGST_AMT: 0, IGST_AMT: 0, NET_TOT: 500,
    TO_PCS: 5, TO_QTY: 50,
    _lines: [{ HSN_CODE: '5208', UNIT_NAME: 'MTR', IT_QTY: 50, IT_PCS: 5, IT_KGS: 6, IT_TAXABLE: 500, IT_GST_PER: 0, IT_GST_AMT: 0, IT_SGST_P: 0, IT_SGST_A: 0, IT_CGST_P: 0, IT_CGST_A: 0, IT_IGST_P: 0, IT_IGST_A: 0 }],
  }],
  purchases: [{
    ENT_NO: 'p1', CO_PATH: 'CO1', NCBILL_NO: 'P-1', SRAL_NO: 'P-1', BILL_DATE: '2026-04-15',
    BOOK: 'GREY PUR', PARTY: 'Mill Co', GSTIN_NO: '24BBBBB1111B1Z2', STATE: 'Gujarat',
    TYPE: 'B2B', GST_RATE: 5, TAXABLE_AMT: 2000, SGST_AMT: 50, CGST_AMT: 50, IGST_AMT: 0, NET_TOT: 2100,
    TO_PCS: 20, TO_QTY: 200,
    _lines: [{ HSN_CODE: '5407', UNIT_NAME: 'MTR', IT_QTY: 200, IT_PCS: 20, IT_KGS: 25, IT_TAXABLE: 2000, IT_GST_PER: 5, IT_GST_AMT: 100, IT_SGST_P: 2.5, IT_SGST_A: 50, IT_CGST_P: 2.5, IT_CGST_A: 50, IT_IGST_P: 0, IT_IGST_A: 0 }],
  }],
  salesRtn: [], purchaseRtn: [], millReceipts: [], jobReceipts: [], mill: [], job: [], jobs: [],
  notes: [], salesNotes: [], purchaseNotes: [],
};

describe('Batch 2 GST Reports', () => {
  it('gstr9Old populates B2CREG.NONGST and refuses RCM/ITC unavailable sheets', async () => {
    const res = await gstr9Old.run('c1', { from: '2026-04-01', to: '2027-03-31', sheets: ['B2CREG.NONGST', 'SALES - BOOK WISE'] }, DEPS);
    assert.equal(res.rows.length, 2);
    assert.ok(res.rows.some((r) => r.SHEET === 'B2CREG.NONGST' && r.NCBILL_NO === 'S-2'));
    await assert.rejects(() => gstr9Old.run('c1', { sheets: ['RCM MONTH WISE'] }, DEPS), { status: 400 });
  });

  it('gstr9cOld builds 9 available sheets and refuses JV-only RCM/ITC/challan sheets', async () => {
    const res = await gstr9cOld.run('c1', { from: '2026-04-01', to: '2027-03-31', sheets: ['OUTWARD SUPPLY - B2B', 'EXEMP.ALL', 'SL.TAXRATE'] }, DEPS);
    assert.ok(res.rows.some((r) => r.SHEET === 'OUTWARD SUPPLY - B2B' && r.TAXABLE_AMT === 1000));
    assert.ok(res.rows.some((r) => r.SHEET === 'EXEMP.ALL' && r.TAXABLE_AMT === 500));
    await assert.rejects(() => gstr9cOld.run('c1', { sheets: ['ITC - INPUT'] }, DEPS), { status: 400 });
  });

  it('gstr9New computes working sheets and refuses Rcm/Itc JV sheets', async () => {
    const res = await gstr9New.run('c1', { from: '2026-04-01', to: '2027-03-31' }, DEPS);
    assert.ok(res.rows.some((r) => r.SHEET === 'SalesMonth' && r.TYPE === 'SALES B2B' && r.TAXABLE === 1000));
    assert.ok(res.rows.some((r) => r.SHEET === 'PurchaseMonth' && r.TAXABLE === 2000));
    await assert.rejects(() => gstr9New.run('c1', { sheets: ['Rcm'] }, DEPS), { status: 400 });
  });

  it('gstr3bInwardOutward supports Both/Outward/Inward and Summary vs Detail layouts', async () => {
    const sum = await g3b.run('c1', { from: '2026-04-01', to: '2027-03-31', inOut: 'Both', groupBy1: 'Book', summary: true }, DEPS);
    assert.equal(sum.grid.layout, 'RUNTIME_B_SUMMARY_IN_OUT');
    assert.equal(sum.rows.length, 3);
    const det = await g3b.run('c1', { from: '2026-04-01', to: '2027-03-31', inOut: 'OutwardSupply', summary: false }, DEPS);
    assert.equal(det.grid.layout, 'RUNTIME_B_DETAIL_IN_OUT');
    assert.equal(det.rows.length, 2);
  });

  it('gstMatching classifies MATCH, ABSENT IN G1/2A, ABSENT IN JSM, and MATCH AMT DIFF', async () => {
    const g1 = await matching.gstr1Match.run('c1', {
      from: '2026-04-01', to: '2027-03-31',
      portalRows: [
        { GSTIN_NO: '24AAAAA0000A1Z5', INV_NO: 'S-1', GST_PER: 5, INV_AMT: 1050, TAX_AMT: 1000, SGST: 25, CGST: 25, IGST: 0 },
        { GSTIN_NO: '24AAAAA0000A1Z5', INV_NO: 'S-99', GST_PER: 5, INV_AMT: 525, TAX_AMT: 500, SGST: 12.5, CGST: 12.5, IGST: 0 },
      ],
    }, DEPS);
    assert.equal(g1.rows.find((r) => r.Jsm_BillNO === 'S-1').STATUS, 'MATCH');
    assert.equal(g1.rows.find((r) => r.G1_BillNo === 'S-99').STATUS, 'ABSENT IN JSM');

    const b2 = await matching.match2b.run('c1', {
      from: '2026-04-01', to: '2027-03-31', approxDiff: 1,
      portalRows: [
        { GSTIN_NO: '24BBBBB1111B1Z2', INV_NO: 'P-1', XINV_NO: 'PU-P-1', INV_AMT: 2110, TAX_AMT: 2000, SGST: 50, CGST: 50, IGST: 0 },
      ],
    }, DEPS);
    assert.equal(b2.rows[0].STATUS, 'MATCH AMT DIFF');
  });

  it('JS_GSTR1_RPT, JS_GSTR2_RPT and JS_GSTR3_SMRY build exact layouts', async () => {
    const r1 = await extra.jsGstr1.run('c1', { from: '2026-04-01', to: '2027-03-31' }, DEPS);
    assert.equal(r1.rows.length, 2);
    const r2 = await extra.jsGstr2.run('c1', { from: '2026-04-01', to: '2027-03-31' }, {
      purchasesRaw: [{ date: '2026-04-15', invoiceNo: '1', supplierInvoiceNo: 'P-1', supplierId: { name: 'Mill', gstin: '24BBBBB1111B1Z2' }, netAmount: 2100, gstPer: 5, sgst: 50, cgst: 50, igst: 0, itcEligibility: 'Inputs' }],
    });
    assert.equal(r2.rows[0].ITC_AVAILABLE, 100);
    const r3 = await extra.jsGstr3.run('c1', { from: '2026-04-01', to: '2027-03-31' }, DEPS);
    assert.equal(r3.rows.length, 3);
  });
});
