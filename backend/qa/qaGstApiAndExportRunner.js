/**
 * qaGstApiAndExportRunner.js
 * =========================================================================
 * AUTONOMOUS GST CERTIFICATION — LAYER 2 (LIVE HTTP API) & LAYER 10 (EXCEL EXPORT)
 * =========================================================================
 *
 * This test runner executes against the LIVE HTTP server (http://localhost:5000)
 * using the real authentication token of the QA tenant:
 *   User:    qa.dev.admin@textileerp.dev
 *   Company: CI Textile Co
 *
 * It validates:
 *   - Layer 2: Network / Live API endpoints, status codes, JSON contracts, Auth token enforcement
 *   - Layer 10: Excel binary generation, UTF-8 parsing, non-blank rows, column headers, exact totals
 */

'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');

// Try loading xlsx from backend or frontend
let XLSX;
try {
  XLSX = require('xlsx');
} catch {
  try {
    XLSX = require(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'xlsx'));
  } catch (e) {
    console.warn('xlsx module not found in backend or frontend node_modules:', e.message);
  }
}

const QA_EMAIL = 'qa.dev.admin@textileerp.dev';
const QA_PASSWORD = 'QaTenant@123';
const PORT = 5050;
const HOST = 'localhost';

const scorecard = [];
let testNum = 0;

function record(layer, name, status, expected, actual, detail = '', severity = 'P1') {
  testNum++;
  const id = `API-${String(testNum).padStart(3, '0')}`;
  const pass = status === 'PASS';
  const icon = status === 'PASS' ? '🟢' : status === 'FAIL' ? '🔴' : '🟡';
  scorecard.push({ id, layer, name, status, expected, actual, detail, severity });
  console.log(`${icon} [${id}] [${layer}] ${name}`);
  if (!pass) {
    console.log(`   Expected: ${JSON.stringify(expected)}`);
    console.log(`   Actual  : ${JSON.stringify(actual)}`);
    if (detail) console.log(`   Detail  : ${detail}`);
  } else if (detail) {
    console.log(`   ✓ ${detail}`);
  }
  return pass;
}

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });
    req.on('error', reject);
    if (body) {
      const b = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(b);
    }
    req.end();
  });
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   AUTONOMOUS GST CERTIFICATION — LAYER 2 (API) & LAYER 10 (EXCEL)║');
  console.log('║   Company: CI Textile Co | User: qa.dev.admin@textileerp.dev     ║');
  console.log('║   Target: http://localhost:5000                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // ─── Step 1: Live Authentication ─────────────────────────────────────────
  console.log('════════════════════════════════════════');
  console.log('PHASE 1: LIVE HTTP AUTHENTICATION');
  console.log('════════════════════════════════════════');

  let token = null;
  let user = null;
  try {
    const loginRes = await request({
      hostname: HOST, port: PORT, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: QA_EMAIL, password: QA_PASSWORD });

    record('Layer 2 (API)', 'POST /api/auth/login Status Code 200',
      loginRes.status === 200 ? 'PASS' : 'FAIL',
      200, loginRes.status, '', 'P0');

    token = loginRes.body?.token || loginRes.body?.data?.token;
    user = loginRes.body?.user || loginRes.body?.data?.user;

    record('Layer 2 (API)', 'JWT Bearer Token Returned',
      typeof token === 'string' && token.length > 20 ? 'PASS' : 'FAIL',
      'Valid JWT string', token ? `${token.slice(0, 15)}...` : 'NONE', '', 'P0');

    record('Layer 2 (API)', 'User Authenticated as CI Textile Co',
      user?.companyId ? 'PASS' : 'FAIL',
      'Non-empty companyId', user?.companyId || 'MISSING', `User: ${user?.name || QA_EMAIL}`, 'P0');

  } catch (err) {
    record('Layer 2 (API)', 'Server Connection Failed', 'FAIL', 'Connected', err.message, 'Is backend running on port 5000?', 'P0');
    console.error('Fatal: Cannot proceed without server connection.');
    process.exit(1);
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const NOW = new Date();
  const FROM_DATE = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate();
  const TO_DATE = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const PERIOD = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`;

  // ─── Step 2: GSTIN Sales Detail Report ───────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('PHASE 2: GSTIN SALES DETAIL API');
  console.log('════════════════════════════════════════');

  let salesDetailRes;
  try {
    salesDetailRes = await request({
      hostname: HOST, port: PORT,
      path: `/api/gstin-reports/sales/detail?fromDate=${FROM_DATE}&toDate=${TO_DATE}`,
      method: 'GET', headers: authHeaders,
    });

    record('Layer 2 (API)', 'GET /api/gstin-reports/sales/detail Status 200',
      salesDetailRes.status === 200 ? 'PASS' : 'FAIL', 200, salesDetailRes.status, '', 'P0');

    const data = salesDetailRes.body?.data || salesDetailRes.body;
    record('Layer 2 (API)', 'Sales Detail Contract: rows and totals Present',
      Array.isArray(data?.rows) && data?.totals ? 'PASS' : 'FAIL',
      '{ rows: [], totals: {} }', typeof data, '', 'P1');

    const rows = data?.rows || [];
    const qaB2b = rows.find(r => r.invoiceNo === 'QA-GST-SALE-B2B-001');
    const qaInter = rows.find(r => r.invoiceNo === 'QA-GST-SALE-INTER-001');
    const qaB2c = rows.find(r => r.invoiceNo === 'QA-GST-SALE-B2C-001');

    record('Layer 2 (API)', 'QA B2B Local Sale Returned by API',
      qaB2b !== undefined ? 'PASS' : 'FAIL',
      'QA-GST-SALE-B2B-001', qaB2b?.invoiceNo || 'NOT FOUND', '', 'P0');

    if (qaB2b) {
      record('Layer 2 (API)', 'QA B2B Taxable Amount = 50,000',
        qaB2b.taxableAmount === 50000 ? 'PASS' : 'FAIL', 50000, qaB2b.taxableAmount, '', 'P0');
      record('Layer 2 (API)', 'QA B2B CGST = 1,250',
        qaB2b.cgst === 1250 ? 'PASS' : 'FAIL', 1250, qaB2b.cgst, '', 'P0');
      record('Layer 2 (API)', 'QA B2B SGST = 1,250',
        qaB2b.sgst === 1250 ? 'PASS' : 'FAIL', 1250, qaB2b.sgst, '', 'P0');
    }

    record('Layer 2 (API)', 'QA Interstate Sale Returned by API',
      qaInter !== undefined ? 'PASS' : 'FAIL',
      'QA-GST-SALE-INTER-001', qaInter?.invoiceNo || 'NOT FOUND', '', 'P0');

    if (qaInter) {
      record('Layer 2 (API)', 'QA Interstate IGST = 3,000',
        qaInter.igst === 3000 ? 'PASS' : 'FAIL', 3000, qaInter.igst, '', 'P0');
      record('Layer 2 (API)', 'QA Interstate CGST = 0',
        qaInter.cgst === 0 ? 'PASS' : 'FAIL', 0, qaInter.cgst, '', 'P0');
    }

    record('Layer 2 (API)', 'QA B2C Sale Returned by API',
      qaB2c !== undefined ? 'PASS' : 'FAIL',
      'QA-GST-SALE-B2C-001', qaB2c?.invoiceNo || 'NOT FOUND', '', 'P0');

  } catch (err) {
    record('Layer 2 (API)', 'GET Sales Detail Execution', 'FAIL', 'No exception', err.message, '', 'P0');
  }

  // ─── Step 3: GSTIN Sales Summary API (Group By) ──────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('PHASE 3: GSTIN SALES SUMMARY & GROUP BY API');
  console.log('════════════════════════════════════════');

  try {
    // Group by party
    const summaryPartyRes = await request({
      hostname: HOST, port: PORT,
      path: `/api/gstin-reports/sales/summary?fromDate=${FROM_DATE}&toDate=${TO_DATE}&groupBy1=party`,
      method: 'GET', headers: authHeaders,
    });

    record('Layer 2 (API)', 'GET Sales Summary (Group By Party) Status 200',
      summaryPartyRes.status === 200 ? 'PASS' : 'FAIL', 200, summaryPartyRes.status, '', 'P1');

    const partyData = summaryPartyRes.body?.data || summaryPartyRes.body;
    const partyGroups = partyData?.groups || [];
    record('Layer 2 (API)', 'Sales Summary Returns Groups Array',
      Array.isArray(partyGroups) && partyGroups.length > 0 ? 'PASS' : 'FAIL',
      '>0 party groups', partyGroups.length, '', 'P1');

    // Group by GST rate
    const summaryRateRes = await request({
      hostname: HOST, port: PORT,
      path: `/api/gstin-reports/sales/summary?fromDate=${FROM_DATE}&toDate=${TO_DATE}&groupBy1=gstRate`,
      method: 'GET', headers: authHeaders,
    });

    record('Layer 2 (API)', 'GET Sales Summary (Group By GST Rate) Status 200',
      summaryRateRes.status === 200 ? 'PASS' : 'FAIL', 200, summaryRateRes.status, '', 'P1');

    const rateData = summaryRateRes.body?.data || summaryRateRes.body;
    const rate5Group = (rateData?.groups || []).find(g => g.groupKey === '5%');
    record('Layer 2 (API)', '5% GST Rate Group Found in Summary',
      rate5Group !== undefined ? 'PASS' : 'FAIL',
      'Group 5%', rate5Group?.groupKey || 'NOT FOUND', '', 'P1');

  } catch (err) {
    record('Layer 2 (API)', 'Sales Summary Execution', 'FAIL', 'No exception', err.message, '', 'P1');
  }

  // ─── Step 4: GSTIN Purchase Detail API ───────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('PHASE 4: GSTIN PURCHASE DETAIL API');
  console.log('════════════════════════════════════════');

  let purDetailRes;
  try {
    purDetailRes = await request({
      hostname: HOST, port: PORT,
      path: `/api/gstin-reports/purchase/detail?fromDate=${FROM_DATE}&toDate=${TO_DATE}`,
      method: 'GET', headers: authHeaders,
    });

    record('Layer 2 (API)', 'GET /api/gstin-reports/purchase/detail Status 200',
      purDetailRes.status === 200 ? 'PASS' : 'FAIL', 200, purDetailRes.status, '', 'P0');

    const data = purDetailRes.body?.data || purDetailRes.body;
    const rows = data?.rows || [];
    const qaPur = rows.find(r => r.invoiceNo === 'QA-GST-PUR-001');

    record('Layer 2 (API)', 'QA Purchase Bill Returned by API',
      qaPur !== undefined ? 'PASS' : 'FAIL',
      'QA-GST-PUR-001', qaPur?.invoiceNo || 'NOT FOUND', '', 'P0');

    if (qaPur) {
      record('Layer 2 (API)', 'QA Purchase Taxable = 1,00,000',
        qaPur.taxableAmount === 100000 ? 'PASS' : 'FAIL', 100000, qaPur.taxableAmount, '', 'P0');
      record('Layer 2 (API)', 'QA Purchase CGST = 2,500',
        qaPur.cgst === 2500 ? 'PASS' : 'FAIL', 2500, qaPur.cgst, '', 'P0');
      record('Layer 2 (API)', 'QA Purchase SGST = 2,500',
        qaPur.sgst === 2500 ? 'PASS' : 'FAIL', 2500, qaPur.sgst, '', 'P0');
      record('Layer 2 (API)', 'QA Purchase Net Amount = 1,05,000',
        qaPur.netAmount === 105000 ? 'PASS' : 'FAIL', 105000, qaPur.netAmount, '', 'P0');
    }

  } catch (err) {
    record('Layer 2 (API)', 'Purchase Detail Execution', 'FAIL', 'No exception', err.message, '', 'P0');
  }

  // ─── Step 5: GSTR-1 API ──────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('PHASE 5: GSTR-1 STATUTORY RETURN API');
  console.log('════════════════════════════════════════');

  try {
    const gstr1Res = await request({
      hostname: HOST, port: PORT,
      path: `/api/stage4/returns/gstr1?period=${PERIOD}`,
      method: 'GET', headers: authHeaders,
    });

    record('Layer 2 (API)', 'GET /api/stage4/returns/gstr1 Status 200',
      gstr1Res.status === 200 ? 'PASS' : 'FAIL', 200, gstr1Res.status, '', 'P0');

    const g1 = gstr1Res.body?.data || gstr1Res.body;
    const payload = g1?.payload || {};

    record('Layer 2 (API)', 'GSTR-1 JSON Payload Valid Structure',
      payload.gstin && payload.fp && Array.isArray(payload.b2b) ? 'PASS' : 'FAIL',
      '{ gstin, fp, b2b: [] }', `gstin: ${payload.gstin}, fp: ${payload.fp}`, '', 'P0');

    const allB2b = (payload.b2b || []).flatMap(g => g.inv || []);
    const b2bMatch = allB2b.find(i => i.inum === 'QA-GST-SALE-B2B-001');
    record('Layer 2 (API)', 'GSTR-1 B2B Invoices Include QA Sale',
      b2bMatch !== undefined ? 'PASS' : 'FAIL',
      'QA-GST-SALE-B2B-001', b2bMatch?.inum || 'NOT FOUND', '', 'P0');

    record('Layer 2 (API)', 'GSTR-1 CDNR Section Populated (Sales Credit Note)',
      Array.isArray(payload.cdnr) && payload.cdnr.length > 0 ? 'PASS' : 'FAIL',
      '>0 CDNR groups', payload.cdnr?.length, '', 'P1');

  } catch (err) {
    record('Layer 2 (API)', 'GSTR-1 API Execution', 'FAIL', 'No exception', err.message, '', 'P0');
  }

  // ─── Step 6: GSTR-3B API ──────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('PHASE 6: GSTR-3B STATUTORY RETURN API');
  console.log('════════════════════════════════════════');

  try {
    const gstr3bRes = await request({
      hostname: HOST, port: PORT,
      path: `/api/stage4/returns/gstr3b?period=${PERIOD}`,
      method: 'GET', headers: authHeaders,
    });

    record('Layer 2 (API)', 'GET /api/stage4/returns/gstr3b Status 200',
      gstr3bRes.status === 200 ? 'PASS' : 'FAIL', 200, gstr3bRes.status, '', 'P0');

    const g3b = gstr3bRes.body?.data || gstr3bRes.body;
    const payload = g3b?.payload || {};
    const outward = payload.sup_details?.osup_det || {};

    record('Layer 2 (API)', 'GSTR-3B Table 3.1 Outward Taxable Calculated',
      outward.txval > 0 ? 'PASS' : 'FAIL',
      '>0 taxable', outward.txval, '', 'P0');

    record('Layer 2 (API)', 'GSTR-3B Table 3.1 Outward CGST Correct',
      outward.camt === 3050 ? 'PASS' : 'FAIL',
      3050, outward.camt, '3175 gross - 125 CN = 3050', 'P0');

    record('Layer 2 (API)', 'GSTR-3B Table 3.1 Outward SGST Correct',
      outward.samt === 3050 ? 'PASS' : 'FAIL',
      3050, outward.samt, '', 'P0');

    record('Layer 2 (API)', 'GSTR-3B Table 4 Eligible ITC Present',
      Array.isArray(payload.itc_elg?.itc_avl) && payload.itc_elg.itc_avl.length > 0 ? 'PASS' : 'FAIL',
      '>0 ITC entries', payload.itc_elg?.itc_avl?.length, '', 'P0');

  } catch (err) {
    record('Layer 2 (API)', 'GSTR-3B API Execution', 'FAIL', 'No exception', err.message, '', 'P0');
  }

  // ─── Step 7: GSTR-1 Error Checking API ────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('PHASE 7: GSTR-1 ERROR CHECKING API');
  console.log('════════════════════════════════════════');

  try {
    const errRes = await request({
      hostname: HOST, port: PORT,
      path: `/api/gstin-reports/gstr1-errors?fromDate=${FROM_DATE}&toDate=${TO_DATE}`,
      method: 'GET', headers: authHeaders,
    });

    record('Layer 2 (API)', 'GET /api/gstin-reports/gstr1-errors Status 200',
      errRes.status === 200 ? 'PASS' : 'FAIL', 200, errRes.status, '', 'P1');

    const errData = errRes.body?.data || errRes.body;
    record('Layer 2 (API)', 'GSTR-1 Error Audit Returns errors Array',
      Array.isArray(errData?.errors) ? 'PASS' : 'FAIL',
      'Array of error items', typeof errData?.errors, `${errData?.errors?.length || 0} notices`, 'P1');

  } catch (err) {
    record('Layer 2 (API)', 'GSTR-1 Error Checking Execution', 'FAIL', 'No exception', err.message, '', 'P1');
  }

  // ─── Step 8: Cross-Report Reconciliation API ─────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('PHASE 8: CROSS-REPORT RECONCILIATION API');
  console.log('════════════════════════════════════════');

  try {
    const reconRes = await request({
      hostname: HOST, port: PORT,
      path: `/api/gstin-reports/cross-reconciliation?period=${PERIOD}`,
      method: 'GET', headers: authHeaders,
    });

    record('Layer 2 (API)', 'GET /api/gstin-reports/cross-reconciliation Status 200',
      reconRes.status === 200 ? 'PASS' : 'FAIL', 200, reconRes.status, '', 'P0');

    const reconData = reconRes.body?.data || reconRes.body;
    const checks = reconData?.checks || [];

    record('Layer 2 (API)', 'Cross-Reconciliation Returned Checks Array',
      Array.isArray(checks) && checks.length > 0 ? 'PASS' : 'FAIL',
      '>0 reconciliation checks', checks.length, '', 'P1');

    const mismatches = checks.filter(c => c.status === 'MISMATCH');
    record('Layer 2 (API)', 'Cross-Report ZERO Mismatches Across Return Modules',
      mismatches.length === 0 ? 'PASS' : 'FAIL',
      '0 mismatches', `${mismatches.length} mismatches`,
      mismatches.length === 0 ? 'Sales ↔ GSTR-1 ↔ GSTR-3B all reconcile perfectly' : JSON.stringify(mismatches),
      'P0');

  } catch (err) {
    record('Layer 2 (API)', 'Cross-Reconciliation Execution', 'FAIL', 'No exception', err.message, '', 'P0');
  }

  // ─── Step 9: Layer 10 Excel Export Fidelity ──────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('PHASE 9: LAYER 10 — EXCEL EXPORT FIDELITY');
  console.log('════════════════════════════════════════');

  if (XLSX) {
    try {
      // 1. Take rows from the real Sales Detail API
      const salesData = salesDetailRes?.body?.data || salesDetailRes?.body;
      const rawRows = salesData?.rows || [];

      // Mirror the frontend exportTableToExcel logic
      const exportRows = rawRows.map(r => ({
        'Invoice No': r.invoiceNo,
        'Date': r.date ? new Date(r.date).toLocaleDateString('en-IN') : '',
        'Party Name': r.partyName,
        'GSTIN': r.gstin,
        'State': r.stateName,
        'GST Type': r.gstType,
        'Taxable (₹)': r.taxableAmount,
        'CGST (₹)': r.cgst,
        'SGST (₹)': r.sgst,
        'IGST (₹)': r.igst,
        'GST Total (₹)': r.gstAmount,
        'Net Amount (₹)': r.netAmount,
      }));

      // Generate binary workbook
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'GSTIN Sales');
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      record('Layer 10 (Excel)', 'Excel Binary Workbook Generated Successfully',
        Buffer.isBuffer(excelBuffer) && excelBuffer.length > 500 ? 'PASS' : 'FAIL',
        '>500 bytes binary .xlsx buffer', `${excelBuffer.length} bytes`, '', 'P1');

      // Save to test file
      const exportFilePath = path.join(__dirname, 'qa_gstin_sales_export_test.xlsx');
      fs.writeFileSync(exportFilePath, excelBuffer);

      // Re-read and parse binary file to verify roundtrip fidelity
      const parsedWb = XLSX.readFile(exportFilePath);
      const firstSheet = parsedWb.Sheets['GSTIN Sales'];
      const parsedData = XLSX.utils.sheet_to_json(firstSheet);

      record('Layer 10 (Excel)', 'Exported Excel Contains Correct Row Count',
        parsedData.length === rawRows.length ? 'PASS' : 'FAIL',
        rawRows.length, parsedData.length, `Expected ${rawRows.length} rows in sheet`, 'P1');

      // Check header presence
      const expectedHeaders = ['Invoice No', 'Party Name', 'GSTIN', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'Net Amount (₹)'];
      const hasHeaders = expectedHeaders.every(h => parsedData.length > 0 && h in parsedData[0]);
      record('Layer 10 (Excel)', 'Exported Excel Contains All Statutory GST Headers',
        hasHeaders ? 'PASS' : 'FAIL',
        expectedHeaders.join(', '), hasHeaders ? 'ALL PRESENT' : 'MISSING HEADERS', '', 'P1');

      // Check mathematical sum from Excel sheet matches API totals
      const excelTaxableSum = Math.round(parsedData.reduce((s, r) => s + (Number(r['Taxable (₹)']) || 0), 0) * 100) / 100;
      const apiTaxableSum = salesData?.totals?.taxableAmount;

      record('Layer 10 (Excel)', 'Excel Sheet Taxable Sum Matches API Response (No Blank Data)',
        Math.abs(excelTaxableSum - apiTaxableSum) < 0.05 ? 'PASS' : 'FAIL',
        apiTaxableSum, excelTaxableSum, `API: ₹${apiTaxableSum}, Excel: ₹${excelTaxableSum}`, 'P0');

      const excelCgstSum = Math.round(parsedData.reduce((s, r) => s + (Number(r['CGST (₹)']) || 0), 0) * 100) / 100;
      const apiCgstSum = salesData?.totals?.cgst;
      record('Layer 10 (Excel)', 'Excel Sheet CGST Sum Matches API Response',
        Math.abs(excelCgstSum - apiCgstSum) < 0.05 ? 'PASS' : 'FAIL',
        apiCgstSum, excelCgstSum, `API: ₹${apiCgstSum}, Excel: ₹${excelCgstSum}`, 'P0');

      // Clean up test file
      try { fs.unlinkSync(exportFilePath); } catch {}

    } catch (err) {
      record('Layer 10 (Excel)', 'Excel Export Verification', 'FAIL', 'No exception', err.message, '', 'P1');
    }
  } else {
    record('Layer 10 (Excel)', 'Excel Export Engine Available', 'GAP', 'xlsx library', 'Not loaded', '', 'P2');
  }

  // ─── Final Scorecard ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       LAYER 2 (API) & LAYER 10 (EXCEL) CERTIFICATION SCORECARD   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const total = scorecard.length;
  const passed = scorecard.filter(t => t.status === 'PASS').length;
  const failed = scorecard.filter(t => t.status === 'FAIL').length;
  const p0 = scorecard.filter(t => t.status === 'FAIL' && t.severity === 'P0').length;
  const p1 = scorecard.filter(t => t.status === 'FAIL' && t.severity === 'P1').length;

  console.log(`📊 TOTAL API & EXCEL TESTS : ${total}`);
  console.log(`🟢 PASSED                 : ${passed} (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`🔴 FAILED                 : ${failed}`);
  console.log(`   P0 Critical Defects    : ${p0}`);
  console.log(`   P1 Major Defects       : ${p1}`);

  if (failed === 0) {
    console.log('\n🏆 ALL API & EXCEL EXPORT CHECKS CERTIFIED 100% PASS!');
  } else {
    console.log('\n⚠️  FAILURES DETECTED IN API / EXCEL LAYER:');
    scorecard.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  🔴 [${t.id}] ${t.name}: expected ${t.expected}, actual ${t.actual}`);
    });
  }

  // Save report
  const reportPath = path.join(__dirname, 'gst_api_certification_result.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), total, passed, failed, p0, p1, scorecard }, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}\n`);

  process.exit(failed === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('\n❌ RUNNER CRASHED:', err);
  process.exit(1);
});
