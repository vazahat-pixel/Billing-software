'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const gstReturnService = require('../../services/gstReturnService');

describe('GSTR-1 Classification & B2CL Threshold Verification', () => {
  // Helper to execute buildGstr1 with stubbed data sources (100% in-memory)
  async function runBuildGstr1({ sales = [], notes = [], returns = [], companyGstin = '24AAAAA0000A1Z5', companyStateCode = '24', period = '092026' }) {
    const origCtx = gstReturnService._companyCtx;
    const origSales = gstReturnService._salesInPeriod;
    const origCancelled = gstReturnService._cancelledSalesInPeriod;
    const origReturns = gstReturnService._returnsInPeriod;
    const origNotes = gstReturnService._notesInPeriod;

    try {
      gstReturnService._companyCtx = async () => ({
        gstin: companyGstin,
        stateCode: companyStateCode,
      });
      gstReturnService._salesInPeriod = async () => sales;
      gstReturnService._cancelledSalesInPeriod = async () => [];
      gstReturnService._returnsInPeriod = async () => returns;
      gstReturnService._notesInPeriod = async () => notes;

      const result = await gstReturnService.buildGstr1('mockCompanyId', period);
      return result;
    } finally {
      gstReturnService._companyCtx = origCtx;
      gstReturnService._salesInPeriod = origSales;
      gstReturnService._cancelledSalesInPeriod = origCancelled;
      gstReturnService._returnsInPeriod = origReturns;
      gstReturnService._notesInPeriod = origNotes;
    }
  }

  describe('Five Verified JSM Invoice Fixtures', () => {
    it('Invoice 1: Intra-state 18% single rate unregistered (Rs 295.00) goes to B2CS', async () => {
      const sales = [{
        invoiceNo: '1',
        date: new Date('2026-06-05T00:00:00.000Z'),
        partyName: 'RAJA TEX',
        customerId: { gstin: '', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 250.00,
        cgst: 22.50,
        sgst: 22.50,
        igst: 0.00,
        cess: 0.00,
        netAmount: 295.00,
        gstRate: 18,
        items: [{
          amount: 250.00,
          taxableAmount: 250.00,
          gstRate: 18,
          hsnCode: '5208',
          qty: 0,
          pcs: 5,
        }],
      }];

      const res = await runBuildGstr1({ sales, period: '062026' });
      assert.equal(res.payload.b2b.length, 0, 'Must not be in B2B');
      assert.equal(res.payload.b2cl.length, 0, 'Must not be in B2CL');
      assert.equal(res.payload.b2cs.length, 1, 'Must be in B2CS');
      assert.equal(res.payload.b2cs[0].sply_ty, 'INTRA');
      assert.equal(res.payload.b2cs[0].txval, 250.00);
      assert.equal(res.payload.b2cs[0].camt, 22.50);
      assert.equal(res.payload.b2cs[0].samt, 22.50);
    });

    it('Invoice 3: Intra-state 5% single rate unregistered (Rs 4,410.00) goes to B2CS', async () => {
      const sales = [{
        invoiceNo: '3',
        date: new Date('2026-07-22T00:00:00.000Z'),
        partyName: 'MAHESH TEX',
        customerId: { gstin: '', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 4200.00,
        cgst: 105.00,
        sgst: 105.00,
        igst: 0.00,
        cess: 0.00,
        netAmount: 4410.00,
        gstRate: 5,
        items: [{
          amount: 4200.00,
          taxableAmount: 4200.00,
          gstRate: 5,
          hsnCode: '5208',
          qty: 420,
          pcs: 42,
        }],
      }];

      const res = await runBuildGstr1({ sales, period: '072026' });
      assert.equal(res.payload.b2b.length, 0);
      assert.equal(res.payload.b2cl.length, 0);
      assert.equal(res.payload.b2cs.length, 1);
      assert.equal(res.payload.b2cs[0].sply_ty, 'INTRA');
      assert.equal(res.payload.b2cs[0].txval, 4200.00);
      assert.equal(res.payload.b2cs[0].camt, 105.00);
      assert.equal(res.payload.b2cs[0].samt, 105.00);
    });

    it('Invoice 4: Intra-state multi-rate (5% & 18%) unregistered with roundoff (Rs 93,563.00) goes to B2CS', async () => {
      const sales = [{
        invoiceNo: '4',
        date: new Date('2026-07-30T00:00:00.000Z'),
        partyName: 'MAHESH TEX',
        customerId: { gstin: '', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 84774.68,
        cgst: 4394.14,
        sgst: 4394.14,
        igst: 0.00,
        cess: 0.00,
        netAmount: 93563.00,
        gstRate: 10.37,
        items: [
          { amount: 40000.00, taxableAmount: 36495.20, gstRate: 5, hsnCode: '5208', qty: 200, pcs: 10 },
          { amount: 7000.00, taxableAmount: 5806.08, gstRate: 5, hsnCode: '5208', qty: 350, pcs: 14 },
          { amount: 39000.00, taxableAmount: 37073.40, gstRate: 18, hsnCode: '5208', qty: 780, pcs: 13 },
        ],
      }];

      const res = await runBuildGstr1({ sales, period: '072026' });
      assert.equal(res.payload.b2b.length, 0);
      assert.equal(res.payload.b2cl.length, 0);
      assert.equal(res.payload.b2cs.length, 1);
      assert.equal(res.payload.b2cs[0].sply_ty, 'INTRA');
      assert.equal(res.payload.b2cs[0].txval, 84774.68);
    });

    it('Invoice 1101: Inter-state 5% unregistered (Rs 1,050.00 <= 100k) goes to B2CS', async () => {
      const sales = [{
        invoiceNo: '1101',
        date: new Date('2026-08-24T00:00:00.000Z'),
        partyName: 'VISHAL TEXTILES',
        customerId: { gstin: '', state: 'Madhya Pradesh', stateCode: '23' },
        taxableAmount: 1000.00,
        cgst: 0.00,
        sgst: 0.00,
        igst: 50.00,
        cess: 0.00,
        netAmount: 1050.00,
        gstRate: 5,
        items: [{
          amount: 1000.00,
          taxableAmount: 1000.00,
          gstRate: 5,
          hsnCode: '5208',
          qty: 0,
          pcs: 10,
        }],
      }];

      const res = await runBuildGstr1({ sales, period: '082026' });
      assert.equal(res.payload.b2b.length, 0);
      assert.equal(res.payload.b2cl.length, 0, 'Invoice 1101 must not be in B2CL');
      assert.equal(res.payload.b2cs.length, 1, 'Invoice 1101 must be in B2CS');
      assert.equal(res.payload.b2cs[0].sply_ty, 'INTER');
      assert.equal(res.payload.b2cs[0].pos, '23');
      assert.equal(res.payload.b2cs[0].iamt, 50.00);
    });

    it('Invoice 1102: Inter-state 18% unregistered (Rs 19,379.00 <= 100k) goes to B2CS', async () => {
      const sales = [{
        invoiceNo: '1102',
        date: new Date('2026-09-15T00:00:00.000Z'),
        partyName: 'ADDU CUSTOMER',
        customerId: { gstin: '', state: 'Madhya Pradesh', stateCode: '23' },
        taxableAmount: 16422.84,
        cgst: 0.00,
        sgst: 0.00,
        igst: 2956.11,
        cess: 0.00,
        netAmount: 19379.00,
        gstRate: 18,
        items: [{
          amount: 19000.00,
          taxableAmount: 16422.84,
          gstRate: 18,
          hsnCode: '5208',
          qty: 0,
          pcs: 380,
        }],
      }];

      const res = await runBuildGstr1({ sales, period: '092026' });
      assert.equal(res.payload.b2b.length, 0);
      assert.equal(res.payload.b2cl.length, 0);
      assert.equal(res.payload.b2cs.length, 1);
      assert.equal(res.payload.b2cs[0].sply_ty, 'INTER');
      assert.equal(res.payload.b2cs[0].pos, '23');
      assert.equal(res.payload.b2cs[0].iamt, 2956.11);
    });
  });

  describe('B2CL Threshold Boundary Tests (Statutory 100k Post-Aug 2024 vs 250k Pre-Aug 2024)', () => {
    it('Post-Aug 2024: Inter-state unregistered exactly Rs 100,000 stays in B2CS', async () => {
      const sales = [{
        invoiceNo: 'BOUND-100K',
        date: new Date('2024-09-10T00:00:00.000Z'),
        partyName: 'Interstate Unreg Party',
        customerId: { gstin: '', state: 'Maharashtra', stateCode: '27' },
        taxableAmount: 95238.10,
        cgst: 0,
        sgst: 0,
        igst: 4761.90,
        cess: 0,
        netAmount: 100000.00,
        gstRate: 5,
        items: [{ amount: 95238.10, taxableAmount: 95238.10, gstRate: 5, hsnCode: '5208', qty: 100 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092024' });
      assert.equal(res.payload.b2cl.length, 0, 'Exactly 100k must not be B2CL');
      assert.equal(res.payload.b2cs.length, 1, 'Exactly 100k must be in B2CS');
    });

    it('Post-Aug 2024: Inter-state unregistered Rs 100,001 moves to B2CL', async () => {
      const sales = [{
        invoiceNo: 'BOUND-100K-PLUS',
        date: new Date('2024-09-10T00:00:00.000Z'),
        partyName: 'Interstate Unreg Party',
        customerId: { gstin: '', state: 'Maharashtra', stateCode: '27' },
        taxableAmount: 95239.05,
        cgst: 0,
        sgst: 0,
        igst: 4761.95,
        cess: 0,
        netAmount: 100001.00,
        gstRate: 5,
        items: [{ amount: 95239.05, taxableAmount: 95239.05, gstRate: 5, hsnCode: '5208', qty: 100 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092024' });
      assert.equal(res.payload.b2cl.length, 1, 'Invoice > 100k inter-state post-Aug 2024 MUST be in B2CL');
      assert.equal(res.payload.b2cs.length, 0, 'Must NOT be in B2CS');
      assert.equal(res.payload.b2cl[0].inum, 'BOUND-100K-PLUS');
      assert.equal(res.payload.b2cl[0].val, 100001.00);
    });

    it('Post-Aug 2024: Inter-state unregistered Rs 150,000 moves to B2CL', async () => {
      const sales = [{
        invoiceNo: 'TEST-150K',
        date: new Date('2026-09-15T00:00:00.000Z'),
        partyName: 'Interstate Unreg Party',
        customerId: { gstin: '', state: 'Madhya Pradesh', stateCode: '23' },
        taxableAmount: 142857.14,
        cgst: 0,
        sgst: 0,
        igst: 7142.86,
        cess: 0,
        netAmount: 150000.00,
        gstRate: 5,
        items: [{ amount: 142857.14, taxableAmount: 142857.14, gstRate: 5, hsnCode: '5208', qty: 100 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092026' });
      assert.equal(res.payload.b2cl.length, 1, '150k inter-state unregistered in 2026 MUST be in B2CL');
      assert.equal(res.payload.b2cs.length, 0, 'Must NOT be in B2CS');
    });

    it('Post-Aug 2024: Intra-state unregistered Rs 500,000 ALWAYS stays in B2CS (never B2CL)', async () => {
      const sales = [{
        invoiceNo: 'INTRA-500K',
        date: new Date('2026-09-15T00:00:00.000Z'),
        partyName: 'Intrastate Large Unreg',
        customerId: { gstin: '', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 476190.48,
        cgst: 11904.76,
        sgst: 11904.76,
        igst: 0,
        cess: 0,
        netAmount: 500000.00,
        gstRate: 5,
        items: [{ amount: 476190.48, taxableAmount: 476190.48, gstRate: 5, hsnCode: '5208', qty: 500 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092026' });
      assert.equal(res.payload.b2cl.length, 0, 'Intra-state must NEVER be in B2CL regardless of amount');
      assert.equal(res.payload.b2cs.length, 1, 'Intra-state large unregistered must be in B2CS');
    });

    it('Pre-Aug 2024: Inter-state unregistered Rs 150,000 stays in B2CS under historical 250k rule', async () => {
      const sales = [{
        invoiceNo: 'HIST-150K',
        date: new Date('2024-05-15T00:00:00.000Z'),
        partyName: 'Historical Unreg Party',
        customerId: { gstin: '', state: 'Madhya Pradesh', stateCode: '23' },
        taxableAmount: 142857.14,
        cgst: 0,
        sgst: 0,
        igst: 7142.86,
        cess: 0,
        netAmount: 150000.00,
        gstRate: 5,
        items: [{ amount: 142857.14, taxableAmount: 142857.14, gstRate: 5, hsnCode: '5208', qty: 100 }],
      }];

      const res = await runBuildGstr1({ sales, period: '052024' });
      assert.equal(res.payload.b2cl.length, 0, 'In May 2024 (pre-Aug 2024), 150k must stay in B2CS');
      assert.equal(res.payload.b2cs.length, 1, 'In May 2024 (pre-Aug 2024), 150k must be in B2CS');
    });

    it('Pre-Aug 2024: Inter-state unregistered Rs 250,001 moves to B2CL under historical rule', async () => {
      const sales = [{
        invoiceNo: 'HIST-250K-PLUS',
        date: new Date('2024-05-15T00:00:00.000Z'),
        partyName: 'Historical Unreg Large',
        customerId: { gstin: '', state: 'Madhya Pradesh', stateCode: '23' },
        taxableAmount: 238096.19,
        cgst: 0,
        sgst: 0,
        igst: 11904.81,
        cess: 0,
        netAmount: 250001.00,
        gstRate: 5,
        items: [{ amount: 238096.19, taxableAmount: 238096.19, gstRate: 5, hsnCode: '5208', qty: 250 }],
      }];

      const res = await runBuildGstr1({ sales, period: '052024' });
      assert.equal(res.payload.b2cl.length, 1, 'In May 2024, >250k moves to B2CL');
      assert.equal(res.payload.b2cs.length, 0);
    });
  });

  describe('GSTR-1 TCS Invoice-Value Exclusion (Sec 15 / CBIC Circular 76/50/2018 & JSM Formula)', () => {
    it('Case 1: Invoice without TCS maintains full GST invoice value', async () => {
      const sales = [{
        invoiceNo: 'B2B-NO-TCS',
        date: new Date('2026-09-15T00:00:00.000Z'),
        partyName: 'Registered Customer',
        customerId: { gstin: '24AILPB9933A1ZK', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 100000.00,
        cgst: 9000.00,
        sgst: 9000.00,
        igst: 0.00,
        cess: 0.00,
        tcsAmount: 0.00,
        roundOff: 0.00,
        netAmount: 118000.00,
        gstRate: 18,
        items: [{ amount: 100000.00, taxableAmount: 100000.00, gstRate: 18, hsnCode: '5208', qty: 100 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092026' });
      assert.equal(res.payload.b2b[0].inv[0].val, 118000.00);
      assert.equal(res.payload.b2bRows[0].netAmount, 118000.00);
    });

    it('Case 2: Invoice with TCS deducts TCS from GSTR-1 invoice value (JSM A.NET_TOT - A.TCS_AMT)', async () => {
      const sales = [{
        invoiceNo: 'B2B-WITH-TCS',
        date: new Date('2026-09-15T00:00:00.000Z'),
        partyName: 'Registered Customer with TCS',
        customerId: { gstin: '24AILPB9933A1ZK', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 100000.00,
        cgst: 9000.00,
        sgst: 9000.00,
        igst: 0.00,
        cess: 0.00,
        tcsAmount: 118.00, // 0.1% Income Tax TCS on 118,000
        roundOff: 0.00,
        netAmount: 118118.00, // customer bill = 100k + 18k tax + 118 TCS
        gstRate: 18,
        items: [{ amount: 100000.00, taxableAmount: 100000.00, gstRate: 18, hsnCode: '5208', qty: 100 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092026' });
      assert.equal(res.payload.b2b[0].inv[0].val, 118000.00, 'GSTR-1 invoice value must exclude Income Tax TCS');
      assert.equal(res.payload.b2bRows[0].netAmount, 118000.00, 'B2B row netAmount must exclude Income Tax TCS');
    });

    it('Case 3: Zero or missing TCS field defaults safely without alteration', async () => {
      const sales = [{
        invoiceNo: 'B2B-MISSING-TCS-PROP',
        date: new Date('2026-09-15T00:00:00.000Z'),
        partyName: 'Registered Customer No TCS Prop',
        customerId: { gstin: '24AILPB9933A1ZK', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 50000.00,
        cgst: 4500.00,
        sgst: 4500.00,
        igst: 0.00,
        cess: 0.00,
        // tcsAmount omitted
        netAmount: 59000.00,
        gstRate: 18,
        items: [{ amount: 50000.00, taxableAmount: 50000.00, gstRate: 18, hsnCode: '5208', qty: 50 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092026' });
      assert.equal(res.payload.b2b[0].inv[0].val, 59000.00);
    });

    it('Case 4: Missing or zero netAmount falls back safely to sum of taxables and taxes', async () => {
      const sales = [{
        invoiceNo: 'B2B-FALLBACK',
        date: new Date('2026-09-15T00:00:00.000Z'),
        partyName: 'Registered Fallback Customer',
        customerId: { gstin: '24AILPB9933A1ZK', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 100000.00,
        cgst: 9000.00,
        sgst: 9000.00,
        igst: 0.00,
        cess: 0.00,
        roundOff: 0.45,
        netAmount: 0, // forces fallback
        gstRate: 18,
        items: [{ amount: 100000.00, taxableAmount: 100000.00, gstRate: 18, hsnCode: '5208', qty: 100 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092026' });
      assert.equal(res.payload.b2b[0].inv[0].val, 118000.45);
    });

    it('Case 5: Invoice with round-off, taxes, and TCS matches JSM formula (A.NET_TOT - A.TCS_AMT)', async () => {
      const sales = [{
        invoiceNo: '1105-TCS-MODEL',
        date: new Date('2026-09-29T00:00:00.000Z'),
        partyName: 'ADDU CUSTOMER',
        customerId: { gstin: '24AILPB9933A1ZK', state: 'Gujarat', stateCode: '24' },
        taxableAmount: 518.62,
        cgst: 12.97,
        sgst: 12.96,
        igst: 0.00,
        cess: 0.00,
        roundOff: 0.45,
        tcsAmount: 5.00,
        netAmount: 550.00, // 518.62 + 25.93 + 0.45 + 5.00
        gstRate: 5,
        items: [{ amount: 518.62, taxableAmount: 518.62, gstRate: 5, hsnCode: '5208', qty: 10 }],
      }];

      const res = await runBuildGstr1({ sales, period: '092026' });
      assert.equal(res.payload.b2b[0].inv[0].val, 545.00, '550.00 netAmount minus 5.00 TCS must equal 545.00 GSTR-1 invoice value');
    });

    it('Case 6: Sales Return with TCS deducts TCS from GSTR-1 CDNR/CDNU value', async () => {
      const returns = [{
        returnNo: 'RET-TCS-01',
        returnType: 'Sales',
        date: new Date('2026-09-20T00:00:00.000Z'),
        partyGstin: '24AILPB9933A1ZK',
        partyName: 'Registered Customer',
        stateCode: '24',
        taxableAmount: 10000.00,
        cgst: 250.00,
        sgst: 250.00,
        igst: 0.00,
        cess: 0.00,
        tcsAmount: 10.00,
        roundOff: 0.00,
        netAmount: 10510.00, // 10000 + 500 tax + 10 TCS
      }];

      const res = await runBuildGstr1({ returns, period: '092026' });
      assert.equal(res.payload.cdnr.length, 1);
      assert.equal(res.payload.cdnr[0].nt[0].val, 10500.00, 'CDNR note val must exclude TCS (10510 - 10 = 10500)');
      assert.equal(res.payload.cdnrRows[0].netAmount, 10500.00);
    });
  });
});

