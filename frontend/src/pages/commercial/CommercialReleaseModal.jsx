import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { stage8Api } from '../../api/stage8.api';
import { toast } from '../../store/useToastStore';

const TABS = [
  'Overview',
  'Business Flows',
  'QA',
  'License',
  'Onboarding',
  'Desktop',
  'Release',
  'Certification',
];

/**
 * Stage 8 — Commercial Release & Production Certification workspace.
 */
export default function CommercialReleaseModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('Overview');
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState(null);
  const [flows, setFlows] = useState(null);
  const [qa, setQa] = useState(null);
  const [license, setLicense] = useState(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem('erp_device_id') || `web-${Date.now()}`);
  const [onb, setOnb] = useState(null);
  const [desktop, setDesktop] = useState(null);
  const [version, setVersion] = useState(null);
  const [cert, setCert] = useState(null);

  const refresh = async () => {
    try {
      const map = {
        Overview: async () => setOverview(await stage8Api.overview()),
        'Business Flows': async () => setFlows(await stage8Api.flowCertify()),
        QA: async () => setQa(await stage8Api.qaSmoke()),
        License: async () => setLicense(await stage8Api.licenseStatus()),
        Onboarding: async () => setOnb(await stage8Api.onboarding()),
        Desktop: async () => setDesktop(await stage8Api.desktop()),
        Release: async () => setVersion(await stage8Api.releaseVersion()),
        Certification: async () => setCert(await stage8Api.certificationLatest()),
      };
      await (map[tab] || map.Overview)();
    } catch {
      /* partial */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTab('Overview');
    localStorage.setItem('erp_device_id', deviceId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
  }, [isOpen, tab]);

  const runCert = async () => {
    setBusy(true);
    try {
      const report = await stage8Api.certificationRun();
      setCert(report);
      toast.success(
        report.passed
          ? `v1.0 APPROVED — score ${report.score}`
          : `Commercial score ${report.score} — gaps remain`
      );
    } catch (e) {
      toast.error(e.message || 'Certification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Commercial Release — Version 1.0" className="max-w-5xl">
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

        {tab === 'Overview' && overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
            <Card label="Product" value={overview.version?.product || '1.0.0'} />
            <Card label="License" value={overview.license?.active ? 'Active' : 'Inactive'} />
            <Card label="Onboarding" value={`${overview.onboarding?.progressPct ?? 0}%`} />
            <Card label="Desktop" value={overview.desktop?.electron ? 'Ready' : 'Scaffold'} />
            <p className="col-span-full text-[11px] text-slate-500 mt-2">
              Stage 8 packages Stages 1–7 for commercial distribution. Run Certification for v1.0 approval.
            </p>
          </div>
        )}

        {tab === 'Business Flows' && (
          <div className="space-y-2 text-[12px]">
            <p>
              Score: <b>{flows?.score ?? '—'}</b> · {flows?.passed ? 'PASSED' : 'NEEDS DATA'}
            </p>
            <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-[11px]">
              {(flows?.checks || []).map((c) => (
                <li key={c.key} className="py-1 flex justify-between gap-2">
                  <span>{c.label}</span>
                  <span className={c.status === 'pass' ? 'text-emerald-600' : 'text-amber-600'}>
                    {c.status} · {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'QA' && (
          <div className="text-[12px] space-y-2">
            <p>
              Smoke score: <b>{qa?.score ?? '—'}</b>
            </p>
            <ul className="text-[11px] space-y-1">
              {(qa?.results || []).map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span>{r.id}</span>
                  <span className={r.status === 'pass' ? 'text-emerald-600' : 'text-rose-600'}>{r.status}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="text-[10px] px-2 py-1 border rounded"
              onClick={async () => setQa(await stage8Api.qaSmoke())}
            >
              Re-run smoke
            </button>
          </div>
        )}

        {tab === 'License' && (
          <div className="space-y-3 text-[12px]">
            <p>
              Status:{' '}
              <b className={license?.active ? 'text-emerald-600' : 'text-amber-600'}>
                {license?.active ? 'ACTIVE' : 'INACTIVE'}
              </b>
              {license?.inGrace ? ' (grace)' : ''} · Devices {license?.devices}/{license?.maxDevices}
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex flex-col gap-1 text-[10px]">
                License key
                <input
                  className="border rounded px-2 py-1 text-[12px] w-56"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="CMP-XXXX-YYYY"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px]">
                Device ID
                <input
                  className="border rounded px-2 py-1 text-[12px] w-44"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="text-[11px] px-3 py-1.5 bg-slate-900 text-white rounded"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    localStorage.setItem('erp_device_id', deviceId);
                    setLicense(
                      await stage8Api.licenseActivate({
                        licenseKey,
                        deviceId,
                        deviceName: navigator.userAgent.slice(0, 40),
                      })
                    );
                    toast.success('License activated');
                  } catch (e) {
                    toast.error(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Activate Online
              </button>
            </div>
          </div>
        )}

        {tab === 'Onboarding' && (
          <div className="space-y-3 text-[12px]">
            <p>
              Progress: <b>{onb?.progressPct ?? 0}%</b> · Status {onb?.status} · ETA{' '}
              {onb?.estimatedMinutesLeft ?? '—'} min (target 15)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-[11px] px-3 py-1.5 bg-slate-900 text-white rounded"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setOnb(await stage8Api.onboardingQuick({}));
                    toast.success('Quick setup completed');
                    window.dispatchEvent(new CustomEvent('erp:onboarding-complete'));
                  } catch (e) {
                    toast.error(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Run Quick Setup
              </button>
              <button
                type="button"
                className="text-[11px] px-3 py-1.5 border rounded"
                onClick={async () => {
                  setOnb(await stage8Api.onboardingSkip());
                  toast.info('Onboarding skipped');
                }}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {tab === 'Desktop' && (
          <div className="text-[12px] space-y-1">
            <p>Scaffold: {String(desktop?.scaffold)}</p>
            <p>Electron: {String(desktop?.electron)}</p>
            <p>Installer config: {String(desktop?.installerConfig)}</p>
            <p>Auto-update: {String(desktop?.autoUpdate)}</p>
            <p className="text-[11px] text-slate-500">See desktop/README.md for NSIS build steps.</p>
          </div>
        )}

        {tab === 'Release' && (
          <div className="text-[12px] space-y-2">
            <p>
              Version <b>{version?.product}</b> · {version?.codename}
            </p>
            <button
              type="button"
              className="text-[10px] px-2 py-1 border rounded"
              onClick={async () => {
                await stage8Api.releaseEnsureV1();
                toast.success('v1.0 release record ensured');
              }}
            >
              Ensure v1.0 Record
            </button>
          </div>
        )}

        {tab === 'Certification' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[28px] font-bold">{cert?.score ?? '—'}</p>
                <p className="text-[10px] text-slate-400">
                  {cert?.meta?.releaseCandidate || 'PENDING'} · Gate {cert?.gate ?? 85}
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] px-3 py-2 bg-slate-900 text-white rounded"
                disabled={busy}
                onClick={runCert}
              >
                Run Commercial Certification
              </button>
            </div>
            {cert?.meta && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <Card label="Business" value={`${cert.meta.businessScore ?? '—'}%`} />
                <Card label="Quality" value={`${cert.meta.qualityScore ?? '—'}%`} />
                <Card label="Commercial" value={`${cert.meta.commercialScore ?? '—'}%`} />
                <Card label="Production" value={`${cert.meta.productionScore ?? '—'}%`} />
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

function Card({ label, value }) {
  return (
    <div className="border border-slate-100 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-[13px] font-semibold truncate">{value}</p>
    </div>
  );
}
