import React, { useState, useEffect, useRef, useCallback } from 'react';
import useStore from '../../store/useStore';

const HASH_SALT = 'applock-v1';

async function hashPin(pin) {
  const payload = `${pin}::${HASH_SALT}`;
  try {
    if (globalThis.crypto?.subtle?.digest) {
      const data = new TextEncoder().encode(payload);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch { /* fallback */ }
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fb-${(h >>> 0).toString(16)}-${payload.length}`;
}

export function getAppLockConfig() {
  try {
    return {
      enabled: localStorage.getItem('appLock_enabled') === 'true',
      pinHash: localStorage.getItem('appLock_pinHash') || '',
      idleMinutes: parseInt(localStorage.getItem('appLock_idleMinutes') || '0', 10) || 0,
    };
  } catch {
    return { enabled: false, pinHash: '', idleMinutes: 0 };
  }
}

export async function setAppLockPin(pin, idleMinutes = 0) {
  const h = await hashPin(pin);
  localStorage.setItem('appLock_pinHash', h);
  localStorage.setItem('appLock_enabled', 'true');
  localStorage.setItem('appLock_idleMinutes', String(idleMinutes));
}

export function disableAppLock() {
  localStorage.removeItem('appLock_pinHash');
  localStorage.setItem('appLock_enabled', 'false');
}

/** Global lock state — a singleton so any component can trigger a lock */
let _lockCallbacks = [];
let _isLocked = false;

export function lockApp() {
  if (!getAppLockConfig().enabled) return;
  _isLocked = true;
  _lockCallbacks.forEach((cb) => cb(true));
}

export function unlockApp() {
  _isLocked = false;
  _lockCallbacks.forEach((cb) => cb(false));
}

function useLockState() {
  const [locked, setLocked] = useState(_isLocked);
  useEffect(() => {
    _lockCallbacks.push(setLocked);
    return () => { _lockCallbacks = _lockCallbacks.filter((cb) => cb !== setLocked); };
  }, []);
  return [locked, setLocked];
}

/** Idle-lock: fire lockApp() after idleMinutes of no mouse/keyboard activity */
function useIdleLock() {
  const timerRef = useRef(null);
  useEffect(() => {
    const refresh = () => {
      const cfg = getAppLockConfig();
      if (!cfg.enabled || !cfg.idleMinutes || _isLocked) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => lockApp(), cfg.idleMinutes * 60 * 1000);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, refresh, { passive: true }));
    refresh();
    return () => {
      clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, refresh));
    };
  }, []);
}

export default function AppLockScreen() {
  const [locked, setLocked] = useLockState();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef(null);
  const user = useStore((s) => s.user);

  useIdleLock();

  useEffect(() => {
    if (locked) {
      setPin('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [locked]);

  const handleUnlock = useCallback(async () => {
    const cfg = getAppLockConfig();
    if (!cfg.pinHash) { unlockApp(); return; }
    const h = await hashPin(pin);
    if (h === cfg.pinHash) {
      setAttempts(0);
      unlockApp();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setError(next >= 5 ? 'Too many wrong attempts. Logging out…' : 'Incorrect PIN');
      setPin('');
      if (next >= 5) {
        setTimeout(() => {
          useStore.getState().logout?.();
          unlockApp();
        }, 1500);
      }
    }
  }, [pin, attempts]);

  const handleKey = (e) => {
    if (e.key === 'Enter') handleUnlock();
  };

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg-base)]" style={{ backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm mx-auto px-6 py-10 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl text-center">
        <div className="mb-4 mx-auto h-16 w-16 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
          <svg className="h-8 w-8 text-[var(--color-primary)]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-base)] mb-1">Screen Locked</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">{user?.name || 'User'} — enter PIN to continue</p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
          onKeyDown={handleKey}
          placeholder="Enter PIN"
          className="w-full text-center text-xl tracking-[0.5em] px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-base)] focus:outline-none focus:border-[var(--color-primary)] mb-3"
        />
        {error && <p className="text-[var(--color-danger)] text-sm mb-3">{error}</p>}
        <button
          onClick={handleUnlock}
          disabled={pin.length < 4}
          className="w-full py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40"
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
