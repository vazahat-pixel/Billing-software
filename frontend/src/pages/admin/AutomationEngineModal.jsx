import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSearchableSelect } from '../../components/forms/FormElements';
import { businessAutomationApi } from '../../api';
import { toast } from '../../store/useToastStore';

const TABS = ['Pipeline', 'Rules', 'Series', 'Notifications', 'Scans', 'Profit'];

/**
 * Sprint 2.6 — Business automation workspace (modal shell).
 */
const AutomationEngineModal = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState('Pipeline');
  const [pipeline, setPipeline] = useState(null);
  const [rules, setRules] = useState([]);
  const [series, setSeries] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dupModule, setDupModule] = useState('sales');
  const [dupAmount, setDupAmount] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('100000');
  const [approvalResult, setApprovalResult] = useState(null);

  const refresh = async () => {
    try {
      const [p, r, s, n, snap] = await Promise.all([
        businessAutomationApi.pipeline(),
        businessAutomationApi.listRules(),
        businessAutomationApi.listSeries(),
        businessAutomationApi.listNotifications({ status: 'Unread' }),
        businessAutomationApi.listProfitSnapshots(),
      ]);
      setPipeline(p);
      setRules(r || []);
      setSeries(s || []);
      setNotifications(n || []);
      setSnapshots(snap || []);
    } catch {
      /* partial */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTab('Pipeline');
    refresh();
  }, [isOpen]);

  const handleSeed = async () => {
    setBusy(true);
    try {
      await businessAutomationApi.seedDefaults();
      toast.success('Default rules & voucher series seeded');
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Seed failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleRule = async (rule) => {
    setBusy(true);
    try {
      await businessAutomationApi.upsertRule({
        ...rule,
        enabled: !rule.enabled,
        conditions: rule.conditions,
        actions: rule.actions,
      });
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Business Automation" className="max-w-[92vw]">
      <div className="space-y-4 p-2">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded ${
                tab === t ? 'bg-black text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Pipeline' && (
          <div className="space-y-3">
            {pipeline && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div className="border border-slate-100 rounded p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Rules</p>
                  <p className="text-xl font-black">{pipeline.enabledRules}</p>
                </div>
                <div className="border border-slate-100 rounded p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Unread alerts</p>
                  <p className="text-xl font-black">{pipeline.unreadNotifications}</p>
                </div>
                <div className="border border-slate-100 rounded p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Voucher series</p>
                  <p className="text-xl font-black">{pipeline.voucherSeriesCount}</p>
                </div>
                <div className="border border-slate-100 rounded p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Receivable</p>
                  <p className="text-xl font-black">₹{pipeline.outstanding?.totalReceivable ?? 0}</p>
                </div>
                <div className="border border-slate-100 rounded p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Payable</p>
                  <p className="text-xl font-black">₹{pipeline.outstanding?.totalPayable ?? 0}</p>
                </div>
                <div className="border border-slate-100 rounded p-3">
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Low stock</p>
                  <p className="text-xl font-black">{pipeline.lowStockCount}</p>
                </div>
              </div>
            )}
            <button type="button" disabled={busy} onClick={handleSeed} className="erp-btn-primary">
              Seed defaults (rules + series)
            </button>
            {pipeline?.recentEvents?.length > 0 && (
              <div className="max-h-40 overflow-auto text-xs border border-slate-100 rounded">
                {pipeline.recentEvents.map((e, i) => (
                  <div key={i} className="p-2 border-b border-slate-50 flex justify-between">
                    <span>{e.eventType}</span>
                    <span className="text-slate-400">{e.processedAt ? 'processed' : 'pending'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Rules' && (
          <div className="space-y-2 max-h-80 overflow-auto">
            {rules.map((r) => (
              <div key={r._id || r.ruleKey} className="flex justify-between items-center border border-slate-100 rounded p-2 text-xs">
                <div>
                  <p className="font-bold">{r.name}</p>
                  <p className="text-slate-500">{r.category} · {r.ruleKey}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => toggleRule(r)} className="text-[10px] font-bold uppercase">
                  {r.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">Test approval threshold</p>
              <ERPInput label="Amount" type="number" value={approvalAmount} onChange={(e) => setApprovalAmount(e.target.value)} />
              <button
                type="button"
                className="erp-btn-secondary"
                disabled={busy}
                onClick={async () => {
                  try {
                    const res = await businessAutomationApi.evaluateApproval({
                      module: 'sales',
                      amount: Number(approvalAmount),
                    });
                    setApprovalResult(res);
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Evaluate sales approval
              </button>
              {approvalResult && (
                <p className="text-xs">
                  {approvalResult.requiresApproval
                    ? `Requires approval — ${approvalResult.message}`
                    : 'No approval required'}
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'Series' && (
          <div className="space-y-2 max-h-72 overflow-auto text-xs">
            {series.map((s) => (
              <div key={s._id || s.id} className="p-2 border border-slate-50 rounded flex justify-between">
                <span>
                  {s.module} — {s.prefix} ({s.name})
                </span>
                <span>{s.isDefault ? 'default' : ''} {s.status}</span>
              </div>
            ))}
            <button
              type="button"
              className="erp-btn-primary"
              disabled={busy}
              onClick={async () => {
                try {
                  const n = await businessAutomationApi.allocateNumber({ module: 'sales' });
                  toast.success(`Next sales no: ${n.number}`);
                } catch (e) {
                  toast.error(e.message);
                }
              }}
            >
              Preview next sales number
            </button>
          </div>
        )}

        {tab === 'Notifications' && (
          <div className="space-y-2 max-h-72 overflow-auto text-xs">
            {(notifications || []).length === 0 && <p className="text-slate-400">No unread notifications</p>}
            {notifications.map((n) => (
              <div key={n._id || n.id} className="p-2 border border-slate-100 rounded flex justify-between gap-2">
                <div>
                  <p className="font-bold">{n.title}</p>
                  <p className="text-slate-500">{n.body}</p>
                </div>
                <button
                  type="button"
                  className="text-[10px] font-bold"
                  onClick={async () => {
                    await businessAutomationApi.markRead(n._id || n.id);
                    await refresh();
                  }}
                >
                  Read
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'Scans' && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              className="erp-btn-primary"
              onClick={async () => {
                setBusy(true);
                try {
                  const alerts = await businessAutomationApi.runLowStockScan();
                  toast.success(`Low stock: ${Array.isArray(alerts) ? alerts.length : 0} alerts`);
                  await refresh();
                } catch (e) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Run low stock scan
            </button>
            <button
              type="button"
              disabled={busy}
              className="erp-btn-secondary"
              onClick={async () => {
                setBusy(true);
                try {
                  const overdue = await businessAutomationApi.runOverdueScan();
                  toast.success(`Overdue: ${Array.isArray(overdue) ? overdue.length : 0}`);
                  await refresh();
                } catch (e) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Run overdue invoice scan
            </button>
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <ERPSearchableSelect
                label="Duplicate check module"
                options={[
                  { value: 'sales', label: 'Sales' },
                  { value: 'purchase', label: 'Purchase' },
                ]}
                value={dupModule}
                onChange={setDupModule}
              />
              <ERPInput label="Net amount" type="number" value={dupAmount} onChange={(e) => setDupAmount(e.target.value)} />
              <button
                type="button"
                className="erp-btn-secondary"
                disabled={busy}
                onClick={async () => {
                  try {
                    const res = await businessAutomationApi.checkDuplicates({
                      module: dupModule,
                      netAmount: Number(dupAmount) || undefined,
                    });
                    toast.success(res.hasDuplicates ? res.message : 'No duplicates found');
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Soft duplicate check
              </button>
            </div>
          </div>
        )}

        {tab === 'Profit' && (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-500 uppercase font-bold">
              Estimated snapshot (sales − purchases taxables) — not statutory P&amp;L
            </p>
            <button
              type="button"
              disabled={busy}
              className="erp-btn-primary"
              onClick={async () => {
                setBusy(true);
                try {
                  await businessAutomationApi.createProfitSnapshot();
                  toast.success('Profit snapshot created');
                  await refresh();
                } catch (e) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Capture profit snapshot
            </button>
            <div className="max-h-48 overflow-auto text-xs border border-slate-100 rounded">
              {snapshots.map((s) => (
                <div key={s._id || s.id} className="p-2 border-b border-slate-50">
                  {new Date(s.snapshotDate).toLocaleString()} — GP ₹{s.estimatedGrossProfit} (Sales ₹
                  {s.salesTaxable} − COGS ₹{s.estimatedCogs})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AutomationEngineModal;
