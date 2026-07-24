import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPSelect } from '../../components/forms/FormElements';
import { ERPCombobox } from '../../components/erp';
import useStore from '../../store/useStore';
import { useConfig } from '../../context/ConfigContext';
import { buildBillFieldVisibility } from '../../utils/configHelpers';
import { toast } from '../../store/useToastStore';
import { Plus } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const today = () => new Date().toISOString().split('T')[0];

const PROCESS_TYPES = [
  'Dyeing',
  'Printing',
  'Finishing',
  'Bleaching',
  'Sizing',
  'Mercerizing',
  'Stentering',
  'Other',
];

const emptyHeader = (book) => ({
  challanNo: 'AUTO',
  date: today(),
  workerId: '',
  gstin: '',
  address: '',
  processType: 'Dyeing',
  reFinish: false,
  broker: '',
  book: book || 'PROCESS ISSUE BOOK',
});

const emptyFooter = () => ({
  remark: '',
  transport: '',
  lrNo: '',
  baleNo: '',
  chargesRate: '',
});

/**
 * Mill Issue — grey / stock lot nikal ke job worker / mill pe bhejna.
 * Backend requires: lotId, workerId, processType, issueQty, issuePcs.
 */
const IssueModal = ({ isOpen, onClose, selectedBook = null }) => {
  const {
    parties,
    inventoryLots,
    jobWorkEntries,
    fetchParties,
    fetchInventory,
    fetchJobs,
    issueToMill,
  } = useStore();
  const { bundle } = useConfig();
  const f = useMemo(() => buildBillFieldVisibility(bundle, 'millIssue'), [bundle]);

  const [mode, setMode] = useState('Add'); // Add | View
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [header, setHeader] = useState(emptyHeader(selectedBook));
  const [footer, setFooter] = useState(emptyFooter());
  const [selectedLotId, setSelectedLotId] = useState('');
  const [issuePcs, setIssuePcs] = useState('');
  const [issueQty, setIssueQty] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [accountModal, setAccountModal] = useState({ open: false, initialData: null });

  const locked = mode === 'View';

  useEffect(() => {
    if (!isOpen) {
      setBootLoading(false);
      return;
    }
    let cancelled = false;
    setBootLoading(true);
    Promise.all([fetchParties(), fetchInventory(), fetchJobs()])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    handleNew();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedBook]);

  const workers = useMemo(
    () =>
      parties.filter((p) => {
        const type = String(p.type || '');
        const group = String(p.group || '').toUpperCase();
        return (
          type === 'Job Worker' ||
          type === 'Both' ||
          group.includes('JOB') ||
          group.includes('WORKER') ||
          group.includes('MILL')
        );
      }),
    [parties]
  );

  const workerOptions = useMemo(
    () => workers.map((w) => ({ value: w._id || w.id, label: w.name })),
    [workers]
  );

  const jobOptions = useMemo(
    () =>
      jobWorkEntries.map((j) => ({
        value: j._id || j.id,
        label: `${j.jobCardNo || j.challanNo} · ${j.workerId?.name || 'Party'} · ${j.processType || '-'} · ${Number(j.issueQty || 0).toFixed(2)} mts`,
      })),
    [jobWorkEntries]
  );

  const availableLots = useMemo(
    () =>
      (inventoryLots || []).filter(
        (lot) =>
          Number(lot.remainingMtrs || 0) > 0 &&
          lot.status !== 'Closed' &&
          (lot.holdStatus === 'None' || !lot.holdStatus)
      ),
    [inventoryLots]
  );

  const lotOptions = useMemo(
    () =>
      availableLots.map((lot) => {
        const id = lot._id || lot.id;
        const name = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || 'Item';
        return {
          value: id,
          label: `${lot.lotId || id.slice(-6)} · ${name} · Bal ${Number(lot.remainingMtrs || 0).toFixed(2)} mts / ${lot.remainingPcs || 0} pcs`,
        };
      }),
    [availableLots]
  );

  const processOptions = useMemo(
    () => PROCESS_TYPES.map((p) => ({ value: p, label: p })),
    []
  );

  const selectedLot = useMemo(
    () => availableLots.find((l) => (l._id || l.id) === selectedLotId) || null,
    [availableLots, selectedLotId]
  );

  const handleNew = () => {
    setMode('Add');
    setHeader(emptyHeader(selectedBook));
    setFooter(emptyFooter());
    setSelectedLotId('');
    setIssuePcs('');
    setIssueQty('');
    setSelectedJobId('');
  };

  const handlePartyChange = (id) => {
    const p = workers.find((w) => (w._id || w.id) === id) || parties.find((w) => (w._id || w.id) === id);
    setHeader((h) => ({
      ...h,
      workerId: id,
      gstin: p?.gstin || '',
      address: p?.address || p?.city || '',
    }));
  };

  const handleCreateMillParty = (search = '') => {
    setAccountModal({
      open: true,
      initialData: {
        name: search || '',
        group: 'JOB WORKER',
      },
    });
  };

  const handleMillPartySuccess = (newAccount) => {
    fetchParties();
    const id = newAccount._id || newAccount.id;
    setHeader((h) => ({
      ...h,
      workerId: id,
      gstin: newAccount.gstin || '',
      address: newAccount.address || newAccount.city || newAccount.station || '',
    }));
    setAccountModal({ open: false, initialData: null });
    toast.success(`Mill party "${newAccount.name}" added`);
  };

  const handleSelectLot = (lotId) => {
    setSelectedLotId(lotId);
    const lot = availableLots.find((l) => (l._id || l.id) === lotId);
    if (lot) {
      setIssuePcs(String(lot.remainingPcs || 0));
      setIssueQty(String(lot.remainingMtrs || 0));
    } else {
      setIssuePcs('');
      setIssueQty('');
    }
  };

  const handleSelectJob = (id) => {
    setSelectedJobId(id);
    if (!id) return;
    const job = jobWorkEntries.find((j) => (j._id || j.id) === id);
    if (!job) return;
    setMode('View');
    setHeader({
      challanNo: job.jobCardNo || job.challanNo || '',
      date: job.date ? String(job.date).slice(0, 10) : today(),
      workerId: job.workerId?._id || job.workerId || '',
      gstin: job.workerId?.gstin || '',
      address: '',
      processType: job.processType || 'Dyeing',
      reFinish: !!job.reFinish,
      broker: job.broker || '',
      book: selectedBook || 'PROCESS ISSUE BOOK',
    });
    setSelectedLotId(job.lotId?._id || job.lotId || '');
    setIssuePcs(String(job.issuePcs || 0));
    setIssueQty(String(job.issueQty || 0));
    setFooter({
      remark: job.remarks || job.remark || '',
      transport: job.transport || '',
      lrNo: job.lrNo || '',
      baleNo: job.baleNo || '',
      chargesRate: job.chargesRate != null ? String(job.chargesRate) : '',
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (locked) return;
    if (!header.workerId) return toast.error('Select Mill / Job Party');
    if (!selectedLotId) return toast.error('Select a stock lot to issue');
    const qty = Number(issueQty);
    const pcs = Number(issuePcs || 0);
    if (!qty || qty <= 0) return toast.error('Enter issue quantity (Mts/Kgs)');
    if (selectedLot && qty > Number(selectedLot.remainingMtrs || 0) + 0.0001) {
      return toast.error(
        `Qty exceeds available stock (${Number(selectedLot.remainingMtrs || 0).toFixed(2)})`
      );
    }

    setSaving(true);
    try {
      const itemId =
        selectedLot?.itemId?._id || selectedLot?.itemId || selectedLot?.item?._id || null;
      await issueToMill({
        jobCardNo: header.challanNo === 'AUTO' ? 'AUTO' : header.challanNo,
        date: header.date,
        lotId: selectedLotId,
        itemId,
        workerId: header.workerId,
        processType: header.processType,
        issueQty: qty,
        issuePcs: pcs,
        chargesRate: Number(footer.chargesRate || 0),
        reFinish: header.reFinish,
        broker: header.broker || undefined,
        remarks: footer.remark || undefined,
        transport: footer.transport || undefined,
        lrNo: footer.lrNo || undefined,
        baleNo: footer.baleNo || undefined,
      });
      toast.success('Mill Issue saved — stock reduced from lot');
      await Promise.all([fetchJobs(), fetchInventory()]);
      handleNew();
      setMode('View');
    } catch (err) {
      toast.error(err, { fallback: 'Failed to save mill issue' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-6xl">
      <div className="classic-erp-window erp-density flex flex-col h-full">
        <ErpBusyOverlay show={bootLoading} message="Loading mill issue…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Saving mill issue…" />
        <div className="classic-erp-header">
          <span>Mill Issue [ {selectedBook || 'PROCESS ISSUE BOOK'} ]</span>
          <button type="button" className="classic-erp-close-btn" onClick={onClose}>
            X
          </button>
        </div>

        <div className="classic-erp-body flex-1 overflow-y-auto space-y-3">
          {mode === 'View' && (
            <div className="classic-erp-frame classic-erp-field classic-erp-field--lg">
              <span className="classic-erp-label blue-label">Find Issue:</span>
              <ERPSelect
                className="classic-erp-select flex-1"
                value={selectedJobId}
                onChange={(e) => handleSelectJob(e.target.value)}
                options={jobOptions}
                placeholder="- Select Mill / Job Issue -"
                recentKey="mill-issue-job"
              />
            </div>
          )}

          {/* Header */}
          <div className="classic-erp-frame classic-erp-header-split">
            <div className="classic-erp-stack">
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label red-label">Mill Party:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, width: '100%' }}>
                  <ERPCombobox
                    value={header.workerId}
                    onChange={(val) => handlePartyChange(val)}
                    disabled={locked}
                    options={workerOptions}
                    placeholder={workerOptions.length ? 'Search Job Worker / Mill…' : 'No mill party — click Add'}
                    recentKey="mill-party"
                    onCreateNew={!locked ? handleCreateMillParty : undefined}
                    createLabel="Mill Party"
                    emptyMessage="No mill / job worker found. Click Add"
                    allowClear
                  />
                  {!locked && (
                    <button
                      type="button"
                      title="Add new Mill / Job Worker"
                      onClick={() => handleCreateMillParty('')}
                      style={{
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                        background: '#16a34a',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Plus size={11} /> Add
                    </button>
                  )}
                </div>
              </div>
              <div className="classic-erp-meta-grid">
                {f.header('gstin') && (
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Gstin:</span>
                  <input type="text" className="classic-erp-input" value={header.gstin} readOnly />
                </div>
                )}
                {f.header('address') && (
                <div className="classic-erp-field">
                  <span className="classic-erp-label">City:</span>
                  <input type="text" className="classic-erp-input" value={header.address} readOnly />
                </div>
                )}
              </div>
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label">Process:</span>
                <ERPSelect
                  className="classic-erp-select flex-1"
                  value={header.processType}
                  onChange={(e) => setHeader((h) => ({ ...h, processType: e.target.value }))}
                  disabled={locked}
                  options={processOptions}
                  placeholder="Process type"
                />
              </div>
              {f.header('broker') && (
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label">Broker:</span>
                <input
                  type="text"
                  className="classic-erp-input"
                  value={header.broker}
                  onChange={(e) => setHeader((h) => ({ ...h, broker: e.target.value }))}
                  disabled={locked}
                />
              </div>
              )}
            </div>

            <div className="classic-erp-stack">
              <div className="classic-erp-meta-grid">
                <div className="classic-erp-field">
                  <span className="classic-erp-label red-label">Challan:</span>
                  <input type="text" className="classic-erp-input" value={header.challanNo} readOnly />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Date:</span>
                  <input
                    type="date"
                    className="classic-erp-input"
                    value={header.date}
                    onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))}
                    disabled={locked}
                  />
                </div>
              </div>
              {f.header('reFinish') && (
              <label className="flex items-center gap-2 px-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={header.reFinish}
                  onChange={(e) => setHeader((h) => ({ ...h, reFinish: e.target.checked }))}
                  disabled={locked}
                />
                Re-Finish (same lot re-process)
              </label>
              )}
            </div>
          </div>

          {/* Stock lot picker */}
          <div className="classic-erp-frame classic-erp-stack">
            <span className="classic-erp-frame-title">Select Stock Lot (Inventory → Issue)</span>
            <div className="classic-erp-field classic-erp-field--lg">
              <span className="classic-erp-label red-label">Lot:</span>
              <ERPSelect
                className="classic-erp-select flex-1"
                value={selectedLotId}
                onChange={(e) => handleSelectLot(e.target.value)}
                disabled={locked}
                options={lotOptions}
                placeholder="- Available lots -"
                recentKey="mill-issue-lot"
              />
            </div>

            {selectedLot && (
              <div className="classic-erp-meta-grid--3 text-[11px] px-1">
                <div>
                  <span className="text-[var(--text-muted)]">Item </span>
                  <b>{selectedLot.itemName || selectedLot.itemId?.name || '—'}</b>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Available </span>
                  <b>
                    {Number(selectedLot.remainingMtrs || 0).toFixed(2)} mts ·{' '}
                    {selectedLot.remainingPcs || 0} pcs
                  </b>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Source </span>
                  <b>{selectedLot.source || '—'}</b>
                </div>
              </div>
            )}

            <div className="classic-erp-meta-grid">
              <div className="classic-erp-field">
                <span className="classic-erp-label">Issue Pcs:</span>
                <input
                  type="number"
                  className="classic-erp-input text-center"
                  value={issuePcs}
                  onChange={(e) => setIssuePcs(e.target.value)}
                  disabled={locked || !selectedLotId}
                />
              </div>
              <div className="classic-erp-field">
                <span className="classic-erp-label red-label">Issue Qty:</span>
                <input
                  type="number"
                  className="classic-erp-input text-right font-bold"
                  value={issueQty}
                  onChange={(e) => setIssueQty(e.target.value)}
                  disabled={locked || !selectedLotId}
                  placeholder="Mts / Kgs"
                />
              </div>
              {f.line('chargesRate') && (
              <div className="classic-erp-field">
                <span className="classic-erp-label">Job Rate:</span>
                <input
                  type="number"
                  className="classic-erp-input text-right"
                  value={footer.chargesRate}
                  onChange={(e) => setFooter((f) => ({ ...f, chargesRate: e.target.value }))}
                  disabled={locked}
                  placeholder="₹ / mtr"
                />
              </div>
              )}
            </div>
          </div>

          {/* Transport / remarks */}
          {(f.footer('transport') || f.footer('lrNo') || f.footer('baleNo') || f.footer('remark')) && (
          <div className="classic-erp-frame classic-erp-meta-grid--3">
            {f.footer('transport') && (
            <div className="classic-erp-field">
              <span className="classic-erp-label">Transport:</span>
              <input
                type="text"
                className="classic-erp-input"
                value={footer.transport}
                onChange={(e) => setFooter((f) => ({ ...f, transport: e.target.value }))}
                disabled={locked}
              />
            </div>
            )}
            {f.footer('lrNo') && (
            <div className="classic-erp-field">
              <span className="classic-erp-label">Lr No:</span>
              <input
                type="text"
                className="classic-erp-input"
                value={footer.lrNo}
                onChange={(e) => setFooter((f) => ({ ...f, lrNo: e.target.value }))}
                disabled={locked}
              />
            </div>
            )}
            {f.footer('baleNo') && (
            <div className="classic-erp-field">
              <span className="classic-erp-label">Bale No:</span>
              <input
                type="text"
                className="classic-erp-input"
                value={footer.baleNo}
                onChange={(e) => setFooter((f) => ({ ...f, baleNo: e.target.value }))}
                disabled={locked}
              />
            </div>
            )}
            {f.footer('remark') && (
            <div className="classic-erp-field classic-erp-field--lg" style={{ gridColumn: '1 / -1' }}>
              <span className="classic-erp-label">Remark:</span>
              <input
                type="text"
                className="classic-erp-input"
                value={footer.remark}
                onChange={(e) => setFooter((f) => ({ ...f, remark: e.target.value }))}
                disabled={locked}
              />
            </div>
            )}
          </div>
          )}

          {/* Recent issues mini list when viewing */}
          {mode === 'View' && !selectedJobId && (
            <div className="classic-erp-table-container max-h-48">
              <table className="classic-erp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Challan</th>
                    <th>Party</th>
                    <th>Process</th>
                    <th className="text-right">Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {jobWorkEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-[var(--text-muted)] py-6">
                        No mill issues yet — click New to create.
                      </td>
                    </tr>
                  ) : (
                    jobWorkEntries.slice(0, 40).map((j) => (
                      <tr
                        key={j._id || j.id}
                        className="cursor-pointer hover:bg-[var(--bg-subtle)]"
                        onClick={() => handleSelectJob(j._id || j.id)}
                      >
                        <td className="font-mono">
                          {new Date(j.date || j.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="font-bold text-blue-900">{j.jobCardNo}</td>
                        <td>{j.workerId?.name || '—'}</td>
                        <td>{j.processType || '—'}</td>
                        <td className="text-right font-mono">{Number(j.issueQty || 0).toFixed(2)}</td>
                        <td
                          style={{
                            color: j.status === 'Received' ? 'green' : 'brown',
                            fontWeight: 700,
                          }}
                        >
                          {j.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="classic-erp-form-footer">
          <button
            type="button"
            className="classic-erp-btn"
            onClick={handleNew}
            disabled={saving}
          >
            <Plus size={12} strokeWidth={3} /> New
          </button>
          <button
            type="button"
            className="classic-erp-btn btn-blue"
            onClick={handleSave}
            disabled={locked || saving}
          >
            <SaveButtonLabel saving={saving} idle="Save & Issue" busy="Saving…" />
          </button>
          <button
            type="button"
            className="classic-erp-btn"
            onClick={() => {
              setMode('View');
              setSelectedJobId('');
            }}
            disabled={saving}
          >
            Find
          </button>
          <button type="button" className="classic-erp-btn" onClick={onClose}>
            Exit
          </button>
        </div>
      </div>
    </Modal>

    <AccountMasterModal
      isOpen={accountModal.open}
      onClose={() => setAccountModal({ open: false, initialData: null })}
      initialData={accountModal.initialData}
      onSuccess={handleMillPartySuccess}
    />
    </>
  );
};

export default IssueModal;
