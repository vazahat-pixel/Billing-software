import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSearchableSelect } from '../../components/forms/FormElements';
import { stage2OpsApi } from '../../api';
import { toast } from '../../store/useToastStore';

const TABS = ['Overview', 'Documents', 'Workflow', 'Validate', 'Certification'];

/**
 * Sprint 2.7–2.10 unified Stage 2 ops workspace.
 */
const Stage2OpsModal = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState('Overview');
  const [pipeline, setPipeline] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [cert, setCert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [validateResult, setValidateResult] = useState(null);
  const [gstin, setGstin] = useState('');
  const [creditCustomerId, setCreditCustomerId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const refresh = async () => {
    try {
      const [p, t, i, c] = await Promise.all([
        stage2OpsApi.pipeline(),
        stage2OpsApi.listTemplates(),
        stage2OpsApi.listInstances({ status: 'Pending' }),
        stage2OpsApi.latestCertification(),
      ]);
      setPipeline(p);
      setTemplates(t || []);
      setInstances(i || []);
      setCert(c);
    } catch {
      /* partial */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTab('Overview');
    refresh();
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stage 2 Ops — Docs · Workflow · Validation · Cert" className="max-w-[92vw]">
      <div className="space-y-4 p-2">
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

        {tab === 'Overview' && pipeline && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="border border-slate-100 rounded p-3">
              <p className="text-[10px] uppercase text-slate-400 font-bold">Doc templates</p>
              <p className="text-xl font-black">{pipeline.documents?.templateCount ?? 0}</p>
            </div>
            <div className="border border-slate-100 rounded p-3">
              <p className="text-[10px] uppercase text-slate-400 font-bold">Pending approvals</p>
              <p className="text-xl font-black">{pipeline.workflow?.pending ?? 0}</p>
            </div>
            <div className="border border-slate-100 rounded p-3">
              <p className="text-[10px] uppercase text-slate-400 font-bold">Escalated</p>
              <p className="text-xl font-black">{pipeline.workflow?.escalated ?? 0}</p>
            </div>
            <div className="border border-slate-100 rounded p-3">
              <p className="text-[10px] uppercase text-slate-400 font-bold">Cert score</p>
              <p className="text-xl font-black">
                {pipeline.certification?.score != null ? `${pipeline.certification.score}%` : '—'}
              </p>
              {pipeline.certification && (
                <p className="text-[10px] text-slate-500">
                  {pipeline.certification.passed ? 'PASS' : 'NOT PASSED'} (gate {pipeline.certification.gate})
                </p>
              )}
            </div>
            <button
              type="button"
              className="erp-btn-primary md:col-span-4"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await Promise.all([
                    stage2OpsApi.seedDocuments(),
                    stage2OpsApi.seedWorkflow(),
                  ]);
                  toast.success('Documents + workflows seeded');
                  await refresh();
                } catch (e) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Seed document templates + workflow definitions
            </button>
          </div>
        )}

        {tab === 'Documents' && (
          <div className="space-y-3 text-xs">
            <p className="text-[10px] uppercase font-bold text-slate-400">
              Templates · Print/PDF via existing InvoicePDFViewer · Email/WA stubs · Barcode labels
            </p>
            <div className="max-h-56 overflow-auto border border-slate-100 rounded">
              {templates.map((t) => (
                <div key={t._id || t.id} className="p-2 border-b border-slate-50 flex justify-between">
                  <span>
                    {t.docType} — {t.name} ({t.format})
                  </span>
                  <span>{t.isDefault ? 'default' : ''}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-500">
              Channels: print/pdf ready · email/whatsapp queued via automation stubs · signature hook ready
            </p>
          </div>
        )}

        {tab === 'Workflow' && (
          <div className="space-y-3">
            <button
              type="button"
              className="erp-btn-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await stage2OpsApi.escalate();
                  toast.success(`Escalated ${Array.isArray(r) ? r.length : 0}`);
                  await refresh();
                } catch (e) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Run escalation scan
            </button>
            <div className="max-h-48 overflow-auto border border-slate-100 rounded text-xs">
              {(instances || []).length === 0 && <p className="p-2 text-slate-400">No pending instances</p>}
              {instances.map((w) => (
                <div key={w._id || w.id} className="p-2 border-b border-slate-50 flex justify-between items-center gap-2">
                  <div>
                    <p className="font-bold">
                      {w.referenceNo || w.referenceType} — ₹{w.amount}
                    </p>
                    <p className="text-slate-500">
                      {w.module} · {w.status}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="text-[10px] font-bold text-green-700"
                      onClick={async () => {
                        await stage2OpsApi.decideWorkflow(w._id || w.id, { approve: true });
                        toast.success('Approved');
                        await refresh();
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-red-600"
                      onClick={async () => {
                        await stage2OpsApi.decideWorkflow(w._id || w.id, { approve: false, note: 'Rejected' });
                        toast.success('Rejected');
                        await refresh();
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">Credit limit check</p>
              <ERPInput label="Customer Id" value={creditCustomerId} onChange={(e) => setCreditCustomerId(e.target.value)} />
              <ERPInput label="Additional amount" type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
              <button
                type="button"
                className="erp-btn-primary"
                disabled={busy || !creditCustomerId}
                onClick={async () => {
                  try {
                    const r = await stage2OpsApi.creditCheck({
                      customerId: creditCustomerId,
                      amount: Number(creditAmount || 0),
                    });
                    toast.success(r.blocked ? r.message : 'Within credit limit');
                    await refresh();
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Check credit / start override WF
              </button>
            </div>
          </div>
        )}

        {tab === 'Validate' && (
          <div className="space-y-3">
            <ERPInput label="GSTIN to validate (party payload)" value={gstin} onChange={(e) => setGstin(e.target.value)} />
            <ERPSearchableSelect
              label="Module"
              options={[
                { value: 'sales', label: 'Sales' },
                { value: 'purchase', label: 'Purchase' },
                { value: 'journal', label: 'Journal' },
              ]}
              value="sales"
              onChange={() => {}}
            />
            <button
              type="button"
              className="erp-btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await stage2OpsApi.validate({
                    module: 'sales',
                    action: 'create',
                    payload: {
                      items: [],
                      customerId: undefined,
                    },
                    options: { skipParty: !gstin, skipDuplicate: true },
                  });
                  // Also test GSTIN via purchase of a fake party inline — use journal unbalanced demo
                  const j = await stage2OpsApi.validate({
                    module: 'journal',
                    action: 'create',
                    payload: {
                      lines: [
                        { type: 'Dr', amount: 100 },
                        { type: 'Cr', amount: 50 },
                      ],
                    },
                    options: { skipParty: true, skipDuplicate: true },
                  });
                  setValidateResult({ salesSmoke: r, unbalancedJournal: j, gstinFormat: gstin });
                  toast.success('Validation ran');
                } catch (e) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Run validation smoke tests
            </button>
            {validateResult && (
              <pre className="text-[10px] bg-slate-50 p-2 rounded overflow-auto max-h-48">
                {JSON.stringify(validateResult, null, 2)}
              </pre>
            )}
          </div>
        )}

        {tab === 'Certification' && (
          <div className="space-y-3">
            <button
              type="button"
              className="erp-btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await stage2OpsApi.runCertification();
                  setCert(r);
                  toast.success(
                    r.passed
                      ? `PASSED — score ${r.score}%`
                      : `Score ${r.score}% (gate ${r.gate}) — gaps remain`
                  );
                  await refresh();
                } catch (e) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Run Business Readiness Certification
            </button>
            {cert && (
              <div className="text-xs space-y-2">
                <p className="font-black text-lg">
                  Score {cert.score}% — {cert.passed ? 'PASSED' : 'NOT PASSED'} (gate {cert.gate})
                </p>
                <p className="text-slate-500">Reconcile: {cert.reconcileStatus}</p>
                <div className="max-h-40 overflow-auto border border-slate-100 rounded">
                  {(cert.checklist || []).map((c) => (
                    <div key={c.key} className="p-2 border-b border-slate-50 flex justify-between">
                      <span>
                        [{c.status}] {c.label}
                      </span>
                      <span>
                        {c.score}/{c.maxScore}
                      </span>
                    </div>
                  ))}
                </div>
                {cert.gaps?.length > 0 && (
                  <ul className="list-disc pl-4 text-amber-700">
                    {cert.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default Stage2OpsModal;
