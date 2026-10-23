/**
 * Extract a frozen dataset from JSM SQL Server for golden-master testing.
 * Exports: masters, transactions, and opening balances for Sep 2026.
 * Safe: Read-only. Outputs CSV and JSON.
 */

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const config = {
  server: '.\\JSMR2',
  database: 'JsmSql2_DEMO2026',
  authentication: { type: 'default' },
  options: { trustServerCertificate: true, encrypt: false }
};

const DATASET = {
  company: 'SANCHAL CREATION',
  period: { month: 9, year: 2026 }, // Sep 2026
  coPath: '1' // JSM CO_PATH for company identification
};

const outDir = path.join(__dirname, '../../backups/golden-master');
fs.mkdirSync(outDir, { recursive: true });

async function extractMasters(pool) {
  console.log('\n[MASTERS] Extracting item, party, and ledger masters...');

  const queries = {
    items: `
      SELECT
        IT_CODE AS itemCode, IT_NAME AS itemName,
        ISNULL(IT_HSN_CODE, '') AS hsnCode,
        IT_QUC AS unit, IT_GST_PER AS gstRate,
        IT_CATG AS category
      FROM MST_IT_MAST
      WHERE CO_PATH = '${DATASET.coPath}'
      ORDER BY IT_CODE
    `,
    parties: `
      SELECT
        AC_CODE AS acCode, AC_NAME AS acName,
        AC_GSTIN AS gstin, AC_CITY AS city,
        AC_ADD_1 AS address, AC_TEL_NO AS phone,
        AC_MAINGRP AS mainGroup, AC_SUBGRP AS subGroup
      FROM MST_AC_MAST
      WHERE CO_PATH = '${DATASET.coPath}'
      ORDER BY AC_CODE
    `,
    accounts: `
      SELECT
        AC_CODE AS acCode, AC_NAME AS acName,
        AC_MAINGRP AS mainGroup, AC_SUBGRP AS subGroup,
        ISNULL(AC_OPENING_BAL, 0) AS openingBal,
        ISNULL(AC_OPENING_BAL_DR_CR, 'Cr') AS balDrCr
      FROM MST_AC_MAST
      WHERE CO_PATH = '${DATASET.coPath}'
      ORDER BY AC_CODE
    `
  };

  const result = {};
  for (const [key, query] of Object.entries(queries)) {
    try {
      const records = await pool.request().query(query);
      result[key] = records.recordset;
      console.log(`  ✓ ${key}: ${records.recordset.length} records`);

      // Write CSV
      if (records.recordset.length > 0) {
        const csv = toCsv(records.recordset);
        fs.writeFileSync(path.join(outDir, `${key}.csv`), csv, 'utf8');
      }
    } catch (err) {
      console.error(`  ✗ ${key}: ${err.message}`);
    }
  }

  return result;
}

async function extractTransactions(pool) {
  console.log('\n[TRANSACTIONS] Extracting sales, purchase, and vouchers for Sep 2026...');

  const dateRange = `
    WHERE ENT_DATE >= '2026-09-01' AND ENT_DATE <= '2026-09-30'
    AND CO_PATH = '${DATASET.coPath}'
  `;

  const queries = {
    sales: `
      SELECT
        ENT_NO, ENT_DATE, SL_BOOK_NAME AS book,
        SL_SLSMAN_AC_CD AS slsmanCode, SL_PARTY_AC_CD AS partyCode,
        ISNULL(SL_GROSS_AMT, 0) AS grossAmount,
        ISNULL(SL_DISC_AMT, 0) AS discountAmount,
        ISNULL(SL_TAX_AMT, 0) AS taxAmount,
        ISNULL(SL_NET_AMT, 0) AS netAmount
      FROM T_SALES ${dateRange}
      ORDER BY ENT_NO
    `,
    salesDetail: `
      SELECT
        ENT_NO, SR_NO, IT_CODE AS itemCode, IT_NAME,
        ISNULL(SL_DT_PCS, 0) AS pcs,
        ISNULL(SL_DT_QTY, 0) AS qty,
        ISNULL(SL_DT_RATE, 0) AS rate,
        ISNULL(SL_DT_AMOUNT, 0) AS lineAmount,
        ISNULL(SL_DT_HSN, '') AS hsn,
        ISNULL(SL_DT_GSTPER, 0) AS gstRate,
        ISNULL(SL_DT_GSTAMT, 0) AS gstAmount
      FROM T_SL_DT
      WHERE ENT_NO IN (
        SELECT ENT_NO FROM T_SALES ${dateRange}
      )
      ORDER BY ENT_NO, SR_NO
    `,
    purchase: `
      SELECT
        ENT_NO, ENT_DATE, PU_BOOK_NAME AS book,
        PU_PARTY_AC_CD AS partyCode,
        ISNULL(PU_GROSS_AMT, 0) AS grossAmount,
        ISNULL(PU_DISC_AMT, 0) AS discountAmount,
        ISNULL(PU_TAX_AMT, 0) AS taxAmount,
        ISNULL(PU_NET_AMT, 0) AS netAmount
      FROM T_PU ${dateRange}
      ORDER BY ENT_NO
    `,
    purchaseDetail: `
      SELECT
        ENT_NO, SR_NO, IT_CODE AS itemCode, IT_NAME,
        ISNULL(PU_DT_PCS, 0) AS pcs,
        ISNULL(PU_DT_QTY, 0) AS qty,
        ISNULL(PU_DT_RATE, 0) AS rate,
        ISNULL(PU_DT_AMOUNT, 0) AS lineAmount,
        ISNULL(PU_DT_HSN, '') AS hsn,
        ISNULL(PU_DT_GSTPER, 0) AS gstRate,
        ISNULL(PU_DT_GSTAMT, 0) AS gstAmount
      FROM T_PU_DT
      WHERE ENT_NO IN (
        SELECT ENT_NO FROM T_PU ${dateRange}
      )
      ORDER BY ENT_NO, SR_NO
    `,
    vouchers: `
      SELECT
        ENT_NO, ENT_DATE, T_VOU_BOOK_NAME AS book,
        T_VOU_NARRATION AS narration,
        ISNULL(T_VOU_DEBIT, 0) AS debitAmount,
        ISNULL(T_VOU_CREDIT, 0) AS creditAmount,
        T_VOU_AC_CD AS acCode
      FROM T_TRANDATA ${dateRange}
      ORDER BY ENT_NO, T_VOU_SR_NO
    `
  };

  const result = {};
  for (const [key, query] of Object.entries(queries)) {
    try {
      const records = await pool.request().query(query);
      result[key] = records.recordset;
      console.log(`  ✓ ${key}: ${records.recordset.length} records`);

      if (records.recordset.length > 0) {
        const csv = toCsv(records.recordset);
        fs.writeFileSync(path.join(outDir, `${key}.csv`), csv, 'utf8');
      }
    } catch (err) {
      console.error(`  ✗ ${key}: ${err.message}`);
    }
  }

  return result;
}

async function extractGstReports(pool) {
  console.log('\n[GST REPORTS] Extracting key GSTR-1 and GSTR-2 views...');

  const periodFilter = `
    AND MONTH(SL_BILL_DT) = ${DATASET.period.month}
    AND YEAR(SL_BILL_DT) = ${DATASET.period.year}
  `;

  const queries = {
    gstr1Summary: `
      SELECT TOP 500 *
      FROM JSM_VW_GST_SALES_SUMMARY_REPORT
      WHERE CO_PATH = '${DATASET.coPath}' ${periodFilter}
    `,
    gstr2Summary: `
      SELECT TOP 500 *
      FROM JSM_VW_GST_PURCHASE_SUMMARY_REPORT
      WHERE CO_PATH = '${DATASET.coPath}' ${periodFilter}
    `,
    ewayBill: `
      SELECT TOP 500 *
      FROM JSM_VW_ALL_EWB_EINV_REPORT_MAIN
      WHERE CO_PATH = '${DATASET.coPath}' ${periodFilter}
    `
  };

  const result = {};
  for (const [key, query] of Object.entries(queries)) {
    try {
      const records = await pool.request().query(query);
      result[key] = records.recordset;
      console.log(`  ✓ ${key}: ${records.recordset.length} records`);

      if (records.recordset.length > 0) {
        const csv = toCsv(records.recordset);
        fs.writeFileSync(path.join(outDir, `${key}.csv`), csv, 'utf8');
      }
    } catch (err) {
      console.error(`  ✗ ${key}: ${err.message}`);
    }
  }

  return result;
}

function toCsv(records) {
  if (!records || records.length === 0) return '';
  const headers = Object.keys(records[0]);
  const csv = [headers.join(',')];
  for (const row of records) {
    const values = headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      const str = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(str) ? `"${str}"` : str;
    });
    csv.push(values.join(','));
  }
  return csv.join('\n');
}

async function main() {
  console.log('====== JSM GOLDEN MASTER EXTRACTION ======');
  console.log(`Company: ${DATASET.company}`);
  console.log(`Period: ${DATASET.period.month}/${DATASET.period.year}`);
  console.log(`Output: ${outDir}`);

  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    console.log('✓ Connected to SQL Server');

    const masters = await extractMasters(pool);
    const transactions = await extractTransactions(pool);
    const gst = await extractGstReports(pool);

    // Summary manifest
    const manifest = {
      extractedAt: new Date().toISOString(),
      company: DATASET.company,
      period: DATASET.period,
      master: {
        itemCount: masters.items?.length || 0,
        partyCount: masters.parties?.length || 0,
        accountCount: masters.accounts?.length || 0
      },
      transaction: {
        salesInvoices: transactions.sales?.length || 0,
        salesLines: transactions.salesDetail?.length || 0,
        purchaseInvoices: transactions.purchase?.length || 0,
        purchaseLines: transactions.purchaseDetail?.length || 0,
        vouchers: transactions.vouchers?.length || 0
      },
      gst: {
        gstr1Records: gst.gstr1Summary?.length || 0,
        gstr2Records: gst.gstr2Summary?.length || 0,
        ewayBills: gst.ewayBill?.length || 0
      }
    };

    fs.writeFileSync(
      path.join(outDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    console.log('\n✓ Extraction complete');
    console.log('Manifest:', JSON.stringify(manifest, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

main();
