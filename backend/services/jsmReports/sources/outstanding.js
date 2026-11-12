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
        PARTY_MOBILE: p.phone || '',
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
        // The return goods promised on the bill's receipt, which the Rg Pending screen compares
        // against the returns that have actually come back.
        RG_AMT: round(inv.rg || 0),
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

/** JSM's Day 1 / Day 2 / Day 3 / Day 4 boxes, which its screen opens on. */


/**
 * Age Analysis rows: one per party.
 *
 * JSM buckets each bill by its own OS_DAYS against the Day 1–4 boxes on the screen
 * (`UPDATE … SET BAL_AMT2=TOT_BALANCE WHERE OS_DAYS > <day1> AND OS_DAYS <= <day2>` and so on),
 * so the boundaries are the operator's, not fixed. While they are left at JSM's own defaults the
 * totals are taken straight from the aging getOutstanding already worked out bill by bill; only
 * when the operator moves a boundary are the same bills re-bucketed here, against the same
 * per-bill balances — no figure is recomputed either way.
 */
async function loadOutstandingAgeRows(companyId, kind, filters = {}, ageDays) {
  const reportService = require('../../reportService');
  const parties = await reportService.getOutstanding(companyId, TYPE_OF[kind], filters);
  const days = Array.isArray(ageDays) && ageDays.length === 3 && ageDays.every((d) => Number.isFinite(d))
    ? ageDays
    : null;

  /** Re-bucket one party's bills when the operator has moved a boundary off JSM's defaults. */
  const custom = (p) => {
    const b = [0, 0, 0, 0];
    for (const inv of p.invoices) {
      const age = Number(inv.ageDays || 0);
      const amount = Number(inv.outstanding || 0);
      const i = age <= days[0] ? 0 : (age <= days[1] ? 1 : (age <= days[2] ? 2 : 3));
      b[i] += amount;
    }
    return b.map(round);
  };

  const allInvoices = parties.flatMap((p) => p.invoices);
  const brokerNames = await resolveBrokerNames(companyId, allInvoices);
  const brokerOf = (p) => {
    const first = p.invoices.find((i) => i.broker);
    return first ? (brokerNames.get(String(first.broker)) || '') : '';
  };

  return parties.map((p) => {
    const [b1, b2, b3, b4] = days
      ? custom(p)
      : [p.aging.bucket30, p.aging.bucket60, p.aging.bucket90, p.aging.bucket90Plus].map(round);
    return {
      PARTY: p.partyName,
      BROKER: brokerOf(p),
      STATION: p.city || '',
      MAINGROUP: p.mainGroupId || '',
      TOT_BALANCE: round(p.totalOutstanding),
      BAL_AMT1: b1,
      BAL_AMT2: b2,
      BAL_AMT3: b3,
      BAL_AMT4: b4,
      BAL_UNADJ: 0,
      _partyId: String(p.partyId),
    };
  });
}

module.exports = { loadOutstandingRows, loadOutstandingAgeRows, TYPE_OF };
