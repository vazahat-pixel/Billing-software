'use strict';

/**
 * JSM: Others Reports › Master List › Envelope / Label Printing
 * (Rpt_Account_List_Print, titled "List Print").
 *
 * The addresses to print on envelopes or on labels. JSM's screen holds two ticked lists — the
 * accounts and the items its Load fills from
 *
 *   vw_mst_ac_mast : co_path, ac_code, ac_name, add_1, add_2, st_name
 *   mst_it_mast    : item_name, item_code
 *
 * — a "No Of Copy" box, and the two buttons that pick the stationery: the envelope layout
 * (Cry_Envelope_…) or the label one (Btn_Label_Click: Custom, 4x3). The accounts it prints are
 * `{VW_MST_AC_MAST.AC_CODE} IN (…)` and the items `{VW_MST_IT_MAST.ITEM_CODE} IN (…)`
 * (GenerateNew_Reports), and it heads them "REPORT : Account List Print Report" or
 * "REPORT : Item List Print Report" — so which of its two lists is ticked is what decides which
 * of the two it prints, and that is how this reads it too.
 *
 * Each ticked name is printed as many times as the copy box asks for: one envelope or one label
 * per copy.
 */
const { orderRows, inList } = require('../jcEngine');

/** The accounts with their address, as JSM's own view selects them. */
async function loadAccounts(companyId) {
  const Party = require('../../../models/Party');
  const parties = await Party.find({ companyId })
    .select('name address address1 address2 city station state pincode mobile phone')
    .lean();
  return parties.map((x) => ({
    AC_NAME: x.name || '',
    ADD_1: x.address1 || x.address || '',
    ADD_2: x.address2 || '',
    ST_NAME: x.city || x.station || '',
    PIN_CODE: x.pincode || '',
    MOBILE: x.mobile || x.phone || '',
  }));
}

/** The items, which the same screen can print instead. */
async function loadItems(companyId) {
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name group unit salesRate').lean();
  return items.map((i) => ({
    AC_NAME: i.name || '',
    ADD_1: i.group || '',
    ADD_2: i.unit || '',
    ST_NAME: '',
    PIN_CODE: '',
    MOBILE: '',
    IT_RATE: Number(i.salesRate || 0),
  }));
}

async function run(companyId, p = {}, deps = {}) {
  const copies = Math.max(1, Math.min(99, Number(p.copies ?? 1) || 1));
  const wantsItems = !((p.accounts || []).length) && (p.items || []).length > 0;

  const rows = deps.rows || (wantsItems ? await loadItems(companyId) : await loadAccounts(companyId));
  const picked = inList(rows, 'AC_NAME', wantsItems ? p.items : p.accounts);
  const ordered = orderRows(picked, ['AC_NAME']);

  const out = [];
  for (const r of ordered) for (let i = 0; i < copies; i += 1) out.push({ ...r, COPY_NO: i + 1 });

  return {
    rows: out,
    grid: {
      layout: 'JSM_VW_LIST_PRINT',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: wantsItems ? { AC_NAME: 'ITEM', ADD_1: 'CATEGORY', ADD_2: 'UNIT' } : {},
      title: `REPORT : ${wantsItems ? 'Item' : 'Account'} List Print Report`,
      period: `${p.label ? 'LABEL' : 'ENVELOPE'}   No Of Copy : ${copies}`,
      pageWise: true,
    },
  };
}

async function options(companyId) {
  const [accounts, items] = await Promise.all([loadAccounts(companyId), loadItems(companyId)]);
  const u = (rows) => [...new Set(rows.map((r) => r.AC_NAME).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { accounts: u(accounts), items: u(items) };
}

module.exports = { run, options };
