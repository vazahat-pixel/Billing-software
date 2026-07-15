import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { Plus } from 'lucide-react';

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

  const [mode, setMode] = useState('Add'); // Add | View
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState(emptyHeader(selectedBook));
  const [footer, setFooter] = useState(emptyFooter());
  const [selectedLotId, setSelectedLotId] = useState('');
  const [issuePcs, setIssuePcs] = useState('');
  const [issueQty, setIssueQty] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');

  const locked = mode === 'View';

  useEffect(() => {
    if (!isOpen) return;
    fetchParties();
    fetchInventory();
    fetchJobs();
    handleNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedBook]);

  const workers = useMemo(
    () => parties.filter((p) => p.type === 'Job Worker' || p.type === 'Both'),
    [parties]
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
    const p = workers.find((w) => (w._id || w.id) === id);
    setHeader((h) => ({
      ...h,
      workerId: id,
      gstin: p?.gstin || '',
      address: p?.address || p?.city || '',
    }));
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
      toast.error(err.response?.data?.message || err.message || 'Failed to save mill issue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-6xl">
      <div className="classic-erp-window flex flex-col h-full">
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
              <select
                className="classic-erp-select"
                value={selectedJobId}
                onChange={(e) => handleSelectJob(e.target.value)}
              >
                <option value="">- Select Mill / Job Issue -</option>
                {jobWorkEntries.map((j) => (
                  <option key={j._id || j.id} value={j._id || j.id}>
                    {j.jobCardNo || j.challanNo} · {j.workerId?.name || 'Party'} ·{' '}
                    {j.processType || '-'} · {Number(j.issueQty || 0).toFixed(2)} mts
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Header */}
          <div className="classic-erp-frame classic-erp-header-split">
            <div className="classic-erp-stack">
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label red-label">Mill Party:</span>
                <select
                  className="classic-erp-select font-bold"
                  value={header.workerId}
                  onChange={(e) => handlePartyChange(e.target.value)}
                  disabled={locked}
                >
                  <option value="">- Select Job Worker / Mill -</option>
                  {workers.map((w) => (
                    <option key={w._id || w.id} value={w._id || w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="classic-erp-meta-grid">
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Gstin:</span>
                  <input type="text" className="classic-erp-input" value={header.gstin} readOnly />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">City:</span>
                  <input type="text" className="classic-erp-input" value={header.address} readOnly />
                </div>
              </div>
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label">Process:</span>
                <select
                  className="classic-erp-select"
                  value={header.processType}
                  onChange={(e) => setHeader((h) => ({ ...h, processType: e.target.value }))}
                  disabled={locked}
                >
                  {PROCESS_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
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
              <label className="flex items-center gap-2 px-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={header.reFinish}
                  onChange={(e) => setHeader((h) => ({ ...h, reFinish: e.target.checked }))}
                  disabled={locked}
                />
                Re-Finish (same lot re-process)
              </label>
            </div>
          </div>

          {/* Stock lot picker */}
          <div className="classic-erp-frame classic-erp-stack">
            <span className="classic-erp-frame-title">Select Stock Lot (Inventory → Issue)</span>
            <div className="classic-erp-field classic-erp-field--lg">
              <span className="classic-erp-label red-label">Lot:</span>
              <select
                className="classic-erp-select"
                value={selectedLotId}
                onChange={(e) => handleSelectLot(e.target.value)}
                disabled={locked}
              >
                <option value="">- Available lots -</option>
                {availableLots.map((lot) => {
                  const id = lot._id || lot.id;
                  const name = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || 'Item';
                  return (
                    <option key={id} value={id}>
                      {lot.lotId || id.slice(-6)} · {name} · Bal{' '}
                      {Number(lot.remainingMtrs || 0).toFixed(2)} mts / {lot.remainingPcs || 0} pcs
                    </option>
                  );
                })}
              </select>
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
            </div>
          </div>

          {/* Transport / remarks */}
          <div className="classic-erp-frame classic-erp-meta-grid--3">
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
          </div>

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
            {saving ? 'Saving…' : 'Save & Issue'}
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
  );
};

export default IssueModal;
