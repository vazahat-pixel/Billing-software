'use strict';

/**
 * JSM's Outstanding family (Debitor/Creditor/Process/Jobwork O/s, their Age Analysis and Detail
 * screens) as rows of JSM_VW_OS_SALES / JSM_VW_OS_PURCHASE / JSM_VW_OS_PROCESS / JSM_VW_OS_JOBWORK.
 *
 * This is a presentation layer only — the outstanding BALANCE itself is never recomputed here.
 * It comes from reportService.getOutstanding(), the same engine that already powers the existing
 * (non-JSM) Outstanding report: BillSettlement for Sales/Purchase, Job.processCharges/
 * chargesPaidAmount for Process/JobWork. That function's own comment already calls a bill's
 * invoice fields "TOTAL-PARTY row of the reference report" — it was built to match this exact
 * screen, so reproducing JSM's column names here is a rename, not new arithmetic.
 *
 * Verified against JSM's own JSM_VW_OS_SALES_RUNTIME view (read from the owner's JSM, 03/11/2026):
 * BALANCE = NET_TOT - TDS_AMT - REC_AMT - RG_AMT - (voucher adjustments) + (voucher add/less)
 *           - (goods returns) - (journal/GST adjustments)
 * which is the same bill-amount-less-payments-less-returns-less-adjustments shape
 * reportService.getOutstanding already computes per bill.
 */
const { round } = require('../jcEngine');

const TYPE_OF = { sales: 'receivable', purchase: 'payable', process: 'process', jobwork: 'jobwork' };

async function resolveBrokerNames(companyId, invoices) {
  const ids = [...new Set(invoices.map((i) => i.broker).filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const Party = require('../../../models/Party');
  const rows = await Party.find({ _id: { $in: ids } }).select('name').lean();
  return new Map(rows.map((p) => [String(p._id), p.name]));
}

/**
 * @param {string} kind  'sales' | 'purchase' | 'process' | 'jobwork'
 * @param {object} filters  passed straight through to reportService.getOutstanding
 */
async function loadOutstandingRows(companyId, kind, filters = {}) {
  const reportService = require('../../reportService');
  const parties = await reportService.getOutstanding(companyId, TYPE_OF[kind], filters);

  const allInvoices = parties.flatMap((p) => p.invoices);
  const brokerNames = await resolveBrokerNames(companyId, allInvoices);

  const rows = [];
  for (const p of parties) {
    for (const inv of p.invoices) {
      rows.push({
        PARTY: p.partyName,
        BROKER: inv.broker ? (brokerNames.get(String(inv.broker)) || '') : '',
        STATION: p.city || '',
        MAINGROUP: p.mainGroupId || '',
        STATE: p.state || '',
        MSME_TYPE: p.msmeType || '',
        BOOK: String(inv.bookId || '').toUpperCase() || (kind === 'process' ? 'MILL' : kind === 'jobwork' ? 'JOB' : ''),
        HASTE: inv.haste || '',

        BILL_DATE: inv.date,
        NCBILL_NO: inv.docNo,
        NET_TOT: round(inv.total),
        PAID_DATE: inv.paidDate,
        ADJUST: round(inv.paid),
        GOODS_RTN: round(inv.goodsRtn || 0),
        TOT_DISC: round(inv.addLess || 0),
        IT_DISC1: round(inv.addLess || 0),
        Q_UNADJ: inv.rg ? 'Y' : '',
        TOT_BALANCE: round(inv.outstanding),
        OS_DAYS: inv.ageDays,

        // Ledger reconciliation, only present when withLedgerBalance was asked for.
        LEDGER_BAL: p.ledgerBalance,
        LEDGER_DIFF: p.ledgerDiff,

        _partyId: String(p.partyId),
        _billId: String(inv.billId),
      });
    }
  }
  return rows;
}

/**
 * Age Analysis rows: one per party, from the SAME aging buckets getOutstanding already computed
 * while walking each bill (bucket30/60/90/90Plus) — not re-derived from a different cut of the data.
 */
async function loadOutstandingAgeRows(companyId, kind, filters = {}) {
  const reportService = require('../../reportService');
  const parties = await reportService.getOutstanding(companyId, TYPE_OF[kind], filters);

  const allInvoices = parties.flatMap((p) => p.invoices);
  const brokerNames = await resolveBrokerNames(companyId, allInvoices);
  const brokerOf = (p) => {
    const first = p.invoices.find((i) => i.broker);
    return first ? (brokerNames.get(String(first.broker)) || '') : '';
  };

  return parties.map((p) => ({
    PARTY: p.partyName,
    BROKER: brokerOf(p),
    STATION: p.city || '',
    MAINGROUP: p.mainGroupId || '',
    TOT_BALANCE: round(p.totalOutstanding),
    BAL_AMT1: round(p.aging.bucket30),
    BAL_AMT2: round(p.aging.bucket60),
    BAL_AMT3: round(p.aging.bucket90),
    BAL_AMT4: round(p.aging.bucket90Plus),
    BAL_UNADJ: 0,
    _partyId: String(p.partyId),
  }));
}

module.exports = { loadOutstandingRows, loadOutstandingAgeRows, TYPE_OF };
