'use strict';

/**
 * JSM tables (as exported in a migration package) -> MERN documents. Pure: no database access.
 * buildPlan(tables, { companyId }) returns { docs: {Model: [doc]}, keys: {Model: {sourceKey: _id}}, expected, warnings, counts }.
 *
 *  - ledgers / trial balance: AccountingEntry lines are JSM's own posted ledger (T_TRANDATA), so balances match by construction
 *  - documents (sales, purchase, mill, job, vouchers, notes, returns, opening bills) keep JSM amounts as they are
 *  - stock lots/movements are rebuilt in date order from purchases, openings, issues, receipts and sales
 *  - stored JSM totals (CL_BAL, REC/BAL/PENDING, OUT_AMT) are never used
 */

const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();
const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const str = (v) => String(v ?? '').trim();
const date = (v) => {
  const s = str(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || m[1] < '1950') return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
};
const iso = (d) => (d ? d.toISOString().slice(0, 10) : '');

/** Keeps a number exactly as JSM printed it; on a clash adds a suffix so the unique index holds. */
function uniqueNo(base, taken, suffixes) {
  const first = str(base);
  const tryKey = (v) => { if (v && !taken.has(v)) { taken.add(v); return true; } return false; };
  if (tryKey(first)) return first;
  taken.renamed = (taken.renamed || 0) + 1; // the number was already used (another year or book): a suffix keeps it unique
  for (const s of suffixes) { const v = `${first}/${s}`; if (tryKey(v)) return v; }
  let i = 2; while (!tryKey(`${first}/${i}`)) i += 1;
  return `${first}/${i}`;
}

function buildPlan(tables, { companyId }) {
  const T = (n) => tables[n] || [];
  const warnings = [];
  const warn = (m) => { if (warnings.length < 500) warnings.push(m); };
  const blockers = []; // problems that make the import unsafe (shown in preview, refuse apply)
  const docs = { Party: [], LedgerMaster: [], Item: [], Sales: [], Purchase: [], Job: [], InventoryLot: [], StockMovement: [],
    PaymentVoucher: [], DebitCreditNote: [], ReturnInvoice: [], BillSettlement: [], AccountingEntry: [], SubMaster: [], Warehouse: [] };
  const keys = {}; Object.keys(docs).forEach((k) => { keys[k] = {}; });

  // ---- company-years, oldest first -------------------------------------------------------------------
  const years = T('J_COMPANY').map((c) => ({ path: str(c.CO_PATH), name: str(c.CO_NAME), from: date(c.CO_FR_DATE), to: date(c.CO_TO_DATE) }))
    .filter((c) => c.path).sort((a, b) => (a.from || 0) - (b.from || 0));
  const yearIdx = new Map(years.map((y, i) => [y.path, i]));
  const wanted = new Set(years.map((y) => y.path));
  const rowsOf = (n) => T(n).filter((r) => wanted.has(str(r.CO_PATH)));
  const byYear = (rows) => [...rows].sort((a, b) => (yearIdx.get(str(a.CO_PATH)) - yearIdx.get(str(b.CO_PATH))) || (num(a.ENT_NO) - num(b.ENT_NO)));

  // ---- account groups --------------------------------------------------------------------------------
  const grp = new Map(T('MST_ACG_MAST').map((g) => [str(g.GRAC_CODE), g]));
  const headChain = (code) => { const out = []; let g = grp.get(str(code)); let guard = 0; while (g && guard++ < 8) { out.push(g); g = grp.get(str(g.PRIMARY_CD)); } return out; };
  const groupInfo = (code) => {
    const chain = headChain(code);
    const heads = chain.map((g) => str(g.GRAC_HEAD).toUpperCase()).filter(Boolean).join(' > ');
    const type = chain.map((g) => str(g.GRAC_TYPE).toUpperCase()).find(Boolean) || '';
    let kind = 'ledger';
    let acct = 'General';
    if (/DEBTOR/.test(heads)) kind = 'Customer';
    else if (/PROCESS|JOB ?WORK/.test(heads)) kind = 'Job Worker';
    else if (/BROKER|COMMISSION AGENT/.test(heads) && !/EXPENS|INCOME/.test(heads)) kind = 'Broker';
    else if (/CREDITOR/.test(heads)) kind = 'Supplier';
    if (/CASH/.test(heads)) acct = 'Cash'; else if (/BANK/.test(heads) && kind === 'ledger') acct = 'Bank';
    else if (/DUT(Y|IES)|TAX|GST/.test(heads) && kind === 'ledger') acct = 'Tax';
    const group = /CAPITAL/.test(heads) ? 'Capital' : type.startsWith('ASSET') ? 'Assets' : type.startsWith('LIAB') ? 'Liabilities' : type.startsWith('INC') ? 'Income' : type.startsWith('EXP') ? 'Expenses' : 'Assets';
    return { kind, acct, group, heads: chain.map((g) => str(g.GRAC_HEAD)).filter(Boolean).join(' > ') };
  };

  // ---- accounts (parties / ledgers / books); one per AC_CODE across all years --------------------------
  const acc = new Map(); // code -> { row, firstYearRow, info, ledgerId, partyId, isBook }
  for (const r of byYear(rowsOf('MST_AC_MAST'))) {
    const code = str(r.AC_CODE);
    if (!code || code === '0') continue;
    if (!acc.has(code)) acc.set(code, { row: r, first: r, info: groupInfo(r.GRAC_CODE), isBook: num(r.BOOK_CD) > 0 });
    else if (str(acc.get(code).first.AC_NAME).toUpperCase() !== str(r.AC_NAME).toUpperCase()) {
      blockers.push(`Account code ${code} is "${str(acc.get(code).first.AC_NAME)}" in ${str(acc.get(code).first.CO_PATH)} but "${str(r.AC_NAME)}" in ${str(r.CO_PATH)}: these are not years of one company. Choose only the years of one company.`);
    }
  }
  const itemRowsFirst = new Map();
  for (const r of byYear(rowsOf('MST_IT_MAST'))) { const c = str(r.ITEM_CODE); if (c && c !== '0' && !itemRowsFirst.has(c)) itemRowsFirst.set(c, r); }

  const ledgerNames = new Set(); const partyNames = new Set();
  const unique = (name, set) => { let n = name; let i = 2; while (set.has(n.toLowerCase())) { n = `${name} (${i})`; i += 1; } set.add(n.toLowerCase()); return n; };

  // JSM keeps a party's city, transport, broker and bank as codes into its masters
  const byPathCode = (table, codeField) => { const m = new Map(); for (const r of T(table)) { const c = str(r[codeField]); if (!c || c === '0') continue; m.set(`${str(r.CO_PATH)}|${c}`, r); if (!m.has(`*|${c}`)) m.set(`*|${c}`, r); } return (path, c) => m.get(`${path}|${str(c)}`) || m.get(`*|${str(c)}`) || null; };
  const stationOf = byPathCode('MST_STATION', 'ST_CODE');
  const transportOf = byPathCode('MST_TR_PORT', 'TRNS_CODE');
  const drawBankOf = byPathCode('MST_DRAW_BANK', 'MST_CODE');
  const MSME = ['Micro', 'Small', 'Medium', 'Manufacturing- Micro', 'Manufacturing- Small', 'Manufacturing- Medium', 'Services- Micro', 'Services- Small', 'Services- Medium', 'Traders- Micro', 'Traders- Small', 'Traders- Medium'];
  const msmeOf = (v) => MSME.find((m) => m.toLowerCase().replace(/[^a-z]/g, '') === str(v).toLowerCase().replace(/[^a-z]/g, '')) || 'None';
  const partyBroker = new Map(); // party _id -> JSM broker account code (linked once every party exists)
  const makeParty = (code, a, forcedKind) => {
    const r = a.first;
    const kind = forcedKind || a.info.kind;
    const sideDr = str(r.OP_DRCR).toUpperCase() !== 'CR';
    const gstin = str(r.NW_GST_NO || r.GST_NO).toUpperCase();
    const p = {
      _id: oid(), companyId, name: unique(str(r.AC_NAME) || `ACCOUNT ${code}`, partyNames), type: kind === 'Broker' ? 'Broker' : kind,
      group: str(a.info.heads).toUpperCase().slice(0, 80), accd: num(code), gstin: /^[0-9A-Z]{15}$/.test(gstin) ? gstin : '',
      pan: str(r.PAN_NO).toUpperCase(), mobile: str(r.MOBILE), email: str(r.EMAIL), address: str(r.ADD_1), address2: str(r.ADD_2), address3: str(r.ADD_3),
      city: str(r.DIST) || '', state: str(r.STATE), stateCode: num(r.STATE_CODE) ? String(num(r.STATE_CODE)).padStart(2, '0') : '',
      phoneO: str(r.PHONE_O), phoneR: str(r.PHONE_R), contactPerson: str(r.CONTACT_PERSON), alias: str(r.AC_ALIAS),
      dueDays: num(r.DUE_DAYS), tdsPer: num(r.TDS_PER), tcsPer: num(r.TCS_PER), intPer: num(r.INT_PER), commi: num(r.BRK_COMMI),
      openingBalance: Math.abs(num(r.OP_BAL)), openingBalanceType: sideDr ? 'Dr' : 'Cr', status: str(r.AC_STATUS) === 'Inactive' ? 'Inactive' : 'Active',
      hsnCode: str(r.HSN_CODE), udyamAadhar: str(r.MSME_NO),
      pincode: '', transport: '', brokerId: '', msmeType: msmeOf(r.MSME_TYPE),
      factoryAddress1: str(r.FADD_1), factoryAddress2: str(r.FADD_2), factoryCity: str(r.FST_NAME), factoryMobile: str(r.FMOBILE),
      banks: [[r.AC_BANK_1, r.AC_NO_1], [r.AC_BANK_2, r.AC_NO_2]].filter(([b, n]) => str(b) && str(b) !== '0' || str(n)).map(([b, n]) => ({ name: str(drawBankOf(str(r.CO_PATH), b)?.MST_NAME) || (/^\d+$/.test(str(b)) ? '' : str(b)), accountNo: str(n), ifsc: '' })),
    };
    if (p.openingBalanceType !== 'Dr' && p.openingBalanceType !== 'Cr') p.openingBalanceType = 'Dr';
    const st = num(r.ST_CODE) ? stationOf(str(r.CO_PATH), r.ST_CODE) : null;
    if (st) { p.city = str(st.ST_NAME) || p.city; p.pincode = str(st.PIN_CODE); if (!p.state) p.state = str(st.STATE); }
    const tr = num(r.TRNS_CODE) ? transportOf(str(r.CO_PATH), r.TRNS_CODE) : null;
    if (tr) p.transport = str(tr.TRNS_NAME);
    if (num(r.BR_CODE)) partyBroker.set(String(p._id), str(r.BR_CODE));
    return p;
  };

  // One GSTIN = one party here (GSTIN is unique per company). JSM may have two accounts with the same GSTIN:
  // their bills go under one party (GSTR-1 keeps the GSTIN), and each account keeps its own ledger and balance.
  const partyByGstin = new Map();
  const addParty = (code, a, kind) => {
    const p = makeParty(code, a, kind);
    const same = p.gstin && partyByGstin.get(p.gstin);
    if (same) {
      warn(`Account "${str(a.first.AC_NAME)}" has the same GSTIN ${p.gstin} as "${same.name}": its bills are under "${same.name}"; it keeps its own ledger and balance`);
      return same;
    }
    if (p.gstin) partyByGstin.set(p.gstin, p);
    docs.Party.push(p);
    return p;
  };

  for (const [code, a] of acc) {
    const r = a.first;
    const sideDr = str(r.OP_DRCR).toUpperCase() !== 'CR';
    let party = null;
    if (!a.isBook && ['Customer', 'Supplier', 'Job Worker', 'Broker'].includes(a.info.kind)) {
      party = addParty(code, a);
      keys.Party[`AC:${code}`] = party._id; a.partyId = party._id;
    }
    const ledger = {
      _id: oid(), companyId, name: unique(str(r.AC_NAME) || `ACCOUNT ${code}`, ledgerNames), code: String(code),
      group: a.info.group, subGroup: a.info.heads.slice(0, 80), nature: ['Assets', 'Expenses'].includes(a.info.group) ? 'Dr' : 'Cr',
      openingBalance: Math.abs(num(r.OP_BAL)), openingBalanceType: sideDr ? 'Dr' : 'Cr',
      accountType: party ? 'Party' : (a.isBook && /CASH|BANK/i.test(a.info.heads + str(r.AC_NAME)) ? (/BANK/i.test(a.info.heads + str(r.AC_NAME)) ? 'Bank' : 'Cash') : a.info.acct),
      linkedPartyId: party ? party._id : null, isActive: true, allowManualEntry: true, isSystemLedger: false,
    };
    docs.LedgerMaster.push(ledger); keys.LedgerMaster[`AC:${code}`] = ledger._id; a.ledgerId = ledger._id; a.ledgerName = ledger.name;
  }

  /** Account used on a bill/voucher but classified as a plain ledger: make it a party so the bill has someone to belong to. */
  const partyFor = (code, kind, where) => {
    const c = str(code);
    const a = acc.get(c);
    if (!a) { warn(`${where}: account ${c} not found`); return null; }
    if (!a.partyId) {
      const p = addParty(c, a, kind);
      keys.Party[`AC:${c}`] = p._id; a.partyId = p._id;
      const led = docs.LedgerMaster.find((l) => l._id.equals(a.ledgerId));
      // a bank / cash account (a JSM book, or one under a bank / cash head) stays a Bank / Cash ledger
      const money = a.isBook || /BANK BALANCE|CASH[- ]?IN[- ]?HAND|BANK O\.?D/i.test(a.info.heads);
      if (led && !money) { led.accountType = 'Party'; led.linkedPartyId = p._id; }
      warn(`${where}: account "${a.row.AC_NAME}" is not in a debtor/creditor group; created as ${kind}`);
    }
    return a;
  };
  const ledgerOf = (code) => acc.get(str(code))?.ledgerId || null;
  const accName = (code) => str(acc.get(str(code))?.row?.AC_NAME);

  // ---- items ---------------------------------------------------------------------------------------------
  const units = new Map(T('MST_UNIT').map((u) => [`${str(u.CO_PATH)}|${str(u.UNIT_CODE)}`, str(u.UNIT_NAME).toUpperCase()]));
  const unitName = (path, code) => units.get(`${path}|${str(code)}`) || '';
  const slabs = new Map(T('MST_IT_TAX_SLAB').map((s) => [str(s.SLAB_NAME).toUpperCase(), s]));
  const itemGroups = new Map(T('MST_ITG_MAST').map((g) => [`${str(g.CO_PATH)}|${str(g.GRIT_CODE)}`, str(g.GRIT_NAME).toUpperCase()]));
  const itemNames = new Set();
  const itemOf = new Map(); // code -> { doc, row }
  const gstFromSlab = (name) => {
    const s = slabs.get(str(name).toUpperCase());
    if (s) { const igst = num(s.IGST); return igst || num(s.SGST) + num(s.CGST); }
    const m = str(name).match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : 0;
  };
  for (const [code, r] of itemRowsFirst) {
    const path = str(r.CO_PATH);
    const grey = /GR[AE]Y/.test(itemGroups.get(`${path}|${str(r.GRIT_CODE)}`) || '') || num(r.GRIT_CODE) === 1;
    const u = unitName(path, r.UNIT_CODE);
    const openQty = num(r.OP_QTY) + num(r.G_OP_QTY);
    const doc = {
      _id: oid(), companyId, name: unique(str(r.ITEM_NAME) || `ITEM ${code}`, itemNames), itemCode: str(r.CHR_CODE),
      category: grey ? 'Grey' : 'Finished', categoryLabel: itemGroups.get(`${path}|${str(r.GRIT_CODE)}`) || '',
      hsnCode: str(r.HSN_CODE).replace(/\D/g, ''), gstRate: gstFromSlab(r.GST_PER), gstTaxLabel: str(r.GST_PER),
      unit: /PCS|PIECE/.test(u) ? 'PCS' : /KG/.test(u) ? 'KGS' : 'MTRS', purchaseRate: num(r.PU_RATE), salesRate: num(r.SL_RATE), mrp: num(r.MRP),
      openingStock: openQty, openingQty: openQty, openingPcs: num(r.OP_PCS) + num(r.G_OP_PCS), openingRate: num(r.OP_RATE) || num(r.G_OP_RATE),
      openingValue: r2(openQty * (num(r.OP_RATE) || num(r.G_OP_RATE))), cut: num(r.CUT), fold: num(r.FOLD),
    };
    docs.Item.push(doc); keys.Item[`IT:${code}`] = doc._id; itemOf.set(code, { doc, row: r });
  }
  const itemFor = (code, path, where) => {
    const c = str(code);
    let it = itemOf.get(c);
    if (!it && c && c !== '0') {
      const doc = { _id: oid(), companyId, name: unique(`ITEM ${c}`, itemNames), category: 'Finished', gstRate: 0, unit: 'MTRS' };
      docs.Item.push(doc); keys.Item[`IT:${c}`] = doc._id; it = { doc, row: {} }; itemOf.set(c, it);
      warn(`${where}: item ${c} not in the item master; created as ITEM ${c}`);
    }
    return it ? it.doc : null;
  };

  // ---- stock engine: lots per item, events applied in date order ----------------------------------------
  const lots = []; // working lot objects
  const lotsOfItem = new Map();
  const lotNoUsed = new Set();
  const events = []; // { at, order, run() }
  const addLot = ({ item, source, no, pcs, mts, rate, at, purchaseId = null, jobId = null }) => {
    let lotId = str(no) ? `${str(no)}` : `${source === 'opening' ? 'OPN' : 'LOT'}-${lots.length + 1}`;
    let i = 2; const base = lotId; while (lotNoUsed.has(lotId)) { lotId = `${base}/${i}`; i += 1; }
    lotNoUsed.add(lotId);
    const lot = { _id: oid(), companyId, lotId, itemId: item._id, purchaseId, source, totalPcs: pcs, remainingPcs: pcs, totalMtrs: mts, remainingMtrs: mts,
      status: 'Available', holdStatus: 'None', rate: rate || 0, sourceJobId: jobId, createdAt: at, updatedAt: at };
    lots.push(lot); if (!lotsOfItem.has(String(item._id))) lotsOfItem.set(String(item._id), []); lotsOfItem.get(String(item._id)).push(lot);
    return lot;
  };
  const move = (lot, type, pcs, mts, refId, at, remarks, signedMts, signedPcs) => {
    docs.StockMovement.push({ _id: oid(), companyId, lotId: lot._id, type, qtyPcs: signedPcs, qtyMtrs: signedMts, balanceMtrs: lot.remainingMtrs, referenceId: refId, remarks, createdAt: at, updatedAt: at,
      idempotencyKey: `MIG:${lot._id}:${docs.StockMovement.length}` });
  };
  /** Takes stock out of an item's lots: the named lot first, else oldest lots first. Never below zero (shortfall is reported). */
  const takeOut = (item, wantMts, wantPcs, at, type, refId, remarks, preferLotNo) => {
    const list = lotsOfItem.get(String(item._id)) || [];
    const ordered = [...list.filter((l) => preferLotNo && str(l.lotId) === str(preferLotNo)), ...list.filter((l) => !(preferLotNo && str(l.lotId) === str(preferLotNo)))];
    let mts = wantMts; let pcs = wantPcs; let first = null;
    for (const l of ordered) {
      if (mts <= 0 && pcs <= 0) break;
      const tm = Math.min(mts, l.remainingMtrs); const tp = Math.min(pcs, l.remainingPcs);
      if (tm <= 0 && tp <= 0) continue;
      l.remainingMtrs = r2(l.remainingMtrs - tm); l.remainingPcs -= tp; mts = r2(mts - tm); pcs -= tp;
      l.status = l.remainingMtrs <= 0 && l.remainingPcs <= 0 ? 'Closed' : 'Partially Used'; l.updatedAt = at;
      move(l, type, tp, tm, refId, at, remarks, -tm, -tp);
      first = first || l;
    }
    if (mts > 0.001 || pcs > 0) warn(`${remarks}: ${r2(mts)} mts / ${pcs} pcs of "${item.name}" had no stock lot to come from (stock would be negative in JSM); not deducted`);
    return first;
  };

  // opening stock (own + grey) from the first year's item master
  for (const [code, it] of itemOf) {
    const q = it.doc.openingQty; const p = it.doc.openingPcs;
    if (q > 0 || p > 0) {
      const at = years[0]?.from || new Date();
      const lot = addLot({ item: it.doc, source: 'opening', no: '', pcs: p, mts: q, rate: it.doc.openingRate, at });
      move(lot, 'OPENING', p, q, lot._id, at, 'Opening stock (migrated)', q, p);
    }
  }
  // goods already at a mill / job worker at the start of the first year: carried as challans (LAST_YEAR='LAST'), handled below

  // ---- other masters (what F3 shows in JSM's Station, Transport, Tax Slab ... screens); one per name, first year wins ----
  const subSeen = new Set();
  const flag = (v) => /^y/i.test(str(v));
  const addSub = (type, name, extraFields) => {
    const nm = str(name); const k = `${type}|${nm.toLowerCase()}`;
    if (!nm || subSeen.has(k)) return;
    subSeen.add(k);
    const at = years[0]?.from || new Date();
    docs.SubMaster.push({ _id: oid(), companyId, type, name: nm, extraFields, isFavorite: false, lastUsedAt: null, createdAt: at, updatedAt: at });
  };
  const yearRows = (n) => byYear(T(n).filter((r) => !str(r.CO_PATH) || wanted.has(str(r.CO_PATH))));
  const stateName = new Map(T('MST_STATE').map((r) => [str(r.STATE_CODE), str(r.STATE_NAME)]));
  for (const r of yearRows('MST_STATION')) {
    addSub('City', r.ST_NAME, { code: str(r.ST_CODE), dist: str(r.DIST), state: str(r.STATE), stateCode: str(r.STATE_CODE), jsmStateName: stateName.get(str(r.STATE_CODE)) || str(r.STATE),
      pincode: str(r.PIN_CODE), distance: str(r.DISTANCE), address1: str(r.ADD_1), address2: str(r.ADD_2), city: str(r.CITY) });
  }
  for (const r of yearRows('MST_TR_PORT')) {
    addSub('Transport', r.TRNS_NAME, { code: str(r.TRNS_CODE), address1: str(r.ADD_1), address2: str(r.ADD_2), city: str(r.CITY), phone: str(r.PHONE_1), transporterId: str(r.TRNS_GSTIN),
      email: str(r.TRNS_Email), pincode: str(r.TRNS_PINCODE), state: str(r.TRNS_STATE), mode: str(r.TRNS_MODE), party: num(r.AC_CODE) ? (accName(r.AC_CODE) || '') : '', contactPerson: '', route: '' });
  }
  for (const r of yearRows('MST_IT_TAX_SLAB')) {
    addSub('ItemTaxSlab', r.SLAB_NAME, { code: str(r.SLAB_CODE), category: /^s/i.test(str(r.IT_CAT)) ? 'Services' : 'Goods', sgstRate: num(r.SGST), cgstRate: num(r.CGST), igstRate: num(r.IGST), gstRate: num(r.IGST), cessRate: num(r.CESS) });
  }
  for (const r of yearRows('MST_ITG_MAST')) addSub('ItemGroup', r.GRIT_NAME, { code: str(r.GRIT_CODE), category: 'Goods', description: '' });
  for (const r of yearRows('MST_UNIT')) addSub('Unit', r.UNIT_NAME, { code: str(r.UNIT_CODE), quc: str(r.QUC), category: 'Goods', description: '' });
  for (const r of yearRows('MST_TYPE')) addSub('Type', r.MST_NAME, { code: str(r.MST_CODE), region: str(r.REG_GST), taxCalculation: str(r.TAX_GST), category: 'Goods', description: '' });
  for (const r of yearRows('MST_DRAW_BANK')) addSub('PartyBank', r.MST_NAME, { code: str(r.MST_CODE), branch: '', ifsc: '', accountType: '' });
  for (const r of yearRows('MST_BOOK_MN')) addSub('BookType', r.BOOK_NAME, { code: str(r.BOOK_CODE), category: 'Goods', description: '' });
  for (const g of T('MST_ACG_MAST')) {
    addSub('AccountGroup', g.GRAC_HEAD, { graccd: str(g.GRAC_CODE), primary: flag(g.PRIMARY_YN) ? 'Y' : 'N', mainGroup: str(grp.get(str(g.PRIMARY_CD))?.GRAC_HEAD), groupType: str(g.GRAC_TYPE), indexCd: str(g.GRCHR_CODE) || '0', active: true,
      optionalFields: { broker: flag(g.DB_BRK), transport: flag(g.DB_TRNS), mainGroup: flag(g.DB_MG), dueDays: flag(g.DB_DUE), interestCommi: flag(g.DB_INT), adat: flag(g.DB_ADT), cstTinNo: flag(g.DB_CST), gstTinNo: flag(g.DB_GST), panNo: flag(g.DB_PAN), maxLimit: flag(g.DB_MAX), minLimit: flag(g.DB_MIN), tdsPer: flag(g.DB_TDS) } });
  }
  const godSeen = new Set();
  for (const r of yearRows('MST_GODWON')) {
    const nm = str(r.MST_NAME); const code = (str(r.B_SORT_NM) || str(r.MST_CODE) || nm).toUpperCase();
    if (!nm || godSeen.has(nm.toLowerCase()) || godSeen.has(`#${code}`)) continue;
    godSeen.add(nm.toLowerCase()); godSeen.add(`#${code}`);
    const at = years[0]?.from || new Date();
    docs.Warehouse.push({ _id: oid(), companyId, name: nm, code, type: 'Godown', parentId: null, address: [str(r.ADDRESS_1), str(r.ADDRESS_2)].filter(Boolean).join(', '), isDefault: false, status: 'Active', createdAt: at, updatedAt: at });
  }

  // ---- vouchers' reference tables -------------------------------------------------------------------------
  const bookName = (code) => accName(code) || `Book ${code}`;
  const gstSplit = (r, p = '') => ({ cgst: num(r[`SGST${p}`] ?? 0), sgst: num(r[`CGST${p}`] ?? 0) });

  // ---- purchases -----------------------------------------------------------------------------------------------
  const purchaseItems = new Map(); // key path|ENT -> rows
  for (const r of rowsOf('T_PU_ITEM')) { const k = `${str(r.CO_PATH)}|${num(r.ENT_NO)}`; if (!purchaseItems.has(k)) purchaseItems.set(k, []); purchaseItems.get(k).push(r); }
  const purchaseNos = new Set(); const purchaseSupplierNos = new Set(); const purchaseByKey = new Map();
  const purchaseLotByBill = new Map(); // supplier bill no|item -> lot
  for (const h of byYear(rowsOf('T_PURCHASE'))) {
    const path = str(h.CO_PATH); const sk = `${path}:T_PURCHASE:${num(h.ENT_NO)}`;
    const supplier = partyFor(h.AC_CODE, 'Supplier', `Purchase ${str(h.NCBILL_NO)} (${path})`);
    if (!supplier) continue;
    const lines = purchaseItems.get(`${path}|${num(h.ENT_NO)}`) || [];
    const at = date(h.BILL_DATE) || years[yearIdx.get(path)]?.from || new Date();
    const id = oid();
    const igst = num(h.IGST_AMT); const cg = num(h.CGST_AMT); const sg = num(h.SGST_AMT);
    const items = lines.map((l) => {
      const it = itemFor(l.ITEM_CODE, path, `Purchase ${str(h.NCBILL_NO)}`);
      const qty = num(l.IT_QTY1) || num(l.IT_QTY);
      return { itemId: it?._id, pcs: num(l.IT_PCS), mts: qty, cut: num(l.IT_CUT), rate: num(l.IT_RATE), amount: num(l.IT_AMOUNT), fold: num(l.FOLD_PER),
        gstPer: num(l.TOT_GST_P), gstAmt: num(l.TOT_GST_A), unit: unitName(path, l.UNIT_CODE), lotNo: str(l.IT_DISC4).slice(0, 40), desc: str(l.IT_DISC1) };
    }).filter((x) => x.itemId);
    const taxable = num(h.TAXABLE_AMT) || num(h.SUB_TOT);
    const net = num(h.NET_TOT);
    const supplierNo = str(h.NCBILL_NO);
    const doc = {
      _id: id, companyId, supplierId: supplier.partyId,
      invoiceNo: uniqueNo(String(num(h.SRAL_NO) || num(h.ENT_NO)), purchaseNos, [str(h.TR_CODE), path]),
      supplierInvoiceNo: supplierNo ? uniqueNo(`${supplier.partyId}|${supplierNo}`, purchaseSupplierNos, [path]).split('|')[1] : undefined,
      date: at, bookId: bookName(h.TR_CODE), items, taxableAmount: r2(taxable), gstType: igst > 0 ? 'IGST' : (cg + sg > 0 ? 'CGST+SGST' : 'Exempt'),
      cgst: cg, sgst: sg, igst, gstAmount: r2(cg + sg + igst), netAmount: r2(net), roundOff: num(h.ROUND_OFF), tdsAmount: num(h.T_TDS_AMT) || num(h.TDS_AMT),
      tcsAmt: num(h.TCS_AMT), tcsRate: num(h.TCS_PER), reverseCharge: /^y/i.test(str(h.RVRS_CHRG_YN)) ? 'Yes' : 'No', itcEligibility: str(h.ITC_ELIGI), challanNo: str(h.CHLN_NO),
      challanDate: date(h.CHLN_DATE), lrNo: str(h.LR_NO), transport: '', paidAmount: 0, status: 'active', createdAt: at, updatedAt: at,
    };
    if (doc.supplierInvoiceNo === undefined) delete doc.supplierInvoiceNo;
    docs.Purchase.push(doc); keys.Purchase[sk] = id; purchaseByKey.set(`${path}|${num(h.ENT_NO)}`, { doc, supplier, billNo: supplierNo });
    for (const [i, line] of items.entries()) {
      const it = itemOf.get(str(lines[i]?.ITEM_CODE))?.doc;
      if (!it) continue;
      events.push({ at, order: 1, run: () => {
        const lot = addLot({ item: it, source: 'purchase', no: line.lotNo || `${supplierNo || doc.invoiceNo}-${i + 1}`, pcs: line.pcs, mts: line.mts, rate: line.rate, at, purchaseId: id });
        move(lot, 'PURCHASE', line.pcs, line.mts, id, at, `Purchase ${doc.invoiceNo}`, line.mts, line.pcs);
        purchaseLotByBill.set(`${path}|${supplierNo}|${String(it._id)}`, lot);
      } });
    }
  }

  // ---- mill issue / receipt and job work (the Job collection holds both) ----------------------------------------
  const jobNos = new Set(); const jobByKey = new Map();
  // JSM lists a challan saved without a mill or an item (code 0) under a blank name; keep it the same way
  let noMill = null; let noItem = null;
  const blankWorker = () => {
    if (!noMill) {
      const pd = { _id: oid(), companyId, name: unique('(NO MILL)', partyNames), type: 'Job Worker', group: '', accd: 0, gstin: '', openingBalance: 0, openingBalanceType: 'Dr', status: 'Active', city: '', state: '' };
      docs.Party.push(pd); noMill = { partyId: pd._id, row: { AC_NAME: pd.name }, info: { kind: 'Job Worker' } };
    }
    return noMill;
  };
  const blankItem = () => {
    if (!noItem) { noItem = { _id: oid(), companyId, name: unique('(NO ITEM)', itemNames), category: 'Finished', gstRate: 0, unit: 'MTRS' }; docs.Item.push(noItem); }
    return noItem;
  };
  const mkJob = (h, processType, kind, { carried = false } = {}) => {
    const path = str(h.CO_PATH);
    const worker = num(h.AC_CODE) ? partyFor(h.AC_CODE, 'Job Worker', `${kind} challan ${str(h.NCCHLN_NO || h.CHLN_NO)} (${path})`) : blankWorker();
    const it = num(h.ITEM_CODE) ? itemFor(h.ITEM_CODE, path, `${kind} challan ${str(h.CHLN_NO)}`) : blankItem();
    if (!worker || !it) return null;
    if (!num(h.AC_CODE) || !num(h.ITEM_CODE)) warn(`${kind} challan ${str(h.NCCHLN_NO || h.CHLN_NO)} (${path}) has no ${num(h.AC_CODE) ? 'item' : 'mill / party'} in JSM; kept under ${num(h.AC_CODE) ? '(NO ITEM)' : '(NO MILL)'} as JSM lists it`);
    const at = date(h.CHLN_DATE) || years[yearIdx.get(path)]?.from || new Date();
    const id = oid();
    const no = str(h.NCCHLN_NO) || str(h.CHLN_NO) || String(num(h.ENT_NO));
    const doc = {
      _id: id, companyId, workerId: worker.partyId, processType, productionType: 'External', issuePcs: num(h.ISS_PCS), issueQty: num(h.ISS_QTY),
      jobCardNo: uniqueNo(no, jobNos, [kind === 'Job' ? 'J' : 'M', path]), challanNo: no, purchaseBillNo: str(h.PU_BILLNO), purchaseRate: num(h.PU_RATE), jobRate: num(h.JOB_RATE),
      gstPer: num(h.TOT_GST_P), issueKgs: num(h.ISS_KGS), masterName: str(h.MASTER_NAME), transport: str(h.TRANSPORT), lrNo: str(h.LR_NO), markaNo: str(h.MARKA_NO),
      status: 'Issued', issueDate: at, receivedPcs: 0, receivedQty: 0, receivedGreyQty: 0, receivedGreyPcs: 0, wastage: 0, processCharges: 0, processGstAmount: 0,
      chargesPaidAmount: 0, remark: [str(h.REMARK_1), str(h.REMARK_2)].filter(Boolean).join('\n'), createdAt: at, updatedAt: at, lotId: null, workKind: kind === 'Job' ? 'Job' : 'Mill', receipts: [],
      lotNo: str(h.LOT_NO), weaver: num(h.PU_CODE) ? accName(h.PU_CODE) : '', lastYear: carried ? 'LAST' : str(h.LAST_YEAR), finish: str(h.RE_FINISH) || '',
    };
    docs.Job.push(doc);
    const sk = `${path}:${kind === 'Job' ? 'I_JOB_ISSUE' : 'I_MILL_CH'}:${num(h.ENT_NO)}${kind === 'Job' ? `:${num(h.NO_SR)}` : ''}`;
    keys.Job[sk] = id; jobByKey.set(`${kind}|${path}|${num(h.ENT_NO)}${kind === 'Job' ? `|${num(h.NO_SR)}` : ''}`, { doc, it, at, worker });
    events.push({ at, order: 2, run: () => {
      const lot = (carried ? null : takeOut(it, doc.issueQty, doc.issuePcs, at, 'ISSUE', id, `${kind} issue ${doc.jobCardNo}`, str(h.LOT_NO)))
        || (lotsOfItem.get(String(it._id)) || [])[0]
        || addLot({ item: it, source: 'opening', no: `CARRIED-${path}-${no}`, pcs: 0, mts: 0, rate: num(h.PU_RATE), at });
      doc.lotId = lot._id;
    } });
    return doc;
  };
  for (const h of byYear(rowsOf('I_MILL_CH'))) mkJob(h, 'Process Charge', 'Mill');
  for (const h of byYear(rowsOf('I_JOB_ISSUE'))) mkJob(h, 'Job Work', 'Job');

  // receipts: bill headers + lines
  const gpHeader = (name) => new Map(rowsOf(name).map((h) => [`${str(h.CO_PATH)}|${num(h.ENT_NO)}`, h]));
  const millGp = gpHeader('I_MILL_GP'); const jobGp = gpHeader('I_JOB_RECEIPT');
  const receiptBills = []; // { kind, header, doc }
  const openingChallans = new Set(); // earlier-year challans added for receipts: issued = what came back
  const at0 = (h) => date(h.BILL_DATE) || new Date();
  const applyReceipts = (lineTable, headerMap, kind, sndKey) => {
    for (const l of byYear(rowsOf(lineTable))) {
      const path = str(l.CO_PATH);
      const h = headerMap.get(`${path}|${num(l.ENT_NO)}`); if (!h) { warn(`${lineTable} ${path}/${num(l.ENT_NO)}: bill header missing`); continue; }
      const jk = kind === 'Job' ? `Job|${path}|${num(l.SND_ENTNO)}|${num(l.SND_ENT_SRNO)}` : `Mill|${path}|${num(l.SND_ENTNO)}`;
      let j = jobByKey.get(jk);
      if (!j) {
        // the challan is from an earlier year that was not imported: add it as an opening challan (goods already at the
        // mill / worker when the first imported year began) so the receipt, its bill and the balance are kept
        const start = years[yearIdx.get(path)]?.from || years[0]?.from || at0(h);
        const made = mkJob({ CO_PATH: path, AC_CODE: h.AC_CODE, ITEM_CODE: num(l.ITEM_CODE) ? l.ITEM_CODE : l.GP_CODE, ISS_PCS: 0, ISS_QTY: 0, CHLN_DATE: start, NCCHLN_NO: `${num(l.SND_ENTNO)}${kind === 'Job' && num(l.SND_ENT_SRNO) ? `/${num(l.SND_ENT_SRNO)}` : ''}`, ENT_NO: l.SND_ENTNO, NO_SR: l.SND_ENT_SRNO, REMARK_1: 'Earlier year challan (opening)' }, kind === 'Job' ? 'Job Work' : 'Process Charge', kind, { carried: true });
        if (made) { openingChallans.add(made); warn(`${lineTable} ${path}/${num(l.ENT_NO)}: issue challan ${num(l.SND_ENTNO)} is from an earlier year; added as an opening challan`); }
        j = jobByKey.get(jk);
        if (!j) { warn(`${lineTable} ${path}/${num(l.ENT_NO)}: issue challan ${num(l.SND_ENTNO)} not found`); continue; }
      }
      const at = date(h.BILL_DATE) || j.at;
      const finishItem = (num(l.GP_CODE) ? itemFor(l.GP_CODE, path, `${kind} receive`) : null) || j.it;
      const rec = num(l.REC_QTY); const sendQ = num(l.SND_QTY) || num(l.SND_QTY_TP);
      const pcs = num(l.IT_PCS) || num(l.GP_PCS);
      j.doc.receivedGreyQty = r2(j.doc.receivedGreyQty + sendQ); j.doc.receivedGreyPcs += pcs;
      j.doc.receivedQty = r2(j.doc.receivedQty + rec); j.doc.receivedPcs += pcs;
      j.doc.wastage = r2(j.doc.wastage + num(l.SH_TG) + num(l.SHORT_QTY));
      j.doc.receiveDate = at; j.doc.billGpNo = str(h.NCBILL_NO); j.doc.serialNo = str(h.SRAL_NO); j.doc.perKgs = num(l.REC_KGS);
      j.doc.processCharges = r2(j.doc.processCharges + num(l.IT_AMOUNT));
      j.doc.receipts.push({ date: at, billNo: str(h.NCBILL_NO), serialNo: str(h.SRAL_NO), greyQty: r2(sendQ), finishQty: r2(rec), pcs, kgs: num(l.REC_KGS), shortQty: r2(num(l.SH_TG) + num(l.SHORT_QTY)), rate: num(l.IT_RATE), amount: r2(num(l.IT_AMOUNT)) });
      j.doc.updatedAt = at;
      events.push({ at, order: 3, run: () => {
        const lot = addLot({ item: finishItem, source: 'job_receive', no: `${j.doc.jobCardNo}-R${str(l.ENT_NO)}-${num(l.SR_NO)}`, pcs, mts: rec, rate: num(l.IT_RATE), at, jobId: j.doc._id });
        j.doc.finishedLotId = lot._id;
        move(lot, 'RECEIVE', pcs, rec, j.doc._id, at, `${kind} receive ${j.doc.jobCardNo}`, rec, pcs);
      } });
      receiptBills.push({ kind, header: h, doc: j.doc });
    }
  };
  applyReceipts('I_MILL_IT', millGp, 'Mill'); applyReceipts('I_JOB_REC_IT', jobGp, 'Job');
  for (const d of openingChallans) { d.issueQty = r2(d.receivedGreyQty); d.issuePcs = d.receivedGreyPcs; }
  // bill level amounts (GST, add/less, TDS) go on the first challan of each bill
  const seenBill = new Set();
  const billJob = new Map(); // "Mill|path|ENT_NO" -> the challan that carries the bill (ledger rows open it)
  for (const b of receiptBills) {
    const k = `${b.kind}|${str(b.header.CO_PATH)}|${num(b.header.ENT_NO)}`;
    if (seenBill.has(k)) continue; seenBill.add(k);
    billJob.set(k, b.doc._id);
    const gst = num(b.header.SGST_AMT) + num(b.header.CGST_AMT) + num(b.header.IGST_AMT);
    const taxable = num(b.header.TAXABLE_AMT) || num(b.header.SUB_TOT);
    b.doc.processCharges = r2(taxable); b.doc.processGstAmount = r2(gst); b.doc.roundOff = num(b.header.ROUND_OFF);
    b.doc.gstType = num(b.header.IGST_AMT) > 0 ? 'IGST' : 'CGST+SGST';
    b.doc.billNet = r2(num(b.header.NET_TOT));
  }
  for (const j of docs.Job) {
    const full = j.receivedGreyQty >= j.issueQty - 0.05 && (j.receivedGreyPcs >= j.issuePcs || j.issuePcs === 0) && j.receivedGreyQty > 0;
    j.status = j.receivedGreyQty > 0 ? (full ? 'Received' : 'Partial') : 'Issued';
    delete j.billNet;
  }

  // ---- sales -----------------------------------------------------------------------------------------------------------
  const saleLines = new Map();
  for (const r of rowsOf('T_SL_ITEM')) { const k = `${str(r.CO_PATH)}|${num(r.ENT_NO)}`; if (!saleLines.has(k)) saleLines.set(k, []); saleLines.get(k).push(r); }
  const saleNos = new Set(); const saleByKey = new Map();
  for (const h of byYear(rowsOf('T_SALES'))) {
    const path = str(h.CO_PATH); const sk = `${path}:T_SALES:${num(h.ENT_NO)}`;
    const cust = partyFor(h.AC_CODE, 'Customer', `Sales ${str(h.NCBILL_NO)} (${path})`);
    if (!cust) continue;
    const at = date(h.BILL_DATE) || years[yearIdx.get(path)]?.from || new Date();
    const lines = saleLines.get(`${path}|${num(h.ENT_NO)}`) || [];
    const id = oid();
    const items = lines.map((l) => {
      const it = itemFor(l.ITEM_CODE, path, `Sales ${str(h.NCBILL_NO)}`);
      return { itemId: it?._id, lotNo: str(l.REF_LOTNO), pcs: num(l.IT_PCS), mts: num(l.IT_QTY1) || num(l.IT_QTY), rate: num(l.IT_RATE), amount: num(l.IT_AMOUNT), fold: num(l.FOLD_PER), cut: num(l.IT_CUT),
        gstPer: num(l.TOT_GST_P), gstAmt: num(l.TOT_GST_A), unit: unitName(path, l.UNIT_CODE), desc: str(l.IT_DISC1), mrp: num(l.IT_MRP) };
    }).filter((x) => x.itemId);
    const cg = num(h.SGST_AMT); const sg = num(h.CGST_AMT); const ig = num(h.IGST_AMT);
    let add = 0; let less = 0; for (let i = 1; i <= 7; i += 1) { const a = num(h[`AMT_${i}`]); if (str(h[`PM_${i}`]) === '-') less += a; else add += a; }
    const taxable = num(h.TAXABLE_AMT) || num(h.SUB_TOT);
    const doc = {
      _id: id, companyId, customerId: cust.partyId, invoiceNo: uniqueNo(str(h.NCBILL_NO) || `SL-${path}-${num(h.ENT_NO)}`, saleNos, [path, `B${str(h.TR_CODE)}`]),
      date: at, bookId: bookName(h.TR_CODE), challanNo: str(h.NCCHLN_NO), chDate: date(h.CHLN_DATE), orderNo: str(h.ORD_NO), orderDate: date(h.ORD_DATE),
      invoiceType: 'Tax', haste: str(h.HASTE), transport: '', station: '', lrNo: str(h.LR_NO), lrDate: date(h.LR_DATE), weight: num(h.WEIGHT), eway: str(h.EWAY_NO),
      items, taxableAmount: r2(taxable), gstType: ig > 0 ? 'IGST' : (cg + sg > 0 ? 'CGST+SGST' : 'Exempt'), cgst: cg, sgst: sg, igst: ig, gstAmount: r2(cg + sg + ig),
      netAmount: r2(num(h.NET_TOT)), roundOff: num(h.ROUND_OFF), totalAdd: r2(add), totalLess: r2(less), tcsPer: num(h.TCS_PER), tcsAmount: num(h.TCS_AMT),
      dueDate: date(h.DUE_DATE), dueDays: num(h.DUE_DAYS), freight: num(h.FREIGHT), paidAmount: 0, status: 'active', createdAt: at, updatedAt: at,
    };
    docs.Sales.push(doc); keys.Sales[sk] = id; saleByKey.set(`${path}|${num(h.ENT_NO)}`, { doc, cust });
    for (const [i, line] of items.entries()) {
      const src = lines[i]; const it = itemOf.get(str(src?.ITEM_CODE))?.doc; if (!it) continue;
      events.push({ at, order: 4, run: () => { const l0 = takeOut(it, num(src.IT_QTY) || line.mts, line.pcs, at, 'SALE', id, `Sale ${doc.invoiceNo}`, line.lotNo); if (l0) line.lotId = l0._id; } });
    }
  }
  // sales returns
  const retLines = new Map();
  for (const r of rowsOf('T_SLR_ITEM')) { const k = `${str(r.CO_PATH)}|${num(r.ENT_NO)}`; if (!retLines.has(k)) retLines.set(k, []); retLines.get(k).push(r); }
  const retNos = new Set();
  for (const h of byYear(rowsOf('T_SL_RETU'))) {
    const path = str(h.CO_PATH); const cust = partyFor(h.AC_CODE, 'Customer', `Sales return ${str(h.NCBILL_NO)}`); if (!cust) continue;
    const at = date(h.BILL_DATE) || new Date(); const id = oid();
    const orig = saleByKey.get(`${path}|${num(h.XX_ENT)}`);
    const items = (retLines.get(`${path}|${num(h.ENT_NO)}`) || []).map((l) => ({ itemId: itemFor(l.ITEM_CODE, path, 'Sales return')?._id, pcs: num(l.IT_PCS), mts: num(l.IT_QTY1) || num(l.IT_QTY), rate: num(l.IT_RATE), amount: num(l.IT_AMOUNT), gstPer: num(l.TOT_GST_P), gstAmt: num(l.TOT_GST_A), unit: unitName(path, l.UNIT_CODE) })).filter((x) => x.itemId);
    const cg = num(h.SGST_AMT); const sg = num(h.CGST_AMT); const ig = num(h.IGST_AMT);
    const doc = { _id: id, companyId, returnType: 'Sales', invoiceNo: uniqueNo(str(h.NCBILL_NO), retNos, [path]), originalInvoiceNo: orig?.doc.invoiceNo || '', originalSaleId: orig?.doc._id || null, partyId: cust.partyId,
      date: at, items, taxableAmount: r2(num(h.TAXABLE_AMT) || num(h.SUB_TOT)), gstType: ig > 0 ? 'IGST' : 'CGST+SGST', cgst: cg, sgst: sg, igst: ig, gstAmount: r2(cg + sg + ig), netAmount: r2(num(h.NET_TOT)), roundOff: num(h.ROUND_OFF), createdAt: at, updatedAt: at };
    docs.ReturnInvoice.push(doc); keys.ReturnInvoice[`${path}:T_SL_RETU:${num(h.ENT_NO)}`] = id;
    for (const [i, line] of items.entries()) {
      const it = itemOf.get(str((retLines.get(`${path}|${num(h.ENT_NO)}`) || [])[i]?.ITEM_CODE))?.doc; if (!it) continue;
      events.push({ at, order: 5, run: () => {
        const list = lotsOfItem.get(String(it._id)) || [];
        const lot = list[list.length - 1] || addLot({ item: it, source: 'return', no: `RET-${doc.invoiceNo}`, pcs: 0, mts: 0, rate: line.rate, at });
        lot.remainingMtrs = r2(lot.remainingMtrs + line.mts); lot.remainingPcs += line.pcs; lot.totalMtrs = Math.max(lot.totalMtrs, lot.remainingMtrs); lot.totalPcs = Math.max(lot.totalPcs, lot.remainingPcs);
        lot.status = 'Partially Used'; move(lot, 'RETURN', line.pcs, line.mts, id, at, `Sales return ${doc.invoiceNo}`, line.mts, line.pcs);
      } });
    }
  }

  // ---- last year's pending bills (T_OS_BILL): documents only, no postings (their balance is in the opening balance) ----------------------
  for (const h of byYear(rowsOf('T_OS_BILL'))) {
    const path = str(h.CO_PATH); const isSale = str(h.SPO).toUpperCase() === 'S';
    const a = partyFor(h.AC_CODE, isSale ? 'Customer' : 'Supplier', `Last-year bill ${str(h.NCBILL_NO)}`); if (!a) continue;
    const at = date(h.BILL_DATE) || years[yearIdx.get(path)]?.from || new Date(); const id = oid();
    const cg = num(h.SGST_AMT); const sg = num(h.CGST_AMT); const ig = num(h.IGST_AMT);
    const base = { _id: id, companyId, date: at, items: [], taxableAmount: r2(num(h.TAXABLE_AMT)), gstType: ig > 0 ? 'IGST' : (cg + sg > 0 ? 'CGST+SGST' : 'Exempt'), cgst: cg, sgst: sg, igst: ig,
      gstAmount: r2(cg + sg + ig), netAmount: r2(num(h.NET_TOT)), paidAmount: 0, status: 'active', type: 'Opening Bill', bookId: bookName(h.TR_CODE), createdAt: at, updatedAt: at };
    if (isSale) {
      docs.Sales.push({ ...base, customerId: a.partyId, invoiceNo: uniqueNo(str(h.NCBILL_NO) || `OS-${num(h.ENT_NO)}`, saleNos, ['LASTYEAR', path]) });
      keys.Sales[`${path}:T_OS_BILL:${num(h.ENT_NO)}`] = id; saleByKey.set(`OS|${path}|${num(h.ENT_NO)}`, { doc: docs.Sales[docs.Sales.length - 1], cust: a });
    } else {
      docs.Purchase.push({ ...base, supplierId: a.partyId, invoiceNo: uniqueNo(`PUR-OS-${path}-${num(h.ENT_NO)}`, purchaseNos, []), supplierInvoiceNo: str(h.NCBILL_NO) || undefined });
      if (!docs.Purchase[docs.Purchase.length - 1].supplierInvoiceNo) delete docs.Purchase[docs.Purchase.length - 1].supplierInvoiceNo;
      keys.Purchase[`${path}:T_OS_BILL:${num(h.ENT_NO)}`] = id; purchaseByKey.set(`OS|${path}|${num(h.ENT_NO)}`, { doc: docs.Purchase[docs.Purchase.length - 1], supplier: a });
    }
  }

  // ---- run the stock events in date order ------------------------------------------------------------------------------------------------------
  events.sort((a, b) => (a.at - b.at) || (a.order - b.order));
  for (const e of events) e.run();
  for (const j of docs.Job) if (!j.lotId) { warn(`${j.processType} challan ${j.jobCardNo}: no stock lot found; linked to an empty lot`); const it = docs.Item.find((i) => true); j.lotId = (lots[0] || addLot({ item: it, source: 'opening', no: 'CARRIED', pcs: 0, mts: 0, rate: 0, at: new Date() }))._id; }

  // ---- vouchers + bill adjustments ---------------------------------------------------------------------------------------------------------------
  const rpd = new Map();
  for (const r of rowsOf('T_CASH_RPD')) { const k = `${str(r.CO_PATH)}|${num(r.ENT_NO)}`; if (!rpd.has(k)) rpd.set(k, []); rpd.get(k).push(r); }
  const settleOf = { sales: new Map(), purchase: new Map(), jobs: new Map() };
  const voucherNosR = new Set(); const voucherNosP = new Set();
  const billTarget = (path, spType, ent, srNo) => {
    if (spType === '1SL') return { kind: 'sales', t: saleByKey.get(`${path}|${num(ent)}`) };
    if (spType === '1PU') return { kind: 'purchase', t: purchaseByKey.get(`${path}|${num(ent)}`) };
    if (spType === '1LAST') return { kind: 'last', t: saleByKey.get(`OS|${path}|${num(ent)}`) || purchaseByKey.get(`OS|${path}|${num(ent)}`) };
    if (spType === '1JB') { const b = receiptBills.find((x) => x.kind === 'Mill' && str(x.header.CO_PATH) === path && num(x.header.ENT_NO) === num(ent)); return { kind: 'jobs', t: b && { doc: b.doc } }; }
    if (spType === '1WK') { const b = receiptBills.find((x) => x.kind === 'Job' && str(x.header.CO_PATH) === path && num(x.header.ENT_NO) === num(ent)); return { kind: 'jobs', t: b && { doc: b.doc } }; }
    return { kind: null, t: null };
  };
  const addSettle = (map, key, amt) => map.set(key, r2((map.get(key) || 0) + amt));
  for (const v of byYear(rowsOf('T_CASH_MN'))) {
    const path = str(v.CO_PATH); const rec = str(v.REC_PAY).toUpperCase() === 'R';
    const party = acc.get(str(v.AC_CODE)); const book = acc.get(str(v.TR_CODE));
    const amount = num(v.REC_AMT);
    if (!party || !book) { warn(`Voucher ${str(v.NCSRAL_NO)} (${path}): account or book missing`); continue; }
    if (amount < 0.01) { warn(`Voucher ${str(v.NCSRAL_NO)} (${path}) has zero amount; skipped`); continue; }
    const at = date(v.REC_DATE) || new Date(); const id = oid();
    const against = (rpd.get(`${path}|${num(v.ENT_NO)}`) || []).map((r) => {
      const tgt = billTarget(path, str(r.SP_TYPE), r.XX_ENT, r.SR_NO);
      const adjust = num(r.ADJUST); const disc = Math.abs(num(r.TOT_DISC));
      if (tgt.t) {
        const settled = adjust + disc + num(r.TDS_AMT);
        if (tgt.kind === 'sales') addSettle(settleOf.sales, String(tgt.t.doc._id), settled);
        else if (tgt.kind === 'purchase') addSettle(settleOf.purchase, String(tgt.t.doc._id), settled);
        else if (tgt.kind === 'last') { const isS = docs.Sales.includes(tgt.t.doc); addSettle(isS ? settleOf.sales : settleOf.purchase, String(tgt.t.doc._id), settled); }
        else if (tgt.kind === 'jobs') addSettle(settleOf.jobs, String(tgt.t.doc._id), settled);
      } else warn(`Voucher ${str(v.NCSRAL_NO)} (${path}): bill ${str(r.INVOICE)} (${str(r.SP_TYPE)}) not found`);
      return { invoiceId: tgt.t?.doc?._id, invoiceNo: str(r.INVOICE), billDate: date(r.BILL_DATE), billAmt: num(r.BILL_AMT), osAmt: num(r.OUT_AMT), amount: adjust, discount: disc, tds: num(r.TDS_AMT), billType: str(r.SP_TYPE) };
    });
    const isCash = book.info.acct === 'Cash' || /CASH/i.test(str(book.row.AC_NAME));
    const doc = {
      _id: id, companyId, voucherNo: uniqueNo(str(v.NCSRAL_NO) || str(v.SRAL_NO), rec ? voucherNosR : voucherNosP, [`${book.row.AC_CODE}`, path]),
      date: at, voucherType: rec ? 'Receipt' : 'Payment', partyLedgerId: party.ledgerId, partyName: str(party.row.AC_NAME), amount: r2(amount),
      paymentMode: isCash ? 'Cash' : (str(v.CHQ_NO) ? 'Cheque' : 'NEFT'), bankLedgerId: book.ledgerId, chequeNo: str(v.CHQ_NO), chequeDate: date(v.CHQ_DATE), slipNo: str(v.SLIP_NO),
      accBill: str(v.ACC_BILL), bookName: str(book.row.AC_NAME), bookKind: isCash ? 'cash' : 'bank', narration: str(v.REMARK_1),
      againstInvoices: against.filter((a) => a.invoiceId), status: 'Posted', isReversed: false, createdAt: at, updatedAt: at,
    };
    docs.PaymentVoucher.push(doc); keys.PaymentVoucher[`${path}:T_CASH_MN:${num(v.ENT_NO)}`] = id;
  }
  // bill status from what was settled
  const applySettle = (list, map, field) => {
    for (const d of list) {
      const paid = map.get(String(d._id)) || 0;
      if (field === 'chargesPaidAmount') d.chargesPaidAmount = r2(paid);
      else { d.paidAmount = r2(paid); d.status = paid >= d.netAmount - 0.01 && d.netAmount > 0 ? 'paid' : paid > 0.009 ? 'partial' : 'active'; }
    }
  };
  applySettle(docs.Sales, settleOf.sales); applySettle(docs.Purchase, settleOf.purchase); applySettle(docs.Job, settleOf.jobs, 'chargesPaidAmount');
  for (const [list, party, billType, key] of [[docs.Sales, 'customerId', 'SalesInvoice', 'invoiceNo'], [docs.Purchase, 'supplierId', 'PurchaseBill', 'invoiceNo']]) {
    for (const d of list) {
      const out = r2(Math.max(0, d.netAmount - d.paidAmount));
      const ledger = docs.LedgerMaster.find((l) => String(l.linkedPartyId) === String(d[party]));
      docs.BillSettlement.push({ _id: oid(), companyId, partyId: d[party], partyLedgerId: ledger?._id, billType, billId: d._id, billNo: d[key], billDate: d.date, billAmount: d.netAmount,
        settledAmount: d.paidAmount, outstandingAmount: out, dueDate: d.dueDate || null, status: out <= 0.01 ? 'Settled' : d.paidAmount > 0 ? 'Partial' : 'Open', createdAt: d.date, updatedAt: d.date });
    }
  }

  // ---- GST notes ---------------------------------------------------------------------------------------------------------------------------------------
  const noteNos = new Set();
  for (const n of byYear(rowsOf('T_JV_GST'))) {
    const path = str(n.CO_PATH);
    const side = str(n.SL_PU).toUpperCase() === 'S' ? 'Sales' : 'Purchase';
    const noteType = str(n.EXP_INC).toUpperCase() === 'C' ? 'Credit' : 'Debit';
    const pa = [acc.get(str(n.DR_CODE)), acc.get(str(n.CR_CODE))].find((a) => a && a.partyId) || partyFor(side === 'Sales' ? n.DR_CODE : n.CR_CODE, side === 'Sales' ? 'Customer' : 'Supplier', `Note ${str(n.VOU_NO)}`);
    if (!pa) continue;
    const at = date(n.ENT_DATE) || new Date(); const id = oid();
    const cg = num(n.SGST_AMT); const sg = num(n.CGST_AMT); const ig = num(n.IGST_AMT);
    const doc = { _id: id, companyId, noteType, noteSide: side, noteNo: uniqueNo(str(n.VOU_NO) || String(num(n.ENT_NO)), noteNos, [noteType[0] + side[0], path]), vNo: str(n.VOU_NO), partyLedgerId: pa.ledgerId, partyId: pa.partyId, partyName: str(pa.row.AC_NAME),
      date: at, billNo: str(n.NCBILL_NO), billDate: date(n.BILL_DATE), amount: r2(num(n.DR_AMOUNT) || num(n.CR_AMOUNT)), taxableAmount: r2(num(n.DR_AMOUNT) || num(n.CR_AMOUNT)),
      gstRate: num(n.TOTGST_PER), cgst: cg, sgst: sg, igst: ig, gstAmount: r2(cg + sg + ig), roundOff: num(n.ROUND_OFF), netAmount: r2(num(n.NET_AMOUNT)), finalAmount: r2(num(n.FINAL_AMT)),
      reasonCode: str(n.Reason_IssNote), reason: str(n.Reason_IssNote), quc: str(n.QUC), hsnSac: str(n.HSN_CODE), narration: str(n.REMARK_1), status: 'Posted', isReversed: false, createdAt: at, updatedAt: at };
    docs.DebitCreditNote.push(doc); keys.DebitCreditNote[`${path}:T_JV_GST:${num(n.ENT_NO)}`] = id;
  }

  // ---- ledger postings = JSM's posted ledger (T_TRANDATA), one entry per voucher ---------------------------------------------------------------------------
  const typeOf = (sp) => ({ '1SL': ['Sales', 'SalesInvoice'], '1SL_RT': ['ReturnAuto', 'SalesReturn'], '1PU': ['Purchase', 'PurchaseBill'], '1PU_RT': ['ReturnAuto', 'PurchaseReturn'], '1JB': ['JobWorkAuto', 'JobWorkCharges'], '1WK': ['JobWorkAuto', 'JobWorkCharges'], '1JVGST': ['NoteAuto', 'Journal'], '1JV': ['Journal', 'Journal'], '1TS': ['Journal', 'Journal'] }[sp] || ['Journal', 'Journal']);
  const entries = new Map();
  for (const t of rowsOf('T_TRANDATA')) {
    const path = str(t.CO_PATH); const sp = str(t.SP_TYPE);
    const k = `${path}|${sp}|${num(t.ENT_NO)}`;
    if (!entries.has(k)) entries.set(k, { path, sp, ent: num(t.ENT_NO), date: date(t.ENT_DATE), rows: [] });
    entries.get(k).rows.push(t);
  }
  const refOf = (e) => ({ '1SL': keys.Sales[`${e.path}:T_SALES:${e.ent}`], '1PU': keys.Purchase[`${e.path}:T_PURCHASE:${e.ent}`], '1CB': keys.PaymentVoucher[`${e.path}:T_CASH_MN:${e.ent}`],
    '1JVGST': keys.DebitCreditNote[`${e.path}:T_JV_GST:${e.ent}`], '1SL_RT': keys.ReturnInvoice[`${e.path}:T_SL_RETU:${e.ent}`],
    // 1JB = mill (process) bill (I_MILL_GP), 1WK = job work bill (I_JOB_RECEIPT)
    '1JB': billJob.get(`Mill|${e.path}|${e.ent}`), '1WK': billJob.get(`Job|${e.path}|${e.ent}`) }[e.sp] || null);
  let entrySeq = 0;
  const expectedBal = new Map(); // ledger code -> signed (Dr +)
  for (const e of [...entries.values()].sort((a, b) => (a.date - b.date) || (yearIdx.get(a.path) - yearIdx.get(b.path)) || (a.ent - b.ent))) {
    const lines = [];
    for (const t of e.rows) {
      const dr = num(t.DR_AMOUNT); const cr = num(t.CR_AMOUNT); const code = str(t.AC_CODE);
      const led = acc.get(code);
      if (!led) { warn(`Ledger posting ${e.sp} ${e.ent} (${e.path}): account ${code} not found`); continue; }
      // JSM can store a negative amount in either column (a round-off of -0.26 in DR is a 0.26 credit): net them
      const signed = r2(dr - cr);
      if (signed >= 0.005) lines.push({ ledgerId: led.ledgerId, ledgerName: led.ledgerName, type: 'Dr', amount: signed });
      else if (signed <= -0.005) lines.push({ ledgerId: led.ledgerId, ledgerName: led.ledgerName, type: 'Cr', amount: -signed });
      expectedBal.set(code, r2((expectedBal.get(code) || 0) + dr - cr));
    }
    if (lines.length < 2) { if (lines.length) warn(`Ledger posting ${e.sp} ${e.ent} (${e.path}) has a single line; skipped`); continue; }
    const totalDebit = r2(lines.filter((l) => l.type === 'Dr').reduce((s, l) => s + l.amount, 0));
    const totalCredit = r2(lines.filter((l) => l.type === 'Cr').reduce((s, l) => s + l.amount, 0));
    if (Math.abs(totalDebit - totalCredit) > 0.01) warn(`Ledger posting ${e.sp} ${e.ent} (${e.path}) does not balance in JSM (Dr ${totalDebit} / Cr ${totalCredit})`);
    entrySeq += 1;
    const [vt, rt] = e.sp === '1CB' ? (docs.PaymentVoucher.find((p) => String(p._id) === String(refOf(e)))?.voucherType === 'Payment' ? ['Payment', 'Payment'] : ['Receipt', 'Receipt']) : typeOf(e.sp);
    const at = e.date || new Date(); const id = oid(); const ref = refOf(e);
    docs.AccountingEntry.push({ _id: id, companyId, entryNo: `JSM-${e.path}-${e.sp}-${e.ent}`, entryDate: at, voucherType: vt, refType: rt, refId: ref, lines, totalDebit, totalCredit, status: 'Posted', isReversed: false, narration: `${e.sp} ${e.ent} (migrated)`, createdAt: at, updatedAt: at });
    keys.AccountingEntry[`${e.path}:${e.sp}:${e.ent}`] = id;
    if (ref) { const target = [docs.Sales, docs.Purchase, docs.PaymentVoucher, docs.DebitCreditNote, docs.ReturnInvoice].flatMap((l) => l).find((d) => String(d._id) === String(ref)); if (target) target.accountingEntryId = id; }
  }

  // ---- party -> broker (JSM BR_CODE), now that every party exists --------------------------------------------------------------------------------------
  for (const pd of docs.Party) {
    const bc = partyBroker.get(String(pd._id)); if (!bc) continue;
    const b = acc.get(bc); if (!b) continue;
    if (!b.partyId) partyFor(bc, 'Broker', `Broker of ${pd.name}`);
    if (b.partyId) pd.brokerId = String(b.partyId);
  }

  // ---- expected figures taken from JSM's own data (for reconciliation) --------------------------------------------------------------------------------------
  const sum = (rows, f) => r2(rows.reduce((s, r) => s + num(r[f]), 0));
  const expected = {
    counts: { parties: docs.Party.length, items: docs.Item.length, sales: rowsOf('T_SALES').length + rowsOf('T_OS_BILL').filter((r) => str(r.SPO).toUpperCase() === 'S').length,
      purchases: rowsOf('T_PURCHASE').length + rowsOf('T_OS_BILL').filter((r) => str(r.SPO).toUpperCase() !== 'S').length, millIssues: rowsOf('I_MILL_CH').length, jobIssues: rowsOf('I_JOB_ISSUE').length,
      vouchers: rowsOf('T_CASH_MN').filter((v) => num(v.REC_AMT) >= 0.01).length, notes: rowsOf('T_JV_GST').length, returns: rowsOf('T_SL_RETU').length },
    totals: { salesNet: sum(rowsOf('T_SALES'), 'NET_TOT') + sum(rowsOf('T_OS_BILL').filter((r) => str(r.SPO).toUpperCase() === 'S'), 'NET_TOT'), salesTaxable: sum(rowsOf('T_SALES'), 'TAXABLE_AMT'), purchaseNet: sum(rowsOf('T_PURCHASE'), 'NET_TOT') + sum(rowsOf('T_OS_BILL').filter((r) => str(r.SPO).toUpperCase() !== 'S'), 'NET_TOT'),
      receipts: r2(rowsOf('T_CASH_MN').filter((v) => str(v.REC_PAY).toUpperCase() === 'R').reduce((s, v) => s + num(v.REC_AMT), 0)), payments: r2(rowsOf('T_CASH_MN').filter((v) => str(v.REC_PAY).toUpperCase() === 'P').reduce((s, v) => s + num(v.REC_AMT), 0)) },
    // closing balance per account = opening (first year) + everything JSM posted
    closing: Object.fromEntries([...acc.entries()].map(([code, a]) => { const op = (str(a.first.OP_DRCR).toUpperCase() === 'CR' ? -1 : 1) * num(a.first.OP_BAL); return [code, { name: str(a.row.AC_NAME), balance: r2(op + (expectedBal.get(code) || 0)) }]; })),
  };
  // outstanding per party expected from JSM bills and adjustments
  const outByParty = new Map();
  for (const [list, party] of [[docs.Sales, 'customerId'], [docs.Purchase, 'supplierId']]) for (const d of list) outByParty.set(String(d[party]), r2((outByParty.get(String(d[party])) || 0) + Math.max(0, d.netAmount - d.paidAmount)));
  expected.outstandingByParty = Object.fromEntries(outByParty);
  // every master name JSM has, by kind (reconciliation checks each one is here)
  expected.masters = {};
  for (const d of docs.SubMaster) (expected.masters[d.type] ||= []).push(d.name);
  if (docs.Warehouse.length) expected.masters.Godown = docs.Warehouse.map((w) => w.name);

  docs.InventoryLot = lots; // final state of every lot after all stock events
  for (const [label, set] of [['sales bill', saleNos], ['purchase bill', purchaseNos], ['mill/job challan', jobNos], ['voucher', voucherNosR], ['voucher', voucherNosP], ['GST note', noteNos]]) {
    if (set.renamed) warn(`${set.renamed} ${label} number(s) were already used by another book or year in JSM; they were saved with a suffix (e.g. 101/SCC28) so the number stays unique here. The original number is the part before the slash.`);
  }
  const counts = Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, v.length]));
  return { docs, keys, expected, warnings, blockers: blockers.slice(0, 20), counts, years };
}

module.exports = { buildPlan, uniqueNo, date, num };
