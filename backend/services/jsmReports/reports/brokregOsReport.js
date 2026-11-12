'use strict';

/**
 * JSM: Others Reports > Brokreg Statment > Brokreg Os (Rec/Pay) (Rpt_BrokregReport)
 * JSM SQL: T_CASH_MN WHERE COMMI_AMT <> 0 (plus additive BrokerageVoucher entries).
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

async function loadVouchers(companyId) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  require('../../../models/LedgerMaster');
  const Party = require('../../../models/Party');

  const [vouchers, parties] = await Promise.all([
    PaymentVoucher.find({ companyId, isReversed: { $ne: true }, status: { $ne: 'Reversed' } })
      .populate('bankLedgerId', 'name')
      .lean(),
    Party.find({ companyId }).populate('brokerId', 'name').select('name brokerId ledgerId').lean(),
  ]);
  const partyByLedger = new Map(parties.filter((pt) => pt.ledgerId).map((pt) => [String(pt.ledgerId), pt]));

  const rows = [];
  for (const v of vouchers) {
    const commiAmt = Number(v.commiAmt || v.brokerageAmt || 0);
    const commiPer = Number(v.commiPer || v.brokeragePer || 0);
    if (commiAmt === 0 && commiPer === 0) continue;
    const pt = partyByLedger.get(String(v.partyLedgerId || ''));
    const recAmt = Number(v.amount || 0);
    const calcAmt = commiAmt !== 0 ? commiAmt : round((recAmt * commiPer) / 100);
    const recDate = v.date ? new Date(v.date) : null;
    const osDays = recDate ? Math.max(0, Math.floor((Date.now() - recDate.getTime()) / 86400000)) : 0;
    rows.push({
      SRAL_NO: v.voucherNo || String(v._id),
      REC_DATE: recDate,
      BROKER: v.brokerName || pt?.brokerId?.name || '',
      PARTY: v.partyName || pt?.name || '',
      BOOK: v.bookName || v.bankLedgerId?.name || '',
      REC_PAY: v.voucherType === 'Receipt' ? 'R' : 'P',
      REC_AMT: round(recAmt),
      COMMI_PER: round(commiPer),
      COMMI_AMT: round(calcAmt),
      EXP_VNO: v.expVno || '',
      REMARK_1: v.narration || '',
      OS_DAYS: osDays,
    });
  }
  return rows;
}

async function run(companyId, p = {}, deps = {}) {
  let rows = deps.rows ? deps.rows.map((r) => ({ ...r })) : await loadVouchers(companyId);
  rows = inDateRange(rows, 'REC_DATE', p.from, p.to);
  rows = inList(rows, 'BROKER', p.brokers);
  rows = inList(rows, 'PARTY', p.parties);

  const st = String(p.status || 'Pending').toUpperCase();
  if (st.startsWith('P')) rows = rows.filter((r) => !String(r.EXP_VNO || '').trim());
  else if (st.startsWith('C')) rows = rows.filter((r) => Boolean(String(r.EXP_VNO || '').trim()));

  const gMap = { Broker: 'BROKER', Party: 'PARTY' };
  const g1 = gMap[p.orderBy1] || null;
  const g2 = gMap[p.orderBy2] || null;
  const groupCols = [g1, g2 && g2 !== g1 ? g2 : null].filter(Boolean);

  return {
    rows: orderRows(rows, [...groupCols, 'REC_DATE', { field: 'SRAL_NO', dir: 'asc', numeric: true }]),
    grid: {
      layout: 'JSM_VW_BROKREG_OS',
      variant: 1,
      groupColumns: groupCols,
      groupDisplays: groupCols,
      captions: {},
      title: `${p.orderBy1 || 'All'} Wise Brokreg Report`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: String(p.printout || '').startsWith('2'),
      notice: rows.length ? '' : 'No receipt/payment vouchers carry non-zero brokerage (COMMI_AMT = 0 in legacy data). Record commission on vouchers or Brokreg Entry to populate.',
    },
  };
}

async function options(companyId) {
  const Party = require('../../../models/Party');
  const parties = await Party.find({ companyId, isDeleted: { $ne: true } }).populate('brokerId', 'name').select('name brokerId').lean();
  return {
    brokers: [...new Set(parties.map((pt) => pt.brokerId?.name).filter(Boolean))].sort(),
    parties: [...new Set(parties.map((pt) => pt.name).filter(Boolean))].sort(),
  };
}

module.exports = { run, options };
