const Party = require('../models/Party');
const Item = require('../models/Item');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const InventoryLot = require('../models/InventoryLot');
const FinancialYear = require('../models/FinancialYear');
const Warehouse = require('../models/Warehouse');
const AppError = require('../utils/AppError');
const duplicateDetection = require('./duplicateDetectionService');
const outstandingRefresh = require('./outstandingRefreshService');
const { availableMtrs, assertLotIssuable } = require('../utils/inventoryStockHelper');

/** Indian GSTIN: 15 chars, state(2)+PAN(10)+entity(1)+Z+check(1) */
function isValidGstin(gstin) {
  if (!gstin || !String(gstin).trim()) return true; // empty allowed (unregistered)
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(String(gstin).toUpperCase());
}

/**
 * Central pre-save business validation — Sprint 2.9.
 * @returns {{ ok: boolean, errors: Array<{code,message}>, warnings: Array }}
 */
async function validateBusiness(context = {}) {
  const {
    module,
    action = 'create',
    companyId,
    payload = {},
    options = {},
  } = context;

  const errors = [];
  const warnings = [];
  const pushErr = (code, message) => errors.push({ code, message });
  const pushWarn = (code, message) => warnings.push({ code, message });

  if (!companyId) pushErr('NO_COMPANY', 'companyId required');

  // ─── FY lock ───────────────────────────────────────────────
  if (!options.skipFy) {
    const lockedFy = await FinancialYear.findOne({ companyId, isLocked: true, isActive: true }).lean();
    if (lockedFy) {
      pushErr('FY_LOCKED', `Financial year ${lockedFy.code} is locked`);
    }
  }

  // ─── Party checks ──────────────────────────────────────────
  const partyId = payload.customerId || payload.supplierId || payload.partyId || payload.workerId;
  if (partyId && !options.skipParty) {
    const party = await Party.findOne({ _id: partyId, companyId });
    if (!party) pushErr('PARTY_NOT_FOUND', 'Party not found');
    else {
      if (party.status && party.status === 'Inactive') {
        pushErr('PARTY_INACTIVE', `Party ${party.name} is Inactive`);
      }
      if (party.gstin && !isValidGstin(party.gstin)) {
        pushErr('INVALID_GSTIN', `Invalid GSTIN format: ${party.gstin}`);
      }
      if (module === 'sales' && action === 'create' && party.creditLimit > 0) {
        const bal = await outstandingRefresh.refreshPartyOutstanding(companyId, partyId);
        const add = Number(payload.netAmount || payload.totalAmount || 0);
        if (bal.receivable + add > party.creditLimit && !options.allowCreditOverride) {
          pushErr(
            'CREDIT_LIMIT',
            `Credit limit ₹${party.creditLimit} exceeded (outstanding ₹${bal.receivable.toFixed(2)} + ₹${add})`
          );
        }
      }
    }
  }

  // ─── Duplicate invoice ─────────────────────────────────────
  if ((module === 'sales' || module === 'purchase') && action === 'create' && !options.skipDuplicate) {
    const hits =
      module === 'sales'
        ? await duplicateDetection.findSalesDuplicates(companyId, {
            customerId: payload.customerId,
            netAmount: payload.netAmount,
            invoiceNo: payload.invoiceNo && payload.invoiceNo !== 'AUTO' ? payload.invoiceNo : null,
            windowHours: 24,
          })
        : await duplicateDetection.findPurchaseDuplicates(companyId, {
            supplierId: payload.supplierId,
            netAmount: payload.netAmount,
            invoiceNo: payload.invoiceNo && payload.invoiceNo !== 'AUTO' ? payload.invoiceNo : null,
            windowHours: 24,
          });
    if (hits.length && payload.invoiceNo && payload.invoiceNo !== 'AUTO') {
      const exact = hits.find((h) => h.invoiceNo === payload.invoiceNo);
      if (exact) pushErr('DUPLICATE_INVOICE', `Duplicate invoice number ${payload.invoiceNo}`);
      else pushWarn('DUPLICATE_SOFT', `Possible duplicate document in last 24h (${hits.length})`);
    } else if (hits.length) {
      pushWarn('DUPLICATE_SOFT', `Possible duplicate document in last 24h (${hits.length})`);
    }
  }

  // ─── Items / lots / stock ──────────────────────────────────
  const lines = payload.items || payload.lines || [];
  for (const line of lines) {
    if (line.itemId) {
      const item = await Item.findOne({ _id: line.itemId, companyId });
      if (!item) pushErr('ITEM_NOT_FOUND', `Item ${line.itemId} not found`);
      else if (item.isDeleted) pushErr('ITEM_DELETED', `Item ${item.name} is deleted`);
    }
    if (line.lotId && (module === 'sales' || module === 'job' || action === 'issue')) {
      const lot = await InventoryLot.findOne({ _id: line.lotId, companyId });
      if (!lot) {
        pushErr('LOT_NOT_FOUND', `Lot ${line.lotId} not found`);
        continue;
      }
      try {
        assertLotIssuable(lot);
      } catch (e) {
        pushErr('LOT_NOT_ISSUABLE', e.message);
      }
      const need = Number(line.mts || line.qty || 0);
      if (need > 0 && availableMtrs(lot) + 0.0001 < need) {
        pushErr(
          'NEGATIVE_STOCK',
          `Insufficient available stock on lot ${lot.lotId}: need ${need}, available ${availableMtrs(lot)}`
        );
      }
      if (payload.warehouseId && lot.warehouseId && String(lot.warehouseId) !== String(payload.warehouseId)) {
        pushWarn('WAREHOUSE_MISMATCH', `Lot ${lot.lotId} not in requested warehouse`);
      }
    }
  }

  if (payload.warehouseId) {
    const wh = await Warehouse.findOne({ _id: payload.warehouseId, companyId });
    if (!wh) pushErr('WAREHOUSE_NOT_FOUND', 'Warehouse not found');
  }

  // ─── Unbalanced journal ────────────────────────────────────
  if (module === 'journal' || payload.voucherType === 'Journal') {
    const jl = payload.lines || [];
    const dr = jl.filter((l) => l.type === 'Dr').reduce((s, l) => s + Number(l.amount || 0), 0);
    const cr = jl.filter((l) => l.type === 'Cr').reduce((s, l) => s + Number(l.amount || 0), 0);
    if (Math.abs(dr - cr) > 0.05) {
      pushErr('UNBALANCED_JOURNAL', `Journal unbalanced: Dr ${dr.toFixed(2)} ≠ Cr ${cr.toFixed(2)}`);
    }
  }

  // ─── Closed / cancelled voucher edit ───────────────────────
  if (action === 'update' && payload._id) {
    if (module === 'sales') {
      const s = await Sales.findOne({ _id: payload._id, companyId }).select('status');
      if (s?.status === 'cancelled') pushErr('VOUCHER_CLOSED', 'Cancelled sales voucher cannot be updated');
    }
    if (module === 'purchase') {
      const p = await Purchase.findOne({ _id: payload._id, companyId }).select('status');
      if (p?.status === 'cancelled') pushErr('VOUCHER_CLOSED', 'Cancelled purchase voucher cannot be updated');
    }
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings, module, action };
}

/** Throw AppError if validation fails (blocking errors only) */
async function assertBusinessValid(context) {
  const result = await validateBusiness(context);
  if (!result.ok) {
    throw AppError.badRequest(
      result.errors.map((e) => e.message).join('; '),
      result.errors
    );
  }
  return result;
}

module.exports = {
  validateBusiness,
  assertBusinessValid,
  isValidGstin,
};
