'use strict';

/**
 * JSM Old Stock Reports:
 *   - Rpt_Stock_Share              (Others Reports > Old Reports > Extra Reports > Share Stock)
 *   - Rpt_StockSizeWise            (Others Reports > Old Reports > Extra Reports > Stock(Old) Detail SizeWise)
 *   - Rpt_Stk_Grey_At_Shop_DateWise (Others Reports > Old Reports > Old Stock Reports > GreyAtShop-DateWise)
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');
const mrSrc = require('../sources/millReceipt');
const miSrc = require('../sources/millIssue');

async function loadItemsMeta(companyId) {
  const Item = require('../../../models/Item');
  require('../../../models/SubMaster');
  const items = await Item.find({ companyId, isDeleted: { $ne: true } })
    .populate('itemGroupId', 'name')
    .lean();
  const byId = new Map();
  const byName = new Map();
  for (const it of items) {
    const row = {
      id: String(it._id),
      ITEM_NAME: it.name || '',
      ITEM_CODE: it.itemCode || String(it._id),
      GRIT_NAME: it.itemGroupId?.name || it.category || 'GENERAL',
      PU_RATE: Number(it.purchaseRate || it.openingRate || 0),
      OP_QTY: Number(it.openingQty || it.openingStock || 0),
      OP_PCS: Number(it.openingPcs || 0),
      OP_VAL: Number(it.openingValue || (Number(it.openingQty || it.openingStock || 0) * Number(it.openingRate || 0))),
      CATEGORY: it.category || '',
      SIZE: it.size || '',
    };
    byId.set(row.id, row);
    byName.set(row.ITEM_NAME.toUpperCase(), row);
  }
  return { items: [...byId.values()], byName };
}

/** Rpt_Stock_Share — Opening + Purchase - Sales qty/val per item. */
async function runShareStock(companyId, p = {}, deps = {}) {
  const [meta, purchases, sales] = await Promise.all([
    deps.items ? { items: deps.items } : loadItemsMeta(companyId),
    deps.purchases || billSrc.loadPurchaseRegisterRows(companyId),
    deps.sales || billSrc.loadSalesRegisterRows(companyId),
  ]);

  const map = new Map();
  for (const it of meta.items) {
    map.set(it.ITEM_NAME, {
      ITEM_NAME: it.ITEM_NAME,
      GRIT_NAME: it.GRIT_NAME || '',
      PU_RATE: round(it.PU_RATE),
      OP_QTY: round(it.OP_QTY),
      PU_QTY: 0,
      SL_QTY: 0,
      OP_VAL: round(it.OP_VAL),
      PU_VAL: 0,
      SL_VAL: 0,
      BAL_QTY: 0,
      BAL_VAL: 0,
    });
  }
  const ensure = (name) => {
    if (!map.has(name)) {
      map.set(name, { ITEM_NAME: name, GRIT_NAME: '', PU_RATE: 0, OP_QTY: 0, PU_QTY: 0, SL_QTY: 0, OP_VAL: 0, PU_VAL: 0, SL_VAL: 0, BAL_QTY: 0, BAL_VAL: 0 });
    }
    return map.get(name);
  };

  for (const b of inDateRange(purchases, 'BILL_DATE', p.from, p.to)) {
    for (const l of b._lines || []) {
      const r = ensure(l.ITEM_NAME || '');
      r.PU_QTY = round(r.PU_QTY + Number(l.IT_QTY || 0));
      r.PU_VAL = round(r.PU_VAL + Number(l.IT_TAXABLE || 0));
    }
  }
  for (const b of inDateRange(sales, 'BILL_DATE', p.from, p.to)) {
    for (const l of b._lines || []) {
      const r = ensure(l.ITEM_NAME || '');
      r.SL_QTY = round(r.SL_QTY + Number(l.IT_QTY || 0));
      r.SL_VAL = round(r.SL_VAL + Number(l.IT_TAXABLE || 0));
    }
  }

  let rows = [...map.values()]
    .map((r) => ({
      ...r,
      BAL_QTY: round(r.OP_QTY + r.PU_QTY - r.SL_QTY),
      BAL_VAL: round(r.OP_VAL + r.PU_VAL - r.SL_VAL),
    }))
    .filter((r) => r.OP_QTY !== 0 || r.PU_QTY !== 0 || r.SL_QTY !== 0);

  rows = inList(rows, 'ITEM_NAME', p.items);
  rows = inList(rows, 'GRIT_NAME', p.categories);

  return {
    rows: orderRows(rows, ['GRIT_NAME', 'ITEM_NAME']),
    grid: {
      layout: 'JSM_VW_RUNTIME_ITEM_CAT_RPT',
      variant: 1,
      groupColumns: ['GRIT_NAME'],
      groupDisplays: ['GRIT_NAME'],
      captions: {},
      title: 'Item Stock / Opening Report (Share Stock)',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

/** Rpt_StockSizeWise — Item & SizeChart summary comparing Purchase vs Sales. */
async function runSizeWise(companyId, p = {}, deps = {}) {
  const [meta, purchases, sales] = await Promise.all([
    deps.items ? { byName: new Map(deps.items.map((x) => [x.ITEM_NAME.toUpperCase(), x])) } : loadItemsMeta(companyId),
    deps.purchases || billSrc.loadPurchaseRegisterRows(companyId),
    deps.sales || billSrc.loadSalesRegisterRows(companyId),
  ]);

  const acc = new Map();
  const bump = (item, size, pcs, qty, isPu) => {
    const itName = String(item || '').trim();
    const fallbackSize = meta.byName.get(itName.toUpperCase())?.SIZE || '';
    const sz = String(size || fallbackSize || 'STANDARD').trim();
    const k = `${itName}\u0001${sz}`;
    if (!acc.has(k)) acc.set(k, { REGISTER: 'SUMMARY', ITEM_NAME: itName, SIZECHART: sz, PU_QTY: 0, SL_QTY: 0, PU_PCS: 0, SL_PCS: 0 });
    const row = acc.get(k);
    if (isPu) { row.PU_PCS += Number(pcs || 0); row.PU_QTY = round(row.PU_QTY + Number(qty || 0)); }
    else { row.SL_PCS += Number(pcs || 0); row.SL_QTY = round(row.SL_QTY + Number(qty || 0)); }
  };

  for (const b of inDateRange(purchases, 'BILL_DATE', p.from, p.to)) {
    for (const l of b._lines || []) bump(l.ITEM_NAME, l.SIZE || l.REMARK_1 || l.CUT, l.IT_PCS, l.IT_QTY, true);
  }
  for (const b of inDateRange(sales, 'BILL_DATE', p.from, p.to)) {
    for (const l of b._lines || []) bump(l.ITEM_NAME, l.SIZE || l.REMARK_1 || l.CUT, l.IT_PCS, l.IT_QTY, false);
  }

  let rows = [...acc.values()].map((r) => ({
    ...r,
    CLS_QTY: round(r.PU_QTY - r.SL_QTY),
    CLS_PCS: r.PU_PCS - r.SL_PCS,
  }));
  rows = inList(rows, 'ITEM_NAME', p.items);
  const g1 = p.orderBy1 === 'Register' ? 'REGISTER' : (p.orderBy1 === 'Item' ? 'ITEM_NAME' : null);

  return {
    rows: orderRows(rows, ['ITEM_NAME', 'SIZECHART']),
    grid: {
      layout: 'JSM_VW_STOCK_SIZEWISE',
      variant: 1,
      groupColumns: g1 ? [g1] : [],
      groupDisplays: g1 ? [p.orderBy1] : [],
      captions: {},
      title: 'SizeWise Stock Report',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

/** Rpt_Stk_Grey_At_Shop_DateWise — date-wise grey item movement at shop. */
async function runGreyAtShopDateWise(companyId, p = {}, deps = {}) {
  const [meta, purchases, millIss, millRcp, sales, puRtn] = await Promise.all([
    deps.items ? { items: deps.items } : loadItemsMeta(companyId),
    deps.purchases || billSrc.loadPurchaseRegisterRows(companyId),
    deps.millIssue || miSrc.loadMillIssueRows(companyId, 'millIssue'),
    deps.millReceipt || mrSrc.loadMillReceiptRows(companyId),
    deps.sales || billSrc.loadSalesRegisterRows(companyId),
    deps.purchaseRtn || billSrc.loadReturnRegisterRows(companyId, 'Purchase'),
  ]);

  const greySet = new Set(meta.items.filter((i) => !i.CATEGORY || i.CATEGORY === 'Grey').map((i) => i.ITEM_NAME));
  const byKey = new Map();
  const ensure = (date, item, grit = '') => {
    const dt = date ? new Date(date).toISOString().slice(0, 10) : '';
    const k = `${dt}\u0001${item}`;
    if (!byKey.has(k)) {
      byKey.set(k, { BILL_DATE: dt, GRIT_NAME: grit, ITEM_NAME: item, OP_STOCK: 0, PURCHASE: 0, MILL_GR_RTN: 0, MILL_SEND: 0, GREY_SL: 0, PU_RTN_GRY: 0 });
    }
    return byKey.get(k);
  };

  for (const it of meta.items) {
    if (greySet.size && !greySet.has(it.ITEM_NAME)) continue;
    if (it.OP_QTY !== 0) ensure(p.from || new Date().toISOString().slice(0, 10), it.ITEM_NAME, it.GRIT_NAME).OP_STOCK = round(it.OP_QTY);
  }
  for (const b of inDateRange(purchases, 'BILL_DATE', p.from, p.to)) {
    for (const l of b._lines || []) {
      if (greySet.size && greySet.has(l.ITEM_NAME) === false) continue;
      ensure(b.BILL_DATE, l.ITEM_NAME).PURCHASE = round(ensure(b.BILL_DATE, l.ITEM_NAME).PURCHASE + Number(l.IT_QTY || 0));
    }
  }
  for (const m of inDateRange(millIss, 'CHLN_DATE', p.from, p.to)) {
    ensure(m.CHLN_DATE, m.ITEM).MILL_SEND = round(ensure(m.CHLN_DATE, m.ITEM).MILL_SEND + Number(m.ISS_QTY || 0));
  }
  for (const m of inDateRange(millRcp, 'BILL_DATE', p.from, p.to)) {
    for (const l of m._lines || []) {
      if (Number(l.GREY_RTN_QTY || 0)) ensure(m.BILL_DATE, l.ITEM_NAME).MILL_GR_RTN = round(ensure(m.BILL_DATE, l.ITEM_NAME).MILL_GR_RTN + Number(l.GREY_RTN_QTY || 0));
    }
  }
  for (const b of inDateRange(sales, 'BILL_DATE', p.from, p.to)) {
    for (const l of b._lines || []) {
      if (greySet.size && greySet.has(l.ITEM_NAME)) ensure(b.BILL_DATE, l.ITEM_NAME).GREY_SL = round(ensure(b.BILL_DATE, l.ITEM_NAME).GREY_SL + Number(l.IT_QTY || 0));
    }
  }
  for (const b of inDateRange(puRtn, 'BILL_DATE', p.from, p.to)) {
    for (const l of b._lines || []) {
      if (greySet.size && greySet.has(l.ITEM_NAME)) ensure(b.BILL_DATE, l.ITEM_NAME).PU_RTN_GRY = round(ensure(b.BILL_DATE, l.ITEM_NAME).PU_RTN_GRY + Number(l.IT_QTY || 0));
    }
  }

  let rows = [...byKey.values()].map((r) => ({
    ...r,
    BAL_QTY: round(r.OP_STOCK + r.PURCHASE + r.MILL_GR_RTN - r.MILL_SEND - r.GREY_SL - r.PU_RTN_GRY),
  }));
  rows = inList(rows, 'ITEM_NAME', p.items);
  rows = inList(rows, 'GRIT_NAME', p.categories);

  return {
    rows: orderRows(rows, ['ITEM_NAME', 'BILL_DATE']),
    grid: {
      layout: 'JSM_VW_GREY_STK_DATE',
      variant: 1,
      groupColumns: ['ITEM_NAME'],
      groupDisplays: ['ITEM_NAME'],
      captions: {},
      title: 'GREY IN SHOP STOCK REPORT (Date Wise)',
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const meta = await loadItemsMeta(companyId);
  return {
    items: [...new Set(meta.items.map((i) => i.ITEM_NAME))].sort(),
    categories: [...new Set(meta.items.map((i) => i.GRIT_NAME).filter(Boolean))].sort(),
  };
}

module.exports = {
  shareStock: { run: runShareStock, options },
  sizeWise: { run: runSizeWise, options },
  greyDateWise: { run: runGreyAtShopDateWise, options },
};
