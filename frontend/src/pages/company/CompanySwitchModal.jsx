import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { authApi } from '../../api/auth.api';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import CompanyMasterModal from './CompanyMasterModal';

const emptyNew = {
  groupCode: '',
  name: '',
  coCode: '',
  workType: '',
  address: '',
  city: '',
  pincode: '',
  phone: '',
  gstin: '',
  pan: '',
  fyFrom: '',
  fyTo: '',
};

const fieldClass = 'w-full h-9 px-2.5 text-[13px] border border-[var(--border)] rounded-md bg-white text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';

function Field({ label, className, children }) {
  return (
    <label className={`flex flex-col gap-1.5 min-w-0 ${className || ''}`}>
      <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

export default function CompanySwitchModal({ isOpen, panel, onClose }) {
  const user = useStore((s) => s.user);
  const setAuth = useStore((s) => s.setAuth);
  const [view, setView] = useState(panel || 'list');
  const [rows, setRows] = useState([]);
  const [groupCode, setGroupCode] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyNew);
  const [year, setYear] = useState({ fyFrom: '', fyTo: '' });
  const isOwner = user?.companyRole === 'owner' || user?.role === 'super_admin';

  useEffect(() => {
    if (!isOpen) return;
    setView(panel || 'list');
  }, [isOpen, panel]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    authApi.listCompanies().then((data) => {
      if (cancelled) return;
      const list = data?.companies || [];
      setRows(list);
      setGroupCode(data?.groupCode || '');
      const current = list.find((row) => String(row.id) === String(user?.companyId));
      setSelected(String(current?.id || list[0]?.id || ''));
      setYear({ fyFrom: current?.fyFrom || '', fyTo: current?.fyTo || '' });
      setForm((prev) => ({ ...prev, groupCode: data?.groupCode || '', fyFrom: current?.fyFrom || '', fyTo: current?.fyTo || '' }));
    }).catch((err) => toast.error(err?.response?.data?.message || err.message || 'Could not load companies'));
    return () => { cancelled = true; };
  }, [isOpen, user?.companyId]);

  const current = rows.find((row) => String(row.id) === String(user?.companyId)) || rows.find((row) => String(row.id) === selected);

  const switchTo = async (id) => {
    if (!id || busy) return;
    if (String(id) === String(user?.companyId)) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const data = await authApi.switchCompany(id);
      const token = useStore.getState().token;
      await setAuth({
        token: data.token || token,
        user: {
          ...user,
          companyId: data.company?.id,
          companyName: data.company?.name,
          company: { ...(user?.company || {}), name: data.company?.name, status: 'active', coCode: data.company?.coCode, groupCode: data.company?.groupCode },
        },
      });
      toast.success(data.company?.name || 'Company opened');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Could not open company');
    } finally {
      setBusy(false);
    }
  };

  const createCompany = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await authApi.createCompany(form);
      toast.success(`${created.name} created. Select it to open.`);
      const data = await authApi.listCompanies();
      setRows(data?.companies || []);
      setSelected(String(created.id));
      setView('list');
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Could not create company');
    } finally {
      setBusy(false);
    }
  };

  const saveYear = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await authApi.updateCompany({ fyFrom: year.fyFrom, fyTo: year.fyTo });
      toast.success(`Year ${saved.year}`);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Could not change year');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || view !== 'list') return;
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    switchTo(selected);
  };

  if (view === 'new' || view === 'master') {
    return (
      <CompanyMasterModal
        isOpen={isOpen}
        initialCompanyId={view === 'master' ? selected : ''}
        onClose={() => {
          setView('list');
          if (panel === 'new' || panel === 'master') {
            onClose();
          }
        }}
      />
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={view === 'year' ? 'Change Year' : view === 'info' ? 'Information' : 'Company'} className="max-w-2xl">
      <div className="px-5 py-4" onKeyDown={onKeyDown}>
        {view === 'list' && (
          <div className="space-y-4">
            <table className="w-full text-xs border border-[var(--border)]">
              <thead className="bg-[var(--bg-subtle)]">
                <tr>
                  <th className="text-left p-2">Company</th>
                  <th className="text-left p-2">Year</th>
                  <th className="text-left p-2">Code</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={String(row.id) === String(selected) ? 'bg-blue-50' : 'hover:bg-[var(--bg-subtle)]'}
                    onClick={() => setSelected(String(row.id))}
                    onDoubleClick={() => switchTo(row.id)}
                  >
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.year}</td>
                    <td className="p-2">{row.coCode}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td className="p-3 text-[var(--text-secondary)]" colSpan={3}>No company on this login.</td></tr>
                )}
              </tbody>
            </table>
            <div className="flex justify-between gap-2">
              <div className="flex items-center gap-2">
                <button type="button" className="h-8 px-3 text-xs border border-[var(--border)] rounded hover:bg-gray-100" onClick={() => setView('new')}>
                  New Company Creation
                </button>
                {selected && (
                  <button type="button" className="h-8 px-3 text-xs border border-[var(--border)] rounded hover:bg-gray-100" onClick={() => setView('master')}>
                    Company Master
                  </button>
                )}
              </div>
              <button type="button" className="h-8 px-4 text-xs rounded bg-[var(--accent)] text-white" disabled={busy} onClick={() => switchTo(selected)}>OK</button>
            </div>
          </div>
        )}

        {view === 'new' && (
          <form className="-mx-5 -my-4 flex flex-col max-h-[calc(100dvh-180px)]" onSubmit={createCompany}>
            <div className="px-5 pt-4 pb-2 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3.5">
              <Field label="Group code" className="sm:col-span-2">
                <input className={fieldClass} value={form.groupCode} onChange={(e) => setForm({ ...form, groupCode: e.target.value.toUpperCase() })} required />
              </Field>
              <Field label="Company name">
                <input className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="Co code">
                <input className={fieldClass} value={form.coCode} onChange={(e) => setForm({ ...form, coCode: e.target.value })} placeholder="auto" />
              </Field>
              <Field label="Type of work">
                <input className={fieldClass} value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <input className={fieldClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label="City">
                <input className={fieldClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="Pin">
                <input className={fieldClass} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </Field>
              <Field label="GST">
                <input className={fieldClass} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="PAN">
                <input className={fieldClass} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="FY from">
                <input className={fieldClass} type="date" value={form.fyFrom} onChange={(e) => setForm({ ...form, fyFrom: e.target.value })} />
              </Field>
              <Field label="FY to">
                <input className={fieldClass} type="date" value={form.fyTo} onChange={(e) => setForm({ ...form, fyTo: e.target.value })} />
              </Field>
              <p className="sm:col-span-2 mt-1 px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)] bg-[var(--bg-subtle)] rounded-md">
                Item, party and book stay shared. Sale, purchase and ledger of this company stay separate. Group code must match {groupCode || 'your login'}.
              </p>
            </div>
            <div className="shrink-0 flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-card)]">
              <button type="button" className="h-9 px-4 text-xs border border-[var(--border)] rounded-md bg-white" onClick={() => setView('list')}>Back</button>
              <button type="submit" className="h-9 px-5 text-xs rounded-md bg-[var(--accent)] text-white disabled:opacity-50" disabled={busy || !isOwner}>Create</button>
            </div>
          </form>
        )}

        {view === 'year' && (
          <form className="space-y-4 max-w-sm" onSubmit={saveYear}>
            <p className="text-xs text-[var(--text-secondary)]">{current?.name || 'Open company'} — year only. Company does not change.</p>
            <Field label="From">
              <input className={fieldClass} type="date" value={year.fyFrom} onChange={(e) => setYear({ ...year, fyFrom: e.target.value })} required />
            </Field>
            <Field label="To">
              <input className={fieldClass} type="date" value={year.fyTo} onChange={(e) => setYear({ ...year, fyTo: e.target.value })} required />
            </Field>
            <div className="flex justify-end pt-1">
              <button type="submit" className="h-9 px-5 text-xs rounded-md bg-[var(--accent)] text-white disabled:opacity-50" disabled={busy || !isOwner}>OK</button>
            </div>
          </form>
        )}

        {view === 'info' && (
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs">
            <div><dt className="text-[var(--text-secondary)]">Customer ID</dt><dd className="font-medium break-all">{current?.id || user?.companyId || '—'}</dd></div>
            <div><dt className="text-[var(--text-secondary)]">Licence</dt><dd className="font-medium break-all">{current?.licenseKey || '—'}</dd></div>
            <div><dt className="text-[var(--text-secondary)]">Group code</dt><dd className="font-medium">{groupCode || current?.groupCode || '—'}</dd></div>
            <div><dt className="text-[var(--text-secondary)]">Co code</dt><dd className="font-medium">{current?.coCode || '—'}</dd></div>
            <div className="col-span-2"><dt className="text-[var(--text-secondary)]">Company</dt><dd className="font-medium">{current?.name} · {current?.year}</dd></div>
          </dl>
        )}
      </div>
    </Modal>
  );
}
