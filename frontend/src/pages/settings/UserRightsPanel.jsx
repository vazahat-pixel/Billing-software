import React, { useEffect, useState } from 'react';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { notifyWarning, notifyError } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import { UserPlus, Shield, Trash2 } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin — Full access' },
  { value: 'accountant', label: 'Accountant — Accounts & reports' },
  { value: 'sales', label: 'Sales — Billing & parties' },
  { value: 'viewer', label: 'Viewer — Read only' },
];

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  sales: 'Sales',
  viewer: 'Viewer',
};

/** User management panel — embedded in Company Settings */
const UserRightsPanel = ({ active }) => {
  const { user, companyUsers, fetchCompanyUsers, addCompanyUser, deactivateCompanyUser } = useStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', companyRole: 'sales' });
  const [saving, setSaving] = useState(false);

  const canManage = ['owner', 'admin'].includes(user?.companyRole || 'owner') || user?.role === 'super_admin';

  useEffect(() => {
    if (active && canManage) fetchCompanyUsers();
  }, [active, canManage, fetchCompanyUsers]);

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) {
      return notifyWarning('Name, email and password are required');
    }
    setSaving(true);
    try {
      await addCompanyUser(form);
      setForm({ name: '', email: '', password: '', companyRole: 'sales' });
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id, name) => {
    if (!(await erpConfirm({
      title: 'Deactivate User',
      message: `Deactivate user "${name}"?`,
      confirmLabel: 'Deactivate',
      danger: true,
    }))) return;
    try {
      await deactivateCompanyUser(id);
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-3 erp-card">
        <Shield size={18} className="text-[var(--accent)]" />
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Logged in as</p>
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">
            {user?.name || '—'} — {ROLE_LABELS[user?.companyRole || 'owner']}
          </p>
        </div>
      </div>

      {!canManage ? (
        <p className="text-[11px] text-[var(--text-muted)] text-center py-6">
          Only Owner or Admin can manage company users.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Company Users
            </h4>
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-[var(--bg-subtle)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Email</th>
                    <th className="px-3 py-2 text-left font-semibold">Role</th>
                    <th className="px-3 py-2 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  <tr className="bg-[var(--bg-subtle)]/50">
                    <td className="px-3 py-2 font-medium">{user?.name || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)]">{user?.email || '—'}</td>
                    <td className="px-3 py-2 uppercase font-semibold">{ROLE_LABELS[user?.companyRole || 'owner']}</td>
                    <td className="px-3 py-2 text-center text-[var(--text-muted)]">—</td>
                  </tr>
                  {companyUsers.map((u) => (
                    <tr key={u._id || u.id}>
                      <td className="px-3 py-2 font-medium">{u.name}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{u.email}</td>
                      <td className="px-3 py-2 uppercase font-semibold">{ROLE_LABELS[u.companyRole] || u.companyRole}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeactivate(u._id || u.id, u.name)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Deactivate user"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {companyUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-5 text-center text-[var(--text-muted)]">
                        No additional users yet. Add one below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
              <UserPlus size={13} /> Add New User
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Full Name</label>
                <ERPInput className="w-full mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Email</label>
                <ERPInput type="email" className="w-full mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Password</label>
                <ERPInput type="password" className="w-full mt-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-muted)]">Role</label>
                <ERPSelect className="w-full mt-1" value={form.companyRole} onChange={(e) => setForm({ ...form, companyRole: e.target.value })} options={ROLE_OPTIONS} />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="erp-btn erp-btn-primary w-full sm:w-auto h-9 px-6 text-[11px]"
            >
              {saving ? 'Creating…' : 'Create User Account'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UserRightsPanel;
