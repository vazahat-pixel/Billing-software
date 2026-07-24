import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { stage7Api } from '../../api/stage7.api';
import { toast } from '../../store/useToastStore';

const TABS = [
  'Overview',
  'Security',
  'Sessions',
  'Database',
  'Cache & Jobs',
  'Monitoring',
  'Logs',
  'Backups',
  'Certification',
];

/**
 * Stage 7 — Infrastructure & Security operations workspace.
 */
export default function InfrastructureModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('Overview');
  const [busy, setBusy] = useState(false);
  const [posture, setPosture] = useState(null);
  const [config, setConfig] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [db, setDb] = useState(null);
  const [indexes, setIndexes] = useState(null);
  const [cache, setCache] = useState(null);
  const [queue, setQueue] = useState(null);
  const [monitor, setMonitor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [backups, setBackups] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [cert, setCert] = useState(null);

  const refresh = async () => {
    try {
      const map = {
        Overview: async () => {
          setPosture(await stage7Api.securityPosture());
          setMonitor(await stage7Api.monitorSnapshot());
        },
        Security: async () => setConfig(await stage7Api.getConfig()),
        Sessions: async () => {
          setSessions(await stage7Api.sessions());
          setHistory(await stage7Api.loginHistory({ limit: 30 }));
        },
        Database: async () => {
          setDb(await stage7Api.dbHealth());
          setIndexes(await stage7Api.dbIndexes());
        },
        'Cache & Jobs': async () => {
          setCache(await stage7Api.cacheStats());
          setQueue(await stage7Api.queueStats());
        },
        Monitoring: async () => setMonitor(await stage7Api.monitorSnapshot()),
        Logs: async () => setLogs(await stage7Api.logs({ limit: 40 })),
        Backups: async () => {
          setBackups(await stage7Api.backups());
          setPolicy(await stage7Api.backupPolicy());
        },
        Certification: async () => setCert(await stage7Api.certificationLatest()),
      };
      await (map[tab] || map.Overview)();
    } catch {
      /* partial */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTab('Overview');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
  }, [isOpen, tab]);

  const runCert = async () => {
    setBusy(true);
    try {
      const report = await stage7Api.certificationRun();
      setCert(report);
      toast.success(`Infrastructure score: ${report.score}`);
    } catch (e) {
      toast.error(e, { fallback: 'Certification failed' });
    } finally {
      setBusy(false);
    }
  };

  const createBackup = async () => {
    setBusy(true);
    try {
      await stage7Api.backupCreate({ type: 'manual' });
      toast.success('Backup completed');
      setBackups(await stage7Api.backups());
    } catch (e) {
      toast.error(e, { fallback: 'Backup failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Infrastructure & Security" className="max-w-5xl">
      <div className="flex flex-col gap-3 min-h-[440px]">
        <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`text-[10px] px-2.5 py-1.5 rounded ${
                tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label="Mongo" value={monitor?.database?.status || '—'} />
              <Stat label="Avg Latency" value={`${monitor?.api?.avgLatencyMs ?? '—'} ms`} />
              <Stat label="Uptime" value={monitor?.uptimeHuman || '—'} />
              <Stat label="Cache" value={monitor?.cache?.driver || '—'} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
              {posture &&
                Object.entries(posture)
                  .filter(([, v]) => typeof v === 'boolean' || typeof v === 'string')
                  .map(([k, v]) => (
                    <div key={k} className="border border-slate-100 rounded px-2 py-1.5 flex justify-between">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-medium">{String(v)}</span>
                    </div>
                  ))}
            </div>
          </div>
        )}

        {tab === 'Security' && (
          <div className="text-[12px] space-y-2">
            <p>
              Password min length: <b>{config?.passwordPolicy?.minLength}</b>
            </p>
            <p>
              Lockout after <b>{config?.lockout?.maxFailedAttempts}</b> attempts ·{' '}
              {config?.lockout?.lockoutMinutes} min
            </p>
            <p>
              Sessions: max {config?.session?.maxSessions} · single-active:{' '}
              {String(config?.session?.singleActiveSession)}
            </p>
            <p className="text-[11px] text-slate-500">
              Configure via Admin / PUT /api/stage7/security/config
            </p>
          </div>
        )}

        {tab === 'Sessions' && (
          <div className="grid md:grid-cols-2 gap-3 text-[12px]">
            <div>
              <p className="font-semibold mb-1">Active sessions</p>
              <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {sessions.map((s) => (
                  <li key={s._id} className="py-1.5 flex justify-between gap-2">
                    <span className="truncate">
                      {s.deviceName} · {s.ip}
                    </span>
                    <button
                      type="button"
                      className="text-[10px] text-rose-600"
                      onClick={async () => {
                        await stage7Api.revokeSession(s.sessionId);
                        setSessions(await stage7Api.sessions());
                      }}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-[10px] px-2 py-1 border rounded"
                onClick={async () => {
                  await stage7Api.revokeAllSessions();
                  toast.success('All other sessions revoked');
                  setSessions(await stage7Api.sessions());
                }}
              >
                Logout all devices
              </button>
            </div>
            <div>
              <p className="font-semibold mb-1">Login history</p>
              <ul className="max-h-56 overflow-y-auto text-[11px] space-y-1">
                {history.map((h) => (
                  <li key={h._id} className="flex justify-between gap-2">
                    <span>
                      {h.event} {h.success ? '' : '(fail)'}
                    </span>
                    <span className="text-slate-400">{h.ip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === 'Database' && (
          <div className="text-[12px] space-y-2">
            <p>
              Status: <b className={db?.status === 'up' ? 'text-emerald-600' : 'text-rose-600'}>{db?.status}</b> ·{' '}
              {db?.host}/{db?.name}
            </p>
            <p>
              Pool max {db?.pool?.maxPoolSize} · Indexes {indexes?.totalIndexes ?? '—'} · Unique{' '}
              {indexes?.uniqueConstraints ?? '—'}
            </p>
            <ul className="text-[10px] text-slate-500 list-disc pl-4">
              {(db?.recommendations || []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'Cache & Jobs' && (
          <div className="grid md:grid-cols-2 gap-3 text-[12px]">
            <div>
              <p className="font-semibold">Cache</p>
              <p>
                Driver: {cache?.driver} · hit rate {cache?.hitRate}%
              </p>
              <button
                type="button"
                className="mt-2 text-[10px] px-2 py-1 border rounded"
                onClick={async () => {
                  await stage7Api.cacheClear();
                  setCache(await stage7Api.cacheStats());
                }}
              >
                Clear memory cache
              </button>
            </div>
            <div>
              <p className="font-semibold">Queue</p>
              <pre className="text-[10px] bg-slate-50 p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(queue?.byStatus || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {tab === 'Monitoring' && monitor && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="CPU load%" value={monitor.cpu?.usageHintPct} />
            <Stat label="RSS MB" value={monitor.memory?.rssMb} />
            <Stat label="Heap MB" value={monitor.memory?.heapUsedMb} />
            <Stat label="P95 ms" value={monitor.api?.p95Ms} />
            <Stat label="Errors %" value={monitor.api?.errorRatePct} />
            <Stat label="Requests" value={monitor.api?.requestRateApprox} />
            <Stat label="Budget OK" value={String(monitor.api?.withinBudget)} />
            <Stat label="Node" value={monitor.server?.node} />
          </div>
        )}

        {tab === 'Logs' && (
          <ul className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 text-[11px]">
            {logs.map((l) => (
              <li key={l._id} className="py-1.5">
                <span className="text-slate-400 mr-2">{l.category}</span>
                <span className="font-medium">{l.message}</span>
                <span className="text-slate-400 ml-2">{l.durationMs != null ? `${l.durationMs}ms` : ''}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'Backups' && (
          <div className="space-y-3 text-[12px]">
            <p className="text-[11px] text-slate-500">
              RTO {policy?.rtoMinutes}m · RPO {policy?.rpoMinutes}m · Retention {policy?.retentionDays}d ·{' '}
              {policy?.encryption}
            </p>
            <button
              type="button"
              className="text-[11px] px-3 py-1.5 bg-slate-900 text-white rounded"
              disabled={busy}
              onClick={createBackup}
            >
              Run Manual Backup
            </button>
            <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {backups.map((b) => (
                <li key={b._id} className="py-1.5 flex justify-between">
                  <span>
                    {b.restorePoint} · {b.status}
                  </span>
                  <span className="text-slate-400">{Math.round((b.sizeBytes || 0) / 1024)} KB</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'Certification' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[28px] font-bold">{cert?.score ?? '—'}</p>
                <p className="text-[10px] text-slate-400">
                  Gate {cert?.gate ?? 85} · {cert?.passed ? 'PASSED' : cert ? 'GAPS' : 'Not run'}
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] px-3 py-2 bg-slate-900 text-white rounded"
                disabled={busy}
                onClick={runCert}
              >
                Run Infrastructure Certification
              </button>
            </div>
            {cert?.meta && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                <Stat label="Security" value={`${cert.meta.securityScore ?? '—'}%`} />
                <Stat label="Performance" value={`${cert.meta.performanceScore ?? '—'}%`} />
                <Stat label="Scalability" value={`${cert.meta.scalabilityScore ?? '—'}%`} />
                <Stat label="Reliability" value={`${cert.meta.reliabilityScore ?? '—'}%`} />
                <Stat label="Maintainability" value={`${cert.meta.maintainabilityScore ?? '—'}%`} />
                <Stat label="Production" value={`${cert.meta.productionReadinessScore ?? '—'}%`} />
              </div>
            )}
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-[11px]">
              {(cert?.checklist || []).map((c) => (
                <li key={c.key} className="py-1 flex justify-between">
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
                    {c.status}
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

function Stat({ label, value }) {
  return (
    <div className="border border-slate-100 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-[13px] font-semibold truncate">{value ?? '—'}</p>
    </div>
  );
}
