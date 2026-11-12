'use strict';

/**
 * JSM Old Misc Reports:
 *   - Rpt_Jsm_SalesPurchaseVat   (Others Reports > Old Reports > Old FinalReports > Book Printing)
 *   - ZOld_Rpt_Os_Sales          (Others Reports > Old Reports > Rec/Pay Register > Debitors.,)
 *   - Rpt_Account_List_Print_Old (Others Reports > Old Reports > List Printing OLD)
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');
const { loadOutstandingRows } = require('../sources/outstanding');

/** Rpt_Jsm_SalesPurchaseVat — Book Printing (Sales / Purchase / Journal Voucher). */
async function runBookPrinting(companyId, p = {}, deps = {}) {
  const mode = p.mode || 'Sales';
  const period = `PERIOD : ${p.fromText || p.from || ''} To ${p.toText || p.to || ''}`;

  if (mode === 'JvBook') {
    let entries = deps.jvEntries;
    if (!entries) {
      const AccountingEntry = require('../../../models/AccountingEntry');
      require('../../../models/LedgerMaster');
      entries = await AccountingEntry.find({ companyId, voucherType: 'Journal', status: { $ne: 'Cancelled' } })
        .populate('lines.ledgerId', 'name')
        .lean();
    }
    const rows = [];
    for (const e of inDateRange(entries, 'entryDate', p.from, p.to)) {
      const dr = (e.lines || []).find((l) => Number(l.debit || 0) > 0);
      const cr = (e.lines || []).find((l) => Number(l.credit || 0) > 0);
      rows.push({
        ENT_DATE: e.entryDate,
        ENT_NO: e.entryNo || String(e._id),
        AC_NAME1: dr?.ledgerId?.name || '',
        AC_NAME2: cr?.ledgerId?.name || '',
        AMOUNT: round(dr?.debit || cr?.credit || 0),
        REMARK_1: e.narration || '',
      });
    }
    return {
      rows: orderRows(inList(rows, 'AC_NAME1', p.books), ['ENT_DATE', 'ENT_NO']),
      grid: {
        layout: 'JSM_VW_BOOK_PRINT_JV',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: 'Journal Voucher Book Printing',
        period,
        pageWise: false,
      },
    };
  }

  const bills = mode === 'Purchase'
    ? (deps.purchases || await billSrc.loadPurchaseRegisterRows(companyId))
    : (deps.sales || await billSrc.loadSalesRegisterRows(companyId));

  let rows = inDateRange(bills, 'BILL_DATE', p.from, p.to);
  rows = inList(rows, 'BOOK', p.books);

  const mapped = rows.map((b) => ({
    JS_GROUP: b.BOOK || '',
    BILL_DATE: b.BILL_DATE,
    NCBILL_NO: b.NCBILL_NO || '',
    PARTY: b.PARTY || '',
    GST_NO: b.GSTIN_NO || '',
    TAXABLE_AMT: round(b.TAXABLE_AMT),
    VAT_PER: round(b.GST_RATE),
    VAT_AMT: round(Number(b.CGST_AMT || 0) + Number(b.SGST_AMT || 0)),
    CST_AMT: round(b.IGST_AMT),
    NET_TOT: round(b.NET_TOT),
  }));

  return {
    rows: orderRows(mapped, ['JS_GROUP', 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }]),
    grid: {
      layout: 'JSM_VW_BOOK_PRINT_SLPU',
      variant: 1,
      groupColumns: ['JS_GROUP'],
      groupDisplays: ['BOOK'],
      captions: {},
      title: `${mode} Book Printing`,
      period,
      pageWise: false,
    },
  };
}

/** ZOld_Rpt_Os_Sales — Classic Debitors O/s report matching ZOld_Rpt_Os_Sales groupings. */
async function runOldOsSales(companyId, p = {}, deps = {}) {
  let rows = deps.rows || await loadOutstandingRows(companyId, 'sales', {
    asOn: p.to,
    billDateFrom: p.from,
    billDateTo: p.to,
    recDateFrom: p.recFrom,
    recDateTo: p.recTo,
    status: p.withOnAc === 'X' ? 'All' : 'Pending',
    includeLastYear: p.withLastYear !== 'N',
  });
  rows = inList(rows, 'PARTY', p.parties);
  rows = inList(rows, 'BROKER', p.brokers);
  rows = inList(rows, 'STATION', p.stations);
  rows = inList(rows, 'MAINGROUP', p.mainGroups);
  const dueDays = Number(p.dueDays || 0) || 0;
  if (dueDays > 0) rows = rows.filter((r) => Number(r.OS_DAYS || 0) >= dueDays);

  const groupField = { 2: 'PARTY', 3: 'BROKER', 4: 'STATION', 5: 'MAINGROUP' }[Number(p.category || 1)] || null;
  const out = rows.map((r) => ({
    JS_GROUP: groupField ? (r[groupField] || '') : '',
    PARTY: r.PARTY || '',
    BROKER: r.BROKER || '',
    STATION: r.STATION || '',
    MAINGROUP: r.MAINGROUP || '',
    BOOK: r.BOOK || '',
    BILL_DATE: r.BILL_DATE,
    NCBILL_NO: r.NCBILL_NO || '',
    BILL_AMT: round(r.NET_TOT),
    ADJUST: round(r.ADJUST),
    SLR_AMT: round(r.GOODS_RTN || 0),
    TOT_BALANCE: round(r.TOT_BALANCE),
    OS_DAY: Number(r.OS_DAYS || 0),
  }));

  const titles = {
    1: 'Sales Outstanding Report',
    2: 'Party Wise Sales Outstanding Report',
    3: 'Broker Wise Sales Outstanding Report',
    4: 'City Wise Sales Outstanding Report',
    5: 'Main Group Wise Sales Outstanding Report',
  };

  return {
    rows: orderRows(out, [groupField ? 'JS_GROUP' : null, 'PARTY', 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }].filter(Boolean)),
    grid: {
      layout: 'JSM_VW_OS_SALES_OLD',
      variant: 1,
      groupColumns: groupField ? ['JS_GROUP'] : [],
      groupDisplays: groupField ? [groupField] : [],
      captions: {},
      title: titles[Number(p.category || 1)] || titles[1],
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: p.printout === 'Y',
    },
  };
}

/** Rpt_Account_List_Print_Old — Classic master list (Account / Item / Broker / Transport). */
async function runListPrintOld(companyId, p = {}, deps = {}) {
  const mode = Number(p.mode || 2); // 1=AcHead, 2=Account, 3=ItemGroup, 4=Item, 5=Broker, 6=Transport
  const isItem = mode === 3 || mode === 4;

  if (isItem) {
    let items = deps.items;
    if (!items) {
      const Item = require('../../../models/Item');
      require('../../../models/SubMaster');
      items = await Item.find({ companyId, isDeleted: { $ne: true } }).populate('itemGroupId', 'name').lean();
    }
    const rows = items.map((it) => ({
      GROUP_NAME: it.itemGroupId?.name || it.category || '',
      NAME: it.name || '',
      CODE: it.itemCode || '',
      UNIT: it.unit || 'MTRS',
      HSN_CODE: it.hsnCode || '',
      RATE: round(it.salesRate || it.purchaseRate || 0),
    }));
    const filt = mode === 3 ? inList(rows, 'GROUP_NAME', p.selected) : inList(rows, 'NAME', p.selected);
    return {
      rows: orderRows(filt, ['GROUP_NAME', 'NAME']),
      grid: {
        layout: 'JSM_VW_LIST_PRINT_OLD',
        variant: 1,
        groupColumns: mode === 3 ? ['GROUP_NAME'] : [],
        groupDisplays: mode === 3 ? ['ITEM GROUP'] : [],
        captions: {},
        title: 'Item List Print Report',
        period: `Print Format: ${p.printFormat || 'List'}`,
        pageWise: false,
      },
    };
  }

  let parties = deps.parties;
  if (!parties) {
    const Party = require('../../../models/Party');
    require('../../../models/AccountGroup');
    parties = await Party.find({ companyId, isDeleted: { $ne: true } })
      .populate('accountGroupId', 'name')
      .populate('brokerId', 'name')
      .lean();
  }
  const rows = parties.map((pt) => ({
    GROUP_NAME: mode === 5 ? (pt.brokerId?.name || '') : (mode === 6 ? (pt.transport || '') : (pt.accountGroupId?.name || pt.type || '')),
    NAME: pt.name || '',
    CITY: pt.city || pt.station || '',
    ADDRESS: [pt.address, pt.address2].filter(Boolean).join(', '),
    MOBILE: pt.mobile || pt.phone || '',
    GSTIN: pt.gstin || '',
  }));
  const groupCols = [1, 5, 6].includes(mode) ? ['GROUP_NAME'] : [];
  return {
    rows: orderRows(inList(rows, 'NAME', p.selected), ['GROUP_NAME', 'NAME']),
    grid: {
      layout: 'JSM_VW_LIST_PRINT_OLD',
      variant: 1,
      groupColumns: groupCols,
      groupDisplays: groupCols,
      captions: {},
      title: 'Account List Print Report',
      period: `Print Format: ${p.printFormat || 'List'}`,
      pageWise: false,
    },
  };
}

async function miscOptions(companyId) {
  const [sl, pu] = await Promise.all([billSrc.loadSalesRegisterRows(companyId), billSrc.loadPurchaseRegisterRows(companyId)]);
  const u = (xs, f) => [...new Set(xs.map((r) => r[f]).filter(Boolean))].sort();
  return {
    books: u([...sl, ...pu], 'BOOK'),
    parties: u(sl, 'PARTY'),
    brokers: u(sl, 'BROKER'),
    stations: u(sl, 'STATION'),
    mainGroups: u(sl, 'MAINGROUP'),
  };
}

module.exports = {
  bookPrint: { run: runBookPrinting, options: miscOptions },
  oldOsSales: { run: runOldOsSales, options: miscOptions },
  listPrintOld: { run: runListPrintOld, options: miscOptions },
};

