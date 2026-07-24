import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { ERPCombobox } from '../../components/erp';
import { notifySuccess, notifyWarning, notifyError } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import { Plus } from 'lucide-react';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const todayISO = () => new Date().toISOString().split('T')[0];

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
    fetchParties,
    fetchLedgers,
    fetchSales,
    fetchPurchases,
    fetchVouchers,
    addPayment,
    addReceipt,
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
  const openedRef = useRef(false);

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

  const bankCashLedgers = useMemo(() => {
    let list = ledgers.filter((l) => {
      const n = (l.name || '').toLowerCase();
      const g = (l.group || l.accountType || '').toLowerCase();
      if (!isBank) return n.includes('cash') || g.includes('cash');
      return n.includes('bank') || g.includes('bank');
    });
    if (list.length === 0) {
      list = ledgers.filter((l) => {
        const n = (l.name || '').toLowerCase();
        return n.includes('cash') || n.includes('bank');
      });
    }
    if (list.length === 0) list = ledgers;
    return list;
  }, [ledgers, isBank]);

  const partyOptions = useMemo(
    () => parties.map((p) => ({ value: p._id || p.id, label: p.name })),
    [parties]
  );

  const partyInvoices = useMemo(() => {
    if (!header.partyId) return [];
    const docs =
      voucherType === 'Receipt'
        ? sales.filter((s) => (s.customerId?._id || s.customerId) === header.partyId)
        : purchases.filter((p) => (p.supplierId?._id || p.supplierId) === header.partyId);

    return docs
      .map((doc) => {
        const docTotal = doc.netAmount || doc.totalAmount || 0;
        const paid = (vouchers || [])
          .filter((v) => v.status === 'Posted')
          .reduce((sum, v) => {
            const match = v.againstInvoices?.find(
              (item) => String(item.invoiceId) === String(doc._id)
            );
            return sum + (match ? Number(match.amount || 0) : 0);
          }, 0);
        const outstanding = Math.max(0, docTotal - paid);
        const billDt = doc.date ? new Date(doc.date).toISOString().split('T')[0] : '';
        const osDy = billDt
          ? Math.max(0, Math.floor((Date.now() - new Date(billDt).getTime()) / 86400000))
          : 0;
        return {
          _id: doc._id,
          invoiceNo: doc.invoiceNo || doc.billNo || '',
          billDt,
          billAmt: docTotal,
          osAmt: outstanding,
          osDy,
        };
      })
      .filter((inv) => inv.osAmt > 0.01);
  }, [header.partyId, voucherType, sales, purchases, vouchers]);

  const unpaidTotal = useMemo(
    () => billRows.reduce((s, r) => s + (Number(r.osAmt) || 0), 0),
    [billRows]
  );
  const paidTotal = useMemo(
    () => billRows.reduce((s, r) => s + (Number(r.adjust) || 0), 0),
    [billRows]
  );
  const avgDays = useMemo(() => {
    const withDays = billRows.filter((r) => Number(r.osDy) > 0);
    if (!withDays.length) return 0;
    return withDays.reduce((s, r) => s + Number(r.osDy || 0), 0) / withDays.length;
  }, [billRows]);
  const totalPcs = useMemo(
    () => billRows.reduce((s, r) => s + (Number(r.pq) || 0), 0),
    [billRows]
  );

  const closingBal = useMemo(() => {
    if (selectedParty) {
      const recv = Number(selectedParty.outstandingReceivable || 0);
      const pay = Number(selectedParty.outstandingPayable || 0);
      if (voucherType === 'Receipt') return recv || unpaidTotal;
      return pay || unpaidTotal;
    }
    return unpaidTotal;
  }, [selectedParty, unpaidTotal, voucherType]);

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
    if (header.bankLedgerId) return;
    const first = bankCashLedgers[0];
    if (first) {
      setHeader((h) => ({ ...h, bankLedgerId: first._id || first.id }));
    }
  }, [bankCashLedgers, isOpen, locked, header.bankLedgerId]);

  const loadPartyBills = () => {
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
      osAmt: inv.osAmt,
      osDy: inv.osDy,
      netOs: inv.osAmt,
      adjust: 0,
    }));
    setBillRows(rows.length ? rows : [emptyBillRow()]);
  };

  useEffect(() => {
    if (!isOpen || mode === 'View') return;
    loadPartyBills();
  }, [header.partyId, header.accBill, partyInvoices.length]);

  const setH = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setHeader((h) => ({ ...h, [key]: val }));
  };

  const handleAddPartyBank = async (rawName = '') => {
    const bankName = String(rawName || '').trim().toUpperCase();
    if (!bankName) {
      notifyWarning('Type bank name to add as P.Bank');
      return;
    }
    setHeader((h) => ({ ...h, partyBank: bankName }));
    if (!header.partyId) {
      notifyWarning('P.Bank set on voucher. Select Party to save it on party master.');
      return;
    }
    const existing = selectedParty?.banks || [];
    if (existing.some((b) => String(b.name || b.bankName || '').toUpperCase() === bankName)) {
      notifySuccess('P.Bank selected');
      return;
    }
    try {
      await updateParty(header.partyId, {
        banks: [...existing, { name: bankName, accountNo: '', ifsc: '' }],
      });
      await fetchParties();
      notifySuccess(`P.Bank "${bankName}" added to party`);
    } catch (err) {
      notifyError(err, 'Could not save P.Bank on party');
    }
  };

  const updateRow = (idx, key, value) => {
    setBillRows((rows) => {
      const next = [...rows];
      const row = { ...next[idx], [key]: value };
      if (['disPer', 'osAmt', 'adjust', 'tds', 'discount', 'jvDis', 'rg', 'partRc'].includes(key)) {
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
        row.netOs = Number((os - adjust - discount - tds - jvDis - rg).toFixed(2));
      }
      next[idx] = row;
      return next;
    });
  };

  const loadVoucher = (v) => {
    setSelectedVoucherId(v._id || v.id);
    setVoucherType(v.voucherType || voucherType);
    setHeader({
      voucherNo: v.voucherNo || '',
      intBillFlag: v.intBillFlag || 'N',
      intBillNo: v.intBillNo || '',
      slipNo: v.slipNo || '',
      date: v.date ? new Date(v.date).toISOString().split('T')[0] : todayISO(),
      chequeNo: v.chequeNo || '',
      chequeDate: v.chequeDate ? new Date(v.chequeDate).toISOString().split('T')[0] : todayISO(),
      partyBank: v.partyBank || '',
      partyId: v.partyLedgerId?._id || v.partyLedgerId || '',
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

  const handleEdit = () => {
    if (!selectedVoucherId) return notifyWarning('Find / select a voucher first');
    notifyWarning(
      'Posted vouchers cannot be edited. Use Delete / Reverse, then create a new voucher.'
    );
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
    if (!header.partyId) {
      setError('Select Party');
      return;
    }
    if (!header.bankLedgerId) {
      setError(`Select ${isBank ? 'Bank' : 'Cash'} ledger`);
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
              banks: [...existing, { name: header.partyBank, accountNo: '', ifsc: '' }],
            });
          } catch {
            /* non-blocking */
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
        againstInvoices,
        status: 'Posted',
      };

      if (voucherType === 'Receipt') await addReceipt(payload);
      else await addPayment(payload);

      notifySuccess(`${voucherType} saved successfully`);
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
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-[98vw] w-[1180px]">
      <div className="classic-erp-window flex flex-col h-full max-h-[94vh]">
        <ErpBusyOverlay show={bootLoading} message="Loading cash/bank book…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Saving voucher…" />
        <div className="classic-erp-header">
          <span>{windowTitle}</span>
          <button type="button" className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        <div className="classic-erp-body cash-bank-form flex-1 overflow-y-auto flex flex-col">
          <div className="classic-erp-frame cash-bank-header">
            <div
              className="cash-bank-row"
              style={{
                gridTemplateColumns: isBank
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
              {isBank && (
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
                gridTemplateColumns: isBank
                  ? 'minmax(210px,1.1fr) minmax(140px,0.85fr) minmax(180px,1fr) minmax(220px,1.2fr)'
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
                  <div className="classic-erp-field classic-erp-field--sm">
                    <span className="classic-erp-label">P.Bank:</span>
                    <div className="classic-erp-control">
                      <ERPCombobox
                        value={header.partyBank}
                        onChange={(val) => setHeader((h) => ({ ...h, partyBank: val }))}
                        options={partyBankOptions}
                        placeholder={partyBankOptions.length ? 'Select party bank…' : 'No party bank — type & Add'}
                        disabled={locked}
                        recentKey="cash-bank-pbank"
                        onCreateNew={!locked ? handleAddPartyBank : undefined}
                        createLabel="P.Bank"
                        emptyMessage="No party bank. Type name & Add"
                        allowClear
                      />
                      {!locked && (
                        <button
                          type="button"
                          title="Add P.Bank to party"
                          onClick={() => handleAddPartyBank(header.partyBank)}
                          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#fff', background: '#16a34a', border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <Plus size={11} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="cash-bank-row cash-bank-row--3">
              <div className="classic-erp-field">
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

            <div className="cash-bank-row cash-bank-row--4">
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
              <div className="classic-erp-field classic-erp-field--xs">
                <span className="classic-erp-label">{isBank ? 'Bank:' : 'Cash:'}</span>
                <ERPCombobox
                  value={header.bankLedgerId}
                  onChange={(val) => setHeader((h) => ({ ...h, bankLedgerId: val }))}
                  options={bankCashLedgers.map((l) => ({ value: l._id || l.id, label: l.name }))}
                  placeholder={`Select ${isBank ? 'Bank' : 'Cash'}…`}
                  disabled={locked}
                  recentKey={`cash-bank-ledger-${settlementKind}`}
                />
              </div>
              <div className="classic-erp-field classic-erp-field--xs">
                <span className="classic-erp-label">Type:</span>
                <select className="classic-erp-select" value={voucherType} onChange={(e) => setVoucherType(e.target.value)} disabled={locked || mode === 'Edit'}>
                  <option value="Receipt">Receipt</option>
                  <option value="Payment">Payment</option>
                </select>
              </div>
            </div>
          </div>

          <div className="classic-erp-table-container flex-1 min-h-[200px]" style={{ background: '#f5ecd8' }}>
            <table className="classic-erp-table cash-bank-bill-grid">
              <thead>
                <tr>
                  <th className="w-6" />
                  <th>BillNo</th>
                  <th className="w-10">N/</th>
                  <th>BillDt</th>
                  <th className="text-right">BillAmt</th>
                  <th className="text-right">PartRc</th>
                  <th className="text-right">Rg</th>
                  <th className="text-right">Tds</th>
                  <th className="text-center">OsDy</th>
                  <th>Type</th>
                  <th className="text-right">OsAmt</th>
                  <th className="text-right">Adjust</th>
                  <th className="text-right">JvDis</th>
                  <th className="w-10">PQ</th>
                  <th className="text-right">Dis%</th>
                  <th className="text-right">Discount</th>
                  <th className="w-10">Bc</th>
                  <th className="text-right">NetOs</th>
                </tr>
              </thead>
              <tbody>
                {billRows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td className="text-center text-blue-800 font-bold">{idx === 0 ? '►' : ''}</td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent" value={row.billNo} onChange={(e) => updateRow(idx, 'billNo', e.target.value)} disabled={locked} /></td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent text-center" value={row.nSlash} onChange={(e) => updateRow(idx, 'nSlash', e.target.value)} disabled={locked} /></td>
                    <td><input type="date" className="classic-erp-input w-full border-0 bg-transparent" value={row.billDt || ''} onChange={(e) => updateRow(idx, 'billDt', e.target.value)} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.billAmt || ''} onChange={(e) => updateRow(idx, 'billAmt', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.partRc || ''} onChange={(e) => updateRow(idx, 'partRc', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.rg || ''} onChange={(e) => updateRow(idx, 'rg', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.tds || ''} onChange={(e) => updateRow(idx, 'tds', Number(e.target.value))} disabled={locked} /></td>
                    <td className="text-center font-mono">{row.osDy || 0}</td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent" value={row.billType} onChange={(e) => updateRow(idx, 'billType', e.target.value)} disabled={locked} /></td>
                    <td className="text-right font-mono pr-1">{Number(row.osAmt || 0).toFixed(2)}</td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right font-bold text-blue-900" value={row.adjust || ''} onChange={(e) => updateRow(idx, 'adjust', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.jvDis || ''} onChange={(e) => updateRow(idx, 'jvDis', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent text-center" value={row.pq} onChange={(e) => updateRow(idx, 'pq', e.target.value)} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.disPer || ''} onChange={(e) => updateRow(idx, 'disPer', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="number" className="classic-erp-input w-full border-0 bg-transparent text-right" value={row.discount || ''} onChange={(e) => updateRow(idx, 'discount', Number(e.target.value))} disabled={locked} /></td>
                    <td><input type="text" className="classic-erp-input w-full border-0 bg-transparent text-center" value={row.bc} onChange={(e) => updateRow(idx, 'bc', e.target.value)} disabled={locked} /></td>
                    <td className="text-right font-mono font-bold pr-1">{Number(row.netOs || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!locked && (
            <div className="cash-bank-toolbar">
              <button type="button" className="classic-erp-btn" onClick={() => setBillRows((r) => [...r, emptyBillRow()])}>+ Add Bill Row</button>
              <button type="button" className="classic-erp-btn" onClick={loadPartyBills} disabled={!header.partyId}>Load Outstanding Bills</button>
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
                  <input type="text" className="classic-erp-input text-right font-mono" value={unpaidTotal.toFixed(2)} readOnly />
                </div>
                <div className="classic-erp-field classic-erp-field--xs">
                  <span className="classic-erp-label">Paid:</span>
                  <input type="text" className="classic-erp-input text-right font-mono font-bold" value={paidTotal.toFixed(2)} readOnly />
                </div>
              </div>
            </div>
            <div className="classic-erp-frame" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ flex: 1, minHeight: 40, borderRadius: 4, border: '1px solid #f59e0b', background: '#fff59d' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-red-700 font-bold font-mono">{totalPcs || 0}</span>
                <span className="text-red-700 font-bold">Pcs</span>
              </div>
              <div className="text-center text-xs text-slate-500">AVG DAYS: {avgDays.toFixed(2)}</div>
              <div className="bg-red-700 text-white text-center text-xs font-bold py-1 rounded">Chq. Return Status</div>
              <button type="button" className="text-blue-700 text-xs underline self-center" onClick={() => notifyWarning(isBank ? 'Help: Party → Acc/Bill=B → Adjust → Save. Use Add on P.Bank to save bank on party.' : 'Help: Party → Acc/Bill=B → Adjust → Save. Cash book has no cheque / P.Bank fields.')}>Help</button>
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
          <button className="classic-erp-btn btn-blue" type="button" onClick={handleSave} disabled={locked || saving || bootLoading}>
            <SaveButtonLabel saving={saving} />
          </button>
          <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked}>Cancel</button>
          <button className="classic-erp-btn" type="button" onClick={handleFind}>Find</button>
          <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || !selectedVoucherId || mode !== 'View'} title="Reverse posted voucher (ledger + bill OS)">Delete / Reverse</button>
          <button className="classic-erp-btn" type="button" onClick={onClose}>Exit</button>
          {isBank && <button className="classic-erp-btn" type="button" onClick={() => notifyWarning('Cheque return — use Bank Reconciliation.')}>Cheq Rt</button>}
          <button className="classic-erp-btn" type="button" onClick={() => { setFindQuery(''); handleFind(); }}>Sp.Find</button>
          {isBank && <button className="classic-erp-btn" type="button" onClick={handlePrint}>Slip.Print</button>}
          <button className="classic-erp-btn" type="button" onClick={handlePrint}>{isBank ? 'Vou.Print' : 'Print'}</button>
          <button className="classic-erp-btn" type="button" title="Keyboard">K</button>
          <button className="classic-erp-btn" type="button" title="Head">{selectedBook?.head1 || 'Head'}</button>
        </div>
      </div>
    </Modal>
  );
};

export default CashBankBookModal;
