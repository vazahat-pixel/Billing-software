/**
 * Offline Reports & Accounting Engine
 * Provides client-side ledger statements, outstanding reports, GST reports,
 * and financial statements when running offline or disconnected from backend.
 */
import { getCachedEntities } from './offlineDB';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const toDateStr = (d) => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
};

/** Match party ID or party name across different document shapes */
export const isMatchingParty = (entityPartyId, entityPartyName, targetPartyId, targetPartyName) => {
  if (targetPartyId && entityPartyId) {
    const sTarget = String(targetPartyId).replace(/^party:/, '');
    const sEntity = String(entityPartyId).replace(/^party:/, '');
    if (sTarget === sEntity) return true;
  }
  if (targetPartyName && entityPartyName) {
    const tName = String(targetPartyName).trim().toLowerCase();
    const eName = String(entityPartyName).trim().toLowerCase();
    if (tName && eName && tName === eName) return true;
  }
  return false;
};

/** Load dataset from state or IndexedDB cache */
const resolveData = async (stateVal, storeName) => {
  if (Array.isArray(stateVal) && stateVal.length > 0) return stateVal;
  try {
    const cached = await getCachedEntities(storeName);
    if (Array.isArray(cached) && cached.length > 0) return cached;
  } catch {
    /* ignore */
  }
  return stateVal || [];
};

/**
 * Compute Complete Offline Ledger Statement
 */
export async function computeOfflineLedgerStatement({ ledgerId, from, to, state = {} }) {
  const parties = await resolveData(state.parties, 'parties');
  const ledgers = await resolveData(state.ledgers, 'ledgers');
  const sales = await resolveData(state.sales, 'sales');
  const purchases = await resolveData(state.purchases, 'purchases');
  const payments = await resolveData(state.payments, 'payments');
  const receipts = await resolveData(state.receipts, 'receipts');
  const vouchers = [
    ...(state.vouchers || []),
    ...payments,
    ...receipts
  ].filter((v, i, arr) => arr.findIndex((x) => (x._id || x.id) === (v._id || v.id)) === i);
  const notes = await resolveData(state.notes, 'notes');
  const jobs = await resolveData(state.jobWorkEntries, 'jobs');

  const cleanTargetId = String(ledgerId || '').replace(/^party:/, '');

  // Find target ledger or linked party
  let targetLedger = ledgers.find((l) => String(l._id || l.id) === cleanTargetId);
  let targetParty = parties.find((p) => String(p._id || p.id) === cleanTargetId);

  if (!targetLedger && targetParty) {
    targetLedger = ledgers.find((l) => String(l.linkedPartyId) === String(targetParty._id || targetParty.id));
  }
  if (!targetParty && targetLedger?.linkedPartyId) {
    targetParty = parties.find((p) => String(p._id || p.id) === String(targetLedger.linkedPartyId));
  }

  const ledgerName = targetLedger?.name || targetParty?.name || 'Ledger Account';
  const targetPartyId = targetParty?._id || targetParty?.id || (targetLedger?.linkedPartyId ? String(targetLedger.linkedPartyId) : cleanTargetId);

  let openingBalance = Number(targetLedger?.openingBalance || targetParty?.openingBalance || 0);
  let openingType = targetLedger?.openingBalanceType || targetParty?.openingBalanceType || (targetParty?.type === 'Supplier' ? 'Cr' : 'Dr');
  let openingSigned = (openingType === 'Cr' ? -1 : 1) * Math.abs(openingBalance);

  const rawEntries = [];

  // 1. Sales Invoices
  for (const s of sales) {
    if (s.offlineDeleted) continue;
    const sPartyId = s.customerId?._id || s.customerId?.id || s.customerId || s.partyId;
    const sPartyName = s.customerName || s.customerId?.name || s.partyName;
    if (isMatchingParty(sPartyId, sPartyName, targetPartyId, ledgerName)) {
      const amt = Number(s.netAmount || s.totalAmount || s.grandTotal || 0);
      rawEntries.push({
        _id: `sale-${s._id || s.id}`,
        date: toDateStr(s.date) || new Date().toISOString().slice(0, 10),
        voucherNo: s.invoiceNo || 'SALE',
        billVoucherNo: s.invoiceNo || 'SALE',
        chequeNo: '',
        remarks: s.remarks || '',
        accBill: 'B',
        cp: 'SCC',
        contraShortCode: 'SCC',
        voucherType: 'SalesInvoice',
        particulars: 'SALES BOOK',
        contraAccount: 'SALES BOOK',
        narration: s.remarks || `Sale Invoice #${s.invoiceNo || ''}`,
        debit: round2(amt),
        credit: 0,
        refType: 'SalesInvoice',
        refId: s._id || s.id,
      });
    }
  }

  // 2. Purchase Bills
  for (const p of purchases) {
    if (p.offlineDeleted) continue;
    const pPartyId = p.supplierId?._id || p.supplierId?.id || p.supplierId || p.partyId;
    const pPartyName = p.supplierName || p.supplierId?.name || p.partyName;
    if (isMatchingParty(pPartyId, pPartyName, targetPartyId, ledgerName)) {
      const amt = Number(p.netAmount || p.totalAmount || p.grandTotal || 0);
      rawEntries.push({
        _id: `pur-${p._id || p.id}`,
        date: toDateStr(p.date) || new Date().toISOString().slice(0, 10),
        voucherNo: p.invoiceNo || p.suppBillNo || 'PUR',
        billVoucherNo: p.invoiceNo || p.suppBillNo || 'PUR',
        chequeNo: '',
        remarks: p.remarks || '',
        accBill: 'B',
        cp: 'SCC',
        contraShortCode: 'SCC',
        voucherType: 'PurchaseBill',
        particulars: 'PURCHASE BOOK',
        contraAccount: 'PURCHASE BOOK',
        narration: p.remarks || `Purchase Bill #${p.invoiceNo || p.suppBillNo || ''}`,
        debit: 0,
        credit: round2(amt),
        refType: 'PurchaseBill',
        refId: p._id || p.id,
      });
    }
  }

  // 3. Vouchers (Payment & Receipt)
  for (const v of vouchers) {
    if (v.offlineDeleted || v.status === 'Reversed') continue;
    const vPartyId = v.partyLedgerId || v.partyId || v.party?._id;
    const vPartyName = v.partyName || v.party?.name;
    const vBankId = v.bankLedgerId;
    const isPartyMatch = isMatchingParty(vPartyId, vPartyName, targetPartyId, ledgerName);
    const isBankMatch = targetLedger && String(vBankId) === String(targetLedger._id || targetLedger.id);

    if (isPartyMatch) {
      const amt = Number(v.amount || 0);
      const isReceipt = v.type === 'Receipt' || v.voucherType === 'Receipt';
      rawEntries.push({
        _id: `vouch-${v._id || v.id}`,
        date: toDateStr(v.date) || new Date().toISOString().slice(0, 10),
        voucherNo: v.voucherNo || (isReceipt ? 'RV' : 'PV'),
        billVoucherNo: v.voucherNo || (isReceipt ? 'RV' : 'PV'),
        chequeNo: v.chequeNo || v.utrNo || '',
        remarks: v.narration || v.paymentNarration || '',
        accBill: 'A',
        cp: 'SCC',
        contraShortCode: 'SCC',
        voucherType: isReceipt ? 'Receipt' : 'Payment',
        particulars: v.bankLedgerName || (isReceipt ? 'BANK / CASH RECEIPT' : 'BANK / CASH PAYMENT'),
        contraAccount: v.bankLedgerName || 'BANK / CASH',
        narration: v.narration || v.paymentNarration || '',
        debit: isReceipt ? 0 : round2(amt),
        credit: isReceipt ? round2(amt) : 0,
        refType: isReceipt ? 'Receipt' : 'Payment',
        refId: v._id || v.id,
      });
    } else if (isBankMatch) {
      const amt = Number(v.amount || 0);
      const isReceipt = v.type === 'Receipt' || v.voucherType === 'Receipt';
      rawEntries.push({
        _id: `vouch-bank-${v._id || v.id}`,
        date: toDateStr(v.date) || new Date().toISOString().slice(0, 10),
        voucherNo: v.voucherNo || (isReceipt ? 'RV' : 'PV'),
        billVoucherNo: v.voucherNo || (isReceipt ? 'RV' : 'PV'),
        chequeNo: v.chequeNo || v.utrNo || '',
        remarks: v.narration || '',
        accBill: 'A',
        cp: 'SCC',
        contraShortCode: 'SCC',
        voucherType: isReceipt ? 'Receipt' : 'Payment',
        particulars: vPartyName || 'PARTY ACCOUNT',
        contraAccount: vPartyName || 'PARTY',
        narration: v.narration || '',
        debit: isReceipt ? round2(amt) : 0,
        credit: isReceipt ? 0 : round2(amt),
        refType: isReceipt ? 'Receipt' : 'Payment',
        refId: v._id || v.id,
      });
    }
  }

  // 4. Notes (Credit / Debit Notes)
  for (const n of notes) {
    if (n.offlineDeleted) continue;
    const nPartyId = n.partyId || n.party?._id;
    const nPartyName = n.partyName || n.party?.name;
    if (isMatchingParty(nPartyId, nPartyName, targetPartyId, ledgerName)) {
      const amt = Number(n.netAmount || n.totalAmount || n.amount || 0);
      const isCredit = (n.noteType || n.type || '').toLowerCase().includes('credit');
      rawEntries.push({
        _id: `note-${n._id || n.id}`,
        date: toDateStr(n.date) || new Date().toISOString().slice(0, 10),
        voucherNo: n.noteNo || (isCredit ? 'CN' : 'DN'),
        billVoucherNo: n.noteNo || (isCredit ? 'CN' : 'DN'),
        chequeNo: '',
        remarks: n.reason || n.remarks || '',
        accBill: 'A',
        cp: 'SCC',
        contraShortCode: 'SCC',
        voucherType: isCredit ? 'CreditNote' : 'DebitNote',
        particulars: isCredit ? 'CREDIT NOTE' : 'DEBIT NOTE',
        contraAccount: isCredit ? 'CREDIT NOTE' : 'DEBIT NOTE',
        narration: n.reason || '',
        debit: isCredit ? 0 : round2(amt),
        credit: isCredit ? round2(amt) : 0,
        refType: isCredit ? 'CreditNote' : 'DebitNote',
        refId: n._id || n.id,
      });
    }
  }

  // 5. Job Work / Mill Entries
  for (const j of jobs) {
    if (j.offlineDeleted) continue;
    const workerId = j.workerId?._id || j.workerId?.id || j.workerId;
    const workerName = j.workerName || j.workerId?.name;
    if (isMatchingParty(workerId, workerName, targetPartyId, ledgerName)) {
      const charges = Number(j.processCharges || j.charges || 0);
      if (charges > 0) {
        rawEntries.push({
          _id: `job-${j._id || j.id}`,
          date: toDateStr(j.receivedDate || j.issueDate) || new Date().toISOString().slice(0, 10),
          voucherNo: j.jobCardNo || 'JC',
          billVoucherNo: j.jobCardNo || 'JC',
          chequeNo: '',
          remarks: j.processType || 'Job Work',
          accBill: 'B',
          cp: 'SCC',
          contraShortCode: 'SCC',
          voucherType: 'JobWorkCharges',
          particulars: 'JOB WORK CHARGES',
          contraAccount: 'JOB WORK',
          narration: `Job Work (${j.processType || 'Process'}) Lot: ${j.lotId || ''}`,
          debit: 0,
          credit: round2(charges),
          refType: 'JobWorkCharges',
          refId: j._id || j.id,
        });
      }
    }
  }

  // Sort chronological
  rawEntries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const fromStr = toDateStr(from);
  const toStr = toDateStr(to);

  // Apply transactions prior to `from` to opening balance
  const inRangeEntries = [];
  for (const entry of rawEntries) {
    if (fromStr && entry.date < fromStr) {
      openingSigned += (entry.debit - entry.credit);
    } else if (!toStr || entry.date <= toStr) {
      inRangeEntries.push(entry);
    }
  }

  let running = openingSigned;
  const statement = inRangeEntries.map((e) => {
    running += (e.debit - e.credit);
    return {
      ...e,
      runningBalance: round2(Math.abs(running)),
      balanceType: running >= 0 ? 'Dr' : 'Cr',
    };
  });

  return {
    ledger: targetLedger || { _id: cleanTargetId, id: cleanTargetId, name: ledgerName },
    ledgerName,
    openingBalance: round2(Math.abs(openingSigned)),
    openingBalanceType: openingSigned >= 0 ? 'Dr' : 'Cr',
    closingBalance: round2(Math.abs(running)),
    closingBalanceType: running >= 0 ? 'Dr' : 'Cr',
    statement,
  };
}

/**
 * Compute Complete Offline Outstanding Reports (Receivable / Payable)
 */
export async function computeOfflineOutstanding(type = 'receivable', asOn, state = {}) {
  const sales = await resolveData(state.sales, 'sales');
  const purchases = await resolveData(state.purchases, 'purchases');
  const payments = await resolveData(state.payments, 'payments');
  const receipts = await resolveData(state.receipts, 'receipts');
  const asOnStr = toDateStr(asOn) || new Date().toISOString().slice(0, 10);

  const isReceivable = type === 'receivable' || type === 'customer' || type === 'sales';

  if (isReceivable) {
    const rows = [];
    for (const s of sales) {
      if (s.offlineDeleted) continue;
      const sDate = toDateStr(s.date);
      if (asOnStr && sDate > asOnStr) continue;

      let billAmt = Number(s.netAmount || s.totalAmount || s.grandTotal || 0);
      let paidAmt = Number(s.paidAmount || 0);

      // If paidAmount was not stored, compute from matching receipts
      if (!paidAmt) {
        for (const r of receipts) {
          if (r.offlineDeleted || r.status === 'Reversed') continue;
          const matchInv = (r.againstInvoices || []).some(
            (inv) => String(inv.invoiceId) === String(s._id || s.id) || String(inv.billNo) === String(s.invoiceNo)
          );
          if (matchInv) paidAmt += Number(r.amount || 0);
        }
      }

      const pending = round2(Math.max(0, billAmt - paidAmt));
      if (pending > 0.01) {
        const days = Math.max(0, Math.floor((Date.now() - new Date(s.date).getTime()) / (1000 * 60 * 60 * 24)));
        rows.push({
          id: s._id || s.id,
          invoiceId: s._id || s.id,
          invoiceNo: s.invoiceNo || 'BILL',
          billNo: s.invoiceNo || 'BILL',
          date: sDate,
          billDate: sDate,
          partyId: s.customerId?._id || s.customerId?.id || s.customerId || s.partyId,
          partyName: s.customerName || s.customerId?.name || s.partyName || 'Customer',
          billAmount: billAmt,
          billAmt,
          paidAmount: paidAmt,
          paidAmt,
          pendingAmount: pending,
          balance: pending,
          netAmt: pending,
          broker: s.brokerId?.name || s.brokerName || '',
          brokerName: s.brokerId?.name || s.brokerName || '',
          station: s.city || s.customerId?.city || '',
          city: s.city || s.customerId?.city || '',
          daysOverdue: days,
          days,
        });
      }
    }
    return rows;
  }

  // Payables (Purchases)
  const rows = [];
  for (const p of purchases) {
    if (p.offlineDeleted) continue;
    const pDate = toDateStr(p.date);
    if (asOnStr && pDate > asOnStr) continue;

    let billAmt = Number(p.netAmount || p.totalAmount || p.grandTotal || 0);
    let paidAmt = Number(p.paidAmount || 0);

    if (!paidAmt) {
      for (const py of payments) {
        if (py.offlineDeleted || py.status === 'Reversed') continue;
        const matchInv = (py.againstInvoices || []).some(
          (inv) => String(inv.invoiceId) === String(p._id || p.id) || String(inv.billNo) === String(p.invoiceNo || p.suppBillNo)
        );
        if (matchInv) paidAmt += Number(py.amount || 0);
      }
    }

    const pending = round2(Math.max(0, billAmt - paidAmt));
    if (pending > 0.01) {
      const days = Math.max(0, Math.floor((Date.now() - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24)));
      rows.push({
        id: p._id || p.id,
        invoiceId: p._id || p.id,
        invoiceNo: p.invoiceNo || p.suppBillNo || 'PUR',
        billNo: p.invoiceNo || p.suppBillNo || 'PUR',
        date: pDate,
        billDate: pDate,
        partyId: p.supplierId?._id || p.supplierId?.id || p.supplierId || p.partyId,
        partyName: p.supplierName || p.supplierId?.name || p.partyName || 'Supplier',
        billAmount: billAmt,
        billAmt,
        paidAmount: paidAmt,
        paidAmt,
        pendingAmount: pending,
        balance: pending,
        netAmt: pending,
        broker: p.brokerId?.name || p.brokerName || '',
        brokerName: p.brokerId?.name || p.brokerName || '',
        station: p.supplierId?.city || '',
        city: p.supplierId?.city || '',
        daysOverdue: days,
        days,
      });
    }
  }
  return rows;
}

/**
 * Outstanding filter options derived from local data
 */
export async function computeOfflineOutstandingFilterOptions(type = 'receivable', state = {}) {
  const parties = await resolveData(state.parties, 'parties');
  const sales = await resolveData(state.sales, 'sales');
  const purchases = await resolveData(state.purchases, 'purchases');

  const pSet = new Set();
  const bSet = new Set();
  const sSet = new Set();

  for (const p of parties) {
    if (p.name) pSet.add(p.name);
    if (p.city) sSet.add(p.city);
  }
  const isRec = type === 'receivable' || type === 'sales';
  const list = isRec ? sales : purchases;
  for (const item of list) {
    const name = item.customerName || item.supplierName || item.partyName;
    if (name) pSet.add(name);
    const broker = item.brokerName || item.brokerId?.name;
    if (broker) bSet.add(broker);
    const station = item.city || item.station;
    if (station) sSet.add(station);
  }

  return {
    parties: [...pSet].sort(),
    brokers: [...bSet].sort(),
    stations: [...sSet].sort(),
    hastes: [],
    books: [isRec ? 'Default Sales Book' : 'Default Purchase Book'],
    states: ['GUJARAT', 'MAHARASHTRA', 'RAJASTHAN', 'DELHI', 'PUNJAB', 'HARYANA', 'MADHYA PRADESH', 'UTTAR PRADESH'],
    msmeTypes: ['Micro', 'Small', 'Medium', 'Non-MSME'],
  };
}

/**
 * Filtered Outstanding Report
 */
export async function computeOfflineOutstandingFiltered(type, filters = {}, state = {}) {
  const all = await computeOfflineOutstanding(type, filters.billDateTo, state);
  let filtered = all;

  if (filters.billDateFrom) {
    filtered = filtered.filter((r) => r.billDate >= filters.billDateFrom);
  }
  if (filters.billDateTo) {
    filtered = filtered.filter((r) => r.billDate <= filters.billDateTo);
  }
  if (filters.party || filters.parties) {
    const pFilter = (filters.party || filters.parties);
    const allowed = new Set(Array.isArray(pFilter) ? pFilter : String(pFilter).split(','));
    filtered = filtered.filter((r) => allowed.has(r.partyName));
  }
  if (filters.broker || filters.brokers) {
    const bFilter = (filters.broker || filters.brokers);
    const allowed = new Set(Array.isArray(bFilter) ? bFilter : String(bFilter).split(','));
    filtered = filtered.filter((r) => allowed.has(r.broker));
  }
  if (filters.station || filters.stations) {
    const sFilter = (filters.station || filters.stations);
    const allowed = new Set(Array.isArray(sFilter) ? sFilter : String(sFilter).split(','));
    filtered = filtered.filter((r) => allowed.has(r.station));
  }
  return filtered;
}

/**
 * Offline GSTR-1 Generator
 */
export async function computeOfflineGstr1(startDate, endDate, state = {}) {
  const sales = await resolveData(state.sales, 'sales');
  const parties = await resolveData(state.parties, 'parties');
  const start = toDateStr(startDate);
  const end = toDateStr(endDate);

  const partyGstinMap = new Map();
  for (const p of parties) {
    if (p.name && p.gstin) partyGstinMap.set(p.name.trim().toLowerCase(), p.gstin);
    if ((p._id || p.id) && p.gstin) partyGstinMap.set(String(p._id || p.id), p.gstin);
  }

  const b2bInvoices = [];
  const b2cInvoices = [];
  const hsnMap = new Map();

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTax = 0;
  let totalValue = 0;

  for (const s of sales) {
    if (s.offlineDeleted) continue;
    const dt = toDateStr(s.date);
    if (start && dt < start) continue;
    if (end && dt > end) continue;

    const pName = s.customerName || s.customerId?.name || s.partyName || 'Customer';
    const pId = String(s.customerId?._id || s.customerId?.id || s.customerId || '');
    const gstin = s.customerId?.gstin || s.gstin || partyGstinMap.get(pId) || partyGstinMap.get(pName.trim().toLowerCase()) || '';

    const netAmt = round2(s.netAmount || s.totalAmount || 0);
    const taxAmt = round2(s.taxAmount || s.gstAmount || 0);
    const taxable = round2(s.taxableAmount || (netAmt - taxAmt));
    const cgst = round2(s.cgst || (gstin ? taxAmt / 2 : taxAmt / 2));
    const sgst = round2(s.sgst || (gstin ? taxAmt / 2 : taxAmt / 2));
    const igst = round2(s.igst || 0);

    totalTaxable += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    totalTax += taxAmt;
    totalValue += netAmt;

    const invRow = {
      invoiceNo: s.invoiceNo || 'BILL',
      date: dt,
      partyName: pName,
      gstin,
      taxable,
      cgst,
      sgst,
      igst,
      totalGst: taxAmt,
      netAmount: netAmt,
    };

    if (gstin && gstin.length === 15) {
      b2bInvoices.push(invRow);
    } else {
      b2cInvoices.push(invRow);
    }

    // HSN aggregation
    for (const item of s.items || []) {
      const hsn = item.hsn || item.hsnCode || '5407';
      const existing = hsnMap.get(hsn) || { hsn, qty: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, totalTax: 0 };
      const itemTaxable = Number(item.amount || item.taxableAmount || 0);
      existing.qty += Number(item.mts || item.pcs || item.qty || 0);
      existing.taxable += itemTaxable;
      existing.totalTax += Number(item.gstAmount || 0);
      hsnMap.set(hsn, existing);
    }
  }

  const allInvoices = [...b2bInvoices, ...b2cInvoices];

  return {
    period: start ? start.slice(0, 7) : new Date().toISOString().slice(0, 7),
    b2b: b2bInvoices.length ? [{ ctin: b2bInvoices[0]?.gstin, cname: b2bInvoices[0]?.partyName, inv: b2bInvoices.map((i) => ({ inum: i.invoiceNo, idt: i.date, val: i.netAmount, itms: [{ itm_det: { txval: i.taxable, camt: i.cgst, samt: i.sgst, iamt: i.igst } }] })) }] : [],
    b2cs: b2cInvoices.map((i) => ({ txval: i.taxable, camt: i.cgst, samt: i.sgst, iamt: i.igst, val: i.netAmount })),
    hsn: { data: [...hsnMap.values()] },
    doc_issue: { doc_det: [{ doc_num: 1, doc_typ: 'Invoices', totnum: allInvoices.length, cancel: 0, net_issue: allInvoices.length }] },
    invoices: allInvoices,
    totals: {
      taxable: round2(totalTaxable),
      cgst: round2(totalCgst),
      sgst: round2(totalSgst),
      igst: round2(totalIgst),
      totalTax: round2(totalTax),
      totalValue: round2(totalValue),
      count: allInvoices.length,
    },
  };
}

/**
 * Offline GSTR-2 Generator
 */
export async function computeOfflineGstr2(startDate, endDate, state = {}) {
  const purchases = await resolveData(state.purchases, 'purchases');
  const parties = await resolveData(state.parties, 'parties');
  const start = toDateStr(startDate);
  const end = toDateStr(endDate);

  const partyGstinMap = new Map();
  for (const p of parties) {
    if (p.name && p.gstin) partyGstinMap.set(p.name.trim().toLowerCase(), p.gstin);
    if ((p._id || p.id) && p.gstin) partyGstinMap.set(String(p._id || p.id), p.gstin);
  }

  const rows = [];
  for (const p of purchases) {
    if (p.offlineDeleted) continue;
    const dt = toDateStr(p.date);
    if (start && dt < start) continue;
    if (end && dt > end) continue;

    const pName = p.supplierName || p.supplierId?.name || p.partyName || 'Supplier';
    const pId = String(p.supplierId?._id || p.supplierId?.id || p.supplierId || '');
    const gstin = p.supplierId?.gstin || p.gstin || partyGstinMap.get(pId) || partyGstinMap.get(pName.trim().toLowerCase()) || '';

    const netAmt = round2(p.netAmount || p.totalAmount || 0);
    const taxAmt = round2(p.gstAmount || p.taxAmount || 0);
    const taxable = round2(p.taxableAmount || (netAmt - taxAmt));
    const cgst = round2(p.cgst || taxAmt / 2);
    const sgst = round2(p.sgst || taxAmt / 2);
    const igst = round2(p.igst || 0);

    rows.push({
      invoiceNo: p.invoiceNo || p.suppBillNo || 'PUR',
      date: dt,
      partyName: pName,
      gstin,
      taxable,
      cgst,
      sgst,
      igst,
      gstAmount: taxAmt,
      netAmount: netAmt,
    });
  }
  return rows;
}

/**
 * Offline GSTR-3B Generator
 */
export async function computeOfflineGstr3b(period, state = {}) {
  const g1 = await computeOfflineGstr1(null, null, state);
  const g2 = await computeOfflineGstr2(null, null, state);

  const g2Taxable = g2.reduce((s, r) => s + (r.taxable || 0), 0);
  const g2Cgst = g2.reduce((s, r) => s + (r.cgst || 0), 0);
  const g2Sgst = g2.reduce((s, r) => s + (r.sgst || 0), 0);
  const g2Igst = g2.reduce((s, r) => s + (r.igst || 0), 0);

  return {
    ret_period: period || new Date().toISOString().slice(0, 7),
    sup_details: {
      osup_det: {
        txval: g1.totals.taxable,
        camt: g1.totals.cgst,
        samt: g1.totals.sgst,
        iamt: g1.totals.igst,
        csamt: 0,
      },
    },
    itc_elg: {
      itc_avl: [
        {
          ty: 'All other ITC',
          txval: round2(g2Taxable),
          camt: round2(g2Cgst),
          samt: round2(g2Sgst),
          iamt: round2(g2Igst),
          csamt: 0,
        },
      ],
    },
    summary: {
      outwardTaxable: g1.totals.taxable,
      outwardTax: g1.totals.totalTax,
      inwardTaxable: round2(g2Taxable),
      itcAvailable: round2(g2Cgst + g2Sgst + g2Igst),
      netGstPayable: round2(Math.max(0, g1.totals.totalTax - (g2Cgst + g2Sgst + g2Igst))),
    },
  };
}

/**
 * Offline Trial Balance
 */
export async function computeOfflineTrialBalance(asOn, state = {}) {
  const sales = await resolveData(state.sales, 'sales');
  const purchases = await resolveData(state.purchases, 'purchases');
  const parties = await resolveData(state.parties, 'parties');
  const ledgers = await resolveData(state.ledgers, 'ledgers');
  const vouchers = [
    ...(await resolveData(state.payments, 'payments')),
    ...(await resolveData(state.receipts, 'receipts')),
  ];

  let totalSales = sales.reduce((s, x) => s + Number(x.netAmount || x.totalAmount || 0), 0);
  let totalPurchases = purchases.reduce((s, x) => s + Number(x.netAmount || x.totalAmount || 0), 0);

  const tbRows = [
    {
      ledgerId: 'ledger-sales',
      ledgerName: 'Sales Account',
      group: 'Sales Accounts',
      debit: 0,
      credit: round2(totalSales),
    },
    {
      ledgerId: 'ledger-purchase',
      ledgerName: 'Purchase Account',
      group: 'Purchase Accounts',
      debit: round2(totalPurchases),
      credit: 0,
    },
  ];

  // Party Balances
  for (const party of parties) {
    const pId = party._id || party.id;
    let net = Number(party.openingBalance || 0) * (party.openingBalanceType === 'Cr' ? -1 : 1);

    for (const s of sales) {
      if (isMatchingParty(s.customerId?._id || s.customerId, s.customerName, pId, party.name)) {
        net += Number(s.netAmount || s.totalAmount || 0);
      }
    }
    for (const p of purchases) {
      if (isMatchingParty(p.supplierId?._id || p.supplierId, p.supplierName, pId, party.name)) {
        net -= Number(p.netAmount || p.totalAmount || 0);
      }
    }
    for (const v of vouchers) {
      if (isMatchingParty(v.partyLedgerId || v.partyId, v.partyName, pId, party.name)) {
        if (v.type === 'Receipt') net -= Number(v.amount || 0);
        else net += Number(v.amount || 0);
      }
    }

    if (Math.abs(net) > 0.01) {
      const isDr = net > 0;
      tbRows.push({
        ledgerId: String(pId),
        ledgerName: party.name,
        group: isDr ? 'Sundry Debtors' : 'Sundry Creditors',
        debit: isDr ? round2(net) : 0,
        credit: isDr ? 0 : round2(Math.abs(net)),
      });
    }
  }

  return tbRows;
}

/**
 * Offline Profit & Loss Statement
 */
export async function computeOfflineProfitLoss(from, to, state = {}) {
  const sales = await resolveData(state.sales, 'sales');
  const purchases = await resolveData(state.purchases, 'purchases');
  const jobs = await resolveData(state.jobWorkEntries, 'jobs');

  const start = toDateStr(from);
  const end = toDateStr(to);

  let totalSales = 0;
  for (const s of sales) {
    const dt = toDateStr(s.date);
    if ((!start || dt >= start) && (!end || dt <= end)) {
      totalSales += Number(s.netAmount || s.totalAmount || 0);
    }
  }

  let totalPurchases = 0;
  for (const p of purchases) {
    const dt = toDateStr(p.date);
    if ((!start || dt >= start) && (!end || dt <= end)) {
      totalPurchases += Number(p.netAmount || p.totalAmount || 0);
    }
  }

  let directExpenses = 0;
  for (const j of jobs) {
    const dt = toDateStr(j.receivedDate || j.issueDate);
    if ((!start || dt >= start) && (!end || dt <= end)) {
      directExpenses += Number(j.processCharges || 0);
    }
  }

  const grossProfit = round2(totalSales - totalPurchases - directExpenses);
  const netProfit = grossProfit;

  return {
    trading: {
      sales: round2(totalSales),
      purchases: round2(totalPurchases),
      directExpenses: round2(directExpenses),
      closingStock: 0,
      openingStock: 0,
      grossProfit,
    },
    profitLoss: {
      grossProfit,
      indirectIncome: 0,
      indirectExpenses: 0,
      netProfit,
    },
    sales: round2(totalSales),
    purchases: round2(totalPurchases),
    directExpenses: round2(directExpenses),
    grossProfit,
    netProfit,
  };
}

/**
 * Final Heads structure for FinalReportsModal
 */
export async function computeOfflineFinalHeads(state = {}) {
  const ledgers = await resolveData(state.ledgers, 'ledgers');
  const parties = await resolveData(state.parties, 'parties');

  const accounts = [];
  const headSet = new Set(['Current Assets', 'Current Liabilities', 'Direct Expenses', 'Sales Accounts', 'Purchase Accounts']);

  for (const l of ledgers) {
    const head = l.group || 'General Accounts';
    headSet.add(head);
    accounts.push({
      id: String(l._id || l.id),
      name: l.name,
      code: l.code || '',
      head,
      subGroup: l.subGroup || '',
    });
  }

  for (const p of parties) {
    const head = p.type === 'Supplier' ? 'Sundry Creditors' : 'Sundry Debtors';
    headSet.add(head);
    accounts.push({
      id: String(p._id || p.id),
      name: p.name,
      code: p.code || '',
      head,
      subGroup: p.city || '',
    });
  }

  const heads = [...headSet].map((name) => ({ name, code: '' })).sort((a, b) => a.name.localeCompare(b.name));
  return { accounts, heads };
}

/**
 * Offline Stock Report
 */
export async function computeOfflineStockReport(state = {}) {
  const lots = await resolveData(state.inventoryLots, 'inventory');
  const items = await resolveData(state.items, 'items');

  const itemMap = new Map();
  for (const i of items) {
    itemMap.set(String(i._id || i.id), i);
  }

  return (lots || []).map((lot) => {
    const itemId = String(lot.itemId?._id || lot.itemId?.id || lot.itemId || '');
    const item = itemMap.get(itemId);
    const qty = Number(lot.balanceQty ?? lot.qty ?? 0);
    return {
      lotId: lot.lotId || lot._id,
      itemId,
      itemName: lot.itemName || item?.name || 'Item',
      grade: lot.grade || 'Fresh',
      balanceQty: qty,
      qty,
      taka: lot.taka || (qty > 0 ? 1 : 0),
      meters: qty,
      rate: Number(lot.rate || item?.purchasePrice || 0),
      value: round2(qty * Number(lot.rate || item?.purchasePrice || 0)),
    };
  });
}

/**
 * Offline Unified Report Bundle
 */
export async function computeOfflineReportBundle(startDate, endDate, state = {}) {
  const sales = await resolveData(state.sales, 'sales');
  const purchases = await resolveData(state.purchases, 'purchases');
  const stock = await computeOfflineStockReport(state);
  const jobs = await resolveData(state.jobWorkEntries, 'jobs');
  const outRec = await computeOfflineOutstanding('receivable', endDate, state);
  const outPay = await computeOfflineOutstanding('payable', endDate, state);
  const pl = await computeOfflineProfitLoss(startDate, endDate, state);

  const start = toDateStr(startDate);
  const end = toDateStr(endDate);

  const salesFiltered = sales.filter((s) => {
    const dt = toDateStr(s.date);
    return (!start || dt >= start) && (!end || dt <= end);
  }).map((s) => ({
    ...s,
    invoiceNo: s.invoiceNo,
    date: toDateStr(s.date),
    partyName: s.customerName || s.customerId?.name || s.partyName || 'Customer',
    netAmount: Number(s.netAmount || s.totalAmount || 0),
    balance: Math.max(0, Number(s.netAmount || s.totalAmount || 0) - Number(s.paidAmount || 0)),
  }));

  const purchasesFiltered = purchases.filter((p) => {
    const dt = toDateStr(p.date);
    return (!start || dt >= start) && (!end || dt <= end);
  }).map((p) => ({
    ...p,
    invoiceNo: p.invoiceNo || p.suppBillNo,
    date: toDateStr(p.date),
    partyName: p.supplierName || p.supplierId?.name || p.partyName || 'Supplier',
    netAmount: Number(p.netAmount || p.totalAmount || 0),
    balance: Math.max(0, Number(p.netAmount || p.totalAmount || 0) - Number(p.paidAmount || 0)),
  }));

  const summary = {
    salesCount: salesFiltered.length,
    salesTotal: salesFiltered.reduce((a, r) => a + r.netAmount, 0),
    salesBalance: salesFiltered.reduce((a, r) => a + r.balance, 0),
    purchaseCount: purchasesFiltered.length,
    purchaseTotal: purchasesFiltered.reduce((a, r) => a + r.netAmount, 0),
    purchaseBalance: purchasesFiltered.reduce((a, r) => a + r.balance, 0),
    stockLots: stock.filter((l) => l.qty > 0).length,
    stockMtrs: stock.reduce((a, l) => a + (l.qty || 0), 0),
    pendingJobs: jobs.filter((j) => j.status === 'Issued').length,
    receivableTotal: outRec.reduce((a, r) => a + (r.balance || 0), 0),
    payableTotal: outPay.reduce((a, r) => a + (r.balance || 0), 0),
    grossProfit: pl.grossProfit || 0,
    netProfit: pl.netProfit || 0,
  };

  return {
    salesRegister: salesFiltered,
    purchaseRegister: purchasesFiltered,
    stockReport: stock,
    stockByItem: [],
    jobWorkReport: jobs,
    outstandingReceivable: outRec,
    outstandingPayable: outPay,
    profitLoss: pl,
    dailyTransactions: [],
    masterSummary: {},
    salesItemWise: [],
    purchaseItemWise: [],
    salesHaste: [],
    salesOrders: [],
    purchaseOrders: [],
    salesChallans: [],
    salesReturns: [],
    purchaseReturns: [],
    processSend: jobs,
    processReceipt: jobs.filter((j) => j.status === 'Received'),
    tdsRegister: [],
    tcsRegister: [],
    balanceSheet: {},
    summary,
  };
}
