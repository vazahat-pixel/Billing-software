import React, { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { getAppLockConfig, setAppLockPin, disableAppLock, lockApp } from './AppLockScreen';
import useToastStore from '../../store/useToastStore';

const IDLE_CHOICES = [
  { value: 0, label: 'Never (manual lock only)' },
  { value: 5, label: 'After 5 minutes idle' },
  { value: 15, label: 'After 15 minutes idle' },
  { value: 30, label: 'After 30 minutes idle' },
  { value: 60, label: 'After 1 hour idle' },
];

export default function AppLockSettings({ canEdit }) {
  const toast = useToastStore();
  const [cfg, setCfg] = useState(getAppLockConfig());
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [idleMinutes, setIdleMinutes] = useState(cfg.idleMinutes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = getAppLockConfig();
    setCfg(c);
    setIdleMinutes(c.idleMinutes);
  }, []);

  const handleSave = async () => {
    if (pin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    if (pin !== confirmPin) { toast.error('PIN and confirm PIN do not match'); return; }
    setSaving(true);
    try {
      await setAppLockPin(pin, idleMinutes);
      setCfg(getAppLockConfig());
      setPin('');
      setConfirmPin('');
      toast.success('App Lock enabled. This PIN will be asked when the screen locks.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = () => {
    disableAppLock();
    setCfg(getAppLockConfig());
    toast.success('App Lock disabled');
  };

  const handleIdleChange = async (mins) => {
    setIdleMinutes(mins);
    if (cfg.enabled) {
      localStorage.setItem('appLock_idleMinutes', String(mins));
      setCfg(getAppLockConfig());
      toast.success('Auto-lock timing updated');
    }
  };

  if (!canEdit) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">
        Only the Owner or an Admin can change the App Lock settings.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-base)] flex items-center gap-2">
          {cfg.enabled ? <Lock className="h-4 w-4 text-[var(--color-success)]" /> : <Unlock className="h-4 w-4 text-[var(--text-muted)]" />}
          App Lock {cfg.enabled ? '— ON' : '— OFF'}
        </h3>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Locks the screen with a PIN so nobody can see or change entries when you step away from the
          computer. Your data keeps working normally — this only hides the screen.
        </p>
      </div>

      {cfg.enabled ? (
        <>
          <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
            <label className="block text-sm font-medium text-[var(--text-base)]">Auto-lock</label>
            <select
              value={idleMinutes}
              onChange={(e) => handleIdleChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-base)]"
            >
              {IDLE_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => lockApp()}
              className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold"
            >
              Lock screen now
            </button>
            <button
              onClick={handleDisable}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-base)] text-sm font-semibold"
            >
              Turn App Lock off
            </button>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
            <label className="block text-sm font-medium text-[var(--text-base)]">Change PIN</label>
            <input
              type="password" inputMode="numeric" maxLength={8} placeholder="New PIN (4-8 digits)"
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-base)]"
            />
            <input
              type="password" inputMode="numeric" maxLength={8} placeholder="Confirm new PIN"
              value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-base)]"
            />
            <button
              onClick={handleSave} disabled={saving || pin.length < 4}
              className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-40"
            >
              Save new PIN
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
          <input
            type="password" inputMode="numeric" maxLength={8} placeholder="Set PIN (4-8 digits)"
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-base)]"
          />
          <input
            type="password" inputMode="numeric" maxLength={8} placeholder="Confirm PIN"
            value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-base)]"
          />
          <select
            value={idleMinutes} onChange={(e) => setIdleMinutes(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-base)]"
          >
            {IDLE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button
            onClick={handleSave} disabled={saving || pin.length < 4}
            className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-40"
          >
            Turn App Lock on
          </button>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        The PIN is stored only on this computer. If you forget it, 5 wrong tries will log you out and
        you can sign in again with your normal email and password.
      </p>
    </div>
  );
}
