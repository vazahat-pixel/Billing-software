'use strict';

/**
 * JSM: Reports › Tcs Reports › Tcs Rec/Pay Report (Rpt_Tcs).
 *
 * Section 206C(1H) worksheet, as JSM's Receipt_Tcs_String builds it per party:
 *   OPENING  receipts (or payments) from 1 April of the year up to the day before From
 *   CURRENT  receipts (or payments) From..To, cheque returns left out
 *   TOTAL    OPENING + CURRENT
 *   APPL.VALUE  the part above Rs 50,00,000: all of CURRENT once OPENING already crossed it,
 *               else TOTAL − 50,00,000 (never below 0)
 *   TCS.PER / TCS.AMT  the rate on APPL.VALUE (0 while TOTAL has not crossed 50,00,000)
 * Receipt looks at debtors, Pay at creditors. "Applicable PartyOnly" keeps parties above the limit.
 * The rate is the 206C(1H) rate for the year (0.1% from 1-4-2021, 0.075% before), the date JSM's
 * own string carries.
 */
const { orderRows, inList, round } = require('../jcEngine');

const LIMIT = 5000000;
const RATE_FROM = '2021-04-01';
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const fyStart = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-04-01`;
};
const rateFor = (fromIso) => (fromIso >= RATE_FROM ? 0.1 : 0.075);

const isDebtor = (ledger, party) => /debtor/i.test(`${ledger?.subGroup || ''} ${ledger?.group || ''} ${ledger?.jsmHead || ''}`)
  || ['Customer', 'Both'].includes(party?.type);
const isCreditor = (ledger, party) => /creditor/i.test(`${ledger?.subGroup || ''} ${ledger?.group || ''} ${ledger?.jsmHead || ''}`)
  || ['Supplier', 'Both'].includes(party?.type);

async function loadVouchers(companyId) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  const LedgerMaster = require('../../../models/LedgerMaster');
  require('../../../models/Party');
  const vouchers = await PaymentVoucher.find({ companyId, status: 'Posted', isReversed: { $ne: true } })
    .select('voucherType date amount partyLedgerId partyName').lean();
  const ids = [...new Set(vouchers.map((v) => String(v.partyLedgerId)).filter(Boolean))];
  const ledgers = await LedgerMaster.find({ _id: { $in: ids } })
    .select('name group subGroup jsmHead linkedPartyId').populate('linkedPartyId', 'name pan type').lean();
  const byId = new Map(ledgers.map((l) => [String(l._id), l]));
  return vouchers.map((v) => {
    const l = byId.get(String(v.partyLedgerId));
    const party = l?.linkedPartyId;
    return {
      REC_PAY: v.voucherType === 'Receipt' ? 'R' : 'P',
      REC_DATE: v.date,
      REC_AMT: Number(v.amount) || 0,
      AC_NAME: party?.name || l?.name || v.partyName || '',
      PAN_NO: party?.pan || '',
      DEBTOR: isDebtor(l, party),
      CREDITOR: isCreditor(l, party),
    };
  });
}

async function run(companyId, p = {}, deps = {}) {
  if (!p.from || !p.to) throw Object.assign(new Error('From and To dates are required'), { status: 400 });
  const receipt = !/^pay/i.test(String(p.head || 'Receipt'));
  const start = fyStart(p.from);
  const rate = rateFor(p.from);
  const lines = (deps.vouchers || await loadVouchers(companyId))
    .filter((v) => v.REC_PAY === (receipt ? 'R' : 'P') && (receipt ? v.DEBTOR : v.CREDITOR));

  const byParty = new Map();
  for (const v of lines) {
    const d = dayKey(v.REC_DATE);
    const op = d >= start && d < p.from;
    const cur = d >= p.from && d <= p.to;
    if (!op && !cur) continue;
    const key = v.AC_NAME.trim().toUpperCase();
    if (!byParty.has(key)) byParty.set(key, { AC_NAME: v.AC_NAME, PAN_NO: v.PAN_NO, OP_RECEIPT: 0, CUR_RECEIPT: 0 });
    const r = byParty.get(key);
    if (op) r.OP_RECEIPT += v.REC_AMT;
    else r.CUR_RECEIPT += v.REC_AMT;
    if (!r.PAN_NO && v.PAN_NO) r.PAN_NO = v.PAN_NO;
  }

  let rows = [...byParty.values()].map((r) => {
    const op = round(r.OP_RECEIPT);
    const cur = round(r.CUR_RECEIPT);
    const total = round(op + cur);
    const appl = op >= LIMIT ? cur : Math.max(0, round(total - LIMIT));
    const per = total > LIMIT ? rate : 0;
    return {
      BOOK: receipt ? 'Receipt For TCS' : 'Payment For TCS',
      AC_NAME: r.AC_NAME,
      PAN_NO: r.PAN_NO,
      OP_RECEIPT: op,
      CUR_RECEIPT: cur,
      TOTAL_RECEIPT: total,
      APPLICABLE_VALUE: round(appl),
      TCS_PER: per,
      TCS_AMT: round((appl * per) / 100),
    };
  }).filter((r) => r.TOTAL_RECEIPT !== 0);

  rows = inList(rows, 'AC_NAME', p.parties);
  if (p.applicableOnly) rows = rows.filter((r) => r.TOTAL_RECEIPT > LIMIT);

  return {
    rows: orderRows(rows, ['BOOK', 'AC_NAME']),
    grid: {
      layout: 'JSM_VW_REC_TCS1',
      variant: 1,
      groupColumns: ['BOOK'],
      groupDisplays: ['Register'],
      captions: {},
      title: receipt ? 'Receipt For TCS' : 'Payment For TCS',
      period: `DATE : FROM ${p.fromText || p.from}  TO  ${p.toText || p.to}`,
      pageWise: String(p.printout || '').startsWith('2'),
    },
  };
}

async function options(companyId, deps = {}) {
  const lines = deps.vouchers || await loadVouchers(companyId);
  return {
    parties: [...new Set(lines.filter((v) => v.DEBTOR || v.CREDITOR).map((v) => v.AC_NAME).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
  };
}

module.exports = { run, options, LIMIT };
