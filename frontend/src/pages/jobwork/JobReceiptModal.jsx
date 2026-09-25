import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ERPSelect } from '../../components/forms/FormElements';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import { handleFormEnterKeyDown, handleFormArrowKeyDown } from '../../utils/formEnterNavigation';
import JobWorkPrint from '../../components/print/JobWorkPrint';
import { Plus, Trash2 } from 'lucide-react';
import {
  blankLine,
  calcJobReceipt,
  jobToLine,
  PQK_OPTIONS,
  RCM_OPTIONS,
  TYPE_OPTIONS,
  lineJobAmt,
  lineShortagePct,
} from './jobReceiptCalc';
import JobLotLookupModal from './JobLotLookupModal';

const today = () => new Date().toISOString().split('T')[0];

const weekday = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return '';
  }
};

const emptyHeader = (book) => ({
  serialNo: '1',
  date: today(),
  reverseCharge: 'No',
  billChNo: '',
  broker: '',
  hsnCd: '',
  type: 'INVOICE IN STATE',
  partyId: '',
  gstin: '',
  book: book || 'JOB WORK RECEIVE BOOK',
});

const emptyFooter = () => ({
  addAmt: '',
  addLabel: '',
  lessAmt: '',
  lessLabel: '',
  otherLess1Amt: '',
  otherLess1Label: '',
  otherLess2Amt: '',
  otherLess2Label: '',
  tdsOnAmount: '',
  tdsPercent: '',
  remark: '',
  taxRate: '5',
  roundOff: '',
  rcmCharge: '',
});

const JobReceiptModal = ({ isOpen, onClose, selectedBook = null, onOpenPayment = null }) => {
  const { jobWorkEntries, parties, fetchJobs, fetchParties, receiveFromMill } = useStore();

  const [mode, setMode] = useState('Add');
  const [findOpen, setFindOpen] = useState(false);
  const [findSearch, setFindSearch] = useState('');
  const [findActiveIdx, setFindActiveIdx] = useState(0);
  const findInputRef = useRef(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [header, setHeader] = useState(emptyHeader(selectedBook));
  const [footer, setFooter] = useState(emptyFooter());
  const [lines, setLines] = useState([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [lotLookupOpen, setLotLookupOpen] = useState(false);
  const [lotLookupTargetIdx, setLotLookupTargetIdx] = useState(null);
  const [lotEntryValue, setLotEntryValue] = useState('');

  const locked = mode === 'View';
  const titleBook = selectedBook || header.book || 'JOBWORK BOOK';

  const sortedReceipts = useMemo(() => {
    const list = (jobWorkEntries || []).filter((j) => j.status === 'Received' || j.status === 'Partial' || j.status === 'Issued');
    return list.sort((a, b) => {
      const numA = parseInt(String(a.billChNo || a.challanNo || a.jobCardNo || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.billChNo || b.challanNo || b.jobCardNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return new Date(a.receiveDate || a.issueDate || a.createdAt || 0) - new Date(b.receiveDate || b.issueDate || b.createdAt || 0);
    });
  }, [jobWorkEntries]);

  const filteredReceipts = useMemo(() => {
    const q = findSearch.trim().toLowerCase();
    if (!q) return sortedReceipts;
    return sortedReceipts.filter((j) => {
      const billNo = String(j.billChNo || j.challanNo || j.jobCardNo || '').toLowerCase();
      const numOnly = billNo.replace(/\D/g, '');
      const mill = String(j.workerId?.name || '').toLowerCase();
      const item = String(j.lotId?.itemName || '').toLowerCase();
      return billNo.includes(q) || numOnly.includes(q) || mill.includes(q) || item.includes(q);
    });
  }, [sortedReceipts, findSearch]);

  const handleOpenFindModal = () => {
    setFindSearch('');
    const currentIdx = sortedReceipts.findIndex((j) => String(j._id || j.id) === String(selectedReceiptId));
    setFindActiveIdx(currentIdx >= 0 ? currentIdx : Math.max(0, sortedReceipts.length - 1));
    setFindOpen(true);
    setTimeout(() => {
      findInputRef.current?.focus();
      try { findInputRef.current?.select(); } catch { }
    }, 50);
  };

  const handleFindKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setFindOpen(false);
      return;
    }

    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.min(prev + 1, filteredReceipts.length - 1));
      return;
    }

    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.min(prev + 1, filteredReceipts.length - 1));
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const job = filteredReceipts[findActiveIdx];
      if (job) {
        loadReceipt(job._id || job.id, 'Edit');
        setFindOpen(false);
        toast.success(`Receipt #${job.billChNo || job.challanNo || job.jobCardNo} loaded in Edit mode`);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'F3' || (e.altKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        e.stopPropagation();
        handleOpenFindModal();
        return;
      }

      const prevKey = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus';
      const nextKey = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal';
      if ((prevKey || nextKey) && !e.ctrlKey && !e.altKey && mode === 'View' && !findOpen) {
        e.preventDefault();
        e.stopPropagation();
        const list = sortedReceipts || [];
        if (!list.length) return;
        const currentIdx = list.findIndex((j) => String(j._id || j.id) === String(selectedReceiptId));
        let nextIdx = currentIdx + (prevKey ? -1 : 1);
        if (currentIdx === -1) nextIdx = prevKey ? list.length - 1 : 0;
        if (nextIdx >= 0 && nextIdx < list.length) loadReceipt(list[nextIdx]._id || list[nextIdx].id, 'View');
        return;
      }
      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && !findOpen) {
        if (e.target?.closest?.('[data-book-selection-modal], [data-command-palette], [data-find-modal]')) return;
        if (mode === 'View') {
          e.preventDefault();
          e.stopPropagation();
          handleNew();
          return;
        }
      }

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNew();
        return;
      }

      if ((e.altKey && e.key.toLowerCase() === 'e') || e.key === 'F2') {
        if (selectedReceiptId && mode === 'View') {
          e.preventDefault();
          setMode('Edit');
          toast.info('Switched to Edit mode');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, selectedReceiptId, mode, findOpen, sortedReceipts]);

  useEffect(() => {
    if (!isOpen) {
      setBootLoading(false);
      return;
    }
    let cancelled = false;
    setBootLoading(true);
    Promise.all([fetchJobs(), fetchParties?.()])
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fetchJobs, fetchParties]);

  useEffect(() => {
    if (isOpen && selectedBook) {
      setHeader((h) => ({ ...h, book: selectedBook }));
    }
  }, [isOpen, selectedBook]);

  // Job Receive is against the Job Worker/mill you sent material to — Customers, plain
  // Suppliers-of-goods etc. showing up here was the exact confusion this list should avoid.
  const partyOptions = useMemo(() => {
    const list = (parties || []).filter(
      (p) => ['Job Worker', 'Both', 'Supplier'].includes(p.type) || (p.group || '').toUpperCase().includes('JOB')
    );
    const partyIds = new Set(list.map((p) => String(p._id || p.id)));
    (jobWorkEntries || []).forEach((j) => {
      if (j.workerId) {
        const id = String(typeof j.workerId === 'object' ? j.workerId._id || j.workerId.id : j.workerId);
        const name = typeof j.workerId === 'object' ? j.workerId.name : null;
        if (id && !partyIds.has(id) && name) {
          list.push({ _id: id, id, name, gstin: j.workerId.gstin || '' });
          partyIds.add(id);
        }
      }
    });
    return list.map((p) => ({
      value: p._id || p.id,
      label: p.name,
      gstin: p.gstin || '',
    }));
  }, [parties, jobWorkEntries]);

  const selectedPartyObj = useMemo(
    () => (parties || []).find((p) => String(p._id || p.id) === String(header.partyId)),
    [parties, header.partyId]
  );

  const pendingJobs = useMemo(
    () => (jobWorkEntries || []).filter((j) => {
      const s = String(j.status || '').toLowerCase();
      if (s === 'received' || s === 'cancelled') return false;
      const issueQty = Number(j.issueQty) || 0;
      const issuePcs = Number(j.issuePcs) || 0;
      const recvQty = Number(j.receivedQty) || 0;
      const recvPcs = Number(j.receivedPcs) || 0;
      const remQty = issueQty - recvQty;
      const remPcs = issuePcs - recvPcs;
      return s === 'issued' || s === 'partial' || remQty > 0.01 || remPcs > 0;
    }),
    [jobWorkEntries]
  );

  const receivedJobs = useMemo(
    () => (jobWorkEntries || []).filter((j) => String(j.status || '').toLowerCase() === 'received'),
    [jobWorkEntries]
  );

  const receiptOptions = useMemo(
    () =>
      receivedJobs.map((j) => ({
        value: j._id,
        label: `${j.jobCardNo} · ${j.workerId?.name || 'Party'} · ₹${Number(j.processCharges || 0).toFixed(2)}`,
      })),
    [receivedJobs]
  );

  const partyPendingJobs = useMemo(() => {
    if (!header.partyId) return pendingJobs;
    const targetPartyObj = (parties || []).find((p) => String(p._id || p.id) === String(header.partyId));
    const targetName = (targetPartyObj?.name || '').trim().toLowerCase();
    const targetId = String(header.partyId).trim();

    return pendingJobs.filter((j) => {
      const rawWorker = j.workerId;
      const workerIdStr = String(
        (typeof rawWorker === 'object' ? rawWorker?._id || rawWorker?.id : rawWorker) ||
        (typeof j.partyId === 'object' ? j.partyId?._id || j.partyId?.id : j.partyId) ||
        ''
      ).trim();

      if (workerIdStr && workerIdStr === targetId) return true;

      const workerName = String(
        j.workerId?.name || j.workerName || j.partyName || j.partyId?.name || j.weaver || ''
      ).trim().toLowerCase();

      if (targetName && workerName && (workerName === targetName || workerName.includes(targetName) || targetName.includes(workerName))) {
        return true;
      }

      return false;
    });
  }, [pendingJobs, header.partyId, parties]);

  const calc = useMemo(() => calcJobReceipt(lines, footer, header), [lines, footer, header]);

  const gridTotals = useMemo(
    () =>
      (lines || []).reduce(
        (acc, l) => ({
          pcs: acc.pcs + (Number(l.recPcs) || 0),
          sendMts: acc.sendMts + (Number(l.issueMtsRef) || 0),
          recMts: acc.recMts + (Number(l.recMts) || 0),
        }),
        { pcs: 0, sendMts: 0, recMts: 0 }
      ),
    [lines]
  );

  const setLine = useCallback((idx, patch) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      next[idx].jobAmt = lineJobAmt(next[idx]);
      return next;
    });
  }, []);

  const addLine = () => setLines((prev) => [...prev, blankLine()]);

  const removeLine = (idx) => {
    setLines((prev) => (prev.length <= 1 ? [blankLine()] : prev.filter((_, i) => i !== idx)));
  };

  const handlePartyChange = (partyId) => {
    const party = partyOptions.find((p) => String(p.value) === String(partyId));
    setHeader((h) => ({
      ...h,
      partyId: partyId || '',
      gstin: party?.gstin || '',
    }));
  };

  const loadPendingChallans = () => {
    const list = partyPendingJobs.length > 0 ? partyPendingJobs : pendingJobs;
    if (list.length === 0) {
      toast.info('No pending issued challans found. Please issue a job first from Mill Issue / Job Issue.');
      return;
    }
    setLines(list.map(jobToLine));
    if (partyPendingJobs.length > 0) {
      toast.success(`Loaded ${partyPendingJobs.length} pending challan(s)`);
    } else {
      toast.success(`Loaded ${pendingJobs.length} pending challan(s)`);
    }
  };

  const lotLookupJobs = partyPendingJobs.length > 0 ? partyPendingJobs : pendingJobs;

  /** Classic ERP "Press ALT+L To LotNo Entry" — opens which pending bill/challan to receive against for a lot. */
  const openLotLookup = (targetIdx = null) => {
    if (locked) return;
    if (lotLookupJobs.length === 0) {
      toast.info(header.partyId ? 'No pending challans for this party' : 'No pending Mill Issue challans to receive');
      return;
    }
    setLotLookupTargetIdx(targetIdx);
    setLotLookupOpen(true);
  };

  const handleLotSelect = (job) => {
    const newLine = jobToLine(job);
    const targetIdx = lotLookupTargetIdx != null ? lotLookupTargetIdx : Math.max(0, lines.findIndex((l) => !l.jobId));
    setLines((prev) => {
      if (lotLookupTargetIdx == null) {
        const firstBlankIdx = prev.findIndex((l) => !l.jobId);
        if (firstBlankIdx === -1) return [...prev, newLine];
        const next = [...prev];
        next[firstBlankIdx] = newLine;
        return next;
      }
      const next = [...prev];
      next[lotLookupTargetIdx] = newLine;
      return next;
    });
    if (!header.partyId && job.workerId) {
      const workerId = job.workerId?._id || job.workerId;
      const party = partyOptions.find((p) => String(p.value) === String(workerId));
      setHeader((h) => ({ ...h, partyId: workerId, gstin: party?.gstin || job.workerId?.gstin || '' }));
    }
    setLotEntryValue('');
    toast.success(`Loaded Lot ${newLine.lotNo || newLine.chlnNo} for receipt`);
    setTimeout(() => {
      const row = document.querySelector(`tr[data-row-idx="${targetIdx}"]`);
      const targetInput = row?.querySelector('input[data-col-key="recPcs"]') || row?.querySelector('input');
      targetInput?.focus();
      try { targetInput?.select(); } catch {}
    }, 60);
  };

  const handleHeaderKeyDown = (e) => {
    if (e.altKey && String(e.key).toLowerCase() === 'l') {
      e.preventDefault();
      openLotLookup(null);
    }
  };

  const handleNew = () => {
    setMode('Add');
    setSelectedReceiptId('');
    setFindOpen(false);
    setHeader(emptyHeader(selectedBook));
    setFooter(emptyFooter());
    setLines([blankLine()]);
  };

  const handleEdit = () => {
    if (!selectedReceiptId) return toast.warning('Find a receipt to edit');
    setMode('Edit');
  };

  const handleCancel = () => {
    if (selectedReceiptId) {
      loadReceipt(selectedReceiptId, 'View');
      setMode('View');
    } else {
      handleNew();
    }
  };

  const loadReceipt = (jobId, targetMode = 'Edit') => {
    const job = (jobWorkEntries || []).find((j) => String(j._id || j.id) === String(jobId));
    if (!job) return;
    setSelectedReceiptId(jobId);
    setMode(targetMode);
    setHeader({
      serialNo: '1',
      date: job.receiveDate ? String(job.receiveDate).split('T')[0] : (job.issueDate ? String(job.issueDate).split('T')[0] : today()),
      reverseCharge: 'No',
      billChNo: job.billChNo || job.challanNo || job.jobCardNo || '',
      broker: '',
      hsnCd: '',
      type: 'INVOICE IN STATE',
      partyId: job.workerId?._id || job.workerId || '',
      gstin: job.workerId?.gstin || '',
      book: selectedBook || 'JOB WORK RECEIVE BOOK',
    });

    let derivedTaxRate = '5';
    const gstAmt = Number(job.processGstAmount || 0);
    const charges = Number(job.processCharges || 0);
    if (gstAmt > 0 && charges > 0) {
      const pct = (gstAmt / charges) * 100;
      if (pct >= 1 && pct <= 30) {
        derivedTaxRate = pct.toFixed(2);
      }
    }

    setFooter({
      ...emptyFooter(),
      taxRate: derivedTaxRate,
      remark: job.remark || '',
    });
    setLines(() => {
      const line = jobToLine(job);
      line.recPcs = job.receivedPcs ?? '';
      line.recMts = job.receivedQty ?? '';
      line.jobAmt = lineJobAmt(line);
      return [line];
    });
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!header.partyId) {
      toast.warning('Select Job Party');
      return;
    }

    const receivable = calc.linesWithAmt.filter(
      (l) => l.jobId && (Number(l.recMts) > 0 || Number(l.recPcs) > 0)
    );
    if (receivable.length === 0) {
      toast.warning('Add at least one line with received qty and linked challan');
      return;
    }

    setSaving(true);
    let ok = 0;
    try {
      for (const line of receivable) {
        const gstShare =
          calc.gross > 0 ? (line.jobAmt / calc.gross) * calc.totalGst : calc.totalGst / receivable.length;

        const recMts = Number(line.recMts) || 0;
        const recPcs = Number(line.recPcs) || 0;
        const targetJob = (jobWorkEntries || []).find((j) => String(j._id || j.id) === String(line.jobId));
        const prevRecvMts = Number(targetJob?.receivedQty || 0);
        const prevRecvPcs = Number(targetJob?.receivedPcs || 0);
        const totalIssueMts = Number(targetJob?.issueQty || line.issueMtsRef || 0);
        const totalIssuePcs = Number(targetJob?.issuePcs || line.issuePcsRef || 0);

        const newTotalMts = prevRecvMts + recMts;
        const newTotalPcs = prevRecvPcs + recPcs;

        // Is this receipt tranche completing the full issued quantity & pcs?
        const isFinal = (newTotalMts >= totalIssueMts - 0.01) && (newTotalPcs >= totalIssuePcs);

        await receiveFromMill({
          jobId: line.jobId,
          receivedQty: recMts,
          receivedPcs: recPcs,
          charges: Number(line.jobAmt) || 0,
          gstAmount: Number(gstShare.toFixed(2)) || 0,
          isFinal,
        });
        ok += 1;
      }
      toast.success(`Job receipt saved — ${ok} challan(s) received`);
      handleNew();
      setMode('View');
      await fetchJobs();
    } catch (err) {
      toast.error(err, { fallback: ok > 0 ? `Partial save: ${ok} received, then failed` : 'Failed to save job receipt' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => toast.warning('Delete from admin / reverse receive flow');
  /**
   * Build the print payload from the SAME state the form is rendering — header, the live
   * `lines`, and the already-computed `calc` totals — so the sheet can never disagree with
   * what is on screen. Nothing is re-derived or re-fetched here.
   */
  const printData = useMemo(() => {
    const rows = (calc.linesWithAmt || lines || []).filter(
      (l) => l.itemName || Number(l.recPcs) || Number(l.recMts) || Number(l.jobAmt)
    );
    return {
      book: header.book,
      partyName: partyOptions.find((p) => String(p.value) === String(header.partyId))?.label || '',
      broker: header.broker,
      serialNo: header.serialNo,
      billChNo: header.billChNo,
      date: header.date,
      lines: rows,
      totalPcs: rows.reduce((s, l) => Number(s) + (Number(l.recPcs) || 0), 0),
      totalQty: rows.reduce((s, l) => Number(s) + (Number(l.recMts) || 0), 0),
      gross: calc.gross,
      addAmt: footer.addAmt,
      lessAmt: footer.lessAmt,
      otherLess: (Number(footer.otherLess1Amt) || 0) + (Number(footer.otherLess2Amt) || 0),
      tdsPercent: footer.tdsPercent,
      tdsAmt: calc.tdsAmt,
      final: calc.final,
      remark: footer.remark,
    };
  }, [calc, lines, header, footer, partyOptions]);

  const handlePrint = () => {
    if (!printData.lines.length) return toast.warning('Nothing to print — add at least one receipt line');
    setPrintOpen(true);
  };

  const gridCols = [
    { key: 'chlnNo', label: 'ChInNo', w: 'w-[9%]', lookup: true },
    { key: 'itemName', label: 'ItemName', w: 'w-[21%]', readOnly: true },
    { key: 'finishItem', label: 'FinishItem', w: 'w-[11%]' },
    { key: 'cut', label: 'Cut', w: 'w-[6%]', align: 'right' },
    { key: 'recPcs', label: 'RecPcs', w: 'w-[6%]', align: 'right' },
    { key: 'recMts', label: 'RecMts', w: 'w-[8%]', align: 'right' },
    { key: 'jRate', label: 'J.Rate', w: 'w-[7%]', align: 'right' },
    { key: 'pqk', label: 'PQK', w: 'w-[6%]' },
    { key: 'jobAmt', label: 'JobAmt', w: 'w-[11%]', align: 'right', readOnly: true },
    { key: 'cp', label: 'CP', w: 'w-[5%]' },
    { key: 'jobcardNo', label: 'JobcardNo', w: 'w-[10%]' },
  ];

  return (
    <>
      <ErpWindowedModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Additional Job Receipt [ ${titleBook} ]`}
        windowId="jobRec"
        bare
      >
        {({ WindowControls }) => (
          <div className="classic-erp-window erp-density erp-job-receipt-window flex flex-col h-full min-h-0 !max-h-none">
            <ErpBusyOverlay show={bootLoading} message="Loading job receipt…" />
            <ErpBusyOverlay show={!bootLoading && saving} message="Saving job receipt…" />

            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">
                Additional Job Receipt [ {titleBook} ]
              </span>
              <WindowControls />
            </div>

            <form
              onSubmit={handleSave}
              onKeyDown={handleHeaderKeyDown}
              className="classic-erp-body erp-job-receipt-body flex-1 overflow-hidden min-h-0 flex flex-col justify-between"
            >
              {findOpen && (
                <div className="classic-erp-frame erp-job-receipt-find shrink-0">
                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label blue-label">Find</span>
                    <ERPSelect
                      className="classic-erp-select"
                      value={selectedReceiptId}
                      onChange={(e) => loadReceipt(e.target.value)}
                      options={receiptOptions}
                      placeholder="- Select Job Receipt -"
                      recentKey="job-receipt-find"
                    />
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="classic-erp-frame erp-job-receipt-header shrink-0">
                <div className="erp-job-receipt-header-grid">
                  <div className="classic-erp-stack erp-job-receipt-party-col">
                    <div className="erp-job-receipt-party-row">
                      <div className="classic-erp-field classic-erp-field--lg erp-job-receipt-party-field">
                        <span className="classic-erp-label red-label">Job Party</span>
                        <ERPCombobox
                          value={header.partyId}
                          onChange={handlePartyChange}
                          disabled={locked}
                          options={partyOptions}
                          placeholder="Select job worker / mill…"
                          recentKey="job-receipt-party"
                          allowClear
                        />
                      </div>
                      <span className="erp-job-receipt-gstin-badge">GSTIN:-{header.gstin || '24AAAGM0289C1ZP'}</span>
                    </div>
                    <div className="erp-job-receipt-address-box">
                      {selectedPartyObj?.address || selectedPartyObj?.city ? `${selectedPartyObj.address || ''}${selectedPartyObj.city ? ', ' + selectedPartyObj.city : ''}` : ','}
                    </div>
                  </div>

                  <div className="classic-erp-stack erp-job-receipt-meta-col">
                    <div className="erp-job-receipt-meta-row-1">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">Reverse Charge</span>
                        <ERPSelect
                          className={`classic-erp-select ${header.reverseCharge === 'Yes' ? 'erp-rcm-highlight' : ''}`}
                          value={header.reverseCharge}
                          onChange={(e) => setHeader({ ...header, reverseCharge: e.target.value })}
                          options={RCM_OPTIONS}
                          disabled={locked}
                        />
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label red-label">Serail No</span>
                        <input
                          type="text"
                          className="classic-erp-input text-center font-bold"
                          value={header.serialNo}
                          onChange={(e) => setHeader({ ...header, serialNo: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label red-label">Date</span>
                        <div className="classic-erp-control">
                          <input
                            type="date"
                            className="classic-erp-input erp-job-receipt-date"
                            value={header.date}
                            onChange={(e) => setHeader({ ...header, date: e.target.value })}
                            disabled={locked}
                            required
                          />
                          <span className="erp-job-receipt-weekday">{weekday(header.date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="erp-job-receipt-meta-row-2">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">Bill/Ch No</span>
                        <input
                          type="text"
                          className="classic-erp-input"
                          value={header.billChNo}
                          onChange={(e) => setHeader({ ...header, billChNo: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">Broker</span>
                        <input
                          type="text"
                          className="classic-erp-input"
                          value={header.broker}
                          onChange={(e) => setHeader({ ...header, broker: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">HSN CD</span>
                        <input
                          type="text"
                          className="classic-erp-input text-center font-mono"
                          value={header.hsnCd}
                          onChange={(e) => setHeader({ ...header, hsnCd: e.target.value })}
                          disabled={locked}
                          placeholder="9988"
                        />
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label red-label">TYPE</span>
                        <ERPSelect
                          className="classic-erp-select"
                          value={header.type}
                          onChange={(e) => setHeader({ ...header, type: e.target.value })}
                          options={TYPE_OPTIONS}
                          disabled={locked}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {!locked && (
                  <div className="erp-job-receipt-toolbar">
                    <button type="button" className="classic-erp-btn" onClick={loadPendingChallans}>
                      Load Pending Challans
                    </button>
                    <button type="button" className="classic-erp-btn" onClick={addLine}>
                      <Plus size={12} className="inline mr-0.5" /> Add Line
                    </button>
                    <span className="erp-job-receipt-pending-tag">
                      {partyPendingJobs.length} Pending
                    </span>
                  </div>
                )}
              </div>

              {/* Line grid */}
              <div className="classic-erp-frame erp-job-receipt-grid-wrap flex-1 min-h-0 flex flex-col">
                <div className="classic-erp-table-container erp-job-receipt-grid flex-1 min-h-[140px]">
                  <table
                    className="classic-erp-table erp-job-receipt-table"
                    onKeyDown={(e) => { handleFormEnterKeyDown(e); handleFormArrowKeyDown(e); }}
                  >
                    <thead>
                      <tr>
                        <th className="w-8">SrNo</th>
                        {gridCols.map((c) => (
                          <th key={c.key} className={`${c.w} ${c.align === 'right' ? 'text-right' : ''}`}>
                            {c.label}
                          </th>
                        ))}
                        {!locked && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {calc.linesWithAmt.map((line, idx) => (
                        <tr key={line.id} data-row-idx={idx}>
                          <td className="text-center text-slate-500">{idx + 1}</td>
                          {gridCols.map((c) => {
                            if (c.key === 'chlnNo') {
                              return (
                                <td key={c.key}>
                                  <button
                                    type="button"
                                    data-enter-action="true"
                                    data-enter-nav="action"
                                    tabIndex={locked ? -1 : 0}
                                    className="classic-erp-input w-full text-left font-bold truncate disabled:cursor-default focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                    onClick={() => openLotLookup(idx)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openLotLookup(idx);
                                      }
                                    }}
                                    disabled={locked}
                                    title="Press Enter to pick challan (or click)"
                                  >
                                    {line.chlnNo || '— select —'}
                                  </button>
                                </td>
                              );
                            }
                            if (c.key === 'pqk') {
                              return (
                                <td key={c.key}>
                                  <select
                                    className="classic-erp-select w-full text-[11px]"
                                    value={line.pqk}
                                    onChange={(e) => setLine(idx, { pqk: e.target.value })}
                                    disabled={locked}
                                  >
                                    {PQK_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              );
                            }
                            if (c.computed && c.key === 'shtgPct') {
                              return (
                                <td key={c.key} className="text-right font-mono">
                                  {lineShortagePct(line).toFixed(2)}
                                </td>
                              );
                            }
                            if (c.key === 'jobAmt') {
                              return (
                                <td key={c.key} className="p-0">
                                  <span className="erp-jobamt-highlight">
                                    {Number(line.jobAmt || 0).toFixed(2)}
                                  </span>
                                </td>
                              );
                            }
                            if (c.readOnly) {
                              return (
                                <td
                                  key={c.key}
                                  className={`${c.key === 'itemName' ? 'text-left font-bold uppercase' : 'text-right font-mono'} text-slate-500 px-1`}
                                >
                                  {c.key === 'itemName'
                                    ? (line[c.key] || '')
                                    : (line[c.key] !== '' && line[c.key] != null
                                      ? Number(line[c.key]).toFixed(c.key === 'issueMtsRef' ? 2 : 0)
                                      : '')}
                                </td>
                              );
                            }
                            return (
                              <td key={c.key}>
                                <input
                                  type={['recPcs', 'recMts', 'jRate'].includes(c.key) ? 'number' : 'text'}
                                  step={c.key === 'jRate' ? '0.01' : c.key === 'recMts' ? '0.001' : '1'}
                                  data-col-key={c.key}
                                  className={`classic-erp-input w-full ${c.align === 'right' ? 'text-right' : ''} ${c.key === 'itemName' ? 'uppercase font-bold' : ''}`}
                                  value={line[c.key] ?? ''}
                                  onChange={(e) => setLine(idx, { [c.key]: e.target.value })}
                                  disabled={locked}
                                />
                              </td>
                            );
                          })}
                          {!locked && (
                            <td className="text-center">
                              <button
                                type="button"
                                className="erp-job-receipt-del"
                                onClick={() => removeLine(idx)}
                                title="Remove line"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="erp-job-receipt-totalbar">
                  <span>TOTAL Pcs : {gridTotals.pcs}</span>
                  <span>/</span>
                  <span>Send.Mts : {gridTotals.sendMts.toFixed(2)}</span>
                  <span>/</span>
                  <span>Rec.Mts : {gridTotals.recMts.toFixed(2)}</span>
                </div>
              </div>

              {/* Footer — adjustments + totals */}
              <div className="erp-job-receipt-footer-grid shrink-0">
                <div className="classic-erp-frame erp-job-receipt-adjust">
                  <div className="erp-job-receipt-adj-grid">
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Add</span>
                      <div className="classic-erp-control">
                        <input
                          type="text"
                          className="classic-erp-input flex-1"
                          value={footer.addLabel}
                          onChange={(e) => setFooter({ ...footer, addLabel: e.target.value })}
                          disabled={locked}
                          placeholder="Description"
                        />
                        <input
                          type="number"
                          className="classic-erp-input w-20 text-right"
                          value={footer.addAmt}
                          onChange={(e) => setFooter({ ...footer, addAmt: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Less</span>
                      <div className="classic-erp-control">
                        <input
                          type="text"
                          className="classic-erp-input flex-1"
                          value={footer.lessLabel}
                          onChange={(e) => setFooter({ ...footer, lessLabel: e.target.value })}
                          disabled={locked}
                        />
                        <input
                          type="number"
                          className="classic-erp-input w-20 text-right"
                          value={footer.lessAmt}
                          onChange={(e) => setFooter({ ...footer, lessAmt: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Other Less</span>
                      <div className="classic-erp-control">
                        <input
                          type="text"
                          className="classic-erp-input flex-1"
                          value={footer.otherLess1Label}
                          onChange={(e) => setFooter({ ...footer, otherLess1Label: e.target.value })}
                          disabled={locked}
                        />
                        <input
                          type="number"
                          className="classic-erp-input w-20 text-right"
                          value={footer.otherLess1Amt}
                          onChange={(e) => setFooter({ ...footer, otherLess1Amt: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Other Less</span>
                      <div className="classic-erp-control">
                        <input
                          type="text"
                          className="classic-erp-input flex-1"
                          value={footer.otherLess2Label}
                          onChange={(e) => setFooter({ ...footer, otherLess2Label: e.target.value })}
                          disabled={locked}
                        />
                        <input
                          type="number"
                          className="classic-erp-input w-20 text-right"
                          value={footer.otherLess2Amt}
                          onChange={(e) => setFooter({ ...footer, otherLess2Amt: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="erp-job-receipt-tds-row">
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">On Tds Amount</span>
                      <input
                        type="number"
                        className="classic-erp-input text-right"
                        value={footer.tdsOnAmount}
                        onChange={(e) => setFooter({ ...footer, tdsOnAmount: e.target.value })}
                        disabled={locked}
                        placeholder={calc.taxable.toFixed(2)}
                      />
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">T.d.s.</span>
                      <div className="classic-erp-control">
                        <input
                          type="number"
                          className="classic-erp-input w-16 text-right"
                          value={footer.tdsPercent}
                          onChange={(e) => setFooter({ ...footer, tdsPercent: e.target.value })}
                          disabled={locked}
                          step="0.01"
                        />
                        <span className="text-[10px] font-bold">%</span>
                        <span className="font-mono text-[11px] ml-auto">₹{calc.tdsAmt.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Remark</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.remark}
                      onChange={(e) => setFooter({ ...footer, remark: e.target.value })}
                      disabled={locked}
                    />
                  </div>

                  <div className="erp-job-receipt-tax-panel">
                    <div className="erp-job-receipt-tax-rate">
                      <span className="classic-erp-label">Tax Rate</span>
                      <input
                        type="number"
                        className="classic-erp-input text-center font-bold"
                        value={footer.taxRate}
                        onChange={(e) => setFooter({ ...footer, taxRate: e.target.value })}
                        disabled={locked}
                      />
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">TaxableAmt</span>
                      <input
                        type="text"
                        className="classic-erp-input text-right font-mono font-bold"
                        value={calc.taxable.toFixed(2)}
                        readOnly
                      />
                    </div>
                    <table className="erp-job-receipt-gst-table">
                      <thead>
                        <tr>
                          <th />
                          <th>SGST%</th>
                          <th>CGST%</th>
                          <th>IGST%</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="font-bold text-[10px]">Rate</td>
                          <td>
                            <input
                              type="text"
                              className="classic-erp-input text-center"
                              value={header.type === 'INVOICE IN STATE' ? (Number(footer.taxRate) / 2).toFixed(2) : '0'}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="classic-erp-input text-center"
                              value={header.type === 'INVOICE IN STATE' ? (Number(footer.taxRate) / 2).toFixed(2) : '0'}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="classic-erp-input text-center"
                              value={header.type !== 'INVOICE IN STATE' ? footer.taxRate : '0'}
                              readOnly
                            />
                          </td>
                        </tr>
                        <tr>
                          <td className="font-bold text-[10px]">Amt</td>
                          <td className="font-mono text-right">{calc.sgst.toFixed(2)}</td>
                          <td className="font-mono text-right">{calc.cgst.toFixed(2)}</td>
                          <td className="font-mono text-right">{calc.igst.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="classic-erp-frame erp-job-receipt-totals">
                  <div className="classic-erp-total-row">
                    <span className="classic-erp-label">Gross Amt</span>
                    <span className="font-mono font-bold text-slate-800">{calc.gross.toFixed(2)}</span>
                  </div>
                  <div className="classic-erp-total-row">
                    <span className="classic-erp-label">TOTAL GST</span>
                    <span className="font-mono font-bold text-slate-800">{calc.totalGst.toFixed(2)}</span>
                  </div>
                  <div className="classic-erp-total-row">
                    <span className="classic-erp-label erp-rcm-label">RCM CHARGE</span>
                    <input
                      type="number"
                      className="classic-erp-input w-24 text-right font-mono erp-rcm-highlight"
                      value={footer.rcmCharge}
                      onChange={(e) => setFooter({ ...footer, rcmCharge: e.target.value })}
                      disabled={locked || header.reverseCharge !== 'Yes'}
                    />
                  </div>
                  <div className="classic-erp-total-row">
                    <div className="flex items-center gap-1">
                      <span className="classic-erp-label">Round Off</span>
                      <input
                        type="number"
                        className="classic-erp-input w-16 text-right font-mono"
                        value={footer.roundOff}
                        onChange={(e) => setFooter({ ...footer, roundOff: e.target.value })}
                        disabled={locked}
                        step="0.01"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="classic-erp-label">Net Amount</span>
                      <span className="font-mono font-bold text-slate-900">{calc.net.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="classic-erp-total-row erp-job-receipt-final-row">
                    <span className="classic-erp-label font-bold text-slate-900">Final Amount</span>
                    <span className="font-mono font-bold text-slate-900 text-base">{calc.final.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="erp-job-receipt-pending-status shrink-0">
                Pending
              </div>

              <div className="classic-erp-form-footer erp-job-receipt-footer shrink-0">
                <button type="button" className="classic-erp-btn" onClick={handleNew} disabled={saving}>
                  New
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={handleEdit}
                  disabled={saving || mode !== 'View' || !selectedReceiptId}
                >
                  Edit
                </button>
                <button type="submit" className="classic-erp-btn btn-blue" disabled={saving || locked}>
                  <SaveButtonLabel saving={saving} label="Save" />
                </button>
                <button type="button" className="classic-erp-btn" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="classic-erp-btn font-bold bg-amber-100 border-amber-400 text-amber-900"
                  onClick={handleOpenFindModal}
                  disabled={saving}
                  title="Quick Find Receipt (F3 / Alt+F)"
                >
                  Find (F3)
                </button>
                <button type="button" className="classic-erp-btn btn-red" onClick={handleDelete} disabled={saving}>
                  Delete
                </button>
                <button type="button" className="classic-erp-btn" onClick={onClose} disabled={saving}>
                  Exit
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={handleOpenFindModal}
                >
                  Sp.Find
                </button>
                <button type="button" className="classic-erp-btn" onClick={handlePrint}>
                  Print
                </button>
                <button
                  type="button"
                  className="classic-erp-btn btn-red-text"
                  onClick={() => {
                    if (onOpenPayment) onOpenPayment(header.partyId);
                    else toast.info('Open Bank Payment / Cash Payment from Transactions');
                  }}
                >
                  Payment Entry
                </button>
                <button
                  type="button"
                  className="classic-erp-btn btn-red-text"
                  onClick={() => toast.info('Send JobWork — integration coming soon')}
                >
                  Send JobWork
                </button>
                <button type="button" className="classic-erp-btn" onClick={onClose} disabled={saving}>
                  Close
                </button>
              </div>
            </form>
          </div>
        )}
      </ErpWindowedModal>

      {/* Quick Job Receipt Number Find Modal with + / - and Enter -> Edit */}
      {findOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[10070] flex items-center justify-center p-4"
          onClick={() => setFindOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl border-2 border-slate-700 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '82vh' }}
          >
            {/* Header */}
            <div className="bg-[#1a3353] text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-slate-900 font-black px-1.5 py-0.5 rounded text-[11px]">FIND RECEIPT</span>
                <h3 className="font-bold text-xs uppercase tracking-wider">Quick Job Receipt Selector</h3>
              </div>
              <span className="text-[10px] text-slate-300">
                <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">+</kbd> / <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">-</kbd> change · <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">Enter</kbd> Edit
              </span>
            </div>

            {/* Search / Quick Number Input */}
            <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 shrink-0">Challan / Bill:</span>
              <input
                ref={findInputRef}
                type="text"
                autoFocus
                value={findSearch}
                onChange={(e) => {
                  setFindSearch(e.target.value);
                  setFindActiveIdx(0);
                }}
                onKeyDown={handleFindKeyDown}
                placeholder="Type number (1, 2, 3...) or press + / - to change..."
                className="flex-1 px-3 py-1.5 border-2 border-blue-600 rounded text-sm font-bold bg-[#fffde6] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono shadow-inner"
              />
              <span className="text-[11px] font-bold text-slate-600 shrink-0">{filteredReceipts.length} Records</span>
            </div>

            {/* Receipts Numbers List */}
            <div className="overflow-y-auto p-2 flex-1 space-y-1 max-h-72 bg-slate-50">
              {filteredReceipts.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 font-medium">
                  No receipts found matching &quot;{findSearch}&quot;
                </div>
              ) : (
                filteredReceipts.map((j, idx) => {
                  const isSelected = idx === findActiveIdx;
                  const cleanNo = String(j.billChNo || j.challanNo || j.jobCardNo || idx + 1);
                  return (
                    <div
                      key={j._id || j.id || idx}
                      onClick={() => {
                        loadReceipt(j._id || j.id, 'Edit');
                        setFindOpen(false);
                        toast.success(`Receipt #${cleanNo} loaded in Edit mode`);
                      }}
                      className={`px-3 py-2 rounded flex items-center justify-between cursor-pointer text-xs transition-all ${isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-300'
                          : 'hover:bg-slate-200 text-slate-800 bg-white border border-slate-200'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-black font-mono px-2 py-0.5 rounded ${isSelected ? 'bg-amber-400 text-slate-900 shadow-sm' : 'bg-slate-200 text-slate-900'}`}>
                          #{cleanNo}
                        </span>
                        <div>
                          <div className={`font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {j.workerId?.name || 'Job Worker / Mill'}
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                            {j.receiveDate ? new Date(j.receiveDate).toLocaleDateString('en-IN') : (j.issueDate ? new Date(j.issueDate).toLocaleDateString('en-IN') : '—')} · {j.lotId?.itemName || 'Item'} · {Number(j.receivedQty || j.issueQty || 0).toFixed(2)} mts
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold">
                        <div>{Number(j.receivedPcs || j.issuePcs || 0)} pcs</div>
                        {isSelected && (
                          <span className="text-[9px] bg-white/25 px-1.5 py-0.5 rounded text-white font-semibold uppercase tracking-wider">
                            ↵ Enter → Edit
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Navigation Bar */}
            <div className="bg-slate-200 px-3 py-2 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-700">
              <span className="flex items-center gap-1 font-medium">
                <kbd className="bg-white border px-1 rounded font-bold font-mono">+</kbd> Next · <kbd className="bg-white border px-1 rounded font-bold font-mono">-</kbd> Prev · <kbd className="bg-white border px-1 rounded font-bold font-mono">↑↓</kbd> Select
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFindOpen(false)}
                  className="px-3 py-1 bg-white border border-slate-400 rounded text-xs hover:bg-slate-100 font-semibold"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const job = filteredReceipts[findActiveIdx];
                    if (job) {
                      loadReceipt(job._id || job.id, 'Edit');
                      setFindOpen(false);
                      toast.success(`Receipt #${job.billChNo || job.challanNo || job.jobCardNo} loaded in Edit mode`);
                    }
                  }}
                  disabled={!filteredReceipts.length}
                  className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-xs hover:bg-blue-700 shadow-sm"
                >
                  Open in Edit (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <JobLotLookupModal
        isOpen={lotLookupOpen}
        onClose={() => setLotLookupOpen(false)}
        jobs={lotLookupJobs}
        partyName={header.partyId ? partyOptions.find((p) => String(p.value) === String(header.partyId))?.label : ''}
        onSelect={handleLotSelect}
      />

      {printOpen && (
        <JobWorkPrint variant="jobReceive" data={printData} onClose={() => setPrintOpen(false)} />
      )}
    </>
  );
};

export default JobReceiptModal;
