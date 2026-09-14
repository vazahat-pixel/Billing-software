import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Play, Clock } from 'lucide-react';
import { adminApi } from '../../api';
import { AdminPageHeader, AdminButton, AdminBadge } from '../../components/admin/AdminUI';
import { notifyError, notifySuccess } from '../../utils/notify';

const statusVariant = (s) => {
  if (s === 'active' || s === 'trial') return 'success';
  if (s === 'grace') return 'warning';
  if (s === 'expired' || s === 'suspended') return 'danger';
  return 'warning';
};

const Lifecycle = () => {
  const [rows, setRows] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [dunningBusy, setDunningBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.lifecycle(days);
      const list = Array.isArray(data) ? data : (data?.rows || data?.companies || []);
      setRows(list);
    } catch (err) {
      notifyError(err, 'Failed to load lifecycle');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  const attention = useMemo(
    () => rows.filter((r) => ['grace', 'expired', 'suspended'].includes(r.status) || (r.daysLeft != null && r.daysLeft <= 14)),
    [rows]
  );

  const runDunning = async () => {
    setDunningBusy(true);
    try {
      const result = await adminApi.runDunning();
      notifySuccess(`Dunning done — reminded ${result?.reminded || 0}, suspended ${result?.suspended || 0}`);
      await load();
    } catch (err) {
      notifyError(err, 'Dunning failed');
    } finally {
      setDunningBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Subscription Lifecycle"
        subtitle="Who is expiring, in grace, or locked — chase renewals before customers call"
        actions={
          <div className="flex gap-2">
            <AdminButton icon={RefreshCw} onClick={load} disabled={loading}>Refresh</AdminButton>
            <AdminButton icon={Play} onClick={runDunning} disabled={dunningBusy}>
              Run Dunning
            </AdminButton>
          </div>
        }
      />

      <div className="admin-toolbar flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-400 font-bold flex items-center gap-2">
          <Clock size={14} /> Window (days)
          <select
            className="dark-input"
            style={{ width: 100 }}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-500 font-bold flex items-center gap-1">
          <AlertTriangle size={12} className="text-amber-400" />
          {attention.length} need attention · {rows.length} total
        </span>
      </div>

      <div className="admin-table-wrap overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              {['Company', 'Plan', 'Status', 'Days left', 'Blocked modules', 'Usage'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">No companies in this window</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.companyId || r._id}>
                  <td className="font-bold text-slate-200">{r.name}</td>
                  <td><span className="plan-badge">{r.plan || '—'}</span></td>
                  <td>
                    <AdminBadge variant={statusVariant(r.status)} dot>
                      {r.status || '—'}
                    </AdminBadge>
                  </td>
                  <td className="font-mono text-sm">
                    {r.daysLeft == null ? '—' : r.daysLeft}
                  </td>
                  <td className="text-xs text-slate-400">
                    {(r.blockedModules || r.blocked || []).slice?.(0, 6)?.join(', ') || '—'}
                  </td>
                  <td className="text-xs text-slate-400 font-mono">
                    {r.usage
                      ? `inv ${r.usage.invoicesCount || 0} · users ${r.usage.usersCount || 0}`
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Lifecycle;
