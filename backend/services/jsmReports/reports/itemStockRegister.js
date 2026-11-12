'use strict';

/**
 * JSM: Others Reports › Zoom Item Ledger (Zoom_SelectDate_List_Item), on its
 * JSM_VW_STOCK_WITH_VALUE_REGISTER layout.
 *
 * One line per item: what was there, what came in, what went out, what is left and what that is
 * worth. JSM's own SELECT (Button1_Click) is
 *
 *   ITEM_NAME, ISNULL(Z_OP.OP_PCS,0) OP_QTY, ISNULL(Z_PU.PU_PCS,0) PU_QTY,
 *   ISNULL(Z_SL.SL_PCS,0) SL_QTY,
 *   (OP_PCS + PU_PCS + SL_PCS) CL_QTY, (… * UNQ_RT) CL_VALUE, GRIT_NAME CATEGORY
 *
 * — its sales pieces come out of the FIFO view already negative, which is why its closing adds
 * all three. Here the sold pieces are counted as they are read, positive, and subtracted.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const src = require('../sources/billRegister');

async function run(companyId, p = {}, deps = {}) {
  const Item = require('../../../models/Item');
  const [items, purchases, sales] = await Promise.all([
    deps.items || Item.find({ companyId }).select('name group openingPcs purchaseRate salesRate').lean(),
    deps.purchases || src.loadPurchaseRegisterRows(companyId),
    deps.sales || src.loadSalesRegisterRows(companyId),
  ]);

  const pcsByItem = (bills) => {
    const m = new Map();
    for (const b of inDateRange(bills, 'BILL_DATE', p.from, p.to)) {
      for (const l of b._lines || []) {
        const k = l.ITEM_NAME || '';
        m.set(k, (m.get(k) || 0) + Number(l.IT_PCS || 0));
      }
    }
    return m;
  };
  const pu = pcsByItem(purchases);
  const sl = pcsByItem(sales);

  const rows = items.map((i) => {
    const OP_QTY = Number(i.openingPcs || 0);
    const PU_QTY = pu.get(i.name) || 0;
    const SL_QTY = sl.get(i.name) || 0;
    const CL_QTY = OP_QTY + PU_QTY - SL_QTY;
    const rate = Number(i.purchaseRate || i.salesRate || 0);
    return {
      ITEM: i.name || '',
      CATEGORY: i.group || '',
      OP_QTY: round(OP_QTY),
      PU_QTY: round(PU_QTY),
      SL_QTY: round(SL_QTY),
      CL_QTY: round(CL_QTY),
      CL_VALUE: round(CL_QTY * rate),
    };
  });

  return {
    rows: orderRows(inList(rows, 'ITEM', p.items), ['ITEM']),
    grid: {
      layout: 'JSM_VW_STOCK_WITH_VALUE_REGISTER',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Stock With Value Register',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name').lean();
  return { items: items.map((i) => i.name).filter(Boolean).sort((a, b) => a.localeCompare(b)) };
}

module.exports = { run, options };
