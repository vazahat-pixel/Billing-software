import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Lock, Loader2, ArrowRight, FileJson, ShieldCheck, Building } from 'lucide-react';
import client from '../../api/client';
import { isDesktopShell } from '../../utils/desktopMode';
import { getDeviceIdentity } from '../../utils/deviceIdentity';
import { saveOfflineCredential } from '../../utils/offlineAuth';
import { loginWithOfflineSupport } from '../../utils/loginService';
import useStore from '../../store/useStore';

/**
 * Desktop first-run: import Super-Admin provisioning pack → set owner password → activate.
 * No public register / local company creation.
 */
const DesktopActivatePage = () => {
  const navigate = useNavigate();
  const setAuth = useStore((s) => s.setAuth);
  const fileRef = useRef(null);

  const [step, setStep] = useState('import'); // import | review | password | done
  const [pack, setPack] = useState(null);
  const [summary, setSummary] = useState(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isDesktopShell()) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const local = window.textileDesktop?.isLocalSync?.();
        if (local === false) {
          navigate('/login', { replace: true });
          return;
        }
        const { data } = await client.get('/desktop/activation-status');
        const status = data?.data || data;
        if (!cancelled && status?.activated) {
          navigate('/login', { replace: true });
        }
      } catch {
        /* remote / API without DESKTOP_LOCAL → go login */
        if (!cancelled) {
          const local = window.textileDesktop?.isLocalSync?.();
          if (local === false) navigate('/login', { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const packObj = parsed.payload && parsed.signature ? parsed : parsed.pack || parsed;
      const { data } = await client.post('/desktop/validate-pack', { pack: packObj });
      const s = data?.data || data;
      setPack(packObj);
      setSummary(s);
      setStep('review');
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Invalid provisioning pack'
      );
      setPack(null);
      setSummary(null);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onActivate = async (e) => {
    e.preventDefault();
    if (password !== password2) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const identity = await getDeviceIdentity();
      const { data } = await client.post('/desktop/activate', {
        pack,
        password,
        deviceId: identity?.deviceId || identity?.fingerprint || 'desktop-unknown',
        deviceName: 'Textile ERP Desktop',
      });
      const result = data?.data || data;
      try {
        await window.textileDesktop?.markSetupDone?.();
      } catch {
        /* ignore */
      }

      const ownerEmail = result?.ownerEmail || summary?.ownerEmail;
      if (ownerEmail) {
        const { token, user } = await loginWithOfflineSupport({ email: ownerEmail, password });
        await saveOfflineCredential(ownerEmail, password, { token, user });
        await setAuth({ token, user });
        navigate('/', { replace: true });
        return;
      }
      setStep('done');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Activation failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-[2rem]">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-teal-600 to-teal-400 rounded-2xl flex items-center justify-center text-white mb-4">
            <LayoutDashboard size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Activate Textile ERP</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Import the provisioning pack from your Super Admin. No internet needed after activation.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl text-center">
            {error}
          </div>
        )}

        {step === 'import' && (
          <div className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={onFile}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
              className="w-full bg-black hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <FileJson size={18} />
                  Import Provisioning Pack
                </>
              )}
            </button>
          </div>
        )}

        {step === 'review' && summary && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2 text-white font-bold">
                <Building size={16} />
                {summary.companyName}
              </div>
              <p>
                <span className="text-slate-500">Plan:</span> {summary.planName || '—'}
              </p>
              <p className="font-mono text-xs break-all">
                <span className="text-slate-500">License:</span> {summary.licenseKey}
              </p>
              <p>
                <span className="text-slate-500">Owner:</span> {summary.ownerEmail}
              </p>
              <p>
                <span className="text-slate-500">Expires:</span>{' '}
                {summary.expiresAt ? new Date(summary.expiresAt).toLocaleDateString() : '—'}
              </p>
              <p className="flex items-center gap-1 text-teal-400 text-xs">
                <ShieldCheck size={14} /> Pack signature valid
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('password')}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setPack(null);
                setSummary(null);
                setStep('import');
              }}
              className="w-full text-slate-400 text-sm hover:text-white"
            >
              Choose a different pack
            </button>
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={onActivate} className="space-y-4">
            <p className="text-slate-400 text-sm text-center">
              Set the local password for <strong className="text-white">{summary?.ownerEmail}</strong>
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Password</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 text-white pl-10 pr-3 py-3 rounded-xl outline-none"
                />
              </div>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confirm</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 text-white pl-10 pr-3 py-3 rounded-xl outline-none"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  Activate
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-slate-500 text-sm">
          Already activated?{' '}
          <Link to="/login" className="text-slate-300 hover:text-white">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default DesktopActivatePage;
