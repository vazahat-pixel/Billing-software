import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import useStore from '../../store/useStore';
import { loginWithOfflineSupport } from '../../utils/loginService';
import { logoutWithSync } from '../../utils/safeLogout';
import ErpTopLayer from '../erp/ErpTopLayer';

/**
 * Shown over the current screen when the login could not be renewed ('erp-session-expired', raised
 * by the API client after a refused token refresh). The user types the password and carries on —
 * the open bill, its typed values and the offline upload queue are untouched.
 */
export default function SessionExpiredModal() {
  const user = useStore((s) => s.user);
  const setAuth = useStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onExpired = () => {
      setOpen(true);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener('erp-session-expired', onExpired);
    return () => window.removeEventListener('erp-session-expired', onExpired);
  }, []);

  // A successful refresh elsewhere (other tab / retry) closes the prompt.
  useEffect(() => {
    const onRefreshed = () => setOpen(false);
    window.addEventListener('erp-token-refreshed', onRefreshed);
    return () => window.removeEventListener('erp-token-refreshed', onRefreshed);
  }, []);

  if (!open) return null;

  const email = user?.email || localStorage.getItem('last_login_email') || '';

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const { token, user: freshUser } = await loginWithOfflineSupport({ email, password });
      if (user?.companyId && freshUser?.companyId && String(user.companyId) !== String(freshUser.companyId)) {
        // Default company differs from the one open on screen — use the full login to choose.
        throw new Error('This login opens a different company. Please use Logout and log in again.');
      }
      await setAuth({ token, user: freshUser });
      setPassword('');
      setOpen(false);
      window.dispatchEvent(new CustomEvent('erp-token-refreshed', { detail: { token } }));
    } catch (err) {
      setError(err.requires2fa ? 'Two-step code needed — please use Logout and log in from the login page.' : (err.message || 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (await logoutWithSync()) {
      setOpen(false);
      navigate('/login');
    }
  };

  return (
    <ErpTopLayer>
      <div className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/50 p-4" data-session-expired>
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-slate-300 overflow-hidden"
        >
          <div className="bg-[#1a3353] text-white px-4 py-3 flex items-center gap-2">
            <LockKeyhole size={16} />
            <span className="text-sm font-bold">Session expired — please log in again</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-[12px] text-slate-600">
              Your open screen and unsaved entries are kept. Enter your password to continue.
              <br />
              <span className="text-slate-500">Password daal kar wahi se kaam chalu rakhein.</span>
            </p>
            <div className="text-[12px]">
              <span className="font-semibold text-slate-700">User:</span> {email || '—'}
            </div>
            <input
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-9 px-3 border-2 border-blue-600 rounded text-sm outline-none"
            />
            {error && <p className="text-[12px] text-rose-600">{error}</p>}
          </div>
          <div className="flex gap-2 p-3 border-t border-slate-100 bg-slate-50">
            <button
              type="submit"
              disabled={busy || !password || !email}
              className="flex-1 h-9 rounded-lg bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {busy ? 'Logging in…' : 'Log in & continue'}
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={busy}
              className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
            >
              Logout
            </button>
          </div>
        </form>
      </div>
    </ErpTopLayer>
  );
}
