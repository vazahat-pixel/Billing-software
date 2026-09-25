import React, { useEffect, useState } from 'react';
import { ERPInput } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { notifyError, notifyWarning } from '../../utils/notify';
import { toast } from '../../store/useToastStore';

export const CA_DESK_SECTIONS = [
  { id: 'gstr1', label: 'GSTR-1' },
  { id: 'gstr2', label: 'GSTR-2 / ITC' },
  { id: 'gstr3b', label: 'GSTR-3B' },
  { id: 'sales', label: 'Sales Register' },
  { id: 'purchase', label: 'Purchase Register' },
  { id: 'outstanding', label: 'Outstanding' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'job', label: 'Mill / Job' },
  { id: 'registers', label: 'Returns & Notes' },
  { id: 'daily', label: 'Day Book' },
  { id: 'alerts', label: 'Alerts' },
];

const CaAccessPanel = ({ active, settings, setSetting, onSave, saving, canEdit }) => {
  const { companyUsers, fetchCompanyUsers, addCompanyUser, updateCompanyUser } = useStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [reset, setReset] = useState({});
  const [busy, setBusy] = useState(false);

  const caUsers = (companyUsers || []).filter((u) => u.companyRole === 'ca' && u.isActive !== false);
  const flags = settings?.caDesk || {};

  useEffect(() => {
    if (active && canEdit) fetchCompanyUsers();
  }, [active, canEdit, fetchCompanyUsers]);

  const toggle = (id, show) => {
    setSetting('caDesk', { ...flags, [id]: show });
  };

  const createCa = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return notifyWarning('CA name, login id (email) and password are required');
    }
    setBusy(true);
    try {
      await addCompanyUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        companyRole: 'ca',
      });
      setForm({ name: '', email: '', password: '' });
      toast.success('CA login created. Give this email and password to your CA.');
    } catch (err) {
      notifyError(err, 'Could not create CA login');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (user) => {
    const password = String(reset[user._id || user.id] || '');
    if (password.length < 8) return notifyWarning('New password must be at least 8 characters');
    setBusy(true);
    try {
      await updateCompanyUser(user._id || user.id, { password });
      setReset((s) => ({ ...s, [user._id || user.id]: '' }));
      toast.success(`Password updated for ${user.name}`);
    } catch (err) {
      notifyError(err, 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) {
    return <p className="text-[12px] text-[var(--text-muted)]">Only the company owner or admin can set CA access.</p>;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">CA Access</p>
          <p className="text-[11px] text-[var(--text-muted)]">Create a login for your CA, then choose what they can see in CA Desk.</p>
        </div>
        <button type="button" onClick={onSave} disabled={saving} className="erp-btn erp-btn-primary h-8 px-3 text-[11px]">
          {saving ? 'Saving…' : 'Save visibility'}
        </button>
      </div>

      <div className="border border-[var(--border)] rounded-md p-3 space-y-2 bg-[var(--bg-card)]">
        <p className="text-[11px] font-semibold">New CA login</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ERPInput placeholder="CA name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <ERPInput placeholder="Login email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <ERPInput type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="button" onClick={createCa} disabled={busy} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">
          Create CA login
        </button>
      </div>

      {caUsers.map((u) => (
        <div key={u._id || u.id} className="border border-[var(--border)] rounded-md p-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[180px]">
            <p className="text-[12px] font-semibold">{u.name}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{u.email}</p>
          </div>
          <ERPInput
            type="password"
            className="w-44"
            placeholder="New password"
            value={reset[u._id || u.id] || ''}
            onChange={(e) => setReset((s) => ({ ...s, [u._id || u.id]: e.target.value }))}
          />
          <button type="button" onClick={() => changePassword(u)} disabled={busy} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">
            Change password
          </button>
        </div>
      ))}

      <div className="border border-[var(--border)] rounded-md divide-y divide-[var(--border-subtle)]">
        {CA_DESK_SECTIONS.map((row) => {
          const shown = flags[row.id] !== false;
          return (
            <div key={row.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-[12px]">{row.label}</span>
              <button
                type="button"
                onClick={() => toggle(row.id, !shown)}
                className={`h-7 px-3 rounded text-[11px] font-semibold ${shown ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
              >
                {shown ? 'Show' : 'Hide'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CaAccessPanel;
