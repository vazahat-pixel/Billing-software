import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { stage6Api } from '../../api/stage6.api';
import { toast } from '../../store/useToastStore';

const TABS = [
  'Overview',
  'Automation',
  'Approvals',
  'BI',
  'Documents',
  'Communication',
  'Offline',
  'Productivity',
  'Certification',
];

const fmt = (n) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/**
 * Stage 6 — Enterprise Productivity Platform workspace (modal shell).
 */
export default function EnterprisePlatformModal({ isOpen, onClose, initialTab = 'Overview' }) {
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState(null);
  const [autoRules, setAutoRules] = useState([]);
  const [autoPipeline, setAutoPipeline] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [apprPipeline, setApprPipeline] = useState(null);
  const [bi, setBi] = useState(null);
  const [biSales, setBiSales] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [comm, setComm] = useState(null);
  const [offline, setOffline] = useState(null);
  const [prod, setProd] = useState(null);
  const [cert, setCert] = useState(null);

  const refresh = async () => {
    try {
      const tasks = {
        Overview: async () => setOverview(await stage6Api.overview()),
        Automation: async () => {
          setAutoPipeline(await stage6Api.autoPipeline());
          setAutoRules(await stage6Api.autoRules());
        },
        Approvals: async () => {
          setApprPipeline(await stage6Api.apprPipeline());
          setApprovals(await stage6Api.apprInbox());
        },
        BI: async () => {
          setBi(await stage6Api.biOverview());
          setBiSales(await stage6Api.biSales({ months: 6 }));
        },
        Documents: async () => setTemplates(await stage6Api.docTemplates()),
        Communication: async () => setComm(await stage6Api.commPipeline()),
        Offline: async () => setOffline(await stage6Api.offlineStatus()),
        Productivity: async () => setProd(await stage6Api.productivity()),
        Certification: async () => setCert(await stage6Api.certificationLatest()),
      };
      await (tasks[tab] || tasks.Overview)();
    } catch {
      /* partial */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab || 'Overview');
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
  }, [isOpen, tab]);

  const seedAll = async () => {
    setBusy(true);
    try {
      await Promise.all([
        stage6Api.seedFlags(),
        stage6Api.notifSeed(),
        stage6Api.autoSeed(),
        stage6Api.apprSeed(),
        stage6Api.docSeed(),
      ]);
      toast.success('Enterprise platform seeded');
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Seed failed');
    } finally {
      setBusy(false);
    }
  };

  const runCert = async () => {
    setBusy(true);
    try {
      const report = await stage6Api.certificationRun();
      setCert(report);
      toast.success(`Enterprise score: ${report.score} — ${report.passed ? 'PASSED' : 'GAPS'}`);
    } catch (e) {
      toast.error(e.message || 'Certification failed');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id, approve) => {
    setBusy(true);
    try {
      if (approve) await stage6Api.apprDecide(id, { approve: true, note: 'Approved' });
      else await stage6Api.apprReject(id, { note: 'Rejected' });
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enterprise Productivity Platform" className="max-w-5xl">
      <div className="flex flex-col gap-3 min-h-[420px]">
        <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`text-[10px] px-2.5 py-1.5 rounded ${
                tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto text-[10px] px-2.5 py-1.5 rounded border border-slate-200"
            onClick={seedAll}
            disabled={busy}
          >
            Seed All
          </button>
        </div>

        {tab === 'Overview' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {overview?.config?.features &&
              Object.entries(overview.config.features).map(([k, v]) => (
                <div key={k} className="border border-slate-100 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-400 uppercase">{k}</p>
                  <p className={`text-[13px] font-semibold ${v ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {v ? 'Enabled' : 'Off'}
                  </p>
                </div>
              ))}
            <p className="col-span-full text-[11px] text-slate-500 mt-2">
              Stage 6 — Search, Notifications, Automation, Approvals, Offline, Communication, Documents, BI,
              Productivity. Configurable from Admin / this panel.
            </p>
          </div>
        )}

        {tab === 'Automation' && (
          <div className="space-y-3">
            <div className="flex gap-3 text-[11px]">
              <span>Rules: {autoPipeline?.rules ?? '—'}</span>
              <span>Enabled: {autoPipeline?.enabled ?? '—'}</span>
              <span>Runs 24h: {autoPipeline?.runsLast24h ?? '—'}</span>
            </div>
            <ul className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
              {autoRules.map((r) => (
                <li key={r._id} className="py-2 flex justify-between gap-2 text-[12px]">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {r.trigger?.event} · {r.actions?.length || 0} actions · runs {r.stats?.runs || 0}
                    </p>
                  </div>
                  <span className={r.enabled ? 'text-emerald-600 text-[10px]' : 'text-slate-400 text-[10px]'}>
                    {r.enabled ? 'ON' : 'OFF'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'Approvals' && (
          <div className="space-y-3">
            <div className="flex gap-3 text-[11px]">
              <span>Pending: {apprPipeline?.pending ?? '—'}</span>
              <span>Escalated: {apprPipeline?.escalated ?? '—'}</span>
              <span>Defs: {apprPipeline?.definitions ?? '—'}</span>
            </div>
            <ul className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
              {approvals.length === 0 && (
                <li className="py-6 text-center text-[12px] text-slate-400">No pending approvals</li>
              )}
              {approvals.map((a) => (
                <li key={a._id} className="py-2 flex items-center justify-between gap-2 text-[12px]">
                  <div>
                    <p className="font-semibold">
                      {a.referenceNo || a.module} · ₹{fmt(a.amount)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {a.status} · step {(a.currentStepIndex || 0) + 1}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded"
                      disabled={busy}
                      onClick={() => decide(a._id, true)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 bg-rose-600 text-white rounded"
                      disabled={busy}
                      onClick={() => decide(a._id, false)}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'BI' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Kpi label="Sales Today" value={bi?.summary?.salesToday?.amount} />
              <Kpi label="Purchase Today" value={bi?.summary?.purchaseToday?.amount} />
              <Kpi label="Receivable" value={bi?.summary?.receivable} />
              <Kpi label="Payable" value={bi?.summary?.payable} />
            </div>
            <div>
              <p className="text-[11px] font-semibold mb-1">Top Customers</p>
              <ul className="text-[11px] space-y-1 max-h-40 overflow-y-auto">
                {(biSales?.topCustomers || bi?.summary?.topCustomers || []).map((c, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{c.name || '—'}</span>
                    <span className="font-mono">₹{fmt(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              className="text-[10px] px-3 py-1.5 border border-slate-200 rounded"
              onClick={async () => {
                const bundle = await stage6Api.biExport();
                const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bi-export-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export BI Bundle
            </button>
          </div>
        )}

        {tab === 'Documents' && (
          <ul className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
            {templates.map((t) => (
              <li key={t._id} className="py-2 text-[12px] flex justify-between">
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {t.docType} · {t.format} · {t.locale}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500">{t.isDefault ? 'Default' : ''}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'Communication' && (
          <div className="text-[12px] space-y-2">
            <p>Total sends: {comm?.total ?? 0}</p>
            <p>Stub (provider pending): {comm?.stub ?? 0}</p>
            <p>Failed: {comm?.failed ?? 0}</p>
            <p className="text-[11px] text-slate-500">
              Templates: Invoice, PO, Statement, Outstanding, GST Report, Payment Reminder — WhatsApp / Email / SMS.
            </p>
          </div>
        )}

        {tab === 'Offline' && (
          <div className="space-y-2 text-[12px]">
            <p className={offline?.enabled ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
              Offline Mode: {offline?.enabled ? 'ENABLED' : 'DISABLED'}
            </p>
            <p className="text-[11px] text-slate-500">{offline?.guidance}</p>
            <ul className="grid grid-cols-2 gap-1 text-[11px]">
              {offline?.features &&
                Object.entries(offline.features).map(([k, v]) => (
                  <li key={k} className="flex justify-between border border-slate-100 rounded px-2 py-1">
                    <span>{k}</span>
                    <span>{v ? '✓' : '—'}</span>
                  </li>
                ))}
            </ul>
            <button
              type="button"
              className="text-[10px] px-3 py-1.5 bg-slate-900 text-white rounded"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await stage6Api.offlineToggle(!offline?.enabled);
                  setOffline(await stage6Api.offlineStatus());
                } finally {
                  setBusy(false);
                }
              }}
            >
              Toggle Offline Feature
            </button>
          </div>
        )}

        {tab === 'Productivity' && (
          <div className="grid md:grid-cols-2 gap-3 text-[12px]">
            <div>
              <p className="font-semibold mb-1">Recent Parties</p>
              <ul className="text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                {(prod?.recentParties || []).map((p) => (
                  <li key={p._id}>{p.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Recent Items</p>
              <ul className="text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                {(prod?.recentItems || []).map((p) => (
                  <li key={p._id}>{p.name}</li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2">
              <p className="font-semibold mb-1">Recent Bills</p>
              <ul className="text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                {(prod?.recentBills || []).map((b, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{b.label}</span>
                    <span>₹{fmt(b.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="md:col-span-2 text-[10px] text-slate-400">
              Shortcuts: {prod?.shortcuts?.commandPalette} · Save {prod?.shortcuts?.save}
            </p>
          </div>
        )}

        {tab === 'Certification' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[28px] font-bold text-slate-900">{cert?.score ?? '—'}</p>
                <p className="text-[10px] text-slate-400">
                  Gate {cert?.gate ?? 85} · {cert?.passed ? 'PASSED' : cert ? 'NEEDS WORK' : 'Not run'}
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] px-3 py-2 bg-slate-900 text-white rounded"
                disabled={busy}
                onClick={runCert}
              >
                Run Enterprise Certification
              </button>
            </div>
            {cert?.meta && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <Kpi label="Automation %" value={cert.meta.automationCoverage} suffix="%" />
                <Kpi label="Workflow %" value={cert.meta.workflowCoverage} suffix="%" />
                <Kpi label="Offline %" value={cert.meta.offlineReadiness} suffix="%" />
                <Kpi label="Productivity" value={cert.meta.productivityScore} suffix="%" />
              </div>
            )}
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-[11px]">
              {(cert?.checklist || []).map((c) => (
                <li key={c.key} className="py-1.5 flex justify-between">
                  <span>{c.label}</span>
                  <span
                    className={
                      c.status === 'pass'
                        ? 'text-emerald-600'
                        : c.status === 'warn'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                    }
                  >
                    {c.status} ({c.score}/{c.maxScore})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Kpi({ label, value, suffix = '' }) {
  return (
    <div className="border border-slate-100 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-[14px] font-semibold">
        {suffix === '%' ? `${value ?? '—'}${suffix}` : `₹${fmt(value)}`}
      </p>
    </div>
  );
}
