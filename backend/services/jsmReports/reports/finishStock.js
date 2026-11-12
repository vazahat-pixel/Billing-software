'use strict';

/**
 * JSM: Reports › Inv Stock Ledger › Finish Stock Excel
 * (Rpt_FinishStockReport, titled "Finish Stock Report").
 *
 * The finish side of the stock, book by book. JSM reads JSM_VW_STOCK_DETAIL_FINISH_REPORT, filters
 * it with `(A.BILLDATE >='…' AND A.BILLDATE <='…')` for the period and `A.BILLDATE <'…'` for the
 * opening (Fill_String_For_Condition), and gathers it on Item, Category, DateWise, Item+Date or
 * None. Its columns are the ones Js_Add_NewColumn_Function names:
 *
 *   ITEM, CATEGORY, ENT.DATE, OPENING, PURCHASE, PROCESS, RF.ISSUE, PROCESS.RF, SALES,
 *   SL.RETURN, PU.RETURN, JOB.ISSUE, JOB.REC., CLOSING
 *
 * Every figure is the quantity the book itself recorded, read from the same sources the registers
 * read: purchases and sales from the bill registers, PROCESS from the mill receipts, JOB.ISSUE and
 * JOB.REC. from the job ones. The opening is the item master's own figure plus everything that
 * moved before the period, which is how JSM's second condition builds it.
 *
 * RF.ISSUE and PROCESS.RF stay at zero: re-finishing — sending finished goods back out to be
 * processed again — is a flow this software does not record, so there is nothing to put there.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');
const src = require('../sources/billRegister');
const { loadMillIssueRows } = require('../sources/millIssue');
const { loadMillReceiptRows } = require('../sources/millReceipt');

/** The Order By choices and the columns each one gathers on. */
const GROUPS = {
  None: ['ITEMNAME'],
  Item: ['ITEMNAME'],
  Category: ['CATEGORY', 'ITEMNAME'],
  DateWise: ['ENTDATE'],
  'Item+Date': ['ITEMNAME', 'ENTDATE'],
};

const IN = ['OP_QTY', 'FNS_PU_QTY', 'ML_REC_QTY', 'FNS_SLR_QTY', 'JB_REC_QTY'];
const OUT = ['FNS_SL_QTY', 'FNS_PUR_QTY', 'JB_ISS_QTY', 'ML_RF_QTY'];
const SUM = [...IN, ...OUT, 'ML_RECRF_QTY'];

const blank = () => Object.fromEntries(SUM.map((f) => [f, 0]));

/** A finish item is one that is not grey — the category the grey/finish flag records. */
const isFinish = (category) => String(category || '').toLowerCase() !== 'grey';

function fieldsOf(choice) {
  const name = String(choice ?? '').trim() || 'None';
  if (!(name in GROUPS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, keys: GROUPS[name] };
}

/** Every quantity that moved, one row per bill line, in the view's own column names. */
async function movementRows(companyId, p) {
  const [purchases, sales, salesRtn, purchaseRtn, millRec, jobIss, jobRec] = await Promise.all([
    src.loadPurchaseRegisterRows(companyId),
    src.loadSalesRegisterRows(companyId),
    src.loadReturnRegisterRows(companyId, 'Sales'),
    src.loadReturnRegisterRows(companyId, 'Purchase'),
    loadMillReceiptRows(companyId, 'millRec'),
    loadMillIssueRows(companyId, 'jobIssue'),
    loadMillReceiptRows(companyId, 'jobRec'),
  ]);

  const rows = [];
  const fromBills = (bills, field) => {
    for (const b of bills) {
      for (const l of b._lines || []) {
        if (!isFinish(l.ITEM_CATEGORY)) continue;
        rows.push({
          ITEMNAME: l.ITEM_NAME || '',
          CATEGORY: l.ITEM_CATEGORY || l.ITEM_GROUP || '',
          ENTDATE: b.BILL_DATE,
          ...blank(),
          [field]: round(Number(l.IT_QTY || 0)),
        });
      }
    }
  };
  fromBills(purchases, 'FNS_PU_QTY');
  fromBills(sales, 'FNS_SL_QTY');
  fromBills(salesRtn, 'FNS_SLR_QTY');
  fromBills(purchaseRtn, 'FNS_PUR_QTY');

  const fromJobs = (jobs, field, itemField, qtyField, dateField) => {
    for (const j of jobs) {
      rows.push({
        ITEMNAME: j[itemField] || '',
        CATEGORY: '',
        ENTDATE: j[dateField],
        ...blank(),
        [field]: round(Number(j[qtyField] || 0)),
      });
    }
  };
  fromJobs(millRec, 'ML_REC_QTY', 'RECITEM', 'REC_QTY', 'BILL_DATE');
  fromJobs(jobIss, 'JB_ISS_QTY', 'ITEM', 'ISS_QTY', 'CHLN_DATE');
  fromJobs(jobRec, 'JB_REC_QTY', 'RECITEM', 'REC_QTY', 'BILL_DATE');

  // The item master's own opening, dated at the start of the period as JSM's opening union is.
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name group category openingQty').lean();
  for (const i of items) {
    if (!isFinish(i.category || i.group)) continue;
    const opening = round(Number(i.openingQty || 0));
    if (!opening) continue;
    rows.push({
      ITEMNAME: i.name || '',
      CATEGORY: i.category || i.group || '',
      ENTDATE: p.from ? new Date(p.from) : null,
      ...blank(),
      OP_QTY: opening,
    });
  }

  return rows;
}

async function run(companyId, p = {}, deps = {}) {
  const by = fieldsOf(p.orderBy1);
  const all = deps.rows || await movementRows(companyId, p);

  // What moved before the period joins the opening; what moved inside it stays in its own column.
  const before = p.from ? all.filter((r) => r.ENTDATE && new Date(r.ENTDATE) < new Date(p.from)) : [];
  const within = inDateRange(all, 'ENTDATE', p.from, p.to);

  const openingOf = new Map();
  for (const r of before) {
    const key = r.ITEMNAME;
    const moved = IN.reduce((t, f) => t + Number(r[f] || 0), 0)
      - OUT.reduce((t, f) => t + Number(r[f] || 0), 0);
    openingOf.set(key, round((openingOf.get(key) || 0) + moved));
  }

  let rows = within;
  for (const [item, opening] of openingOf) {
    if (!opening) continue;
    rows = [...rows, {
      ITEMNAME: item,
      CATEGORY: '',
      ENTDATE: p.from ? new Date(p.from) : null,
      ...blank(),
      OP_QTY: opening,
    }];
  }

  rows = inList(rows, 'ITEMNAME', p.items);
  rows = inList(rows, 'CATEGORY', p.categories);

  const grouped = groupBy(rows, by.keys, { sum: SUM }, (first) => ({
    CATEGORY: first.CATEGORY,
    ENTDATE: first.ENTDATE,
    ITEMNAME: first.ITEMNAME,
  }));

  const out = grouped.map((g) => {
    for (const f of SUM) g[f] = round(g[f]);
    return {
      ...g,
      CL_QTY: round(IN.reduce((t, f) => t + g[f], 0) - OUT.reduce((t, f) => t + g[f], 0)),
    };
  });

  return {
    rows: orderRows(out, by.keys),
    grid: {
      layout: 'JSM_VW_STOCK_DETAIL_FINISH_REPORT',
      variant: 1,
      groupColumns: by.name === 'Category' ? ['CATEGORY'] : [],
      groupDisplays: by.name === 'Category' ? ['CATEGORY'] : [],
      captions: {},
      title: `${by.name} Wise Finish Stock Report`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId) {
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name group category').lean();
  const finish = items.filter((i) => isFinish(i.category || i.group));
  const u = (vals) => [...new Set(vals.filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return {
    items: u(finish.map((i) => i.name)),
    categories: u(finish.map((i) => i.category || i.group)),
  };
}

module.exports = { run, options };
