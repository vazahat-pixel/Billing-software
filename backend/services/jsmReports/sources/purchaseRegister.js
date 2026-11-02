'use strict';

/**
 * MERN purchases as rows of JSM's purchase register views (JSM_VW_PURCHASE_SMRY_SHORT for the
 * Summary screen, JSM_VW_PURCHASE_DTL for the Detail one). Read-only — nothing here changes a
 * stored figure.
 *
 * ADD / LESS: JSM keeps a bill's footer adjustments as its Add/Less rows and reports their totals
 * as T_ADD and T_LESS, with header taxable = SUB_TOT + T_ADD − T_LESS. MERN stores the same
 * adjustments as signed footer fields (discountAmt/lessAmt/addAmt/octroi with their signs, plus
 * rdAmt and freight) and `utils/purchaseTotals.footerTaxableDelta` already folds exactly these into
 * the taxable amount. So each one is simply placed in the ADD or the LESS bucket by its effective
 * sign — the same numbers the bill was saved with, decomposed, never recomputed.
 *
 * JSM field meanings (verified against the customer's JSM):
 *   SRAL_NO    our own per-book serial  -> invoiceNo
 *   NCBILL_NO  the SUPPLIER's own bill number (may repeat, may be blank) -> supplierInvoiceNo
 */
const Purchase = require('../../../models/Purchase');
const Book = require('../../../models/Book');
const Company = require('../../../models/Company');
require('../../../models/Party');
require('../../../models/Item');
const { MONTHS, round } = require('../jcEngine');

/** The footer adjustments JSM shows as Add/Less, with the sign MERN stored them under. */
const EXTRAS = [
  { amount: 'discountAmt', sign: 'discountSign', defaultSign: '-' },
  { amount: 'lessAmt', sign: 'lessSign', defaultSign: '-' },
  { amount: 'addAmt', sign: 'addSign', defaultSign: '+' },
  { amount: 'octroi', sign: 'octroiSign', defaultSign: '+' },
];

/** Split the footer adjustments into JSM's two totals. */
function addLessOf(p) {
  let add = 0;
  let less = 0;
  for (const e of EXTRAS) {
    const amt = Number(p[e.amount] || 0);
    if (!amt) continue;
    const sign = p[e.sign] || e.defaultSign;
    if (sign === '+') add += amt; else less += amt;
  }
  // rdAmt always reduces, freight always adds (purchaseTotals treats them that way).
  less += Number(p.rdAmt || 0);
  add += Number(p.freightAmount || 0) + Number(p.otherCharges || 0);
  return { add: round(add), less: round(less) };
}

async function loadPurchaseRegisterRows(companyId) {
  const [purchases, books, company] = await Promise.all([
    Purchase.find({ companyId, status: { $ne: 'cancelled' }, isDeleted: { $ne: true } })
      .populate('supplierId', 'name group city state brokerId')
      .populate('brokerId', 'name')
      .populate({ path: 'items.itemId', select: 'name group' })
      .lean(),
    Book.find({ companyId, module: 'purchase' }).select('name').lean(),
    Company.findById(companyId).select('name coCode').lean(),
  ]);

  const bookName = new Map(books.map((b) => [String(b._id), b.name]));
  const fallbackBook = books[0]?.name || 'PURCHASE';
  const coShort = company?.coCode || '';

  return purchases.map((p) => {
    const date = p.date ? new Date(p.date) : null;
    const { add, less } = addLessOf(p);
    const party = p.supplierId?.name || '';
    const items = Array.isArray(p.items) ? p.items : [];
    const toPcs = items.reduce((s, it) => s + Number(it.pcs || 0), 0);
    const toQty = items.reduce((s, it) => s + Number(it.mts || 0), 0);
    // SUB_TOT is the line total before the footer adjustments, so that
    // SUB_TOT + T_ADD - T_LESS lands on the taxable amount the bill was saved with.
    const subTot = round(Number(p.taxableAmount || 0) - add + less);

    return {
      CO_PATH: coShort,
      CO_SHORT: coShort,
      ENT_NO: String(p._id),
      CO_ENT_NO: `${p._id}${coShort}`,
      SRAL_NO: p.invoiceNo || '',
      NCBILL_NO: p.supplierInvoiceNo || '',
      BILL_DATE: date,
      BOOK: bookName.get(String(p.bookId)) || fallbackBook,
      REGISTER: bookName.get(String(p.bookId)) || fallbackBook,
      PARTY: party,
      BROKER: p.brokerId?.name || '',
      STATION: p.supplierId?.city || '',
      MAINGROUP: p.supplierId?.group || '',
      TRANSPORT: p.transport || '',
      DELIVERY: p.delivery || '',
      MONTH: date ? MONTHS[date.getUTCMonth()] : '',
      MONTH_NO: date ? date.getUTCMonth() + 1 : null,
      YEAR_NO: date ? date.getUTCFullYear() : null,

      TO_PCS: toPcs,
      TO_QTY: round(toQty),
      SUB_TOT: subTot,
      T_ADD: add,
      T_LESS: less,
      TAXABLE_AMT: round(Number(p.taxableAmount || 0)),
      GST_AMT: round(Number(p.gstAmount || 0)),
      NET_TOT: round(Number(p.netAmount || 0)),

      // Detail mode: one entry per item line of this bill.
      _lines: items.map((it) => ({
        ITEM_NAME: it.itemId?.name || it.desc || '',
        ITEM_GROUP: it.itemId?.group || '',
        IT_PCS: Number(it.pcs || 0),
        IT_QTY: round(Number(it.mts || 0)),
        IT_RATE: round(Number(it.rate || 0)),
        IT_AMOUNT: round(Number(it.amount || 0)),
        LOT_NO: it.lotNo || '',
      })),
    };
  });
}

module.exports = { loadPurchaseRegisterRows, addLessOf };
