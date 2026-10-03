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

/**
 * Intelligent Synonym Dictionary for Legacy ERP / Excel Column Matching.
 * Keys are canonical internal fields, values are matching keywords.
 */
const SYNONYM_MAP = {
  party: {
    name: [
      'party', 'party name', 'customer', 'customer name', 'account', 'account name',
      'ledger', 'ledger name', 'vendor', 'supplier', 'client', 'party name m',
      'party name english', 'party_name', 'account_name', 'particulars'
    ],
    type: [
      'type', 'party type', 'account type', 'group', 'account group', 'under group',
      'sundry debtors', 'sundry creditors', 'party_type'
    ],
    gstin: ['gstin', 'gst no', 'gst number', 'tin gst', 'gst in', 'gstin uin', 'gst', 'gst_no', 'tin'],
    pan: ['pan', 'pan no', 'pan number', 'pan card', 'pan_no'],
    mobile: ['mobile', 'phone', 'contact', 'mobile no', 'cell', 'whatsapp', 'phone no', 'contact no', 'tel', 'phone o', 'mobile_no'],
    email: ['email', 'e mail', 'email id', 'mail', 'email_id'],
    address: ['address', 'addr', 'billing address', 'office address', 'address 1', 'street', 'full address'],
    city: ['city', 'station', 'place', 'town', 'district', 'city name'],
    state: ['state', 'state name', 'province'],
    openingBalance: [
      'opening balance', 'op balance', 'op bal', 'balance', 'closing balance',
      'cur balance', 'opening bal', 'cl bal', 'dr amount', 'cr amount', 'balance rs', 'opening_balance'
    ],
    openingBalanceType: ['dr cr', 'dr cr type', 'drcr', 'balance type', 'bal type', 'type dr cr', 'dr or cr', 'dr_cr'],
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
    gstRate: ['gst', 'gst rate', 'tax', 'tax rate', 'gst percent', 'tax percent', 'igst', 'gst pct', 'gst_rate'],
    unit: ['unit', 'uom', 'measure', 'qty unit', 'measurement', 'base unit', 'units'],
    purchaseRate: ['purchase rate', 'cost', 'buy rate', 'purchase price', 'pur rate', 'cost price', 'cp', 'pur_rate'],
    salesRate: ['rate', 'sale rate', 'sales rate', 'selling price', 'mrp', 'sp', 'unit price', 'sale_rate'],
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
   * Normalizes raw row object to internal Party model schema.
   */
  normalizePartyRow(row, mappings = {}) {
    const raw = {};
    for (const [col, val] of Object.entries(row)) {
      const field = mappings[col] || col;
      if (field) raw[field] = val;
    }

    const name = String(raw.name || '').trim();
    if (!name) return { valid: false, error: 'Party Name is required' };

    let type = String(raw.type || 'Customer').trim();
    const typeUpper = type.toUpperCase();
    if (typeUpper.includes('CREDITOR') || typeUpper.includes('SUPPLIER') || typeUpper.includes('VENDOR')) {
      type = 'Supplier';
    } else if (typeUpper.includes('DEBTOR') || typeUpper.includes('CUSTOMER') || typeUpper.includes('CLIENT')) {
      type = 'Customer';
    } else if (typeUpper.includes('BROKER')) {
      type = 'Broker';
    } else if (typeUpper.includes('JOB') || typeUpper.includes('WORKER')) {
      type = 'Job Worker';
    } else if (typeUpper.includes('TRANSPORT')) {
      type = 'Transport';
    } else if (typeUpper.includes('BOTH')) {
      type = 'Both';
    } else {
      type = 'Customer';
    }

    let gstin = String(raw.gstin || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    let pan = String(raw.pan || '').trim().toUpperCase();
    if (!pan && gstin.length === 15) {
      pan = gstin.substring(2, 12);
    }

    let mobile = String(raw.mobile || '').replace(/[^0-9]/g, '');
    if (mobile.length > 10 && mobile.startsWith('91')) {
      mobile = mobile.substring(2);
    }

    const openingBalance = Math.abs(Number(raw.openingBalance || 0)) || 0;
    let openingBalanceType = 'Dr';
    const rawType = String(raw.openingBalanceType || '').trim().toUpperCase();
    if (rawType.includes('CR') || rawType === 'C') {
      openingBalanceType = 'Cr';
    }

    return {
      valid: true,
      data: {
        name,
        type,
        gstin,
        pan,
        mobile,
        email: String(raw.email || '').trim().toLowerCase(),
        address: String(raw.address || '').trim(),
        city: String(raw.city || '').trim(),
        state: String(raw.state || '').trim(),
        openingBalance,
        openingBalanceType,
        creditLimit: Number(raw.creditLimit || 0) || 0,
      },
    };
  }

  /**
   * Normalizes raw row object to internal Item model schema.
   */
  normalizeItemRow(row, mappings = {}) {
    const raw = {};
    for (const [col, val] of Object.entries(row)) {
      const field = mappings[col] || col;
      if (field) raw[field] = val;
    }

    const name = String(raw.name || '').trim();
    if (!name) return { valid: false, error: 'Item Name is required' };

    let category = 'Finished';
    const catRaw = String(raw.category || '').toUpperCase();
    if (catRaw.includes('GREY')) category = 'Grey';
    else if (catRaw.includes('FINISH')) category = 'Finished';
    else if (catRaw.includes('YARN')) category = 'Yarn';
    else if (catRaw) category = 'Others';

    let unit = String(raw.unit || 'MTRS').trim().toUpperCase();
    if (unit.startsWith('MTR') || unit === 'M') unit = 'MTRS';
    else if (unit.startsWith('PC')) unit = 'PCS';
    else if (unit.startsWith('KG')) unit = 'KGS';

    const hsnCode = String(raw.hsnCode || '').replace(/[^0-9]/g, '').trim();
    const gstRate = Number.isFinite(Number(raw.gstRate)) ? Number(raw.gstRate) : 5;
    const purchaseRate = Number(raw.purchaseRate || 0) || 0;
    const salesRate = Number(raw.salesRate || 0) || 0;
    const openingStock = Number(raw.openingStock || 0) || 0;
    const openingPcs = Number(raw.openingPcs || 0) || 0;
    const openingRate = Number(raw.openingRate || purchaseRate || 0) || 0;

    return {
      valid: true,
      data: {
        name,
        itemCode: String(raw.itemCode || '').trim(),
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
    const raw = {};
    for (const [col, val] of Object.entries(row)) {
      const field = mappings[col] || col;
      if (field) raw[field] = val;
    }

    const itemName = String(raw.itemName || raw.name || '').trim();
    if (!itemName) return { valid: false, error: 'Item Name is required' };

    const meters = Number(raw.meters || raw.openingStock || 0);
    if (!meters || meters <= 0) return { valid: false, error: 'Meters quantity must be > 0' };

    const pcs = Number(raw.pcs || raw.openingPcs || 0) || 0;
    const rate = Number(raw.rate || raw.openingRate || 0) || 0;
    const lotNo = String(raw.lotNo || '').trim();
    const warehouse = String(raw.warehouse || '').trim();

    return {
      valid: true,
      data: {
        itemName,
        meters,
        pcs,
        rate,
        lotNo,
        warehouse,
      },
    };
  }

  /**
   * Dry-Run Preview with Validation and Duplicate Detection.
   */
  async preview({ companyId, entity, rows = [], columnMappings = {} }) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw AppError.badRequest('Rows array is required');
    }

    const sampleLimit = Math.min(rows.length, 10);
    const sampleRows = [];
    const errors = [];
    let validCount = 0;
    let duplicateCount = 0;

    // Pre-fetch existing names to identify duplicates
    let existingNames = new Set();
    if (entity === 'party') {
      const existingParties = await Party.find({ companyId }, 'name').lean();
      existingNames = new Set(existingParties.map((p) => p.name.toLowerCase()));
    } else if (entity === 'item') {
      const existingItems = await Item.find({ companyId }, 'name').lean();
      existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()));
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let normalized;

      if (entity === 'party') {
        normalized = this.normalizePartyRow(row, columnMappings);
      } else if (entity === 'item') {
        normalized = this.normalizeItemRow(row, columnMappings);
      } else if (entity === 'openingStock') {
        normalized = this.normalizeOpeningStockRow(row, columnMappings);
      } else {
        throw AppError.badRequest(`Unknown entity: ${entity}`);
      }

      if (!normalized.valid) {
        errors.push({ row: i + 1, message: normalized.error });
      } else {
        const isDuplicate = existingNames.has(normalized.data.name?.toLowerCase());
        if (isDuplicate) {
          duplicateCount++;
        } else {
          validCount++;
        }

        if (sampleRows.length < sampleLimit) {
          sampleRows.push({
            ...normalized.data,
            _status: isDuplicate ? 'DUPLICATE_SKIP' : 'READY',
          });
        }
      }
    }

    return {
      entity,
      totalRows: rows.length,
      validRows: validCount,
      duplicateRows: duplicateCount,
      invalidRows: errors.length,
      sampleRows,
      errors: errors.slice(0, 50),
    };
  }

  /**
   * Commits the verified rows into the database.
   */
  async execute({ companyId, entity, rows = [], columnMappings = {}, options = {}, userId }) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw AppError.badRequest('Rows array is required');
    }

    const result = {
      entity,
      total: rows.length,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    if (entity === 'party') {
      for (let i = 0; i < rows.length; i++) {
        const norm = this.normalizePartyRow(rows[i], columnMappings);
        if (!norm.valid) {
          result.failed++;
          result.errors.push({ row: i + 1, error: norm.error });
          continue;
        }

        try {
          const exists = await Party.findOne({ companyId, name: norm.data.name });
          if (exists) {
            result.skipped++;
            continue;
          }

          await partyService.createParty({
            ...norm.data,
            companyId,
          });
          result.created++;
        } catch (err) {
          result.failed++;
          result.errors.push({ row: i + 1, error: err.message });
        }
      }
    } else if (entity === 'item') {
      let defaultWarehouse = await Warehouse.findOne({ companyId, isDefault: true }).lean();
      if (!defaultWarehouse) {
        defaultWarehouse = await Warehouse.findOne({ companyId }).lean();
      }

      for (let i = 0; i < rows.length; i++) {
        const norm = this.normalizeItemRow(rows[i], columnMappings);
        if (!norm.valid) {
          result.failed++;
          result.errors.push({ row: i + 1, error: norm.error });
          continue;
        }

        try {
          const exists = await Item.findOne({ companyId, name: norm.data.name });
          if (exists) {
            result.skipped++;
            continue;
          }

          const createdItem = await itemService.createItem({
            ...norm.data,
            companyId,
            defaultWarehouseId: defaultWarehouse?._id || null,
          });
          result.created++;

          // If opening stock > 0, generate opening lot & stock movement
          if (norm.data.openingStock > 0) {
            const lotCode = `OPN-${createdItem._id.toString().slice(-6)}-${Date.now()}`;
            const [lot] = await InventoryLot.create([
              {
                lotId: lotCode,
                itemId: createdItem._id,
                source: 'opening',
                totalPcs: norm.data.openingPcs || 0,
                remainingPcs: norm.data.openingPcs || 0,
                totalMtrs: norm.data.openingStock,
                remainingMtrs: norm.data.openingStock,
                warehouseId: defaultWarehouse?._id || null,
                rate: norm.data.openingRate || norm.data.purchaseRate || 0,
                companyId,
              },
            ]);

            await StockMovement.create([
              {
                lotId: lot._id,
                type: 'OPENING',
                qtyPcs: norm.data.openingPcs || 0,
                qtyMtrs: norm.data.openingStock,
                balanceMtrs: norm.data.openingStock,
                referenceId: lot._id,
                idempotencyKey: `OPENING:${lot._id}`,
                remarks: 'Bulk imported opening stock',
                companyId,
              },
            ]);
          }
        } catch (err) {
          result.failed++;
          result.errors.push({ row: i + 1, error: err.message });
        }
      }
    } else if (entity === 'openingStock') {
      const items = await Item.find({ companyId }).lean();
      const itemMap = new Map();
      items.forEach((it) => {
        itemMap.set(it.name.toLowerCase(), it);
        if (it.itemCode) itemMap.set(it.itemCode.toLowerCase(), it);
      });

      const warehouses = await Warehouse.find({ companyId }).lean();
      const whMap = new Map();
      warehouses.forEach((w) => {
        whMap.set(w.name.toLowerCase(), w._id);
        whMap.set(w.code.toLowerCase(), w._id);
      });
      const defaultWh = warehouses.find((w) => w.isDefault)?._id || warehouses[0]?._id || null;

      for (let i = 0; i < rows.length; i++) {
        const norm = this.normalizeOpeningStockRow(rows[i], columnMappings);
        if (!norm.valid) {
          result.failed++;
          result.errors.push({ row: i + 1, error: norm.error });
          continue;
        }

        const matchedItem = itemMap.get(norm.data.itemName.toLowerCase());
        if (!matchedItem) {
          result.failed++;
          result.errors.push({ row: i + 1, error: `Item "${norm.data.itemName}" not found in system` });
          continue;
        }

        const targetWhId = (norm.data.warehouse && whMap.get(norm.data.warehouse.toLowerCase())) || defaultWh;
        const lotCode = norm.data.lotNo || `OPN-${matchedItem._id.toString().slice(-6)}-${Date.now()}-${i}`;

        try {
          const [lot] = await InventoryLot.create([
            {
              lotId: lotCode,
              itemId: matchedItem._id,
              source: 'opening',
              totalPcs: norm.data.pcs,
              remainingPcs: norm.data.pcs,
              totalMtrs: norm.data.meters,
              remainingMtrs: norm.data.meters,
              warehouseId: targetWhId,
              rate: norm.data.rate || matchedItem.purchaseRate || 0,
              companyId,
            },
          ]);

          await StockMovement.create([
            {
              lotId: lot._id,
              type: 'OPENING',
              qtyPcs: norm.data.pcs,
              qtyMtrs: norm.data.meters,
              balanceMtrs: norm.data.meters,
              referenceId: lot._id,
              idempotencyKey: `OPENING:${lot._id}`,
              remarks: 'Bulk imported opening lot',
              companyId,
            },
          ]);

          await Item.findOneAndUpdate(
            { _id: matchedItem._id, companyId },
            { $inc: { openingStock: Number(norm.data.meters) } }
          );

          result.created++;
        } catch (err) {
          result.failed++;
          result.errors.push({ row: i + 1, error: err.message });
        }
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
