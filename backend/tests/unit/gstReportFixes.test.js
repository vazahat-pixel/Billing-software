'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const gstReturnService = require('../../services/gstReturnService');
const gstService = require('../../services/gstService');
const Purchase = require('../../models/Purchase');
const {
  toUqc, uqcLabel, allocateInvoiceLines, buildDocSeries,
} = require('../../utils/gstr1Lines');

function stubFind(model, docs, capture) {
  const orig = model.find;
  model.find = (query) => {
    if (capture) capture.query = query;
    const chain = {
      populate: () => chain,
      lean: () => chain,
      then: (res, rej) => Promise.resolve(docs).then(res, rej),
    };
    return chain;
  };
  return () => { model.find = orig; };
}

describe('gstr1Lines', () => {
  it('maps line units to GST UQC codes the way JSM does', () => {
    assert.equal(toUqc('QTY'), 'MTR');
    assert.equal(toUqc('NETQTY'), 'MTR');
    assert.equal(toUqc('MTRS'), 'MTR');
    assert.equal(toUqc('PCS'), 'PCS');
    assert.equal(toUqc('KG'), 'KGS');
    assert.equal(toUqc('MTR-METERS'), 'MTR');
    assert.equal(toUqc('THAN'), 'OTH');
    assert.equal(uqcLabel('MTR'), 'MTR-METERS');
  });

  it('taxed footer (MERN freight) is spread so rows still equal the saved invoice', () => {
    const doc = {
      items: [
        { amount: 1000, gstPer: 5, unit: 'MTRS', mts: 10 },
        { amount: 1000, gstPer: 18, unit: 'MTRS', mts: 10 },
      ],
    };
    // 100 freight taxed at the 11.5% weighted rate → header 2100 taxable, tax 50+180+11.5
    const rows = allocateInvoiceLines(doc, {
      taxable: 2100, taxRate: 11.5, cgst: 120.75, sgst: 120.75, igst: 0, cess: 0,
    });
    const sum = (k) => Number(rows.reduce((t, r) => t + r[k], 0).toFixed(2));
    assert.equal(sum('txval'), 2100);
    assert.equal(sum('camt'), 120.75);
    assert.equal(sum('samt'), 120.75);
    assert.deepEqual(rows.map((r) => r.rate), [5, 18]);
  });

  it('line fold that the sales screen moved into footer foldLess is applied back to its own line', () => {
    const doc = {
      foldLess: 2700,
      foldLessSign: '-',
      items: [
        { unit: 'QTY', mts: 200, rate: 200, amount: 40000, fold: 95, dis1Amt: 760, dis2Amt: 744.8, gstPer: 5 },
        { unit: 'PCS', pcs: 14, mts: 350, rate: 500, amount: 7000, fold: 90, dis1Amt: 252, dis2Amt: 241.92, gstPer: 5 },
        { unit: 'NETQTY', mts: 780, rate: 50, amount: 39000, fold: 0, dis1Amt: 1170, dis2Amt: 756.6, gstPer: 18 },
      ],
    };
    const rows = allocateInvoiceLines(doc, {
      taxable: 79374.68, taxRate: 10.87, cgst: 4314.89, sgst: 4314.89, igst: 0, cess: 0,
    });
    assert.deepEqual(rows.map((r) => r.txval), [36495.2, 5806.08, 37073.4]);
    assert.deepEqual(rows.map((r) => r.qty), [190, 14, 780]);
  });

  it('DOCS: one row per series, natural order, gaps in a numeric series count as cancelled', () => {
    const rows = buildDocSeries(
      [{ invoiceNo: '909', bookId: 'GREY' }, { invoiceNo: '1049', bookId: 'GREY' }, { invoiceNo: '1', bookId: 'SALES' },
        { invoiceNo: '2', bookId: 'SALES' }, { invoiceNo: '4', bookId: 'SALES' }],
      [{ invoiceNo: '3', bookId: 'SALES' }],
      'Invoices for outward supply'
    );
    const sales = rows.find((r) => r.from === '1');
    assert.equal(sales.to, '4');
    assert.equal(sales.totnum, 4);
    assert.equal(sales.cancel, 1);
    const grey = rows.find((r) => r.from === '909');
    assert.equal(grey.to, '1049', 'natural sort, not "1049" < "909"');
  });
});

describe('GSTR-9 table 4', () => {
  it('B2CL is counted once, at taxable value; exports use taxable value', () => {
    const g1 = {
      b2cs: [{ txval: 1000, camt: 25, samt: 25, iamt: 0 }],
      b2cl: [{ val: 236000, itms: [{ itm_det: { txval: 200000, iamt: 36000, camt: 0, samt: 0 } }] }],
      b2clRows: [{ taxableAmount: 200000, igst: 36000 }],
      expRows: [{ taxableAmount: 50000, invoiceValue: 50000, igst: 0 }],
    };
    const b2c = gstReturnService._sumGstr1B2cTax(g1);
    assert.equal(b2c.taxable, 201000);
    assert.equal(b2c.igst, 36000);
    const exp = gstReturnService._sumGstr1ExportTax(g1);
    assert.equal(exp.taxable, 50000);
  });
});

describe('GSTR-2', () => {
  it('excludes cancelled bills and keeps an IGST bill out of CGST/SGST', async () => {
    const capture = {};
    const restore = stubFind(Purchase, [
      { invoiceNo: 'P1', taxableAmount: 1000, cgst: 0, sgst: 0, igst: 180, gstAmount: 180, netAmount: 1180, supplierId: {} },
      { invoiceNo: 'P2', taxableAmount: 1000, gstAmount: 50, netAmount: 1050, supplierId: {} },
    ], capture);
    try {
      const rows = await gstService.getGstr2('c1', '2026-09-01', '2026-09-30');
      assert.deepEqual(capture.query.status, { $ne: 'cancelled' });
      assert.equal(rows[0].cgst, 0);
      assert.equal(rows[0].sgst, 0);
      assert.equal(rows[0].igst, 180);
      assert.equal(rows[1].cgst, 25, 'bills without a tax breakup still split CGST/SGST');
    } finally {
      restore();
    }
  });
});
