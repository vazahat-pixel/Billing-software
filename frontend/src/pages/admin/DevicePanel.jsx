import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, Unlink, RefreshCw, ShieldAlert, Check } from 'lucide-react';
import adminApi from '../../api/admin.api';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notify';

/**
 * Licence device slots for one company.
 *
 * This is the recovery path when a customer's computer dies, is reinstalled,
 * or is replaced: releasing the slot lets the new machine claim the licence and
 * revokes any session still open on the old one. Without a button for it the
 * customer simply cannot work and nobody can help them, so it lives directly
 * beside the licence key rather than behind an API call.
 */
export default function DevicePanel({ company, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!company?._id) return;
    setLoading(true);
    try {
      setData(await adminApi.devices(company._id));
    } catch (err) {
      notifyError(err, 'Could not load devices');
    } finally {
      setLoading(false);
    }
  }, [company?._id]);

  useEffect(() => { load(); }, [load]);

  const release = async (device) => {
    const label = device.deviceName || device.deviceId;
    if (!window.confirm(
      `Release "${label}"?\n\nThe licence slot is freed and any session open on that computer is signed out. The customer can then sign in from a different machine.`
    )) return;

    setBusyId(device.deviceId);
    try {
      setData(await adminApi.releaseDevice(company._id, device.deviceId));
      notifySuccess('Device released — the slot is now free');
    } catch (err) {
      notifyError(err, 'Could not release device');
    } finally {
      setBusyId(null);
    }
  };

  const changeMax = async () => {
    const input = window.prompt(
      'How many computers may this licence run on?\n\n1 = the standard single-computer licence.',
      String(data?.maxDevices ?? 1)
    );
    if (input === null) return;
    const n = Number(input);
    if (!Number.isInteger(n) || n < 1) return notifyWarning('Enter a whole number of 1 or more');

    try {
      setData(await adminApi.setMaxDevices(company._id, n));
      notifySuccess(`Licence now allows ${n} computer${n === 1 ? '' : 's'}`);
    } catch (err) {
      notifyError(err, 'Could not change the device limit');
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-[15px] font-black uppercase tracking-widest">Licence Devices</h3>
            <p className="text-[11px] text-slate-500 mt-1">{company?.name}</p>
          </div>
          <button onClick={load} className="p-2 rounded-xl hover:bg-slate-50" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading && !data && <p className="text-[12px] text-slate-500">Loading…</p>}

          {data && !data.licenseKey && (
            <p className="text-[12px] text-slate-500">
              This company has no active licence yet. Issue a key first.
            </p>
          )}

          {data?.licenseKey && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-widest">
                  {data.activeDevices} / {data.maxDevices} in use
                </span>
                <span className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-widest">
                  {data.slotsFree} free
                </span>
                <button
                  onClick={changeMax}
                  className="px-3 py-2 bg-black text-white rounded-xl text-[11px] font-black uppercase tracking-widest"
                >
                  Change limit
                </button>
              </div>

              {!data.enforcing && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <ShieldAlert size={14} className="text-amber-700 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Device binding is in shadow mode — logins are recorded but never refused.
                    Set <code className="font-mono">DEVICE_BINDING_ENFORCE=true</code> on the server to enforce.
                  </p>
                </div>
              )}

              {!data.devices.length && (
                <p className="text-[12px] text-slate-500">
                  No computer has signed in on this licence yet.
                </p>
              )}

              <div className="space-y-2">
                {data.devices.map((d) => (
                  <div
                    key={d.deviceId}
                    className={`flex items-center gap-3 p-3 border rounded-xl ${
                      d.active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
                    }`}
                  >
                    <Monitor size={16} className="shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold truncate">{d.deviceName}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{d.deviceId}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {d.active
                          ? `Active · last seen ${fmt(d.lastSeenAt)}`
                          : `Released ${fmt(d.releasedAt)}`}
                      </p>
                    </div>
                    {d.active ? (
                      <button
                        onClick={() => release(d)}
                        disabled={busyId === d.deviceId}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        <Unlink size={12} />
                        {busyId === d.deviceId ? 'Releasing…' : 'Release'}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <Check size={12} /> Free
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 rounded-xl text-[11px] font-black uppercase tracking-widest"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
