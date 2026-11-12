'use strict';

/**
 * Purchase stock as JSM's three Purchase Stock screens read it: what came in on a purchase bill,
 * what has gone back out of it, and what is still lying there.
 *
 * JSM builds TMP_VW_PUR_STK from T_PURCHASE joined to its first item line (`SR_NO='1'`), the mill
 * challans raised against that bill (I_MILL_CH / I_MILL_CH_DTL, keyed on PU_CODE + PU_BILLNO) and
 * the purchase returns against it (T_PU_RETU), and works out
 *
 *   ISS_MTS  = the challans' own issued quantity
 *   BILL_MTS = issued + returned
 *   STK_MTS  = A.TO_QTY - issued - returned
 *
 * Here a mill issue names the lot it took, and a lot names the purchase it came from, so the
 * issues against a bill are the issues against its lots — the same link, through the stock rather
 * than through a stored bill number. The lot also carries what is left of it, which is what the
 * Godown screen prints.
 */
const { round } = require('../jcEngine');

/** One row per purchase bill: the bill, its first line, and the movement out of it. */
async function loadPurchaseStockRows(companyId) {
  const Purchase = require('../../../models/Purchase');
  const InventoryLot = require('../../../models/InventoryLot');
  const Job = require('../../../models/Job');
  const ReturnInvoice = require('../../../models/ReturnInvoice');
  require('../../../models/Party');
  require('../../../models/Item');
  require('../../../models/Warehouse');

  const [purchases, lots, jobs, returns] = await Promise.all([
    Purchase.find({ companyId })
      .populate('supplierId', 'name city station')
      .populate('items.itemId', 'name')
      .populate('warehouseId', 'name')
      .lean(),
    InventoryLot.find({ companyId, purchaseId: { $ne: null } })
      .populate('itemId', 'name')
      .lean(),
    Job.find({ companyId, status: { $ne: 'Cancelled' } }).select('lotId issuePcs issueQty challanNo issueDate').lean(),
    ReturnInvoice.find({ companyId, returnType: 'Purchase' }).select('originalInvoiceNo items').lean(),
  ]);

  const lotsOf = new Map();
  for (const l of lots) {
    const key = String(l.purchaseId);
    if (!lotsOf.has(key)) lotsOf.set(key, []);
    lotsOf.get(key).push(l);
  }

  const lotById = new Map(lots.map((l) => [String(l._id), l]));
  /** Mill issues gathered against the purchase the issued lot came from. */
  const issuedOf = new Map();
  for (const j of jobs) {
    const lot = j.lotId ? lotById.get(String(j.lotId)) : null;
    if (!lot) continue;
    const key = String(lot.purchaseId);
    const at = issuedOf.get(key) || { pcs: 0, qty: 0, challans: [] };
    at.pcs += Number(j.issuePcs || 0);
    at.qty += Number(j.issueQty || 0);
    at.challans.push({ no: String(j.challanNo || ''), date: j.issueDate || null });
    issuedOf.set(key, at);
  }

  /** Purchase returns gathered against the bill they were raised on. */
  const returnedOf = new Map();
  for (const r of returns) {
    const key = String(r.originalInvoiceNo ?? '').trim();
    if (!key) continue;
    const qty = (r.items || []).reduce((t, it) => t + Number(it.mts || 0), 0);
    const pcs = (r.items || []).reduce((t, it) => t + Number(it.pcs || 0), 0);
    const at = returnedOf.get(key) || { pcs: 0, qty: 0 };
    at.pcs += pcs;
    at.qty += qty;
    returnedOf.set(key, at);
  }

  return purchases.map((d) => {
    const first = (d.items || [])[0] || {};
    const id = String(d._id);
    const billNo = String(d.invoiceNo || d.billNo || '').trim();
    const iss = issuedOf.get(id) || { pcs: 0, qty: 0, challans: [] };
    const rtn = returnedOf.get(billNo) || { pcs: 0, qty: 0 };
    const myLots = lotsOf.get(id) || [];

    const PU_PCS = (d.items || []).reduce((t, it) => t + Number(it.pcs || 0), 0);
    const PU_MTS = round((d.items || []).reduce((t, it) => t + Number(it.mts || 0), 0));
    const ISS_MTS = round(iss.qty);
    const BILL_MTS = round(iss.qty + rtn.qty);
    const challan = iss.challans[0] || { no: '', date: null };

    return {
      ENT_NO: id,
      CO_ENT_NO: id,
      SRAL_NO: billNo,
      BILL_NO: billNo,
      NCBILL_NO: billNo,
      BILL_DATE: d.date,
      PARTY: d.supplierId?.name || '',
      ST_NAME: d.supplierId?.city || d.supplierId?.station || '',
      ITEM: first.itemId?.name || '',
      BOOK: 'PURCHASE',
      REGISTER: 'PURCHASE',
      GODOWN: d.warehouseId?.name || '',
      LRNO: d.lrNo || '',
      SP_TYPE: d.transport || '',
      PU_PCS,
      PU_MTS,
      PU_RATE: round(first.rate),
      NET_TOT: round(d.netAmount ?? d.totals?.total ?? d.totalAmount ?? 0),
      CH_NO: challan.no,
      CHLN_DATE: challan.date,
      ISS_PCS: iss.pcs,
      ISS_MTS,
      RTN_PCS: rtn.pcs,
      RTN_MTS: round(rtn.qty),
      BILL_MTS,
      STK_PCS: PU_PCS - iss.pcs - rtn.pcs,
      STK_MTS: round(PU_MTS - BILL_MTS),
      // What the lots of this bill say — the Godown screen's own figures.
      G_PCS: myLots.reduce((t, l) => t + Number(l.totalPcs || 0), 0),
      G_QTY: round(myLots.reduce((t, l) => t + Number(l.totalMtrs || 0), 0)),
      BAL_PCS: myLots.reduce((t, l) => t + Number(l.remainingPcs || 0), 0),
      BAL_QTY: round(myLots.reduce((t, l) => t + Number(l.remainingMtrs || 0), 0)),
      _lots: myLots.map((l) => ({
        GP_NO: l.lotId || '',
        ITEM: l.itemId?.name || first.itemId?.name || '',
        G_PCS: Number(l.totalPcs || 0),
        G_QTY: round(l.totalMtrs),
        BAL_PCS: Number(l.remainingPcs || 0),
        BAL_QTY: round(l.remainingMtrs),
        ISS_PCS: Number(l.totalPcs || 0) - Number(l.remainingPcs || 0),
        ISS_QTY: round(Number(l.totalMtrs || 0) - Number(l.remainingMtrs || 0)),
      })),
    };
  });
}

/**
 * Mill challans that name no purchase bill — JSM's "With Unadjust" rows, which it unions in under
 * the party name UNADJUST (Pur_String: `WHERE … AND A.PU_BILLNO=''`).
 */
async function loadUnadjustedIssueRows(companyId) {
  const Job = require('../../../models/Job');
  const InventoryLot = require('../../../models/InventoryLot');
  require('../../../models/Item');

  const jobs = await Job.find({ companyId, status: { $ne: 'Cancelled' } })
    .populate({ path: 'lotId', select: 'lotId itemId purchaseId', populate: { path: 'itemId', select: 'name' } })
    .select('lotId issuePcs issueQty challanNo issueDate')
    .lean();

  return jobs
    .filter((j) => !j.lotId?.purchaseId)
    .map((j) => ({
      ENT_NO: String(j._id),
      CO_ENT_NO: String(j._id),
      SRAL_NO: String(j.challanNo || ''),
      BILL_NO: String(j.challanNo || ''),
      NCBILL_NO: String(j.challanNo || ''),
      BILL_DATE: j.issueDate,
      PARTY: 'UNADJUST',
      ST_NAME: '',
      ITEM: j.lotId?.itemId?.name || '',
      BOOK: 'PURCHASE',
      REGISTER: 'PURCHASE',
      GODOWN: '',
      LRNO: '',
      SP_TYPE: '',
      PU_PCS: 0,
      PU_MTS: 0,
      PU_RATE: 0,
      NET_TOT: 0,
      CH_NO: String(j.challanNo || ''),
      CHLN_DATE: j.issueDate,
      ISS_PCS: Number(j.issuePcs || 0),
      ISS_MTS: round(j.issueQty),
      RTN_PCS: 0,
      RTN_MTS: 0,
      BILL_MTS: round(j.issueQty),
      STK_PCS: Number(j.issuePcs || 0),
      STK_MTS: round(j.issueQty),
      G_PCS: 0,
      G_QTY: 0,
      BAL_PCS: 0,
      BAL_QTY: 0,
      _lots: [],
    }));
}

module.exports = { loadPurchaseStockRows, loadUnadjustedIssueRows };
