import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { downloadCsv, getMonthRange, fmtAmt, fmtDate } from '../../utils/reportExport';
import { RefreshCw, Download, Printer, BarChart3, FileText, Warehouse, Users, Briefcase } from 'lucide-react';

const TABS = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'sales', label: 'Sales Register', icon: FileText },
  { id: 'purchase', label: 'Purchase Register', icon: FileText },
  { id: 'stock', label: 'Stock Report', icon: Warehouse },
  { id: 'stockItem', label: 'Item-wise Stock', icon: Warehouse },
  { id: 'outstanding', label: 'Outstanding', icon: Users },
  { id: 'jobwork', label: 'Job Work', icon: Briefcase },
  { id: 'pl', label: 'P & L', icon: BarChart3 },
  { id: 'daily', label: 'Daily Transaction', icon: FileText },
  { id: 'masters', label: 'Master List', icon: Users }
];

const Kpi = ({ label, value, sub }) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
    <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{value}</p>
    {sub && <p className="text-[10px] text-[var(--text-muted)]">{sub}</p>}
  </div>
);

const ReportTable = ({ columns, rows, emptyText, onExport, exportLabel }) => (
  <div>
    {onExport && (
      <div className="flex justify-end mb-2">
        <button type="button" onClick={onExport} className="erp-btn erp-btn-secondary h-7 px-3 text-[10px] gap-1">
          <Download size={12} /> {exportLabel || 'Export CSV'}
        </button>
      </div>
    )}
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[calc(90vh-280px)] overflow-y-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wider sticky top-0 z-10">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-[var(--text-muted)]">{emptyText}</td></tr>
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
  </div>
);

const ReportsHub = ({ isOpen, onClose, initialTab = 'summary' }) => {
  const { fetchReportsBundle, fetchTrialBalance } = useStore();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [trialBalance, setTrialBalance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [osType, setOsType] = useState('receivable');

  const load = useCallback(async () => {
    const { startDate, endDate } = getMonthRange(month);
    setLoading(true);
    try {
      const [bundle, tb] = await Promise.all([
        fetchReportsBundle(startDate, endDate),
        fetchTrialBalance(endDate).catch(() => [])
      ]);
      setData(bundle);
      setTrialBalance(Array.isArray(tb) ? tb : []);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [month, fetchReportsBundle, fetchTrialBalance]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      load();
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen) load();
  }, [month]);

  const s = data?.summary || {};
  const osData = osType === 'receivable' ? (data?.outstandingReceivable || []) : (data?.outstandingPayable || []);

  const salesCols = [
    { key: 'invoiceNo', label: 'Invoice', render: (r) => <span className="font-bold">{r.invoiceNo}</span> },
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'partyName', label: 'Customer' },
    { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmtAmt(r.taxable) },
    { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => fmtAmt(r.gstAmount) },
    { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
    { key: 'paidAmount', label: 'Received', align: 'right', render: (r) => fmtAmt(r.paidAmount) },
    { key: 'balance', label: 'Balance', align: 'right', render: (r) => fmtAmt(r.balance) }
  ];

  const exportSales = () => downloadCsv('sales-register.csv',
    ['Invoice', 'Date', 'Customer', 'Taxable', 'GST', 'Net', 'Received', 'Balance'],
    (data?.salesRegister || []).map((r) => [r.invoiceNo, fmtDate(r.date), r.partyName, r.taxable, r.gstAmount, r.netAmount, r.paidAmount, r.balance])
  );

  const exportPurchase = () => downloadCsv('purchase-register.csv',
    ['Bill No', 'Date', 'Supplier', 'Taxable', 'GST', 'Net', 'Paid', 'Balance'],
    (data?.purchaseRegister || []).map((r) => [r.billNo, fmtDate(r.date), r.partyName, r.taxable, r.gstAmount, r.netAmount, r.paidAmount, r.balance])
  );

  const exportStock = () => downloadCsv('stock-report.csv',
    ['Lot', 'Item', 'Pcs', 'Mtrs Rem', 'Status', 'Source'],
    (data?.stockReport || []).map((r) => [r.lotId, r.itemName, r.remainingPcs, r.remainingMtrs, r.status, r.source])
  );

  const exportTrialBalance = () => downloadCsv('trial-balance.csv',
    ['Ledger', 'Debit', 'Credit'],
    trialBalance.map(r => [r.ledger?.name || r.name, r.debit || r.debitBalance || 0, r.credit || r.creditBalance || 0])
  );

  const exportStockByItem = () => downloadCsv('stock-by-item.csv',
    ['Item', 'Group', 'Lots', 'Pcs', 'Mtrs Rem', 'Used Mtrs'],
    (data?.stockByItem || []).map(r => [r.itemName, r.group, r.lotCount, r.remainingPcs, r.remainingMtrs, r.usedMtrs])
  );

  const exportJobWork = () => downloadCsv('job-work-report.csv',
    ['Job Card', 'Issue Date', 'Worker', 'Process', 'Issued Qty', 'Received Qty', 'Wastage%', 'Status'],
    (data?.jobWorkReport || []).map(r => [r.jobCardNo, fmtDate(r.issueDate), r.workerName, r.processType, r.issueQty, r.receivedQty, `${r.wastagePct}%`, r.status])
  );

  const exportDailyTransactions = () => downloadCsv('daily-transactions.csv',
    ['Date', 'Type', 'Doc No', 'Party', 'Debit', 'Credit'],
    (data?.dailyTransactions || []).map(r => [fmtDate(r.date), r.type, r.docNo, r.party, r.debit || 0, r.credit || 0])
  );

  const exportAccounts = () => downloadCsv('master-accounts.csv',
    ['Name', 'Type', 'Group', 'City', 'Mobile'],
    (data?.masterSummary?.accounts || []).map(r => [r.name, r.type, r.group, r.city, r.mobile])
  );

  const exportItems = () => downloadCsv('master-items.csv',
    ['Item', 'Group', 'HSN', 'Sale Rate', 'Pur Rate'],
    (data?.masterSummary?.items || []).map(r => [r.itemName, r.group, r.hsnCode, r.salesRate, r.purRate])
  );

  const exportProfitLoss = () => {
    const pl = data?.profitLoss || {};
    downloadCsv(`profit-loss-${month}.csv`,
      ['Particulars', 'Amount'],
      [
        ['Sales (Taxable)', pl.revenue],
        ['Sales GST', pl.salesGst],
        ['Sales Net', pl.salesNet],
        ['Purchase (Taxable / COGS)', pl.cogs],
        ['Purchase GST', pl.purchaseGst],
        ['Purchase Net', pl.purchaseNet],
        ['Gross Profit', pl.grossProfit],
        ['Net Profit (approx)', pl.netProfit]
      ]
    );
  };


  const handlePrint = () => window.print();

  const renderContent = () => {
    if (!data && loading) return <p className="text-center py-12 text-[var(--text-muted)]">Loading reports from database...</p>;
    if (!data) return null;

    switch (activeTab) {
      case 'summary':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Kpi label="Sales (Period)" value={`₹ ${fmtAmt(s.salesTotal)}`} sub={`${s.salesCount || 0} invoices`} />
              <Kpi label="Purchase (Period)" value={`₹ ${fmtAmt(s.purchaseTotal)}`} sub={`${s.purchaseCount || 0} bills`} />
              <Kpi label="Receivable" value={`₹ ${fmtAmt(s.receivable)}`} sub="Customer dues" />
              <Kpi label="Payable" value={`₹ ${fmtAmt(s.payable)}`} sub="Supplier dues" />
              <Kpi label="Stock (Mtrs)" value={fmtAmt(s.stockMtrs)} sub={`${s.stockLots || 0} lots`} />
              <Kpi label="Gross Profit" value={`₹ ${fmtAmt(data.profitLoss?.grossProfit)}`} sub="Taxable basis" />
            </div>
            {trialBalance.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase text-[var(--text-muted)] mb-2">Trial Balance</h3>
                <ReportTable
                  columns={[
                    { key: 'name', label: 'Ledger', render: (r) => r.ledger?.name || r.name },
                    { key: 'debit', label: 'Debit', align: 'right', render: (r) => fmtAmt(r.debit || r.debitBalance) },
                    { key: 'credit', label: 'Credit', align: 'right', render: (r) => fmtAmt(r.credit || r.creditBalance) }
                  ]}
                  rows={trialBalance.slice(0, 20).map((r, i) => ({ ...r, _key: i }))}
                  emptyText="No trial balance"
                  onExport={exportTrialBalance}
                />
              </div>
            )}
          </div>
        );

      case 'sales':
        return (
          <ReportTable
            columns={salesCols}
            rows={(data.salesRegister || []).map((r, i) => ({ ...r, _key: i }))}
            emptyText="No sales in selected period"
            onExport={exportSales}
          />
        );

      case 'purchase':
        return (
          <ReportTable
            columns={[
              { key: 'billNo', label: 'Bill', render: (r) => <span className="font-bold">{r.billNo}</span> },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'partyName', label: 'Supplier' },
              { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmtAmt(r.taxable) },
              { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => fmtAmt(r.gstAmount) },
              { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
              { key: 'paidAmount', label: 'Paid', align: 'right', render: (r) => fmtAmt(r.paidAmount) },
              { key: 'balance', label: 'Balance', align: 'right', render: (r) => fmtAmt(r.balance) }
            ]}
            rows={(data.purchaseRegister || []).map((r, i) => ({ ...r, _key: i }))}
            emptyText="No purchases in selected period"
            onExport={exportPurchase}
          />
        );

      case 'stock':
        return (
          <ReportTable
            columns={[
              { key: 'lotId', label: 'Lot ID', render: (r) => <span className="font-bold">{r.lotId}</span> },
              { key: 'itemName', label: 'Item' },
              { key: 'remainingPcs', label: 'Pcs', align: 'right' },
              { key: 'remainingMtrs', label: 'Mtrs', align: 'right', render: (r) => (r.remainingMtrs || 0).toFixed(2) },
              { key: 'usedMtrs', label: 'Used', align: 'right', render: (r) => (r.usedMtrs || 0).toFixed(2) },
              { key: 'status', label: 'Status' },
              { key: 'source', label: 'Source' }
            ]}
            rows={(data.stockReport || []).map((r, i) => ({ ...r, _key: i }))}
            emptyText="No inventory lots"
            onExport={exportStock}
          />
        );

      case 'stockItem':
        return (
          <ReportTable
            columns={[
              { key: 'itemName', label: 'Item', render: (r) => <span className="font-bold uppercase">{r.itemName}</span> },
              { key: 'group', label: 'Group' },
              { key: 'lotCount', label: 'Lots', align: 'right' },
              { key: 'remainingPcs', label: 'Pcs', align: 'right' },
              { key: 'remainingMtrs', label: 'Mtrs', align: 'right', render: (r) => (r.remainingMtrs || 0).toFixed(2) },
              { key: 'usedMtrs', label: 'Used Mtrs', align: 'right', render: (r) => (r.usedMtrs || 0).toFixed(2) }
            ]}
            rows={(data.stockByItem || []).map((r, i) => ({ ...r, _key: i }))}
            emptyText="No stock by item"
            onExport={exportStockByItem}
          />
        );

      case 'outstanding':
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              {['receivable', 'payable'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOsType(t)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border ${
                    osType === t ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)]'
                  }`}
                >
                  {t === 'receivable' ? 'Sales Outstanding' : 'Purchase Outstanding'}
                </button>
              ))}
            </div>
            <ReportTable
              columns={[
                { key: 'partyName', label: 'Party', render: (r) => <span className="font-semibold">{r.partyName}</span> },
                { key: 'phone', label: 'Mobile' },
                { key: 'city', label: 'City' },
                { key: 'totalOutstanding', label: 'Outstanding', align: 'right', render: (r) => fmtAmt(r.totalOutstanding) },
                { key: 'b30', label: '0-30d', align: 'right', render: (r) => fmtAmt(r.aging?.bucket30) },
                { key: 'b60', label: '31-60d', align: 'right', render: (r) => fmtAmt(r.aging?.bucket60) },
                { key: 'b90', label: '61-90d', align: 'right', render: (r) => fmtAmt(r.aging?.bucket90) },
                { key: 'b90p', label: '90+d', align: 'right', render: (r) => fmtAmt(r.aging?.bucket90Plus) }
              ]}
              rows={osData.map((r, i) => ({ ...r, _key: i }))}
              emptyText="No outstanding balance"
              onExport={() => downloadCsv(`${osType}-outstanding.csv`,
                ['Party', 'Mobile', 'Outstanding', '0-30', '31-60', '61-90', '90+'],
                osData.map((r) => [r.partyName, r.phone, r.totalOutstanding, r.aging?.bucket30, r.aging?.bucket60, r.aging?.bucket90, r.aging?.bucket90Plus])
              )}
            />
          </div>
        );

      case 'jobwork':
        return (
          <ReportTable
            columns={[
              { key: 'jobCardNo', label: 'Job Card', render: (r) => <span className="font-bold">{r.jobCardNo}</span> },
              { key: 'issueDate', label: 'Issue', render: (r) => fmtDate(r.issueDate) },
              { key: 'workerName', label: 'Worker' },
              { key: 'processType', label: 'Process' },
              { key: 'issueQty', label: 'Issued', align: 'right' },
              { key: 'receivedQty', label: 'Received', align: 'right' },
              { key: 'wastagePct', label: 'Wastage%', align: 'right', render: (r) => `${r.wastagePct}%` },
              { key: 'status', label: 'Status' }
            ]}
            rows={(data.jobWorkReport || []).map((r, i) => ({ ...r, _key: i }))}
            emptyText="No job work in period"
            onExport={exportJobWork}
          />
        );

      case 'pl': {
        const pl = data.profitLoss || {};
        return (
          <div className="max-w-lg erp-card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold">Profit & Loss — {month}</h3>
              <button type="button" onClick={exportProfitLoss} className="erp-btn erp-btn-secondary h-7 px-3 text-[10px] gap-1">
                <Download size={12} /> Export CSV
              </button>
            </div>
            <table className="w-full text-[11px]">
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {[
                  ['Sales (Taxable)', pl.revenue],
                  ['Sales GST', pl.salesGst],
                  ['Sales Net', pl.salesNet],
                  ['Purchase (Taxable / COGS)', pl.cogs],
                  ['Purchase GST', pl.purchaseGst],
                  ['Purchase Net', pl.purchaseNet],
                  ['Gross Profit', pl.grossProfit],
                  ['Net Profit (approx)', pl.netProfit]
                ].map(([label, val]) => (
                  <tr key={label}>
                    <td className="py-2 font-medium">{label}</td>
                    <td className="py-2 text-right font-bold">₹ {fmtAmt(val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'daily':
        return (
          <ReportTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'type', label: 'Type' },
              { key: 'docNo', label: 'Doc No' },
              { key: 'party', label: 'Party' },
              { key: 'debit', label: 'Debit', align: 'right', render: (r) => r.debit ? fmtAmt(r.debit) : '—' },
              { key: 'credit', label: 'Credit', align: 'right', render: (r) => r.credit ? fmtAmt(r.credit) : '—' }
            ]}
            rows={(data.dailyTransactions || []).map((r, i) => ({ ...r, _key: i }))}
            emptyText="No transactions in period"
            onExport={exportDailyTransactions}
          />
        );

      case 'masters':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase text-[var(--text-muted)] mb-2">Accounts ({data.masterSummary?.accounts?.length || 0})</h3>
              <ReportTable
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'type', label: 'Type' },
                  { key: 'group', label: 'Group' },
                  { key: 'city', label: 'City' },
                  { key: 'mobile', label: 'Mobile' }
                ]}
                rows={(data.masterSummary?.accounts || []).map((r, i) => ({ ...r, _key: `a${i}` }))}
                emptyText="No accounts"
                onExport={exportAccounts}
                exportLabel="Export Accounts"
              />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase text-[var(--text-muted)] mb-2">Items ({data.masterSummary?.items?.length || 0})</h3>
              <ReportTable
                columns={[
                  { key: 'itemName', label: 'Item' },
                  { key: 'group', label: 'Group' },
                  { key: 'hsnCode', label: 'HSN' },
                  { key: 'salesRate', label: 'Sale Rate', align: 'right', render: (r) => fmtAmt(r.salesRate) },
                  { key: 'purRate', label: 'Pur Rate', align: 'right', render: (r) => fmtAmt(r.purRate) }
                ]}
                rows={(data.masterSummary?.items || []).map((r, i) => ({ ...r, _key: `i${i}` }))}
                emptyText="No items"
                onExport={exportItems}
                exportLabel="Export Items"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reports Hub — Live from Database" className="max-w-[98vw] w-full h-[92vh] p-0">
      <div className="flex flex-col h-[calc(92vh-48px)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <div>
            <p className="text-sm font-bold">All Reports</p>
            <p className="text-[10px] text-[var(--text-muted)]">
              UI ↔ DB matched • {data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleTimeString('en-IN')}` : 'Select period'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-8 px-2 text-xs border border-[var(--border-strong)] rounded-lg"
            />
            <button type="button" onClick={load} disabled={loading} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button type="button" onClick={handlePrint} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
              <Printer size={12} /> Print
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-2 border-b border-[var(--border)] overflow-x-auto no-scrollbar bg-[var(--bg-card)]">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1 px-3 py-2 text-[10px] font-semibold rounded-t-lg whitespace-nowrap ${
                  activeTab === t.id ? 'bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border)] border-b-0 -mb-px' : 'text-[var(--text-muted)]'
                }`}
              >
                <Icon size={11} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 print:p-2">
          {renderContent()}
        </div>
      </div>
    </Modal>
  );
};

export default ReportsHub;
