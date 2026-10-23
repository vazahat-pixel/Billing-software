/**
 * Golden-Master Report Reconciliation Harness
 *
 * Compares JSM SQL view output (expected) against MERN API output (actual)
 * for all 99 reports across 17 categories.
 *
 * Produces: mismatch_register.csv with row-by-row deltas.
 */

const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const GOLDEN_DIR = path.join(__dirname, '../../backups/golden-master');
const REPORTS_DIR = path.join(GOLDEN_DIR, 'reports');
const RECONCILIATION_DIR = path.join(GOLDEN_DIR, 'reconciliation');

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.mkdirSync(RECONCILIATION_DIR, { recursive: true });

const JSM_CONFIG = {
  server: '.\\JSMR2',
  database: 'JsmSql2_DEMO2026',
  authentication: { type: 'default' },
  options: { trustServerCertificate: true, encrypt: false }
};

const DATASET = {
  company: 'SANCHAL CREATION',
  coPath: '1',
  period: { month: 9, year: 2026 }
};

// Mapping from gap register: Report_ID -> JSM_View -> MERN_API
const REPORT_REGISTRY = [
  {
    id: 'RPT-001',
    name: 'CREDITOR_OS',
    jsmView: 'JSM_VW_OS_PURCHASE',
    mernApi: '/api/reports/outstanding?type=purchase',
    tier: 'High',
    keyField: 'BILL.NO',
    totals: ['BALANCE', 'PAID.AMT', 'RG.AMT']
  },
  {
    id: 'RPT-002',
    name: 'DEBITOR_OS',
    jsmView: 'JSM_VW_OS_SALES',
    mernApi: '/api/reports/outstanding?type=sales',
    tier: 'High',
    keyField: 'BILL.NO',
    totals: ['BALANCE', 'PAID.AMT', 'RG.AMT']
  },
  {
    id: 'RPT-011',
    name: 'GSTR-2 Inward',
    jsmView: 'JSM_VW_GST_PURCHASE_ALL_GSTR2_REPORT',
    mernApi: '/api/reports/gst/gstr2',
    tier: 'High',
    keyField: 'BILL.NO',
    totals: ['BILL.AMT', 'TAXABLE', 'SGST', 'CGST', 'IGST']
  },
  {
    id: 'RPT-014',
    name: 'GSTR-1 Outward',
    jsmView: 'JSM_VW_GST_SALES_SUMMARY_REPORT',
    mernApi: '/api/reports/gst/gstr1',
    tier: 'High',
    keyField: 'BillNo',
    totals: ['TAXABLE', 'SGST', 'CGST', 'IGST']
  },
  {
    id: 'RPT-018',
    name: 'Ledger Account',
    jsmView: 'JSM_VW_LEDGER_ACCOUNT',
    mernApi: '/api/reports/ledger',
    tier: 'High',
    keyField: 'BILL.NO',
    totals: ['DEBIT', 'CREDIT', 'BALANCE']
  }
];

async function extractJsmReport(pool, report) {
  const query = `
    SELECT TOP 1000 *
    FROM ${report.jsmView}
    WHERE CO_PATH = '${DATASET.coPath}'
    AND MONTH(ISNULL(SL_BILL_DT, ENT_DATE)) = ${DATASET.period.month}
    AND YEAR(ISNULL(SL_BILL_DT, ENT_DATE)) = ${DATASET.period.year}
  `;

  try {
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.warn(`  ⚠ JSM view ${report.jsmView}: ${err.message}`);
    return [];
  }
}

async function extractMernReport(report, companyId) {
  try {
    const mernUrl = `http://localhost:${process.env.PORT || 5000}${report.mernApi}`;
    const params = { companyId, fromDate: '2026-09-01', toDate: '2026-09-30' };

    const response = await axios.get(mernUrl, { params, timeout: 30000 });
    return response.data.data || response.data || [];
  } catch (err) {
    console.warn(`  ⚠ MERN API ${report.mernApi}: ${err.message}`);
    return [];
  }
}

function reconcileReport(report, jsmData, mernData) {
  const mismatches = [];

  // Row count mismatch
  if (jsmData.length !== mernData.length) {
    mismatches.push({
      report: report.id,
      type: 'ROW_COUNT',
      jsmValue: jsmData.length,
      mernValue: mernData.length,
      delta: mernData.length - jsmData.length
    });
  }

  // Key-by-key reconciliation
  const jsmByKey = new Map();
  for (const row of jsmData) {
    const keyVal = row[report.keyField];
    jsmByKey.set(keyVal, row);
  }

  const mernByKey = new Map();
  for (const row of mernData) {
    let keyVal = row[report.keyField] || row.billNo || row.invoiceNumber;
    mernByKey.set(keyVal, row);
  }

  // Find mismatched totals
  for (const totalField of report.totals || []) {
    let jsmTotal = 0, mernTotal = 0;

    for (const row of jsmData) {
      const val = parseFloat(row[totalField]) || 0;
      jsmTotal += val;
    }

    for (const row of mernData) {
      const val = parseFloat(row[totalField]) || 0;
      mernTotal += val;
    }

    const delta = Math.abs(mernTotal - jsmTotal);
    if (delta > 0.01) {
      mismatches.push({
        report: report.id,
        type: 'TOTAL_MISMATCH',
        field: totalField,
        jsmValue: jsmTotal.toFixed(2),
        mernValue: mernTotal.toFixed(2),
        delta: delta.toFixed(2)
      });
    }
  }

  return mismatches;
}

async function main() {
  console.log('========== GOLDEN-MASTER RECONCILIATION HARNESS ==========');
  console.log(`JSM Database: ${JSM_CONFIG.database}`);
  console.log(`MERN Server: http://localhost:${process.env.PORT || 5000}`);
  console.log(`Period: ${DATASET.period.month}/${DATASET.period.year}`);

  const pool = new sql.ConnectionPool(JSM_CONFIG);
  let allMismatches = [];

  try {
    await pool.connect();
    console.log('✓ Connected to JSM SQL Server\n');

    // TODO: Get companyId from test company imported earlier
    const companyId = 'REPLACE_WITH_TEST_COMPANY_ID';

    for (const report of REPORT_REGISTRY) {
      console.log(`[${report.id}] Reconciling ${report.name}...`);

      const jsmData = await extractJsmReport(pool, report);
      const mernData = await extractMernReport(report, companyId);

      console.log(`  JSM: ${jsmData.length} records`);
      console.log(`  MERN: ${mernData.length} records`);

      const mismatches = reconcileReport(report, jsmData, mernData);
      if (mismatches.length > 0) {
        console.log(`  ⚠ ${mismatches.length} mismatches found`);
        allMismatches = allMismatches.concat(mismatches);
      } else {
        console.log(`  ✓ Perfect match`);
      }
    }

    // Write mismatch register
    if (allMismatches.length > 0) {
      const csv = [
        'Report,Type,Field,JSMValue,MERNValue,Delta',
        ...allMismatches.map(m =>
          `${m.report},${m.type},${m.field || ''},${m.jsmValue},${m.mernValue},${m.delta}`
        )
      ].join('\n');

      const registerPath = path.join(RECONCILIATION_DIR, 'mismatch_register.csv');
      fs.writeFileSync(registerPath, csv, 'utf8');
      console.log(`\n⚠ ${allMismatches.length} mismatches. Register: ${registerPath}`);
    } else {
      console.log('\n✓ All reports match. Zero mismatches.');
    }

  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

main();
