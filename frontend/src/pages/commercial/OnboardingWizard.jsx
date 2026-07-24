import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { stage8Api } from '../../api/stage8.api';
import { toast } from '../../store/useToastStore';

/**
 * Stage 8.8 — Welcome / onboarding wizard (< 15 min target).
 */
export default function OnboardingWizard({ isOpen, onClose }) {
  const [wizard, setWizard] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [legalName, setLegalName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([stage8Api.onboardingWizard(), stage8Api.onboarding()]).then(([w, s]) => {
      setWizard(w);
      setStatus(s);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const nextPending = wizard?.steps?.find((s) => !status?.steps?.[s.key]);

  const completeCurrent = async () => {
    if (!nextPending) return;
    setBusy(true);
    try {
      const payload =
        nextPending.key === 'companyProfile'
          ? { legalName: legalName || 'My Company', companyName: legalName }
          : {};
      const s = await stage8Api.onboardingStep({ step: nextPending.key, payload });
      setStatus(s);
      if (s.status === 'completed') {
        toast.success('Onboarding complete — you are ready to bill');
        onClose?.();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Welcome — Setup Wizard" className="max-w-lg">
      <div className="space-y-4 text-[12px]">
        <p className="text-[11px] text-slate-500">
          Target under {wizard?.targetMinutes || 15} minutes · Progress {status?.progressPct ?? 0}%
        </p>
        <ol className="space-y-1">
          {(wizard?.steps || []).map((s) => (
            <li
              key={s.key}
              className={`flex justify-between px-2 py-1 rounded ${
                status?.steps?.[s.key] ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50'
              }`}
            >
              <span>{s.title}</span>
              <span className="text-[10px]">{status?.steps?.[s.key] ? 'Done' : `~${s.minutes}m`}</span>
            </li>
          ))}
        </ol>
        {nextPending?.key === 'companyProfile' && (
          <label className="flex flex-col gap-1 text-[10px]">
            Legal / Company name
            <input
              className="border rounded px-2 py-1.5 text-[12px]"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Your company name"
            />
          </label>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="text-[11px] px-3 py-1.5 border rounded"
            onClick={async () => {
              await stage8Api.onboardingSkip();
              onClose?.();
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            className="text-[11px] px-3 py-1.5 border rounded"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setStatus(await stage8Api.onboardingQuick({ legalName, companyName: legalName }));
                toast.success('Quick setup done');
                onClose?.();
              } catch (e) {
                toast.error(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Quick Setup All
          </button>
          {nextPending && (
            <button
              type="button"
              className="text-[11px] px-3 py-1.5 bg-slate-900 text-white rounded"
              disabled={busy}
              onClick={completeCurrent}
            >
              Complete: {nextPending.title}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
