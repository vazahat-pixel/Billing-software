import React, { useState, useEffect, useMemo } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import { ERPCombobox } from '../../components/erp';
import { ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const today = () => new Date().toISOString().split('T')[0];

const PROCESS_TYPES = ['Process Charge', 'Dyeing', 'Printing', 'Finishing', 'Bleaching', 'Sizing', 'Mercerizing', 'Stentering', 'Other'];

/** Issue Multiple — issue several grey lots to the same mill/process in one batch. */
const IssueMultipleModal = ({ isOpen, onClose }) => {
  const { parties, inventoryLots, fetchParties, fetchInventory, fetchJobs, issueToMill } = useStore();

  const [millId, setMillId] = useState('');
  const [procType, setProcType] = useState('Process Charge');
  const [date, setDate] = useState(today());
  const [jobRate, setJobRate] = useState('');
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setBootLoading(true);
    Promise.all([fetchParties(), fetchInventory()]).finally(() => setBootLoading(false));
    setMillId('');
    setJobRate('');
    setSelected({});
    setProgress(null);
  }, [isOpen, fetchParties, fetchInventory]);

  const mills = useMemo(
    () => (parties || []).filter((p) => ['Job Worker', 'Both'].includes(p.type) || (p.group || '').toUpperCase().includes('JOB')),
    [parties]
  );
  const millOptions = useMemo(() => mills.map((m) => ({ value: m._id || m.id, label: m.name })), [mills]);

  const availableLots = useMemo(
    () => (inventoryLots || []).filter((l) => Number(l.remainingMtrs || 0) > 0 && l.status !== 'Closed' && (!l.holdStatus || l.holdStatus === 'None')),
    [inventoryLots]
  );

  const toggleRow = (lot) => {
    const id = lot._id || lot.id;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = { lot, issueQty: lot.remainingMtrs, issuePcs: lot.remainingPcs || 0 };
      }
      return next;
    });
  };

  const updateRow = (id, key, value) => {
    setSelected((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const selectedRows = Object.entries(selected);

  const handleSaveAll = async () => {
    if (!millId) return toast.error('Select Mill');
    if (selectedRows.length === 0) return toast.error('Select at least one lot');

    setSaving(true);
    let ok = 0;
    let failed = 0;
    for (const [id, row] of selectedRows) {
      setProgress(`Issuing ${row.lot.lotId}… (${ok + failed + 1}/${selectedRows.length})`);
      try {
        await issueToMill({
          jobCardNo: 'AUTO',
          issueDate: date,
          date,
          lotId: id,
          workerId: millId,
          processType: procType,
          issueQty: Number(row.issueQty) || 0,
          issuePcs: Number(row.issuePcs) || 0,
          jobRate: Number(jobRate) || 0,
          processCharges: Number(jobRate) || 0,
          chargesRate: Number(jobRate) || 0,
          purchaseRate: row.lot.rate || row.lot.purchaseRate || 0,
        });
        ok += 1;
      } catch (err) {
        failed += 1;
        console.error(`Issue Multiple failed for lot ${row.lot.lotId}:`, err);
      }
    }
    setProgress(null);
    setSaving(false);
    await Promise.all([fetchJobs(), fetchInventory()]);
    if (failed === 0) {
      toast.success(`${ok} lot(s) issued successfully`);
      setSelected({});
    } else {
      toast.error(`${ok} succeeded, ${failed} failed — check console for details`);
    }
  };

  if (!isOpen) return null;

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title="Mill Issue [ ISSUE MULTIPLE ]" windowId="issueMultiple" bare>
      {({ WindowControls }) => (
        <div className="classic-erp-window erp-density flex flex-col h-full min-h-0 !max-h-none">
          <ErpBusyOverlay show={bootLoading} message="Loading…" />
          <ErpBusyOverlay show={saving} message={progress || 'Issuing…'} />
          <div className="classic-erp-header shrink-0">
            <span className="erp-window-title truncate">Mill Issue [ ISSUE MULTIPLE ]</span>
            <WindowControls />
          </div>

          <div className="classic-erp-body flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 p-2">
            <div className="classic-erp-frame flex flex-wrap items-center gap-3">
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label red-label">Mill:</span>
                <ERPCombobox value={millId} onChange={setMillId} options={millOptions} placeholder="Select mill…" recentKey="issue-multi-mill" />
              </div>
              <div className="classic-erp-field">
                <span className="classic-erp-label">Process:</span>
                <ERPSelect className="classic-erp-select" value={procType} onChange={(e) => setProcType(e.target.value)} options={PROCESS_TYPES.map((p) => ({ value: p, label: p }))} />
              </div>
              <div className="classic-erp-field">
                <span className="classic-erp-label">Date:</span>
                <input type="date" className="classic-erp-input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="classic-erp-field">
                <span className="classic-erp-label">Job Rate:</span>
                <input type="number" className="classic-erp-input w-24 text-right" value={jobRate} onChange={(e) => setJobRate(e.target.value)} placeholder="₹/mtr" />
              </div>
              <span className="text-[11px] font-bold text-blue-700 ml-auto">{selectedRows.length} lot(s) selected</span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto border border-slate-300 rounded">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-200">
                  <tr>
                    <th className="border px-1 py-1 w-6"></th>
                    <th className="border px-1 py-1 text-left">LotNo</th>
                    <th className="border px-1 py-1 text-left">Item</th>
                    <th className="border px-1 py-1 text-right">Available Mts</th>
                    <th className="border px-1 py-1 text-right w-24">Issue Qty</th>
                    <th className="border px-1 py-1 text-right w-20">Issue Pcs</th>
                  </tr>
                </thead>
                <tbody>
                  {availableLots.map((lot) => {
                    const id = lot._id || lot.id;
                    const row = selected[id];
                    return (
                      <tr key={id} className={row ? 'bg-blue-50' : ''}>
                        <td className="border px-1 py-0.5 text-center">
                          <input type="checkbox" checked={!!row} onChange={() => toggleRow(lot)} />
                        </td>
                        <td className="border px-1 py-0.5 font-bold cursor-pointer" onClick={() => toggleRow(lot)}>{lot.lotId}</td>
                        <td className="border px-1 py-0.5">{lot.itemName || lot.itemId?.name}</td>
                        <td className="border px-1 py-0.5 text-right font-mono">{Number(lot.remainingMtrs || 0).toFixed(2)}</td>
                        <td className="border px-1 py-0.5">
                          <input type="number" className="classic-erp-input w-full text-right border-0 bg-transparent" value={row?.issueQty ?? ''} onChange={(e) => updateRow(id, 'issueQty', e.target.value)} disabled={!row} />
                        </td>
                        <td className="border px-1 py-0.5">
                          <input type="number" className="classic-erp-input w-full text-right border-0 bg-transparent" value={row?.issuePcs ?? ''} onChange={(e) => updateRow(id, 'issuePcs', e.target.value)} disabled={!row} />
                        </td>
                      </tr>
                    );
                  })}
                  {availableLots.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-4 text-slate-400">No available stock lots</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="classic-erp-form-footer flex-wrap">
            <button type="button" className="classic-erp-btn btn-blue" onClick={handleSaveAll} disabled={saving}>
              <SaveButtonLabel saving={saving} label={`Issue ${selectedRows.length || ''} Lot(s)`} />
            </button>
            <button type="button" className="classic-erp-btn" onClick={onClose} disabled={saving}>Exit</button>
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

export default IssueMultipleModal;
