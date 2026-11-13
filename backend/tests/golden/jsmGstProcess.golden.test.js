'use strict';

/**
 * GSTIN Process / JobWork screens against JSM's SC27 views JSM_VW_GST_PROCESS_RECEIPT_SUMMARY and
 * JSM_VW_GST_JOBWORK_RECEIPT_SUMMARY: fed JSM's rows, the Summary Reports totals per register must equal JSM's own SUM per BOOK,
 * and the detail lists every row.   Regenerate: node scripts/golden-master/extractJsmGstProcess.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const reports = require('../../services/jsmReports');

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'jsm_sc27_gst_process.json'), 'utf8'));
const CID = '507f1f77bcf86cd799439011';
const SUMS = ['TO_PCS', 'TO_REC_QTY', 'SUB_TOT', 'TDS_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT'];

for (const [key, form] of [['process', 'A_Gstr2_ProcessSummary'], ['jobwork', 'A_Gstr2_JobWorkReceiptSummary']]) {
  const data = fx[key];
  const receipts = data.rows.map((r) => ({
    ...r, BILL_DATE: new Date(r.BILL_DATE), TO_PCS: Number(r.TO_PCS), TO_REC_QTY: Number(r.TO_REC_QTY), SUB_TOT: Number(r.SUB_TOT), TDS_AMT: Number(r.TDS_AMT),
    SGST_AMT: Number(r.SGST_AMT), CGST_AMT: Number(r.CGST_AMT), IGST_AMT: Number(r.IGST_AMT), NET_TOT: Number(r.NET_TOT),
  }));
  test(`${form}: Summary Reports totals equal JSM's SUM per BOOK`, async () => {
    const out = await reports.get(form).run(CID, { from: '2026-04-01', to: '2027-03-31', summary: true, orderBy1: 'Register' }, { receipts });
    for (const j of data.sums) {
      const mine = out.rows.find((r) => String(r.BOOK).trim() === j.BOOK);
      assert.ok(mine, `register ${j.BOOK} missing`);
      for (const f of SUMS) assert.equal(Number(mine[f].toFixed(2)), Number(Number(j[f]).toFixed(2)), `${j.BOOK} ${f}`);
    }
  });
  test(`${form}: detail lists every JSM row`, async () => {
    const out = await reports.get(form).run(CID, { from: '2026-04-01', to: '2027-03-31', orderBy1: 'Register' }, { receipts });
    assert.equal(out.rows.length, data.rows.length);
  });
}
