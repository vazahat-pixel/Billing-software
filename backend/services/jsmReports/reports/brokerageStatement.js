'use strict';

/**
 * JSM: Others Reports › Brokreg Statment › Sales (Rec.Date Wise / Bill Date Wise) and
 * Purchase (Bill Date Wise / Paid Date Wise) — A_BrokregStatment, "Brokreg Statment".
 *
 * What a broker has earned on the bills he brought. JSM reads
 * JSM_VW_OS_SALES_SUMMARY_BROKREG / JSM_VW_OS_PURCHASE_SUMMARY_BROKREG (OpenReportFormat), dates
 * them by bill or by receipt according to the screen (Fill_String_For_Condition):
 *
 *   B: (A.BILL_DATE >='…' AND A.BILL_DATE <='…')      -- Bill Date Wise
 *   R: (A.REC_DATE  >='…' AND A.REC_DATE  <='…')      -- Rec. / Paid Date Wise
 *   Pending (A.PEND='P') | Clear (A.PEND='C') | (A.PEND<>'X')
 *   A.BROKER IN (…) AND A.PARTY IN (…) AND A.BOOK IN (…)
 *
 * and orders them `BROKER, PARTY, BILL_DATE, …` or `BROKER, BILL_DATE, …` — its Party and Date
 * radio — heading the window "Brokreg Statment (Sales) + (BILL DATE WISE)" and so on
 * (Fill_String_For_Period).
 *
 * The commission is the screen's own percentage on the base its three radios pick — the bill
 * amount, the amount actually paid, or the taxable amount — less TDS at its own percentage, with
 * the GstAmt Less tick taking the GST out of the base first. The bills and what has been received
 * against them come from sources/outstanding.js; the taxable and GST figures are the bill's own,
 * read from the registers and attached to the bill they belong to. No figure is recomputed.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');
const { loadSalesRegisterRows, loadPurchaseRegisterRows } = require('../sources/billRegister');

const LISTS = { brokers: 'BROKER', parties: 'PARTY', books: 'BOOK' };

/** On Bill Amt / On Paid Amt / On Taxable Amt. */
const BASES = {
  bill: (r) => Number(r.NET_TOT || 0),
  paid: (r) => Number(r.ADJUST || 0),
  taxable: (r) => Number(r.TAXABLE_AMT || 0),
};

function baseOf(choice) {
  const name = String(choice ?? 'bill').trim().toLowerCase();
  if (!(name in BASES)) {
    const err = new Error(`Unknown brokerage base: ${choice}`);
    err.status = 400;
    throw err;
  }
  return name;
}

function statementReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const base = baseOf(p.base);
    const commissionPer = Number(p.commissionPer ?? 2) || 0;
    const tdsPer = Number(p.tdsPer ?? 0) || 0;
    const byParty = p.order === 'Party';
    const summary = p.summary === true || String(p.summary) === 'true';

    let rows = deps.rows || await loadOutstandingRows(companyId, spec.kind, {
      asOn: p.to,
      status: p.status === '2-Clear' ? 'Paid' : (p.status === '3-All' ? 'All' : 'Pending'),
      includeLastYear: p.includeLastYear !== false,
    });

    // The bill's own taxable and GST, keyed the way both sides name a bill.
    const register = deps.register || await spec.load(companyId);
    const billOf = new Map();
    for (const r of register) {
      billOf.set(`${String(r.NCBILL_NO ?? '').trim()}|${String(r.PARTY ?? '').trim()}`, r);
    }

    // Rec. / Paid Date Wise dates a bill by when the money came, as JSM's R condition does.
    rows = spec.byRecDate
      ? inDateRange(rows, 'PAID_DATE', p.from, p.to)
      : inDateRange(rows, 'BILL_DATE', p.from, p.to);
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    const priced = rows.map((r) => {
      const bill = billOf.get(`${String(r.NCBILL_NO ?? '').trim()}|${String(r.PARTY ?? '').trim()}`);
      const taxable = bill ? Number(bill.TAXABLE_AMT || 0) : 0;
      const gst = bill ? Number(bill.GST_AMT || 0) : 0;
      const withTax = { ...r, TAXABLE_AMT: taxable, GST_AMT: gst };

      let amount = BASES[base](withTax);
      // "GstAmt Less" takes the tax out of the base before the commission is worked out.
      if (p.gstLess && base !== 'taxable') amount = round(amount - gst);

      const brokerage = round(amount * commissionPer / 100);
      const tds = round(brokerage * tdsPer / 100);
      return {
        BROKER: r.BROKER || '',
        PARTY: r.PARTY || '',
        BOOK: r.BOOK || '',
        BILL_DATE: r.BILL_DATE,
        NCBILL_NO: r.NCBILL_NO || '',
        REC_DATE: r.PAID_DATE || null,
        BILL_AMT: round(r.NET_TOT),
        TAXABLE_AMT: round(taxable),
        GST_AMT: round(gst),
        PAID_AMT: round(r.ADJUST),
        TOT_BALANCE: round(r.TOT_BALANCE),
        BASE_AMT: round(amount),
        BROKREG_AMT: brokerage,
        TDS_AMT: tds,
        NET_BROKREG: round(brokerage - tds),
        _billId: r._billId,
      };
    });

    const period = `${spec.dateCaption}DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
    const title = `Brokreg Statment (${spec.noun}) + ${spec.wise}`;
    const SUM = ['BILL_AMT', 'TAXABLE_AMT', 'GST_AMT', 'PAID_AMT', 'TOT_BALANCE', 'BASE_AMT',
      'BROKREG_AMT', 'TDS_AMT', 'NET_BROKREG'];

    if (summary) {
      const grouped = groupBy(priced, ['BROKER'], { sum: SUM });
      for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);
      return {
        rows: orderRows(grouped, ['BROKER']),
        grid: {
          layout: 'JSM_VW_BROKREG_STATEMENT_SUMMARY',
          variant: 1,
          groupColumns: [],
          groupDisplays: [],
          captions: {},
          title: `${title} [Summary]`,
          period,
          pageWise: p.printout === '2-PageWise',
        },
      };
    }

    return {
      rows: orderRows(priced, [
        'BROKER',
        byParty ? 'PARTY' : null,
        'BILL_DATE',
        { field: 'NCBILL_NO', dir: 'asc', numeric: true },
      ].filter(Boolean)),
      grid: {
        layout: 'JSM_VW_BROKREG_STATEMENT',
        variant: 1,
        groupColumns: ['BROKER'],
        groupDisplays: ['BROKER'],
        primaryDetailColumn: '_billId',
        captions: {},
        title,
        period,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId) {
    const rows = await loadOutstandingRows(companyId, spec.kind, {});
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return { brokers: u('BROKER'), parties: u('PARTY'), books: u('BOOK') };
  }

  return { run, options };
}

module.exports = {
  salesBillDate: statementReport({
    kind: 'sales', noun: 'Sales', wise: '(BILL DATE WISE)', dateCaption: 'BILL ',
    load: loadSalesRegisterRows,
  }),
  salesRecDate: statementReport({
    kind: 'sales', noun: 'Sales', wise: '(REC.DATE WISE)', dateCaption: 'REC. ', byRecDate: true,
    load: loadSalesRegisterRows,
  }),
  purchaseBillDate: statementReport({
    kind: 'purchase', noun: 'Purchase', wise: '(BILL DATE WISE)', dateCaption: 'BILL ',
    load: loadPurchaseRegisterRows,
  }),
  purchasePaidDate: statementReport({
    kind: 'purchase', noun: 'Purchase', wise: '(PAID DATE WISE)', dateCaption: 'PAID ', byRecDate: true,
    load: loadPurchaseRegisterRows,
  }),
};
