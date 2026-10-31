'use strict';

/**
 * MERN job work challans as rows of JSM's JSM_VW_JOBWORK_STOCK_REPORT.
 *
 * The balance arithmetic is the same as Process Stock (issued minus everything received up to the
 * "Upto Rec Date", one row per receipt line), so this reuses that loader with kind='Job' and only
 * renames the columns to the ones this JSM view exposes:
 *   PARTY and ITEM instead of MILL_NAME and ITEM_NAME, BAL_ instead of TOT_BAL_, the REC, PLAIN and
 *   SHORT columns instead of the R_ ones, BILLNO and BILLDT instead of NCBILL_NO and BILL_DATE.
 *
 * MERN keeps no separate "consumed" or short-pieces figure per receipt, so CONS_PCS, CONS_QTY,
 * PLAIN_PCS and SHORT_PCS are 0 rather than invented.
 */
const { loadProcessStockRows } = require('./processStock');

async function loadJobworkStockRows(companyId, { recTo = '' } = {}) {
  const rows = await loadProcessStockRows(companyId, { kind: 'Job', recTo });

  return rows.map((r) => ({
    // challan identity
    CO_PATH: r.CO_PATH,
    CO_SHORT: r.CO_SHORT,
    ENT_NO: r.ENT_NO,
    CO_ENT_NO: r.CO_ENT_NO,
    NCCHLN_NO: r.NCCHLN_NO,
    CHLN_NO: r.CHLN_NO,
    CHLN_DATE: r.CHLN_DATE,

    // grouping columns
    PARTY: r.MILL_NAME,
    BROKER: r.BROKER,
    ITEM: r.ITEM_NAME,
    REGISTER: r.REGISTER,
    BOOK: r.BOOK,
    RANGE: r.RANGE || '',

    // issued
    ISS_PCS: r.ISS_PCS,
    ISS_QTY: r.ISS_QTY,

    // this receipt line
    BILLNO: r.NCBILL_NO,
    BILLDT: r.BILL_DATE,
    SRAL_NO: r.SRAL_NO,
    REC_PCS: r.R_REC_PCS,
    REC_QTY: r.R_GRY_REC_QTY,
    PLAIN_QTY: r.R_FNS_REC_QTY,
    SHORT_QTY: r.R_SHORT_QTY,
    PLAIN_PCS: 0,
    CONS_PCS: 0,
    CONS_QTY: 0,
    SHORT_PCS: 0,

    // challan balance (repeated on each of its rows, counted once per challan by the grid)
    BAL_PCS: r.TOT_BAL_PCS,
    BAL_QTY: r.TOT_BAL_QTY,
    BAL_AMT: r.TOT_BAL_AMT,

    JOB_RATE: r.JOB_RATE || 0,
    REMARK_1: r.REMARK_1,
    REMARK_2: r.REMARK_2,
    PENDING: r.PENDING,
  }));
}

module.exports = { loadJobworkStockRows };
