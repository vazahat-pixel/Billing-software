import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { UserPlus, Shield, Trash2 } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin — Full access' },
  { value: 'accountant', label: 'Accountant — Accounts & reports' },
  { value: 'sales', label: 'Sales — Billing & parties' },
  { value: 'viewer', label: 'Viewer — Read only' }
];

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  sales: 'Sales',
  viewer: 'Viewer'
};

const UserRightsModal = ({ isOpen, onClose }) => {
  const { user, companyUsers, fetchCompanyUsers, addCompanyUser, deactivateCompanyUser } = useStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', companyRole: 'sales' });
  const [saving, setSaving] = useState(false);

  const canManage = ['owner', 'admin'].includes(user?.companyRole || 'owner');

  useEffect(() => {
    if (isOpen && canManage) fetchCompanyUsers();
  }, [isOpen, canManage, fetchCompanyUsers]);

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) {
      return alert('Name, email and password are required');
    }
    setSaving(true);
    try {
      await addCompanyUser(form);
      setForm({ name: '', email: '', password: '', companyRole: 'sales' });
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id, name) => {
    if (!confirm(`Deactivate user "${name}"?`)) return;
    try {
      await deactivateCompanyUser(id);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Rights & Roles" className="max-w-3xl">
      <div className="p-6 space-y-8">
        <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
          <Shield size={20} className="text-black" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black">Logged in as</p>
            <p className="text-sm font-bold">{user?.name} — {ROLE_LABELS[user?.companyRole || 'owner']}</p>
          </div>
        </div>

        {!canManage ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Only Owner or Admin can manage company users.
          </p>
        ) : (
          <>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-black">Company Users</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-black text-white">
                    <tr>
                      <th className="px-4 py-2 text-left font-black uppercase tracking-widest">Name</th>
                      <th className="px-4 py-2 text-left font-black uppercase tracking-widest">Email</th>
                      <th className="px-4 py-2 text-left font-black uppercase tracking-widest">Role</th>
                      <th className="px-4 py-2 text-center font-black uppercase tracking-widest">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3 font-bold">{user?.name}</td>
                      <td className="px-4 py-3 text-slate-500">{user?.email || '—'}</td>
                      <td className="px-4 py-3 font-black uppercase">{ROLE_LABELS[user?.companyRole || 'owner']}</td>
                      <td className="px-4 py-3 text-center text-slate-300">—</td>
                    </tr>
                    {companyUsers.map((u) => (
                      <tr key={u._id || u.id}>
                        <td className="px-4 py-3 font-bold">{u.name}</td>
                        <td className="px-4 py-3 text-slate-500">{u.email}</td>
                        <td className="px-4 py-3 font-black uppercase">{ROLE_LABELS[u.companyRole] || u.companyRole}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeactivate(u._id || u.id, u.name)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                            title="Deactivate user"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {companyUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                          No additional users yet. Add one below.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-2">
                <UserPlus size={14} /> Add New User
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Full Name</label>
                  <ERPInput className="w-full mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Email</label>
                  <ERPInput type="email" className="w-full mt-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Password</label>
                  <ERPInput type="password" className="w-full mt-1" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Role</label>
                  <ERPSelect className="w-full mt-1" value={form.companyRole} onChange={e => setForm({ ...form, companyRole: e.target.value })} options={ROLE_OPTIONS} />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving}
                className="w-full py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create User Account'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default UserRightsModal;
