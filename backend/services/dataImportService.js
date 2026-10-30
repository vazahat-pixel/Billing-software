const mongoose = require('mongoose');
const Party = require('../models/Party');
const Item = require('../models/Item');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const Warehouse = require('../models/Warehouse');
const SubMaster = require('../models/SubMaster');
const partyService = require('./partyService');
const itemService = require('./itemService');
const auditService = require('./auditService');
const AppError = require('../utils/AppError');
const billImportService = require('./billImportService');
const { parseNumber, parseAmountWithSide, parseSide, parseGstRate } = require('../utils/importParsers');

/**
 * Intelligent Synonym Dictionary for Legacy ERP / Excel Column Matching.
 * Keys are canonical internal fields, values are matching keywords.
 */
const SYNONYM_MAP = {
  party: {
    name: [
      'party', 'party name', 'customer', 'customer name', 'account', 'account name',
      'ledger', 'ledger name', 'vendor', 'supplier', 'client', 'party name m',
      'party name english', 'party_name', 'account_name', 'particulars', 'name', 'ac name', 'a c name', 'name of party'
    ],
    type: [
      'type', 'party type', 'account type', 'group', 'account group', 'under group',
      'sundry debtors', 'sundry creditors', 'party_type'
    ],
    gstin: ['gstin', 'gst no', 'gst number', 'tin gst', 'gst in', 'gstin uin', 'gst', 'gst_no', 'tin', 'nw gst no', 'gstn no', 'gstn'],
    pan: ['pan', 'pan no', 'pan number', 'pan card', 'pan_no'],
    mobile: ['mobile', 'phone', 'contact', 'mobile no', 'cell', 'whatsapp', 'phone no', 'contact no', 'tel', 'mobile_no', 'mob'],
    email: ['email', 'e mail', 'email id', 'mail', 'email_id'],
    address: ['address', 'addr', 'billing address', 'office address', 'address 1', 'street', 'full address', 'add 1', 'address1', 'address line 1'],
    address2: ['address 2', 'add 2', 'address2', 'address line 2'],
    address3: ['address 3', 'add 3', 'address3', 'address line 3'],
    pincode: ['pincode', 'pin code', 'pin', 'zip', 'zip code', 'postal code'],
    stateCode: ['state code', 'statecode'],
    phoneO: ['phone o', 'phone office', 'office phone', 'telephone', 'tel no', 'phone no o'],
    phoneR: ['phone r', 'phone residence', 'residence phone', 'phone no r'],
    contactPerson: ['contact person', 'contact name', 'person'],
    dueDays: ['due days', 'credit days', 'credit period', 'payment days', 'due day'],
    city: ['city', 'station', 'place', 'town', 'district', 'city name'],
    state: ['state', 'state name', 'province'],
    openingBalance: [
      'opening balance', 'op balance', 'op bal', 'balance', 'closing balance',
      'cur balance', 'opening bal', 'cl bal', 'dr amount', 'cr amount', 'balance rs', 'opening_balance'
    ],
    openingBalanceType: ['dr cr', 'dr cr type', 'drcr', 'balance type', 'bal type', 'type dr cr', 'dr or cr', 'dr_cr', 'op drcr', 'op dr cr'],
    creditLimit: ['credit limit', 'cr limit', 'limit'],
  },
  item: {
    name: [
      'item', 'item name', 'product', 'product name', 'description', 'fabric',
      'particulars', 'goods', 'quality', 'item description', 'fabric quality',
      'goods description', 'item_name', 'quality name'
    ],
    itemCode: ['item code', 'code', 'product code', 'sku', 'barcode', 'art no', 'design no', 'item_code'],
    category: ['category', 'item group', 'group', 'nature', 'fabric type', 'type', 'item category'],
    hsnCode: ['hsn', 'hsn code', 'hsn sac', 'sac code', 'sac', 'hsncode', 'hsn_code', 'tariffs'],
    gstRate: ['gst', 'gst rate', 'tax', 'tax rate', 'gst percent', 'tax percent', 'igst', 'gst pct', 'gst_rate', 'gst per', 'tax slab', 'slab'],
    unit: ['unit', 'uom', 'measure', 'qty unit', 'measurement', 'base unit', 'units'],
    purchaseRate: ['purchase rate', 'cost', 'buy rate', 'purchase price', 'pur rate', 'cost price', 'cp', 'pur_rate', 'pu rate'],
    salesRate: ['rate', 'sale rate', 'sales rate', 'selling price', 'mrp', 'sp', 'unit price', 'sale_rate', 'sl rate'],
    openingStock: [
      'opening stock', 'op stock', 'stock', 'qty', 'opening qty', 'meters',
      'mtrs', 'opening meters', 'op qty', 'opening balance qty', 'total mtrs', 'opening_stock'
    ],
    openingPcs: ['pieces', 'pcs', 'op pcs', 'opening pieces', 'takas', 'rolls', 'lumps', 'opening_pcs', 'total pcs'],
    openingRate: ['opening rate', 'op rate', 'stock rate', 'cost rate', 'val rate', 'opening_rate'],
  },
  openingStock: {
    itemName: ['item', 'item name', 'product', 'quality', 'fabric', 'item_name'],
    lotNo: ['lot no', 'lot number', 'lot', 'bale no', 'roll no', 'thak no', 'batch no', 'lot id', 'lot_no'],
    warehouse: ['warehouse', 'godown', 'location', 'store', 'warehouse name'],
    meters: ['meters', 'mtrs', 'qty', 'total mtrs', 'quantity', 'stock mtrs'],
    pcs: ['pcs', 'pieces', 'total pcs', 'takas', 'rolls', 'thak'],
    rate: ['rate', 'cost', 'unit rate', 'purchase rate', 'val rate'],
  },
};

/** Normalizes any string for fuzzy header comparison */
function cleanHeader(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Auto-detects target field for a given column header.
 */
function findBestFieldMatch(headerName, entityType) {
  const cleaned = cleanHeader(headerName);
  if (!cleaned) return null;

  const entityFields = SYNONYM_MAP[entityType] || {};
  let bestField = null;
  let bestScore = 0;

  for (const [field, synonyms] of Object.entries(entityFields)) {
    for (const syn of synonyms) {
      if (cleaned === syn) {
        return { field, score: 1.0 }; // Exact match
      }
      if (cleaned.startsWith(syn) || cleaned.endsWith(syn)) {
        if (0.85 > bestScore) {
          bestScore = 0.85;
          bestField = field;
        }
      } else if (cleaned.includes(syn) || syn.includes(cleaned)) {
        if (0.7 > bestScore) {
          bestScore = 0.7;
          bestField = field;
        }
      }
    }
  }

  return bestField ? { field: bestField, score: bestScore } : null;
}

/**
 * Detects whether the headers look like Parties, Items, or Opening Stock.
 */
function detectEntityFromHeaders(headers = []) {
  const scores = { party: 0, item: 0, openingStock: 0 };
  for (const h of headers) {
    const pMatch = findBestFieldMatch(h, 'party');
    if (pMatch) scores.party += pMatch.score;

    const iMatch = findBestFieldMatch(h, 'item');
    if (iMatch) scores.item += iMatch.score;

    const oMatch = findBestFieldMatch(h, 'openingStock');
    if (oMatch) scores.openingStock += oMatch.score;
  }

  if (scores.party > scores.item && scores.party > scores.openingStock) return 'party';
  if (scores.openingStock > scores.item && scores.openingStock > scores.party) return 'openingStock';
  return 'item';
}

class DataImportService {
  /**
   * Analyzes raw table headers and suggests column mappings.
   */
  suggestMappings(headers = [], targetEntity = 'auto') {
    if (billImportService.BILL_ENTITIES.includes(targetEntity)) {
      return { detectedEntity: targetEntity, mappings: billImportService.suggestBillMappings(headers) };
    }
    const entity = targetEntity === 'auto' ? detectEntityFromHeaders(headers) : targetEntity;
    const mappings = {};
    const usedFields = new Set();

    headers.forEach((h) => {
      const match = findBestFieldMatch(h, entity);
      if (match && !usedFields.has(match.field)) {
        mappings[h] = match.field;
        usedFields.add(match.field);
      } else {
        mappings[h] = ''; // Unmapped / Ignore
      }
    });

    return { detectedEntity: entity, mappings };
  }

  /**
   * Picks the mapped fields out of one sheet row. Only columns the user mapped (or whose name already is a
   * field of this entity) are used: an unmapped column is ignored, never turned into a field.
   */
  mapRow(row, mappings = {}, entity) {
    const allowed = new Set(Object.keys(SYNONYM_MAP[entity] || {}));
    if (entity === 'openingStock') ['name', 'openingStock', 'openingPcs', 'openingRate'].forEach((k) => allowed.add(k));
    const raw = {};
    for (const [col, val] of Object.entries(row || {})) {
      if (col.startsWith('__')) continue;
      let field = null;
      if (Object.prototype.hasOwnProperty.call(mappings, col)) field = mappings[col];
      else if (allowed.has(col)) field = col;
      if (field && allowed.has(field)) raw[field] = val;
    }
    return raw;
  }

  /**
   * Normalizes raw row object to internal Party model schema.
   */
  normalizePartyRow(row, mappings = {}) {
    const raw = this.mapRow(row, mappings, 'party');
    const warnings = [];

    const name = String(raw.name ?? '').trim();
    if (!name) return { valid: false, error: 'Party Name is required' };

    const typeText = String(raw.type ?? '').trim();
    const typeUpper = typeText.toUpperCase();
    let type = 'Customer';
    let recognised = true;
    if (typeUpper.includes('CREDITOR') || typeUpper.includes('SUPPLIER') || typeUpper.includes('VENDOR')) type = 'Supplier';
    else if (typeUpper.includes('DEBTOR') || typeUpper.includes('CUSTOMER') || typeUpper.includes('CLIENT')) type = 'Customer';
    else if (typeUpper.includes('BROKER')) type = 'Broker';
    else if (typeUpper.includes('JOB') || typeUpper.includes('WORKER') || typeUpper.includes('MILL')) type = 'Job Worker';
    else if (typeUpper.includes('TRANSPORT')) type = 'Transport';
    else if (typeUpper.includes('BOTH')) type = 'Both';
    else if (typeUpper.includes('EMPLOYEE')) type = 'Employee';
    else if (typeUpper.includes('SALESMAN') || typeUpper.includes('AGENT')) type = typeUpper.includes('AGENT') ? 'Agent' : 'Salesman';
    else if (typeText) recognised = false;
    if (!recognised) warnings.push(`Group "${typeText}" is not a customer/supplier group; imported as Customer (A/c Head kept)`);

    const gstin = String(raw.gstin ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    let pan = String(raw.pan ?? '').trim().toUpperCase();
    if (!pan && gstin.length === 15) pan = gstin.substring(2, 12);

    let mobile = String(raw.mobile ?? '').replace(/[^0-9]/g, '');
    if (mobile.length > 10 && mobile.startsWith('91')) mobile = mobile.substring(2);

    // Opening balance: "1,50,000", "1,50,000 Cr", a separate Dr/Cr column, or a negative number.
    // No side given -> the party's natural side (customer owes us = Dr; supplier/mill/broker we owe = Cr).
    const amt = parseAmountWithSide(raw.openingBalance);
    if (amt.amount === null && raw.openingBalance !== undefined && String(raw.openingBalance).trim() !== '') {
      return { valid: false, error: `Opening balance "${raw.openingBalance}" is not a number` };
    }
    const openingBalance = amt.amount || 0;
    const naturalSide = ['Supplier', 'Job Worker', 'Broker', 'Transport', 'Agent', 'Employee'].includes(type) ? 'Cr' : 'Dr';
    let openingBalanceType = parseSide(raw.openingBalanceType) || amt.side;
    if (!openingBalanceType) {
      openingBalanceType = amt.negative ? (naturalSide === 'Dr' ? 'Cr' : 'Dr') : naturalSide;
      if (openingBalance) warnings.push(`No Dr/Cr given; opening balance taken as ${openingBalanceType}`);
    }

    const dueDays = parseNumber(raw.dueDays);
    const creditLimit = parseNumber(raw.creditLimit);
    return {
      valid: true,
      warnings,
      data: {
        name,
        type,
        // the original group text is kept as the A/c Head, nothing is lost
        group: typeText,
        gstin,
        pan,
        mobile,
        email: String(raw.email ?? '').trim().toLowerCase(),
        address: String(raw.address ?? '').trim(),
        address2: String(raw.address2 ?? '').trim(),
        address3: String(raw.address3 ?? '').trim(),
        city: String(raw.city ?? '').trim(),
        state: String(raw.state ?? '').trim(),
        stateCode: String(raw.stateCode ?? '').trim(),
        pincode: String(raw.pincode ?? '').replace(/[^0-9]/g, ''),
        phoneO: String(raw.phoneO ?? '').trim(),
        phoneR: String(raw.phoneR ?? '').trim(),
        contactPerson: String(raw.contactPerson ?? '').trim(),
        dueDays: dueDays && dueDays > 0 ? dueDays : 0,
        openingBalance,
        openingBalanceType,
        creditLimit: creditLimit && creditLimit > 0 ? creditLimit : 0,
      },
    };
  }

  /**
   * Normalizes raw row object to internal Item model schema.
   */
  normalizeItemRow(row, mappings = {}) {
    const raw = this.mapRow(row, mappings, 'item');
    const warnings = [];

    const name = String(raw.name ?? '').trim();
    if (!name) return { valid: false, error: 'Item Name is required' };

    let category = 'Finished';
    const catRaw = String(raw.category ?? '').toUpperCase();
    if (catRaw.includes('GREY') || catRaw.includes('GRAY')) category = 'Grey';
    else if (catRaw.includes('FINISH')) category = 'Finished';
    else if (catRaw.includes('YARN')) category = 'Yarn';
    else if (catRaw) category = 'Others';

    let unit = String(raw.unit ?? 'MTRS').trim().toUpperCase() || 'MTRS';
    if (unit.startsWith('MTR') || unit === 'M' || unit.startsWith('METER') || unit.startsWith('METRE') || unit === 'MTS') unit = 'MTRS';
    else if (unit.startsWith('PC') || unit.startsWith('PIECE')) unit = 'PCS';
    else if (unit.startsWith('KG') || unit.startsWith('KILO')) unit = 'KGS';

    const hsnCode = String(raw.hsnCode ?? '').replace(/[^0-9]/g, '').trim();
    const gstBlank = raw.gstRate === undefined || raw.gstRate === null || String(raw.gstRate).trim() === '';
    const gstRate = parseGstRate(raw.gstRate, 5);
    if (gstBlank) warnings.push('GST rate blank; 5% assumed');

    const num = (v) => { const n = parseNumber(v); return n !== null && n > 0 ? n : 0; };
    const purchaseRate = num(raw.purchaseRate);
    const salesRate = num(raw.salesRate);
    const openingStock = num(raw.openingStock);
    const openingPcs = num(raw.openingPcs);
    const openingRate = num(raw.openingRate) || purchaseRate;

    return {
      valid: true,
      warnings,
      data: {
        name,
        itemCode: String(raw.itemCode ?? '').trim(),
        category,
        hsnCode,
        gstRate,
        unit,
        purchaseRate,
        salesRate,
        openingStock,
        openingPcs,
        openingRate,
      },
    };
  }

  /**
   * Normalizes raw row object to Opening Stock Lot schema.
   */
  normalizeOpeningStockRow(row, mappings = {}) {
    const raw = this.mapRow(row, mappings, 'openingStock');

    const itemName = String(raw.itemName ?? raw.name ?? '').trim();
    if (!itemName) return { valid: false, error: 'Item Name is required' };

    const meters = parseNumber(raw.meters ?? raw.openingStock);
    if (!meters || meters <= 0) return { valid: false, error: 'Meters quantity must be > 0' };

    const num = (v) => { const n = parseNumber(v); return n !== null && n > 0 ? n : 0; };
    return {
      valid: true,
      warnings: [],
      data: {
        itemName,
        meters,
        pcs: num(raw.pcs ?? raw.openingPcs),
        rate: num(raw.rate ?? raw.openingRate),
        lotNo: String(raw.lotNo ?? '').trim(),
        warehouse: String(raw.warehouse ?? '').trim(),
      },
    };
  }

  /**
   * One plan for both Preview and Execute, so what the screen promises is what gets saved:
   * every row becomes READY, DUPLICATE (already there / repeated in the file) or INVALID (with the reason).
   * `companyId` = where masters live (the group's master company); `lotCompanyId` = company that owns stock lots.
   */
  async buildPlan({ companyId, lotCompanyId, entity, rows, columnMappings }) {
    const lc = (v) => String(v ?? '').trim().toLowerCase();
    const entries = [];
    const bad = (index, error) => entries.push({ index, status: 'INVALID', error });

    if (entity === 'party') {
      const existing = await Party.find({ companyId }, 'name gstin').lean();
      const names = new Set(existing.map((p) => lc(p.name)));
      const gstins = new Map(existing.filter((p) => p.gstin).map((p) => [String(p.gstin).toUpperCase(), p.name]));
      rows.forEach((row, index) => {
        const n = this.normalizePartyRow(row, columnMappings);
        if (!n.valid) return bad(index, n.error);
        const d = n.data;
        if (names.has(lc(d.name))) return entries.push({ index, status: 'DUPLICATE', data: d, warnings: n.warnings });
        if (d.gstin && gstins.has(d.gstin)) return bad(index, `GSTIN ${d.gstin} is already used by "${gstins.get(d.gstin)}"`);
        names.add(lc(d.name));
        if (d.gstin) gstins.set(d.gstin, d.name);
        return entries.push({ index, status: 'READY', data: d, warnings: n.warnings });
      });
    } else if (entity === 'item') {
      const existing = await Item.find({ companyId }, 'name itemCode').lean();
      const names = new Set(existing.map((i) => lc(i.name)));
      const codes = new Map(existing.filter((i) => i.itemCode).map((i) => [lc(i.itemCode), i.name]));
      rows.forEach((row, index) => {
        const n = this.normalizeItemRow(row, columnMappings);
        if (!n.valid) return bad(index, n.error);
        const d = n.data;
        if (names.has(lc(d.name))) return entries.push({ index, status: 'DUPLICATE', data: d, warnings: n.warnings });
        if (d.itemCode && codes.has(lc(d.itemCode))) return bad(index, `Item code ${d.itemCode} is already used by "${codes.get(lc(d.itemCode))}"`);
        names.add(lc(d.name));
        if (d.itemCode) codes.set(lc(d.itemCode), d.name);
        return entries.push({ index, status: 'READY', data: d, warnings: n.warnings });
      });
    } else if (entity === 'openingStock') {
      const items = await Item.find({ companyId }).lean();
      const itemMap = new Map();
      items.forEach((it) => {
        itemMap.set(lc(it.name), it);
        if (it.itemCode) itemMap.set(lc(it.itemCode), it);
      });
      const lots = await InventoryLot.find({ companyId: lotCompanyId, source: 'opening' }, 'itemId lotId').lean();
      const lotKeys = new Set(lots.map((l) => `${l.itemId}|${lc(l.lotId)}`));
      rows.forEach((row, index) => {
        const n = this.normalizeOpeningStockRow(row, columnMappings);
        if (!n.valid) return bad(index, n.error);
        const d = n.data;
        const item = itemMap.get(lc(d.itemName));
        if (!item) return bad(index, `Item "${d.itemName}" not found in system; import the Items first`);
        const key = `${item._id}|${lc(d.lotNo)}`;
        if (d.lotNo && lotKeys.has(key)) return entries.push({ index, status: 'DUPLICATE', data: { ...d, name: d.itemName }, warnings: n.warnings });
        if (d.lotNo) lotKeys.add(key);
        return entries.push({ index, status: 'READY', data: { ...d, name: d.itemName }, item, warnings: n.warnings });
      });
    } else {
      throw AppError.badRequest(`Unknown entity: ${entity}`);
    }
    return entries;
  }

  /**
   * Dry-Run Preview with Validation and Duplicate Detection.
   */
  async preview({ companyId, lotCompanyId, entity, rows = [], columnMappings = {} }) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw AppError.badRequest('Rows array is required');
    }
    if (billImportService.BILL_ENTITIES.includes(entity)) {
      return billImportService.preview({ companyId, entity, rows, columnMappings });
    }

    const entries = await this.buildPlan({ companyId, lotCompanyId: lotCompanyId || companyId, entity, rows, columnMappings });
    const sampleRows = [];
    const errors = [];
    const warnGroups = new Map();
    let validRows = 0;
    let duplicateRows = 0;
    let invalidRows = 0;
    for (const e of entries) {
      if (e.status === 'INVALID') {
        invalidRows += 1;
        if (errors.length < 50) errors.push({ row: e.index + 1, message: e.error, error: e.error });
        continue;
      }
      if (e.status === 'DUPLICATE') duplicateRows += 1; else validRows += 1;
      if (sampleRows.length < 10) sampleRows.push({ ...e.data, _status: e.status === 'DUPLICATE' ? 'DUPLICATE_SKIP' : 'READY' });
      for (const w of e.warnings || []) {
        const g = warnGroups.get(w) || { message: w, count: 0, rows: [] };
        g.count += 1;
        if (g.rows.length < 5) g.rows.push(e.index + 1);
        warnGroups.set(w, g);
      }
    }
    // one line per kind of note (with how many rows and the first few), not one per row
    return { entity, totalRows: rows.length, validRows, duplicateRows, invalidRows, sampleRows, errors, warnings: [...warnGroups.values()] };
  }

  /**
   * Commits the verified rows into the database.
   */
  async execute({ companyId, lotCompanyId, entity, rows = [], columnMappings = {}, options = {}, userId }) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw AppError.badRequest('Rows array is required');
    }

    if (billImportService.BILL_ENTITIES.includes(entity)) {
      const billResult = await billImportService.execute({ companyId, entity, rows, columnMappings, options, userId });
      await auditService.logSystem({
        companyId, userId, action: 'DATA_IMPORT', module: entity, before: null,
        after: { created: billResult.created, skipped: billResult.skipped, failed: billResult.failed },
        reason: `Old data import: ${entity}`,
      });
      return billResult;
    }

    const stockCompanyId = lotCompanyId || companyId;
    const entries = await this.buildPlan({ companyId, lotCompanyId: stockCompanyId, entity, rows, columnMappings });
    const result = { entity, total: rows.length, created: 0, skipped: 0, failed: 0, errors: [] };
    const fail = (e, message) => {
      result.failed += 1;
      result.errors.push({ row: e.index + 1, error: message, message });
    };

    let defaultWarehouse = null;
    let warehouses = [];
    if (entity === 'item') {
      defaultWarehouse = (await Warehouse.findOne({ companyId, isDefault: true }).lean()) || (await Warehouse.findOne({ companyId }).lean());
    } else if (entity === 'openingStock') {
      warehouses = await Warehouse.find({ companyId }).lean();
    }
    const whMap = new Map();
    warehouses.forEach((w) => {
      whMap.set(String(w.name).toLowerCase(), w._id);
      whMap.set(String(w.code).toLowerCase(), w._id);
    });
    const defaultWh = warehouses.find((w) => w.isDefault)?._id || warehouses[0]?._id || null;

    for (const e of entries) {
      if (e.status === 'INVALID') { fail(e, e.error); continue; }
      if (e.status === 'DUPLICATE') { result.skipped += 1; continue; }

      try {
        if (entity === 'party') {
          await partyService.createParty({ ...e.data, companyId });
          result.created += 1;
        } else if (entity === 'item') {
          const createdItem = await itemService.createItem({
            ...e.data,
            companyId,
            defaultWarehouseId: defaultWarehouse?._id || null,
          });
          result.created += 1;

          // opening stock on the item row -> an opening lot + movement (the item master already carries the figure)
          if (e.data.openingStock > 0) {
            try {
              const lotCode = `OPN-${createdItem._id.toString().slice(-6)}-${Date.now()}`;
              const [lot] = await InventoryLot.create([{
                lotId: lotCode,
                itemId: createdItem._id,
                source: 'opening',
                totalPcs: e.data.openingPcs || 0,
                remainingPcs: e.data.openingPcs || 0,
                totalMtrs: e.data.openingStock,
                remainingMtrs: e.data.openingStock,
                warehouseId: defaultWarehouse?._id || null,
                rate: e.data.openingRate || e.data.purchaseRate || 0,
                companyId: stockCompanyId,
              }]);
              await StockMovement.create([{
                lotId: lot._id,
                type: 'OPENING',
                qtyPcs: e.data.openingPcs || 0,
                qtyMtrs: e.data.openingStock,
                balanceMtrs: e.data.openingStock,
                referenceId: lot._id,
                idempotencyKey: `OPENING:${lot._id}`,
                remarks: 'Bulk imported opening stock',
                companyId: stockCompanyId,
              }]);
            } catch (lotErr) {
              // the item exists; say clearly that only its opening lot failed (was counted as both before)
              result.created -= 1;
              fail(e, `Item saved but its opening stock lot failed: ${lotErr.message}`);
            }
          }
        } else if (entity === 'openingStock') {
          const targetWhId = (e.data.warehouse && whMap.get(e.data.warehouse.toLowerCase())) || defaultWh;
          const lotCode = e.data.lotNo || `OPN-${e.item._id.toString().slice(-6)}-${Date.now()}-${e.index}`;
          const [lot] = await InventoryLot.create([{
            lotId: lotCode,
            itemId: e.item._id,
            source: 'opening',
            totalPcs: e.data.pcs,
            remainingPcs: e.data.pcs,
            totalMtrs: e.data.meters,
            remainingMtrs: e.data.meters,
            warehouseId: targetWhId,
            rate: e.data.rate || e.item.purchaseRate || 0,
            companyId: stockCompanyId,
          }]);
          await StockMovement.create([{
            lotId: lot._id,
            type: 'OPENING',
            qtyPcs: e.data.pcs,
            qtyMtrs: e.data.meters,
            balanceMtrs: e.data.meters,
            referenceId: lot._id,
            idempotencyKey: `OPENING:${lot._id}`,
            remarks: 'Bulk imported opening lot',
            companyId: stockCompanyId,
          }]);
          // the stock report reads the item's opening figures, so they must follow the lots
          await Item.findOneAndUpdate(
            { _id: e.item._id, companyId },
            { $inc: { openingStock: e.data.meters, openingQty: e.data.meters, openingPcs: e.data.pcs } },
          );
          result.created += 1;
        }
      } catch (err) {
        fail(e, err.message);
      }
    }

    await auditService.logSystem({
      companyId,
      userId,
      action: 'DATA_IMPORT',
      module: entity,
      before: null,
      after: { created: result.created, skipped: result.skipped, failed: result.failed },
      reason: `Bulk ${entity} data import`,
    });

    return result;
  }
}

module.exports = new DataImportService();
