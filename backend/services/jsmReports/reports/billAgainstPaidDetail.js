'use strict';

/**
 * JSM: Others Reports > MissingReport(Query) > BillAgainst PaidDetail (Frm_BillAgistPaidDetail)
 * Lists bill-by-bill adjustments recorded on Payment/Receipt vouchers (againstInvoices[]).
 */
const { orderRows, round } = require('../jcEngine');

async function loadRows(companyId) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  require('../../../models/LedgerMaster');
  const vouchers = await PaymentVoucher.find({
    companyId,
    isReversed: { $ne: true },
    status: { $ne: 'Reversed' },
    'againstInvoices.0': { $exists: true },
  }).populate('bankLedgerId', 'name').lean();

  const out = [];
  for (const v of vouchers) {
    for (const a of v.againstInvoices || []) {
      const adj = Number(a.partRc ?? a.amount ?? 0);
      const rg = Number(a.rg || 0);
      const disc = Number(a.discount || a.jvDis || 0);
      const tds = Number(a.tds || 0);
      const claim = Number(a.claim || 0);
      out.push({
        VOU_TYPE: v.voucherType || '',
        VOU_NO: v.voucherNo || '',
        REC_DATE: v.date || null,
        PARTY: v.partyName || '',
        BOOK: v.bookName || v.bankLedgerId?.name || '',
        NCBILL_NO: a.invoiceNo || '',
        BILL_DATE: a.billDate || null,
        BILL_AMT: round(a.billAmt || 0),
        ADJUST: round(adj),
        RG_AMT: round(rg),
        DISCOUNT: round(disc),
        TDS_AMT: round(tds),
        CLAIM_AMT: round(claim),
        NET_PAID: round(adj - rg - disc - tds - claim),
      });
    }
  }
  return out;
}

async function run(companyId, p = {}, deps = {}) {
  const rows = deps.rows || await loadRows(companyId);
  return {
    rows: orderRows(rows, ['REC_DATE', { field: 'VOU_NO', dir: 'asc', numeric: true }, 'NCBILL_NO']),
    grid: {
      layout: 'JSM_VW_BILL_AGAINST_PAID',
      variant: 1,
      groupColumns: ['VOU_TYPE'],
      groupDisplays: ['TYPE'],
      captions: {},
      title: 'Bill Against Paid / Receipt Detail',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

module.exports = { run, options: async () => ({}) };
