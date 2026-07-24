import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { masterDataApi } from '../../api';
import { toast } from '../../store/useToastStore';
import { erpConfirm } from '../../utils/confirm';

const MergeMasterModal = ({ isOpen, onClose }) => {
  const { parties, items, fetchParties, fetchItems } = useStore();
  const [entity, setEntity] = useState('party');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState('');
  const [dryRunResult, setDryRunResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchParties();
      fetchItems();
      setSourceId('');
      setTargetId('');
      setDryRunResult(null);
      setImportText('');
    }
  }, [isOpen, fetchParties, fetchItems]);

  const options =
    entity === 'party'
      ? parties.map((p) => ({ value: p._id || p.id, label: p.name }))
      : items.map((i) => ({ value: i._id || i.id, label: i.name || i.itemName }));

  const handleMerge = async () => {
    if (!sourceId || !targetId) {
      toast.warning('Select source and target');
      return;
    }
    if (sourceId === targetId) {
      toast.warning('Source and target must differ');
      return;
    }
    if (!(await erpConfirm({
      title: 'Merge Records',
      message: 'Merge will re-point transactions and soft-delete the source. Continue?',
      confirmLabel: 'Merge',
      danger: true,
    }))) return;
    setSaving(true);
    try {
      if (entity === 'party') {
        await masterDataApi.mergeParties({ sourceId, targetId });
      } else {
        await masterDataApi.mergeItems({ sourceId, targetId });
      }
      toast.success('Merge completed');
      await fetchParties();
      await fetchItems();
      setSourceId('');
      setTargetId('');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleImportDryRun = async () => {
    try {
      const rows = JSON.parse(importText);
      if (!Array.isArray(rows)) throw new Error('JSON must be an array of objects');
      const report = await masterDataApi.importRows({ entity, rows, dryRun: true });
      setDryRunResult(report);
      toast.info(`Dry-run: ${report.valid} valid, ${report.invalid} invalid, ${report.skipped} skipped`);
    } catch (err) {
      toast.error(err.message || 'Invalid JSON');
    }
  };

  const handleImportApply = async () => {
    try {
      const rows = JSON.parse(importText);
      const report = await masterDataApi.importRows({ entity, rows, dryRun: false });
      setDryRunResult(report);
      toast.success(`Imported ${report.created} rows`);
      await fetchParties();
      await fetchItems();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Master Merge & Import" className="max-w-2xl">
      <div className="p-6 space-y-6">
        <div className="flex gap-2">
          {['party', 'item'].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEntity(e)}
              className={`px-3 py-1 text-[10px] font-black uppercase ${entity === e ? 'bg-black text-white' : 'bg-slate-100'}`}
            >
              {e}
            </button>
          ))}
        </div>

        <section className="space-y-3 border border-slate-200 p-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Merge duplicates</h3>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Source (will be retired)</label>
            <ERPSearchableSelect className="w-full mt-1" value={sourceId} onChange={setSourceId} options={options} placeholder="Source…" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Target (keep)</label>
            <ERPSearchableSelect className="w-full mt-1" value={targetId} onChange={setTargetId} options={options} placeholder="Target…" />
          </div>
          <button type="button" disabled={saving} onClick={handleMerge} className="w-full py-2 bg-black text-white text-[10px] font-black uppercase">
            {saving ? 'Merging…' : 'Merge'}
          </button>
        </section>

        <section className="space-y-3 border border-slate-200 p-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Bulk import (JSON array)</h3>
          <textarea
            className="w-full h-28 border border-slate-200 p-2 text-xs font-mono"
            placeholder='[{"name":"Party A","type":"Customer"}]'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleImportDryRun} className="flex-1 py-2 bg-slate-800 text-white text-[10px] font-black uppercase">
              Dry run
            </button>
            <button type="button" onClick={handleImportApply} className="flex-1 py-2 bg-emerald-700 text-white text-[10px] font-black uppercase">
              Apply import
            </button>
          </div>
          {dryRunResult && (
            <pre className="text-[10px] bg-slate-50 p-2 overflow-auto max-h-32">
              {JSON.stringify(dryRunResult, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default MergeMasterModal;

