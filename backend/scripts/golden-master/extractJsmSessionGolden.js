'use strict';

/**
 * Read-only golden extractor for session + Batch 1-3 JSM reports against Sanchal Creation (SC27)
 * in JsmSql2_DEMO2026 (.\JSMR2).
 *
 * Usage:
 *   node scripts/golden-master/extractJsmSessionGolden.js --db JsmSql2_DEMO2026 --co SC27
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSql2_DEMO2026');
const CO = arg('co', 'SC27');
const AS_ON = arg('asOn', '2026-11-12');
const OUT = arg('out', path.join(__dirname, '../../tests/golden/fixtures', `jsm_${CO.toLowerCase()}_session_reports.json`));
const SEP = '\u0001';
if (!/^[A-Za-z0-9_]+$/.test(CO)) throw new Error('--co must be alphanumeric');

const SQLCMD = [
  'C:\\Program Files (x86)\\Microsoft SQL Server\\100\\Tools\\Binn\\sqlcmd.exe',
  'sqlcmd',
].find((p) => p === 'sqlcmd' || fs.existsSync(p));
if (!SQLCMD) throw new Error('sqlcmd not found');

function query(sql, cols, label = 'q') {
  const t0 = Date.now();
  const out = execFileSync(SQLCMD, ['-S', SERVER, '-E', '-l', '60', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q', `SET NOCOUNT ON; ${sql}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (/^Msg \d+/m.test(out) || /^Sqlcmd: Error/m.test(out)) throw new Error(out);
  const rows = out.split(/\r?\n/).filter((l) => l.includes(SEP)).map((line) => {
    const c = line.split(SEP);
    return Object.fromEntries(cols.map((k, i) => [k, (c[i] ?? '').trim()]));
  });
  console.log(`[${label}] ${rows.length} rows (${Date.now() - t0}ms)`);
  return rows;
}

function numRows(rows, numericCols) {
  return rows.map((r) => {
    const o = { ...r };
    for (const k of numericCols) o[k] = Number(o[k] || 0);
    return o;
  });
}

const d = (col) => `CASE WHEN ${col} IS NULL THEN '' ELSE CONVERT(varchar(10), ${col}, 120) END`;
const s = (col) => `ISNULL(CONVERT(varchar(200), ${col}), '')`;

// 1. Outstanding (Sales + Purchase) for Month O/s, Sms Days, 90 Days, OutStanding Zoom, Os New Format, Age Analysis
const osSalesCols = ['PARTY', 'BROKER', 'STATION', 'BOOK', 'MAINGROUP', 'BILL_DATE', 'NCBILL_NO', 'NET_TOT', 'ADJUST', 'GOODS_RTN', 'TOT_DISC', 'TOT_BALANCE', 'OS_DAYS', 'PAID_DATE', 'Q_TYPE', '_billId'];
const osSalesRaw = numRows(query(`
  SELECT ${s('PARTY')}, ${s('BROKER')}, ${s('STATION')}, ${s('BOOK')}, ${s('PARTY_MN_GROUP')},
         ${d('BILL_DATE')}, ${s('NCBILL_NO')}, NET_TOT, ADJUST, SLR_AMT, TOT_DISC, TOT_BALANCE,
         DATEDIFF(day, BILL_DATE, '${AS_ON}') AS OS_DAYS,
         ${d('REC_DATE')}, ${s('Q_TYPE')}, ${s('CO_ENT_NO')}
  FROM JSM_VW_OS_SALES_SUMMARY
  WHERE CO_PATH='${CO}'
`, osSalesCols), ['NET_TOT', 'ADJUST', 'GOODS_RTN', 'TOT_DISC', 'TOT_BALANCE', 'OS_DAYS']);

const osSalesExpectedByParty = numRows(query(`
  SELECT ${s('PARTY')},
         SUM(TOT_BALANCE) AS TOT_BALANCE,
         SUM(NET_TOT) AS BILL_AMT,
         SUM(ADJUST) AS PAID_AMT,
         SUM(CASE WHEN DATEDIFF(day, BILL_DATE, '${AS_ON}') <= 90 THEN TOT_BALANCE ELSE 0 END) AS BEFORE_90,
         SUM(CASE WHEN DATEDIFF(day, BILL_DATE, '${AS_ON}') > 90 THEN TOT_BALANCE ELSE 0 END) AS AFTER_90
  FROM JSM_VW_OS_SALES_SUMMARY
  WHERE CO_PATH='${CO}'
  GROUP BY PARTY
  ORDER BY PARTY
`, ['PARTY', 'TOT_BALANCE', 'BILL_AMT', 'PAID_AMT', 'BEFORE_90', 'AFTER_90']), ['TOT_BALANCE', 'BILL_AMT', 'PAID_AMT', 'BEFORE_90', 'AFTER_90']);

const osPurCols = ['PARTY', 'BROKER', 'STATION', 'BOOK', 'MAINGROUP', 'BILL_DATE', 'NCBILL_NO', 'NET_TOT', 'ADJUST', 'TOT_DISC', 'TOT_BALANCE', 'OS_DAYS', 'PAID_DATE', 'Q_TYPE', '_billId'];
const osPurRaw = numRows(query(`
  SELECT ${s('PARTY')}, ${s('BROKER')}, ${s('STATION')}, ${s('BOOK')}, ${s('PARTY_MN_GROUP')},
         ${d('BILL_DATE')}, ${s('NCBILL_NO')}, NET_TOT, ADJUST, TOT_DISC, TOT_BALANCE,
         DATEDIFF(day, BILL_DATE, '${AS_ON}') AS OS_DAYS,
         ${d('PAY_DATE')}, ${s('Q_TYPE')}, ${s('CO_ENT_NO')}
  FROM JSM_VW_OS_PURCHASE_SUMMARY
  WHERE CO_PATH='${CO}'
`, osPurCols), ['NET_TOT', 'ADJUST', 'TOT_DISC', 'TOT_BALANCE', 'OS_DAYS']);

// 2. Cash/Bank Register (JSM_VW_CASHBANK) & Cheq In Hand (JSM_VW_CHEQ_IN_HAND)
const cbCols = ['ENT_NO', 'SRAL_NO', 'REC_DATE', 'BOOK', 'BANK', 'PARTY', 'BROKER', 'HEADWISE', 'HEAD2', 'STATION', 'MONTH', 'YEAR_NO', 'MONTH_NO', 'REC_PAY', 'CHQ_NO', 'CHQ_RETURN', 'REC_AMT', 'AMT_1', 'AMT_2', 'AMT_3', 'AMT_4', 'AMT_5', 'AMT_6', 'AMT_7', 'AMT_BC'];
const cbRaw = numRows(query(`
  SELECT ${s('ENT_NO')}, ${s('SRAL_NO')}, ${d('REC_DATE')}, ${s('BOOK')}, ${s('BANK')}, ${s('PARTY')}, ${s('BROKER')},
         ${s('HEADWISE')}, ${s('HEAD2')}, ${s('STATION')}, ${s('MONTH')}, YEAR_NO, MONTH_NO,
         ${s('REC_PAY')}, ${s('CHQ_NO')}, CHQ_RETURN, REC_AMT, AMT_1, AMT_2, AMT_3, AMT_4, AMT_5, AMT_6, AMT_7, AMT_BC
  FROM JSM_VW_CASHBANK
  WHERE CO_PATH='${CO}'
`, cbCols), ['YEAR_NO', 'MONTH_NO', 'CHQ_RETURN', 'REC_AMT', 'AMT_1', 'AMT_2', 'AMT_3', 'AMT_4', 'AMT_5', 'AMT_6', 'AMT_7', 'AMT_BC']);

const cbExpectedBank = numRows(query(`
  SELECT ${s('BANK')} AS BANK, SUM(REC_AMT) AS REC_AMT
  FROM JSM_VW_CASHBANK
  WHERE CO_PATH='${CO}'
  GROUP BY BANK
  ORDER BY BANK
`, ['BANK', 'REC_AMT']), ['REC_AMT']);

const chqRaw = numRows(query(`
  SELECT ${d('REC_DATE')}, ${s('SRAL_NO')}, ${s('CHQ_NO')}, ${d('CHQ_DATE')}, REC_AMT, ${s('PBANK')}, ${s('BOOK')}, ${s('AC_NAME')}, ${s('PAY_CHQNO')}, ${d('PAY_DATE')}, PAY_AMT
  FROM JSM_VW_CHEQ_IN_HAND
  WHERE CO_PATH='${CO}'
`, ['REC_DATE', 'SRAL_NO', 'CHQ_NO', 'CHQ_DATE', 'REC_AMT', 'PBANK', 'BOOK', 'AC_NAME', 'PAY_CHQNO', 'PAY_DATE', 'PAY_AMT']), ['REC_AMT', 'PAY_AMT']);

// 3. Master List (JSM_VW_MASTER_ACCOUNT_REPORT)
const mstCols = ['AC_NAME', 'ADDRESS', 'CITY', 'STATE', 'PINCODE', 'MOBILE', 'EMAIL', 'GSTIN_NO', 'GROUP'];
const mstRaw = query(`
  SELECT ${s('ACCOUNT')}, ${s('ADDRESS')}, ${s('STATION')}, ${s('STATE')}, ${s('PINCODE')}, ${s('PHONENO')}, ${s('EMAIL')}, ${s('GSTIN_NO')}, ${s('ACCOUNTHEAD')}
  FROM JSM_VW_MASTER_ACCOUNT_REPORT
  WHERE CO_PATH='${CO}'
  ORDER BY ACCOUNT
`, mstCols);

// 4. Purchase Stock Detail (JSM_VW_STOCK_PURCHASE_DETAIL) & Sales Challan (JSM_VW_SALES_CHALLAN_DTL) & Sales Order (JSM_VW_SALES_ORDER_STATUS) & Rg Pending (JSM_VW_JOBWORK_STOCK)
const purStkRaw = numRows(query(`
  SELECT ${s('NCBILL_NO')}, ${d('BILL_DATE')}, ${s('SRAL_NO')}, ${s('NCCHLN_NO')}, ${d('CHLN_DATE')}, ${s('P_NAME')}, ${s('ITEM_NAME')},
         IT_PCS, IT_QTY, I_PCS, I_QTY, B_PCS, B_QTY
  FROM JSM_VW_STOCK_PURCHASE_DETAIL
  WHERE CO_PATH='${CO}'
`, ['NCBILL_NO', 'BILL_DATE', 'SRAL_NO', 'NCCHLN_NO', 'CHLN_DATE', 'PARTY', 'ITEM', 'PU_PCS', 'PU_MTS', 'ISS_PCS', 'ISS_MTS', 'B_PCS', 'BAL_QTY']),
['PU_PCS', 'PU_MTS', 'ISS_PCS', 'ISS_MTS', 'B_PCS', 'BAL_QTY']);

const purStkExpected = numRows(query(`
  SELECT ${s('ITEM_NAME')} AS ITEM, SUM(IT_PCS) AS PU_PCS, SUM(IT_QTY) AS PU_MTS, SUM(B_QTY) AS BAL_QTY
  FROM JSM_VW_STOCK_PURCHASE_DETAIL
  WHERE CO_PATH='${CO}'
  GROUP BY ITEM_NAME
  ORDER BY ITEM_NAME
`, ['ITEM', 'PU_PCS', 'PU_MTS', 'BAL_QTY']), ['PU_PCS', 'PU_MTS', 'BAL_QTY']);

const salesChlnRaw = numRows(query(`
  SELECT ${s('ENT_NO')}, ${s('NCBILL_NO')}, ${d('BILL_DATE')}, ${s('NCCHLN_NO')}, ${d('CHLN_DATE')},
         ${s('BOOK')}, ${s('PARTY')}, ${s('BROKER')}, ${s('ITEM')}, IT_PCS, IT_QTY, IT_RATE, IT_AMOUNT, NET_TOT
  FROM JSM_VW_SALES_CHALLAN_DTL
  WHERE CO_PATH='${CO}'
`, ['ENT_NO', 'NCBILL_NO', 'BILL_DATE', 'NCCHLN_NO', 'CHLN_DATE', 'BOOK', 'PARTY', 'BROKER', 'ITEM', 'IT_PCS', 'IT_QTY', 'IT_RATE', 'IT_AMOUNT', 'NET_TOT']),
['IT_PCS', 'IT_QTY', 'IT_RATE', 'IT_AMOUNT', 'NET_TOT']);

const salesOrdRaw = numRows(query(`
  SELECT ${s('ORD_NO')}, ${d('ORD_DATE')}, ${s('BOOK')}, ${s('PARTY')}, ${s('BROKER')}, ${s('ITEM')},
         ORD_PCS, ORD_QTY, SL_PCS, SL_QTY, BAL_PCS, BAL_QTY, ${s('OPEN_CLOSE')}
  FROM JSM_VW_SALES_ORDER_STATUS
  WHERE CO_PATH='${CO}'
`, ['ORD_NO', 'ORD_DATE', 'BOOK', 'PARTY', 'BROKER', 'ITEM', 'ORD_PCS', 'ORD_QTY', 'DONE_PCS', 'DONE_QTY', 'BAL_PCS', 'BAL_QTY', 'OPEN_CLOSE']),
['ORD_PCS', 'ORD_QTY', 'DONE_PCS', 'DONE_QTY', 'BAL_PCS', 'BAL_QTY']);

const finishStkRaw = numRows(query(`
  SELECT ${s('ITEM_NAME')}, ${s('AC_NAME')}, ${s('GRIT_NAME')}, ${s('BK_TYPE')}, ${s('NCBILLNO')}, ${d('BILLDATE')},
         OP_PCS, OP_QTY, FNS_PU_PCS, FNS_PU_QTY, FNS_SL_PCS, FNS_SL_QTY, FNS_SLR_PCS, FNS_SLR_QTY, FNS_PUR_PCS, FNS_PUR_QTY
  FROM JSM_VW_STOCK_DETAIL_FINISH
  WHERE CO_PATH='${CO}'
`, ['ITEMNAME', 'AC_NAME', 'GRIT_NAME', 'BK_TYPE', 'NCBILLNO', 'ENTDATE', 'OP_PCS', 'OP_QTY', 'FNS_PU_PCS', 'FNS_PU_QTY', 'FNS_SL_PCS', 'FNS_SL_QTY', 'FNS_SLR_PCS', 'FNS_SLR_QTY', 'FNS_PUR_PCS', 'FNS_PUR_QTY']),
['OP_PCS', 'OP_QTY', 'FNS_PU_PCS', 'FNS_PU_QTY', 'FNS_SL_PCS', 'FNS_SL_QTY', 'FNS_SLR_PCS', 'FNS_SLR_QTY', 'FNS_PUR_PCS', 'FNS_PUR_QTY']);

// 5. GST Sales & Purchase Item-level / Header-level (direct T_SALES/T_SL_ITEM + T_PURCHASE — fast!)
const gstSalesLines = numRows(query(`
  SELECT ${s('A.ENT_NO')}, ${s('A.NCBILL_NO')}, ${d('A.BILL_DATE')}, ${s('BK.AC_NAME')} AS BOOK, ${s('BK.AC_NAME')} AS REGISTER,
         ${s('P.AC_NAME')} AS PARTY, ${s('P.GST_NO')}, ${s('P.STATE_NAME')}, ${s('P.STATE_CODE')}, ${s('P.ST_NAME')} AS STATION,
         'Regular' AS TYPE, MONTH(A.BILL_DATE) AS MONTH_NO, YEAR(A.BILL_DATE) AS YEAR_NO, DATENAME(month, A.BILL_DATE) AS MONTH,
         ${s('I.ITEM_NAME')}, ${s('B.HSN_CODE')}, ${s('U.UNIT_NAME')}, B.IT_PCS, B.IT_QTY, B.IT_RATE, B.IT_TAXABLE,
         B.TOT_GST_P, B.SGST_P, B.SGST_A, B.CGST_P, B.CGST_A, B.IGST_P, B.IGST_A, B.TOT_GST_A, B.IT_FINAL,
         A.TAXABLE_AMT, A.SGST_AMT, A.CGST_AMT, A.IGST_AMT, A.NET_TOT
  FROM T_SALES A
  INNER JOIN T_SL_ITEM B ON A.CO_PATH=B.CO_PATH AND A.ENT_NO=B.ENT_NO
  INNER JOIN VW_MST_AC_MAST P ON A.CO_PATH=P.CO_PATH AND A.AC_CODE=P.AC_CODE
  INNER JOIN MST_AC_MAST BK ON A.CO_PATH=BK.CO_PATH AND A.TR_CODE=BK.AC_CODE
  LEFT JOIN MST_IT_MAST I ON A.CO_PATH=I.CO_PATH AND B.ITEM_CODE=I.ITEM_CODE
  LEFT JOIN MST_UNIT U ON A.CO_PATH=U.CO_PATH AND I.UNIT_CODE=U.UNIT_CODE
  WHERE A.CO_PATH='${CO}'
`, ['ENT_NO', 'NCBILL_NO', 'BILL_DATE', 'BOOK', 'REGISTER', 'PARTY', 'GSTIN_NO', 'STATE', 'STATE_CODE', 'STATION', 'TYPE',
  'MONTH_NO', 'YEAR_NO', 'MONTH', 'ITEM_NAME', 'HSN_CODE', 'UNIT_NAME', 'IT_PCS', 'IT_QTY', 'IT_RATE', 'IT_TAXABLE',
  'T_GST_PER', 'IT_SGST_P', 'IT_SGST_A', 'IT_CGST_P', 'IT_CGST_A', 'IT_IGST_P', 'IT_IGST_A', 'IT_GST_AMT', 'IT_NET_TOT',
  'BILL_TAXABLE', 'BILL_SGST', 'BILL_CGST', 'BILL_IGST', 'BILL_NET'], 'gstSalesLines'),
['MONTH_NO', 'YEAR_NO', 'IT_PCS', 'IT_QTY', 'IT_RATE', 'IT_TAXABLE', 'T_GST_PER', 'IT_SGST_P', 'IT_SGST_A', 'IT_CGST_P', 'IT_CGST_A', 'IT_IGST_P', 'IT_IGST_A', 'IT_GST_AMT', 'IT_NET_TOT', 'BILL_TAXABLE', 'BILL_SGST', 'BILL_CGST', 'BILL_IGST', 'BILL_NET']);

const gstSalesRateExpected = numRows(query(`
  SELECT B.TOT_GST_P AS TAX_RATE, SUM(B.IT_TAXABLE) AS TAXABLE_AMT, SUM(B.SGST_A) AS SGST_AMT,
         SUM(B.CGST_A) AS CGST_AMT, SUM(B.IGST_A) AS IGST_AMT, SUM(B.IT_FINAL) AS NET_TOT
  FROM T_SALES A
  INNER JOIN T_SL_ITEM B ON A.CO_PATH=B.CO_PATH AND A.ENT_NO=B.ENT_NO
  WHERE A.CO_PATH='${CO}'
  GROUP BY B.TOT_GST_P
  ORDER BY B.TOT_GST_P
`, ['TAX_RATE', 'TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT'], 'gstSalesRates'),
['TAX_RATE', 'TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT']);

const gstPurchaseAll = numRows(query(`
  SELECT 'Regular' AS PU_TYPE, A.CO_PATH, ${s('A.ENT_NO')}, ${d('A.BILL_DATE')}, ${s('A.NCBILL_NO')}, ${s('BK.AC_NAME')} AS BOOK,
         A.TAXABLE_AMT, A.SGST_AMT, A.CGST_AMT, A.IGST_AMT, A.ROUND_OFF, A.CESS_AMT, (A.SGST_AMT+A.CGST_AMT+A.IGST_AMT) AS TOT_GST_AMT,
         A.NET_TOT, ${s('P.AC_NAME')} AS PARTY, ${s('P.GST_NO')}, MONTH(A.BILL_DATE) AS MONTH_NO,
         DATENAME(month, A.BILL_DATE) AS MONTH_NAME, YEAR(A.BILL_DATE) AS YEAR_NO
  FROM T_PURCHASE A
  INNER JOIN VW_MST_AC_MAST P ON A.CO_PATH=P.CO_PATH AND A.AC_CODE=P.AC_CODE
  INNER JOIN MST_AC_MAST BK ON A.CO_PATH=BK.CO_PATH AND A.TR_CODE=BK.AC_CODE
  WHERE A.CO_PATH='${CO}'
`, ['PU_TYPE', 'CO_PATH', 'ENT_NO', 'BILL_DATE', 'NCBILL_NO', 'BOOK', 'TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'ROUND_OFF', 'CESS_AMT', 'TOT_GST_AMT', 'NET_TOT', 'PARTY', 'GSTIN_NO', 'MONTH_NO', 'MONTH_NAME', 'YEAR_NO'], 'gstPurchase'),
['TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'ROUND_OFF', 'CESS_AMT', 'TOT_GST_AMT', 'NET_TOT', 'MONTH_NO', 'YEAR_NO']);

const gstPurchaseRateExpected = numRows(query(`
  SELECT SUM(A.TAXABLE_AMT) AS TAXABLE_AMT, SUM(A.SGST_AMT) AS SGST_AMT,
         SUM(A.CGST_AMT) AS CGST_AMT, SUM(A.IGST_AMT) AS IGST_AMT, SUM(A.NET_TOT) AS NET_TOT
  FROM T_PURCHASE A
  WHERE A.CO_PATH='${CO}'
`, ['TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT'], 'gstPurchaseTotals'),
['TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT']);

// 6. RG Pending (JSM_VW_JOBWORK_STOCK), Taka Detail (JSM_VW_PROCESS_STOCK_TAKADETAIL_WISE), HSN Sales, EWB/EINV, Table Counts
const jwStockRaw = numRows(query(`
  SELECT ${s('NCCHLN_NO')}, ${d('CHLN_DATE')}, ${s('PARTY')}, ${s('BROKER')}, ${s('ITEM')}, ${s('BOOK')},
         ISS_PCS, ISS_QTY, REC_PCS, REC_QTY, BAL_PCS, BAL_QTY, BAL_AMT, OS_DAYS
  FROM JSM_VW_JOBWORK_STOCK
  WHERE CO_PATH='${CO}'
`, ['NCCHLN_NO', 'CHLN_DATE', 'PARTY', 'BROKER', 'ITEM', 'BOOK', 'ISS_PCS', 'ISS_QTY', 'REC_PCS', 'REC_QTY', 'BAL_PCS', 'BAL_QTY', 'BAL_AMT', 'OS_DAYS'], 'jwStock'),
['ISS_PCS', 'ISS_QTY', 'REC_PCS', 'REC_QTY', 'BAL_PCS', 'BAL_QTY', 'BAL_AMT', 'OS_DAYS']);

const takaRaw = numRows(query(`
  SELECT CO_PATH, ${s('ENT_NO')}, ${s('NCCHLN_NO')}, ${d('CHLN_DATE')}, ${s('MILL_NAME')}, ${s('ITEM_NAME')},
         ISS_PCS, ISS_QTY, REC_PCS, REC_QTY, DSR_NO, DISS_QTY, DREC_QTY, DSHORT_QTY,
         ${s('STATUS')}, ${s('LOT_NO')}, ${s('BOOK')}, ${s('PURCHASE_PARTY')}, PU_KGS, ${s('NCBILL_NO')}, ${s('REMARK_1')}, ${s('REMARK_2')}
  FROM JSM_VW_PROCESS_STOCK_TAKADETAIL_WISE
  WHERE CO_PATH='${CO}'
`, ['CO_PATH', 'ENT_NO', 'NCCHLN_NO', 'CHLN_DATE', 'MILL_NAME', 'ITEM_NAME', 'ISS_PCS', 'ISS_QTY', 'REC_PCS', 'REC_QTY', 'DSR_NO', 'DISS_QTY', 'DREC_QTY', 'DSHORT_QTY', 'STATUS', 'LOT_NO', 'BOOK', 'PURCHASE_PARTY', 'PU_KGS', 'NCBILL_NO', 'REMARK_1', 'REMARK_2'], 'takaDetail'),
['ISS_PCS', 'ISS_QTY', 'REC_PCS', 'REC_QTY', 'DSR_NO', 'DISS_QTY', 'DREC_QTY', 'DSHORT_QTY', 'PU_KGS']);

const takaExpected = numRows(query(`
  SELECT COUNT(*) AS CNT, SUM(DISS_QTY) AS DISS_QTY, SUM(DREC_QTY) AS DREC_QTY, SUM(DSHORT_QTY) AS DSHORT_QTY
  FROM JSM_VW_PROCESS_STOCK_TAKADETAIL_WISE
  WHERE CO_PATH='${CO}'
`, ['CNT', 'DISS_QTY', 'DREC_QTY', 'DSHORT_QTY'], 'takaExpected'), ['CNT', 'DISS_QTY', 'DREC_QTY', 'DSHORT_QTY']);

const hsnSalesExpected = numRows(query(`
  SELECT ISNULL(NULLIF(LTRIM(RTRIM(B.HSN_CODE)), ''), 'UNSPECIFIED') AS HSN_CODE,
         SUM(B.IT_PCS) AS IT_PCS, SUM(B.IT_QTY) AS IT_QTY, SUM(B.IT_TAXABLE) AS TAXABLE_AMT,
         SUM(B.SGST_A) AS SGST_AMT, SUM(B.CGST_A) AS CGST_AMT, SUM(B.IGST_A) AS IGST_AMT, SUM(B.IT_FINAL) AS NET_TOT
  FROM T_SALES A
  INNER JOIN T_SL_ITEM B ON A.CO_PATH=B.CO_PATH AND A.ENT_NO=B.ENT_NO
  WHERE A.CO_PATH='${CO}'
  GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(B.HSN_CODE)), ''), 'UNSPECIFIED')
  ORDER BY HSN_CODE
`, ['HSN_CODE', 'IT_PCS', 'IT_QTY', 'TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT'], 'hsnSalesExpected'),
['IT_PCS', 'IT_QTY', 'TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT']);

const ewbExpected = numRows(query(`
  SELECT ${s('ENT_TYPE')} AS ENT_TYPE, COUNT(*) AS CNT, SUM(TAXABLE_AMT) AS TAXABLE_AMT, SUM(BILL_AMT) AS BILL_AMT
  FROM ALL_EWB_EINV_REPORT_MAIN
  WHERE CO_PATH='${CO}'
  GROUP BY ENT_TYPE
  ORDER BY ENT_TYPE
`, ['ENT_TYPE', 'CNT', 'TAXABLE_AMT', 'BILL_AMT'], 'ewbExpected'), ['CNT', 'TAXABLE_AMT', 'BILL_AMT']);

const sc27Counts = Object.fromEntries(numRows(query(`
  SELECT 'T_SALES' AS TBL, COUNT(*) AS CNT FROM T_SALES WHERE CO_PATH='${CO}'
  UNION ALL SELECT 'T_PURCHASE', COUNT(*) FROM T_PURCHASE WHERE CO_PATH='${CO}'
  UNION ALL SELECT 'T_SL_RETU', COUNT(*) FROM T_SL_RETU WHERE CO_PATH='${CO}'
  UNION ALL SELECT 'T_PU_RETU', COUNT(*) FROM T_PU_RETU WHERE CO_PATH='${CO}'
  UNION ALL SELECT 'T_JV_GST', COUNT(*) FROM T_JV_GST WHERE CO_PATH='${CO}'
  UNION ALL SELECT 'T_CASH_COMMI', COUNT(*) FROM T_CASH_MN WHERE CO_PATH='${CO}' AND ISNULL(COMMI_AMT,0)<>0
  UNION ALL SELECT 'T_COMMI_MN', COUNT(*) FROM T_COMMI_MN WHERE CO_PATH='${CO}'
  UNION ALL SELECT 'I_INVESTMENT', COUNT(*) FROM I_INVESTMENT WHERE CO_PATH='${CO}'
`, ['TBL', 'CNT'], 'sc27Counts'), ['CNT']).map((r) => [r.TBL, r.CNT]));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  co: CO,
  db: DB,
  asOn: AS_ON,
  osSalesRaw,
  osSalesExpectedByParty,
  osPurRaw,
  cbRaw,
  cbExpectedBank,
  chqRaw,
  mstRaw,
  purStkRaw,
  purStkExpected,
  salesChlnRaw,
  salesOrdRaw,
  finishStkRaw,
  gstSalesLines,
  gstSalesRateExpected,
  gstPurchaseAll,
  gstPurchaseRateExpected,
  jwStockRaw,
  takaRaw,
  takaExpected: takaExpected[0] || { CNT: 0, DISS_QTY: 0, DREC_QTY: 0, DSHORT_QTY: 0 },
  hsnSalesExpected,
  ewbExpected,
  sc27Counts,
}, null, 2));

console.log('Wrote', OUT);
console.log({
  osSales: osSalesRaw.length,
  osPur: osPurRaw.length,
  cb: cbRaw.length,
  chq: chqRaw.length,
  mst: mstRaw.length,
  purStk: purStkRaw.length,
  salesChln: salesChlnRaw.length,
  salesOrd: salesOrdRaw.length,
  finishStk: finishStkRaw.length,
  gstSalesLines: gstSalesLines.length,
  gstPurchaseAll: gstPurchaseAll.length,
  taka: takaRaw.length,
  hsnSales: hsnSalesExpected.length,
  sc27Counts,
});
