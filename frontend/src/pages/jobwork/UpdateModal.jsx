import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ERPSelect } from '../../components/forms/FormElements';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { Plus } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import WeaverLookupModal from './WeaverLookupModal';
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

const PROCESS_TYPES = [
  'Process Charge',
  'Dyeing',
  'Printing',
  'Finishing',
  'Bleaching',
  'Sizing',
  'Embroidery',
  'Other',
];

const FINISH_OPTIONS = [
  { value: '', label: '- Select Finish -' },
  { value: 'Soft', label: 'Soft' },
  { value: 'Hard', label: 'Hard' },
  { value: 'Peach', label: 'Peach' },
  { value: 'Brush', label: 'Brush' },
  { value: 'Water Proof', label: 'Water Proof' },
  { value: 'Other', label: 'Other' },
];

const emptyForm = (book) => ({
  challanNo: 'AUTO',
  date: today(),
  millId: '',
  weaver: '',
  puBillNo: '',
  itemName: '',
  issPcs: '',
  issQty: '',
  puRate: '',
  jobRate: '',
  lotId: '',
  remark1: '',
  remark2: '',
  procType: 'Process Charge',
  finish: '',
  book: book || 'PROCESS CHARGE',
});

/**
 * Job Issue [ PROCESS CHARGE ] — same fields as classic textile ERP (no extras).
 */
const UpdateModal = ({ isOpen, onClose, selectedBook = null }) => {
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
  const [form, setForm] = useState(emptyForm(selectedBook));
  const [selectedJobId, setSelectedJobId] = useState('');
  const [lotSort, setLotSort] = useState('asc'); // asc | desc
  const [accountModal, setAccountModal] = useState({ open: false, initialData: null });
  const [findOpen, setFindOpen] = useState(false);
  const [weaverLookupOpen, setWeaverLookupOpen] = useState(false);
  const [puBillLookupOpen, setPuBillLookupOpen] = useState(false);

  const locked = mode === 'View';

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const mills = useMemo(
    () =>
      parties.filter((p) => {
        const type = String(p.type || '');
        const group = String(p.group || '').toUpperCase();
        return (
          type === 'Job Worker' ||
          type === 'Both' ||
          group.includes('JOB') ||
          group.includes('WORKER') ||
          group.includes('MILL') ||
          group.includes('PROCESS')
        );
      }),
    [parties]
  );

  const millOptions = useMemo(
    () => mills.map((m) => ({ value: m._id || m.id, label: m.name })),
    [mills]
  );

  const availableLots = useMemo(() => {
    const open = (inventoryLots || []).filter(
      (lot) =>
        Number(lot.remainingMtrs || 0) > 0 &&
        lot.status !== 'Closed' &&
        (lot.holdStatus === 'None' || !lot.holdStatus)
    );
    const sorted = [...open].sort((a, b) => {
      const la = String(a.lotId || '');
      const lb = String(b.lotId || '');
      return lotSort === 'asc' ? la.localeCompare(lb) : lb.localeCompare(la);
    });
    return sorted;
  }, [inventoryLots, lotSort]);

  const lotOptions = useMemo(
    () =>
      availableLots.map((lot) => {
        const id = lot._id || lot.id;
        const name = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || 'Item';
        return {
          value: id,
          label: `${lot.lotId || id.slice(-6)} · ${name} · ${Number(lot.remainingMtrs || 0).toFixed(2)} mts`,
        };
      }),
    [availableLots]
  );

  const processOptions = useMemo(
    () => PROCESS_TYPES.map((p) => ({ value: p, label: p })),
    []
  );

  const selectedLot = useMemo(
    () => availableLots.find((l) => String(l._id || l.id) === String(form.lotId)) || null,
    [availableLots, form.lotId]
  );

  const jobOptions = useMemo(() => {
    const list = [...(jobWorkEntries || [])];
    list.sort((a, b) => {
      const da = new Date(a.issueDate || a.createdAt || 0).getTime();
      const db = new Date(b.issueDate || b.createdAt || 0).getTime();
      return lotSort === 'asc' ? da - db : db - da;
    });
    return list.map((j) => ({
      value: j._id || j.id,
      label: `${j.challanNo || j.jobCardNo || '-'} · ${j.workerId?.name || 'Mill'} · ${Number(j.issueQty || 0).toFixed(2)} mts`,
    }));
  }, [jobWorkEntries, lotSort]);

  const resetForm = useCallback(() => {
    setForm(emptyForm(selectedBook));
    setSelectedJobId('');
    setFindOpen(false);
  }, [selectedBook]);

  useEffect(() => {
    if (!isOpen) {
      setBootLoading(false);
      return undefined;
    }
    let cancelled = false;
    setBootLoading(true);
    setMode('Add');
    resetForm();
    Promise.all([fetchParties(), fetchItems(), fetchPurchases(), fetchInventory(), fetchJobs()])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedBook, fetchParties, fetchItems, fetchPurchases, fetchInventory, fetchJobs, resetForm]);

  const applyPuBillRow = (row) => {
    if (!row) return;
    setForm((f) => ({
      ...f,
      puBillNo: row.billNo || f.puBillNo,
      itemName: row.itemName || f.itemName,
      lotId: row.lotId || f.lotId,
      issPcs: row.balPcs != null ? String(row.balPcs) : f.issPcs,
      issQty: row.balMts != null ? String(row.balMts) : f.issQty,
      puRate: row.puRate != null ? String(row.puRate) : f.puRate,
    }));
    toast.success(`Loaded ${row.billNo} · ${row.itemName}`);
  };

  const handleWeaverSelect = (party) => {
    const name = party?.name || '';
    setField('weaver', name);
    setWeaverLookupOpen(false);
    if (!locked) {
      setTimeout(() => setPuBillLookupOpen(true), 80);
    }
  };

  const openWeaverLookup = () => {
    if (locked) return;
    setWeaverLookupOpen(true);
  };

  const openPuBillLookup = () => {
    if (locked) return;
    if (!form.weaver?.trim()) {
      toast.warning('Select Weaver first');
      setWeaverLookupOpen(true);
      return;
    }
    setPuBillLookupOpen(true);
  };

  const applyLot = (lotId) => {
    const lot = availableLots.find((l) => String(l._id || l.id) === String(lotId));
    if (!lot) {
      setForm((f) => ({ ...f, lotId: '', itemName: '', issPcs: '', issQty: '', puRate: '' }));
      return;
    }
    const itemName = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || '';
    const puRate =
      lot.rate ??
      lot.purchaseRate ??
      lot.avgRate ??
      lot.itemId?.purchaseRate ??
      '';
    setForm((f) => ({
      ...f,
      lotId,
      itemName,
      issPcs: String(lot.remainingPcs ?? ''),
      issQty: String(lot.remainingMtrs ?? ''),
      puRate: puRate !== '' && puRate != null ? String(puRate) : f.puRate,
      puBillNo: f.puBillNo || lot.invoiceNo || lot.purchaseInvoiceNo || '',
    }));
  };

  const handleMillChange = (id) => {
    setField('millId', id);
  };

  const handleCreateMill = (search = '') => {
    setAccountModal({
      open: true,
      initialData: { name: search || '', group: 'JOB WORKER' },
    });
  };

  const handleMillSuccess = (party) => {
    fetchParties();
    setField('millId', party._id || party.id);
    setAccountModal({ open: false, initialData: null });
    toast.success(`Mill "${party.name}" added`);
  };

  const handleNew = () => {
    setMode('Add');
    resetForm();
  };

  const handleEdit = () => {
    if (!selectedJobId) return toast.warning('Find a challan first');
    setMode('Edit');
  };

  const handleCancel = () => {
    if (mode === 'Add') {
      resetForm();
      return;
    }
    setMode('View');
    if (selectedJobId) loadJob(selectedJobId);
  };

  const loadJob = (id) => {
    setSelectedJobId(id);
    if (!id) return;
    const job = jobWorkEntries.find((j) => String(j._id || j.id) === String(id));
    if (!job) return;
    setMode('View');
    setFindOpen(true);
    const remarks = String(job.remark || job.remarks || '');
    const [r1, ...rest] = remarks.split(/\n/);
    setForm({
      challanNo: job.challanNo || job.jobCardNo || '',
      date: job.issueDate ? String(job.issueDate).slice(0, 10) : today(),
      millId: job.workerId?._id || job.workerId || '',
      weaver: job.weaver || '',
      puBillNo: job.purchaseBillNo || '',
      itemName: job.lotId?.itemName || job.lotId?.itemId?.name || '',
      issPcs: String(job.issuePcs ?? ''),
      issQty: String(job.issueQty ?? ''),
      puRate: job.purchaseRate != null ? String(job.purchaseRate) : '',
      jobRate: job.jobRate != null ? String(job.jobRate) : String(job.processCharges || ''),
      lotId: job.lotId?._id || job.lotId || '',
      remark1: r1 || '',
      remark2: rest.join(' ') || '',
      procType: job.processType || 'Process Charge',
      finish: job.finish || '',
      book: selectedBook || 'PROCESS CHARGE',
    });
  };

  const handleJobCard = () => {
    if (locked) return;
    const seq = Math.floor(100000 + Math.random() * 900000);
    setField('challanNo', `JC-${seq}`);
    toast.info('Job Card No. assigned');
  };

  const handleSave = async (e, { keepOpen = false } = {}) => {
    if (e) e.preventDefault();
    if (locked) {
      toast.warning('Click Edit or New before saving');
      return false;
    }
    if (mode === 'Edit') {
      toast.warning('Issued challans cannot be edited — create New');
      return false;
    }
    if (!form.millId) {
      toast.error('Select Mill Name');
      return false;
    }
    if (!form.lotId) {
      toast.error('Select Lot No.');
      return false;
    }
    const qty = Number(form.issQty);
    const pcs = Number(form.issPcs || 0);
    if (!qty || qty <= 0) {
      toast.error('Enter Iss Qty');
      return false;
    }
    if (selectedLot && qty > Number(selectedLot.remainingMtrs || 0) + 0.0001) {
      toast.error(
        `Iss Qty exceeds stock (${Number(selectedLot.remainingMtrs || 0).toFixed(2)})`
      );
      return false;
    }

    setSaving(true);
    try {
      const remark = [form.remark1, form.remark2].filter(Boolean).join('\n');
      const millId = form.millId;
      const procType = form.procType;
      const finish = form.finish;
      const jobRate = form.jobRate;
      await issueToMill({
        jobCardNo: form.challanNo === 'AUTO' || !form.challanNo ? 'AUTO' : form.challanNo,
        challanNo: form.challanNo === 'AUTO' ? '' : form.challanNo,
        issueDate: form.date,
        date: form.date,
        lotId: form.lotId,
        workerId: form.millId,
        processType: form.procType || form.finish || 'Process Charge',
        finish: form.finish || '',
        issueQty: qty,
        issuePcs: pcs,
        weaver: form.weaver || '',
        purchaseBillNo: form.puBillNo || '',
        purchaseRate: Number(form.puRate) || 0,
        jobRate: Number(form.jobRate) || 0,
        processCharges: Number(form.jobRate) || 0,
        remark,
        remarks: remark,
      });
      toast.success('Job Issue saved');
      await Promise.all([fetchJobs(), fetchInventory()]);
      if (keepOpen) {
        setMode('Add');
        setForm({
          ...emptyForm(selectedBook),
          millId,
          procType,
          finish,
          jobRate,
        });
        setSelectedJobId('');
        toast.info('Ready for next challan (same mill)');
      } else {
        handleNew();
        setMode('View');
        setFindOpen(true);
      }
      return true;
    } catch (err) {
      toast.error(err, { fallback: 'Failed to save Job Issue' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    toast.warning('Delete issued challan from Job Receive / Cancel flow');
  };

  const handlePrint = () => {
    if (!selectedJobId) return toast.warning('Find a challan to print');
    toast.info('Print preview — use Job Receive / reports for full print');
  };

  const titleBook = selectedBook || 'PROCESS CHARGE';

  return (
    <>
      <ErpWindowedModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Job Issue [ ${titleBook} ]`}
        windowId="jobIssue"
        bare
      >
        {({ WindowControls }) => (
          <div className="classic-erp-window erp-density erp-job-issue-window flex flex-col h-full min-h-0 !max-h-none">
            <ErpBusyOverlay show={bootLoading} message="Loading job issue…" />
            <ErpBusyOverlay show={!bootLoading && saving} message="Saving job issue…" />

            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">
                Job Issue [ {titleBook} ]
              </span>
              <WindowControls />
            </div>

            <form
              onSubmit={(e) => handleSave(e)}
              className="classic-erp-body erp-job-issue-body flex-1 overflow-y-auto min-h-0"
            >
              <div className="classic-erp-frame erp-job-issue-split">
                <div className="classic-erp-stack erp-job-issue-main min-w-0">
                  {findOpen && (
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
                  )}

                  <div className="classic-erp-field">
                    <span className="classic-erp-label red-label">Challan No</span>
                    <input
                      type="text"
                      className="classic-erp-input font-bold"
                      value={form.challanNo}
                      onChange={(e) => setField('challanNo', e.target.value)}
                      disabled={locked}
                    />
                  </div>

                  <div className="classic-erp-field">
                    <span className="classic-erp-label red-label">Date</span>
                    <div className="classic-erp-control">
                      <input
                        type="date"
                        className="classic-erp-input erp-job-issue-date"
                        value={form.date}
                        onChange={(e) => setField('date', e.target.value)}
                        disabled={locked}
                        required
                      />
                      <span className="erp-job-issue-weekday">{weekday(form.date)}</span>
                    </div>
                  </div>

                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label red-label">MillName</span>
                    <div className="classic-erp-control">
                      <ERPCombobox
                        value={form.millId}
                        onChange={handleMillChange}
                        disabled={locked}
                        options={millOptions}
                        placeholder="Search Mill / Job Worker…"
                        recentKey="job-issue-mill"
                        onCreateNew={!locked ? handleCreateMill : undefined}
                        createLabel="Mill"
                        allowClear
                      />
                      {!locked && (
                        <button
                          type="button"
                          title="Add Mill"
                          onClick={() => handleCreateMill('')}
                          className="erp-job-issue-add-btn"
                        >
                          <Plus size={11} /> Add
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Weaver</span>
                    <div className="classic-erp-control">
                      <input
                        type="text"
                        className="classic-erp-input cursor-pointer"
                        value={form.weaver}
                        readOnly
                        onFocus={openWeaverLookup}
                        onClick={openWeaverLookup}
                        disabled={locked}
                        placeholder="Click to select weaver…"
                        title="Opens Account List — Enter to select Pu Bill"
                      />
                      {!locked && (
                        <button
                          type="button"
                          className="classic-erp-btn erp-job-issue-lookup-btn"
                          onClick={openWeaverLookup}
                          aria-label="Select weaver"
                        >
                          …
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Pu.BillNo</span>
                    <div className="classic-erp-control">
                      <input
                        type="text"
                        className="classic-erp-input cursor-pointer font-bold"
                        value={form.puBillNo}
                        readOnly
                        onFocus={openPuBillLookup}
                        onClick={openPuBillLookup}
                        disabled={locked}
                        placeholder="Select bill…"
                        title="Opens Purchase Bill list with balance"
                      />
                      {!locked && (
                        <button
                          type="button"
                          className="classic-erp-btn erp-job-issue-lookup-btn"
                          onClick={openPuBillLookup}
                          aria-label="Select purchase bill"
                        >
                          …
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label red-label">Item Name</span>
                    <input
                      type="text"
                      className="classic-erp-input font-bold uppercase"
                      value={form.itemName}
                      onChange={(e) => setField('itemName', e.target.value)}
                      disabled={locked}
                      readOnly
                      title="Filled from Lot No."
                    />
                  </div>

                  <div className="erp-job-issue-metrics">
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Iss Pcs</span>
                      <input
                        type="number"
                        className="classic-erp-input text-right font-bold"
                        value={form.issPcs}
                        onChange={(e) => setField('issPcs', e.target.value)}
                        disabled={locked}
                      />
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label red-label">Iss Qty</span>
                      <input
                        type="number"
                        step="0.001"
                        className="classic-erp-input text-right font-bold"
                        value={form.issQty}
                        onChange={(e) => setField('issQty', e.target.value)}
                        disabled={locked}
                        required
                      />
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Pu.Rate</span>
                      <input
                        type="number"
                        step="0.01"
                        className="classic-erp-input text-right"
                        value={form.puRate}
                        onChange={(e) => setField('puRate', e.target.value)}
                        disabled={locked}
                      />
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">JobRate</span>
                      <input
                        type="number"
                        step="0.01"
                        className="classic-erp-input text-right font-bold"
                        value={form.jobRate}
                        onChange={(e) => setField('jobRate', e.target.value)}
                        disabled={locked}
                      />
                    </div>
                    <div className="classic-erp-field erp-job-issue-lot">
                      <span className="classic-erp-label red-label">Lot No.</span>
                      <ERPCombobox
                        value={form.lotId}
                        onChange={(val) => applyLot(val)}
                        disabled={locked}
                        options={lotOptions}
                        placeholder="Select lot…"
                        recentKey="job-issue-lot"
                        allowClear
                      />
                    </div>
                  </div>

                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label">Remark</span>
                    <div className="classic-erp-control classic-erp-control--stack">
                      <input
                        type="text"
                        className="classic-erp-input"
                        value={form.remark1}
                        onChange={(e) => setField('remark1', e.target.value)}
                        disabled={locked}
                      />
                      <input
                        type="text"
                        className="classic-erp-input"
                        value={form.remark2}
                        onChange={(e) => setField('remark2', e.target.value)}
                        disabled={locked}
                      />
                    </div>
                  </div>

                  {selectedLot && (
                    <div className="erp-job-issue-stock">
                      Stock: {Number(selectedLot.remainingPcs || 0)} pcs ·{' '}
                      {Number(selectedLot.remainingMtrs || 0).toFixed(2)} mts
                    </div>
                  )}
                </div>

                <aside className="erp-job-issue-side">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">ProcType</span>
                    <ERPSelect
                      className="classic-erp-select"
                      value={form.procType}
                      onChange={(e) => setField('procType', e.target.value)}
                      options={processOptions}
                      disabled={locked}
                    />
                  </div>

                  <button
                    type="button"
                    className="classic-erp-btn"
                    onClick={handleJobCard}
                    disabled={locked}
                  >
                    Job Card
                  </button>

                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Finish</span>
                    <ERPSelect
                      className="classic-erp-select"
                      value={form.finish}
                      onChange={(e) => setField('finish', e.target.value)}
                      options={FINISH_OPTIONS}
                      disabled={locked}
                    />
                  </div>

                  <div className="erp-job-issue-sort">
                    <button
                      type="button"
                      className={`classic-erp-btn ${lotSort === 'asc' ? 'btn-blue' : ''}`}
                      onClick={() => setLotSort('asc')}
                    >
                      Asc
                    </button>
                    <button
                      type="button"
                      className={`classic-erp-btn ${lotSort === 'desc' ? 'btn-blue' : ''}`}
                      onClick={() => setLotSort('desc')}
                    >
                      Desc
                    </button>
                  </div>

                  <button
                    type="button"
                    className="classic-erp-btn"
                    disabled={locked || saving}
                    onClick={() => handleSave(null, { keepOpen: true })}
                  >
                    Create Multi Challan
                  </button>

                  <p className="erp-job-issue-hint">
                    F1 &gt; SelectAll / F2 &gt; UnSelectAll
                  </p>
                </aside>
              </div>

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
                <button type="button" className="classic-erp-btn" onClick={handleDelete} disabled={saving}>
                  Delete
                </button>
                <button type="button" className="classic-erp-btn" onClick={onClose} disabled={saving}>
                  Exit
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => toast.info('Open Job Receive for receipt detail')}
                >
                  ReceiptDetail
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => toast.info('Last year lot — use Lot No. search')}
                >
                  LastYearLot
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
              </div>
            </form>
          </div>
        )}
      </ErpWindowedModal>

      <AccountMasterModal
        isOpen={accountModal.open}
        onClose={() => setAccountModal({ open: false, initialData: null })}
        initialData={accountModal.initialData}
        onSuccess={handleMillSuccess}
      />

      <WeaverLookupModal
        isOpen={weaverLookupOpen}
        onClose={() => setWeaverLookupOpen(false)}
        parties={parties}
        onSelect={handleWeaverSelect}
      />

      <PuBillLookupModal
        isOpen={puBillLookupOpen}
        onClose={() => setPuBillLookupOpen(false)}
        weaver={form.weaver}
        inventoryLots={inventoryLots}
        purchases={purchases}
        items={items}
        onSelect={applyPuBillRow}
      />
    </>
  );
};

export default UpdateModal;
