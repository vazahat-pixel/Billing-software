import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import useStore from '../../store/useStore';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import { notifySuccess, notifyWarning, notifyError } from '../../utils/notify';
import { toast } from '../../store/useToastStore';
import { erpConfirm } from '../../utils/confirm';
import { Plus } from 'lucide-react';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import BillNoLookupModal from './BillNoLookupModal';
import AccountMasterModal from '../masters/AccountMasterModal';
import NoteModal from '../transactions/NoteModal';
import LedgerModal from '../LedgerModal';

const todayISO = () => new Date().toISOString().split('T')[0];

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/** Mirrors toPaise() in accountingController — keeps the two rules from disagreeing. */
const toPaise = (n) => Math.round(Number(n || 0) * 100);

const newIdempotencyKey = () =>
  `cbb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const dayLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
};

const emptyBillRow = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  invoiceId: '',
  billNo: '',
  nSlash: '',
  billDt: '',
  billAmt: 0,
  partRc: 0,
  rg: 0,
  tds: 0,
  osDy: 0,
  billType: '',
  osAmt: 0,
  adjust: 0,
  jvDis: 0,
  pq: '',
  disPer: 0,
  discount: 0,
  bc: '',
  netOs: 0,
  claim: 0,
  rd: 0,
  interest: 0,
  oth1: 0,
  oth2: 0,
});

/**
 * Classic Cash & Bank Book entry — Sale Bill style chrome, WinForms field layout.
 * bookKind: 'cash' | 'bank'
 * initialType: 'Receipt' | 'Payment'
 */
const CashBankBookModal = ({
  isOpen,
  onClose,
  bookKind = 'cash',
  initialType = 'Receipt',
  selectedBook = null,
  readOnly = false,
}) => {
  const {
    parties,
    ledgers,
    sales,
    purchases,
    vouchers,
    jobWorkEntries,
    fetchParties,
    fetchLedgers,
    fetchSales,
    fetchPurchases,
    fetchVouchers,
    fetchJobs,
    addPayment,
    addReceipt,
    updateVoucher,
    reverseVoucher,
    updateParty,
  } = useStore();

  const [mode, setMode] = useState('Add');
  const [voucherType, setVoucherType] = useState(initialType);
  const [findQuery, setFindQuery] = useState('');
  const [selectedVoucherId, setSelectedVoucherId] = useState('');
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [error, setError] = useState('');
  const [billLookupOpen, setBillLookupOpen] = useState(false);
  const [billLookupTargetIdx, setBillLookupTargetIdx] = useState(null);
  const [bankMasterOpen, setBankMasterOpen] = useState(false);
  const [bankLedgerOpen, setBankLedgerOpen] = useState(false);
  // Credit Note modal — opened when user clicks toast action after a discounted receipt save
  const [creditNoteModal, setCreditNoteModal] = useState({ open: false, noteId: null, type: 'Credit', side: 'Sales' });
  const openedRef = useRef(false);
  /** BillNo cells, indexed by row — drives the Enter → select → next-line loop. */
  const billNoRefs = useRef([]);
  /** Row to focus once the grid has re-rendered; a ref so it costs no extra render. */
  const pendingFocusRowRef = useRef(null);
  const partyFieldRef = useRef(null);
  const idempotencyKeyRef = useRef(newIdempotencyKey());

  const [header, setHeader] = useState({
    voucherNo: 'AUTO',
    intBillFlag: 'N',
    intBillNo: '',
    slipNo: '',
    date: todayISO(),
    chequeNo: '',
    chequeDate: todayISO(),
    partyBank: '',
    partyId: '',
    amount: 0,
    accBill: 'B',
    bankLedgerId: '',
    scCode: 'SC27',
  });

  const [billRows, setBillRows] = useState([emptyBillRow()]);
  const [footer, setFooter] = useState({
    remark1: '',
    remark2: '',
    financeFlag: false,
    finance: 0,
  });

  const locked = readOnly || mode === 'View';
  const bookTitle = selectedBook?.name || (bookKind === 'bank' ? 'BANK BOOK' : 'CASH BOOK');
  const windowTitle = `Cash & Bank Book [ ${bookTitle} ] [ ${voucherType} ]`;
  // Cash book never shows P.Bank / Cheq / Slip — even if a cash-named book was picked from bank list
  const isBank = bookKind === 'bank' && !/cash/i.test(selectedBook?.name || bookTitle || '');
  const settlementKind = isBank ? 'bank' : 'cash';
  // Slip No (pay-in slip) and P.Bank (which of the party's banks the cheque is drawn on)
  // are only meaningful when depositing money IN — a Payment issues your own cheque instead.
  const isBankReceipt = isBank && voucherType === 'Receipt';
  // Acc/Bill "A" = on-account: money lands straight on the party, no bill picked.
  const isOnAccount = String(header.accBill || 'B').toUpperCase() === 'A';

  const selectedParty = useMemo(
    () => parties.find((p) => String(p._id || p.id) === String(header.partyId)),
    [parties, header.partyId]
  );

  const partyBankOptions = useMemo(() => {
    const names = new Map();
    (selectedParty?.banks || []).forEach((b) => {
      const name = String(b.name || b.bankName || '').trim();
      if (!name) return;
      names.set(name.toUpperCase(), {
        value: name,
        label: name,
        meta: b.accountNo || '',
      });
    });
    (vouchers || []).forEach((v) => {
      if (String(v.partyLedgerId?._id || v.partyLedgerId) !== String(header.partyId)) return;
      const name = String(v.partyBank || '').trim();
      if (!name) return;
      if (!names.has(name.toUpperCase())) {
        names.set(name.toUpperCase(), { value: name, label: name });
      }
    });
    if (header.partyBank && !names.has(String(header.partyBank).toUpperCase())) {
      names.set(String(header.partyBank).toUpperCase(), {
        value: header.partyBank,
        label: header.partyBank,
      });
    }
    return Array.from(names.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedParty, vouchers, header.partyId, header.partyBank]);

  /**
   * Only genuine Cash/Bank ledgers may be picked. cashBook()/bankBook() select purely on
   * accountType, so money posted anywhere else would never show up in its book — the old
   * name-substring match with an all-ledgers fallback made exactly that possible.
   */
  const bankCashLedgers = useMemo(() => {
    const want = isBank ? 'Bank' : 'Cash';
    return ledgers.filter((l) => l.accountType === want && l.isActive !== false);
  }, [ledgers, isBank]);

  const noBookLedger = !bootLoading && bankCashLedgers.length === 0;

  const partyOptions = useMemo(
    () => parties.map((p) => ({ value: p._id || p.id, label: p.name })),
    [parties]
  );

  /** Every bill of the selected party, open or not — the party-ownership check needs all of them. */
  const partyBillIds = useMemo(() => {
    const docs =
      voucherType === 'Receipt'
        ? sales.filter((s) => String(s.customerId?._id || s.customerId) === String(header.partyId))
        : purchases.filter((p) => String(p.supplierId?._id || p.supplierId) === String(header.partyId));
    const jobDocs = (jobWorkEntries || []).filter(
      (j) => String(j.workerId?._id || j.workerId || '') === String(header.partyId)
    );
    return new Set([...docs.map((d) => String(d._id)), ...jobDocs.map((j) => String(j._id))]);
  }, [header.partyId, voucherType, sales, purchases, jobWorkEntries]);

  const partyInvoices = useMemo(() => {
    if (!header.partyId) return [];
    const docs = (voucherType === 'Receipt' ? sales : purchases) || [];
    const regularBills = docs
      .filter((doc) => {
        const pid = doc.customerId?._id || doc.customerId || doc.supplierId?._id || doc.supplierId;
        return String(pid || '') === String(header.partyId) && doc.status !== 'cancelled';
      })
      .map((doc) => {
        const total = round2(doc.netAmount || doc.totalAmount || 0);
        const paid = round2(doc.paidAmount || 0);
        const rawOs = round2(Math.max(0, total - paid));
        // Business round-off rule: residual paise (< ₹1) is considered 0 (fully settled)
        const outstanding = rawOs < 1.00 ? 0 : rawOs;
        const billDt = doc.date ? new Date(doc.date).toISOString().split('T')[0] : '';
        const osDy = billDt
          ? Math.max(0, Math.floor((Date.now() - new Date(billDt).getTime()) / 86400000))
          : 0;
        return {
          _id: doc._id,
          invoiceNo: doc.invoiceNo || doc.billNo || '',
          billDt,
          billAmt: total,
          paidAmt: paid,
          osAmt: outstanding,
          osDy,
          billType: doc.invoiceType || (voucherType === 'Receipt' ? 'SL' : 'PU'),
        };
      })
      .filter((inv) => inv.osAmt >= 1.00);

    // Job Workers don't have Sales/Purchase invoices — what they're owed is the Job Work
    // Charges posted on Job Receive (job.processCharges + processGstAmount). Fold those in
    // as bills too, or a Job Worker's party would never show anything to settle against.
    const jobBills = (jobWorkEntries || [])
      .filter((j) => String(j.workerId?._id || j.workerId || '') === String(header.partyId))
      .filter((j) => j.status === 'Received' && (Number(j.processCharges || 0) + Number(j.processGstAmount || 0)) > 0)
      .map((j) => {
        const billAmt = round2(Number(j.processCharges || 0) + Number(j.processGstAmount || 0));
        const paid = round2(j.chargesPaidAmount || 0);
        const rawOs = round2(Math.max(0, billAmt - paid));
        const outstanding = rawOs < 1.00 ? 0 : rawOs;
        const billDt = j.receiveDate ? new Date(j.receiveDate).toISOString().split('T')[0] : '';
        const osDy = billDt
          ? Math.max(0, Math.floor((Date.now() - new Date(billDt).getTime()) / 86400000))
          : 0;
        return {
          _id: j._id,
          invoiceNo: j.jobCardNo || j.challanNo || '',
          billDt,
          billAmt,
          paidAmt: paid,
          osAmt: outstanding,
          osDy,
          billType: 'JWC',
        };
      })
      .filter((inv) => inv.osAmt >= 1.00);

    return [...regularBills, ...jobBills];
  }, [header.partyId, voucherType, sales, purchases, jobWorkEntries]);

  /** Outstanding across the listed bills — feeds Cl.Bal, not the UnPaid box. */
  const billsOutstandingTotal = useMemo(
    () => billRows.reduce((s, r) => s + (Number(r.osAmt) || 0), 0),
    [billRows]
  );
  /** Paid = SUM(Adjust). Discount/TDS/RG/etc. are separate adjustments, not allocation. */
  const paidTotal = useMemo(
    () => billRows.reduce((s, r) => s + (Number(r.adjust) || 0), 0),
    [billRows]
  );
  const avgDays = useMemo(() => {
    const withDays = billRows.filter((r) => Number(r.osDy) > 0);
    if (!withDays.length) return 0;
    return withDays.reduce((s, r) => s + Number(r.osDy || 0), 0) / withDays.length;
  }, [billRows]);
  /** Rows actually carrying an allocation — pq is a text flag ('P'), never a count. */
  const allocatedBillCount = useMemo(
    () => billRows.filter((r) => r.invoiceId && Number(r.adjust) > 0).length,
    [billRows]
  );

  const receivedAmount = useMemo(() => round2(header.amount), [header.amount]);
  /** Amount blank ⇒ the voucher total is whatever the bill rows add up to. */
  const effectiveReceived = receivedAmount > 0 ? receivedAmount : paidTotal;
  /** UnPaid = Amount − Paid. Zero on a correctly allocated bill-against voucher. */
  const unpaidTotal = useMemo(
    () => round2(effectiveReceived - paidTotal),
    [effectiveReceived, paidTotal]
  );
  /**
   * The backend's rule, surfaced before the operator hits Save: a bill-against voucher
   * must tie out exactly — ₹3 short is rejected just as firmly as ₹5 over. Vouchers with
   * no bill rows are on-account and have nothing to tie out.
   */
  const hasBillAllocation = billRows.some((r) => r.invoiceId && Number(r.adjust) > 0);
  const amountMismatch =
    hasBillAllocation && toPaise(paidTotal) !== toPaise(effectiveReceived);

  /** Live per-column totals shown in the "(B.AMT-x)(TDS-x)..." breakdown bar. */
  const breakdownTotals = useMemo(() => {
    const sum = (key) => billRows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    return {
      billAmt: sum('billAmt'),
      tds: sum('tds'),
      rg: sum('rg'),
      claim: sum('claim'),
      rd: sum('rd'),
      discount: sum('discount'),
      interest: sum('interest'),
      oth1: sum('oth1'),
      oth2: sum('oth2'),
    };
  }, [billRows]);

  const closingBal = useMemo(() => {
    if (selectedParty) {
      const recv = Number(selectedParty.outstandingReceivable || 0);
      const pay = Number(selectedParty.outstandingPayable || 0);
      if (voucherType === 'Receipt') return recv || billsOutstandingTotal;
      return pay || billsOutstandingTotal;
    }
    return billsOutstandingTotal;
  }, [selectedParty, billsOutstandingTotal, voucherType]);

  const viewList = useMemo(() => {
    const kind = isBank ? 'bank' : 'cash';
    return (vouchers || [])
      .filter((v) => v.voucherType === voucherType)
      .filter((v) => v.status !== 'Reversed' && !v.isReversed)
      .filter((v) => {
        if (!v.bookKind) return true;
        return v.bookKind === kind;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [vouchers, voucherType, isBank]);

  const resetNew = () => {
    setHeader({
      voucherNo: 'AUTO',
      intBillFlag: 'N',
      intBillNo: '',
      slipNo: '',
      date: todayISO(),
      chequeNo: '',
      chequeDate: todayISO(),
      clearDate: '',
      partyBank: '',
      partyId: '',
      amount: 0,
      accBill: 'B',
      bankLedgerId: bankCashLedgers[0]?._id || bankCashLedgers[0]?.id || '',
      scCode: 'SC27',
    });
    setBillRows([emptyBillRow()]);
    setFooter({ remark1: '', remark2: '', financeFlag: false, finance: 0 });
    setSelectedVoucherId('');
    setError('');
    // A fresh form is a fresh submission — a retry of the *previous* save must not
    // be mistaken for this one.
    idempotencyKeyRef.current = newIdempotencyKey();
    setMode(readOnly ? 'View' : 'Add');
  };

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      setBootLoading(false);
      return;
    }
    let cancelled = false;
    setBootLoading(true);
    Promise.all([
      fetchParties(),
      fetchLedgers(),
      fetchSales(),
      fetchPurchases(),
      fetchVouchers(),
      fetchJobs(),
    ])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    setVoucherType(initialType);
    if (!openedRef.current) {
      openedRef.current = true;
      resetNew();
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialType, bookKind]);

  useEffect(() => {
    if (!isOpen || locked) return;
    if (selectedBook) {
      const bookName = (selectedBook.name || '').trim().toLowerCase();
      const matched = bankCashLedgers.find(
        (l) =>
          (l.name || '').trim().toLowerCase() === bookName ||
          (selectedBook.ledgerId && String(l._id || l.id) === String(selectedBook.ledgerId))
      );
      if (matched) {
        setHeader((h) => ({
          ...h,
          bankLedgerId: matched._id || matched.id,
          bookName: selectedBook.name,
          bookId: selectedBook._id,
        }));
        return;
      }
    }
    if (header.bankLedgerId) return;
    const first = bankCashLedgers[0];
    if (first) {
      setHeader((h) => ({ ...h, bankLedgerId: first._id || first.id }));
    }
  }, [bankCashLedgers, isOpen, locked, selectedBook, header.bankLedgerId]);

  // Land on Party once the masters are in, so the Enter chain starts at step 1.
  useEffect(() => {
    if (!isOpen || locked || bootLoading) return;
    const el = partyFieldRef.current?.querySelector('input');
    if (el) el.focus();
  }, [isOpen, locked, bootLoading]);

  // Party change hone par sirf blank row reset karo — bills Enter dabane par
  // BillLookupModal se manually select ki jaayengi.
  useEffect(() => {
    if (!isOpen || mode === 'View') return;
    setBillRows([emptyBillRow()]);
  }, [header.partyId, header.accBill]);

  /** BillNo Entry — click, Enter, Space, or F4 on a row's BillNo cell opens the bill picker. */
  const openBillLookup = (idx) => {
    if (locked) return;
    if (!header.partyId) {
      notifyWarning('Select Party first');
      return;
    }
    if (String(header.accBill || 'B').toUpperCase() === 'A') {
      notifyWarning('Acc/Bill is "A" (on-account) — no bill selection needed. Switch to "B" to pick a bill.');
      return;
    }
    setBillLookupTargetIdx(idx);
    setBillLookupOpen(true);
  };

  const billLookupInvoices = useMemo(() => {
    const usedElsewhere = new Set(
      billRows
        .filter((_, i) => i !== billLookupTargetIdx)
        .map((r) => r.invoiceId)
        .filter(Boolean)
    );
    return partyInvoices.filter((inv) => !usedElsewhere.has(inv._id));
  }, [partyInvoices, billRows, billLookupTargetIdx]);

  /**
   * Fill the target row from the picked bill, auto-allocate whatever of the receipt is
   * still unspent (capped at the bill's own outstanding), open a fresh line if this was
   * the last one, and hand focus to that next line so the operator can keep going on
   * Enter alone — the loop described in the spec's §4.
   */
  const handleBillSelect = (inv) => {
    const idx = billLookupTargetIdx;
    if (idx == null) return;
    setBillRows((rows) => {
      const next = [...rows];
      const spentElsewhere = next.reduce(
        (s, r, i) => (i === idx ? s : s + (Number(r.adjust) || 0)),
        0
      );
      // With an Amount typed, spend only what is left of it; with Amount blank the
      // operator is building the total up from the bills, so take the bill in full.
      const received = Number(header.amount) || 0;
      const stillUnallocated = received > 0
        ? Math.max(0, round2(received - spentElsewhere))
        : inv.osAmt;
      const autoAdjust = round2(Math.min(stillUnallocated, inv.osAmt));
      next[idx] = {
        ...next[idx],
        invoiceId: inv._id,
        billNo: inv.invoiceNo,
        billDt: inv.billDt,
        billAmt: inv.billAmt,
        partRc: inv.paidAmt || 0,
        osAmt: inv.osAmt,
        osDy: inv.osDy,
        billType: inv.billType || '',
        adjust: autoAdjust,
        netOs: round2(inv.osAmt - autoAdjust),
      };
      if (idx === next.length - 1) next.push(emptyBillRow());
      return next;
    });
    pendingFocusRowRef.current = idx + 1;
  };

  // Focus is applied once the new row exists in the DOM.
  useEffect(() => {
    const target = pendingFocusRowRef.current;
    if (target == null) return;
    pendingFocusRowRef.current = null;
    const el = billNoRefs.current[target];
    if (el) {
      el.focus();
      el.select?.();
    }
  }, [billRows]);

  const removeBillRow = (idx) => {
    setBillRows((rows) => (rows.length <= 1 ? [emptyBillRow()] : rows.filter((_, i) => i !== idx)));
  };

  const setH = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setHeader((h) => ({ ...h, [key]: val }));
  };

  /** Party already has this bank — just select it, no master screen needed. New name?
   *  Open the Party Master on Bank Details so Account No / IFSC get filled properly
   *  instead of a bare name-only row. */
  const handleAddPartyBank = (rawName = '') => {
    const bankName = String(rawName || '').trim().toUpperCase();
    if (!bankName) {
      notifyWarning('Type bank name to add as P.Bank');
      return;
    }
    if (!header.partyId) {
      notifyWarning('Select Party first — a bank needs a party to belong to');
      return;
    }
    setHeader((h) => ({ ...h, partyBank: bankName }));
    const existing = selectedParty?.banks || [];
    if (existing.some((b) => String(b.name || b.bankName || '').toUpperCase() === bankName)) {
      notifySuccess('P.Bank selected');
      return;
    }
    setBankMasterOpen(true);
  };

  const updateRow = (idx, key, value) => {
    setBillRows((rows) => {
      const next = [...rows];
      const row = { ...next[idx], [key]: value };
      if (['disPer', 'osAmt', 'adjust', 'tds', 'discount', 'jvDis', 'rg', 'partRc', 'claim', 'rd', 'interest', 'oth1', 'oth2'].includes(key)) {
        const os = Number(row.osAmt) || 0;
        const disPer = Number(row.disPer) || 0;
        if (key === 'disPer') {
          row.discount = Number(((os * disPer) / 100).toFixed(2));
        }
        const discount = Number(row.discount) || 0;
        const tds = Number(row.tds) || 0;
        const adjust = Number(row.adjust) || 0;
        const jvDis = Number(row.jvDis) || 0;
        const rg = Number(row.rg) || 0;
        const claim = Number(row.claim) || 0;
        const rd = Number(row.rd) || 0;
        const interest = Number(row.interest) || 0;
        const oth1 = Number(row.oth1) || 0;
        const oth2 = Number(row.oth2) || 0;
        const rawNet = Number((os - adjust - discount - tds - jvDis - rg - claim - rd - interest - oth1 - oth2).toFixed(2));
        // Indian round-off: agar saare adjustments ke baad sirf paise (< ₹1) bachta hai
        // to use 0 mano — itna round-off normal business practice mein acceptable hai.
        row.netOs = rawNet > 0 && rawNet < 1 ? 0 : rawNet;
      }
      next[idx] = row;
      return next;
    });
  };

  const loadVoucher = (v) => {
    setSelectedVoucherId(v._id || v.id);
    setVoucherType(v.voucherType || voucherType);
    // The voucher stores a LedgerMaster id, but the Party combobox is keyed on Party ids —
    // resolve through the ledger's linkedPartyId or the party renders blank on recall.
    const storedLedgerId = String(v.partyLedgerId?._id || v.partyLedgerId || '');
    const partyLedger = ledgers.find((l) => String(l._id || l.id) === storedLedgerId);
    const resolvedPartyId = partyLedger?.linkedPartyId
      ? String(partyLedger.linkedPartyId)
      : storedLedgerId;
    setHeader({
      voucherNo: v.voucherNo || '',
      intBillFlag: v.intBillFlag || 'N',
      intBillNo: v.intBillNo || '',
      slipNo: v.slipNo || '',
      date: v.date ? new Date(v.date).toISOString().split('T')[0] : todayISO(),
      chequeNo: v.chequeNo || '',
      chequeDate: v.chequeDate ? new Date(v.chequeDate).toISOString().split('T')[0] : todayISO(),
      clearDate: v.clearDate ? new Date(v.clearDate).toISOString().split('T')[0] : '',
      partyBank: v.partyBank || '',
      partyId: resolvedPartyId,
      amount: v.amount || 0,
      accBill: v.accBill || 'B',
      bankLedgerId: v.bankLedgerId?._id || v.bankLedgerId || '',
      scCode: 'SC27',
    });
    const rows = (v.againstInvoices || []).map((a, i) => ({
      ...emptyBillRow(),
      id: a.invoiceId || `r-${i}`,
      invoiceId: a.invoiceId || '',
      billNo: a.invoiceNo || '',
      nSlash: a.nSlash || '',
      billDt: a.billDate ? new Date(a.billDate).toISOString().split('T')[0] : '',
      billAmt: a.billAmt || 0,
      partRc: a.partRc || 0,
      rg: a.rg || 0,
      tds: a.tds || 0,
      osDy: a.osDy || 0,
      billType: a.billType || '',
      osAmt: a.osAmt || 0,
      adjust: a.amount || 0,
      jvDis: a.jvDis || 0,
      pq: a.pq || '',
      disPer: a.disPer || 0,
      discount: a.discount || 0,
      bc: a.bc || '',
      netOs: a.netOs || 0,
      claim: a.claim || 0,
      rd: a.rd || 0,
      interest: a.interest || 0,
      oth1: a.oth1 || 0,
      oth2: a.oth2 || 0,
    }));
    setBillRows(rows.length ? rows : [emptyBillRow()]);
    setFooter({
      remark1: v.narration || '',
      remark2: v.remark2 || '',
      financeFlag: !!v.financeFlag,
      finance: v.finance || 0,
    });
    setMode('View');
  };

  const handleNew = () => resetNew();

  /**
   * Unlock the loaded voucher for correction. Saving from here reverses the original
   * accounting and re-posts the corrected figures in one transaction, keeping the
   * voucher number — it does not stack a second voucher on top of the first.
   */
  const handleEdit = () => {
    if (!selectedVoucherId) return notifyWarning('Find / select a voucher first');
    const v = viewList.find((x) => (x._id || x.id) === selectedVoucherId);
    if (v && (v.status === 'Reversed' || v.isReversed)) {
      return notifyWarning('A reversed voucher cannot be edited');
    }
    setMode('Edit');
    setError('');
    notifyWarning('Edit mode — saving re-posts this voucher and rebuilds its bill allocation');
  };

  const handleFind = () => {
    const q = (findQuery || '').trim().toLowerCase();
    if (!q) {
      if (viewList[0]) loadVoucher(viewList[0]);
      else notifyWarning('No vouchers found');
      return;
    }
    const found = viewList.find(
      (v) =>
        String(v.voucherNo || '').toLowerCase() === q ||
        String(v.partyName || '').toLowerCase().includes(q) ||
        String(v.slipNo || '').toLowerCase() === q
    );
    if (!found) return notifyWarning('Voucher not found');
    loadVoucher(found);
  };

  const handleCancel = () => {
    if (selectedVoucherId) {
      const v = viewList.find((x) => (x._id || x.id) === selectedVoucherId);
      if (v) loadVoucher(v);
      else setMode('View');
    } else {
      resetNew();
      setMode('View');
    }
  };

  const handleDelete = async () => {
    if (!selectedVoucherId) return notifyWarning('Select a voucher first (Find)');
    if (mode !== 'View') return notifyWarning('Cancel edit first, then Delete to reverse');
    const ok = await erpConfirm({
      title: `Reverse ${voucherType}?`,
      message:
        `This will reverse voucher ledger entries and undo bill adjustments.\n\n` +
        `Voucher stays in history as Reversed (not hard-deleted).\n\nContinue?`,
      confirmLabel: 'Reverse',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    setError('');
    try {
      await reverseVoucher(selectedVoucherId, `Reversed from ${isBank ? 'Bank' : 'Cash'} Book`);
      notifySuccess(`${voucherType} reversed — ledger & bill OS updated`);
      await fetchVouchers();
      resetNew();
      setMode('View');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reverse voucher');
      notifyError(err, 'Failed to reverse voucher');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setError('');
    const moneyWord = voucherType === 'Payment' ? 'Payment' : 'Receipt';

    if (!header.partyId) {
      setError('Please select a Party.');
      return;
    }
    if (!header.bankLedgerId) {
      setError(`Please select a valid ${isBank ? 'Bank' : 'Cash'} account.`);
      return;
    }
    if (effectiveReceived <= 0) {
      setError(`Please enter a valid ${moneyWord} Amount.`);
      return;
    }

    if (isOnAccount && billRows.some((r) => Number(r.adjust) > 0)) {
      setError('Acc/Bill is "A" (on-account) — clear the Adjust amounts or switch Acc/Bill to "B"');
      return;
    }
    // Acc/Bill = B means bill-against: the money has to land on real bills.
    if (!isOnAccount && !hasBillAllocation) {
      setError('Please select at least one Bill.');
      return;
    }
    // Same rule the backend enforces; catching it here saves a round trip.
    if (!isOnAccount && amountMismatch) {
      setError(
        `Check Amount: Total Bill Adjust must exactly equal ${moneyWord} Amount ` +
        `(adjust ₹${paidTotal.toFixed(2)} vs amount ₹${effectiveReceived.toFixed(2)})`
      );
      return;
    }
    const duplicateBill = (() => {
      const seen = new Set();
      for (const r of billRows) {
        if (!r.invoiceId || Number(r.adjust) <= 0) continue;
        const key = String(r.invoiceId);
        if (seen.has(key)) return r.billNo || key;
        seen.add(key);
      }
      return null;
    })();
    if (duplicateBill) {
      setError(`This Bill is already selected: ${duplicateBill}`);
      return;
    }
    // The picker only offers this party's bills, but a stale row could survive a party
    // change. Checked against every bill of the party, not just the ones still open —
    // an edit legitimately touches bills this voucher had already settled to zero.
    const foreignBill = billRows.find(
      (r) => r.invoiceId && Number(r.adjust) > 0 && !partyBillIds.has(String(r.invoiceId))
    );
    if (foreignBill) {
      setError(`Selected Bill does not belong to the selected Party: ${foreignBill.billNo || ''}`);
      return;
    }

    const againstInvoices = billRows
      .map((r) => {
        const amt = Number(r.adjust) || 0;
        if (amt <= 0) return null;
        return {
          invoiceId: r.invoiceId || undefined,
          invoiceNo: r.billNo,
          billDate: r.billDt || undefined,
          billAmt: Number(r.billAmt) || 0,
          partRc: Number(r.partRc) || 0,
          rg: Number(r.rg) || 0,
          tds: Number(r.tds) || 0,
          osDy: Number(r.osDy) || 0,
          billType: r.billType || '',
          osAmt: Number(r.osAmt) || 0,
          amount: amt,
          jvDis: Number(r.jvDis) || 0,
          pq: r.pq || '',
          disPer: Number(r.disPer) || 0,
          discount: Number(r.discount) || 0,
          bc: r.bc || '',
          netOs: Number(r.netOs) || 0,
          nSlash: r.nSlash || '',
          claim: Number(r.claim) || 0,
          rd: Number(r.rd) || 0,
          interest: Number(r.interest) || 0,
          oth1: Number(r.oth1) || 0,
          oth2: Number(r.oth2) || 0,
        };
      })
      .filter(Boolean);

    let numericAmount = Number(header.amount) || 0;
    if (numericAmount <= 0 && againstInvoices.length) {
      numericAmount = againstInvoices.reduce((s, a) => s + a.amount, 0);
    }
    if (numericAmount <= 0) {
      setError('Amount must be greater than zero (enter Amount or Adjust against bills)');
      return;
    }

    if (isBank && header.chequeNo && !header.chequeDate) {
      setError('Cheque Date is required when Cheq No is entered');
      return;
    }

    setSaving(true);
    try {
      if (isBank && header.partyBank && header.partyId) {
        const existing = selectedParty?.banks || [];
        const upper = String(header.partyBank).toUpperCase();
        if (!existing.some((b) => String(b.name || b.bankName || '').toUpperCase() === upper)) {
          try {
            await updateParty(header.partyId, {
              banks: [...existing, { name: upper, accountNo: '', ifsc: '' }],
            });
            await fetchParties();
          } catch (bankErr) {
            // Non-blocking — the voucher still saves even if the party master couldn't be updated.
            notifyWarning(`Voucher will save, but "${header.partyBank}" could not be added to the party's bank list: ${bankErr?.message || bankErr}`);
          }
        }
      }

      const payload = {
        date: header.date,
        partyLedgerId: header.partyId,
        amount: numericAmount,
        bankLedgerId: header.bankLedgerId,
        paymentMode: !isBank ? 'Cash' : header.chequeNo ? 'Cheque' : 'NEFT',
        chequeNo: isBank ? header.chequeNo || undefined : undefined,
        chequeDate: isBank && header.chequeNo ? header.chequeDate : undefined,
        clearDate: isBank ? header.clearDate || undefined : undefined,
        slipNo: isBank ? (header.slipNo || '') : '',
        intBillNo: header.intBillNo || '',
        intBillFlag: header.intBillFlag || 'N',
        partyBank: isBank ? (header.partyBank || '') : '',
        accBill: header.accBill || 'B',
        finance: Number(footer.finance) || 0,
        financeFlag: !!footer.financeFlag,
        remark2: footer.remark2 || '',
        bookId: selectedBook?._id || selectedBook?.id || undefined,
        bookName: bookTitle,
        bookKind: isBank ? 'bank' : 'cash',
        narration: footer.remark1 || `${voucherType} — ${selectedParty?.name || ''}`,
        againstInvoices: isOnAccount ? [] : againstInvoices,
        idempotencyKey: idempotencyKeyRef.current,
        status: 'Posted',
      };

      /** Helper: show a Credit Note toast for each auto-generated note after save */
      const showCreditNoteToast = (discountNotes, type) => {
        if (!discountNotes || !discountNotes.length) return;
        discountNotes.forEach((cn) => {
          const noteId = String(cn._id || cn.id || '');
          const noteNo = cn.noteNo || cn.vNo || '';
          const amt = cn.amount ? `₹${Number(cn.amount).toFixed(2)}` : '';
          const noteSide = cn.noteSide || (type === 'Receipt' ? 'Sales' : 'Purchase');
          const noteType = cn.noteType || 'Credit';
          toast.success(
            `🗒️ ${noteType} Note auto-created${noteNo ? ` #${noteNo}` : ''}${amt ? ` — ${amt}` : ''} (Discount)`,
            {
              duration: 10000,
              action: {
                label: `Open ${noteType} Note`,
                dismiss: true,
                onClick: () => {
                  setCreditNoteModal({ open: true, noteId, type: noteType, side: noteSide });
                },
              },
            }
          );
        });
      };

      if (mode === 'Edit' && selectedVoucherId) {
        // Backend reverses the original posting and re-posts these figures atomically,
        // keeping the voucher number. The idempotency key is dropped — this is a
        // deliberate rewrite of an existing voucher, not a replay of a new one.
        const editPayload = { ...payload };
        delete editPayload.idempotencyKey;
        const result = await updateVoucher(selectedVoucherId, editPayload);
        notifySuccess(`${voucherType} updated — ledger & bill outstanding re-posted`);
        showCreditNoteToast(result?.discountNotes, voucherType);
      } else if (voucherType === 'Receipt') {
        const result = await addReceipt(payload);
        notifySuccess(`${voucherType} saved successfully`);
        showCreditNoteToast(result?.discountNotes, voucherType);
      } else {
        const result = await addPayment(payload);
        notifySuccess(`${voucherType} saved successfully`);
        showCreditNoteToast(result?.discountNotes, voucherType);
      }

      await fetchVouchers();
      resetNew();
      setMode('View');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to save voucher');
      notifyError(err, 'Failed to save voucher');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  if (!isOpen) return null;

  return (
    <>
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title={windowTitle} windowId={`cashbank-${bookKind}-${initialType || 'Receipt'}`} bare>
      {({ WindowControls }) => (
      <div className="classic-erp-window flex flex-col h-full min-h-0 !max-h-none">
        <ErpBusyOverlay show={bootLoading} message="Loading cash/bank book…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Saving voucher…" />
        <div className="classic-erp-header shrink-0">
          <span className="erp-window-title truncate">{windowTitle}</span>
          <WindowControls />
        </div>

        <div className="classic-erp-body cash-bank-form flex-1 overflow-y-auto flex flex-col">
          <div className="classic-erp-frame cash-bank-header">
            <div
              className="cash-bank-row"
              style={{
                gridTemplateColumns: isBankReceipt
                  ? 'minmax(200px,1.1fr) minmax(180px,1fr) minmax(120px,0.7fr) auto'
                  : 'minmax(200px,1.1fr) minmax(180px,1fr) auto',
              }}
            >
              <div className="classic-erp-field">
                <span className="classic-erp-label">Voucher No:</span>
                <div className="classic-erp-control">
                  <input type="text" className="classic-erp-input text-center" style={{ maxWidth: 72 }} value={header.voucherNo} readOnly />
                  <button type="button" className="classic-erp-btn" style={{ padding: '0 8px', minWidth: 28 }} title="Browse" onClick={handleFind} disabled={readOnly}>…</button>
                </div>
              </div>
              <div className="classic-erp-field">
                <span className="classic-erp-label">Int.B.No:</span>
                <div className="classic-erp-control">
                  <select className="classic-erp-select" style={{ maxWidth: 48 }} value={header.intBillFlag} onChange={setH('intBillFlag')} disabled={locked}>
                    <option value="N">N</option>
                    <option value="Y">Y</option>
                  </select>
                  <input type="text" className="classic-erp-input" value={header.intBillNo} onChange={setH('intBillNo')} disabled={locked} />
                </div>
              </div>
              {isBankReceipt && (
                <div className="classic-erp-field classic-erp-field--sm">
                  <span className="classic-erp-label">Slip No:</span>
                  <input type="text" className="classic-erp-input" value={header.slipNo} onChange={setH('slipNo')} disabled={locked} />
                </div>
              )}
              <div className="cash-bank-meta-right">
                <span>{Number(closingBal || 0).toFixed(2)}</span>
                <span>{header.scCode || 'SC27'}</span>
              </div>
            </div>

            <div
              className="cash-bank-row"
              style={{
                // Date [+ Cheq No, Cheq Date, Clear Dt when bank] [+ P.Bank on any bank voucher — Payment or Receipt]
                gridTemplateColumns: isBank
                  ? 'minmax(180px,1fr) minmax(120px,0.8fr) minmax(150px,0.9fr) minmax(150px,0.9fr) minmax(200px,1.1fr)'
                  : 'minmax(240px,1fr)',
              }}
            >
              <div className="classic-erp-field">
                <span className="classic-erp-label">Date:</span>
                <div className="classic-erp-control">
                  <input type="date" className="classic-erp-input" value={header.date} onChange={setH('date')} disabled={locked} />
                  <span className="cash-bank-day">{dayLabel(header.date)}</span>
                </div>
              </div>
              {isBank && (
                <>
                  <div className="classic-erp-field classic-erp-field--sm">
                    <span className="classic-erp-label">Cheq No:</span>
                    <input type="text" className="classic-erp-input" value={header.chequeNo} onChange={setH('chequeNo')} disabled={locked} />
                  </div>
                  <div className="classic-erp-field classic-erp-field--xs">
                    <span className="classic-erp-label">Date:</span>
                    <input type="date" className="classic-erp-input" value={header.chequeDate} onChange={setH('chequeDate')} disabled={locked} />
                  </div>
                  {/* Blank until the instrument actually clears the bank. */}
                  <div className="classic-erp-field classic-erp-field--xs" data-enter-skip>
                    <span className="classic-erp-label">Clear Dt:</span>
                    <input type="date" className="classic-erp-input" value={header.clearDate} onChange={setH('clearDate')} disabled={locked} title="Date the cheque/transfer cleared the bank" />
                  </div>
                </>
              )}
              {isBank && (
                <div className="classic-erp-field classic-erp-field--sm">
                  <span className="classic-erp-label">P.Bank:</span>
                  <div className="classic-erp-control">
                    <ERPCombobox
                      value={header.partyBank}
                      onChange={(val) => setHeader((h) => ({ ...h, partyBank: val }))}
                      options={partyBankOptions}
                      placeholder={
                        !header.partyId
                          ? 'Select Party first…'
                          : partyBankOptions.length
                            ? 'Select party bank…'
                            : 'No party bank — type & Add'
                      }
                      disabled={locked || !header.partyId}
                      recentKey="cash-bank-pbank"
                      onCreateNew={!locked && header.partyId ? handleAddPartyBank : undefined}
                      createLabel="P.Bank"
                      emptyMessage="No party bank. Type name & Add"
                      allowClear
                    />
                    {!locked && (
                      <button
                        type="button"
                        title={header.partyId ? 'Add P.Bank to party' : 'Select a Party first — a bank needs a party to belong to'}
                        onClick={() => handleAddPartyBank(header.partyBank)}
                        disabled={!header.partyId}
                        style={{
                          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2,
                          padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#fff',
                          background: header.partyId ? '#16a34a' : '#94a3b8',
                          border: 'none', borderRadius: 4,
                          cursor: header.partyId ? 'pointer' : 'not-allowed',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Plus size={11} /> Add
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="cash-bank-row cash-bank-row--3">
              <div className="classic-erp-field" ref={partyFieldRef}>
                <span className="classic-erp-label">Party:</span>
                <ERPCombobox
                  value={header.partyId}
                  onChange={(val) => setHeader((h) => ({ ...h, partyId: val, partyBank: '' }))}
                  options={partyOptions}
                  placeholder="Search party…"
                  disabled={locked}
                  recentKey="cash-bank-party"
                />
              </div>
              <div className="cash-bank-clbal">
                <span className="classic-erp-label">Cl.Bal</span>
                <span className="font-mono">{Number(closingBal || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Field order here IS the Enter-key order: Party → Bank/Cash → Amount → Acc/Bill → BillNo. */}
            <div className={`cash-bank-row ${isOnAccount ? 'cash-bank-row--4' : 'cash-bank-row--5'}`}>
              <div className="classic-erp-field classic-erp-field--xs">
                <div className="flex items-center justify-between">
                  <span className="classic-erp-label">{isBank ? 'Bank:' : 'Cash:'}</span>
                  {header.bankLedgerId && (
                    <button
                      type="button"
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                      onClick={() => setBankLedgerOpen(true)}
                      title="Open Bank Ledger Statement (Zoom Ledger)"
                    >
                      Zoom Ledger
                    </button>
                  )}
                </div>
                <ERPCombobox
                  value={header.bankLedgerId}
                  onChange={(val) => setHeader((h) => ({ ...h, bankLedgerId: val }))}
                  options={bankCashLedgers.map((l) => ({ value: l._id || l.id, label: l.name }))}
                  placeholder={noBookLedger ? `No ${isBank ? 'Bank' : 'Cash'} ledger` : `Select ${isBank ? 'Bank' : 'Cash'}…`}
                  disabled={locked}
                  recentKey={`cash-bank-ledger-${settlementKind}`}
                  emptyMessage={`No ledger with account type "${isBank ? 'Bank' : 'Cash'}"`}
                />
              </div>
              <div className="classic-erp-field classic-erp-field--sm">
                <span className="classic-erp-label">Amount:</span>
                <input type="number" className="classic-erp-input text-right font-bold" value={header.amount} onChange={setH('amount')} disabled={locked} />
              </div>
              <div className="classic-erp-field classic-erp-field--sm">
                <span className="classic-erp-label">Acc/Bill:</span>
                <select className="classic-erp-select text-center" value={header.accBill} onChange={setH('accBill')} disabled={locked}>
                  <option value="B">B</option>
                  <option value="A">A</option>
                </select>
              </div>
              {/* Preset by whichever menu opened this window — kept out of the Enter chain. */}
              <div className="classic-erp-field classic-erp-field--xs" data-enter-skip>
                <span className="classic-erp-label">Type:</span>
                <select className="classic-erp-select" value={voucherType} onChange={(e) => setVoucherType(e.target.value)} disabled={locked || mode === 'Edit'}>
                  <option value="Receipt">Receipt</option>
                  <option value="Payment">Payment</option>
                </select>
              </div>
              {!isOnAccount && (
                <div
                  className="cash-bank-paid-indicator"
                  title="Paid = sum of Adjust across bill rows · UnPaid = Amount not yet allocated to a bill"
                >
                  <div className={`cash-bank-paid-chip ${amountMismatch ? 'is-mismatch' : 'is-ok'}`}>
                    <span>Paid</span>
                    <b>{paidTotal.toFixed(2)}</b>
                  </div>
                  <div className={`cash-bank-paid-chip ${amountMismatch ? 'is-mismatch' : ''}`}>
                    <span>UnPaid</span>
                    <b>{unpaidTotal.toFixed(2)}</b>
                  </div>
                </div>
              )}
            </div>

            {!isOnAccount && amountMismatch && (
              <p className="cash-bank-mismatch-hint">
                ⚠ Save is locked —{' '}
                {unpaidTotal > 0
                  ? `₹${unpaidTotal.toFixed(2)} of the Amount is not yet adjusted against a bill. Raise Adjust on a row (or add another Bill Row).`
                  : `Adjust exceeds the Amount by ₹${Math.abs(unpaidTotal).toFixed(2)}. Lower Adjust on a row or raise the Amount.`}
                {' '}Total Adjust must equal Amount exactly.
              </p>
            )}

            {noBookLedger && (
              <p className="text-red-700 font-bold text-[11px] px-1">
                No ledger with account type “{isBank ? 'Bank' : 'Cash'}” exists. Create one in the
                Chart of Accounts — otherwise this voucher cannot reach the {isBank ? 'Bank' : 'Cash'} Book.
              </p>
            )}
          </div>

          {isOnAccount ? (
            <div className="cash-bank-onaccount-note">
              <b>On-Account (Acc/Bill: A)</b> — the amount lands directly on {selectedParty?.name || 'the party'}&apos;s
              balance. No bill selection needed. Switch Acc/Bill to <b>B</b> to settle against specific bills.
            </div>
          ) : (
          <div className="classic-erp-table-container flex-1 min-h-[200px]" style={{ background: '#f5ecd8' }}>
            <table className="classic-erp-table cash-bank-bill-grid">
              <thead>
                <tr>
                  <th className="w-6" />
                  <th className="w-24">BillNo</th>
                  <th className="w-8">N/</th>
                  <th className="w-24">BillDt</th>
                  <th className="w-16 text-right">BillAmt</th>
                  <th className="w-14 text-right">PartRc</th>
                  <th className="w-12 text-right">Rg</th>
                  <th className="w-12 text-right">Tds</th>
                  <th className="w-12 text-right">Claim</th>
                  <th className="w-12 text-right">RD</th>
                  <th className="w-10 text-center">OsDy</th>
                  <th className="w-12">Type</th>
                  <th className="w-16 text-right">OsAmt</th>
                  <th className="w-16 text-right">Adjust</th>
                  <th className="w-12 text-right">JvDis</th>
                  <th className="w-8">PQ</th>
                  <th className="w-12 text-right">Dis%</th>
                  <th className="w-16 text-right">Discount</th>
                  <th className="w-12 text-right">Int</th>
                  <th className="w-12 text-right">Oth1</th>
                  <th className="w-12 text-right">Oth2</th>
                  <th className="w-8">Bc</th>
                  <th className="w-16 text-right">NetOs</th>
                </tr>
              </thead>
              <tbody>
                {billRows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td className="text-center text-blue-800 font-bold">
                      {locked ? (
                        idx === 0 ? '►' : ''
                      ) : (
                        <button
                          type="button"
                          tabIndex={-1}
                          title="Remove this line (Ctrl+Del in BillNo)"
                          onClick={() => removeBillRow(idx)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 700, lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                    <td>
                      <input
                        ref={(el) => { billNoRefs.current[idx] = el; }}
                        type="text"
                        className="classic-erp-input w-full border-0 bg-transparent"
                        value={row.billNo}
                        onChange={(e) => updateRow(idx, 'billNo', e.target.value)}
                        onClick={() => {
                          // Only steal the click on an empty cell — clicking to position the
                          // cursor inside an already-picked bill number must not reopen the picker.
                          if (!String(row.billNo || '').length) openBillLookup(idx);
                        }}
                        onKeyDown={(e) => {
                          // Reference ERP: SpaceBar → Open O/S Bill, F4 → Open Bill, Del → Delete Row.
                          // Enter keeps working too, and Space/Del only fire on an empty cell so
                          // neither one is stolen from ordinary typing.
                          const cellEmpty = !String(row.billNo || '').length;
                          if (e.key === 'Enter' || e.key === 'F4' || (e.key === ' ' && cellEmpty)) {
                            e.preventDefault();
                            e.stopPropagation();
                            openBillLookup(idx);
                          } else if (e.key === 'Delete' && (e.ctrlKey || e.shiftKey || cellEmpty)) {
                            e.preventDefault();
                            pendingFocusRowRef.current = Math.max(0, idx - 1);
                            removeBillRow(idx);
                          }
                        }}
                        placeholder="Click or Enter/Space ⇒ pick bill"
                        disabled={locked}
                      />
                    </td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent text-center" value={row.nSlash} onChange={(e) => updateRow(idx, 'nSlash', e.target.value)} disabled={locked} /></td>
                    <td><input type="date" className="classic-erp-input w-full border-0 bg-transparent" value={row.billDt || ''} onChange={(e) => updateRow(idx, 'billDt', e.target.value)} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.billAmt || ''} onChange={(e) => updateRow(idx, 'billAmt', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.partRc || ''} onChange={(e) => updateRow(idx, 'partRc', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.rg || ''} onChange={(e) => updateRow(idx, 'rg', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.tds || ''} onChange={(e) => updateRow(idx, 'tds', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.claim || ''} onChange={(e) => updateRow(idx, 'claim', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.rd || ''} onChange={(e) => updateRow(idx, 'rd', Number(e.target.value))} disabled={locked} /></td>
                    <td className="text-center font-mono">{row.osDy || 0}</td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent" value={row.billType} onChange={(e) => updateRow(idx, 'billType', e.target.value)} disabled={locked} /></td>
                    <td className="text-right font-mono pr-1">{Number(row.osAmt || 0).toFixed(2)}</td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right font-bold text-blue-900" value={row.adjust || ''} onChange={(e) => updateRow(idx, 'adjust', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.jvDis || ''} onChange={(e) => updateRow(idx, 'jvDis', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent text-center" value={row.pq} onChange={(e) => updateRow(idx, 'pq', e.target.value)} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.disPer || ''} onChange={(e) => updateRow(idx, 'disPer', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.discount || ''} onChange={(e) => updateRow(idx, 'discount', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.interest || ''} onChange={(e) => updateRow(idx, 'interest', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.oth1 || ''} onChange={(e) => updateRow(idx, 'oth1', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.oth2 || ''} onChange={(e) => updateRow(idx, 'oth2', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent text-center" value={row.bc} onChange={(e) => updateRow(idx, 'bc', e.target.value)} disabled={locked} /></td>
                    <td className="text-right font-mono font-bold pr-1">{Number(row.netOs || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {!locked && !isOnAccount && (
            <div className="cash-bank-toolbar">
              <button type="button" className="classic-erp-btn" onClick={() => setBillRows((r) => [...r, emptyBillRow()])}>+ Add Bill Row</button>
              <button
                type="button"
                className="classic-erp-btn"
                disabled={!header.partyId}
                onClick={() => {
                  if (!header.partyId || header.accBill !== 'B') {
                    setBillRows([emptyBillRow()]);
                    return;
                  }
                  const rows = partyInvoices.map((inv) => ({
                    ...emptyBillRow(),
                    id: inv._id,
                    invoiceId: inv._id,
                    billNo: inv.invoiceNo,
                    billDt: inv.billDt,
                    billAmt: inv.billAmt,
                    partRc: inv.paidAmt || 0,
                    osAmt: inv.osAmt,
                    osDy: inv.osDy,
                    netOs: inv.osAmt,
                    adjust: 0,
                  }));
                  setBillRows(rows.length ? [...rows, emptyBillRow()] : [emptyBillRow()]);
                }}
              >
                Load Outstanding Bills
              </button>
              <span className="text-[10px] text-slate-500 self-center ml-2">
                Enter / SpaceBar / F4 ⇒ Open O/S Bill · auto-allocates &amp; moves to next line · Del ⇒ Delete Row
              </span>
            </div>
          )}

          <div className="cash-bank-footer-grid">
            <div className="classic-erp-frame">
              <div className="classic-erp-field classic-erp-field--lg" style={{ alignItems: 'start' }}>
                <span className="classic-erp-label" style={{ paddingTop: 4 }}>Remark:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  <input type="text" className="classic-erp-input w-full" value={footer.remark1} onChange={(e) => setFooter((f) => ({ ...f, remark1: e.target.value }))} disabled={locked} />
                  <input type="text" className="classic-erp-input w-full" value={footer.remark2} onChange={(e) => setFooter((f) => ({ ...f, remark2: e.target.value }))} disabled={locked} />
                </div>
              </div>
              <div className="cash-bank-flags">
                <label className="classic-erp-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={footer.financeFlag} onChange={(e) => setFooter((f) => ({ ...f, financeFlag: e.target.checked }))} disabled={locked} />
                  Finance
                </label>
                <input type="number" className="classic-erp-input text-right" style={{ width: 80 }} value={footer.finance} onChange={(e) => setFooter((f) => ({ ...f, finance: Number(e.target.value) }))} disabled={locked || !footer.financeFlag} />
                <div className="classic-erp-field classic-erp-field--xs">
                  <span className="classic-erp-label">UnPaid:</span>
                  <input
                    type="text"
                    className="classic-erp-input text-right font-mono"
                    style={amountMismatch ? { color: '#b91c1c', fontWeight: 700 } : undefined}
                    value={unpaidTotal.toFixed(2)}
                    readOnly
                  />
                </div>
                <div className="classic-erp-field classic-erp-field--xs">
                  <span className="classic-erp-label">Paid:</span>
                  <input type="text" className="classic-erp-input text-right font-mono font-bold" value={paidTotal.toFixed(2)} readOnly />
                </div>
              </div>
            </div>
            <div className="classic-erp-frame" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ flex: 1, minHeight: 40, borderRadius: 4, border: '1px solid #f59e0b', background: '#fff59d', padding: '4px 6px', fontSize: 11, fontFamily: 'monospace', display: 'flex', flexWrap: 'wrap', gap: '2px 6px', alignContent: 'flex-start' }}>
                <span>( B.AMT- {breakdownTotals.billAmt.toFixed(0)} )</span>
                <span>( TDS- {breakdownTotals.tds.toFixed(0)} )</span>
                <span>( RG- {breakdownTotals.rg.toFixed(0)} )</span>
                <span>( CLAIM- {breakdownTotals.claim.toFixed(0)} )</span>
                <span>( RD- {breakdownTotals.rd.toFixed(0)} )</span>
                <span>( DISC- {breakdownTotals.discount.toFixed(0)} )</span>
                <span>( INT- {breakdownTotals.interest.toFixed(0)} )</span>
                <span>( OTH1- {breakdownTotals.oth1.toFixed(0)} )</span>
                <span>( OTH2- {breakdownTotals.oth2.toFixed(0)} )</span>
              </div>
              {/* Receipt vs allocation, recomputed on every keystroke (spec §6). */}
              <div
                style={{
                  border: `1px solid ${amountMismatch ? '#dc2626' : '#cbd5e1'}`,
                  background: amountMismatch ? '#fee2e2' : '#f8fafc',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 11,
                  display: 'grid',
                  gridTemplateColumns: 'auto auto',
                  gap: '1px 8px',
                }}
              >
                <span className="text-slate-600">{receivedAmount > 0 ? 'Received' : 'Received (from bills)'}</span>
                <span className="text-right font-mono font-bold">{effectiveReceived.toFixed(2)}</span>
                <span className="text-slate-600">Allocated ({allocatedBillCount} bill{allocatedBillCount === 1 ? '' : 's'})</span>
                <span className="text-right font-mono font-bold">{paidTotal.toFixed(2)}</span>
                <span className={amountMismatch ? 'text-red-700 font-bold' : 'text-slate-600'}>
                  {amountMismatch ? 'Check Amount' : 'Difference'}
                </span>
                <span className={`text-right font-mono font-bold ${amountMismatch ? 'text-red-700' : 'text-green-700'}`}>
                  {unpaidTotal.toFixed(2)}
                </span>
              </div>
              <div className="text-center text-xs text-slate-500">AVG DAYS: {avgDays.toFixed(2)}</div>
              <div className="bg-red-700 text-white text-center text-xs font-bold py-1 rounded">Chq. Return Status</div>
              <button
                type="button"
                className="text-blue-700 text-xs underline self-center"
                onClick={() => notifyWarning(
                  `Enter moves to the next field: Party → ${isBank ? 'Bank' : 'Cash'} → Amount → Acc/Bill → BillNo. ` +
                  'Enter on BillNo opens the bill lookup; picking a bill allocates it and jumps to the next line. ' +
                  'Ctrl+Del clears a line. Acc/Bill=A posts on-account with no bill rows.'
                )}
              >
                Help
              </button>
            </div>
          </div>

          {error && <p className="text-red-600 font-bold text-xs uppercase px-1">{error}</p>}

          <div className="classic-erp-field" style={{ maxWidth: 360, gridTemplateColumns: '48px 1fr auto', gap: 8 }}>
            <span className="classic-erp-label">Find:</span>
            <input type="text" className="classic-erp-input" placeholder="Voucher No / Party / Slip" value={findQuery} onChange={(e) => setFindQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFind()} />
            <span className="text-xs text-slate-500 whitespace-nowrap">{viewList.length} voucher(s)</span>
          </div>
        </div>

        <div className="classic-erp-form-footer flex-wrap">
          <button className="classic-erp-btn" type="button" onClick={handleNew} disabled={readOnly || mode === 'Add' || mode === 'Edit'}>New</button>
          <button className="classic-erp-btn" type="button" onClick={handleEdit} disabled={readOnly || mode !== 'View' || !selectedVoucherId}>Edit</button>
          <button
            className="classic-erp-btn btn-blue"
            type="button"
            data-enter-save
            onClick={handleSave}
            disabled={locked || saving || bootLoading || noBookLedger || amountMismatch || effectiveReceived <= 0}
            title={
              amountMismatch
                ? 'Check Amount: total Adjust must exactly equal the Amount'
                : effectiveReceived <= 0
                  ? 'Enter an Amount (or adjust against a bill) before saving'
                  : undefined
            }
          >
            <SaveButtonLabel saving={saving} />
          </button>
          <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked}>Cancel</button>
          <button className="classic-erp-btn" type="button" onClick={handleFind}>Find</button>
          <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || !selectedVoucherId || mode !== 'View'} title="Reverses posted voucher — ledger entries and bill outstanding are undone, not hard-deleted">Delete</button>
          <button className="classic-erp-btn" type="button" onClick={onClose}>Exit</button>
          <button className="classic-erp-btn font-bold text-blue-800" type="button" onClick={() => setBankLedgerOpen(true)} disabled={!header.bankLedgerId} title="Open Bank/Cash Ledger (Zoom Ledger)">Zoom Ledger</button>
          {isBank && <button className="classic-erp-btn" type="button" onClick={() => notifyWarning('Cheque return — use Bank Reconciliation.')}>Cheq Rt</button>}
          <button className="classic-erp-btn" type="button" onClick={() => { setFindQuery(''); handleFind(); }}>Sp.Find</button>
          {isBankReceipt && <button className="classic-erp-btn" type="button" onClick={handlePrint}>Slip.Print</button>}
          {isBank && !isBankReceipt && <button className="classic-erp-btn" type="button" onClick={handlePrint}>Chq.Print</button>}
          <button className="classic-erp-btn" type="button" onClick={handlePrint}>{isBank ? 'Vou.Print' : 'Print'}</button>
          <button className="classic-erp-btn" type="button" title="Keyboard">K</button>
          <button className="classic-erp-btn" type="button" title="Head">{selectedBook?.head1 || 'Head'}</button>
        </div>
      </div>
      )}
    </ErpWindowedModal>

    <BillNoLookupModal
      isOpen={billLookupOpen}
      onClose={() => setBillLookupOpen(false)}
      invoices={billLookupInvoices}
      partyName={selectedParty?.name || ''}
      onSelect={handleBillSelect}
    />

    <AccountMasterModal
      isOpen={bankMasterOpen}
      onClose={() => setBankMasterOpen(false)}
      initialData={selectedParty}
      initialTab="Bank Details"
      prefillBankName={header.partyBank}
      onSuccess={async () => {
        await fetchParties();
        setBankMasterOpen(false);
        notifySuccess(`P.Bank "${header.partyBank}" saved to party master`);
      }}
    />
    {/* Credit Note / Debit Note viewer — opened from the post-save discount toast */}
    <NoteModal
      isOpen={creditNoteModal.open}
      onClose={() => setCreditNoteModal((s) => ({ ...s, open: false }))}
      initialType={creditNoteModal.type}
      initialSide={creditNoteModal.side}
      initialNoteId={creditNoteModal.noteId}
    />

    {bankLedgerOpen && (
      <LedgerModal
        isOpen={bankLedgerOpen}
        onClose={() => setBankLedgerOpen(false)}
        initialLedgerId={header.bankLedgerId}
        autoRun={true}
      />
    )}
    </>
  );
};

export default CashBankBookModal;
