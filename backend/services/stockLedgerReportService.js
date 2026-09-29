const Purchase = require('../models/Purchase');
const Sales = require('../models/Sales');
const ReturnInvoice = require('../models/ReturnInvoice');
const Job = require('../models/Job');
const Item = require('../models/Item');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function dayBounds(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  const year = y || new Date().getUTCFullYear();
  const month = (m || 1) - 1;
  const day = d || 1;
  return {
    start: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, day, 23, 59, 59, 999)),
  };
}

function fyStartUtc(iso) {
  const [y, m] = String(iso || '').slice(0, 10).split('-').map(Number);
  const year = y || new Date().getUTCFullYear();
  const month = m || 1;
  const startYear = month >= 4 ? year : year - 1;
  return new Date(Date.UTC(startYear, 3, 1));
}

function inSpan(date, from, to) {
  if (!date) return false;
  const t = new Date(date).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function beforeDay(date, from) {
  if (!date) return false;
  return new Date(date).getTime() < from.getTime();
}

function isKgUnit(unit) {
  return /kg/i.test(String(unit || ''));
}

function isJobWork(processType) {
  const p = String(processType || '');
  return /job\s*work|jobwork/i.test(p) && !/process/i.test(p);
}

/** Meters, fold meters, kgs or pcs from a bill line. Kgs never borrow meter qty. */
function lineQty(line, basis, foldWise) {
  const unit = String(line?.unit || '');
  const mts = Number(line?.mts || 0);
  const fold = Number(line?.fold || 0);
  const pcs = Number(line?.pcs || 0);
  const kgs = (line?.pcsDetails || []).reduce((sum, row) => sum + Number(row?.kgs || 0), 0);
  if (basis === 'pcs') return pcs;
  if (basis === 'kgs') {
    if (kgs) return kgs;
    if (isKgUnit(unit)) return foldWise && fold ? fold : mts;
    return 0;
  }
  if (isKgUnit(unit) && !/mtr|mts|meter/i.test(unit)) return 0;
  if (foldWise && fold) return fold;
  return mts;
}

function openingQty(item, basis) {
  if (!item) return 0;
  if (basis === 'pcs') return Number(item.openingPcs || 0);
  if (basis === 'kgs') return isKgUnit(item.unit) ? Number(item.openingQty || item.openingStock || 0) : 0;
  if (isKgUnit(item.unit)) return 0;
  const qty = Number(item.openingQty || 0);
  return qty || Number(item.openingStock || 0);
}

function catOf(item) {
  const cat = String(item?.category || '');
  if (cat === 'Grey') return 'grey';
  if (cat === 'Finished') return 'finish';
  if (cat === 'Yarn' || cat === 'Others') return 'ni';
  return 'other';
}

function section(title, pairs) {
  const rows = pairs.map(([label, qty, strong]) => ({
    label,
    qty: round2(qty),
    strong: !!strong,
  }));
  return { title, rows };
}

/**
 * Stock meter / kgs movement and shop-mill balances from posted bills and jobs.
 * As-on date is the end of that day. Flow lines are the financial year up to that day.
 * Opening is the item master opening (not a second copy of this year's purchases).
 */
async function getStockLedgerReport(companyId, options = {}) {
  const asOn = String(options.asOn || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const basis = ['kgs', 'pcs'].includes(options.basis) ? options.basis : 'mts';
  const foldWise = options.foldWise === true || options.foldWise === 'true' || options.foldWise === '1';
  const withJobWork = !(options.withJobWork === false || options.withJobWork === 'false' || options.withJobWork === '0');
  const scope = ['grey', 'mill', 'finish', 'job', 'ni'].includes(options.scope) ? options.scope : 'all';
  const { end } = dayBounds(asOn);
  const from = fyStartUtc(asOn);

  const [items, lots, purchases, sales, returns, jobs, movements] = await Promise.all([
    Item.find({ companyId }).select('name category unit openingQty openingPcs openingStock openingRate').lean(),
    InventoryLot.find({ companyId }).select('lotId itemId rate createdAt totalMtrs totalPcs remainingMtrs remainingPcs').lean(),
    Purchase.find({ companyId, status: { $ne: 'cancelled' }, date: { $lte: end } }).select('date items').lean(),
    Sales.find({ companyId, status: { $ne: 'cancelled' }, date: { $lte: end } }).select('date items').lean(),
    ReturnInvoice.find({ companyId, date: { $lte: end } }).select('date returnType items').lean(),
    Job.find({ companyId, status: { $ne: 'Cancelled' } }).select('processType lotId outputItemId issueQty receivedQty wastage issuePcs receivedPcs issueDate receiveDate jobCardNo challanNo workerId').lean(),
    StockMovement.find({ companyId, createdAt: { $lte: end } }).select('lotId qtyMtrs qtyPcs').lean(),
  ]);

  const itemMap = new Map(items.map((item) => [String(item._id), item]));
  const lotMap = new Map(lots.map((lot) => [String(lot._id), lot]));

  const add = (bucket, key, qty) => {
    bucket[key] = (bucket[key] || 0) + (Number(qty) || 0);
  };

  const flow = {
    greyPurchase: 0, greyMillReturn: 0, greyReturn: 0, greyIssue: 0, greySales: 0, greySalesRtn: 0,
    millIssue: 0, millDamage: 0, millReturn: 0, millReceiveFinish: 0,
    millOpenIssue: 0, millOpenReceive: 0, millOpenWaste: 0,
    kfIssue: 0, kfReceipt: 0, kfShort: 0, kfOpenIssue: 0, kfOpenReceipt: 0, kfOpenShort: 0,
    finPurchase: 0, finPuReturn: 0, finSales: 0, finSlReturn: 0, finProcess: 0,
    jobIssue: 0, jobReceipt: 0,
    niPurchase: 0, niSales: 0, niSlReturn: 0, niPuReturn: 0,
  };

  const bumpDoc = (doc, kind) => {
    if (!inSpan(doc.date, from, end)) return;
    for (const line of doc.items || []) {
      const item = itemMap.get(String(line.itemId?._id || line.itemId || ''));
      const cat = catOf(item);
      const qty = lineQty(line, basis, foldWise);
      if (!qty || cat === 'other') continue;
      if (kind === 'purchase' && cat === 'grey') add(flow, 'greyPurchase', qty);
      if (kind === 'purchase' && cat === 'finish') add(flow, 'finPurchase', qty);
      if (kind === 'purchase' && cat === 'ni') add(flow, 'niPurchase', qty);
      if (kind === 'sale' && cat === 'grey') add(flow, 'greySales', qty);
      if (kind === 'sale' && cat === 'finish') add(flow, 'finSales', qty);
      if (kind === 'sale' && cat === 'ni') add(flow, 'niSales', qty);
      if (kind === 'salesReturn' && cat === 'grey') add(flow, 'greySalesRtn', qty);
      if (kind === 'salesReturn' && cat === 'finish') add(flow, 'finSlReturn', qty);
      if (kind === 'salesReturn' && cat === 'ni') add(flow, 'niSlReturn', qty);
      if (kind === 'purchaseReturn' && cat === 'grey') add(flow, 'greyReturn', qty);
      if (kind === 'purchaseReturn' && cat === 'finish') add(flow, 'finPuReturn', qty);
      if (kind === 'purchaseReturn' && cat === 'ni') add(flow, 'niPuReturn', qty);
    }
  };

  purchases.forEach((doc) => bumpDoc(doc, 'purchase'));
  sales.forEach((doc) => bumpDoc(doc, 'sale'));
  returns.forEach((doc) => bumpDoc(doc, doc.returnType === 'Purchase' ? 'purchaseReturn' : 'salesReturn'));

  const jobQty = (job, field) => (basis === 'pcs'
    ? Number(field === 'issue' ? job.issuePcs : job.receivedPcs) || 0
    : basis === 'kgs'
      ? 0
      : Number(field === 'issue' ? job.issueQty : job.receivedQty) || 0);

  jobs.forEach((job) => {
    const lot = lotMap.get(String(job.lotId || ''));
    const source = itemMap.get(String(lot?.itemId || ''));
    const output = itemMap.get(String(job.outputItemId || ''));
    const sourceCat = catOf(source);
    const outputCat = output ? catOf(output) : 'finish';
    const jobWork = isJobWork(job.processType);
    const issued = jobQty(job, 'issue');
    const received = jobQty(job, 'receive');
    const waste = basis === 'mts' ? Number(job.wastage || 0) : 0;
    const issuedIn = inSpan(job.issueDate, from, end);
    const receivedIn = job.receiveDate && inSpan(job.receiveDate, from, end);
    const issuedBefore = beforeDay(job.issueDate, from);
    const receivedBefore = job.receiveDate && beforeDay(job.receiveDate, from);

    if (sourceCat === 'grey' && !jobWork) {
      if (issuedIn) {
        add(flow, 'greyIssue', issued);
        add(flow, 'millIssue', issued);
      }
      if (issuedBefore) add(flow, 'millOpenIssue', issued);
      if (receivedIn) {
        if (outputCat === 'grey') {
          add(flow, 'greyMillReturn', received);
          add(flow, 'millReturn', received);
        } else {
          add(flow, 'millReceiveFinish', received);
          add(flow, 'finProcess', received);
        }
        add(flow, 'millDamage', waste);
      }
      if (receivedBefore) {
        add(flow, 'millOpenReceive', received);
        add(flow, 'millOpenWaste', waste);
      }
    } else if (sourceCat === 'grey' && jobWork && withJobWork) {
      if (issuedIn) add(flow, 'greyIssue', issued);
      if (receivedIn && outputCat === 'grey') add(flow, 'greyMillReturn', received);
    } else if (sourceCat === 'finish' && !jobWork) {
      if (issuedIn) add(flow, 'kfIssue', issued);
      if (issuedBefore) add(flow, 'kfOpenIssue', issued);
      if (receivedIn) {
        add(flow, 'kfReceipt', received);
        add(flow, 'kfShort', waste);
        add(flow, 'finProcess', received);
      }
      if (receivedBefore) {
        add(flow, 'kfOpenReceipt', received);
        add(flow, 'kfOpenShort', waste);
      }
    } else if (jobWork && withJobWork) {
      if (issuedIn) add(flow, 'jobIssue', issued);
      if (receivedIn) add(flow, 'jobReceipt', received);
    }
  });

  const greyOpening = items.filter((item) => catOf(item) === 'grey').reduce((sum, item) => sum + openingQty(item, basis), 0);
  const finOpening = items.filter((item) => catOf(item) === 'finish').reduce((sum, item) => sum + openingQty(item, basis), 0);
  const niOpening = items.filter((item) => catOf(item) === 'ni').reduce((sum, item) => sum + openingQty(item, basis), 0);

  const greyClosing = greyOpening + flow.greyPurchase + flow.greyMillReturn + flow.greySalesRtn
    - flow.greyReturn - flow.greyIssue - flow.greySales;
  const millOpening = Math.max(0, flow.millOpenIssue - flow.millOpenReceive - flow.millOpenWaste);
  const millClosing = millOpening + flow.millIssue - flow.millDamage - flow.millReturn - flow.millReceiveFinish;
  const kfOpening = Math.max(0, flow.kfOpenIssue - flow.kfOpenReceipt - flow.kfOpenShort);
  const kfClosing = kfOpening + flow.kfIssue - flow.kfReceipt - flow.kfShort;
  const finClosing = finOpening + flow.finProcess + flow.finPurchase + flow.finSlReturn + flow.jobReceipt
    - flow.finPuReturn - flow.finSales - flow.jobIssue - flow.kfIssue;
  const niClosing = niOpening + flow.niPurchase + flow.niSlReturn - flow.niPuReturn - flow.niSales;

  const grey = section('Grey', [
    ['Opening Stock', greyOpening],
    ['Purchase', flow.greyPurchase],
    ['Mill return', flow.greyMillReturn],
    ['Return', 0],
    ['Issue', flow.greyIssue],
    ['G.Sales', flow.greySales],
    ['G.Sales.Rtn', flow.greySalesRtn],
    ['Pu.Return', flow.greyReturn],
    ['Closing Stock', greyClosing, true],
  ]);

  const millGrey = section('Mill Grey', [
    ['Opening Stock', millOpening],
    ['Grey Issue', flow.millIssue],
    ['Damage Mill', flow.millDamage],
    ['Mill Return', flow.millReturn],
    ['Grey Closing Stock', millClosing, true],
  ]);
  const millKf = section('Mill Kf', [
    ['Kfinish Issue', flow.kfIssue],
    ['Kfinish Receipt Mill', flow.kfReceipt],
    ['Short', flow.kfShort],
    ['Kf Closing Stock', kfClosing, true],
    ['Net Closing Stock', millClosing + kfClosing, true],
  ]);
  const finish = section('Finish', [
    ['Opening Stock', finOpening],
    ['Process', flow.finProcess],
    ['Purchase', flow.finPurchase],
    ['Pu.Return', flow.finPuReturn],
    ['Sales', flow.finSales],
    ['Sl.Return', flow.finSlReturn],
    ['Job Issue', flow.jobIssue],
    ['Job Receipt', flow.jobReceipt],
    ['Closing Stock', finClosing, true],
  ]);
  const ni = section('N.I.', [
    ['Opening Stock', niOpening],
    ['Purchase', flow.niPurchase],
    ['Sales', flow.niSales],
    ['Sl.Return', flow.niSlReturn],
    ['Pu.Return', flow.niPuReturn],
    ['Closing Stock', niClosing, true],
  ]);
  const jobSection = section('Job Stock', [
    ['Job Issue', flow.jobIssue],
    ['Job Receipt', flow.jobReceipt],
    ['Pending', Math.max(0, flow.jobIssue - flow.jobReceipt), true],
  ]);

  const byScope = {
    all: [grey, millGrey, millKf, finish, ni],
    grey: [grey],
    mill: [millGrey, millKf],
    finish: [finish],
    job: [jobSection],
    ni: [ni],
  };

  const moveByLot = new Map();
  movements.forEach((move) => {
    const key = String(move.lotId || '');
    const prev = moveByLot.get(key) || { mts: 0, pcs: 0 };
    prev.mts += Number(move.qtyMtrs || 0);
    prev.pcs += Number(move.qtyPcs || 0);
    moveByLot.set(key, prev);
  });

  const shopRows = lots.map((lot) => {
    const item = itemMap.get(String(lot.itemId || ''));
    const moved = moveByLot.get(String(lot._id));
    const alive = new Date(lot.createdAt || 0) <= end;
    const mts = moved ? moved.mts : (alive ? Number(lot.remainingMtrs || 0) : 0);
    const pcs = moved ? moved.pcs : (alive ? Number(lot.remainingPcs || 0) : 0);
    const qty = basis === 'pcs' ? pcs : mts;
    return {
      itemName: item?.name || '—',
      lotNo: lot.lotId || '',
      category: catOf(item) || 'other',
      pcs: round2(pcs),
      qty: round2(qty),
      rate: round2(lot.rate || item?.openingRate || 0),
      value: round2(qty * (Number(lot.rate || item?.openingRate || 0))),
      place: 'Shop',
    };
  }).filter((row) => row.qty > 0.001 || row.pcs > 0.001);

  const millRows = jobs.filter((job) => {
    const lot = lotMap.get(String(job.lotId || ''));
    const source = itemMap.get(String(lot?.itemId || ''));
    if (catOf(source) !== 'grey' || isJobWork(job.processType)) return false;
    if (!job.issueDate || new Date(job.issueDate) > end) return false;
    return true;
  }).map((job) => {
    const lot = lotMap.get(String(job.lotId || ''));
    const source = itemMap.get(String(lot?.itemId || ''));
    const issued = new Date(job.issueDate) <= end ? Number(job.issueQty || 0) : 0;
    const received = job.receiveDate && new Date(job.receiveDate) <= end ? Number(job.receivedQty || 0) : 0;
    const waste = job.receiveDate && new Date(job.receiveDate) <= end ? Number(job.wastage || 0) : 0;
    const pending = Math.max(0, issued - received - waste);
    const pcsIssued = new Date(job.issueDate) <= end ? Number(job.issuePcs || 0) : 0;
    const pcsRecv = job.receiveDate && new Date(job.receiveDate) <= end ? Number(job.receivedPcs || 0) : 0;
    return {
      itemName: source?.name || '—',
      lotNo: job.challanNo || job.jobCardNo || '',
      category: 'grey',
      pcs: round2(Math.max(0, pcsIssued - pcsRecv)),
      qty: round2(pending),
      rate: 0,
      value: 0,
      place: 'Mill',
      issued: round2(issued),
      received: round2(received),
    };
  }).filter((row) => row.qty > 0.001 || row.pcs > 0.001);

  return {
    asOn,
    from: from.toISOString().slice(0, 10),
    basis,
    foldWise,
    withJobWork,
    scope,
    sections: byScope[scope] || byScope.all,
    shopRows,
    millRows,
  };
}

module.exports = { getStockLedgerReport };
