'use strict';

/**
 * JSM Status Repair / Sync Tools:
 *   - Rpt_Update_Lot_Status (Reports > Process Reports > Update Lot Status)
 *   - Rpt_Jsm_Os_Update     (Others Reports > Outstanding > Update O/s. Bill)
 */
const { orderRows, round } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');

/** Rpt_Update_Lot_Status: compare issued vs received qty/pcs on Jobs, and update status on btn_update. */
async function runUpdateLotStatus(companyId, p = {}, deps = {}) {
  const Job = deps.Job || require('../../../models/Job');
  const jobs = deps.jobs || await Job.find({ companyId, status: { $ne: 'Cancelled' } })
    .populate('workerId', 'name')
    .lean();

  const kind = p.mode || 'Mill'; // 'Mill' | 'Job'
  const byPcs = Boolean(p.byPcs);
  const candidates = [];
  let updated = 0;

  for (const j of jobs) {
    const isJob = j.workKind === 'Job' || (!j.workKind && j.processType === 'Job Work');
    if (kind === 'Job' ? !isJob : isJob) continue;
    const issPcs = Number(j.issuePcs || 0);
    const recPcs = Number(j.receivedGreyPcs ?? j.receivedPcs ?? 0);
    const issQty = Number(j.issueQty || 0);
    const recQty = Number(j.receivedGreyQty ?? j.receivedQty ?? 0);
    const diffPcs = issPcs - recPcs;
    const diffQty = round(issQty - recQty);
    const isDone = byPcs ? diffPcs <= 0 : diffQty <= 0.005;
    const expected = isDone ? 'Received' : (recQty > 0 || recPcs > 0 ? 'Partial' : 'Issued');
    const needsSync = j.status !== expected;

    if (needsSync && p.action === 'btn_update' && !deps.jobs) {
      await Job.updateOne({ _id: j._id, companyId }, { $set: { status: expected } });
      updated += 1;
    } else if (needsSync && p.action === 'btn_update' && deps.onUpdate) {
      await deps.onUpdate(j._id, expected);
      updated += 1;
    }

    if (needsSync || p.showAll) {
      candidates.push({
        ENT_NO: String(j._id),
        CHLN_DATE: j.issueDate || null,
        NCCHLN_NO: String(j.challanNo || j.jobCardNo || ''),
        PARTY: j.workerId?.name || '',
        ISS_PCS: issPcs,
        REC_PCS: recPcs,
        DIFF_PCS: diffPcs,
        ISS_QTY: round(issQty),
        REC_QTY: round(recQty),
        DIFF_QTY: diffQty,
        CURR_STATUS: j.status || '',
        NEW_STATUS: expected,
      });
    }
  }

  return {
    rows: orderRows(candidates, ['CHLN_DATE', { field: 'NCCHLN_NO', dir: 'asc', numeric: true }]),
    grid: {
      layout: 'JSM_VW_UPDATE_LOT_STATUS',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: `Update Lot / Challan Status (${kind})`,
      period: byPcs ? 'Compare Mode: Pcs' : 'Compare Mode: Qty',
      pageWise: false,
      notice: p.action === 'btn_update' ? `Updated ${updated} challan status record(s).` : `Found ${candidates.length} mismatch(es). Click Update to sync status.`,
    },
  };
}

/** Rpt_Jsm_Os_Update: compare Sales/Purchase netAmount vs paidAmount/adjusted outstanding and sync status. */
async function runOsUpdate(companyId, p = {}, deps = {}) {
  const Sales = deps.Sales || require('../../../models/Sales');
  const Purchase = deps.Purchase || require('../../../models/Purchase');

  const [salesOs, puOs] = await Promise.all([
    deps.salesOs || loadOutstandingRows(companyId, 'sales', { status: 'All', includeLastYear: true }),
    deps.puOs || loadOutstandingRows(companyId, 'purchase', { status: 'All', includeLastYear: true }),
  ]);

  const rows = [];
  let updated = 0;

  const inspect = async (list, spType, Model) => {
    for (const r of list) {
      const bal = round(r.TOT_BALANCE || 0);
      const isZero = Math.abs(bal) <= 0.5;
      const expected = isZero ? 'paid' : (Number(r.ADJUST || 0) > 0 ? 'partial' : 'active');
      const current = String(r._docStatus || r.PEND === 'C' ? 'paid' : 'active');
      const mismatch = (isZero && r.PEND === 'P') || (!isZero && r.PEND === 'C');
      if (mismatch && p.action === 'btn_update') {
        if (Model && r.ENT_NO && /^[0-9a-f]{24}$/i.test(String(r.ENT_NO))) {
          await Model.updateOne({ _id: r.ENT_NO, companyId }, { $set: { status: expected, paidAmount: round(r.ADJUST || 0) } });
        } else if (deps.onUpdate) {
          await deps.onUpdate(spType, r.ENT_NO, expected);
        }
        updated += 1;
      }
      if (mismatch || p.showAll) {
        rows.push({
          SP_TYPE: spType,
          AC_NAME: r.PARTY || '',
          BILL_DATE: r.BILL_DATE || null,
          NCBILL_NO: r.NCBILL_NO || '',
          BILL_AMT: round(r.NET_TOT || 0),
          TOTAL_RECAMT: round((r.ADJUST || 0) + (r.GOODS_RTN || 0)),
          DIFF_AMOUNT: bal,
          PEND: r.PEND || (isZero ? 'C' : 'P'),
          TARGET_STATUS: expected.toUpperCase(),
        });
      }
    }
  };

  await inspect(salesOs, '1SL', deps.Sales || Sales);
  await inspect(puOs, '1PU', deps.Purchase || Purchase);

  return {
    rows: orderRows(rows, ['SP_TYPE', 'AC_NAME', 'BILL_DATE', 'NCBILL_NO']),
    grid: {
      layout: 'JSM_VW_OS_UPDATE',
      variant: 1,
      groupColumns: ['SP_TYPE'],
      groupDisplays: ['TYPE'],
      captions: {},
      title: 'Update Outstanding Bill Status',
      period: 'Sales & Purchase Bill Status Audit',
      pageWise: false,
      notice: p.action === 'btn_update' ? `Updated ${updated} bill payment status record(s).` : `Found ${rows.length} outstanding status mismatch(es). Click Update to sync.`,
    },
  };
}

module.exports = {
  updateLot: { run: runUpdateLotStatus, options: async () => ({}) },
  osUpdate: { run: runOsUpdate, options: async () => ({}) },
};

