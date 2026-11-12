'use strict';

/**
 * JSM: Reports › Gst Reports › 3B Monthly Return › 3B - Inward Supply / 3B - Outward Supply
 * (A_All_Inward_Supply_Purchase "All Inward Supply Purchase",
 *  A_All_Outward_Supply_Sales "All Outward Supply").
 *
 * Everything that went out, and everything that came in, as GSTR-3B counts it: the bills, the
 * returns and the notes together. Both screens are the same shape — JSM fills its lists from the
 * books, the parties, the states, the types and the tax slabs, and names CREDIT NOTE and DEBIT
 * NOTE among the registers it gathers (their Load) — filter with
 *
 *   (A.BILL_DATE >='…' AND A.BILL_DATE <='…') AND A.BOOK IN (…) AND A.PARTY IN (…)
 *   AND A.STATE_NAME IN (…) AND A.TYPE IN (…) AND A.TAX_RATE IN (…)
 *
 * and total per party when the Summary tick is on (btn_screen_Click):
 *
 *   SELECT BOOK, PARTY, GST_NO, STATE_NAME, TYPE, MAX(TAX_RATE), SUM(BILL_AMT), SUM(SGST_AMT),
 *          SUM(CGST_AMT), SUM(IGST_AMT), SUM(TAXABLE_AMT), MONTH_NO, MONTH_NAME, YEAR_NO
 *   FROM ALL_<side>_SUPPLY_<book>_MAIN A WHERE … GROUP BY CO_PATH, BOOK, PARTY, GST_NO,
 *        STATE_NAME, TYPE, MONTH_NO, MONTH_NAME, YEAR_NO
 *
 * Every figure is the document's own stored tax — the same numbers the GST filing screens read.
 * This screen only reads them; it computes no tax and changes nothing.
 */
const { orderRows, inList, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');

/** The Order By choices and the column each one gathers on. */
const GROUP_FIELDS = {
  None: null,
  Register: 'BOOK',
  Book: 'BOOK',
  Party: 'PARTY',
  State_Name: 'STATE_NAME',
  Type: 'TYPE',
  GstRate: 'TAX_RATE',
  Month: 'MONTH_NAME',
};

const SUM = ['BILL_AMT', 'TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT'];
const LISTS = { books: 'BOOK', parties: 'PARTY', states: 'STATE_NAME', types: 'TYPE', gstRates: 'TAX_RATE' };

function fieldOf(choice, fallback) {
  const name = String(choice ?? '').trim() || fallback;
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

/** A bill, a return or a note as one supply row. */
function supplyRow(r, entType, bookName) {
  const date = r.BILL_DATE ? new Date(r.BILL_DATE) : null;
  return {
    ENT_NO: r.ENT_NO,
    ENT_TYPE: entType,
    BOOK: bookName || r.BOOK || '',
    REGISTER: bookName || r.REGISTER || '',
    BILL_NO: r.NCBILL_NO || '',
    BILL_DATE: r.BILL_DATE,
    PARTY: r.PARTY || '',
    GST_NO: r.GSTIN_NO || '',
    STATE_NAME: r.STATE || '',
    TYPE: r.TYPE || '',
    TAX_RATE: round(r.GST_RATE),
    BILL_AMT: round(r.NET_TOT),
    TAXABLE_AMT: round(r.TAXABLE_AMT),
    SGST_AMT: round(r.SGST_AMT),
    CGST_AMT: round(r.CGST_AMT),
    IGST_AMT: round(r.IGST_AMT),
    MONTH_NAME: date ? MONTHS[date.getUTCMonth()] : '',
    MONTH_NO: date ? date.getUTCMonth() + 1 : 0,
    YEAR_NO: date ? date.getUTCFullYear() : 0,
  };
}

/** The notes of one side, which JSM lists under CREDIT NOTE and DEBIT NOTE. */
async function noteRows(companyId, noteType) {
  const DebitCreditNote = require('../../../models/DebitCreditNote');
  require('../../../models/Party');
  const notes = await DebitCreditNote.find({ companyId, noteType })
    .populate('partyId', 'name state gstin type')
    .lean();

  return notes.map((n) => {
    const date = n.date ? new Date(n.date) : null;
    return {
      ENT_NO: String(n._id),
      ENT_TYPE: `${noteType.toUpperCase()} NOTE`,
      BOOK: `${noteType.toUpperCase()} NOTE`,
      REGISTER: `${noteType.toUpperCase()} NOTE`,
      BILL_NO: n.vNo || n.noteNo || '',
      BILL_DATE: n.date,
      PARTY: n.partyName || n.partyId?.name || '',
      GST_NO: n.partyId?.gstin || '',
      STATE_NAME: n.partyId?.state || '',
      TYPE: n.partyId?.type || '',
      TAX_RATE: round(n.gstRate),
      BILL_AMT: round(n.totalAmount ?? n.amount ?? 0),
      TAXABLE_AMT: round(n.taxableAmount),
      SGST_AMT: round(n.sgst),
      CGST_AMT: round(n.cgst),
      IGST_AMT: round(n.igst),
      MONTH_NAME: date ? MONTHS[date.getUTCMonth()] : '',
      MONTH_NO: date ? date.getUTCMonth() + 1 : 0,
      YEAR_NO: date ? date.getUTCFullYear() : 0,
    };
  });
}

function supplyReport(spec) {
  async function allRows(companyId) {
    const [bills, returns, notes] = await Promise.all([
      spec.loadBills(companyId),
      src.loadReturnRegisterRows(companyId, spec.returnType),
      noteRows(companyId, spec.noteType),
    ]);
    return [
      ...bills.map((r) => supplyRow(r, 'BILL')),
      ...returns.map((r) => supplyRow(r, spec.returnLabel, spec.returnLabel)),
      ...notes,
    ];
  }

  async function run(companyId, p = {}, deps = {}) {
    const by1 = fieldOf(p.orderBy1, 'Register');
    const by2 = fieldOf(p.orderBy2, 'None');
    const summary = p.summary === true || String(p.summary) === 'true';

    let rows = deps.rows || await allRows(companyId);
    rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    const levelled = rows.map((r) => ({
      ...r,
      ZGROUP: by1.field ? (r[by1.field] || '') : '',
      ZGROUP2: by2.field ? (r[by2.field] || '') : '',
    }));

    const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
    const title = `${by1.name} Wise All ${spec.noun} Supply GSTIN: `;

    if (summary) {
      // JSM totals one line per party and month, inside whatever it is gathered on.
      const keys = ['ZGROUP', by2.field ? 'ZGROUP2' : null, 'BOOK', 'PARTY', 'GST_NO',
        'STATE_NAME', 'TYPE', 'MONTH_NO'].filter(Boolean);
      const grouped = groupBy(levelled, keys, { sum: SUM, max: ['TAX_RATE', 'YEAR_NO', 'MONTH_NAME'] });
      for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);
      return {
        rows: orderRows(grouped, ['ZGROUP', by2.field ? 'ZGROUP2' : null, 'PARTY',
          { field: 'MONTH_NO', dir: 'asc', numeric: true }].filter(Boolean)),
        grid: {
          layout: spec.summaryView,
          variant: 1,
          groupColumns: [],
          groupDisplays: [],
          captions: { ZGROUP: by1.name, ZGROUP2: by2.name === 'None' ? '' : by2.name },
          title: `${title}[Summary]`,
          period,
          pageWise: p.printout === '2-PageWise',
        },
      };
    }

    const keys = [by1.field ? 'ZGROUP' : null, by2.field ? 'ZGROUP2' : null].filter(Boolean);
    return {
      rows: orderRows(levelled, [...keys, 'BILL_DATE', { field: 'BILL_NO', dir: 'asc', numeric: true }]),
      grid: {
        layout: spec.detailView,
        variant: 1,
        groupColumns: keys,
        groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
        primaryDetailColumn: 'ENT_NO',
        captions: {},
        title,
        period,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId) {
    const rows = await allRows(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return {
      books: u('BOOK'), parties: u('PARTY'), states: u('STATE_NAME'),
      types: u('TYPE'), gstRates: u('TAX_RATE'),
    };
  }

  return { run, options };
}

module.exports = {
  outward: supplyReport({
    noun: 'Outward',
    loadBills: (c) => src.loadSalesRegisterRows(c),
    returnType: 'Sales',
    returnLabel: 'SALES RETURN',
    noteType: 'Credit',
    detailView: 'JSM_VW_ALL_OUTWARD_SUPPLY_SALES_DET',
    summaryView: 'JSM_VW_ALL_OUTWARD_SUPPLY_SALES_SUM',
  }),
  inward: supplyReport({
    noun: 'Inward',
    loadBills: (c) => src.loadPurchaseRegisterRows(c),
    returnType: 'Purchase',
    returnLabel: 'PURCHASE RETURN',
    noteType: 'Debit',
    detailView: 'JSM_VW_ALL_INWARD_SUPPLY_PURCHASE_DET',
    summaryView: 'JSM_VW_ALL_INWARD_SUPPLY_PURCHASE_SUM',
  }),
};
