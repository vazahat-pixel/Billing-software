'use strict';

/**
 * JSM Brokerage Reports backed by MERN Job/Outstanding + Party.commi:
 *   - Rpt_Job_Brokerage            (Others Reports › Brokreg Statment › JobWork)
 *   - A_Jsm_Brokreg_Statement_Report (Others Reports › Others Reports › Brokreg — Sales / Purchase / JobWork)
 *
 * NOTE: Rpt_BrokregReport (Brokreg Os Rec/Pay) is NOT built because JSM reads T_CASH_MN.COMMI_AMT
 * / COMMI_PER / EXP_VNO directly off payment vouchers, which MERN PaymentVoucher does not record.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');
const brokerageStatement = require('./brokerageStatement');

async function loadPartyCommiMap(companyId) {
  const Party = require('../../../models/Party');
  const parties = await Party.find({ companyId }).select('name commi tdsPer').lean();
  const map = new Map();
  for (const pt of parties) map.set(String(pt.name || '').trim(), { commi: Number(pt.commi || 0), tds: Number(pt.tdsPer || 0) });
  return map;
}

const jobBrokerage = {
  async run(companyId, p = {}, deps = {}) {
    const fallbackCommi = Number(p.commissionPer ?? 0) || 0;
    const baseMode = String(p.base || 'bill').toLowerCase(); // 'bill' | 'taxable' | 'paid'
    const tdsPer = Number(p.tdsPer ?? 0) || 0;

    let rows = deps.rows;
    let partyMap = deps.partyMap;
    if (!rows) {
      const [osRows, pm] = await Promise.all([
        loadOutstandingRows(companyId, 'jobwork', {
          asOn: p.to,
          status: p.status === '2-Clear' ? 'Paid' : (p.status === '3-All' ? 'All' : 'Pending'),
          includeLastYear: p.includeLastYear !== false,
        }),
        loadPartyCommiMap(companyId),
      ]);
      rows = osRows;
      partyMap = pm;
    } else if (!partyMap) {
      partyMap = new Map();
    }

    if (p.from || p.to) rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
    rows = inList(rows, 'BOOK', p.books);
    rows = inList(rows, 'BROKER', p.brokers);
    rows = inList(rows, 'PARTY', p.parties);

    const out = rows.map((r) => {
      const meta = partyMap.get(String(r.PARTY || '').trim()) || {};
      const rate = meta.commi > 0 ? meta.commi : fallbackCommi;
      const billAmt = round(r.NET_TOT ?? r.BILL_AMT ?? 0);
      const taxableAmt = round(r.TAXABLE_AMT ?? billAmt);
      const paidAmt = round(r.ADJUST ?? r.PAID_AMT ?? 0);
      const tdsDed = round(r.TDS_AMT || 0);
      const baseAmt = baseMode === 'paid' ? paidAmt : (baseMode === 'taxable' ? taxableAmt : round(billAmt - tdsDed));
      const brokerage = round((baseAmt * rate) / 100);
      const commTds = round((brokerage * tdsPer) / 100);
      return {
        BOOK: r.BOOK || '',
        BROKER: r.BROKER || '',
        PARTY: r.PARTY || '',
        NCBILL_NO: r.NCBILL_NO || '',
        BILL_DATE: r.BILL_DATE,
        BILL_AMT: billAmt,
        TDS_AMT: tdsDed,
        PAID_AMT: paidAmt,
        PAY_DATE: r.PAID_DATE || null,
        BRK_COMMI: rate,
        BROKERAGE: brokerage,
        TDS: commTds,
        NET_COMMISION: round(brokerage - commTds),
        _billId: r._billId,
      };
    });

    return {
      rows: orderRows(out, ['BROKER', 'PARTY', 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }]),
      grid: {
        layout: 'JSM_VW_JOB_BROK_STATE_RPT',
        variant: 1,
        groupColumns: ['BROKER'],
        groupDisplays: ['BROKER'],
        primaryDetailColumn: '_billId',
        captions: {},
        title: 'JobWork Brokreg Report',
        period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  },

  async options(companyId) {
    const rows = await loadOutstandingRows(companyId, 'jobwork', {});
    const uniq = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v || '').trim()))].sort();
    return { books: uniq('BOOK'), brokers: uniq('BROKER'), parties: uniq('PARTY') };
  },
};

const brokregAll = {
  async run(companyId, p = {}, deps = {}) {
    const rpt = String(p.reportType || 'Sales');
    if (rpt === 'JobWork') return jobBrokerage.run(companyId, p, deps);
    const byRec = p.dateWise === 'Rec.Date Wise';
    const target = rpt === 'Purchase'
      ? (byRec ? brokerageStatement.purchasePaidDate : brokerageStatement.purchaseBillDate)
      : (byRec ? brokerageStatement.salesRecDate : brokerageStatement.salesBillDate);
    return target.run(companyId, p, deps);
  },

  async options(companyId) {
    return brokerageStatement.salesBillDate.options(companyId);
  },
};

module.exports = { jobBrokerage, brokregAll };

