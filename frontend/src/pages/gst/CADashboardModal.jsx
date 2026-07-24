import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { downloadJson, buildGstr1Filename } from '../../utils/gstExport';
import {
  RefreshCw, Download, FileText, AlertTriangle, CheckCircle2,
  Calculator, TrendingUp, TrendingDown, Scale, ShieldCheck
} from 'lucide-react';
import { SkeletonDashboard } from '../../components/ui/loaders';

const fmt = (n) => `₹ ${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

const getMonthRange = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};

const KpiCard = ({ label, value, sub, tone = 'default', icon: Icon }) => {
  const tones = {
    default: 'border-[var(--border)] bg-[var(--bg-card)]',
    green: 'border-emerald-100 bg-emerald-50/50',
    red: 'border-rose-100 bg-rose-50/50',
    blue: 'border-blue-100 bg-blue-50/50',
    amber: 'border-amber-100 bg-amber-50/50'
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
        {Icon && <Icon size={14} className="text-[var(--text-muted)] shrink-0" />}
      </div>
      <p className="text-lg font-bold text-[var(--text-primary)] mt-1 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
};

const DataTable = ({ columns, rows, emptyText }) => (
  <div className="border border-[var(--border)] rounded-lg overflow-hidden">
    <div className="overflow-x-auto max-h-64 overflow-y-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wider sticky top-0">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-[var(--text-muted)]">{emptyText}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row._key || i} className="hover:bg-[var(--bg-base)]">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right font-medium' : ''}`}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'gstr1', label: 'GSTR-1' },
  { id: 'gstr2', label: 'GSTR-2 / ITC' },
  { id: 'gstr3b', label: 'GSTR-3B' },
  { id: 'registers', label: 'Registers' },
  { id: 'compliance', label: 'Alerts' }
];

const CADashboardModal = ({ isOpen, onClose, onOpenGstr1, onOpenGstr2, onOpenGstr3b }) => {
  const { fetchCADashboard, fetchTrialBalance } = useStore();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState(null);
  const [trialBalance, setTrialBalance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [gstr1Sub, setGstr1Sub] = useState('b2b');

  const load = useCallback(async () => {
    const { startDate, endDate } = getMonthRange(month);
    setLoading(true);
    try {
      const [ca, tb] = await Promise.all([
        fetchCADashboard(startDate, endDate),
        fetchTrialBalance(endDate).catch(() => [])
      ]);
      setData(ca);
      setTrialBalance(Array.isArray(tb) ? tb : tb?.data || []);
    } catch (err) {
      console.error('CA dashboard load failed', err);
    } finally {
      setLoading(false);
    }
  }, [month, fetchCADashboard, fetchTrialBalance]);

  useEffect(() => {
    if (!isOpen) return undefined;
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [isOpen, load]);

  const summary = data?.summary || {};
  const gstr3b = data?.gstr3b || {};
  const netTotal = gstr3b.net?.total || 0;

  const gstr1Rows = useMemo(() => {
    if (!data?.gstr1) return [];
    if (gstr1Sub === 'b2b') return (data.gstr1.b2b || []).map((r, i) => ({ ...r, _key: i }));
    if (gstr1Sub === 'b2cl') return (data.gstr1.b2cl || []).map((r, i) => ({ ...r, _key: i }));
    if (gstr1Sub === 'b2cs') return (data.gstr1.b2cs || []).map((r, i) => ({ ...r, _key: i }));
    return (data.gstr1.hsn?.data || []).map((r, i) => ({ ...r, _key: i }));
  }, [data, gstr1Sub]);

  const handleExportGstr1 = () => {
    if (!data?.gstr1) return;
    const { startDate } = getMonthRange(month);
    downloadJson(data.gstr1, buildGstr1Filename(data.company?.gstin, startDate));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CA Desk — Tax & Compliance Hub"
      className="max-w-[96vw] w-full h-[92vh] p-0"
    >
      <div className="flex flex-col h-[calc(92vh-48px)] bg-[var(--bg-base)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center">
              <Calculator size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{data?.company?.name || 'Company'}</p>
              <p className="text-[10px] text-[var(--text-muted)]">
                GSTIN: {data?.company?.gstin || '—'}
                {data?.generatedAt && (
                  <span className="ml-2 text-emerald-600 font-semibold">● Live</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-8 px-2 text-xs border border-[var(--border-strong)] rounded-lg bg-[var(--bg-card)]"
            />
            <button type="button" onClick={load} disabled={loading} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button type="button" onClick={handleExportGstr1} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
              <Download size={12} /> GSTR-1 JSON
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-2 border-b border-[var(--border)] bg-[var(--bg-card)] overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 text-[11px] font-semibold rounded-t-lg whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border)] border-b-[var(--bg-base)] -mb-px'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && !data && (
            <SkeletonDashboard cards={6} />
          )}

          {activeTab === 'overview' && data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <KpiCard label="Outward Taxable" value={fmt(summary.outwardTaxable)} icon={TrendingUp} tone="blue" />
                <KpiCard label="Outward GST" value={fmt(summary.outwardGst)} sub={`${summary.salesCount || 0} invoices`} icon={FileText} />
                <KpiCard label="ITC Available" value={fmt(summary.itcAvailable)} sub={`${summary.purchaseCount || 0} purchases`} icon={TrendingDown} tone="green" />
                <KpiCard
                  label="Net Tax Payable"
                  value={fmt(netTotal)}
                  sub="CGST+SGST+IGST"
                  icon={Scale}
                  tone={netTotal > 0 ? 'amber' : 'green'}
                />
                <KpiCard label="B2B Invoices" value={summary.b2bCount || 0} sub={`B2C: ${(summary.b2clCount || 0) + (summary.b2csCount || 0)}`} />
                <KpiCard label="HSN Lines" value={summary.hsnCount || 0} sub={`Returns: ${summary.returnsCount || 0}`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="erp-card p-4 lg:col-span-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Quick Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {onOpenGstr1 && (
                      <button type="button" onClick={onOpenGstr1} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">Open GSTR-1 Filing</button>
                    )}
                    {onOpenGstr2 && (
                      <button type="button" onClick={onOpenGstr2} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">GSTR-2B Matching</button>
                    )}
                    {onOpenGstr3b && (
                      <button type="button" onClick={onOpenGstr3b} className="erp-btn erp-btn-primary h-8 px-3 text-[11px]">GSTR-3B Return</button>
                    )}
                  </div>
                </div>
                <div className="erp-card p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Compliance</h3>
                  {(data.warnings || []).length === 0 ? (
                    <p className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
                      <CheckCircle2 size={14} /> No critical alerts
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-amber-600 text-xs font-medium">
                      <AlertTriangle size={14} /> {(data.warnings || []).length} alert(s) — see Alerts tab
                    </p>
                  )}
                </div>
              </div>

              {trialBalance.length > 0 && (
                <div className="erp-card p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Trial Balance Snapshot</h3>
                  <DataTable
                    columns={[
                      { key: 'name', label: 'Ledger', render: (r) => r.ledger?.name || r.name || '—' },
                      { key: 'debit', label: 'Debit', align: 'right', render: (r) => fmt(r.debit || r.debitBalance) },
                      { key: 'credit', label: 'Credit', align: 'right', render: (r) => fmt(r.credit || r.creditBalance) }
                    ]}
                    rows={trialBalance.slice(0, 15)}
                    emptyText="No trial balance data"
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'gstr1' && data && (
            <>
              <div className="flex gap-2 flex-wrap">
                {['b2b', 'b2cl', 'b2cs', 'hsn'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setGstr1Sub(s)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border ${
                      gstr1Sub === s ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {s === 'hsn' ? 'HSN Summary' : s.toUpperCase()}
                  </button>
                ))}
              </div>
              <DataTable
                columns={
                  gstr1Sub === 'hsn'
                    ? [
                        { key: 'hsn_sc', label: 'HSN' },
                        { key: 'desc', label: 'Description' },
                        { key: 'qty', label: 'Qty', align: 'right' },
                        { key: 'txval', label: 'Taxable', align: 'right', render: (r) => fmt(r.txval) },
                        { key: 'camt', label: 'CGST', align: 'right', render: (r) => fmt(r.camt) },
                        { key: 'samt', label: 'SGST', align: 'right', render: (r) => fmt(r.samt) }
                      ]
                    : [
                        { key: 'inum', label: 'Invoice', render: (r) => r.inum || r.invoiceNo },
                        { key: 'idt', label: 'Date', render: (r) => fmtDate(r.idt || r.date) },
                        { key: 'cname', label: 'Party', render: (r) => r.cname || r.partyName },
                        { key: 'ctin', label: 'GSTIN', render: (r) => r.ctin || r.gstin || '—' },
                        { key: 'txval', label: 'Taxable', align: 'right', render: (r) => fmt(r.txval || r.taxable) },
                        { key: 'camt', label: 'CGST', align: 'right', render: (r) => fmt(r.camt || r.cgst) },
                        { key: 'samt', label: 'SGST', align: 'right', render: (r) => fmt(r.samt || r.sgst) },
                        { key: 'iamt', label: 'IGST', align: 'right', render: (r) => fmt(r.iamt || r.igst) }
                      ]
                }
                rows={gstr1Sub === 'hsn' ? gstr1Rows : gstr1Sub === 'b2b' ? gstr1Rows : gstr1Sub === 'b2cl' ? gstr1Rows : gstr1Rows}
                emptyText="No data for this period"
              />
              <DataTable
                columns={[
                  { key: 'invoiceNo', label: 'Invoice' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'partyName', label: 'Customer' },
                  { key: 'gstin', label: 'GSTIN' },
                  { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmt(r.taxable) },
                  { key: 'totalGst', label: 'GST', align: 'right', render: (r) => fmt(r.totalGst) },
                  { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmt(r.netAmount) }
                ]}
                rows={(data.gstr1?.invoices || []).map((r, i) => ({ ...r, _key: i }))}
                emptyText="No sales invoices"
              />
            </>
          )}

          {activeTab === 'gstr2' && data && (
            <DataTable
              columns={[
                { key: 'invoiceNo', label: 'Bill No' },
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                { key: 'partyName', label: 'Supplier' },
                { key: 'gstin', label: 'GSTIN' },
                { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmt(r.taxable) },
                { key: 'cgst', label: 'CGST', align: 'right', render: (r) => fmt(r.cgst) },
                { key: 'sgst', label: 'SGST', align: 'right', render: (r) => fmt(r.sgst) },
                { key: 'igst', label: 'IGST', align: 'right', render: (r) => fmt(r.igst) },
                { key: 'gstAmount', label: 'Total ITC', align: 'right', render: (r) => fmt(r.gstAmount) }
              ]}
              rows={(data.gstr2 || []).map((r, i) => ({ ...r, _key: i }))}
              emptyText="No purchase bills for ITC"
            />
          )}

          {activeTab === 'gstr3b' && data && (
            <div className="erp-card p-4 max-w-2xl">
              <h3 className="text-sm font-bold mb-4">GSTR-3B Summary — {month}</h3>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[var(--text-muted)] uppercase text-[9px] border-b border-[var(--border)]">
                    <th className="text-left py-2">Component</th>
                    <th className="text-right py-2">CGST</th>
                    <th className="text-right py-2">SGST</th>
                    <th className="text-right py-2">IGST</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {[
                    { label: 'Outward Supplies (Tax)', row: gstr3b.outward },
                    { label: 'Input Tax Credit', row: gstr3b.itc },
                    { label: 'Net Payable', row: gstr3b.net, bold: true }
                  ].map(({ label, row, bold }) => (
                    <tr key={label} className={bold ? 'font-bold bg-[var(--bg-base)]' : ''}>
                      <td className="py-2">{label}</td>
                      <td className="text-right py-2">{fmt(row?.cgst)}</td>
                      <td className="text-right py-2">{fmt(row?.sgst)}</td>
                      <td className="text-right py-2">{fmt(row?.igst)}</td>
                      <td className="text-right py-2">{fmt(row?.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-[var(--text-muted)] mt-4">
                Taxable outward: {fmt(gstr3b.outward?.taxable)} • Taxable inward: {fmt(gstr3b.itc?.taxable)}
              </p>
            </div>
          )}

          {activeTab === 'registers' && data && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Sales Returns</h3>
                <DataTable
                  columns={[
                    { key: 'returnNo', label: 'Return No' },
                    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                    { key: 'type', label: 'Type' },
                    { key: 'partyName', label: 'Party' },
                    { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmt(r.taxable) },
                    { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => fmt(r.gstAmount) }
                  ]}
                  rows={(data.returns || []).map((r, i) => ({ ...r, _key: i }))}
                  emptyText="No returns"
                />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Debit / Credit Notes</h3>
                <DataTable
                  columns={[
                    { key: 'noteNo', label: 'Note No' },
                    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                    { key: 'noteType', label: 'Type' },
                    { key: 'partyName', label: 'Party' },
                    { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmt(r.amount) }
                  ]}
                  rows={(data.notes || []).map((r, i) => ({ ...r, _key: i }))}
                  emptyText="No notes"
                />
              </div>
            </div>
          )}

          {activeTab === 'compliance' && data && (
            <div className="space-y-2">
              {(data.warnings || []).length === 0 ? (
                <div className="erp-card p-8 text-center">
                  <ShieldCheck size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="font-semibold text-[var(--text-primary)]">All clear for filing</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">No compliance warnings for selected period</p>
                </div>
              ) : (
                (data.warnings || []).map((w, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      w.type === 'error' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <AlertTriangle size={16} className={w.type === 'error' ? 'text-rose-600' : 'text-amber-600'} />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{w.code}</p>
                      <p className="text-xs text-[var(--text-primary)]">{w.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CADashboardModal;
