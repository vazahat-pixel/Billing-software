import React, { useEffect, useState } from 'react';
import useUiStore from '../store/useUiStore';
import { stage6Api } from '../api/stage6.api';
import { toast } from '../store/useToastStore';

/**
 * Stage 6.2 — Enterprise Notification Center (in-app inbox).
 */
export default function NotificationCenter() {
  const open = useUiStore((s) => s.notificationCenterOpen);
  const close = useUiStore((s) => s.closeNotificationCenter);
  const setUnread = useUiStore((s) => s.setNotificationUnread);
  const [items, setItems] = useState([]);
  const [unread, setLocalUnread] = useState(0);
  const [filter, setFilter] = useState('Unread');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const data = await stage6Api.notifInbox({
        status: filter === 'All' ? undefined : filter,
        limit: 50,
      });
      const list = data?.items || [];
      setItems(list);
      const count = data?.unread ?? list.filter((n) => n.status === 'Unread').length;
      setLocalUnread(count);
      setUnread(count);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, filter]);

  if (!open) return null;

  const markRead = async (id) => {
    setBusy(true);
    try {
      await stage6Api.notifRead(id);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await stage6Api.notifReadAll();
      await refresh();
      toast.success('All notifications marked read');
    } catch (e) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const severityColor = (s) => {
    if (s === 'critical') return 'text-rose-600';
    if (s === 'warning') return 'text-amber-600';
    return 'text-slate-500';
  };

  return (
    <div className="fixed inset-0 z-[99990] flex justify-end bg-black/20" onClick={close}>
      <aside
        className="w-[min(400px,100vw)] h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Notification center"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900">Notifications</h3>
            <p className="text-[10px] text-slate-400">{unread} unread</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-[10px] px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
              onClick={markAll}
              disabled={busy}
            >
              Mark all read
            </button>
            <button type="button" className="text-[12px] text-slate-500" onClick={close}>
              ✕
            </button>
          </div>
        </div>
        <div className="px-3 py-2 flex gap-1 border-b border-slate-50">
          {['Unread', 'Read', 'All'].map((f) => (
            <button
              key={f}
              type="button"
              className={`text-[10px] px-2.5 py-1 rounded ${
                filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <li className="px-4 py-10 text-center text-[12px] text-slate-400">No notifications</li>
          )}
          {items.map((n) => (
            <li key={n._id} className="px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => n.status === 'Unread' && markRead(n._id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-semibold text-slate-800">{n.title}</span>
                  <span className={`text-[9px] uppercase ${severityColor(n.severity)}`}>{n.severity}</span>
                </div>
                {n.body ? <p className="text-[11px] text-slate-500 mt-0.5">{n.body}</p> : null}
                <p className="text-[9px] text-slate-400 mt-1">
                  {n.channel} · {n.status} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
