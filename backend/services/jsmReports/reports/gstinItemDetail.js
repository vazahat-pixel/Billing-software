'use strict';

/**
 * JSM: Reports › Gst Reports › Gstin - Sales › Sales Detail (Item) / Sales Rtn Detail (Item) and
 * Gstin - Purchase › Purchase Detail ( Item ) / Purchase Rtn Detail (Item)
 * (A_Gstr1_SalesInvoiceDetail, A_Gstr1_SalesReturnDetails, A_Gstr2_PurchaseDetail,
 * A_Gstr2_PurchaseReturnDetails — "GST - SALES - DETAILS" and so on).
 *
 * The GSTIN registers with a line per item instead of a line per bill. JSM reads
 * JSM_VW_GST_SALES_GSTR1 (and its purchase and return twins), filters it with
 *
 *   (A.BILL_DATE >='…' AND A.BILL_DATE <='…') AND A.BOOK IN (…) AND A.PARTY IN (…)
 *   AND A.STATE_CODE IN (…) AND A.TYPE IN (…) AND A.ITEM_NAME IN (…) AND A.T_GST_PER IN (…)
 *   AND A.DELIVERY IN (…)
 *
 * and gathers it on two Order By boxes out of Register, Party, State_Code_Nm, Type, Book,
 * GstRate, Hsn_Code, Delivery, Month, Item and None (its Load and
 * GetParaMetersNo_From_STP_REPORT). On GstRate or Hsn_Code it switches to its slab views, whose
 * SELECT is
 *
 *   SELECT 'SUMMARY' AS REGISTER, <group> AS ZGROUP, SUM(IT_PCS), SUM(IT_QTY), SUM(IT_QTY1),
 *          SUM(IT_TAXABLE), SUM(IT_NET_TOT), SUM(IT_SGST_A), SUM(IT_CGST_A), SUM(IT_IGST_A)
 *   FROM JSM_VW_GST_SALES_GSTR1 A WHERE … GROUP BY …
 *
 * and the Summary tick gives the same totals for whatever it is gathered on.
 *
 * Each line's tax is the line's own stored GST: a bill taxed inter-state carries it as IGST, one
 * taxed inside the state splits it half and half, which is the rule JSM's own view applies. The
 * filing reports are untouched by this screen — it only reads.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');
const src = require('../sources/billRegister');

/** The Order By choices and the column each one gathers on. */
const GROUP_FIELDS = {
  None: null,
  Register: 'BOOK',
  Book: 'BOOK',
  Party: 'PARTY',
  State_Code_Nm: 'STATE_NAME',
  Type: 'TYPE',
  GstRate: 'T_GST_PER',
  Hsn_Code: 'HSN_CODE',
  Delivery: 'DELIVERY',
  Month: 'MONTH',
  Item: 'ITEM_NAME',
};

/** The two choices that make JSM print its slab views instead of the bill-line one. */
const SLABS = ['GstRate', 'Hsn_Code'];

const SUM = ['IT_PCS', 'IT_QTY', 'IT_QTY1', 'IT_TAXABLE', 'IT_NET_TOT', 'IT_SGST_A', 'IT_CGST_A', 'IT_IGST_A'];
const LISTS = {
  books: 'BOOK', parties: 'PARTY', states: 'STATE_NAME', types: 'TYPE',
  items: 'ITEM_NAME', gstRates: 'T_GST_PER', deliveries: 'DELIVERY',
};

function fieldOf(choice, fallback) {
  const name = String(choice ?? '').trim() || fallback;
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

function itemDetailReport(spec) {
  /** One row per bill line, in the view's own column names. */
  async function lineRows(companyId) {
    const bills = await spec.load(companyId);
    const rows = [];
    for (const b of bills) {
      for (const l of b._lines || []) {
        rows.push({
          ENT_NO: b.ENT_NO,
          CO_ENT_NO: b.CO_ENT_NO,
          BILL_NO: b.NCBILL_NO || '',
          BILL_DATE: b.BILL_DATE,
          BOOK: b.BOOK || '',
          REGISTER: b.REGISTER || '',
          PARTY: b.PARTY || '',
          DELIVERY: b.DELIVERY || '',
          STATION: b.STATION || '',
          STATE_NAME: b.STATE || '',
          TYPE: b.TYPE || '',
          MONTH: b.MONTH || '',
          YEAR_NO: b.YEAR_NO,
          MONTH_NO: b.MONTH_NO,
          GSTIN_NO: b.GSTIN_NO || '',
          T_GST_PER: round(l.IT_GST_PER),
          HSN_CODE: l.HSN_CODE || '',
          ITEM_NAME: l.ITEM_NAME || '',
          UNIT_NAME: l.UNIT_NAME || '',
          IT_RATE: round(l.IT_RATE),
          IT_PCS: Number(l.IT_PCS || 0),
          IT_QTY: round(l.IT_QTY),
          IT_QTY1: round(l.IT_QTY),
          IT_TAXABLE: round(l.IT_TAXABLE),
          IT_SGST_P: round(l.IT_SGST_P),
          IT_SGST_A: round(l.IT_SGST_A),
          IT_CGST_P: round(l.IT_CGST_P),
          IT_CGST_A: round(l.IT_CGST_A),
          IT_IGST_P: round(l.IT_IGST_P),
          IT_IGST_A: round(l.IT_IGST_A),
          TOT_GST_P: round(l.IT_GST_PER),
          TOT_GST_A: round(l.IT_GST_AMT),
          IT_NET_TOT: round(Number(l.IT_TAXABLE || 0) + Number(l.IT_GST_AMT || 0)),
        });
      }
    }
    return rows;
  }

  async function run(companyId, p = {}, deps = {}) {
    const by1 = fieldOf(p.orderBy1, 'Register');
    const by2 = fieldOf(p.orderBy2, 'None');
    const summary = p.summary === true || String(p.summary) === 'true';

    let rows = deps.rows || await lineRows(companyId);
    rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    const levelled = rows.map((r) => ({
      ...r,
      ZGROUP: by1.field ? (r[by1.field] || '') : '',
      ZGROUP2: by2.field ? (r[by2.field] || '') : '',
    }));

    const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
    const title = `${by1.name} Wise ${spec.noun} List GSTIN: `;
    const slab = SLABS.includes(by1.name);

    if (slab || summary) {
      const keys = ['ZGROUP', by2.field ? 'ZGROUP2' : null].filter(Boolean);
      const grouped = groupBy(levelled, keys, { sum: SUM });
      for (const g of grouped) {
        for (const f of SUM) g[f] = round(g[f]);
        g.REGISTER = 'SUMMARY';
      }
      return {
        rows: orderRows(grouped, keys),
        grid: {
          layout: slab ? spec.slabView : spec.summaryView,
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
      rows: orderRows(levelled, [
        ...keys, 'BILL_DATE', { field: 'BILL_NO', dir: 'asc', numeric: true }, 'ITEM_NAME',
      ]),
      grid: {
        layout: spec.view,
        variant: 1,
        groupColumns: keys,
        groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
        primaryDetailColumn: 'CO_ENT_NO',
        captions: {},
        title,
        period,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId) {
    const rows = await lineRows(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return {
      books: u('BOOK'), parties: u('PARTY'), states: u('STATE_NAME'), types: u('TYPE'),
      items: u('ITEM_NAME'), gstRates: u('T_GST_PER'), deliveries: u('DELIVERY'),
    };
  }

  return { run, options };
}

module.exports = {
  sales: itemDetailReport({
    load: (c) => src.loadSalesRegisterRows(c),
    noun: 'Sales',
    view: 'JSM_VW_GST_SALES_GSTR1_REPORT',
    slabView: 'JSM_VW_GST_SALES_GSTR1_SLAB_REPORT',
    summaryView: 'JSM_VW_GST_SALES_GSTR1_SLAB_SUMMARY',
  }),
  salesReturn: itemDetailReport({
    load: (c) => src.loadReturnRegisterRows(c, 'Sales'),
    noun: 'Sales Return',
    view: 'JSM_VW_GST_SALES_RTN_GSTR1_REPORT',
    slabView: 'JSM_VW_GST_SALES_RTN_GSTR1_SLAB_REPORT',
    summaryView: 'JSM_VW_GST_SALES_RTN_GSTR1_SLAB_SUMMARY',
  }),
  purchase: itemDetailReport({
    load: (c) => src.loadPurchaseRegisterRows(c),
    noun: 'Purchase',
    view: 'JSM_VW_GST_PURCHASE_GSTR2_REPORT',
    slabView: 'JSM_VW_GST_PURCHASE_GSTR2_SLAB_REPORT',
    summaryView: 'JSM_VW_GST_PURCHASE_GSTR2_SLAB_SUMMARY',
  }),
  purchaseReturn: itemDetailReport({
    load: (c) => src.loadReturnRegisterRows(c, 'Purchase'),
    noun: 'Purchase Return',
    view: 'JSM_VW_GST_PURCHASE_RTN_GSTR2_REPORT',
    slabView: 'JSM_VW_GST_PURCHASE_RTN_GSTR2_SLAB_REPORT',
    summaryView: 'JSM_VW_GST_PURCHASE_RTN_GSTR2_SLAB_SUMMARY',
  }),
};
