const mongoose = require('mongoose');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Job = require('../models/Job');
const PaymentVoucher = require('../models/PaymentVoucher');
const Party = require('../models/Party');

/**
 * Possible Duplicate Entries — read-only. Finds entries that look saved twice (same party, same
 * day, same amount / quantity), e.g. one bill that reached the server twice from an offline sync.
 * Never deletes or changes anything: the user checks each group and deletes the extra one from
 * the normal screen, which reverses stock and accounts the usual way.
 */
const TZ = 'Asia/Kolkata';
const day = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });
const r2 = (expr) => ({ $round: [{ $ifNull: [expr, 0] }, 2] });
// saved this close together = almost surely one entry saved twice, not two real entries
const QUICK_SECONDS = 600;

async function findGroups(Model, match, key, project) {
  return Model.aggregate([
    { $match: match },
    { $group: { _id: key, count: { $sum: 1 }, docs: { $push: project } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { '_id.day': -1 } },
    { $limit: 500 },
  ]).allowDiskUse(true);
}

function shape(kind, groups, partyNames) {
  return groups.map((g) => {
    const docs = g.docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const times = docs.map((d) => new Date(d.createdAt).getTime()).filter(Number.isFinite);
    const secondsApart = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 1000) : null;
    return {
      kind,
      reason: g._id.reason,
      day: g._id.day,
      party: partyNames.get(String(g._id.party)) || '',
      amount: g._id.amount ?? null,
      qty: g._id.qty ?? null,
      count: g.count,
      secondsApart,
      likelyDoubleSave: secondsApart != null && secondsApart <= QUICK_SECONDS,
      entries: docs,
    };
  });
}

async function scan(companyId) {
  const cid = new mongoose.Types.ObjectId(String(companyId));
  const live = { $nin: ['cancelled'] };
  const entry = { id: '$_id', no: '$invoiceNo', date: '$date', amount: '$netAmount', createdAt: '$createdAt' };

  // (sales invoice no is unique per company in the database, so it cannot repeat)
  const [salesSame, purSame, purBill, jobs, vouchers] = await Promise.all([
    findGroups(Sales, { companyId: cid, status: live },
      { reason: 'same party, day and amount', party: '$customerId', day: day('$date'), amount: r2('$netAmount') }, entry),
    findGroups(Purchase, { companyId: cid, status: live },
      { reason: 'same party, day and amount', party: '$supplierId', day: day('$date'), amount: r2('$netAmount') },
      { ...entry, supplierBillNo: '$supplierInvoiceNo' }),
    findGroups(Purchase, { companyId: cid, status: live, supplierInvoiceNo: { $nin: [null, ''] } },
      { reason: 'same party bill no', party: '$supplierId', supplierBillNo: '$supplierInvoiceNo' },
      { ...entry, supplierBillNo: '$supplierInvoiceNo' }),
    findGroups(Job, { companyId: cid, status: { $ne: 'Cancelled' } },
      { reason: 'same worker, day, lot and quantity', party: '$workerId', day: day('$issueDate'), lot: '$lotId', qty: r2('$issueQty'), pcs: '$issuePcs' },
      { id: '$_id', no: '$jobCardNo', challanNo: '$challanNo', date: '$issueDate', qty: '$issueQty', pcs: '$issuePcs', status: '$status', createdAt: '$createdAt' }),
    findGroups(PaymentVoucher, { companyId: cid, isReversed: { $ne: true }, status: { $ne: 'Reversed' } },
      { reason: 'same account, day and amount', type: '$voucherType', party: '$partyLedgerId', partyName: '$partyName', day: day('$date'), amount: r2('$amount') },
      { id: '$_id', no: '$voucherNo', date: '$date', amount: '$amount', type: '$voucherType', createdAt: '$createdAt' }),
  ]);

  // the "same party, day and amount" groups already cover most "same bill no" groups: keep each set of entries once
  const dedupe = (a, b) => {
    const seen = new Set(a.map((g) => g.docs.map((d) => String(d.id)).sort().join(',')));
    return a.concat(b.filter((g) => !seen.has(g.docs.map((d) => String(d.id)).sort().join(','))));
  };

  const partyIds = new Set();
  for (const g of [...salesSame, ...purSame, ...purBill, ...jobs]) if (g._id.party) partyIds.add(String(g._id.party));
  const parties = await Party.find({ _id: { $in: [...partyIds] } }).select('name').lean();
  const partyNames = new Map(parties.map((p) => [String(p._id), p.name]));
  const voucherNames = new Map(vouchers.map((g) => [String(g._id.party), g._id.partyName]));

  const groups = [
    ...shape('Sales', salesSame, partyNames),
    ...shape('Purchase', dedupe(purSame, purBill), partyNames),
    ...shape('Mill Issue', jobs, partyNames),
    ...shape('Receipt/Payment', vouchers, voucherNames).map((g) => ({ ...g, kind: g.entries[0]?.type || g.kind })),
  ];
  return {
    scannedAt: new Date(),
    totalGroups: groups.length,
    likelyDoubleSaves: groups.filter((g) => g.likelyDoubleSave).length,
    groups,
  };
}

module.exports = { scan, QUICK_SECONDS };
