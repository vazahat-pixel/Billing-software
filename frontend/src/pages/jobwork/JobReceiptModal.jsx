import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ERPSelect } from '../../components/forms/FormElements';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
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

const JobReceiptModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { jobWorkEntries, parties, fetchJobs, fetchParties, receiveFromMill } = useStore();

  const [mode, setMode] = useState('Add');
  const [findOpen, setFindOpen] = useState(false);
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

  useEffect(() => {
    if (!isOpen) {
      setBootLoading(false);
      return;
    }
    let cancelled = false;
    setBootLoading(true);
    Promise.all([fetchJobs(), fetchParties?.()])
      .catch(() => {})
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

  const partyOptions = useMemo(
    () =>
      (parties || [])
        .filter((p) => ['Supplier', 'Job Worker', 'Mill', 'Customer', 'Both'].includes(p.type))
        .map((p) => ({
          value: p._id || p.id,
          label: p.name,
          gstin: p.gstin || '',
        })),
    [parties]
  );

  const pendingJobs = useMemo(
    () => (jobWorkEntries || []).filter((j) => j.status === 'Issued'),
    [jobWorkEntries]
  );

  const receivedJobs = useMemo(
    () => (jobWorkEntries || []).filter((j) => j.status === 'Received'),
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
    return pendingJobs.filter(
      (j) => String(j.workerId?._id || j.workerId) === String(header.partyId)
    );
  }, [pendingJobs, header.partyId]);

  const calc = useMemo(() => calcJobReceipt(lines, footer, header), [lines, footer, header]);

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
    if (!header.partyId) {
      toast.warning('Select Job Party first');
      return;
    }
    if (partyPendingJobs.length === 0) {
      toast.info('No pending issued challans for this party');
      return;
    }
    setLines(partyPendingJobs.map(jobToLine));
    toast.success(`Loaded ${partyPendingJobs.length} pending challan(s)`);
  };

  const lotLookupJobs = header.partyId ? partyPendingJobs : pendingJobs;

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
      loadReceipt(selectedReceiptId);
      setMode('View');
    } else {
      handleNew();
    }
  };

  const loadReceipt = (jobId) => {
    const job = receivedJobs.find((j) => String(j._id) === String(jobId));
    if (!job) return;
    setSelectedReceiptId(jobId);
    setHeader({
      serialNo: '1',
      date: job.receiveDate ? job.receiveDate.split('T')[0] : today(),
      reverseCharge: 'No',
      billChNo: job.challanNo || '',
      broker: '',
      hsnCd: '',
      type: 'INVOICE IN STATE',
      partyId: job.workerId?._id || job.workerId || '',
      gstin: job.workerId?.gstin || '',
      book: selectedBook || 'JOB WORK RECEIVE BOOK',
    });

    // Derive taxRate safely: only back-calculate when both values are positive and
    // the result is a recognisable GST slab; otherwise fall back to default 5%.
    let derivedTaxRate = '5';
    const gstAmt = Number(job.processGstAmount || 0);
    const charges = Number(job.processCharges || 0);
    if (gstAmt > 0 && charges > 0) {
      const pct = (gstAmt / charges) * 100;
      // Accept only if within a realistic GST range (1–30%)
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
    setMode('View');

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
        await receiveFromMill({
          jobId: line.jobId,
          receivedQty: Number(line.recMts) || 0,
          receivedPcs: Number(line.recPcs) || 0,
          charges: Number(line.jobAmt) || 0,
          gstAmount: Number(gstShare.toFixed(2)) || 0,
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
  const handlePrint = () => {
    if (!selectedReceiptId) return toast.warning('Find a receipt to print');
    toast.info('Print preview — coming soon');
  };

  const gridCols = [
    { key: 'chlnNo', label: 'ChlnNo', w: 'w-28', lookup: true },
    { key: 'itemName', label: 'ItemName', w: 'flex-1', readOnly: true },
    { key: 'finishItem', label: 'FinishItem', w: 'w-32' },
    { key: 'cut', label: 'Cut', w: 'w-16', align: 'right' },
    { key: 'recPcs', label: 'RecPcs', w: 'w-16', align: 'right' },
    { key: 'recMts', label: 'RecMts', w: 'w-20', align: 'right' },
    { key: 'jRate', label: 'J.Rate', w: 'w-20', align: 'right' },
    { key: 'pqk', label: 'PQK', w: 'w-14' },
    { key: 'jobAmt', label: 'JobAmt', w: 'w-20', align: 'right', readOnly: true },
    { key: 'cp', label: 'CP', w: 'w-12' },
    { key: 'jobcardNo', label: 'JobcardNo', w: 'w-24' },
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
            className="classic-erp-body erp-job-receipt-body flex-1 overflow-y-auto min-h-0"
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
                  <div className="classic-erp-field classic-erp-field--lg">
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
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">GSTIN</span>
                    <input
                      type="text"
                      className="classic-erp-input font-mono uppercase"
                      value={header.gstin}
                      readOnly
                      placeholder="—"
                    />
                  </div>
                </div>

                <div className="classic-erp-stack erp-job-receipt-meta-col">
                  <div className="classic-erp-meta-grid erp-job-receipt-meta-row">
                    <div className="classic-erp-field">
                      <span className="classic-erp-label red-label">Serial No</span>
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
                  </div>

                  <div className="classic-erp-meta-grid erp-job-receipt-meta-row">
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
                <table className="classic-erp-table erp-job-receipt-table">
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
                      <tr key={line.id}>
                        <td className="text-center text-slate-500">{idx + 1}</td>
                        {gridCols.map((c) => {
                          if (c.key === 'chlnNo') {
                            return (
                              <td key={c.key}>
                                <button
                                  type="button"
                                  className="classic-erp-input w-full text-left font-bold truncate disabled:cursor-default"
                                  onClick={() => openLotLookup(idx)}
                                  disabled={locked}
                                  title="Pick which bill/challan to receive from"
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
                              <td key={c.key} className="text-right font-mono font-bold">
                                {Number(line.jobAmt || 0).toFixed(2)}
                              </td>
                            );
                          }
                          if (c.readOnly) {
                            return (
                              <td key={c.key} className="text-right font-mono text-slate-500">
                                {line[c.key] !== '' && line[c.key] != null ? Number(line[c.key]).toFixed(c.key === 'issueMtsRef' ? 2 : 0) : ''}
                              </td>
                            );
                          }
                          return (
                            <td key={c.key}>
                              <input
                                type={['recPcs', 'recMts', 'jRate'].includes(c.key) ? 'number' : 'text'}
                                step={c.key === 'jRate' ? '0.01' : c.key === 'recMts' ? '0.001' : '1'}
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
                  <span className="font-mono font-bold">₹{calc.gross.toFixed(2)}</span>
                </div>
                <div className="classic-erp-total-row">
                  <span className="classic-erp-label">TOTAL GST</span>
                  <span className="font-mono font-bold">₹{calc.totalGst.toFixed(2)}</span>
                </div>
                <div className="classic-erp-total-row">
                  <span className="classic-erp-label erp-rcm-label">RCM CHARGE</span>
                  <input
                    type="number"
                    className={`classic-erp-input w-28 text-right font-mono ${header.reverseCharge === 'Yes' ? 'erp-rcm-highlight' : ''}`}
                    value={footer.rcmCharge}
                    onChange={(e) => setFooter({ ...footer, rcmCharge: e.target.value })}
                    disabled={locked || header.reverseCharge !== 'Yes'}
                  />
                </div>
                <div className="classic-erp-total-row">
                  <span className="classic-erp-label">Round Off</span>
                  <input
                    type="number"
                    className="classic-erp-input w-28 text-right font-mono"
                    value={footer.roundOff}
                    onChange={(e) => setFooter({ ...footer, roundOff: e.target.value })}
                    disabled={locked}
                    step="0.01"
                  />
                </div>
                <div className="classic-erp-total-row">
                  <span className="classic-erp-label">Net Amount</span>
                  <span className="font-mono font-bold">₹{calc.net.toFixed(2)}</span>
                </div>
                <div className="classic-erp-total-row erp-job-receipt-final-row">
                  <span className="classic-erp-label text-blue-900">Final Amount</span>
                  <span className="font-mono font-bold text-blue-900 text-lg">₹{calc.final.toFixed(2)}</span>
                </div>
              </div>
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
                className="classic-erp-btn"
                onClick={() => {
                  setFindOpen(true);
                  setMode('View');
                }}
                disabled={saving}
              >
                Find
              </button>
              <button type="button" className="classic-erp-btn" onClick={handleDelete} disabled={saving}>
                Delete
              </button>
              <button type="button" className="classic-erp-btn" onClick={onClose} disabled={saving}>
                Exit
              </button>
              <button
                type="button"
                className="classic-erp-btn"
                onClick={() => {
                  setFindOpen(true);
                  setMode('View');
                }}
              >
                Sp.Find
              </button>
              <button type="button" className="classic-erp-btn" onClick={handlePrint}>
                Print
              </button>
              <button
                type="button"
                className="classic-erp-btn"
                onClick={() => toast.info('Open Payment Entry from Accounting')}
              >
                Payment Entry
              </button>
              <button
                type="button"
                className="classic-erp-btn"
                onClick={() => toast.info('Send JobWork — integration coming soon')}
              >
                Send JobWork
              </button>
              <button
                type="button"
                className="classic-erp-btn"
                disabled={receiptOptions.length === 0}
                onClick={() => receiptOptions[0] && loadReceipt(receiptOptions[0].value)}
              >
                First
              </button>
              <button
                type="button"
                className="classic-erp-btn"
                disabled={receiptOptions.length === 0}
                onClick={() => receiptOptions[receiptOptions.length - 1] && loadReceipt(receiptOptions[receiptOptions.length - 1].value)}
              >
                Last
              </button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.info('CP — cost price lookup')}>
                CP
              </button>
            </div>
          </form>
        </div>
      )}
    </ErpWindowedModal>

    <JobLotLookupModal
      isOpen={lotLookupOpen}
      onClose={() => setLotLookupOpen(false)}
      jobs={lotLookupJobs}
      partyName={header.partyId ? partyOptions.find((p) => String(p.value) === String(header.partyId))?.label : ''}
      onSelect={handleLotSelect}
    />
    </>
  );
};

export default JobReceiptModal;
