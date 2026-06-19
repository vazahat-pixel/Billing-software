import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';

const STATUSES = ['Issued', 'In-Process', 'Received', 'Cancelled'];

const ProcessUpdateModal = ({ isOpen, onClose }) => {
  const { jobWorkEntries, fetchJobs, updateJobProcess } = useStore();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [status, setStatus] = useState('In-Process');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) fetchJobs();
  }, [isOpen, fetchJobs]);

  const activeJobs = useMemo(
    () => jobWorkEntries.filter((j) => j.status !== 'Cancelled'),
    [jobWorkEntries]
  );

  const selectedJob = useMemo(
    () => jobWorkEntries.find((j) => j._id === selectedJobId),
    [selectedJobId, jobWorkEntries]
  );

  useEffect(() => {
    if (selectedJob) setStatus(selectedJob.status || 'Issued');
  }, [selectedJob]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedJobId) return alert('Select a job card');
    setSaving(true);
    try {
      await updateJobProcess(selectedJobId, status);
      alert('Job status updated');
      setSelectedJobId('');
      fetchJobs();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Job Status" className="max-w-3xl">
      <form onSubmit={handleSave} className="erp-modal-body space-y-4">
        <div className="erp-field">
          <label className="erp-label">Job Card</label>
          <select
            className="erp-select"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            required
          >
            <option value="">— Select job card —</option>
            {activeJobs.map((j) => (
              <option key={j._id} value={j._id}>
                {j.jobCardNo} — {j.workerId?.name || 'Worker'} ({j.status})
              </option>
            ))}
          </select>
        </div>

        {selectedJob && (
          <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
            <div><span className="text-[var(--text-muted)]">Process:</span> <strong>{selectedJob.processType}</strong></div>
            <div><span className="text-[var(--text-muted)]">Issued:</span> <strong>{selectedJob.issueQty} mts</strong></div>
            <div><span className="text-[var(--text-muted)]">Lot:</span> <strong>{selectedJob.lotId?.lotId || '—'}</strong></div>
            <div><span className="text-[var(--text-muted)]">Current:</span> <strong>{selectedJob.status}</strong></div>
          </div>
        )}

        <div className="erp-field">
          <label className="erp-label">New Status</label>
          <select className="erp-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="erp-btn erp-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="erp-btn erp-btn-primary" disabled={saving || !selectedJobId}>
            {saving ? 'Saving...' : 'Update Status'}
          </button>
        </div>
      </form>

      <div className="border-t border-[var(--border)] mt-2">
        <p className="px-4 py-2 text-[10px] font-bold uppercase text-[var(--text-muted)]">All Job Cards</p>
        <div className="max-h-48 overflow-y-auto px-4 pb-4">
          <table className="w-full text-[11px]">
            <thead className="text-[9px] uppercase text-[var(--text-muted)]">
              <tr>
                <th className="text-left py-1">Card</th>
                <th className="text-left py-1">Worker</th>
                <th className="text-left py-1">Process</th>
                <th className="text-right py-1">Qty</th>
                <th className="text-center py-1">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {jobWorkEntries.map((j) => (
                <tr key={j._id} className="hover:bg-[var(--bg-base)] cursor-pointer" onClick={() => setSelectedJobId(j._id)}>
                  <td className="py-1.5 font-semibold">{j.jobCardNo}</td>
                  <td className="py-1.5">{j.workerId?.name || '—'}</td>
                  <td className="py-1.5">{j.processType}</td>
                  <td className="py-1.5 text-right">{j.issueQty}</td>
                  <td className="py-1.5 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--bg-base)]">{j.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default ProcessUpdateModal;
