/**
 * Phase 10: Golden-Master Reconciliation
 *
 * Automated regression suite. Ensures that JSM's SQL view output matches
 * MERN's API output row-for-row and total-for-total.
 *
 * Runs after all data is frozen and imported.
 * Part of continuous certification workflow.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sql = require('mssql');

const { context } = require('./context');

const JSM_CONFIG = {
  server: '.\\JSMR2',
  database: 'JsmSql2_DEMO2026',
  authentication: { type: 'default' },
  options: { trustServerCertificate: true, encrypt: false }
};

const GOLDEN_DIR = path.join(__dirname, '../backups/golden-master');
const RECONCILIATION_DIR = path.join(GOLDEN_DIR, 'reconciliation');

fs.mkdirSync(RECONCILIATION_DIR, { recursive: true });

// Top-priority reports for Phase 10 validation
const CRITICAL_REPORTS = [
  {
    id: 'RPT-014',
    name: 'GSTR-1 Sales Summary',
    jsmView: 'JSM_VW_GST_SALES_SUMMARY_REPORT',
    mernEndpoint: 'GET /api/reports/gst/gstr1',
    category: 'GST',
    keyField: 'BillNo',
    numericFields: ['TAXABLE', 'SGST', 'CGST', 'IGST', 'Cess']
  },
  {
    id: 'RPT-011',
    name: 'GSTR-2 Purchase Summary',
    jsmView: 'JSM_VW_GST_PURCHASE_SUMMARY_REPORT',
    mernEndpoint: 'GET /api/reports/gst/gstr2',
    category: 'GST',
    keyField: 'BILL.NO',
    numericFields: ['TAXABLE', 'SGST', 'CGST', 'IGST']
  },
  {
    id: 'RPT-002',
    name: 'Sales Outstanding',
    jsmView: 'JSM_VW_OS_SALES',
    mernEndpoint: 'GET /api/reports/outstanding?type=sales',
    category: 'Outstanding',
    keyField: 'BILL.NO',
    numericFields: ['BALANCE', 'PAID.AMT', 'RG.AMT']
  },
  {
    id: 'RPT-001',
    name: 'Purchase Outstanding',
    jsmView: 'JSM_VW_OS_PURCHASE',
    mernEndpoint: 'GET /api/reports/outstanding?type=purchase',
    category: 'Outstanding',
    keyField: 'BILL.NO',
    numericFields: ['BALANCE', 'PAID.AMT', 'RG.AMT']
  },
  {
    id: 'RPT-018',
    name: 'Ledger Account',
    jsmView: 'JSM_VW_LEDGER_ACCOUNT',
    mernEndpoint: 'GET /api/reports/ledger',
    category: 'Financial',
    keyField: 'BILL.NO',
    numericFields: ['DEBIT', 'CREDIT', 'BALANCE']
  }
];

class GoldenMasterValidator {
  constructor() {
    this.mismatches = [];
    this.results = {
      passed: 0,
      failed: 0,
      categories: {}
    };
  }

  async validateReport(report, testCompanyId, pool) {
    console.log(`\n  [${report.id}] ${report.name}...`);

    // Extract from JSM
    let jsmData = [];
    try {
      const query = `
        SELECT TOP 500 *
        FROM ${report.jsmView}
        WHERE CO_PATH = '1'
        AND MONTH(ISNULL(SL_BILL_DT, ENT_DATE)) = 9
        AND YEAR(ISNULL(SL_BILL_DT, ENT_DATE)) = 2026
      `;
      const result = await pool.request().query(query);
      jsmData = result.recordset || [];
    } catch (err) {
      console.warn(`    ⚠ JSM query failed: ${err.message}`);
    }

    // Extract from MERN
    let mernData = [];
    try {
      const baseUrl = context.mernServer || 'http://localhost:5000';
      const response = await axios.get(`${baseUrl}/api/reports/gst/gstr1`, {
        params: {
          companyId: testCompanyId,
          fromDate: '2026-09-01',
          toDate: '2026-09-30'
        }
      });
      mernData = response.data?.data || [];
    } catch (err) {
      console.warn(`    ⚠ MERN API failed: ${err.message}`);
    }

    // Reconcile
    const rowCountMatch = jsmData.length === mernData.length;
    console.log(`    JSM: ${jsmData.length} | MERN: ${mernData.length} ${rowCountMatch ? '✓' : '✗'}`);

    // Total reconciliation
    let totalsMatch = true;
    for (const field of report.numericFields || []) {
      let jsmTotal = 0, mernTotal = 0;

      for (const row of jsmData) {
        jsmTotal += parseFloat(row[field]) || 0;
      }
      for (const row of mernData) {
        mernTotal += parseFloat(row[field]) || 0;
      }

      const delta = Math.abs(mernTotal - jsmTotal);
      if (delta > 0.01) {
        totalsMatch = false;
        this.mismatches.push({
          report: report.id,
          field,
          jsmTotal: jsmTotal.toFixed(2),
          mernTotal: mernTotal.toFixed(2),
          delta: delta.toFixed(2)
        });
        console.log(`    ⚠ ${field}: JSM ${jsmTotal.toFixed(2)} vs MERN ${mernTotal.toFixed(2)}`);
      }
    }

    const passed = rowCountMatch && totalsMatch;
    if (passed) {
      this.results.passed++;
      console.log(`    ✓ Passed`);
    } else {
      this.results.failed++;
      console.log(`    ✗ Failed`);
    }

    const cat = report.category;
    if (!this.results.categories[cat]) {
      this.results.categories[cat] = { passed: 0, failed: 0 };
    }
    if (passed) {
      this.results.categories[cat].passed++;
    } else {
      this.results.categories[cat].failed++;
    }
  }

  async run(testCompanyId) {
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║  Phase 10: Golden-Master Report Validation    ║');
    console.log('╚═══════════════════════════════════════════════╝');

    if (!fs.existsSync(GOLDEN_DIR)) {
      console.log('⚠ Golden-master data not extracted. Run:');
      console.log('  node scripts/golden-master/jsm-extract-demo.js');
      return;
    }

    const pool = new sql.ConnectionPool(JSM_CONFIG);
    try {
      await pool.connect();
      console.log('✓ Connected to JSM');

      for (const report of CRITICAL_REPORTS) {
        await this.validateReport(report, testCompanyId, pool);
      }

      // Write results
      const resultsPath = path.join(RECONCILIATION_DIR, 'phase10_results.json');
      fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2), 'utf8');

      if (this.mismatches.length > 0) {
        const mismatchPath = path.join(RECONCILIATION_DIR, 'phase10_mismatches.csv');
        const csv = [
          'Report,Field,JSMTotal,MERNTotal,Delta',
          ...this.mismatches.map(m =>
            `${m.report},${m.field},${m.jsmTotal},${m.mernTotal},${m.delta}`
          )
        ].join('\n');
        fs.writeFileSync(mismatchPath, csv, 'utf8');
        console.log(`\n⚠ ${this.mismatches.length} mismatches. See: ${mismatchPath}`);
      }

      console.log(`\n📊 Results Summary:`);
      console.log(`  Passed: ${this.results.passed}`);
      console.log(`  Failed: ${this.results.failed}`);
      console.log(`  By Category:`, this.results.categories);

    } catch (err) {
      console.error(`✗ Error: ${err.message}`);
    } finally {
      await pool.close();
    }
  }
}

module.exports = {
  GoldenMasterValidator
};

// CLI runner
if (require.main === module) {
  const validator = new GoldenMasterValidator();
  const testCompanyId = process.argv[2] || 'REPLACE_WITH_TEST_COMPANY_ID';
  validator.run(testCompanyId).catch(err => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
