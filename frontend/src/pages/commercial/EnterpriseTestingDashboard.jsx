import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { stage8Api } from '../../api/stage8.api';
import { toast } from '../../store/useToastStore';

const SCORE_KEYS = [
  ['overallErpHealth', 'ERP Health'],
  ['production', 'Production'],
  ['business', 'Business'],
  ['accounting', 'Accounting'],
  ['inventory', 'Inventory'],
  ['gst', 'GST'],
  ['security', 'Security'],
  ['isolation', 'Isolation'],
  ['api', 'API'],
  ['performance', 'Performance'],
  ['desktop', 'Desktop'],
  ['offline', 'Offline'],
];

function ScorePill({ label, value }) {
  const v = Number(value || 0);
  const tone =
    v >= 95 ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' :
    v >= 80 ? 'bg-amber-500/15 text-amber-800 border-amber-500/30' :
    'bg-rose-500/15 text-rose-700 border-rose-500/30';
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{v}%</div>
    </div>
  );
}

/**
 * Stage 8.11 — Enterprise Automated Business Certification dashboard.
 */
export default function EnterpriseTestingDashboard({ isOpen, onClose }) {
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState('Health');

  const load = async () => {
    try {
      const [c, d] = await Promise.all([
        stage8Api.testingCatalog(),
        stage8Api.testingDashboard(),
      ]);
      setCatalog(c);
      setDashboard(d);
      if (d?.latest) setReport(d.latest);
    } catch {
      /* partial */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTab('Health');
    load();
  }, [isOpen]);

  const runCertify = async () => {
    setBusy(true);
    try {
      const r = await stage8Api.testingCertify({ mode: 'full' });
      setReport(r);
      await load();
      if (r.deployAllowed) toast.success(`Certification PASSED — score ${r.score} (gate ${r.gate})`);
      else toast.error(`DEPLOY BLOCKED — score ${r.score}. ${r.gaps?.[0] || 'Fix failing gates'}`);
    } catch (e) {
      toast.error(e, { fallback: 'Certification failed' });
    } finally {
      setBusy(false);
    }
  };

  const scores = report?.meta?.scores || dashboard?.scores || {};
  const checklist = report?.checklist || report?.meta?.checklist || [];
  const gates = report?.gateResults || dashboard?.gates || [];
  const scaffold = dashboard?.scaffold;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enterprise Testing Platform" className="max-w-5xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-[var(--erp-muted)]">
              Stage 8.11 · Zero Regression · Production gate{' '}
              <span className="font-semibold text-[var(--erp-fg)]">{catalog?.productionGate || 95}%</span>
            </p>
            <p className="text-xs text-[var(--erp-muted)] mt-0.5">
              Deploy {report?.deployAllowed ?? dashboard?.deployBlocked === false ? 'ALLOWED' : 'BLOCKED'} until all critical gates pass
            </p>
          </div>
          <button
            type="button"
            className="erp-btn erp-btn-primary"
            disabled={busy}
            onClick={runCertify}
          >
            {busy ? 'Certifying…' : 'Run Full Certification'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[var(--erp-border)] pb-2">
          {['Health', 'Suites', 'Gates', 'Catalog'].map((t) => (
            <button
              key={t}
              type="button"
              className={`erp-btn h-7 px-3 text-[11px] ${tab === t ? 'erp-btn-primary' : 'erp-btn-secondary'}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Health' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {SCORE_KEYS.map(([k, label]) => (
                <ScorePill key={k} label={label} value={scores[k]} />
              ))}
            </div>
            {scaffold && (
              <div className="rounded-lg border border-[var(--erp-border)] p-3 text-sm">
                <div className="font-medium mb-1">Platform scaffold</div>
                <div className="text-[var(--erp-muted)]">
                  {scaffold.present}/{scaffold.total} artifacts ·{' '}
                  {scaffold.healthy ? 'Healthy' : `Missing: ${(scaffold.missing || []).join(', ')}`}
                </div>
              </div>
            )}
            {report?.gaps?.length > 0 && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                <div className="font-medium text-rose-800 mb-1">Gaps</div>
                <ul className="list-disc pl-4 space-y-0.5 text-rose-900/80">
                  {report.gaps.slice(0, 12).map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'Suites' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--erp-muted)] border-b border-[var(--erp-border)]">
                  <th className="py-2 pr-2">Suite</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Score</th>
                  <th className="py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {(checklist.length ? checklist : catalog?.suites || []).map((row) => (
                  <tr key={row.key || row.id} className="border-b border-[var(--erp-border)]/60">
                    <td className="py-2 pr-2 font-medium">{row.label}</td>
                    <td className="py-2 pr-2 uppercase text-xs">{row.status || '—'}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      {row.maxScore != null ? `${row.score}/${row.maxScore}` : row.command || '—'}
                    </td>
                    <td className="py-2 text-[var(--erp-muted)] text-xs">{row.detail || row.command || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Gates' && (
          <div className="space-y-2">
            {(gates.length ? gates : []).map((g) => (
              <div
                key={g.id}
                className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                  g.passed ? 'border-emerald-500/30' : g.blocking ? 'border-rose-500/40 bg-rose-500/5' : 'border-amber-500/30'
                }`}
              >
                <div>
                  <div className="font-medium">{g.label}</div>
                  <div className="text-xs text-[var(--erp-muted)]">{g.detail}</div>
                </div>
                <span className="text-xs font-semibold uppercase shrink-0">
                  {g.passed ? 'Pass' : g.blocking ? 'Block' : 'Warn'}
                </span>
              </div>
            ))}
            {!gates.length && (
              <p className="text-sm text-[var(--erp-muted)]">Run certification to evaluate quality gates.</p>
            )}
          </div>
        )}

        {tab === 'Catalog' && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium mb-1">Objectives</div>
              <ul className="list-disc pl-4 text-[var(--erp-muted)]">
                {(catalog?.objective || []).map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-medium mb-1">Test types ({catalog?.testTypes?.length || 0})</div>
              <div className="flex flex-wrap gap-1">
                {(catalog?.testTypes || []).map((t) => (
                  <span key={t} className="rounded border border-[var(--erp-border)] px-2 py-0.5 text-[10px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">NPM scripts</div>
              <code className="text-xs text-[var(--erp-muted)] block whitespace-pre-wrap">
                {(catalog?.npmScripts || []).join(' · ')}
              </code>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
