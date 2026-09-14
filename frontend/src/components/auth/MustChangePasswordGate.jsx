import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { post, unwrap } from '../../api/http';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';

/**
 * Blocks the ERP until invited users set a new password.
 * Does not alter any business transaction screens.
 */
const MustChangePasswordGate = ({ children }) => {
  const user = useStore((s) => s.user);
  const setAuth = useStore((s) => s.setAuth);
  const token = useStore((s) => s.token);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user?.mustChangePassword) return children;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await unwrap(post('/auth/change-password', { newPassword: password }));
      await setAuth({ token, user: { ...user, mustChangePassword: false } });
      toast.success('Password updated');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-300">
            <Lock size={18} />
          </div>
          <div>
            <h2 className="font-black text-white">Set a new password</h2>
            <p className="text-xs text-slate-500">Your admin invited you — please choose your own password before continuing.</p>
          </div>
        </div>
        {error && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{error}</div>}
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500"
        />
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Save & continue
        </button>
      </form>
    </div>
  );
};

export default MustChangePasswordGate;
