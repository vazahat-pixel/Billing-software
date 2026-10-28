/**
 * Old-data import from Excel: Sales bills and Purchase bills (one row per bill line).
 * Bills go through the normal salesService / purchaseService, so stock, GST, accounting and
 * outstanding are built exactly as for a bill typed on screen. Re-importing the same file is
 * safe: each bill carries a stable operationId and existing bills are skipped.
 */
const Party = require('../models/Party');
const Item = require('../models/Item');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const partyService = require('./partyService');
const itemService = require('./itemService');

const BILL_SYNONYMS = {
  billNo: ['bill no', 'invoice no', 'inv no', 'bill', 'invoice', 'voucher no', 'vou no', 'bill number', 'invoice number', 'supp bill no', 'supplier bill no', 'party bill no'],
  date: ['date', 'bill date', 'inv date', 'invoice date', 'voucher date'],
  party: ['party', 'party name', 'customer', 'customer name', 'supplier', 'supplier name', 'account', 'account name', 'vendor'],
  item: ['item', 'item name', 'product', 'quality', 'fabric', 'description', 'particulars'],
  pcs: ['pcs', 'pieces', 'taka', 'takas', 'than'],
  mts: ['mts', 'mtrs', 'meters', 'metres', 'qty', 'quantity'],
  rate: ['rate', 'price', 'unit rate'],
  amount: ['amount', 'value', 'taxable', 'taxable amount', 'line amount'],
  gstPer: ['gst', 'gst %', 'gst rate', 'tax %', 'tax rate', 'gst per'],
  hsn: ['hsn', 'hsn code', 'hsn sac'],
};

const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%]/g, ' ').replace(/\s+/g, ' ').trim();

function suggestBillMappings(headers = []) {
  const mappings = {};
  const used = new Set();
  for (const h of headers) {
    const c = clean(h);
    let found = '';
    for (const [field, syns] of Object.entries(BILL_SYNONYMS)) {
      if (used.has(field)) continue;
      if (syns.includes(c)) { found = field; break; }
    }
    if (!found) {
      for (const [field, syns] of Object.entries(BILL_SYNONYMS)) {
        if (used.has(field)) continue;
        if (syns.some((s) => c.startsWith(s) || c.endsWith(s))) { found = field; break; }
      }
    }
    mappings[h] = found;
    if (found) used.add(found);
  }
  return mappings;
}

/** Excel serial (45000), dd/mm/yyyy, dd-mm-yyyy or ISO -> Date; null if not a date. */
function parseDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000));
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return null;
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Rows -> bills: rows sharing Bill No + Party + Date are one bill. */
function groupBills(rows, mappings) {
  const bills = new Map();
  const errors = [];
  rows.forEach((row, i) => {
    const rowNo = Number(row.__row) || i + 2; // Excel row number when the screen sends batches
    const r = {};
    for (const [col, val] of Object.entries(row)) {
      const f = mappings[col];
      if (f) r[f] = val;
    }
    const billNo = String(r.billNo ?? '').trim();
    const party = String(r.party ?? '').trim();
    const item = String(r.item ?? '').trim();
    const date = parseDate(r.date);
    if (!billNo) return errors.push({ row: rowNo, error: 'Bill No is empty' });
    if (!party) return errors.push({ row: rowNo, error: 'Party is empty' });
    if (!item) return errors.push({ row: rowNo, error: 'Item is empty' });
    if (!date) return errors.push({ row: rowNo, error: `Date "${r.date ?? ''}" not understood (use dd/mm/yyyy)` });
    const mts = num(r.mts);
    const pcs = num(r.pcs);
    const rate = num(r.rate);
    const amount = r.amount != null && r.amount !== '' ? num(r.amount) : Number(((mts || pcs) * rate).toFixed(2));
    if (!(mts > 0 || pcs > 0)) return errors.push({ row: rowNo, error: 'Pcs or Mts must be more than 0' });
    const key = `${billNo}|${party.toUpperCase()}|${date.toISOString().slice(0, 10)}`;
    if (!bills.has(key)) bills.set(key, { billNo, party, date, lines: [] });
    bills.get(key).lines.push({
      item, mts, pcs, rate, amount,
      gstPer: r.gstPer != null && r.gstPer !== '' ? num(String(r.gstPer).replace('%', '')) : null,
      hsn: String(r.hsn ?? '').trim(),
    });
  });
  return { bills: [...bills.values()], errors };
}

const nameKey = (s) => String(s || '').trim().toUpperCase();

async function masterMaps(companyId) {
  const [parties, items] = await Promise.all([
    Party.find({ companyId }).select('name type').lean(),
    Item.find({ companyId }).select('name gstRate').lean(),
  ]);
  return {
    parties: new Map(parties.map((p) => [nameKey(p.name), p])),
    items: new Map(items.map((it) => [nameKey(it.name), it])),
  };
}

const opIdFor = (entity, companyId, bill) =>
  `IMPORT:${entity}:${companyId}:${bill.billNo}:${nameKey(bill.party)}:${bill.date.toISOString().slice(0, 10)}`;

async function existingBill(entity, companyId, bill, partyId) {
  const operationId = opIdFor(entity, companyId, bill);
  if (entity === 'salesBill') {
    return Sales.findOne({ companyId, $or: [{ operationId }, { invoiceNo: bill.billNo }] }).select('_id').lean();
  }
  const or = [{ operationId }];
  if (partyId) or.push({ supplierId: partyId, supplierInvoiceNo: bill.billNo });
  return Purchase.findOne({ companyId, $or: or }).select('_id').lean();
}

/** Dry run: bill count, rows with problems, bills already present, masters that would be created. */
async function preview({ companyId, entity, rows, columnMappings }) {
  const mappings = columnMappings && Object.keys(columnMappings).length ? columnMappings : suggestBillMappings(Object.keys(rows[0] || {}));
  const { bills, errors } = groupBills(rows, mappings);
  const maps = await masterMaps(companyId);
  const newParties = new Set();
  const newItems = new Set();
  let already = 0;
  for (const b of bills) {
    const party = maps.parties.get(nameKey(b.party));
    if (!party) newParties.add(b.party);
    for (const l of b.lines) if (!maps.items.has(nameKey(l.item))) newItems.add(l.item);
    if (await existingBill(entity, companyId, b, party?._id)) already += 1;
  }
  return {
    entity,
    totalRows: rows.length,
    bills: bills.length,
    alreadyImported: already,
    toImport: bills.length - already,
    // same names the import screen uses for masters
    validRows: bills.length - already,
    duplicateRows: already,
    invalidRows: errors.length,
    errors: errors.slice(0, 50),
    newParties: [...newParties].slice(0, 200),
    newItems: [...newItems].slice(0, 200),
    sampleBills: bills.slice(0, 5).map((b) => ({ billNo: b.billNo, date: b.date, party: b.party, lines: b.lines.length, amount: b.lines.reduce((s, l) => s + l.amount, 0) })),
    mappings,
  };
}

/** Import bills in date order (purchases before sales when both are imported, by the caller). */
async function execute({ companyId, entity, rows, columnMappings, options = {}, userId }) {
  const salesService = require('./salesService');
  const purchaseService = require('./purchaseService');
  const mappings = columnMappings && Object.keys(columnMappings).length ? columnMappings : suggestBillMappings(Object.keys(rows[0] || {}));
  const { bills, errors } = groupBills(rows, mappings);
  const createMissing = options.createMissingMasters !== false;
  const maps = await masterMaps(companyId);
  const result = { entity, bills: bills.length, created: 0, skipped: 0, failed: 0, errors: errors.map((e) => ({ ...e })), createdParties: 0, createdItems: 0 };
  bills.sort((a, b) => a.date - b.date || String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true }));

  for (const bill of bills) {
    try {
      let party = maps.parties.get(nameKey(bill.party));
      if (!party) {
        if (!createMissing) throw new Error(`Party "${bill.party}" not found`);
        const created = await partyService.createParty({ name: bill.party, type: entity === 'salesBill' ? 'Customer' : 'Supplier', companyId });
        party = created.party || created;
        maps.parties.set(nameKey(bill.party), party);
        result.createdParties += 1;
      }
      if (await existingBill(entity, companyId, bill, party._id)) {
        result.skipped += 1;
        continue;
      }
      const items = [];
      for (const l of bill.lines) {
        let item = maps.items.get(nameKey(l.item));
        if (!item) {
          if (!createMissing) throw new Error(`Item "${l.item}" not found`);
          item = await itemService.createItem({ name: l.item, companyId, hsnCode: l.hsn, ...(l.gstPer != null ? { gstRate: l.gstPer, gstTaxLabel: `GST ${l.gstPer}%` } : {}) });
          maps.items.set(nameKey(l.item), item);
          result.createdItems += 1;
        }
        items.push({
          itemId: item._id, mts: l.mts, pcs: l.pcs, rate: l.rate, amount: l.amount,
          ...(l.gstPer != null ? { gstPer: l.gstPer } : {}), ...(l.hsn ? { hsn: l.hsn } : {}),
        });
      }
      const operationId = opIdFor(entity, companyId, bill);
      const taxable = Number(items.reduce((s, it) => s + it.amount, 0).toFixed(2));
      if (entity === 'salesBill') {
        await salesService.createInvoice({
          companyId, customerId: party._id, invoiceNo: bill.billNo, date: bill.date, items,
          taxableAmount: taxable, operationId, createdBy: userId,
        }, { operationId });
      } else {
        await purchaseService.createPurchase({
          companyId, supplierId: party._id, invoiceNo: 'AUTO', supplierInvoiceNo: bill.billNo, date: bill.date, items,
          taxableAmount: taxable, operationId, createdBy: userId,
        });
      }
      result.created += 1;
    } catch (err) {
      result.failed += 1;
      result.errors.push({ bill: bill.billNo, party: bill.party, error: err.message });
    }
  }
  return result;
}

module.exports = { preview, execute, suggestBillMappings, groupBills, parseDate, BILL_ENTITIES: ['salesBill', 'purchaseBill'] };
