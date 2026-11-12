'use strict';

/**
 * JSM Stock Profit, Stock Value, and Yarn Kgs Stock Reports:
 *   - Rpt_Sales_Pump_Profit (Reports › Sales › Sales Bill › Profit Register)
 *   - A_StockValueReport    (Reports › Inv Stock Ledger › Stock Value Reports)
 *   - A_ReportYarnStock     (Others Reports › Others Reports › YarnKgsStock)
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const src = require('../sources/billRegister');
const { loadMillIssueRows } = require('../sources/millIssue');
const { loadMillReceiptRows } = require('../sources/millReceipt');

async function computeItemMovements(companyId, p, deps = {}) {
  const Item = require('../../../models/Item');
  const [items, purchases, sales, slReturns, puReturns] = await Promise.all([
    deps.items || Item.find({ companyId }).select('name group category openingQty openingPcs openingRate openingValue purchaseRate salesRate mrp').lean(),
    deps.purchases || src.loadPurchaseRegisterRows(companyId),
    deps.sales || src.loadSalesRegisterRows(companyId),
    deps.slReturns || src.loadReturnRegisterRows(companyId, 'Sales'),
    deps.puReturns || src.loadReturnRegisterRows(companyId, 'Purchase'),
  ]);

  const byItem = new Map();
  const ensure = (name) => {
    const key = String(name || '').trim();
    if (!byItem.has(key)) {
      byItem.set(key, {
        ITEM: key,
        CATEGORY: '',
        OP_QTY: 0, OP_VAL: 0,
        PU_QTY: 0, PU_AMT: 0,
        SALE_QTY: 0, SALE_AMT: 0,
        SLR_QTY: 0, SLR_AMT: 0,
        PUR_QTY: 0, PUR_AMT: 0,
        LAST_PU_RATE: 0,
        _lastDate: null,
        _fallbackRate: 0,
      });
    }
    return byItem.get(key);
  };

  for (const it of items) {
    const rec = ensure(it.name);
    rec.CATEGORY = it.group || it.category || '';
    const opQty = Number(it.openingQty || it.openingPcs || 0);
    const opRate = Number(it.openingRate || it.purchaseRate || 0);
    rec.OP_QTY = round(opQty);
    rec.OP_VAL = round(it.openingValue || (opQty * opRate));
    rec._fallbackRate = Number(it.purchaseRate || it.salesRate || it.mrp || 0);
  }

  const acc = (bills, qtyF, amtF, trackLastPu) => {
    for (const b of bills) {
      const inWindow = (!p.from || new Date(b.BILL_DATE) >= new Date(p.from))
        && (!p.to || new Date(b.BILL_DATE) <= new Date(`${p.to}T23:59:59.999Z`));
      const beforeFrom = p.from && new Date(b.BILL_DATE) < new Date(p.from);
      for (const l of b._lines || []) {
        const rec = ensure(l.ITEM_NAME);
        if (!rec.CATEGORY && l.ITEM_GROUP) rec.CATEGORY = l.ITEM_GROUP;
        const q = Number(l.IT_QTY || l.IT_PCS || 0);
        const a = Number(l.IT_AMT || l.NET_AMT || 0);
        if (beforeFrom) {
          if (qtyF === 'PU_QTY') { rec.OP_QTY = round(rec.OP_QTY + q); rec.OP_VAL = round(rec.OP_VAL + a); }
          if (qtyF === 'SALE_QTY') { rec.OP_QTY = round(rec.OP_QTY - q); }
          if (qtyF === 'SLR_QTY') { rec.OP_QTY = round(rec.OP_QTY + q); }
          if (qtyF === 'PUR_QTY') { rec.OP_QTY = round(rec.OP_QTY - q); }
        }
        if (inWindow) {
          rec[qtyF] = round(rec[qtyF] + q);
          rec[amtF] = round(rec[amtF] + a);
          if (trackLastPu && q > 0 && (!rec._lastDate || new Date(b.BILL_DATE) >= new Date(rec._lastDate))) {
            rec._lastDate = b.BILL_DATE;
            rec.LAST_PU_RATE = round(a / q);
          }
        }
      }
    }
  };

  acc(purchases, 'PU_QTY', 'PU_AMT', true);
  acc(sales, 'SALE_QTY', 'SALE_AMT', false);
  acc(slReturns, 'SLR_QTY', 'SLR_AMT', false);
  acc(puReturns, 'PUR_QTY', 'PUR_AMT', false);

  return [...byItem.values()].filter((r) => r.ITEM);
}

const profitRegister = {
  async run(companyId, p = {}, deps = {}) {
    const items = await computeItemMovements(companyId, p, deps);
    const filtered = inList(items, 'ITEM', p.items);
    const rows = filtered.map((r) => {
      const clQty = round(r.OP_QTY + r.PU_QTY - r.PUR_QTY - r.SALE_QTY + r.SLR_QTY);
      const avgPu = (r.OP_QTY + r.PU_QTY) > 0 ? (r.OP_VAL + r.PU_AMT) / (r.OP_QTY + r.PU_QTY) : 0;
      const rate = r.LAST_PU_RATE || avgPu || r._fallbackRate || 0;
      const clVal = round(Math.max(0, clQty) * rate);
      const netSale = round(r.SALE_AMT - r.SLR_AMT);
      const netCost = round(r.OP_VAL + (r.PU_AMT - r.PUR_AMT) - clVal);
      const gp = round(netSale - netCost);
      return {
        ITEM: r.ITEM,
        OP_QTY: r.OP_QTY,
        OP_VAL: r.OP_VAL,
        PU_QTY: r.PU_QTY,
        PU_AMT: r.PU_AMT,
        SALE_QTY: r.SALE_QTY,
        SALE_AMT: r.SALE_AMT,
        CL_QTY: clQty,
        CL_RATE: round(rate),
        CL_VAL: clVal,
        GP_AMT: gp,
      };
    });

    return {
      rows: orderRows(rows, ['ITEM']),
      grid: {
        layout: 'RUNTIME_STOCK_PROFIT_GP',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: `Stock Gross Profit Report (${p.summary ? 'Summary' : 'Detail'})`,
        period: `From : ${p.fromText || p.from || ''}  To : ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  },

  async options(companyId) {
    const Item = require('../../../models/Item');
    const items = await Item.find({ companyId }).select('name').lean();
    return { items: items.map((i) => i.name).filter(Boolean).sort() };
  },
};

const stockValueReport = {
  async run(companyId, p = {}, deps = {}) {
    const items = await computeItemMovements(companyId, p, deps);
    const expDeduction = Number(p.totalExp ?? 0) || 0;
    const rows = items.map((r) => {
      const clQty = round(r.OP_QTY + r.PU_QTY - r.PUR_QTY - r.SALE_QTY + r.SLR_QTY);
      const avgPu = (r.OP_QTY + r.PU_QTY) > 0 ? (r.OP_VAL + r.PU_AMT) / (r.OP_QTY + r.PU_QTY) : 0;
      const rate = round(r.LAST_PU_RATE || avgPu || r._fallbackRate || 0);
      const clVal = round(clQty * rate);
      return {
        ITEM: r.ITEM,
        CATEGORY: r.CATEGORY,
        OP_QTY: r.OP_QTY,
        PU_QTY: r.PU_QTY,
        SALE_QTY: r.SALE_QTY,
        CL_QTY: clQty,
        RATE: rate,
        CL_VALUE: clVal,
      };
    });

    return {
      rows: orderRows(rows, ['ITEM']),
      grid: {
        layout: 'JSM_VW_STOCK_WITH_VALUE_REGISTER',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: 'Stock Value Report',
        period: `DATE : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
        notice: `Closing valued at Last Purchase / Avg / Opening rate${expDeduction ? ` (Form Exp entered: ${expDeduction.toFixed(2)})` : ''}. Crystal RPT formula not decompiled in SQL.`,
        pageWise: false,
      },
    };
  },

  async options() {
    return {};
  },
};

const yarnKgsStock = {
  async run(companyId, p = {}, deps = {}) {
    const [purchases, issues, receipts] = await Promise.all([
      deps.purchases || src.loadPurchaseRegisterRows(companyId),
      deps.issues || loadMillIssueRows(companyId),
      deps.receipts || loadMillReceiptRows(companyId),
    ]);

    const puFiltered = inDateRange(purchases, 'BILL_DATE', p.from, p.to);
    const issFiltered = inDateRange(issues, 'CHLN_DATE', p.from, p.to);
    const recFiltered = inDateRange(receipts, 'BILL_DATE', p.from, p.to);

    let shopPuKgs = 0;
    for (const b of puFiltered) {
      const isYarnBook = String(b.BOOK || '').toUpperCase().includes('YARN');
      for (const l of b._lines || []) {
        if (isYarnBook || String(l.ITEM_CATEGORY || '').toLowerCase() === 'yarn') {
          shopPuKgs = round(shopPuKgs + Number(l.IT_KGS || 0));
        }
      }
    }

    let totalIssKgs = 0;
    const byParty = new Map();
    const bump = (party, f, v) => {
      const k = String(party || '').trim();
      if (!k) return;
      if (!byParty.has(k)) byParty.set(k, { STOCK_AT: k, PU_KGS: 0, ISS_KGS: 0, REC_KGS: 0, BAL_KGS: 0 });
      byParty.get(k)[f] = round(byParty.get(k)[f] + Number(v || 0));
    };

    for (const r of issFiltered) {
      const kgs = Number(r.ISS_KGS || 0);
      totalIssKgs = round(totalIssKgs + kgs);
      bump(r.PARTY || r.MILL_NAME, 'ISS_KGS', kgs);
    }
    for (const r of recFiltered) {
      bump(r.PARTY || r.MILL_NAME, 'REC_KGS', Number(r.REC_KGS || 0));
    }

    const rows = [
      {
        STOCK_AT: 'YARN STOCK AT SHOP',
        PU_KGS: shopPuKgs,
        ISS_KGS: totalIssKgs,
        REC_KGS: 0,
        BAL_KGS: round(shopPuKgs - totalIssKgs),
      },
      ...([...byParty.values()].map((r) => ({ ...r, BAL_KGS: round(r.ISS_KGS - r.REC_KGS) }))),
    ];

    return {
      rows: orderRows(rows, ['STOCK_AT']),
      grid: {
        layout: 'RUNTIME_YARN_KGS_STOCK',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: 'Yarn Kgs Stock Report',
        period: `DATE : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  },

  async options() {
    return {};
  },
};

module.exports = { profitRegister, stockValueReport, yarnKgsStock };
