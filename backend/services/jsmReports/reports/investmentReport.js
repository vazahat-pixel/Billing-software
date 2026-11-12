'use strict';

/**
 * JSM: Others Reports > Extra RajuBhai > Inv Report (Frm_Investment_Raju)
 * Layout: RPT_INVESTMENT_RAJUBHAI (matches SQL in Frm_Investment_Raju.cs).
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

async function run(companyId, p = {}, deps = {}) {
  const InvestmentEntry = deps.InvestmentEntry || require('../../../models/InvestmentEntry');
  let docs = deps.entries;
  if (!docs) {
    docs = await InvestmentEntry.find({ companyId }).sort({ date: 1, srNo: 1 }).lean();
  }

  const now = Date.now();
  let rows = docs.map((d) => {
    const amt = round(d.amount ?? d.AMOUNT ?? 0);
    const curAmt = round(d.curAmount ?? d.CUR_AMOUNT ?? amt);
    const diff = round(curAmt - amt);
    const dt = d.date || d.DATE ? new Date(d.date || d.DATE) : null;
    const tranDays = dt ? Math.max(0, Math.floor((now - dt.getTime()) / 86400000)) : 0;
    return {
      FOLIO_NO: d.folioNo || d.FOLIO_NO || '',
      SCHEME: d.scheme || d.SCHEME || '',
      INVESTOR: d.investor || d.INVESTOR || '',
      Tran_Type: d.tranType || d.Tran_Type || '',
      Tran_Mode: d.tranMode || d.Tran_Mode || '',
      DATE: dt,
      UNIT: round(d.unit ?? d.UNIT ?? 0, 3),
      NAV: round(d.nav ?? d.NAV ?? 0, 3),
      STT: round(d.stt ?? d.STT ?? 0),
      BROKEREG: round(d.brokereg ?? d.BROKEREG ?? 0),
      TDS: round(d.tds ?? d.TDS ?? 0),
      EXIT_LOAD: round(d.exitLoad ?? d.EXIT_LOAD ?? 0),
      AMOUNT: amt,
      CUR_NAV: round(d.curNav ?? d.CUR_NAV ?? 0, 3),
      CUR_AMOUNT: curAmt,
      DIV_AMOUNT: round(d.divAmount ?? d.DIV_AMOUNT ?? 0),
      PROFIT_AMT: diff >= 0 ? diff : 0,
      LOSS_AMT: diff < 0 ? diff : 0,
      TRAN_DAYS: tranDays,
    };
  });

  rows = inDateRange(rows, 'DATE', p.from, p.to);
  rows = inList(rows, 'SCHEME', p.schemes);
  rows = inList(rows, 'INVESTOR', p.investors);
  rows = inList(rows, 'Tran_Type', p.tranTypes);
  rows = inList(rows, 'Tran_Mode', p.tranModes);

  const gMap = { Scheme: 'SCHEME', Investor: 'INVESTOR', Tran_Type: 'Tran_Type', Tran_Mode: 'Tran_Mode' };
  const g1 = gMap[p.orderBy1] || null;
  const g2 = gMap[p.orderBy2] || null;
  const groupCols = [g1, g2 && g2 !== g1 ? g2 : null].filter(Boolean);

  return {
    rows: orderRows(rows, [...groupCols, 'DATE', 'SCHEME']),
    grid: {
      layout: 'RPT_INVESTMENT_RAJUBHAI',
      variant: 1,
      groupColumns: groupCols,
      groupDisplays: groupCols,
      captions: {},
      title: 'Investment Transaction Report',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: rows.length ? '' : 'No investment entries recorded (I_INVESTMENT is also empty in SC27).',
    },
  };
}

async function options(companyId) {
  const InvestmentEntry = require('../../../models/InvestmentEntry');
  const docs = await InvestmentEntry.find({ companyId }).lean();
  const u = (f) => [...new Set(docs.map((d) => d[f]).filter(Boolean))].sort();
  return {
    schemes: u('scheme'),
    investors: u('investor'),
    tranTypes: u('tranType'),
    tranModes: u('tranMode'),
  };
}

module.exports = { run, options };
