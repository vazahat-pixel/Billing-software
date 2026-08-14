import { useState, useEffect, useMemo, useRef } from 'react';
import useStore from '../../store/useStore';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import BillNoLookupModal from '../accounting/BillNoLookupModal';
import { notifySuccess, notifyWarning, notifyError } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const todayISO = () => new Date().toISOString().split('T')[0];
const round2 = (n) => Number(Number(n || 0).toFixed(2));
const money = (n) => Number(n || 0).toFixed(2);

const newIdempotencyKey = () => `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const REASON_CODES = [
  { value: '', label: '— Select —' },
  { value: '01', label: '01-Sales Return' },
  { value: '02', label: '02-Post Sale Discount' },
  { value: '03', label: '03-Deficiency in services' },
  { value: '04', label: '04-Correction in Invoice' },
  { value: '05', label: '05-Change in POS' },
  { value: '06', label: '06-Finalization of Provisional assessment' },
  { value: '07', label: '07-Others' },
];

const ITC_OPTIONS = ['', 'Inputs', 'Capital goods', 'Input services', 'Ineligible', 'Ineligible (Others)'];
const QUC_OPTIONS = ['OTH-OTHERS', 'NOS-NUMBERS', 'MTR-METERS', 'KGS-KILOGRAMS', 'PCS-PIECES', 'BOX-BOX'];
const GST_TREATMENTS = ['Registered', 'Unregistered', 'Export', 'SEZ', 'DeemedExport', 'Composition'];

const BLANK_F = {
  vNo: '', date: todayISO(), partyId: '', gstin: '',
  billNo: '', billDate: '',
  againstInvoiceId: '', againstInvoiceNo: '',
  reverseCharge: false,
  gstTreatment: 'Registered',
  itcEligibility: '',
  hsnSac: '', reasonCode: '', reason: '',
  quc: 'OTH-OTHERS',
  accountHeadLedgerId: '',
  amount: '',
  amountMode: 'Exclusive',
  gstRate: 0,
  gstType: 'CGST+SGST',
  tdsLedgerId: '', tdsPercent: 0, tdsRemark: '',
  narration: '',
};

function computeCalc(f) {
  const raw = round2(f.amount);
  const rate = Number(f.gstRate) || 0;
  const isIgst = f.gstType === 'IGST';
  const isInclusive = f.amountMode === 'Inclusive';

  let taxable, cgst, sgst, igst;

  if (rate > 0 && isInclusive) {
    taxable = round2(raw / (1 + rate / 100));
    const gstInside = round2(raw - taxable);
    cgst = isIgst ? 0 : round2(gstInside / 2);
    sgst = isIgst ? 0 : round2(gstInside / 2);
    igst = isIgst ? gstInside : 0;
  } else {
    taxable = raw;
    cgst = isIgst ? 0 : round2((taxable * (rate / 2)) / 100);
    sgst = isIgst ? 0 : round2((taxable * (rate / 2)) / 100);
    igst = isIgst ? round2((taxable * rate) / 100) : 0;
  }

  const totalGst = round2(cgst + sgst + igst);
  const rcmAmount = f.reverseCharge ? totalGst : 0;
  const partyGst = f.reverseCharge ? 0 : totalGst;
  const before = isInclusive && rate > 0 ? raw : round2(taxable + partyGst);
  const roundOff = round2(Math.round(before) - before);
  const netAmount = round2(before + roundOff);
  const tdsPercent = Number(f.tdsPercent) || 0;
  const tdsAmount = round2((taxable * tdsPercent) / 100);
  const finalAmount = round2(netAmount - tdsAmount);
  return { taxable, cgst, sgst, igst, totalGst, rcmAmount, roundOff, netAmount, tdsAmount, finalAmount, halfRate: rate / 2 };
}

const NoteModal = ({ isOpen, onClose, initialType = 'Credit', initialSide = 'Sales', readOnly = false, initialNoteId = null }) => {
  const {
    parties, ledgers, sales, purchases, notes,
    fetchParties, fetchLedgers, fetchSales, fetchPurchases, fetchNotes,
    addNote, updateNote, reverseNote,
  } = useStore();

  const [mode, setMode] = useState('Add');
  const [noteSide, setNoteSide] = useState(initialSide);
  const [noteType, setNoteType] = useState(initialType);
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [error, setError] = useState('');
  const [billLookupOpen, setBillLookupOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const idempotencyKeyRef = useRef(newIdempotencyKey());
  const partyFieldRef = useRef(null);
  const initialNoteLoadedRef = useRef(null);

  const [f, setF] = useState({ ...BLANK_F });

  const locked = readOnly || mode === 'View';
  const isSales = noteSide === 'Sales';
  const title = `Journal Entry With GST + TDS ( ${noteType.toUpperCase()} NOTE ) - ${noteSide.toUpperCase()}`;

  const setField = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((p) => ({ ...p, [key]: val }));
  };

  const resetNew = () => {
    setF({ ...BLANK_F });
    setSelectedNoteId('');
    setError('');
    idempotencyKeyRef.current = newIdempotencyKey();
    setMode(readOnly ? 'View' : 'Add');
  };

  useEffect(() => {
    if (!isOpen) {
      initialNoteLoadedRef.current = null;
      return;
    }
    setBootLoading(true);
    Promise.all([fetchParties(), fetchLedgers(), fetchSales(), fetchPurchases(), fetchNotes?.()])
      .catch(() => {})
      .finally(() => setBootLoading(false));
    setNoteSide(initialSide);
    setNoteType(initialType);
    resetNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialType, initialSide]);

  useEffect(() => {
    if (!isOpen || !initialNoteId || bootLoading) return;
    if (initialNoteLoadedRef.current === initialNoteId) return;
    const target = (notes || []).find((n) => String(n._id || n.id) === String(initialNoteId));
    if (target) {
      initialNoteLoadedRef.current = initialNoteId;
      if (target.noteSide) setNoteSide(target.noteSide);
      if (target.noteType) setNoteType(target.noteType);
      loadNote(target);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialNoteId, bootLoading, notes]);

  const partyOptions = useMemo(() => {
    const want = isSales ? 'Customer' : 'Supplier';
    return (parties || [])
      .filter((p) => !p.type || p.type === want || p.type === 'Both')
      .map((p) => ({ value: String(p._id || p.id), label: p.name }));
  }, [parties, isSales]);

  const selectedParty = useMemo(
    () => (parties || []).find((p) => String(p._id || p.id) === String(f.partyId)),
    [parties, f.partyId]
  );

  const onPartyChange = (val) => {
    const p = (parties || []).find((x) => String(x._id || x.id) === String(val));
    setF((prev) => ({
      ...prev,
      partyId: val,
      gstin: p?.gstin || '',
      gstTreatment: p?.gstin ? 'Registered' : 'Unregistered',
      againstInvoiceId: '',
      againstInvoiceNo: '',
    }));
  };

  const headOptions = useMemo(
    () => (ledgers || []).map((l) => ({ value: String(l._id || l.id), label: l.name })),
    [ledgers]
  );
  const tdsOptions = useMemo(
    () => (ledgers || [])
      .filter((l) => /tds/i.test(l.name || '') || l.accountType === 'Tax')
      .map((l) => ({ value: String(l._id || l.id), label: l.name })),
    [ledgers]
  );

  const partyInvoices = useMemo(() => {
    if (!f.partyId) return [];
    const docs = isSales
      ? (sales || []).filter((s) => String(s.customerId?._id || s.customerId) === String(f.partyId))
      : (purchases || []).filter((p) => String(p.supplierId?._id || p.supplierId) === String(f.partyId));
    return docs
      .filter((d) => d.status !== 'cancelled')
      .map((d) => {
        const total = round2(d.netAmount || d.totalAmount || 0);
        const paid = round2(d.paidAmount || 0);
        const billDt = d.date ? new Date(d.date).toISOString().split('T')[0] : '';
        return {
          _id: d._id,
          invoiceNo: d.invoiceNo || d.billNo || '',
          billDt,
          billAmt: total,
          paidAmt: paid,
          osAmt: round2(Math.max(0, total - paid)),
          osDy: billDt ? Math.max(0, Math.floor((Date.now() - new Date(billDt).getTime()) / 86400000)) : 0,
          billType: d.invoiceType || (isSales ? 'SL' : 'PU'),
        };
      });
  }, [f.partyId, isSales, sales, purchases]);

  const calc = useMemo(() => computeCalc(f), [f]);

  const handleBillSelect = (inv) => {
    setF((p) => ({
      ...p,
      againstInvoiceId: inv._id,
      againstInvoiceNo: inv.invoiceNo,
      billNo: p.billNo || inv.invoiceNo,
      billDate: p.billDate || inv.billDt,
    }));
  };

  const openBillLookup = () => {
    if (locked) return;
    if (!f.partyId) return notifyWarning('Select Party first');
    setBillLookupOpen(true);
  };

  const noteList = useMemo(
    () => (notes || []).filter((n) => {
      const side = n.noteSide || (n.noteType === 'Credit' ? 'Sales' : 'Purchase');
      return side === noteSide && n.noteType === noteType;
    }),
    [notes, noteSide, noteType]
  );

  const loadNote = (n) => {
    setSelectedNoteId(n._id || n.id);
    const storedMode = n.amountMode || 'Exclusive';
    const displayAmount = storedMode === 'Inclusive'
      ? round2((n.taxableAmount || 0) + (n.gstAmount || 0))
      : (n.amount ?? n.taxableAmount ?? '');

    setF({
      vNo: n.vNo || n.noteNo || '',
      date: n.date ? new Date(n.date).toISOString().split('T')[0] : todayISO(),
      partyId: String(n.partyId || ''),
      gstin: n.partyGstin || '',
      billNo: n.billNo || '',
      billDate: n.billDate ? new Date(n.billDate).toISOString().split('T')[0] : '',
      againstInvoiceId: String(n.againstInvoiceId || ''),
      againstInvoiceNo: n.againstInvoiceNo || '',
      reverseCharge: !!n.reverseCharge,
      gstTreatment: n.gstTreatment || 'Registered',
      itcEligibility: n.itcEligibility || '',
      hsnSac: n.hsnSac || '',
      reasonCode: n.reasonCode || '',
      reason: n.reason || '',
      quc: n.quc || 'OTH-OTHERS',
      accountHeadLedgerId: String(n.accountHeadLedgerId || ''),
      amount: displayAmount,
      amountMode: storedMode,
      gstRate: n.gstRate || 0,
      gstType: n.gstType || 'CGST+SGST',
      tdsLedgerId: String(n.tdsLedgerId || ''),
      tdsPercent: n.tdsPercent || 0,
      tdsRemark: n.tdsRemark || '',
      narration: n.narration || '',
    });
    setMode('View');
    setError('');
  };

  const handleFind = () => {
    const q = findQuery.trim().toLowerCase();
    const found = q
      ? noteList.find((n) => String(n.noteNo || '').toLowerCase().includes(q)
        || String(n.partyName || '').toLowerCase().includes(q))
      : noteList[0];
    if (!found) return notifyWarning('No matching note found');
    loadNote(found);
  };

  const handleEdit = () => {
    if (!selectedNoteId) return notifyWarning('Find / select a note first');
    const n = noteList.find((x) => (x._id || x.id) === selectedNoteId);
    if (n && (n.status === 'Reversed' || n.isReversed)) return notifyWarning('A reversed note cannot be edited');
    setMode('Edit');
    notifyWarning('Edit mode — saving re-posts this note and rebuilds its bill adjustment');
  };

  const handleDelete = async () => {
    if (!selectedNoteId) return notifyWarning('Find / select a note first');
    const ok = await erpConfirm({
      title: `Reverse ${noteType} Note?`,
      message: 'This reverses the journal, party balance, GST/ITC and bill adjustment.\n\n'
        + 'The note stays in history as Reversed (not hard-deleted).\n\nContinue?',
      confirmLabel: 'Reverse',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await reverseNote(selectedNoteId, `Reversed from ${noteSide} ${noteType} Note screen`);
      notifySuccess('Note reversed — ledger, GST and bill outstanding restored');
      await fetchNotes?.();
      resetNew();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reverse note');
      notifyError(err, 'Failed to reverse note');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!f.partyId) return setError('Please select a Party.');
    if (!(round2(f.amount) > 0)) return setError('Please enter a valid Amount.');

    const payload = {
      noteType,
      noteSide,
      vNo: f.vNo || '',
      partyLedgerId: f.partyId,
      date: f.date,
      billNo: f.billNo || '',
      billDate: f.billDate || undefined,
      againstInvoiceId: f.againstInvoiceId || undefined,
      againstInvoiceNo: f.againstInvoiceNo || '',
      amount: round2(f.amount),
      amountMode: f.amountMode,
      gstRate: Number(f.gstRate) || 0,
      gstType: f.gstType,
      gstTreatment: f.gstTreatment,
      reverseCharge: !!f.reverseCharge,
      itcEligibility: f.itcEligibility || '',
      hsnSac: f.hsnSac || '',
      reasonCode: f.reasonCode || '',
      reason: f.reason || REASON_CODES.find((r) => r.value === f.reasonCode)?.label || '',
      quc: f.quc || '',
      accountHeadLedgerId: f.accountHeadLedgerId || undefined,
      tdsLedgerId: f.tdsLedgerId || undefined,
      tdsPercent: Number(f.tdsPercent) || 0,
      tdsRemark: f.tdsRemark || '',
      narration: f.narration || '',
      status: 'Posted',
    };

    setSaving(true);
    try {
      if (mode === 'Edit' && selectedNoteId) {
        await updateNote(selectedNoteId, payload);
        notifySuccess(`${noteSide} ${noteType} Note updated — accounting re-posted`);
      } else {
        await addNote({ ...payload, idempotencyKey: idempotencyKeyRef.current });
        notifySuccess(`${noteSide} ${noteType} Note saved`);
      }
      await fetchNotes?.();
      resetNew();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save note');
      notifyError(err, 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const L = ({ children }) => <span className="classic-erp-label">{children}</span>;

  return (
    <>
      <ErpWindowedModal isOpen={isOpen} onClose={onClose} title={title} windowId={`note-${noteSide}-${noteType}`} defaultMode="normal" bare>
        {({ WindowControls }) => (
          <div className="classic-erp-window note-window flex flex-col h-full min-h-0 !max-h-none">
            <ErpBusyOverlay show={bootLoading} message="Loading masters…" />
            <ErpBusyOverlay show={!bootLoading && saving} message="Saving note…" />
            
            {/* Header bar */}
            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">{title}</span>
              <WindowControls />
            </div>

            {/* Compact dense form body */}
            <div className="classic-erp-body note-body flex-1 overflow-y-auto flex flex-col gap-1.5 p-2 bg-[#dbe7f5]">
              {/* Row 1 — GSTIN / Note type / Reverse charge */}
              <div className="note-row note-row--3">
                <div className="classic-erp-field">
                  <L>GSTIN No.</L>
                  <input type="text" className="classic-erp-input note-gstin" value={f.gstin} onChange={setField('gstin')} disabled={locked} />
                </div>
                <div className="classic-erp-field">
                  <L>Note</L>
                  <div className="classic-erp-control flex gap-1 w-full">
                    <select className="classic-erp-select flex-1" value={noteSide} onChange={(e) => setNoteSide(e.target.value)} disabled={locked || mode === 'Edit'}>
                      <option value="Sales">Sales</option>
                      <option value="Purchase">Purchase</option>
                    </select>
                    <select className="classic-erp-select flex-1" value={noteType} onChange={(e) => setNoteType(e.target.value)} disabled={locked || mode === 'Edit'}>
                      <option value="Credit">CreditNote</option>
                      <option value="Debit">DebitNote</option>
                    </select>
                  </div>
                </div>
                <div className="classic-erp-field">
                  <L>Reverse Charge</L>
                  <select className="classic-erp-select" value={f.reverseCharge ? 'Yes' : 'No'} onChange={(e) => setF((p) => ({ ...p, reverseCharge: e.target.value === 'Yes' }))} disabled={locked}>
                    <option>No</option><option>Yes</option>
                  </select>
                </div>
              </div>

              {/* Row 2 — Party / VNo / GstType */}
              <div className="note-row note-row--3">
                <div className="classic-erp-field" ref={partyFieldRef}>
                  <L>PARTY</L>
                  <ERPCombobox
                    value={f.partyId}
                    onChange={onPartyChange}
                    options={partyOptions}
                    placeholder={`Search ${isSales ? 'customer' : 'supplier'}…`}
                    disabled={locked}
                    recentKey={`note-party-${noteSide}`}
                  />
                </div>
                <div className="classic-erp-field classic-erp-field--xs">
                  <L>V.NO:-</L>
                  <input type="text" className="classic-erp-input" value={f.vNo} onChange={setField('vNo')} disabled={locked} placeholder="Auto" />
                </div>
                <div className="classic-erp-field">
                  <L>GstType</L>
                  <select className="classic-erp-select" value={f.gstTreatment} onChange={setField('gstTreatment')} disabled={locked}>
                    {GST_TREATMENTS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3 — J.V Date / Bill No / Bill Date / ITC */}
              <div className="note-row note-row--4">
                <div className="classic-erp-field classic-erp-field--xs">
                  <L>J.V DATE</L>
                  <input type="date" className="classic-erp-input" value={f.date} onChange={setField('date')} disabled={locked} />
                </div>
                <div className="classic-erp-field classic-erp-field--xs">
                  <L>BILL NO</L>
                  <input type="text" className="classic-erp-input" value={f.billNo} onChange={setField('billNo')} disabled={locked} />
                </div>
                <div className="classic-erp-field classic-erp-field--xs">
                  <L>BILL DATE</L>
                  <input type="date" className="classic-erp-input" value={f.billDate} onChange={setField('billDate')} disabled={locked} />
                </div>
                <div className="classic-erp-field">
                  <L>ITC Eligibilty</L>
                  <select className="classic-erp-select" value={f.itcEligibility} onChange={setField('itcEligibility')} disabled={locked || isSales}>
                    {ITC_OPTIONS.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 4 — HSN/SAC / Reason / QUC */}
              <div className="note-row note-row--3">
                <div className="classic-erp-field classic-erp-field--xs">
                  <L>HSN / SAC</L>
                  <input type="text" className="classic-erp-input note-hsn" value={f.hsnSac} onChange={setField('hsnSac')} disabled={locked} />
                </div>
                <div className="classic-erp-field">
                  <L>Reason For Iss.Note</L>
                  <select className="classic-erp-select" value={f.reasonCode} onChange={setField('reasonCode')} disabled={locked}>
                    {REASON_CODES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="classic-erp-field classic-erp-field--xs">
                  <L>QUC</L>
                  <select className="classic-erp-select" value={f.quc} onChange={setField('quc')} disabled={locked}>
                    {QUC_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 5 — Head / Amount / Tax Mode */}
              <div className="note-row note-row--3">
                <div className="classic-erp-field">
                  <L>HEAD</L>
                  <ERPCombobox
                    value={f.accountHeadLedgerId}
                    onChange={(val) => setF((p) => ({ ...p, accountHeadLedgerId: val }))}
                    options={headOptions}
                    placeholder="Default return account…"
                    disabled={locked}
                    recentKey="note-head"
                    allowClear
                  />
                </div>
                <div className="classic-erp-field classic-erp-field--sm">
                  <L>AMOUNT</L>
                  <input type="number" className="classic-erp-input text-right font-bold" value={f.amount} onChange={setField('amount')} disabled={locked} />
                </div>
                <div className="classic-erp-field">
                  <L>TAX MODE</L>
                  <select className="classic-erp-select" value={f.amountMode} onChange={setField('amountMode')} disabled={locked}>
                    <option value="Inclusive">Inclusive (GST inside)</option>
                    <option value="Exclusive">Exclusive (GST extra)</option>
                  </select>
                </div>
              </div>

              {/* GST / TDS / Summary calculation grid */}
              <div className="note-calc-grid">
                {/* GST Box */}
                <div className="classic-erp-frame note-gst-box p-1.5">
                  <div className="note-gst-row">
                    <L>SGST%</L>
                    <input type="number" className="classic-erp-input text-right" value={f.gstType === 'IGST' ? 0 : calc.halfRate} readOnly />
                    <input type="text" className="classic-erp-input text-right font-mono" value={money(calc.sgst)} readOnly />
                  </div>
                  <div className="note-gst-row">
                    <L>CGST%</L>
                    <input type="number" className="classic-erp-input text-right" value={f.gstType === 'IGST' ? 0 : calc.halfRate} readOnly />
                    <input type="text" className="classic-erp-input text-right font-mono" value={money(calc.cgst)} readOnly />
                  </div>
                  <div className="note-gst-row">
                    <L>IGST%</L>
                    <input type="number" className="classic-erp-input text-right" value={f.gstType === 'IGST' ? f.gstRate : 0} readOnly />
                    <input type="text" className="classic-erp-input text-right font-mono" value={money(calc.igst)} readOnly />
                  </div>
                  <div className="note-gst-row">
                    <L>GST Rate %</L>
                    <input type="number" className="classic-erp-input text-right" value={f.gstRate} onChange={setField('gstRate')} disabled={locked} />
                    <select className="classic-erp-select" value={f.gstType} onChange={setField('gstType')} disabled={locked}>
                      <option value="CGST+SGST">CGST+SGST</option>
                      <option value="IGST">IGST</option>
                    </select>
                  </div>
                </div>

                {/* TDS Box */}
                <div className="classic-erp-frame note-tds-box p-1.5">
                  <div className="classic-erp-field">
                    <L>TDS A\C.</L>
                    <ERPCombobox
                      value={f.tdsLedgerId}
                      onChange={(val) => setF((p) => ({ ...p, tdsLedgerId: val }))}
                      options={tdsOptions}
                      placeholder="TDS ledger…"
                      disabled={locked}
                      recentKey="note-tds"
                      allowClear
                    />
                  </div>
                  <div className="classic-erp-field classic-erp-field--xs">
                    <L>TDS %</L>
                    <input type="number" className="classic-erp-input text-right" value={f.tdsPercent} onChange={setField('tdsPercent')} disabled={locked} />
                  </div>
                  <div className="classic-erp-field classic-erp-field--xs">
                    <L>TDS AMOUNT</L>
                    <input type="text" className="classic-erp-input text-right font-mono" value={money(calc.tdsAmount)} readOnly />
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="note-totals">
                  <div><span>Taxable Amt</span><b className="font-mono">{money(calc.taxable)}</b></div>
                  <div><span>TOTAL GST</span><b className="font-mono">{money(calc.totalGst)}</b></div>
                  <div className="note-rcm"><span>RCM CHARGE</span><b className="font-mono">{money(calc.rcmAmount)}</b></div>
                  <div><span>ROUND OFF</span><b className="font-mono">{money(calc.roundOff)}</b></div>
                  <div className="note-net"><span>NET AMOUNT</span><b className="font-mono">{money(calc.netAmount)}</b></div>
                  <div><span>TDS AMOUNT</span><b className="font-mono">{money(calc.tdsAmount)}</b></div>
                  <div className="note-final"><span>FINAL AMOUNT</span><b className="font-mono">{money(calc.finalAmount)}</b></div>
                </div>
              </div>

              {/* Narration / Adjust against bill */}
              <div className="note-row note-row--2">
                <div className="classic-erp-field" style={{ alignItems: 'start' }}>
                  <L>NARATTION</L>
                  <textarea className="classic-erp-input" rows={3} value={f.narration} onChange={setField('narration')} disabled={locked} />
                </div>
                <div className="note-adjust">
                  <button type="button" className="classic-erp-btn note-adjust-btn" onClick={openBillLookup} disabled={locked}
                    onKeyDown={(e) => { if (e.key === 'F4') { e.preventDefault(); openBillLookup(); } }}>
                    Adjust Against Bill
                  </button>
                  <div className="classic-erp-field">
                    <L>TDS REMARK</L>
                    <input type="text" className="classic-erp-input" value={f.tdsRemark} onChange={setField('tdsRemark')} disabled={locked} />
                  </div>
                  <div className="classic-erp-field">
                    <L>ADJUST BILLNO</L>
                    <div className="flex gap-1 w-full">
                      <input
                        type="text"
                        className="classic-erp-input flex-1"
                        value={f.againstInvoiceNo}
                        readOnly
                        placeholder="Enter / F4 ⇒ pick bill"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'F4' || e.key === ' ') { e.preventDefault(); openBillLookup(); }
                        }}
                        title={f.againstInvoiceId ? `Linked to bill id ${f.againstInvoiceId}` : 'No bill linked'}
                      />
                      {f.againstInvoiceId && !locked && (
                        <button type="button" className="classic-erp-btn text-[10px] h-6" onClick={() => setF((p) => ({ ...p, againstInvoiceId: '', againstInvoiceNo: '' }))}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {error && <p className="text-red-600 font-bold text-xs uppercase px-1">{error}</p>}

              <div className="classic-erp-field" style={{ maxWidth: 380, gridTemplateColumns: '48px 1fr auto', gap: 8 }}>
                <L>Find:</L>
                <input type="text" className="classic-erp-input" placeholder="Note No / Party" value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFind()} />
                <span className="text-xs text-slate-500 whitespace-nowrap">{noteList.length} note(s)</span>
              </div>
            </div>

            {/* Action buttons footer */}
            <div className="classic-erp-form-footer flex-wrap">
              <button className="classic-erp-btn" type="button" onClick={resetNew} disabled={readOnly}>New</button>
              <button className="classic-erp-btn" type="button" onClick={handleEdit} disabled={readOnly || mode !== 'View' || !selectedNoteId}>Edit</button>
              <button className="classic-erp-btn btn-blue" type="button" data-enter-save onClick={handleSave} disabled={locked || saving || bootLoading}>
                <SaveButtonLabel saving={saving} />
              </button>
              <button className="classic-erp-btn" type="button" onClick={() => (selectedNoteId ? setMode('View') : resetNew())} disabled={locked}>Cancel</button>
              <button className="classic-erp-btn" type="button" onClick={handleFind}>Find</button>
              <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || !selectedNoteId || mode !== 'View'}
                title="Reverses the posted note — ledger, GST and bill outstanding are restored">Delete</button>
              <button className="classic-erp-btn" type="button" onClick={onClose}>Exit</button>
              <button className="classic-erp-btn" type="button" onClick={() => { setFindQuery(''); handleFind(); }}>Sp.Find</button>
              {isSales && (
                <button className="classic-erp-btn btn-red" type="button"
                  onClick={() => notifyWarning('e-Invoice — generate from the Sales module once the note is posted; IRN is never raised automatically.')}>
                  e-Invoice Details
                </button>
              )}
              <button className="classic-erp-btn" type="button" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        )}
      </ErpWindowedModal>

      <BillNoLookupModal
        isOpen={billLookupOpen}
        onClose={() => setBillLookupOpen(false)}
        invoices={partyInvoices}
        partyName={selectedParty?.name || ''}
        onSelect={handleBillSelect}
      />
      <style>{noteStyles}</style>
    </>
  );
};

const noteStyles = `
  .note-window {
    max-width: 840px;
    margin: 0 auto;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  }
  .note-body { padding: 6px 10px; background: #dbe7f5; font-size: 11px; }
  .note-row { display: grid; gap: 6px; align-items: center; }
  .note-row--2 { grid-template-columns: 1.4fr 1fr; }
  .note-row--3 { grid-template-columns: 1.2fr 1fr 0.9fr; }
  .note-row--4 { grid-template-columns: repeat(4, 1fr); }
  .note-gstin { background: #fde8cf; }
  .note-hsn { background: #fde8cf; }
  .note-calc-grid { display: grid; grid-template-columns: 1.1fr 1.2fr 1fr; gap: 6px; margin-top: 2px; }
  .note-gst-box, .note-tds-box { display: flex; flex-direction: column; gap: 3px; }
  .note-gst-row { display: grid; grid-template-columns: 65px 55px 1fr; gap: 4px; align-items: center; }
  .note-totals { display: flex; flex-direction: column; gap: 2px; font-size: 10.5px; font-weight: 700; }
  .note-totals > div { display: flex; justify-content: space-between; gap: 6px; padding: 1.5px 5px; background: #fff; border: 1px solid #94a3b8; border-radius: 2px; }
  .note-totals .note-rcm { background: #fff59d; }
  .note-totals .note-rcm b { color: #b91c1c; }
  .note-totals .note-net b, .note-totals .note-final b { color: #0f172a; }
  .note-totals .note-final { border-color: #1d4ed8; border-width: 2px; }
  .note-adjust { display: flex; flex-direction: column; gap: 3px; }
  .note-adjust-btn { align-self: flex-start; font-weight: 700; }
`;

export default NoteModal;
