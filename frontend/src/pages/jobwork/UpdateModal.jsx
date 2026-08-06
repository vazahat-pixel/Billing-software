import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ERPSelect } from '../../components/forms/FormElements';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifySuccess, notifyError, notifyWarning, notifyInfo } from '../../utils/notify';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import { Trash2, Plus } from 'lucide-react';
import PuBillLookupModal from './PuBillLookupModal';

const today = () => new Date().toISOString().split('T')[0];

const weekday = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return '';
  }
};

const blankLine = () => ({
  id: Math.random().toString(),
  lotId: '',
  lotNo: '',
  chlnNo: '',
  itemName: '',
  pcs: '',
  cut: '',
  qty: '',
  rate: '',
  fabRate: '',
  narration: '',
  jobId: '',
});

const GST_TYPE_OPTIONS = [
  { value: 'INVOICE IN STATE', label: 'INVOICE IN STATE' },
  { value: 'OUT OF STATE', label: 'OUT OF STATE' },
  { value: 'EXEMPT', label: 'EXEMPT' },
];

export default function UpdateModal({ isOpen, onClose, selectedBook = null }) {
  const {
    parties,
    items,
    purchases,
    inventoryLots,
    jobWorkEntries,
    fetchParties,
    fetchItems,
    fetchPurchases,
    fetchInventory,
    fetchJobs,
    issueToMill,
  } = useStore();

  const [mode, setMode] = useState('Add'); // Add | Edit | View
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);

  // Form Header State
  const [header, setHeader] = useState({
    challanNo: '1',
    challanNoSuffix: '',
    date: today(),
    reFinish: false,
    gstType: 'INVOICE IN STATE',
    gstin: '',
    partyId: '',
    broker: '',
    hsnCd: '5407',
    book: selectedBook || 'JOBWORK BOOK',
  });

  // Form Lines State
  const [lines, setLines] = useState([blankLine()]);

  // Form Footer State
  const [footer, setFooter] = useState({
    remark: '',
    note: '',
    transport: '',
    lrNo: '',
    baleNo: '',
    taxRate: '5',
  });

  const [selectedJobId, setSelectedJobId] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const [lotLookupOpen, setLotLookupOpen] = useState(false);
  const [lotLookupTargetIdx, setLotLookupTargetIdx] = useState(null);

  const locked = mode === 'View';

  const partyOptions = useMemo(
    () =>
      (parties || [])
        .filter((p) => ['Job Worker', 'Both', 'Supplier'].includes(p.type) || (p.group || '').toUpperCase().includes('JOB'))
        .map((p) => ({
          value: p._id || p.id,
          label: p.name,
          gstin: p.gstin || '',
        })),
    [parties]
  );

  const jobOptions = useMemo(() => {
    const list = [...(jobWorkEntries || [])];
    list.sort((a, b) => {
      const da = new Date(a.issueDate || a.createdAt || 0).getTime();
      const db = new Date(b.issueDate || b.createdAt || 0).getTime();
      return db - da;
    });
    return list.map((j) => ({
      value: j._id || j.id,
      label: `${j.jobCardNo || j.challanNo || '-'} · ${j.workerId?.name || 'Mill'} · ${Number(j.issueQty || 0).toFixed(2)} mts`,
    }));
  }, [jobWorkEntries]);

  // Derived Grid and Tax Calculations
  const calc = useMemo(() => {
    const linesWithAmt = lines.map((l) => {
      const qty = Number(l.qty) || 0;
      const rateVal = Number(l.rate) || 0;
      const jobAmt = Number((qty * rateVal).toFixed(2));
      return { ...l, jobAmt };
    });

    const gross = linesWithAmt.reduce((sum, l) => sum + l.jobAmt, 0);
    const taxRate = Number(footer.taxRate || 5);

    let cgstPct = 0;
    let sgstPct = 0;
    let igstPct = 0;

    if (header.gstType === 'INVOICE IN STATE') {
      cgstPct = taxRate / 2;
      sgstPct = taxRate / 2;
    } else if (header.gstType === 'OUT OF STATE') {
      igstPct = taxRate;
    }

    const cgstAmt = Number(((gross * cgstPct) / 100).toFixed(2));
    const sgstAmt = Number(((gross * sgstPct) / 100).toFixed(2));
    const igstAmt = Number(((gross * igstPct) / 100).toFixed(2));
    const totalGst = cgstAmt + sgstAmt + igstAmt;
    const net = Number((gross + totalGst).toFixed(2));

    return {
      linesWithAmt,
      gross,
      cgstPct,
      cgstAmt,
      sgstPct,
      sgstAmt,
      igstPct,
      igstAmt,
      totalGst,
      net,
    };
  }, [lines, footer.taxRate, header.gstType]);

  useEffect(() => {
    if (!isOpen) return;
    setBootLoading(true);
    setMode('Add');
    handleNew();
    Promise.all([fetchParties(), fetchItems(), fetchPurchases(), fetchInventory(), fetchJobs()])
      .catch(() => {})
      .finally(() => setBootLoading(false));
  }, [isOpen, selectedBook]);

  const handlePartyChange = (partyId) => {
    const party = partyOptions.find((p) => String(p.value) === String(partyId));
    setHeader((h) => ({
      ...h,
      partyId: partyId || '',
      gstin: party?.gstin || '',
    }));
  };

  const setLine = useCallback((idx, patch) => {
    setLines((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };

      const pcs = Number(merged.pcs) || 0;
      let qty = Number(merged.qty) || 0;
      let cut = Number(merged.cut) || 0;

      if (patch.hasOwnProperty('pcs') || patch.hasOwnProperty('cut')) {
        qty = pcs * cut;
        merged.qty = qty > 0 ? String(qty) : merged.qty;
      } else if (patch.hasOwnProperty('qty')) {
        if (pcs > 0) {
          cut = Number((qty / pcs).toFixed(3));
          merged.cut = cut > 0 ? String(cut) : merged.cut;
        }
      }

      next[idx] = merged;
      return next;
    });
  }, []);

  const addLine = () => setLines((prev) => [...prev, blankLine()]);

  const removeLine = (idx) => {
    setLines((prev) => (prev.length <= 1 ? [blankLine()] : prev.filter((_, i) => i !== idx)));
  };

  const openLotLookup = (idx) => {
    if (locked) return;
    setLotLookupTargetIdx(idx);
    setLotLookupOpen(true);
  };

  const handleLotSelect = (row) => {
    setLines((prev) => {
      const next = [...prev];
      const targetIdx = lotLookupTargetIdx != null ? lotLookupTargetIdx : prev.findIndex((l) => !l.lotId);

      const pcs = row.balPcs || 0;
      const qty = row.balMts || 0;
      const cut = pcs > 0 ? Number((qty / pcs).toFixed(3)) : 0;

      const lineData = {
        id: next[targetIdx]?.id || Math.random().toString(),
        lotId: row.lotId || '',
        lotNo: row.lotCode || '',
        chlnNo: row.billNo || '',
        itemName: row.itemName || '',
        pcs: pcs > 0 ? String(pcs) : '',
        cut: cut > 0 ? String(cut) : '',
        qty: qty > 0 ? String(qty) : '',
        rate: '',
        fabRate: row.puRate > 0 ? String(row.puRate) : '',
        narration: '',
        jobId: '',
      };

      if (targetIdx === -1) {
        return [...prev, lineData];
      } else {
        next[targetIdx] = lineData;
        return next;
      }
    });
  };

  const handleNew = () => {
    setMode('Add');
    setSelectedJobId('');
    setFindOpen(false);
    setHeader({
      challanNo: '1',
      challanNoSuffix: '',
      date: today(),
      reFinish: false,
      gstType: 'INVOICE IN STATE',
      gstin: '',
      partyId: '',
      broker: '',
      hsnCd: '5407',
      book: selectedBook || 'JOBWORK BOOK',
    });
    setFooter({
      remark: '',
      note: '',
      transport: '',
      lrNo: '',
      baleNo: '',
      taxRate: '5',
    });
    setLines([blankLine()]);
  };

  const handleEdit = () => {
    if (!selectedJobId) return notifyWarning('Find a challan first');
    setMode('Edit');
  };

  const handleCancel = () => {
    if (selectedJobId) {
      loadJob(selectedJobId);
      setMode('View');
    } else {
      handleNew();
    }
  };

  const loadJob = (id) => {
    setSelectedJobId(id);
    if (!id) return;
    const job = jobWorkEntries.find((j) => String(j._id || j.id) === String(id));
    if (!job) return;

    setMode('View');
    setFindOpen(true);
    const remarks = String(job.remark || job.remarks || '');
    setHeader({
      challanNo: job.challanNo || job.jobCardNo || '',
      challanNoSuffix: '',
      date: job.issueDate ? String(job.issueDate).slice(0, 10) : today(),
      reFinish: job.reFinish || false,
      gstType: job.gstType || 'INVOICE IN STATE',
      gstin: job.workerId?.gstin || '',
      partyId: job.workerId?._id || job.workerId || '',
      broker: job.broker || '',
      hsnCd: job.hsnCd || '5407',
      book: job.book || 'JOBWORK BOOK',
    });

    const itemLine = {
      id: Math.random().toString(),
      lotId: job.lotId?._id || job.lotId || '',
      lotNo: job.lotId?.lotId || '',
      chlnNo: job.purchaseBillNo || '',
      itemName: job.lotId?.itemName || job.lotId?.itemId?.name || '',
      pcs: String(job.issuePcs || 0),
      cut: job.issuePcs > 0 ? String((job.issueQty / job.issuePcs).toFixed(3)) : '',
      qty: String(job.issueQty || 0),
      rate: String(job.jobRate || 0),
      fabRate: String(job.purchaseRate || 0),
      narration: remarks,
      jobId: job._id,
    };
    setLines([itemLine]);

    setFooter({
      remark: remarks,
      note: job.note || '',
      transport: job.transport || '',
      lrNo: job.lrNo || '',
      baleNo: job.baleNo || '',
      taxRate: job.taxRate != null ? String(job.taxRate) : '5',
    });
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (locked) {
      notifyWarning('Click Edit or New before saving');
      return;
    }
    if (!header.partyId) {
      notifyWarning('Select Job Party');
      return;
    }

    const activeLines = calc.linesWithAmt.filter((l) => l.lotId && Number(l.qty) > 0);
    if (activeLines.length === 0) {
      notifyWarning('Add at least one line with linked Lot No and quantity');
      return;
    }

    setSaving(true);
    let ok = 0;
    try {
      for (const line of activeLines) {
        const fullChallan = header.challanNo === 'AUTO' || !header.challanNo 
          ? 'AUTO' 
          : `${header.challanNo}${header.challanNoSuffix ? '-' + header.challanNoSuffix : ''}`;

        await issueToMill({
          jobCardNo: fullChallan,
          issueDate: header.date,
          date: header.date,
          lotId: line.lotId,
          workerId: header.partyId,
          processType: 'Process Charge',
          issueQty: Number(line.qty) || 0,
          issuePcs: Number(line.pcs) || 0,
          weaver: '',
          purchaseBillNo: line.chlnNo || '',
          purchaseRate: Number(line.fabRate) || 0,
          jobRate: Number(line.rate) || 0,
          processCharges: Number(line.rate) || 0,
          chargesRate: Number(line.rate) || 0,
          remark: footer.remark || '',
          remarks: footer.remark || '',
          transport: footer.transport || '',
          note: footer.note || '',
          lrNo: footer.lrNo || '',
          baleNo: footer.baleNo || '',
          gstType: header.gstType,
          taxRate: Number(footer.taxRate),
          reFinish: header.reFinish,
          broker: header.broker,
          hsnCd: header.hsnCd,
        });
        ok += 1;
      }
      notifySuccess(`Job Issue saved — ${ok} challan(s) issued`);
      handleNew();
      setMode('View');
      await Promise.all([fetchJobs(), fetchInventory()]);
    } catch (err) {
      notifyError(err, ok > 0 ? `Partial save: ${ok} issued, then failed` : 'Failed to save job issue');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!selectedJobId) return notifyWarning('Find a challan to print');
    notifyInfo('Print preview — coming soon');
  };

  const titleBook = selectedBook || header.book || 'JOBWORK BOOK';

  const gridCols = [
    { key: 'lotNo', label: 'CNo (LotNo)', w: 'w-28', lookup: true },
    { key: 'chlnNo', label: 'ChlnNo', w: 'w-24' },
    { key: 'itemName', label: 'Item Name', w: 'flex-1', readOnly: true },
    { key: 'pcs', label: 'Pcs', w: 'w-16', align: 'right' },
    { key: 'cut', label: 'Cut', w: 'w-16', align: 'right' },
    { key: 'qty', label: 'Qty', w: 'w-20', align: 'right' },
    { key: 'rate', label: 'Rate', w: 'w-20', align: 'right' },
    { key: 'fabRate', label: 'Fab.Rt', w: 'w-20', align: 'right' },
    { key: 'narration', label: 'Narration 1', w: 'w-36' },
  ];

  return (
    <>
      <ErpWindowedModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Additional Job Issue [ ${titleBook} ]`}
        windowId="jobIssue"
        bare
      >
        {({ WindowControls }) => (
          <div className="classic-erp-window erp-density erp-job-issue-window flex flex-col h-full min-h-0 !max-h-none">
            <ErpBusyOverlay show={bootLoading} message="Loading job issue registry…" />
            <ErpBusyOverlay show={!bootLoading && saving} message="Saving job issue entries…" />

            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">
                Additional Job Issue [ {titleBook} ]
              </span>
              <WindowControls />
            </div>

            <form
              onSubmit={handleSave}
              className="classic-erp-body erp-job-issue-body flex-1 overflow-y-auto min-h-0"
            >
              {findOpen && (
                <div className="classic-erp-frame erp-job-issue-find shrink-0">
                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label blue-label">Find</span>
                    <ERPSelect
                      className="classic-erp-select"
                      value={selectedJobId}
                      onChange={(e) => loadJob(e.target.value)}
                      options={jobOptions}
                      placeholder="- Select Job Issue Challan -"
                      recentKey="job-issue-find"
                    />
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="classic-erp-frame erp-job-issue-header shrink-0">
                <div className="erp-job-issue-header-grid">
                  <div className="classic-erp-stack">
                    <div className="classic-erp-meta-grid erp-job-issue-meta-row">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label red-label">Challan No</span>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            className="classic-erp-input text-center font-bold flex-1"
                            value={header.challanNo}
                            onChange={(e) => setHeader({ ...header, challanNo: e.target.value })}
                            disabled={locked}
                          />
                          <input
                            type="text"
                            className="classic-erp-input text-center w-10 shrink-0"
                            value={header.challanNoSuffix}
                            onChange={(e) => setHeader({ ...header, challanNoSuffix: e.target.value })}
                            disabled={locked}
                            placeholder="Suffix"
                          />
                        </div>
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label red-label">Date</span>
                        <div className="classic-erp-control">
                          <input
                            type="date"
                            className="classic-erp-input erp-job-issue-date"
                            value={header.date}
                            onChange={(e) => setHeader({ ...header, date: e.target.value })}
                            disabled={locked}
                            required
                          />
                          <span className="erp-job-issue-weekday">{weekday(header.date)}</span>
                        </div>
                      </div>
                      <div className="classic-erp-field justify-center pl-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 border-slate-400 bg-white"
                            checked={header.reFinish}
                            onChange={(e) => setHeader({ ...header, reFinish: e.target.checked })}
                            disabled={locked}
                          />
                          ReFinish
                        </label>
                      </div>
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg mt-1.5">
                      <span className="classic-erp-label red-label">Job Party</span>
                      <ERPCombobox
                        value={header.partyId}
                        onChange={handlePartyChange}
                        disabled={locked}
                        options={partyOptions}
                        placeholder="Search job worker / mill…"
                        recentKey="job-issue-party"
                        allowClear
                      />
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg mt-1">
                      <span className="classic-erp-label">Broker</span>
                      <input
                        type="text"
                        className="classic-erp-input font-bold"
                        value={header.broker}
                        onChange={(e) => setHeader({ ...header, broker: e.target.value })}
                        disabled={locked}
                        placeholder="Search Broker…"
                      />
                    </div>

                    <div className="classic-erp-meta-grid erp-job-issue-meta-row mt-1">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">HSN CODE</span>
                        <input
                          type="text"
                          className="classic-erp-input text-center font-mono"
                          value={header.hsnCd}
                          onChange={(e) => setHeader({ ...header, hsnCd: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GST Panel */}
                  <div className="classic-erp-stack bg-slate-50 p-2 border border-slate-300 rounded-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">GstType</span>
                        <ERPSelect
                          className="classic-erp-select"
                          value={header.gstType}
                          onChange={(e) => setHeader({ ...header, gstType: e.target.value })}
                          options={GST_TYPE_OPTIONS}
                          disabled={locked}
                        />
                      </div>
                      <div className="classic-erp-field col-span-2">
                        <span className="classic-erp-label">Gstin</span>
                        <input
                          type="text"
                          className="classic-erp-input font-mono uppercase"
                          value={header.gstin}
                          readOnly
                          placeholder="—"
                        />
                      </div>
                    </div>

                    <div className="erp-job-issue-tax-panel mt-2">
                      <div className="classic-erp-totals">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Tax Rate %</div>
                        <input
                          type="number"
                          className="classic-erp-input text-center font-bold"
                          value={footer.taxRate}
                          onChange={(e) => setFooter({ ...footer, taxRate: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1 border-r pr-2 border-slate-200">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">SGST ({calc.sgstPct}%):</span>
                          <span className="font-mono font-bold">₹{calc.sgstAmt.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">CGST ({calc.cgstPct}%):</span>
                          <span className="font-mono font-bold">₹{calc.cgstAmt.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">IGST ({calc.igstPct}%):</span>
                          <span className="font-mono font-bold">₹{calc.igstAmt.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="erp-job-issue-totals pl-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Taxable:</span>
                          <span className="font-mono font-bold">₹{calc.gross.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">GstAmt:</span>
                          <span className="font-mono font-bold text-slate-700">₹{calc.totalGst.toFixed(2)}</span>
                        </div>
                        <div className="erp-job-issue-final-row border-t pt-1 mt-1">
                          <span className="text-blue-900">NetAmt:</span>
                          <span className="font-mono text-blue-900 text-[14px]">₹{calc.net.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {!locked && (
                  <div className="erp-job-issue-toolbar">
                    <button type="button" className="classic-erp-btn" onClick={addLine}>
                      <Plus size={12} className="inline mr-0.5" /> Add Line
                    </button>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      Grid Row Count: {lines.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Grid */}
              <div className="classic-erp-frame erp-job-issue-grid-wrap flex-1 min-h-[220px] flex flex-col">
                <div className="classic-erp-table-container erp-job-issue-grid flex-1 overflow-auto">
                  <table className="classic-erp-table erp-job-issue-table w-full">
                    <thead>
                      <tr>
                        <th className="w-8">Sno</th>
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
                          <td className="text-center text-slate-500 font-bold">{idx + 1}</td>
                          {gridCols.map((c) => {
                            if (c.key === 'lotNo') {
                              return (
                                <td key={c.key} className={c.w}>
                                  <button
                                    type="button"
                                    className="classic-erp-input w-full text-left font-bold truncate disabled:cursor-default"
                                    onClick={() => openLotLookup(idx)}
                                    disabled={locked}
                                    title="Pick which weaver lot to issue"
                                  >
                                    {line.lotNo || '— Select Lot —'}
                                  </button>
                                </td>
                              );
                            }
                            return (
                              <td key={c.key} className={c.w}>
                                <input
                                  type={c.align === 'right' ? 'number' : 'text'}
                                  step={c.key === 'cut' ? '0.001' : c.key === 'qty' ? '0.01' : undefined}
                                  className={`classic-erp-input w-full ${c.align === 'right' ? 'text-right font-mono' : ''} ${c.readOnly ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                  value={line[c.key] || ''}
                                  onChange={(e) => setLine(idx, { [c.key]: e.target.value })}
                                  readOnly={c.readOnly || locked}
                                  disabled={c.readOnly || locked}
                                />
                              </td>
                            );
                          })}
                          {!locked && (
                            <td className="text-center">
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-800 disabled:opacity-30"
                                onClick={() => removeLine(idx)}
                                disabled={locked}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="classic-erp-frame erp-job-issue-footer-grid shrink-0">
                <div className="classic-erp-stack">
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
                  <div className="classic-erp-field mt-1">
                    <span className="classic-erp-label">Transport</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.transport}
                      onChange={(e) => setFooter({ ...footer, transport: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>

                <div className="classic-erp-stack">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Note</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.note}
                      onChange={(e) => setFooter({ ...footer, note: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="classic-erp-field mt-1">
                    <span className="classic-erp-label">LrNo</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.lrNo}
                      onChange={(e) => setFooter({ ...footer, lrNo: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>

                <div className="classic-erp-stack justify-end">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">BaleNo</span>
                    <input
                      type="text"
                      className="classic-erp-input text-center font-bold"
                      value={footer.baleNo}
                      onChange={(e) => setFooter({ ...footer, baleNo: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="classic-erp-form-footer erp-job-issue-footer shrink-0">
                <button type="button" className="classic-erp-btn" onClick={handleNew} disabled={saving}>
                  New
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={handleEdit}
                  disabled={saving || mode !== 'View' || !selectedJobId}
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
                <button type="button" className="classic-erp-btn btn-red" disabled={saving || locked || !selectedJobId}>
                  Delete
                </button>
                <button type="button" className="classic-erp-btn" onClick={handlePrint} disabled={!selectedJobId}>
                  Print
                </button>
                <button type="button" className="classic-erp-btn" onClick={onClose}>
                  Exit
                </button>
              </div>
            </form>
          </div>
        )}
      </ErpWindowedModal>

      <PuBillLookupModal
        isOpen={lotLookupOpen}
        onClose={() => setLotLookupOpen(false)}
        weaver=""
        inventoryLots={inventoryLots}
        purchases={purchases}
        items={items}
        onSelect={handleLotSelect}
      />
    </>
  );
}
