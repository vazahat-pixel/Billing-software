'use strict';

/**
 * JSM: Reports › Process Reports › Lot Wise Costing (Rpt_Lot_Costing).
 *
 * Joins mill issue challans (Job kind='Mill', purchaseRate, grey item, weaver/purParty) with
 * mill receipt lines (finish qty, job rate, process amount) to compute per-lot purchase cost,
 * process cost, and total cost. Supports Date or Lot No ordering, Normal / Mill / Item grouping,
 * and Kgs vs Mts basis. Nothing is guessed or extrapolated beyond stored challan/receipt figures.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const { loadProcessStockRows } = require('../sources/processStock');

async function loadLotCostRows(companyId) {
  const Job = require('../../../models/Job');
  require('../../../models/Party');
  require('../../../models/InventoryLot');
  require('../../../models/Item');
  const jobs = await Job.find({ companyId, status: { $ne: 'Cancelled' } })
    .populate('workerId', 'name')
    .populate('outputItemId', 'name')
    .populate({ path: 'lotId', select: 'lotId itemId rate', populate: { path: 'itemId', select: 'name' } })
    .lean();

  const { isJobWork } = require('../sources/processStock');
  const millJobs = jobs.filter((j) => !isJobWork(j));
  const out = [];
  for (const j of millJobs) {
    const chNo = String(j.challanNo || j.jobCardNo || '');
    const greyItem = j.lotId?.itemId?.name || '';
    const finishItem = j.outputItemId?.name || greyItem;
    const puRate = Number(j.purchaseRate || j.lotId?.rate || 0);
    const receipts = (j.receipts && j.receipts.length)
      ? j.receipts
      : (Number(j.receivedQty || 0) > 0 || Number(j.receivedGreyQty || 0) > 0
        ? [{
            date: j.receiveDate || j.issueDate,
            billNo: j.billGpNo || '',
            serialNo: j.serialNo || '',
            greyQty: Number(j.receivedGreyQty ?? j.receivedQty ?? 0),
            finishQty: Number(j.receivedQty || 0),
            kgs: Number(j.receivedKgs || j.receivedGreyKgs || 0),
            rate: Number(j.jobRate || 0),
            amount: Number(j.processCharges || 0),
          }]
        : []);

    for (const r of receipts) {
      const greyMts = round(Number(r.greyQty || 0));
      const finishMts = round(Number(r.finishQty || 0));
      const greyKgs = round(Number(j.issueKgs || 0), 3);
      const finishKgs = round(Number(r.kgs || 0), 3);
      const purAmt = round(greyMts * puRate);
      const itRate = round(Number(r.rate ?? j.jobRate ?? 0));
      const processAmt = round(Number(r.amount || 0) || finishMts * itRate);
      const totalAmt = round(purAmt + processAmt);
      out.push({
        ENT_NO: String(j._id),
        NCCHLN_NO: chNo,
        CHLN_DATE: j.issueDate,
        MILL_NAME: j.workerId?.name || '',
        LOT_NO: j.lotNo || j.lotId?.lotId || '',
        ITEM_NAME: greyItem,
        FINISH_ITEM: finishItem,
        PU_NAME: j.weaver || '',
        NCBILL_NO: r.billNo || '',
        REC_DATE: r.date || j.receiveDate || j.issueDate,
        REC_SRALNO: r.serialNo || '',
        GREY_MTS: greyMts,
        PU_RATE: round(puRate),
        PUR_AMT: purAmt,
        FINISH_MTS: finishMts,
        IT_RATE: itRate,
        PROCESS_AMT: processAmt,
        TOTAL_AMT: totalAmt,
        GREY_KGS: greyKgs,
        FINISH_KGS: finishKgs,
        PUR_KGS_AMT: round(greyKgs * puRate),
        EFF_RATE: finishMts > 0 ? round(totalAmt / finishMts) : 0,
      });
    }
  }
  return out;
}

async function run(companyId, p = {}, deps = {}) {
  let rows = deps.rows || await loadLotCostRows(companyId);
  rows = inDateRange(rows, 'REC_DATE', p.from, p.to);
  rows = inList(rows, 'MILL_NAME', p.mills);
  if (p.lotFrom || p.lotTo) {
    const lf = String(p.lotFrom || '').trim();
    const lt = String(p.lotTo || '').trim();
    rows = rows.filter((r) => (!lf || String(r.LOT_NO) >= lf) && (!lt || String(r.LOT_NO) <= lt));
  }

  const avgExp = Number(p.avgExpRate || 0);
  if (avgExp) {
    rows = rows.map((r) => {
      const exp = round((p.kgs ? r.FINISH_KGS : r.FINISH_MTS) * avgExp);
      const total = round(r.TOTAL_AMT + exp);
      const base = p.kgs ? r.FINISH_KGS : r.FINISH_MTS;
      return { ...r, PROCESS_AMT: round(r.PROCESS_AMT + exp), TOTAL_AMT: total, EFF_RATE: base > 0 ? round(total / base) : 0 };
    });
  }

  const groupMode = String(p.groupBy || '1-Normal');
  const groupField = groupMode.startsWith('2') ? 'MILL_NAME' : (groupMode.startsWith('3') ? 'ITEM_NAME' : null);
  const sortKey = p.orderBy === 'Lot' ? 'LOT_NO' : 'REC_DATE';
  const ordered = orderRows(rows, [...(groupField ? [groupField] : []), sortKey, 'NCCHLN_NO']);

  return {
    rows: ordered,
    grid: {
      layout: p.kgs ? 'JSM_VW_LOT_COSTING_KGS' : 'JSM_VW_LOT_COSTING',
      variant: 1,
      groupColumns: groupField ? [groupField] : [],
      groupDisplays: groupField ? [groupField === 'MILL_NAME' ? 'MILL' : 'ITEM'] : [],
      primaryDetailColumn: 'ENT_NO',
      captions: {},
      title: groupMode.startsWith('2')
        ? 'Mill Wise Lot Costing Report'
        : groupMode.startsWith('3') ? 'Item Wise Lot Costing Report' : 'Lot Wise Costing Report',
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const rows = await loadProcessStockRows(companyId, { kind: 'Mill' });
  const mills = [...new Set(rows.map((r) => r.MILL_NAME).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { mills };
}

module.exports = { run, options };
