'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const reports = require('../../services/jsmReports');

describe('JSM Batch 1 reports (Order Status, Slip Register, Lot Costing, Cutting)', () => {
  it('Sales & Purchase Order Register filter status and compute balance', async () => {
    const sample = [
      { ENT_NO: '1', SR_NO: 1, BOOK: 'SALES ORDER', ORD_NO: '101', ORD_DATE: '2026-04-05', PARTY: 'A', BROKER: 'B', DELIVERY: '', STATION: 'SURAT', STATE_NAME: 'Gujarat', ITEM: 'GREY', ORD_PCS: 10, DONE_PCS: 4, BAL_PCS: 6, ORD_QTY: 1000, DONE_QTY: 400, BAL_QTY: 600, RATE: 50, AMOUNT: 50000, REMARK_1: '', BILLNO: '', BILLDT: null, STOCK_CP: 'P' },
      { ENT_NO: '2', SR_NO: 1, BOOK: 'SALES ORDER', ORD_NO: '102', ORD_DATE: '2026-04-06', PARTY: 'A', BROKER: 'B', DELIVERY: '', STATION: 'SURAT', STATE_NAME: 'Gujarat', ITEM: 'GREY', ORD_PCS: 5, DONE_PCS: 5, BAL_PCS: 0, ORD_QTY: 500, DONE_QTY: 500, BAL_QTY: 0, RATE: 50, AMOUNT: 25000, REMARK_1: '', BILLNO: '', BILLDT: null, STOCK_CP: 'C' },
    ];
    const slPending = await reports.get('Rpt_Sales_Order_Detail_Report').run('co', { status: '1-Pending', orderBy1: 'Party' }, { rows: sample });
    assert.equal(slPending.rows.length, 1);
    assert.equal(slPending.rows[0].ORD_NO, '101');
    assert.equal(slPending.rows[0].SL_QTY, 400);
    assert.equal(slPending.grid.layout, 'JSM_VW_SALES_ORDER_DETAILED_REPORT');

    const puAll = await reports.get('Rpt_Purchase_Order_Detail_Rpt').run('co', { status: '3-All' }, { rows: sample });
    assert.equal(puAll.rows.length, 2);
    assert.equal(puAll.rows[1].REC_PCS, 5);
    assert.equal(puAll.grid.layout, 'JSM_VW_PURCHASE_ORDER_STATUS_REPORT');
  });

  it('Slip Register & Slip (New) Register filter pending/clear and summarize', async () => {
    const sample = [
      { ENT_NO: '1', BOOK: 'SALES CHALLAN', REGISTER: 'SALES CHALLAN', NCCHLN_NO: '11', CHLN_NO: 11, BILL_DATE: '2026-04-10', YEAR_NO: 2026, MONTH_NO: 4, MONTH: 'April', PARTY: 'P1', TRNS_NAME: 'T1', ITEM: 'IT1', IT_DISC1: '', IT_PCS: 10, IT_QTY: 100, IT_RATE: 80, IT_AMOUNT: 8000, SL_PCS: 10, SL_QTY: 100, BAL_QTY: 0, SL_BILLNO: 'S-1', STOCK_CP: 'C', REMARK_1: '' },
      { ENT_NO: '2', BOOK: 'SALES CHALLAN', REGISTER: 'SALES CHALLAN', NCCHLN_NO: '12', CHLN_NO: 12, BILL_DATE: '2026-04-12', YEAR_NO: 2026, MONTH_NO: 4, MONTH: 'April', PARTY: 'P1', TRNS_NAME: 'T1', ITEM: 'IT2', IT_DISC1: '', IT_PCS: 5, IT_QTY: 50, IT_RATE: 90, IT_AMOUNT: 4500, SL_PCS: 0, SL_QTY: 0, BAL_QTY: 50, SL_BILLNO: '', STOCK_CP: 'P', REMARK_1: '' },
    ];
    const slip = await reports.get('Rpt_Sales_Slip_Register').run('co', { status: '1-Pending', reportType: '2-Party' }, { rows: sample });
    assert.equal(slip.rows.length, 1);
    assert.equal(slip.rows[0].NCCHLN_NO, '12');

    const slipSum = await reports.get('Rpt_SalesSlipDetail_Report').run('co', { summary: true, orderBy1: 'Party', status: 'All' }, { rows: sample });
    assert.equal(slipSum.rows.length, 1);
    assert.equal(slipSum.rows[0].TOT_QTY, 150);
    assert.equal(slipSum.rows[0].BAL_QTY, 50);
    assert.equal(slipSum.grid.layout, 'RPT_SALES_SLIP_SUMMARY_REPORT');
  });

  it('Lot Wise Costing applies avgExpRate and selects Kgs vs Mts layout', async () => {
    const sample = [
      { ENT_NO: '1', NCCHLN_NO: '5', CHLN_DATE: '2026-04-01', MILL_NAME: 'M1', LOT_NO: 'L10', ITEM_NAME: 'G', FINISH_ITEM: 'F', PU_NAME: 'W1', NCBILL_NO: 'B1', REC_DATE: '2026-04-15', REC_SRALNO: '1', GREY_MTS: 100, PU_RATE: 40, PUR_AMT: 4000, FINISH_MTS: 95, IT_RATE: 10, PROCESS_AMT: 950, TOTAL_AMT: 4950, GREY_KGS: 10, FINISH_KGS: 9.5, PUR_KGS_AMT: 400, EFF_RATE: 52.11 },
    ];
    const mts = await reports.get('Rpt_Lot_Costing').run('co', { avgExpRate: 2 }, { rows: sample });
    assert.equal(mts.grid.layout, 'JSM_VW_LOT_COSTING');
    assert.equal(mts.rows[0].PROCESS_AMT, 1140);
    assert.equal(mts.rows[0].TOTAL_AMT, 5140);

    const kgs = await reports.get('Rpt_Lot_Costing').run('co', { kgs: true }, { rows: sample });
    assert.equal(kgs.grid.layout, 'JSM_VW_LOT_COSTING_KGS');
  });

  it('Cutting Report and Cutting Stock Report filter by status and lot range', async () => {
    const data = {
      stockRows: [
        { ENT_NO: '1', BILL_DATE: '2026-04-02', AC_NAME: 'MILL A', MILL_NAME: 'MILL A', LOTNO: '100', ITEM_NAME: 'FIN', NCBILL_NO: 'B1', GP_PCS: 10, REC_QTY: 500, TO_PCS: 4, TO_QTY: 200, USED_QTY: 200, BAL_QTY: 300, CUT_PEND: 'P' },
        { ENT_NO: '2', BILL_DATE: '2026-04-03', AC_NAME: 'MILL B', MILL_NAME: 'MILL B', LOTNO: '200', ITEM_NAME: 'FIN', NCBILL_NO: 'B2', GP_PCS: 5, REC_QTY: 250, TO_PCS: 5, TO_QTY: 250, USED_QTY: 250, BAL_QTY: 0, CUT_PEND: 'C' },
      ],
      entryRows: [
        { ENT_NO: 'e1', SRAL_NO: 'CUT-1', ENT_DATE: '2026-04-05', LOT_NO: '100', ITEM_NAME: 'FIN', ORIG_QTY: 500, CUT_PCS: 4, CUT_QTY: 195, WASTAGE_QTY: 5, USED_QTY: 200, REMARK: '' },
      ],
    };
    const pend = await reports.get('Rpt_Cutting_Report').run('co', { status: '1-Pending' }, { data });
    assert.equal(pend.rows.length, 1);
    assert.equal(pend.rows[0].BAL_QTY, 300);

    const clr = await reports.get('Rpt_Cutting_Report').run('co', { status: '2-Clear' }, { data });
    assert.equal(clr.rows[0].SRAL_NO, 'CUT-1');

    const stk = await reports.get('Rpt_Stk_Cutting_At_Shop').run('co', { status: '3-All', lotFrom: '150', lotTo: '250' }, { data });
    assert.equal(stk.rows.length, 1);
    assert.equal(stk.rows[0].LOTNO, '200');
  });
});
