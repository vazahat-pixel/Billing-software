'use strict';

/**
 * JSM Brokerage Entry / Tax Invoice Tools:
 *   - Tran_TradingBrokregEntry (Others Reports > Brokreg Statment > SalesBrokreg Entry)
 *   - Broker_commision_check    (Others Reports > Old Reports > Extra Reports > Brokreg Entry)
 *
 * Previews eligible settled bills/vouchers, calculates brokerage & optional GST on btn_sv,
 * and stores/deletes clean BrokerageVoucher documents (read/write additive only).
 */
const { orderRows, inDateRange, round } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');

async function previewTradingLines(companyId, p, deps) {
  const osRows = deps.osRows || await loadOutstandingRows(companyId, 'sales', {
    status: p.status === 'Pending' ? 'Pending' : 'All',
    includeLastYear: true,
  });
  const eligible = inDateRange(osRows, 'BILL_DATE', p.from, p.to)
    .filter((r) => !p.broker || String(r.BROKER || '').toUpperCase() === String(p.broker).trim().toUpperCase());

  const commiPer = Number(p.commiPer ?? 2) || 0;
  return eligible.map((r) => {
    const baseAmt = p.amtOn === 'Taxable' ? Number(r.TAXABLE_AMT || r.NET_TOT || 0) : Number(r.NET_TOT || 0);
    return {
      VOU_NO: p.voucherNo || 'PREVIEW',
      BILL_TYPE: 'SL',
      BILL_NO: r.NCBILL_NO || '',
      BILL_DATE: r.BILL_DATE || null,
      PARTY: r.PARTY || '',
      BROKER: r.BROKER || p.broker || '',
      BILL_AMT: round(baseAmt),
      COMMI_PER: round(commiPer),
      COMMI_AMT: round((baseAmt * commiPer) / 100),
      REMARK_1: '',
    };
  });
}

async function runTradingBrokregEntry(companyId, p = {}, deps = {}) {
  const BrokerageVoucher = deps.BrokerageVoucher || require('../../../models/BrokerageVoucher');
  let notice = '';

  if (p.action === 'btn_sv') {
    const vouNo = String(p.voucherNo || '').trim() || `BRK-${Date.now()}`;
    const lines = await previewTradingLines(companyId, p, deps);
    const totalBill = round(lines.reduce((s, l) => s + l.BILL_AMT, 0));
    const totalCommi = round(lines.reduce((s, l) => s + l.COMMI_AMT, 0));
    await BrokerageVoucher.findOneAndUpdate(
      { companyId, kind: 'BrokerageEntry', voucherNo: vouNo },
      {
        companyId, voucherNo: vouNo, date: p.vouDate ? new Date(p.vouDate) : new Date(),
        kind: 'BrokerageEntry', brokerName: p.broker || '', partyName: p.paidName || '',
        billAmt: totalBill, commiPer: Number(p.commiPer || 2), commiAmt: totalCommi, netTot: totalCommi,
        remark1: p.remark1 || '', remark2: p.remark2 || '',
        lines: lines.map((l) => ({ billType: l.BILL_TYPE, billNo: l.BILL_NO, billDate: l.BILL_DATE, party: l.PARTY, amount: l.BILL_AMT, commiPer: l.COMMI_PER, commiAmt: l.COMMI_AMT })),
      },
      { upsert: true, new: true }
    );
    notice = `Saved Brokerage Entry voucher ${vouNo} (${lines.length} bills, Commission Rs. ${totalCommi}).`;
  } else if (p.action === 'btn_Del' && p.voucherNo) {
    await BrokerageVoucher.deleteOne({ companyId, kind: 'BrokerageEntry', voucherNo: String(p.voucherNo).trim() });
    notice = `Deleted Brokerage Entry voucher ${p.voucherNo}.`;
  }

  if (p.action === 'btn_Edit' || p.action === 'btn_Find') {
    const docs = await BrokerageVoucher.find({ companyId, kind: 'BrokerageEntry' }).sort({ date: -1 }).lean();
    const flat = docs.map((d) => ({
      VOU_NO: d.voucherNo, BILL_TYPE: 'VOU', BILL_NO: d.voucherNo, BILL_DATE: d.date,
      PARTY: d.partyName || d.brokerName, BROKER: d.brokerName,
      BILL_AMT: round(d.billAmt), COMMI_PER: round(d.commiPer), COMMI_AMT: round(d.commiAmt), REMARK_1: d.remark1 || '',
    }));
    return {
      rows: flat,
      grid: { layout: 'JSM_VW_TRADING_BROKREG', variant: 1, groupColumns: ['BROKER'], groupDisplays: ['BROKER'], captions: {}, title: 'Saved Brokerage Entry Vouchers', period: `${flat.length} voucher(s)`, pageWise: false, notice },
    };
  }

  const rows = await previewTradingLines(companyId, p, deps);
  return {
    rows: orderRows(rows, ['BROKER', 'BILL_DATE', 'BILL_NO']),
    grid: {
      layout: 'JSM_VW_TRADING_BROKREG',
      variant: 1,
      groupColumns: ['BROKER'],
      groupDisplays: ['BROKER'],
      captions: {},
      title: 'Sales Brokerage Entry Preview',
      period: `PERIOD : ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
      notice,
    },
  };
}

async function runBrokerTaxInvoice(companyId, p = {}, deps = {}) {
  const BrokerageVoucher = deps.BrokerageVoucher || require('../../../models/BrokerageVoucher');
  const PaymentVoucher = deps.PaymentVoucher || require('../../../models/PaymentVoucher');
  let notice = '';

  const vouchers = deps.vouchers || await PaymentVoucher.find({ companyId, isReversed: { $ne: true }, status: { $ne: 'Reversed' } }).lean();
  const inWin = inDateRange(vouchers, 'date', p.from, p.to);
  const commiPer = Number(p.commiPer ?? 2) || 0;
  const sgstPer = Number(p.sgstPer ?? 0) || 0;
  const cgstPer = Number(p.cgstPer ?? 0) || 0;
  const igstPer = Number(p.igstPer ?? 0) || 0;

  if (p.action === 'btn_sv') {
    const vouNo = String(p.billNo || '').trim() || `BTI-${Date.now()}`;
    const recTot = round(inWin.reduce((s, v) => s + Number(v.amount || 0), 0));
    const commiAmt = round((recTot * commiPer) / 100);
    const sgstAmt = round((commiAmt * sgstPer) / 100);
    const cgstAmt = round((commiAmt * cgstPer) / 100);
    const igstAmt = round((commiAmt * igstPer) / 100);
    const netTot = round(commiAmt + sgstAmt + cgstAmt + igstAmt);
    await BrokerageVoucher.findOneAndUpdate(
      { companyId, kind: 'BrokerTaxInvoice', voucherNo: vouNo },
      {
        companyId, voucherNo: vouNo, date: p.billDate ? new Date(p.billDate) : new Date(),
        kind: 'BrokerTaxInvoice', brokerName: p.broker || '', billAmt: recTot,
        commiPer, commiAmt, sgstPer, sgstAmt, cgstPer, cgstAmt, igstPer, igstAmt, netTot,
        remark1: p.remark1 || '', remark2: p.remark2 || '',
      },
      { upsert: true, new: true }
    );
    notice = `Saved Broker Tax Invoice ${vouNo} (Net Rs. ${netTot}).`;
  } else if (p.action === 'btn_Del' && p.billNo) {
    await BrokerageVoucher.deleteOne({ companyId, kind: 'BrokerTaxInvoice', voucherNo: String(p.billNo).trim() });
    notice = `Deleted Broker Tax Invoice ${p.billNo}.`;
  }

  const rows = inWin.map((v) => {
    const recAmt = round(v.amount || 0);
    const cAmt = round((recAmt * commiPer) / 100);
    const gstAmt = round((cAmt * (sgstPer + cgstPer + igstPer)) / 100);
    return {
      VOU_NO: v.voucherNo || '',
      REC_DATE: v.date || null,
      AC_NAME: v.partyName || '',
      BOOK: v.bookName || '',
      REC_PAY: v.voucherType === 'Receipt' ? 'R' : 'P',
      CHQ_NO: v.chequeNo || '',
      REC_AMT: recAmt,
      COMMI_AMT: cAmt,
      GST_AMT: gstAmt,
      NET_AMT: round(cAmt + gstAmt),
      REMARK_1: v.narration || '',
    };
  });

  return {
    rows: orderRows(rows, ['REC_DATE', 'VOU_NO']),
    grid: {
      layout: 'JSM_VW_BROKER_TAX_INVOICE',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Broker Commission Tax Invoice',
      period: `PERIOD : ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
      notice,
    },
  };
}

async function options(companyId) {
  const Party = require('../../../models/Party');
  const parties = await Party.find({ companyId, isDeleted: { $ne: true } }).populate('brokerId', 'name').select('name brokerId').lean();
  return {
    brokers: [...new Set(parties.map((pt) => pt.brokerId?.name).filter(Boolean))].sort(),
  };
}

module.exports = {
  tradingEntry: { run: runTradingBrokregEntry, options },
  brokerTaxInvoice: { run: runBrokerTaxInvoice, options },
};
