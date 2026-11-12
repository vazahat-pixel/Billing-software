'use strict';

/**
 * JSM:
 *  - Reports › Process Reports › Cutting Reports (Rpt_Cutting_Report)
 *  - Reports › Process Reports › Cutting Stock Reports (Rpt_Stk_Cutting_At_Shop)
 *
 * Joins finished InventoryLots (and their source mill Jobs when present) with CuttingEntry records
 * to show received qty, cut/used qty (cutQty + wastageQty), and remaining balance at shop.
 * Note: JSM's Crystal Cry_Cutting_Clear breaks output into Fresh/Second/Other/Fent (i_cut_detail
 * sr_no 1..4); MERN CuttingEntry records total cutPieces, cutQty, wastageQty without quality
 * grading, so totals are reported without fabricating grade splits.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

async function loadCuttingStockRows(companyId) {
  const CuttingEntry = require('../../../models/CuttingEntry');
  const InventoryLot = require('../../../models/InventoryLot');
  const Job = require('../../../models/Job');
  require('../../../models/Party');
  require('../../../models/Item');

  const [entries, lots] = await Promise.all([
    CuttingEntry.find({ companyId }).populate('itemId', 'name').lean(),
    InventoryLot.find({ companyId }).populate('itemId', 'name').populate('sourceJobId', 'workerId billGpNo receiveDate issueDate challanNo').lean(),
  ]);

  // Resolve workerId -> mill name for lots created from Job receipts
  const workerIds = [...new Set(lots.map((l) => l.sourceJobId?.workerId).filter(Boolean).map(String))];
  const Party = require('../../../models/Party');
  const mills = workerIds.length
    ? new Map((await Party.find({ _id: { $in: workerIds } }).select('name').lean()).map((p) => [String(p._id), p.name]))
    : new Map();

  const cutByLot = new Map();
  for (const e of entries) {
    const key = String(e.lotId);
    const cur = cutByLot.get(key) || { pcs: 0, qty: 0, wastage: 0, lastDate: null };
    cur.pcs += Number(e.cutPieces || 0);
    cur.qty = round(cur.qty + Number(e.cutQty || 0));
    cur.wastage = round(cur.wastage + Number(e.wastageQty || 0));
    if (!cur.lastDate || new Date(e.date) > new Date(cur.lastDate)) cur.lastDate = e.date;
    cutByLot.set(key, cur);
  }

  const stockRows = lots
    .filter((l) => l.source === 'job_receive' || l.source === 'jobwork' || cutByLot.has(String(l._id)))
    .map((l) => {
      const cut = cutByLot.get(String(l._id)) || { pcs: 0, qty: 0, wastage: 0 };
      const recQty = round(l.totalMtrs || 0);
      const usedQty = round(cut.qty + cut.wastage);
      const balQty = round(Math.max(0, recQty - usedQty));
      const millName = mills.get(String(l.sourceJobId?.workerId || '')) || '';
      return {
        ENT_NO: String(l._id),
        BILL_DATE: l.sourceJobId?.receiveDate || l.createdAt,
        AC_NAME: millName,
        MILL_NAME: millName,
        LOTNO: l.lotId || '',
        ITEM_NAME: l.itemId?.name || '',
        NCBILL_NO: l.sourceJobId?.billGpNo || l.sourceJobId?.challanNo || '',
        GP_PCS: Number(l.totalPcs || 0),
        REC_QTY: recQty,
        TO_PCS: cut.pcs,
        TO_QTY: usedQty,
        USED_QTY: usedQty,
        BAL_QTY: balQty,
        CUT_PEND: balQty > 0.004 ? 'P' : 'C',
      };
    });

  const entryRows = entries.map((e) => ({
    ENT_NO: String(e._id),
    SRAL_NO: e.entryNo || '',
    ENT_DATE: e.date,
    LOT_NO: e.lotCode || '',
    ITEM_NAME: e.itemId?.name || '',
    ORIG_QTY: round(e.originalQty || 0),
    CUT_PCS: Number(e.cutPieces || 0),
    CUT_QTY: round(e.cutQty || 0),
    WASTAGE_QTY: round(e.wastageQty || 0),
    USED_QTY: round(Number(e.cutQty || 0) + Number(e.wastageQty || 0)),
    REMARK: e.remark || '',
  }));

  return { stockRows, entryRows };
}

const cuttingReport = {
  async run(companyId, p = {}, deps = {}) {
    const data = deps.data || await loadCuttingStockRows(companyId);
    const status = String(p.status || '1-Pending');
    const millGroup = String(p.groupBy || '1-Normal').startsWith('2');

    if (status.startsWith('1')) {
      let rows = inDateRange(data.stockRows, 'BILL_DATE', p.from, p.to);
      rows = inList(rows, 'AC_NAME', p.mills);
      rows = rows.filter((r) => r.CUT_PEND === 'P' && r.BAL_QTY > 0.004);
      return {
        rows: orderRows(rows, [...(millGroup ? ['AC_NAME'] : []), 'BILL_DATE', 'LOTNO']),
        grid: {
          layout: 'JSM_VW_CUTTING_PENDING',
          variant: 1,
          groupColumns: millGroup ? ['AC_NAME'] : [],
          groupDisplays: millGroup ? ['MILL'] : [],
          captions: {},
          title: 'Cutting Pending Report',
          period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
          pageWise: false,
        },
      };
    }

    // Clear (status 2) or All (status 3): show cutting entries
    let rows = inDateRange(data.entryRows, 'ENT_DATE', p.from, p.to);
    return {
      rows: orderRows(rows, ['ENT_DATE', 'SRAL_NO', 'LOT_NO']),
      grid: {
        layout: 'JSM_VW_CUTTING_CLEAR',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: status.startsWith('2') ? 'Cutting Clear Report' : 'Cutting Report (All)',
        period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  },
  async options(companyId) {
    const { stockRows } = await loadCuttingStockRows(companyId);
    const mills = [...new Set(stockRows.map((r) => r.AC_NAME).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return { mills };
  },
};

const cuttingStockReport = {
  async run(companyId, p = {}, deps = {}) {
    const data = deps.data || await loadCuttingStockRows(companyId);
    let rows = inDateRange(data.stockRows, 'BILL_DATE', p.from, p.to);
    rows = inList(rows, 'AC_NAME', p.mills);
    if (p.lotFrom || p.lotTo) {
      const lf = String(p.lotFrom || '').trim();
      const lt = String(p.lotTo || '').trim();
      rows = rows.filter((r) => (!lf || String(r.LOTNO) >= lf) && (!lt || String(r.LOTNO) <= lt));
    }
    const status = String(p.status || '1-Pending');
    if (status.startsWith('1')) rows = rows.filter((r) => r.CUT_PEND === 'P');
    else if (status.startsWith('2')) rows = rows.filter((r) => r.CUT_PEND === 'C');

    const millGroup = String(p.groupBy || '1-Normal').startsWith('2');
    const sortBy = p.orderBy === 'Lot' ? 'LOTNO' : 'BILL_DATE';
    return {
      rows: orderRows(rows, [...(millGroup ? ['AC_NAME'] : []), sortBy, 'NCBILL_NO']),
      grid: {
        layout: 'JSM_VW_CUTTING_STK',
        variant: 1,
        groupColumns: millGroup ? ['AC_NAME'] : [],
        groupDisplays: millGroup ? ['MILL'] : [],
        captions: {},
        title: millGroup ? 'Mill Wise Cutting Stock Detail' : 'Cutting Stock Detail',
        period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  },
  async options(companyId) {
    return cuttingReport.options(companyId);
  },
};

module.exports = { cuttingReport, cuttingStockReport };

