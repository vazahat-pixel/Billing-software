'use strict';

/**
 * JSM: Others Reports › Master List › Account (Rpt_Account_ReportRpt) and
 *      Others Reports › Master List › Item (Rpt_Item_Mst_Report).
 *
 * The two master listings, on JSM's own views — JSM_VW_MASTER_ACCOUNT_REPORT and
 * JSM_VW_MASTER_ITEM_REPORT. Each screen's Order By names the column it lists by, and JSM titles
 * the window "<Order By> Wise Account Report" / "… Item Report" (Fill_String_For_Period).
 */
const { orderRows, inList, round } = require('../jcEngine');

/** JSM's Order By choices on the Account list -> the column each one sorts and heads by. */
const ACCOUNT_ORDER = {
  Account: 'ACCOUNT',
  AccountHead: 'ACCOUNTHEAD',
  Station: 'STATION',
  MainGroup: 'MAINGROUP',
  Broker: 'BROKER',
  Area: 'AREA_NAME',
};
const ITEM_ORDER = { Item: 'ITEM', Category: 'CATEGORY', Unit: 'UNIT' };

function orderOf(raw, table, fallback) {
  const name = String(raw ?? '').trim() || fallback;
  if (!(name in table)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: table[name] };
}

/** Parties and the ledgers that are not a party, as JSM's one account master lists them. */
async function accountRows(companyId) {
  const Party = require('../../../models/Party');
  const LedgerMaster = require('../../../models/LedgerMaster');
  const companyGroupService = require('../../companyGroupService');
  const masterCompanyId = await companyGroupService.masterId(companyId);

  const [parties, ledgers] = await Promise.all([
    Party.find({ companyId: masterCompanyId })
      .select('name group city state address1 address2 pincode gstin panNo mobile phone email brokerId msmeType msmeNo')
      .lean(),
    LedgerMaster.find({ companyId, isActive: true, linkedPartyId: { $in: [null, undefined] } })
      .select('name group accountType').lean(),
  ]);

  const rows = parties.map((p) => ({
    ACCOUNT: p.name || '',
    ACCOUNTHEAD: p.group || '',
    ADDRESS: [p.address1, p.address2].filter(Boolean).join(', '),
    PHONENO: p.mobile || p.phone || '',
    PINCODE: p.pincode || '',
    STATION: p.city || '',
    STATE: p.state || '',
    GSTIN_NO: p.gstin || '',
    PAN_NO: p.panNo || '',
    EMAIL: p.email || '',
    MAINGROUP: p.group || '',
    MSME_TYPE: p.msmeType || '',
    MSME_NO: p.msmeNo || '',
    BROKER: '',
    AREA_NAME: '',
    TRANSPORT: '',
  }));

  for (const l of ledgers) {
    rows.push({
      ACCOUNT: l.name || '',
      ACCOUNTHEAD: l.group || '',
      ADDRESS: '', PHONENO: '', PINCODE: '', STATION: '', STATE: '',
      GSTIN_NO: '', PAN_NO: '', EMAIL: '', MAINGROUP: l.group || '',
      MSME_TYPE: '', MSME_NO: '', BROKER: '', AREA_NAME: '', TRANSPORT: '',
    });
  }
  return rows;
}

async function itemRows(companyId) {
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId })
    .select('name group unit hsnCode gstRate salesRate purchaseRate openingQty openingPcs minLevel maxLevel')
    .lean();
  return items.map((i) => ({
    ITEM: i.name || '',
    ITEM_NAME: i.name || '',
    CATEGORY: i.group || '',
    UNIT: i.unit || '',
    HSN_CODE: i.hsnCode || '',
    TAX_RATE: round(Number(i.gstRate || 0)),
    SL_RATE: round(Number(i.salesRate || 0)),
    PU_RATE: round(Number(i.purchaseRate || 0)),
    OP_PCS: Number(i.openingPcs || 0),
    OP_QTY: round(Number(i.openingQty || 0)),
    MIN_LEVEL: Number(i.minLevel || 0),
    MAX_LEVEL: Number(i.maxLevel || 0),
  }));
}

function listReport({ load, table, fallback, view, noun }) {
  async function run(companyId, p = {}, deps = {}) {
    const by = orderOf(p.orderBy, table, fallback);
    let rows = deps.rows || await load(companyId);
    if (Array.isArray(p.accounts) && p.accounts.length) rows = inList(rows, 'ACCOUNT', p.accounts);
    if (Array.isArray(p.items) && p.items.length) rows = inList(rows, 'ITEM', p.items);

    return {
      rows: orderRows(rows, [by.field]),
      grid: {
        layout: view,
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: `${by.name} Wise ${noun} Report`,
        period: '',
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId, p = {}, deps = {}) {
    const rows = deps.rows || await load(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return { accounts: u('ACCOUNT'), items: u('ITEM'), heads: u('ACCOUNTHEAD'), categories: u('CATEGORY') };
  }

  return { run, options };
}

module.exports = {
  account: listReport({
    load: accountRows, table: ACCOUNT_ORDER, fallback: 'Account',
    view: 'JSM_VW_MASTER_ACCOUNT_REPORT', noun: 'Account',
  }),
  item: listReport({
    load: itemRows, table: ITEM_ORDER, fallback: 'Item',
    view: 'JSM_VW_MASTER_ITEM_REPORT', noun: 'Item',
  }),
};
