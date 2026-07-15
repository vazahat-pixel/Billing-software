import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { productionEngineApi } from '../../api';
import { toast } from '../../store/useToastStore';

const TABS = ['Board', 'Issue', 'Process', 'QC', 'Receive', 'Mapping'];

/**
 * Sprint 2.4 — Production & job work workspace (modal shell).
 * Grey → process chain → QC → receive finished goods
 */
const ProductionEngineModal = ({ isOpen, onClose }) => {
  const { inventoryLots, parties, items, fetchInventory, fetchParties, fetchItems, fetchJobs } = useStore();
  const [tab, setTab] = useState('Board');
  const [pipeline, setPipeline] = useState(null);
  const [board, setBoard] = useState(null);
  const [chains, setChains] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [busy, setBusy] = useState(false);

  const greyLots = useMemo(
    () =>
      (inventoryLots || [])
        .filter((l) => (l.remainingMtrs || 0) > 0)
        .map((l) => ({
          value: l._id || l.id,
          label: `${l.lotId} — ${l.itemId?.name || l.itemName || 'Item'} (${(l.remainingMtrs || 0).toFixed(2)} m)`,
          itemId: l.itemId?._id || l.itemId,
        })),
    [inventoryLots]
  );

  const workers = useMemo(
    () =>
      parties
        .filter((p) => ['Job Worker', 'Supplier', 'Both'].includes(p.type) || !p.type)
        .map((p) => ({ value: p._id || p.id, label: p.name })),
    [parties]
  );

  const itemOpts = useMemo(
    () => items.map((i) => ({ value: i._id || i.id, label: `${i.name} (${i.category || ''})` })),
    [items]
  );

  const chainOpts = useMemo(
    () => chains.map((c) => ({ value: c._id || c.id, label: `${c.name} (${(c.processSteps || []).length} steps)` })),
    [chains]
  );

  const finishedItems = useMemo(
    () => items.filter((i) => i.category === 'Finished' || !i.category).map((i) => ({ value: i._id || i.id, label: i.name })),
    [items]
  );

  const [issueLotId, setIssueLotId] = useState('');
  const [issueWorkerId, setIssueWorkerId] = useState('');
  const [issueChainId, setIssueChainId] = useState('');
  const [issueQty, setIssueQty] = useState('');
  const [issuePcs, setIssuePcs] = useState('0');
  const [productionType, setProductionType] = useState('External');

  const [selectedJobId, setSelectedJobId] = useState('');
  const [receiveQty, setReceiveQty] = useState('');
  const [receivePcs, setReceivePcs] = useState('');
  const [outputItemId, setOutputItemId] = useState('');
  const [rate, setRate] = useState('10');
  const [gstPercent, setGstPercent] = useState('5');

  const [mapInputItemId, setMapInputItemId] = useState('');
  const [mapOutputItemId, setMapOutputItemId] = useState('');
  const [mapProcessName, setMapProcessName] = useState('Dyeing');

  const [qcNotes, setQcNotes] = useState('');

  const selectedLot = greyLots.find((l) => l.value === issueLotId);
  const openJobs = useMemo(
    () => jobs.filter((j) => ['Issued', 'In-Process'].includes(j.status)),
    [jobs]
  );
  const selectedJob = jobs.find((j) => (j._id || j.id) === selectedJobId);

  const refresh = async () => {
    try {
      const [p, b, ch, j, m] = await Promise.all([
        productionEngineApi.pipeline(),
        productionEngineApi.statusBoard(),
        productionEngineApi.listChains(),
        productionEngineApi.listJobs(),
        productionEngineApi.listMappings(),
      ]);
      setPipeline(p);
      setBoard(b);
      setChains(ch || []);
      setJobs(j || []);
      setMappings(m || []);
    } catch {
      /* partial load ok */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchInventory();
    fetchParties();
    fetchItems();
    fetchJobs();
    setTab('Board');
    refresh();
  }, [isOpen, fetchInventory, fetchParties, fetchItems, fetchJobs]);

  useEffect(() => {
    if (!selectedLot?.itemId || !selectedJob?.processType) return;
    productionEngineApi
      .resolveMapping({ inputItemId: selectedLot.itemId, processName: selectedJob?.processType || 'Dyeing' })
      .then((m) => {
        if (m?.outputItemId) setOutputItemId(m.outputItemId._id || m.outputItemId);
      })
      .catch(() => {});
  }, [selectedJobId, selectedLot, selectedJob]);

  const handleIssue = async () => {
    if (!issueLotId || !issueWorkerId || !issueQty) return toast.error('Lot, worker and qty required');
    const chain = chains.find((c) => (c._id || c.id) === issueChainId);
    setBusy(true);
    try {
      await productionEngineApi.issue({
        lotId: issueLotId,
        workerId: issueWorkerId,
        issueQty: Number(issueQty),
        issuePcs: Number(issuePcs || 0),
        processType: chain?.processSteps?.[0]?.processName || 'Dyeing',
        chainTemplateId: issueChainId || undefined,
        productionType,
      });
      toast.success('Job issued');
      setIssueQty('');
      await fetchInventory();
      await fetchJobs();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Issue failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = async (requireQc = false) => {
    if (!selectedJobId) return toast.error('Select a job');
    setBusy(true);
    try {
      await productionEngineApi.advanceStep(selectedJobId, { requireQc, completeStep: true });
      toast.success(requireQc ? 'Sent to QC' : 'Step advanced');
      await fetchJobs();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Advance failed');
    } finally {
      setBusy(false);
    }
  };

  const handleQc = async (passed) => {
    if (!selectedJobId) return toast.error('Select a job');
    setBusy(true);
    try {
      await productionEngineApi.performQc(selectedJobId, { passed, notes: qcNotes });
      toast.success(passed ? 'QC passed' : 'QC failed');
      setQcNotes('');
      await fetchJobs();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'QC failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReceive = async () => {
    if (!selectedJobId || !receiveQty) return toast.error('Job and received qty required');
    const charges = (Number(receiveQty) || 0) * (Number(rate) || 0);
    const gstAmount = (charges * (Number(gstPercent) || 0)) / 100;
    const wastage = Math.max(0, (selectedJob?.issueQty || 0) - Number(receiveQty));
    setBusy(true);
    try {
      await productionEngineApi.receive({
        jobId: selectedJobId,
        receivedQty: Number(receiveQty),
        receivedPcs: Number(receivePcs || 0),
        wastage,
        charges,
        gstAmount,
        outputItemId: outputItemId || undefined,
      });
      toast.success('Finished goods received');
      await fetchInventory();
      await fetchJobs();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Receive failed');
    } finally {
      setBusy(false);
    }
  };

  const handleMapping = async () => {
    if (!mapInputItemId || !mapOutputItemId || !mapProcessName) return toast.error('All mapping fields required');
    setBusy(true);
    try {
      await productionEngineApi.createMapping({
        inputItemId: mapInputItemId,
        outputItemId: mapOutputItemId,
        processName: mapProcessName,
      });
      toast.success('Mapping saved');
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Mapping failed');
    } finally {
      setBusy(false);
    }
  };

  const boardColumns = board || { Issued: [], 'In-Process': [], 'QC-Pending': [], Received: [] };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Production Engine" className="max-w-[92vw]">
      <div className="space-y-4 p-2">
        {pipeline && (
          <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Open: {pipeline.openJobs}</span>
            <span>Issued: {pipeline.issued}</span>
            <span>In process: {pipeline.inProcess}</span>
            <span>QC: {pipeline.qcPending}</span>
            <span>Received: {pipeline.received}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded ${
                tab === t ? 'bg-black text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Board' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {Object.entries(boardColumns).map(([col, cards]) => (
              <div key={col} className="border border-slate-100 rounded p-2 min-h-[120px]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{col}</p>
                {(cards || []).map((c) => (
                  <div
                    key={c.jobId}
                    className="mb-2 p-2 bg-slate-50 rounded text-xs cursor-pointer hover:bg-slate-100"
                    onClick={() => {
                      setSelectedJobId(c.jobId);
                      setTab('Receive');
                    }}
                  >
                    <p className="font-bold">{c.jobCardNo}</p>
                    <p>{c.processType} · {c.issueQty} m</p>
                    <p className="text-slate-500">{c.workerName}</p>
                    {c.currentStep && <p className="text-[10px] text-amber-600">{c.currentStep}: {c.stepStatus}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === 'Issue' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ERPSearchableSelect label="Grey lot" options={greyLots} value={issueLotId} onChange={setIssueLotId} />
            <ERPSearchableSelect label="Process chain" options={chainOpts} value={issueChainId} onChange={setIssueChainId} />
            <ERPSearchableSelect label="Job worker" options={workers} value={issueWorkerId} onChange={setIssueWorkerId} />
            <ERPSearchableSelect
              label="Production type"
              options={[
                { value: 'External', label: 'External (Job Worker)' },
                { value: 'Internal', label: 'Internal' },
              ]}
              value={productionType}
              onChange={setProductionType}
            />
            <ERPInput label="Issue mtrs" type="number" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} />
            <ERPInput label="Issue pcs" type="number" value={issuePcs} onChange={(e) => setIssuePcs(e.target.value)} />
            <button type="button" disabled={busy} onClick={handleIssue} className="erp-btn-primary md:col-span-2">
              Issue to production
            </button>
          </div>
        )}

        {tab === 'Process' && (
          <div className="space-y-3">
            <ERPSearchableSelect
              label="Open job"
              options={openJobs.map((j) => ({
                value: j._id || j.id,
                label: `${j.jobCardNo} — ${j.processType} (${j.issueQty} m)`,
              }))}
              value={selectedJobId}
              onChange={setSelectedJobId}
            />
            {selectedJob?.steps?.length > 0 && (
              <div className="text-xs border border-slate-100 rounded p-2">
                {(selectedJob.steps || []).map((s) => (
                  <div key={s.sequence} className="flex justify-between py-1 border-b border-slate-50">
                    <span>{s.sequence}. {s.processName}</span>
                    <span className="font-bold">{s.status}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => handleAdvance(false)} className="erp-btn-primary">
                Complete step
              </button>
              <button type="button" disabled={busy} onClick={() => handleAdvance(true)} className="erp-btn-secondary">
                Complete → QC
              </button>
            </div>
          </div>
        )}

        {tab === 'QC' && (
          <div className="space-y-3">
            <ERPSearchableSelect
              label="Job"
              options={openJobs.map((j) => ({ value: j._id || j.id, label: j.jobCardNo }))}
              value={selectedJobId}
              onChange={setSelectedJobId}
            />
            <ERPInput label="QC notes" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => handleQc(true)} className="erp-btn-primary">
                Pass QC
              </button>
              <button type="button" disabled={busy} onClick={() => handleQc(false)} className="erp-btn-secondary">
                Fail QC
              </button>
            </div>
          </div>
        )}

        {tab === 'Receive' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ERPSearchableSelect
              label="Pending job"
              options={openJobs.map((j) => ({
                value: j._id || j.id,
                label: `${j.jobCardNo} — ${j.processType}`,
              }))}
              value={selectedJobId}
              onChange={setSelectedJobId}
            />
            <ERPSearchableSelect label="Finished item" options={finishedItems} value={outputItemId} onChange={setOutputItemId} />
            <ERPInput label="Received mtrs" type="number" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
            <ERPInput label="Received pcs" type="number" value={receivePcs} onChange={(e) => setReceivePcs(e.target.value)} />
            <ERPInput label="Process rate / mtr" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            <ERPInput label="GST %" type="number" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} />
            {selectedJob && receiveQty && (
              <p className="text-xs text-slate-500 md:col-span-2">
                Wastage: {Math.max(0, selectedJob.issueQty - Number(receiveQty)).toFixed(2)} m (
                {selectedJob.toleranceWastagePct ?? 3}% tolerance applied server-side)
              </p>
            )}
            <button type="button" disabled={busy} onClick={handleReceive} className="erp-btn-primary md:col-span-2">
              Receive finished goods
            </button>
          </div>
        )}

        {tab === 'Mapping' && (
          <div className="space-y-3">
            <ERPSearchableSelect label="Grey / input item" options={itemOpts} value={mapInputItemId} onChange={setMapInputItemId} />
            <ERPInput label="Process name" value={mapProcessName} onChange={(e) => setMapProcessName(e.target.value)} />
            <ERPSearchableSelect label="Finished output item" options={finishedItems} value={mapOutputItemId} onChange={setMapOutputItemId} />
            <button type="button" disabled={busy} onClick={handleMapping} className="erp-btn-primary">
              Save grey → finished mapping
            </button>
            <div className="max-h-40 overflow-auto text-xs border border-slate-100 rounded">
              {(mappings || []).map((m) => (
                <div key={m._id || m.id} className="p-2 border-b border-slate-50">
                  {m.inputItemId?.name} + {m.processName} → {m.outputItemId?.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ProductionEngineModal;
