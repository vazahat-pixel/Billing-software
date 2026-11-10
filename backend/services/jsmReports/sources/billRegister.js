'use strict';

/**
 * MERN sales / purchase bills and their returns as rows of JSM's register views. Read-only —
 * nothing here recomputes or changes a stored figure.
 *
 * TOT.ADD / TOT.LESS: JSM keeps a bill's footer adjustments as Add/Less rows and reports their
 * totals, with header taxable = SUB_TOT + T_ADD − T_LESS.
 *   Sales already stores exactly that split as totalAdd / totalLess (utils/salesTotals computes it
 *   with JSM's own rule), so it is read straight off the bill.
 *   Purchase stores only the signed footer fields, so they are sorted into the two buckets the same
 *   way utils/purchaseTotals.footerTaxableDelta folds them into the taxable amount — term for term,
 *   which is what keeps GROSS.AMT + TOT.ADD − TOT.LESS on the bill's own taxable amount.
 *
 * JSM field meanings (verified against the customer's JSM):
 *   SRAL_NO    our own per-book serial
 *   NCBILL_NO  sales: our own per-book bill number; purchase: the SUPPLIER's typed bill number
 */
const { MONTHS, round } = require('../jcEngine');
const purchaseTotals = require('../../../utils/purchaseTotals');
const salesTotals = require('../../../utils/salesTotals');

/** Purchase-side footer fields, mirroring purchaseTotals.footerTaxableDelta. */
const PURCHASE_SIGNED = [
  { amount: 'discountAmt', sign: 'discountSign', defaultSign: '-' },
  { amount: 'lessAmt', sign: 'lessSign', defaultSign: '-' },
  { amount: 'addAmt', sign: 'addSign', defaultSign: '+' },
  { amount: 'octroi', sign: 'octroiSign', defaultSign: '+' },
];

function purchaseAddLess(p) {
  let add = 0;
  let less = 0;
  for (const e of PURCHASE_SIGNED) {
    const amt = Number(p[e.amount] || 0);
    if (!amt) continue;
    if ((p[e.sign] || e.defaultSign) === '+') add += amt; else less += amt;
  }
  // rdAmt always reduces and freight always adds, as that engine treats them. otherCharges is
  // deliberately absent: it is not part of the taxable delta there.
  less += Number(p.rdAmt || 0);
  add += Number(p.freightAmount || 0);
  return { add: round(add), less: round(less) };
}

/**
 * Sales: the bill's own totalAdd / totalLess when it carries them — the JSM import writes JSM's
 * AMT_1..7 split there (exactly JSM's T_ADD / T_LESS) and leaves the signed footer fields empty, and
 * the sales screen sends them too. Otherwise the signed footer fields are sorted the way
 * utils/salesTotals folds them into the taxable amount, term for term (salesService passes the bill
 * itself as that engine's `extras`, so the field names are the bill's).
 */
const SALES_SIGNED = [
  { amount: 'foldLess', sign: 'foldLessSign' },
  { amount: 'rdAmt', sign: 'rdAmtSign' },
  { amount: 'discountAmt', sign: 'discountSign' },
  { amount: 'lessAmt', sign: 'lessSign' },
];

function salesAddLess(s) {
  const storedAdd = Number(s.totalAdd || 0);
  const storedLess = Number(s.totalLess || 0);
  if (storedAdd || storedLess) return { add: round(storedAdd), less: round(storedLess) };

  let add = Number(s.freight || 0);
  let less = 0;
  for (const e of SALES_SIGNED) {
    const amt = Number(s[e.amount] || 0);
    if (amt <= 0) continue;
    if (s[e.sign] === '+') add += amt; else less += amt;
  }
  const addAmt = Number(s.addAmt || 0);
  if (addAmt > 0) {
    if (s.addSign === '-') less += addAmt; else add += addAmt;
  }
  return { add: round(add), less: round(less) };
}

/**
 * @param {object} o
 *   side        'sales' | 'purchase'  (decides the add/less rule and the line taxable rule)
 *   partyPath   populated party field holding the other side of the bill
 *   bookName    Map of bookId -> name, and fallback
 */
function mapBill(doc, o) {
  const date = doc.date ? new Date(doc.date) : null;
  const isSales = o.side === 'sales';
  const { add, less } = isSales ? salesAddLess(doc) : purchaseAddLess(doc);
  const lineTaxable = isSales ? salesTotals.lineTaxable : purchaseTotals.lineTaxable;

  const party = doc[o.partyPath] || null;
  const items = Array.isArray(doc.items) ? doc.items : [];
  const book = o.bookName.get(String(doc.bookId)) || o.fallbackBook;

  return {
    CO_PATH: o.coShort,
    CO_SHORT: o.coShort,
    ENT_NO: String(doc._id),
    CO_ENT_NO: `${doc._id}${o.coShort}`,
    SRAL_NO: doc.invoiceNo || '',
    NCBILL_NO: isSales ? (doc.invoiceNo || '') : (doc.supplierInvoiceNo || ''),
    BILL_DATE: date,
    BOOK: book,
    REGISTER: book,
    PARTY: party?.name || '',
    BROKER: doc.brokerId?.name || '',
    STATION: party?.city || '',
    MAINGROUP: party?.group || '',
    // The three the GSTIN return screens group by, beside the usual ones.
    STATE: party?.state || '',
    TYPE: party?.type || '',
    GST_RATE: round(Number(doc.totalGstPer ?? doc.gstPer ?? 0)),
    TRANSPORT: doc.transport || '',
    // JSM's delivery place; sales keep it as `station`, purchases record none.
    DELIVERY: doc.station || '',
    MONTH: date ? MONTHS[date.getUTCMonth()] : '',
    MONTH_NO: date ? date.getUTCMonth() + 1 : null,
    YEAR_NO: date ? date.getUTCFullYear() : null,

    TO_PCS: items.reduce((s, it) => s + Number(it.pcs || 0), 0),
    TO_QTY: round(items.reduce((s, it) => s + Number(it.mts || 0), 0)),
    // GROSS.AMT is the bill's own line total, summed with the very lineTaxable its totals engine
    // uses, so SUB_TOT + T_ADD − T_LESS reproduces the stored taxable amount instead of being
    // back-derived from it (which would hide a mismatch rather than show one).
    SUB_TOT: round(items.reduce((s, it) => s + lineTaxable(it), 0)),
    T_ADD: add,
    T_LESS: less,
    // JSM's own second quantity column. This software records the one quantity, so the register
    // summary screens that print TO_QTY1 print that.
    TO_QTY1: round(items.reduce((s, it) => s + Number(it.mts || 0), 0)),
    TAXABLE_AMT: round(Number(doc.taxableAmount || 0)),
    GST_AMT: round(Number(doc.gstAmount || 0)),
    // The three heads JSM's register summary prints separately, and its TCS column.
    SGST_AMT: round(Number(doc.sgst || 0)),
    CGST_AMT: round(Number(doc.cgst || 0)),
    IGST_AMT: round(Number(doc.igst || 0)),
    TCS_AMT: round(Number(doc.tcsAmount ?? doc.tcsAmt ?? 0)),
    NET_TOT: round(Number(doc.netAmount || 0)),

    _lines: items.map((it) => ({
      ITEM_NAME: it.itemId?.name || it.desc || '',
      ITEM_GROUP: it.itemId?.group || '',
      ITEM_CATEGORY: it.itemId?.category || '',
      IT_PCS: Number(it.pcs || 0),
      IT_QTY: round(Number(it.mts || 0)),
      IT_RATE: round(Number(it.rate || 0)),
      IT_AMOUNT: round(Number(it.amount || 0)),
      // JSM's UNIT_NAME: its Item Wise Summary divides by pieces or by quantity depending on it.
      UNIT_NAME: it.unit || it.itemId?.unit || '',
      LOT_NO: it.lotNo || '',
      // JSM's T_SL_ITEM.IT_DISC1 / T_PU_ITEM.IT_DISC1 — a free-text line field. JSM's own
      // "Packers" report groups bills by this (confirmed from TMP_VW_PACKERS on the owner's JSM).
      IT_DISC1: it.desc || '',
    })),
  };
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

const Sales = require('../../../models/Sales');
const Purchase = require('../../../models/Purchase');
const ReturnInvoice = require('../../../models/ReturnInvoice');
const Book = require('../../../models/Book');
const Company = require('../../../models/Company');
require('../../../models/Party');
require('../../../models/Item');

const PARTY_FIELDS = 'name group city state type';
const ITEM_POPULATE = { path: 'items.itemId', select: 'name group category' };

async function bookContext(companyId, module, fallback) {
  const [books, company] = await Promise.all([
    Book.find({ companyId, module }).select('name').lean(),
    Company.findById(companyId).select('name coCode').lean(),
  ]);
  return {
    bookName: new Map(books.map((b) => [String(b._id), b.name])),
    fallbackBook: books[0]?.name || fallback,
    coShort: company?.coCode || '',
  };
}

async function loadSalesRegisterRows(companyId) {
  const [docs, ctx] = await Promise.all([
    Sales.find({ companyId, status: { $ne: 'cancelled' }, isDeleted: { $ne: true } })
      .populate('customerId', PARTY_FIELDS).populate('brokerId', 'name').populate(ITEM_POPULATE).lean(),
    bookContext(companyId, 'sales', 'SALES'),
  ]);
  return docs.map((d) => mapBill(d, { side: 'sales', partyPath: 'customerId', ...ctx }));
}

async function loadPurchaseRegisterRows(companyId) {
  const [docs, ctx] = await Promise.all([
    Purchase.find({ companyId, status: { $ne: 'cancelled' }, isDeleted: { $ne: true } })
      .populate('supplierId', PARTY_FIELDS).populate('brokerId', 'name').populate(ITEM_POPULATE).lean(),
    bookContext(companyId, 'purchase', 'PURCHASE'),
  ]);
  return docs.map((d) => mapBill(d, { side: 'purchase', partyPath: 'supplierId', ...ctx }));
}

/**
 * Returns carry no book and no footer adjustments in MERN, so REGISTER is a single fixed name and
 * TOT.ADD / TOT.LESS come out zero — which is what the data says, not an approximation.
 */
async function loadReturnRegisterRows(companyId, returnType) {
  const [docs, company] = await Promise.all([
    ReturnInvoice.find({ companyId, returnType })
      .populate('partyId', PARTY_FIELDS).populate('brokerId', 'name').populate(ITEM_POPULATE).lean(),
    Company.findById(companyId).select('coCode').lean(),
  ]);
  const ctx = {
    side: returnType === 'Sales' ? 'sales' : 'purchase',
    partyPath: 'partyId',
    bookName: new Map(),
    fallbackBook: `${returnType.toUpperCase()} RETURN`,
    coShort: company?.coCode || '',
  };
  return docs.map((d) => {
    const row = mapBill(d, ctx);
    row.NCBILL_NO = d.invoiceNo || '';
    row.T_ADD = 0;
    row.T_LESS = 0;
    return row;
  });
}

module.exports = {
  mapBill,
  purchaseAddLess,
  salesAddLess,
  loadSalesRegisterRows,
  loadPurchaseRegisterRows,
  loadReturnRegisterRows,
};
