import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import useConfigStore from '../../store/useConfigStore';
import { authApi } from '../../api/auth.api';
import { reportApi } from '../../api/report.api';
import { downloadJson, buildGstr1Filename } from '../../utils/gstExport';
import { exportTableToExcel } from '../../utils/reportExport';
import { toast } from '../../store/useToastStore';
import {
  RefreshCw, Download, FileText, AlertTriangle, CheckCircle2,
  Calculator, Scale, ShieldCheck
} from 'lucide-react';
import { SkeletonDashboard } from '../../components/ui/loaders';

const fmt = (n) => `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');
const num = (n) => Number(n) || 0;

const getMonthRange = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const iso = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  return { startDate: iso(start), endDate: iso(end) };
};

const BOOKS = [
  { id: 'overview', label: 'Overview' },
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

const matchParty = (row, q) => {
  if (!q) return true;
  const blob = [row.partyName, row.cname, row.gstin, row.ctin, row.invoiceNo, row.inum, row.noteNo, row.returnNo, row.name, row.ledger?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
};

const flattenB2b = (b2b) => {
  const rows = [];
  (b2b || []).forEach((b) => {
    if (Array.isArray(b.inv) && b.inv.length) {
      b.inv.forEach((inv) => {
        const itms = inv.itms || [];
        const sum = (k) => itms.reduce((s, x) => s + num(x.itm_det?.[k]), 0);
        rows.push({
          ctin: b.ctin,
          inum: inv.inum,
          idt: inv.idt,
          val: inv.val,
          pos: inv.pos,
          txval: sum('txval'),
          camt: sum('camt'),
          samt: sum('samt'),
          iamt: sum('iamt'),
        });
      });
    } else {
      rows.push(b);
    }
  });
  return rows;
};

const KpiCard = ({ label, value, sub }) => (
  <div className="rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-2 min-h-[62px] flex flex-col justify-center">
    <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] truncate leading-none">{label}</p>
    <p className="text-[13px] font-semibold text-[var(--text-primary)] mt-1 leading-none tabular-nums whitespace-nowrap truncate">{value}</p>
    <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-none truncate h-3">{sub || ''}</p>
  </div>
);

const DataTable = ({ columns, rows, emptyText }) => (
  <div className="border border-[var(--border)] rounded-md overflow-hidden">
    <div className="overflow-auto max-h-[calc(92vh-280px)]">
      <table className="w-full text-left text-[11px] border-collapse">
        <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wide sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-2.5 py-1.5 font-semibold align-middle whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-2.5 py-8 text-center text-[var(--text-muted)]">{emptyText}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row._key || i} className="hover:bg-[var(--bg-base)]">
              {columns.map((c) => (
                <td key={c.key} className={`px-2.5 py-1 align-middle leading-none ${c.align === 'right' ? 'text-right font-medium tabular-nums whitespace-nowrap' : ''}`}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const moneyCols = (extra = []) => ([
  ...extra,
  { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmt(r.taxable) },
  { key: 'cgst', label: 'CGST', align: 'right', render: (r) => fmt(r.cgst || r.camt) },
  { key: 'sgst', label: 'SGST', align: 'right', render: (r) => fmt(r.sgst || r.samt) },
  { key: 'igst', label: 'IGST', align: 'right', render: (r) => fmt(r.igst || r.iamt) },
  { key: 'net', label: 'Net', align: 'right', render: (r) => fmt(r.netAmount || r.val || r.amount) },
]);

const CADashboardModal = ({ isOpen, onClose, onOpenGstr1, onOpenGstr2, onOpenGstr3b }) => {
  const { fetchCADashboard, fetchTrialBalance, user } = useStore();
  const caFlags = useConfigStore((s) => s.companySettings?.caDesk || {});
  const isCa = user?.companyRole === 'ca';
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [partyQ, setPartyQ] = useState('');
  const [gstFilter, setGstFilter] = useState('all');
  const [osSide, setOsSide] = useState('receivable');
  const [acctView, setAcctView] = useState('tb');
  const [data, setData] = useState(null);
  const [books, setBooks] = useState(null);
  const [trialBalance, setTrialBalance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [gstr1Sub, setGstr1Sub] = useState('b2b');

  const applyMonth = (value) => {
    setMonth(value);
    const range = getMonthRange(value);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const load = useCallback(async () => {
    const range = (startDate && endDate)
      ? { startDate, endDate }
      : getMonthRange(month);
    if (!startDate || !endDate) {
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
    setLoading(true);
    try {
      const [ca, tb, bundle] = await Promise.all([
        fetchCADashboard(range.startDate, range.endDate),
        fetchTrialBalance(range.endDate).catch(() => []),
        reportApi.bundle({ startDate: range.startDate, endDate: range.endDate }).catch(() => null),
      ]);
      setData(ca);
      setBooks(bundle);
      setTrialBalance(Array.isArray(tb) ? tb : tb?.data || []);
    } catch (err) {
      console.error('CA dashboard load failed', err);
      toast.error('CA Desk could not load this period');
    } finally {
      setLoading(false);
    }
  }, [month, startDate, endDate, fetchCADashboard, fetchTrialBalance]);

  useEffect(() => {
    if (!isOpen) return undefined;
    load();
    return undefined;
  }, [isOpen, load]);

  const q = partyQ.trim().toLowerCase();
  const summary = data?.summary || {};
  const bookSum = books?.summary || {};
  const gstr3b = data?.gstr3b || {};
  const pl = books?.profitLoss || {};
  const bs = books?.balanceSheet || {};
  const netTotal = gstr3b.net?.total || 0;

  const taxKind = (row) => {
    if (gstFilter === 'igst') return num(row.igst || row.iamt) > 0;
    if (gstFilter === 'local') return num(row.cgst || row.camt || row.sgst || row.samt) > 0;
    if (gstFilter === 'zero') return num(row.gstAmount || row.totalGst || row.cgst || row.sgst || row.igst) === 0;
    return true;
  };

  const gstr1Rows = useMemo(() => {
    if (!data?.gstr1) return [];
    let rows = [];
    if (gstr1Sub === 'b2b') rows = flattenB2b(data.gstr1.b2b);
    else if (gstr1Sub === 'b2cl') rows = data.gstr1.b2cl || [];
    else if (gstr1Sub === 'b2cs') rows = data.gstr1.b2cs || [];
    else if (gstr1Sub === 'hsn') rows = data.gstr1.hsn?.data || [];
    else rows = data.gstr1.invoices || [];
    return rows.filter((r) => matchParty(r, q) && taxKind(r)).map((r, i) => ({ ...r, _key: `g1-${i}` }));
  }, [data, gstr1Sub, q, gstFilter]);

  const salesRows = useMemo(() => (
    (books?.salesRegister || []).filter((r) => matchParty(r, q) && taxKind(r)).map((r, i) => ({ ...r, _key: `s-${i}` }))
  ), [books, q, gstFilter]);

  const purchaseRows = useMemo(() => (
    (books?.purchaseRegister || []).filter((r) => matchParty(r, q) && taxKind(r)).map((r, i) => ({ ...r, _key: `p-${i}` }))
  ), [books, q, gstFilter]);

  const itcRows = useMemo(() => (
    (data?.gstr2 || []).filter((r) => matchParty(r, q) && taxKind(r)).map((r, i) => ({ ...r, _key: `itc-${i}` }))
  ), [data, q, gstFilter]);

  const osRows = useMemo(() => {
    const src = osSide === 'payable' ? books?.outstandingPayable : books?.outstandingReceivable;
    return (src || []).filter((r) => matchParty(r, q)).map((r, i) => ({ ...r, _key: `os-${i}` }));
  }, [books, osSide, q]);

  const jobRows = useMemo(() => (
    (books?.jobWorkReport || []).filter((r) => matchParty({ ...r, partyName: r.workerName || r.partyName }, q)).map((r, i) => ({ ...r, _key: `j-${i}` }))
  ), [books, q]);

  const dayRows = useMemo(() => (
    (books?.dailyTransactions || []).filter((r) => matchParty({ ...r, partyName: r.party || r.partyName }, q)).map((r, i) => ({ ...r, _key: `d-${i}` }))
  ), [books, q]);

  const tbRows = useMemo(() => (
    trialBalance.filter((r) => matchParty({ name: r.ledger?.name || r.name }, q)).map((r, i) => ({ ...r, _key: `tb-${i}` }))
  ), [trialBalance, q]);

  const handleExportGstr1 = () => {
    if (!data?.gstr1) return;
    downloadJson(data.gstr1, buildGstr1Filename(data.company?.gstin, startDate || getMonthRange(month).startDate));
  };

  const downloadView = (filename, columns, rows) => {
    if (!rows.length) {
      toast.error('Nothing to download for the current filter');
      return;
    }
    exportTableToExcel(filename, columns, rows);
    toast.success('Report downloaded');
  };

  const billCols = [
    { key: 'invoiceNo', label: 'Bill' },
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'partyName', label: 'Party' },
    { key: 'gstin', label: 'GSTIN', render: (r) => r.gstin || '—' },
    { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmt(r.taxable) },
    { key: 'cgst', label: 'CGST', align: 'right', render: (r) => fmt(r.cgst) },
    { key: 'sgst', label: 'SGST', align: 'right', render: (r) => fmt(r.sgst) },
    { key: 'igst', label: 'IGST', align: 'right', render: (r) => fmt(r.igst) },
    { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmt(r.netAmount) },
    { key: 'balance', label: 'Balance', align: 'right', render: (r) => fmt(r.balance) },
  ];

  const gstr1Cols = gstr1Sub === 'hsn'
    ? [
        { key: 'hsn_sc', label: 'HSN' },
        { key: 'desc', label: 'Description' },
        { key: 'qty', label: 'Qty', align: 'right' },
        { key: 'txval', label: 'Taxable', align: 'right', render: (r) => fmt(r.txval) },
        { key: 'camt', label: 'CGST', align: 'right', render: (r) => fmt(r.camt) },
        { key: 'samt', label: 'SGST', align: 'right', render: (r) => fmt(r.samt) },
        { key: 'iamt', label: 'IGST', align: 'right', render: (r) => fmt(r.iamt) },
      ]
    : [
        { key: 'inum', label: 'Invoice', render: (r) => r.inum || r.invoiceNo },
        { key: 'idt', label: 'Date', render: (r) => fmtDate(r.idt || r.date) },
        { key: 'cname', label: 'Party', render: (r) => r.cname || r.partyName || '—' },
        { key: 'ctin', label: 'GSTIN', render: (r) => r.ctin || r.gstin || '—' },
        { key: 'txval', label: 'Taxable', align: 'right', render: (r) => fmt(r.txval || r.taxable) },
        { key: 'camt', label: 'CGST', align: 'right', render: (r) => fmt(r.camt || r.cgst) },
        { key: 'samt', label: 'SGST', align: 'right', render: (r) => fmt(r.samt || r.sgst) },
        { key: 'iamt', label: 'IGST', align: 'right', render: (r) => fmt(r.iamt || r.igst) },
        { key: 'val', label: 'Value', align: 'right', render: (r) => fmt(r.val || r.netAmount) },
      ];

  const exportCurrent = () => {
    const stamp = `${startDate || month}_${endDate || month}`;
    if (activeTab === 'gstr1') return downloadView(`CA_GSTR1_${gstr1Sub}_${stamp}.xlsx`, gstr1Cols, gstr1Rows);
    if (activeTab === 'gstr2') return downloadView(`CA_ITC_${stamp}.xlsx`, billCols, itcRows);
    if (activeTab === 'sales') return downloadView(`CA_Sales_${stamp}.xlsx`, billCols, salesRows);
    if (activeTab === 'purchase') return downloadView(`CA_Purchase_${stamp}.xlsx`, billCols, purchaseRows);
    if (activeTab === 'outstanding') {
      return downloadView(`CA_Outstanding_${osSide}_${stamp}.xlsx`, [
        { key: 'partyName', label: 'Party' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'city', label: 'City' },
        { key: 'totalOutstanding', label: 'Outstanding', align: 'right', render: (r) => fmt(r.totalOutstanding) },
        { key: 'phone', label: 'Phone' },
      ], osRows);
    }
    if (activeTab === 'accounts' && acctView === 'tb') {
      return downloadView(`CA_TrialBalance_${stamp}.xlsx`, [
        { key: 'name', label: 'Ledger', render: (r) => r.ledger?.name || r.name },
        { key: 'debit', label: 'Debit', align: 'right', render: (r) => fmt(r.debit || r.debitBalance) },
        { key: 'credit', label: 'Credit', align: 'right', render: (r) => fmt(r.credit || r.creditBalance) },
      ], tbRows);
    }
    if (activeTab === 'job') {
      return downloadView(`CA_JobWork_${stamp}.xlsx`, [
        { key: 'jobCardNo', label: 'Job' },
        { key: 'workerName', label: 'Mill' },
        { key: 'processType', label: 'Process' },
        { key: 'status', label: 'Status' },
        { key: 'issueQty', label: 'Issued', align: 'right' },
        { key: 'receivedQty', label: 'Received', align: 'right' },
      ], jobRows);
    }
    if (activeTab === 'daily') {
      return downloadView(`CA_DayBook_${stamp}.xlsx`, [
        { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
        { key: 'voucherNo', label: 'Voucher', render: (r) => r.voucherNo || r.docNo || r.invoiceNo },
        { key: 'type', label: 'Type', render: (r) => r.type || r.voucherType },
        { key: 'party', label: 'Party', render: (r) => r.party || r.partyName },
        { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmt(r.amount || r.netAmount) },
      ], dayRows);
    }
    if (activeTab === 'gstr3b') {
      return downloadView(`CA_GSTR3B_${stamp}.xlsx`, [
        { key: 'label', label: 'Component' },
        { key: 'cgst', label: 'CGST' },
        { key: 'sgst', label: 'SGST' },
        { key: 'igst', label: 'IGST' },
        { key: 'total', label: 'Total' },
      ], [
        { label: 'Outward', ...gstr3b.outward },
        { label: 'ITC', ...gstr3b.itc },
        { label: 'Net Payable', ...gstr3b.net },
      ]);
    }
    if (activeTab === 'accounts' && acctView === 'pl') {
      return downloadView(`CA_ProfitLoss_${stamp}.xlsx`, [
        { key: 'label', label: 'Particulars' },
        { key: 'amount', label: 'Amount' },
      ], [
        { label: 'Sales taxable', amount: pl.revenue },
        { label: 'Sales GST', amount: pl.salesGst },
        { label: 'Sales net', amount: pl.salesNet },
        { label: 'Purchase / COGS', amount: pl.cogs },
        { label: 'Gross profit', amount: pl.grossProfit },
        { label: 'Net profit', amount: pl.netProfit },
      ]);
    }
    if (activeTab === 'accounts' && acctView === 'bs') {
      return downloadView(`CA_BalanceSheet_${stamp}.xlsx`, [
        { key: 'side', label: 'Side' },
        { key: 'particular', label: 'Particulars' },
        { key: 'amount', label: 'Amount' },
      ], bs.rows || []);
    }
    if (activeTab === 'registers') {
      return downloadView(`CA_Returns_${stamp}.xlsx`, [
        { key: 'returnNo', label: 'Return No' },
        { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
        { key: 'type', label: 'Type' },
        { key: 'partyName', label: 'Party' },
        { key: 'taxable', label: 'Taxable' },
        { key: 'gstAmount', label: 'GST' },
        { key: 'netAmount', label: 'Net' },
      ], (data?.returns || []).filter((r) => matchParty(r, q)));
    }
    if (activeTab === 'alerts') {
      return downloadView(`CA_Alerts_${stamp}.xlsx`, [
        { key: 'code', label: 'Code' },
        { key: 'type', label: 'Type' },
        { key: 'message', label: 'What to check' },
      ], data?.warnings || []);
    }
    return downloadView(`CA_Summary_${stamp}.xlsx`, [
      { key: 'particular', label: 'Particular' },
      { key: 'amount', label: 'Amount' },
    ], [
      { particular: 'Company', amount: data?.company?.name || '' },
      { particular: 'GSTIN', amount: data?.company?.gstin || '' },
      { particular: 'Period', amount: `${startDate || ''} to ${endDate || ''}` },
      { particular: 'Outward taxable', amount: summary.outwardTaxable },
      { particular: 'Outward GST', amount: summary.outwardGst },
      { particular: 'ITC available', amount: summary.itcAvailable },
      { particular: 'Net tax payable', amount: netTotal },
      { particular: 'Sales (books)', amount: bookSum.salesTotal },
      { particular: 'Purchase (books)', amount: bookSum.purchaseTotal },
      { particular: 'Receivable', amount: bookSum.receivable },
      { particular: 'Payable', amount: bookSum.payable },
      { particular: 'Alerts', amount: (data?.warnings || []).length },
    ]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CA Desk — GST, Accounts & Reports" className="max-w-[98vw] w-full h-[92vh] p-0">
      <div className="flex flex-col h-[calc(92vh-48px)] bg-[var(--bg-base)]">
        <div className="flex flex-wrap items-end gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase text-[var(--text-muted)]">Month</span>
            <input type="month" value={month} onChange={(e) => applyMonth(e.target.value)} className="h-8 px-2 text-[12px] rounded border border-[var(--border)] bg-[var(--bg-base)]" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase text-[var(--text-muted)]">From</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 px-2 text-[12px] rounded border border-[var(--border)] bg-[var(--bg-base)]" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase text-[var(--text-muted)]">To</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 px-2 text-[12px] rounded border border-[var(--border)] bg-[var(--bg-base)]" />
          </label>
          <label className="flex flex-col gap-0.5 min-w-[160px] flex-1">
            <span className="text-[9px] font-semibold uppercase text-[var(--text-muted)]">Party / GSTIN / Bill</span>
            <input value={partyQ} onChange={(e) => setPartyQ(e.target.value)} placeholder="Filter…" className="h-8 px-2 text-[12px] rounded border border-[var(--border)] bg-[var(--bg-base)]" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase text-[var(--text-muted)]">GST</span>
            <select value={gstFilter} onChange={(e) => setGstFilter(e.target.value)} className="h-8 px-2 text-[12px] rounded border border-[var(--border)] bg-[var(--bg-base)]">
              <option value="all">All</option>
              <option value="local">CGST + SGST</option>
              <option value="igst">IGST</option>
              <option value="zero">Zero GST</option>
            </select>
          </label>
          <button type="button" onClick={load} disabled={loading} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={exportCurrent} className="erp-btn erp-btn-primary h-8 px-3 text-[11px] gap-1">
            <Download size={12} /> Download Excel
          </button>
          <button type="button" onClick={handleExportGstr1} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1" title="Only for uploading on the GST portal. Not for reading.">
            GST portal file
          </button>
        </div>

        <div className="flex gap-1 px-3 pt-2 border-b border-[var(--border)] bg-[var(--bg-card)] overflow-x-auto">
          {BOOKS.filter((t) => t.id === 'overview' || !isCa || caFlags[t.id] !== false).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-t whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border)] border-b-[var(--bg-base)] -mb-px'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {isCa && (
            <div className="flex flex-wrap items-end gap-2 border border-[var(--border)] rounded-md p-2 bg-[var(--bg-card)]">
              <p className="text-[11px] font-semibold w-full">Change your CA password</p>
              <input type="password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} placeholder="Current password" className="h-8 px-2 text-[12px] rounded border border-[var(--border)]" />
              <input type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="New password" className="h-8 px-2 text-[12px] rounded border border-[var(--border)]" />
              <button
                type="button"
                className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]"
                onClick={async () => {
                  try {
                    await authApi.changePassword({ currentPassword: pwd.current, newPassword: pwd.next });
                    setPwd({ current: '', next: '' });
                    toast.success('Password changed');
                  } catch (err) {
                    toast.error(err?.message || 'Could not change password');
                  }
                }}
              >
                Update password
              </button>
            </div>
          )}
          {loading && !data && <SkeletonDashboard cards={6} />}

          {activeTab === 'overview' && data && (
            <>
              <p className="text-[11px] text-[var(--text-muted)]">
                {data.company?.name || 'Company'} · GSTIN {data.company?.gstin || '—'} · {startDate} to {endDate}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <KpiCard label="Outward taxable" value={fmt(summary.outwardTaxable)} sub={`${summary.salesCount || 0} invoices`} />
                <KpiCard label="Outward GST" value={fmt(summary.outwardGst)} sub={`ITC ${fmt(summary.itcAvailable)}`} />
                <KpiCard label="Net tax payable" value={fmt(netTotal)} sub="CGST + SGST + IGST" />
                <KpiCard label="Sales (books)" value={fmt(bookSum.salesTotal)} sub={`${bookSum.salesCount || 0} bills`} />
                <KpiCard label="Receivable" value={fmt(bookSum.receivable)} sub={`Payable ${fmt(bookSum.payable)}`} />
                <KpiCard label="Alerts" value={(data.warnings || []).length} sub={(data.warnings || []).length ? 'Open Alerts tab' : 'Clear'} />
              </div>
              <div className="flex flex-wrap gap-2">
                {onOpenGstr1 && <button type="button" onClick={onOpenGstr1} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">Open GSTR-1 filing</button>}
                {onOpenGstr2 && <button type="button" onClick={onOpenGstr2} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">GSTR-2B matching</button>}
                {onOpenGstr3b && <button type="button" onClick={onOpenGstr3b} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">GSTR-3B return</button>}
                <button type="button" onClick={() => setActiveTab('sales')} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]"><FileText size={12} /> Sales</button>
                <button type="button" onClick={() => setActiveTab('purchase')} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">Purchase</button>
                <button type="button" onClick={() => setActiveTab('accounts')} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]"><Calculator size={12} /> Accounts</button>
                <button type="button" onClick={() => setActiveTab('outstanding')} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]"><Scale size={12} /> Outstanding</button>
              </div>
              {(data.warnings || []).length === 0 ? (
                <p className="flex items-center gap-2 text-emerald-700 text-[12px]"><CheckCircle2 size={14} /> No critical GST alerts in this period.</p>
              ) : (
                <p className="flex items-center gap-2 text-amber-700 text-[12px]"><AlertTriangle size={14} /> {(data.warnings || []).length} alert(s). See Alerts.</p>
              )}
            </>
          )}

          {activeTab === 'gstr1' && data && (
            <>
              <div className="flex gap-1 flex-wrap">
                {['b2b', 'b2cl', 'b2cs', 'hsn', 'invoices'].map((s) => (
                  <button key={s} type="button" onClick={() => setGstr1Sub(s)} className={`px-2.5 py-1 text-[10px] font-semibold uppercase rounded border ${gstr1Sub === s ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)]'}`}>
                    {s === 'hsn' ? 'HSN' : s === 'invoices' ? 'Invoice detail' : s.toUpperCase()}
                  </button>
                ))}
                <span className="text-[11px] text-[var(--text-muted)] self-center ml-1">{gstr1Rows.length} rows</span>
              </div>
              <DataTable columns={gstr1Sub === 'invoices' ? billCols : gstr1Cols} rows={gstr1Sub === 'invoices' ? (data.gstr1.invoices || []).filter((r) => matchParty(r, q) && taxKind(r)).map((r, i) => ({ ...r, _key: i })) : gstr1Rows} emptyText="No GSTR-1 rows for this filter" />
            </>
          )}

          {activeTab === 'gstr2' && data && (
            <>
              <p className="text-[11px] text-[var(--text-muted)]">{itcRows.length} purchase bills · ITC {fmt(itcRows.reduce((s, r) => s + num(r.gstAmount), 0))}</p>
              <DataTable
                columns={[
                  { key: 'invoiceNo', label: 'Bill No' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'partyName', label: 'Supplier' },
                  { key: 'gstin', label: 'GSTIN', render: (r) => r.gstin || '—' },
                  ...moneyCols().slice(0, 5),
                  { key: 'gstAmount', label: 'ITC', align: 'right', render: (r) => fmt(r.gstAmount) },
                ]}
                rows={itcRows}
                emptyText="No purchase bills for ITC"
              />
            </>
          )}

          {activeTab === 'gstr3b' && data && (
            <div className="border border-[var(--border)] rounded-md bg-[var(--bg-card)] p-3 max-w-3xl">
              <h3 className="text-[13px] font-semibold mb-2">GSTR-3B · {startDate} to {endDate}</h3>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-[var(--text-muted)] uppercase text-[9px] border-b border-[var(--border)]">
                    <th className="text-left py-1.5">Component</th>
                    <th className="text-right py-1.5">CGST</th>
                    <th className="text-right py-1.5">SGST</th>
                    <th className="text-right py-1.5">IGST</th>
                    <th className="text-right py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Outward tax', row: gstr3b.outward },
                    { label: 'Input tax credit', row: gstr3b.itc },
                    { label: 'Net payable', row: gstr3b.net, bold: true },
                  ].map(({ label, row, bold }) => (
                    <tr key={label} className={bold ? 'font-semibold bg-[var(--bg-base)]' : ''}>
                      <td className="py-1.5">{label}</td>
                      {['cgst', 'sgst', 'igst', 'total'].map((k) => (
                        <td key={k} className="text-right py-1.5 tabular-nums whitespace-nowrap">{fmt(row?.[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-[var(--text-muted)] mt-2">Outward taxable {fmt(gstr3b.outward?.taxable)} · Inward taxable {fmt(gstr3b.itc?.taxable)}</p>
            </div>
          )}

          {activeTab === 'sales' && (
            <>
              <p className="text-[11px] text-[var(--text-muted)]">{salesRows.length} invoices · Net {fmt(salesRows.reduce((s, r) => s + num(r.netAmount), 0))} · Balance {fmt(salesRows.reduce((s, r) => s + num(r.balance), 0))}</p>
              <DataTable columns={billCols} rows={salesRows} emptyText="No sales in this period" />
            </>
          )}

          {activeTab === 'purchase' && (
            <>
              <p className="text-[11px] text-[var(--text-muted)]">{purchaseRows.length} bills · Net {fmt(purchaseRows.reduce((s, r) => s + num(r.netAmount), 0))}</p>
              <DataTable columns={billCols} rows={purchaseRows} emptyText="No purchases in this period" />
            </>
          )}

          {activeTab === 'outstanding' && (
            <>
              <div className="flex gap-1">
                {['receivable', 'payable'].map((s) => (
                  <button key={s} type="button" onClick={() => setOsSide(s)} className={`px-2.5 py-1 text-[10px] font-semibold uppercase rounded border ${osSide === s ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)]'}`}>{s}</button>
                ))}
                <span className="text-[11px] self-center text-[var(--text-muted)] ml-1">{osRows.length} parties · {fmt(osRows.reduce((s, r) => s + num(r.totalOutstanding), 0))}</span>
              </div>
              <DataTable
                columns={[
                  { key: 'partyName', label: 'Party' },
                  { key: 'gstin', label: 'GSTIN', render: (r) => r.gstin || '—' },
                  { key: 'city', label: 'City' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'bills', label: 'Bills', align: 'right', render: (r) => (r.invoices || []).length },
                  { key: 'totalOutstanding', label: 'Outstanding', align: 'right', render: (r) => fmt(r.totalOutstanding) },
                  { key: 'ledgerDiff', label: 'Ledger diff', align: 'right', render: (r) => fmt(r.ledgerDiff) },
                ]}
                rows={osRows}
                emptyText="No outstanding for this side"
              />
            </>
          )}

          {activeTab === 'accounts' && (
            <>
              <div className="flex gap-1">
                {[
                  ['tb', 'Trial balance'],
                  ['pl', 'Profit & loss'],
                  ['bs', 'Balance sheet'],
                ].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setAcctView(id)} className={`px-2.5 py-1 text-[10px] font-semibold rounded border ${acctView === id ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)]'}`}>{label}</button>
                ))}
              </div>
              {acctView === 'tb' && (
                <DataTable
                  columns={[
                    { key: 'name', label: 'Ledger', render: (r) => r.ledger?.name || r.name || '—' },
                    { key: 'debit', label: 'Debit', align: 'right', render: (r) => fmt(r.debit || r.debitBalance) },
                    { key: 'credit', label: 'Credit', align: 'right', render: (r) => fmt(r.credit || r.creditBalance) },
                  ]}
                  rows={tbRows}
                  emptyText="No trial balance"
                />
              )}
              {acctView === 'pl' && (
                <DataTable
                  columns={[
                    { key: 'label', label: 'Particulars' },
                    { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmt(r.amount) },
                  ]}
                  rows={[
                    ['Sales taxable', pl.revenue],
                    ['Sales GST', pl.salesGst],
                    ['Sales net', pl.salesNet],
                    ['Purchase / COGS', pl.cogs],
                    ['Purchase GST', pl.purchaseGst],
                    ['Gross profit', pl.grossProfit],
                    ['Net profit', pl.netProfit],
                  ].map(([label, amount], i) => ({ label, amount, _key: i }))}
                  emptyText="P&L not available"
                />
              )}
              {acctView === 'bs' && (
                <DataTable
                  columns={[
                    { key: 'side', label: 'Side' },
                    { key: 'particular', label: 'Particulars' },
                    { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmt(r.amount) },
                  ]}
                  rows={(bs.rows || []).map((r, i) => ({ ...r, _key: i }))}
                  emptyText="Balance sheet not available"
                />
              )}
            </>
          )}

          {activeTab === 'job' && (
            <DataTable
              columns={[
                { key: 'jobCardNo', label: 'Job / challan', render: (r) => r.jobCardNo || r.challanNo },
                { key: 'issueDate', label: 'Issue', render: (r) => fmtDate(r.issueDate) },
                { key: 'receiveDate', label: 'Receive', render: (r) => fmtDate(r.receiveDate) },
                { key: 'workerName', label: 'Mill / worker' },
                { key: 'processType', label: 'Process' },
                { key: 'issueQty', label: 'Issued', align: 'right' },
                { key: 'receivedQty', label: 'Received', align: 'right' },
                { key: 'wastagePct', label: 'Wastage %', align: 'right' },
                { key: 'status', label: 'Status' },
              ]}
              rows={jobRows}
              emptyText="No mill / job rows in this period"
            />
          )}

          {activeTab === 'registers' && data && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">Sales & purchase returns</h3>
              <DataTable
                columns={[
                  { key: 'returnNo', label: 'Return' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'type', label: 'Type' },
                  { key: 'partyName', label: 'Party' },
                  { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmt(r.taxable) },
                  { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => fmt(r.gstAmount) },
                  { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmt(r.netAmount) },
                ]}
                rows={(data.returns || []).filter((r) => matchParty(r, q)).map((r, i) => ({ ...r, _key: i }))}
                emptyText="No returns"
              />
              <h3 className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">Debit / credit notes</h3>
              <DataTable
                columns={[
                  { key: 'noteNo', label: 'Note' },
                  { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                  { key: 'noteType', label: 'Type' },
                  { key: 'noteSide', label: 'Book' },
                  { key: 'partyName', label: 'Party' },
                  { key: 'againstInvoiceNo', label: 'Against' },
                  { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmt(r.amount) },
                  { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmt(r.netAmount) },
                ]}
                rows={(data.notes || []).filter((r) => matchParty(r, q)).map((r, i) => ({ ...r, _key: i }))}
                emptyText="No notes"
              />
            </div>
          )}

          {activeTab === 'daily' && (
            <DataTable
              columns={[
                { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
                { key: 'voucherNo', label: 'No', render: (r) => r.voucherNo || r.docNo || r.invoiceNo || '—' },
                { key: 'type', label: 'Type', render: (r) => r.type || r.voucherType || r.docType || '—' },
                { key: 'party', label: 'Party', render: (r) => r.party || r.partyName || '—' },
                { key: 'narration', label: 'Narration', render: (r) => r.narration || r.remark || '—' },
                { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmt(r.amount || r.netAmount || r.debit || r.credit) },
              ]}
              rows={dayRows}
              emptyText="No day-book rows"
            />
          )}

          {activeTab === 'alerts' && data && (
            <div className="space-y-2">
              {(data.warnings || []).length === 0 ? (
                <div className="border border-[var(--border)] rounded-md p-8 text-center bg-[var(--bg-card)]">
                  <ShieldCheck size={28} className="mx-auto text-emerald-600 mb-2" />
                  <p className="font-semibold text-[13px]">Clear for this period</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">No GSTIN, zero-GST, or HSN alerts.</p>
                </div>
              ) : (data.warnings || []).map((w, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-md border ${w.type === 'error' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                  <AlertTriangle size={14} className={w.type === 'error' ? 'text-rose-600' : 'text-amber-700'} />
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">{w.code}</p>
                    <p className="text-[12px]">{w.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CADashboardModal;
