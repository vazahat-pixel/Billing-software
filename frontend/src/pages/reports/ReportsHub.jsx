import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { notifyError } from '../../utils/notify';
import { downloadCsv, fmtAmt, fmtDate } from '../../utils/reportExport';
import { ReportLoader } from '../../components/ui/loaders';
import {
  REPORT_TREE,
  findReportLeaf,
  flattenReportLeaves,
  LEGACY_TAB_TO_LEAF,
  reportAncestorIds,
} from '../../utils/reportTree';
import {
  RefreshCw,
  Download,
  Printer,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Search,
  Calendar,
} from 'lucide-react';

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const lastOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const Kpi = ({ label, value, sub }) => (
  <div className="rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-2 min-h-[64px] flex flex-col justify-center">
    <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] truncate leading-none">{label}</p>
    <p className="text-[13px] font-semibold text-[var(--text-primary)] mt-1 leading-none tabular-nums whitespace-nowrap truncate">{value}</p>
    <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-none truncate h-3">{sub || ''}</p>
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
      <div className="overflow-x-auto max-h-[calc(90vh-320px)] overflow-y-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wide sticky top-0 z-10">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-2.5 py-1.5 font-semibold align-middle whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-2.5 py-8 text-center text-[var(--text-muted)]">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row._key || i} className="hover:bg-[var(--bg-base)]">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-2.5 py-1 align-middle leading-none ${c.align === 'right' ? 'text-right font-medium tabular-nums whitespace-nowrap' : ''}`}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

function filterByParty(rows, partyName, field = 'partyName') {
  const q = (partyName || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => String(r[field] || r.party || r.workerName || '').toLowerCase().includes(q));
}

function summarizeByParty(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.partyName || r.party || 'UNKNOWN';
    const cur = map.get(key) || {
      partyName: key,
      count: 0,
      taxable: 0,
      gstAmount: 0,
      netAmount: 0,
      paidAmount: 0,
      balance: 0,
    };
    cur.count += 1;
    cur.taxable += Number(r.taxable) || 0;
    cur.gstAmount += Number(r.gstAmount) || 0;
    cur.netAmount += Number(r.netAmount) || 0;
    cur.paidAmount += Number(r.paidAmount) || 0;
    cur.balance += Number(r.balance) || 0;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.partyName.localeCompare(b.partyName));
}

function TreeNode({ node, depth, expanded, selectedId, onToggle, onSelect }) {
  const hasKids = Array.isArray(node.children) && node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasKids) onToggle(node.id);
          else onSelect(node);
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] rounded-md transition-colors ${
          isSelected
            ? 'bg-[var(--accent)] text-white font-semibold'
            : 'text-[var(--text-primary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]'
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {hasKids ? (
          isOpen ? <ChevronDown size={12} className="shrink-0 opacity-70" /> : <ChevronRight size={12} className="shrink-0 opacity-70" />
        ) : (
          <FileText size={11} className="shrink-0 opacity-70" />
        )}
        {hasKids && <Folder size={11} className="shrink-0 opacity-60" />}
        <span className="truncate flex-1">{node.label}</span>
        {node.soon && (
          <span className={`text-[8px] uppercase font-bold px-1 rounded ${isSelected ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>
            Soon
          </span>
        )}
      </button>
      {hasKids && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const ReportsHub = ({ isOpen, onClose, initialTab = 'summary', initialLeafId = null, onOpenExternal }) => {
  const { fetchReportsBundle, fetchTrialBalance, parties } = useStore();
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(lastOfMonth);
  const [partyName, setPartyName] = useState('');
  const [selectedLeafId, setSelectedLeafId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [data, setData] = useState(null);
  const [trialBalance, setTrialBalance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [osType, setOsType] = useState('receivable');
  const [treeFilter, setTreeFilter] = useState('');

  const leaves = useMemo(() => flattenReportLeaves(), []);
  const selectedLeaf = useMemo(
    () => (selectedLeafId ? findReportLeaf(selectedLeafId) || leaves.find((l) => l.id === selectedLeafId) : null),
    [selectedLeafId, leaves]
  );
  const reportKey = selectedLeaf?.reportKey || null;
  const pathLabel = useMemo(() => {
    const leaf = leaves.find((l) => l.id === selectedLeafId);
    return leaf?.path?.join(' › ') || selectedLeaf?.label || 'Select a report';
  }, [leaves, selectedLeafId, selectedLeaf]);

  const partyOptions = useMemo(() => {
    const list = Array.isArray(parties) ? parties : [];
    return list
      .map((p) => p.name || p.partyName || '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [parties]);

  const filteredTree = useMemo(() => {
    const q = treeFilter.trim().toLowerCase();
    if (!q) return REPORT_TREE;
    const filterNodes = (nodes) =>
      nodes
        .map((n) => {
          if (n.children?.length) {
            const kids = filterNodes(n.children);
            if (kids.length || n.label.toLowerCase().includes(q)) {
              return { ...n, children: kids.length ? kids : n.children };
            }
            return null;
          }
          return n.label.toLowerCase().includes(q) ? n : null;
        })
        .filter(Boolean);
    return filterNodes(REPORT_TREE);
  }, [treeFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bundle, tb] = await Promise.all([
        fetchReportsBundle(fromDate, toDate),
        fetchTrialBalance(toDate).catch(() => []),
      ]);
      setData(bundle);
      setTrialBalance(Array.isArray(tb) ? tb : []);
      setGenerated(true);
    } catch (err) {
      console.error(err);
      notifyError(err, 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, fetchReportsBundle, fetchTrialBalance]);

  useEffect(() => {
    if (!isOpen) return;
    const leafId = initialLeafId || LEGACY_TAB_TO_LEAF[initialTab] || null;
    setSelectedLeafId(leafId);
    setExpanded(new Set(leafId ? reportAncestorIds(leafId) || [] : []));
    setGenerated(false);
    setData(null);
    if (leafId) load();
    // Open once per menu click. `load` changes with dates; do not re-run on that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab, initialLeafId]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectLeaf = (node) => {
    if (node.external && onOpenExternal) {
      onOpenExternal(node.external);
      return;
    }
    setSelectedLeafId(node.id);
    setGenerated(false);
  };

  const handleGenerate = () => {
    if (!selectedLeaf) return;
    load();
  };

  const handlePrint = () => window.print();

  const salesRows = useMemo(
    () => filterByParty(data?.salesRegister || [], partyName),
    [data, partyName]
  );
  const purchaseRows = useMemo(
    () => filterByParty(data?.purchaseRegister || [], partyName),
    [data, partyName]
  );
  const jobRows = useMemo(
    () => filterByParty(data?.jobWorkReport || [], partyName, 'workerName'),
    [data, partyName]
  );
  const dailyRows = useMemo(
    () => filterByParty(data?.dailyTransactions || [], partyName, 'party'),
    [data, partyName]
  );

  const renderReportBody = () => {
    if (!selectedLeaf) {
      return (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Left se report choose karo — Sales → Sales Bill → Sales Summary
        </div>
      );
    }

    if (!generated && !loading) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
          <Calendar size={28} className="text-[var(--accent)] opacity-80" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">{pathLabel}</p>
          <p className="text-[12px] text-[var(--text-muted)]">
            From / To date aur Party set karke <strong>Generate Report</strong> dabao.
          </p>
        </div>
      );
    }

    if (loading || !data) return <ReportLoader />;

    const s = data.summary || {};
    const osData =
      osType === 'receivable' ? data.outstandingReceivable || [] : data.outstandingPayable || [];
    const osFiltered = filterByParty(osData, partyName);

    const jobTable = (rows, emptyText = 'No job work in period') => (
      <ReportTable
        columns={[
          { key: 'jobCardNo', label: 'Job Card', render: (r) => <span className="font-bold">{r.jobCardNo}</span> },
          { key: 'issueDate', label: 'Issue', render: (r) => fmtDate(r.issueDate) },
          { key: 'receiveDate', label: 'Receive', render: (r) => fmtDate(r.receiveDate) },
          { key: 'workerName', label: 'Worker' },
          { key: 'processType', label: 'Process' },
          { key: 'issueQty', label: 'Issued', align: 'right' },
          { key: 'receivedQty', label: 'Received', align: 'right' },
          { key: 'wastagePct', label: 'Wastage%', align: 'right', render: (r) => `${r.wastagePct}%` },
          { key: 'status', label: 'Status' },
        ]}
        rows={rows.map((r, i) => ({ ...r, _key: i }))}
        emptyText={emptyText}
        onExport={() =>
          downloadCsv(
            'job-process-report.csv',
            ['Job Card', 'Issue Date', 'Receive', 'Worker', 'Process', 'Issued', 'Received', 'Wastage%', 'Status'],
            rows.map((r) => [
              r.jobCardNo,
              fmtDate(r.issueDate),
              fmtDate(r.receiveDate),
              r.workerName,
              r.processType,
              r.issueQty,
              r.receivedQty,
              `${r.wastagePct}%`,
              r.status,
            ])
          )
        }
      />
    );

    const orderTable = (rows, emptyText) => (
      <ReportTable
        columns={[
          { key: 'orderNo', label: 'Order No', render: (r) => <span className="font-bold">{r.orderNo}</span> },
          { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
          { key: 'partyName', label: 'Party' },
          { key: 'itemCount', label: 'Items', align: 'right' },
          { key: 'qty', label: 'Qty', align: 'right', render: (r) => fmtAmt(r.qty) },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmtAmt(r.amount) },
          { key: 'status', label: 'Status' },
          { key: 'transport', label: 'Transport' },
        ]}
        rows={rows.map((r, i) => ({ ...r, _key: i }))}
        emptyText={emptyText}
        onExport={() =>
          downloadCsv(
            'order-register.csv',
            ['Order No', 'Date', 'Party', 'Items', 'Qty', 'Amount', 'Status', 'Transport'],
            rows.map((r) => [r.orderNo, fmtDate(r.date), r.partyName, r.itemCount, r.qty, r.amount, r.status, r.transport])
          )
        }
      />
    );

    const returnTable = (rows, emptyText) => (
      <ReportTable
        columns={[
          { key: 'invoiceNo', label: 'Return No', render: (r) => <span className="font-bold">{r.invoiceNo}</span> },
          { key: 'originalInvoiceNo', label: 'Against' },
          { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
          { key: 'partyName', label: 'Party' },
          { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmtAmt(r.taxable) },
          { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => fmtAmt(r.gstAmount) },
          { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
        ]}
        rows={rows.map((r, i) => ({ ...r, _key: i }))}
        emptyText={emptyText}
        onExport={() =>
          downloadCsv(
            'return-register.csv',
            ['Return No', 'Against', 'Date', 'Party', 'Taxable', 'GST', 'Net'],
            rows.map((r) => [r.invoiceNo, r.originalInvoiceNo, fmtDate(r.date), r.partyName, r.taxable, r.gstAmount, r.netAmount])
          )
        }
      />
    );

    switch (reportKey) {
      case 'summary':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <Kpi label="Sales (Period)" value={`₹ ${fmtAmt(s.salesTotal)}`} sub={`${s.salesCount || 0} invoices`} />
              <Kpi label="Purchase (Period)" value={`₹ ${fmtAmt(s.purchaseTotal)}`} sub={`${s.purchaseCount || 0} bills`} />
              <Kpi label="Receivable" value={`₹ ${fmtAmt(s.receivable)}`} sub="Customer dues" />
              <Kpi label="Payable" value={`₹ ${fmtAmt(s.payable)}`} sub="Supplier dues" />
              <Kpi label="Stock (Mtrs)" value={fmtAmt(s.stockMtrs)} sub={`${s.stockLots || 0} lots`} />
              <Kpi label="Gross Profit" value={`₹ ${fmtAmt(data.profitLoss?.grossProfit)}`} sub="Taxable basis" />
            </div>
            {trialBalance.length > 0 && (
              <ReportTable
                columns={[
                  { key: 'name', label: 'Ledger', render: (r) => r.ledger?.name || r.name },
                  { key: 'debit', label: 'Debit', align: 'right', render: (r) => fmtAmt(r.debit || r.debitBalance) },
                  { key: 'credit', label: 'Credit', align: 'right', render: (r) => fmtAmt(r.credit || r.creditBalance) },
                ]}
                rows={trialBalance.slice(0, 40).map((r, i) => ({ ...r, _key: i }))}
                emptyText="No trial balance"
                onExport={() =>
                  downloadCsv(
                    'trial-balance.csv',
                    ['Ledger', 'Debit', 'Credit'],
                    trialBalance.map((r) => [r.ledger?.name || r.name, r.debit || r.debitBalance || 0, r.credit || r.creditBalance || 0])
                  )
                }
              />
            )}
          </div>
        );

      case 'salesSummary': {
        const rows = summarizeByParty(salesRows);
        return (
          <ReportTable
            columns={[
              { key: 'partyName', label: 'Party', render: (r) => <span className="font-semibold">{r.partyName}</span> },
              { key: 'count', label: 'Bills', align: 'right' },
              { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmtAmt(r.taxable) },
              { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => fmtAmt(r.gstAmount) },
              { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
              { key: 'balance', label: 'Balance', align: 'right', render: (r) => fmtAmt(r.balance) },
            ]}
            rows={rows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No sales for selected party / period"
            onExport={() =>
              downloadCsv(
                'sales-summary.csv',
                ['Party', 'Bills', 'Taxable', 'GST', 'Net', 'Balance'],
                rows.map((r) => [r.partyName, r.count, r.taxable, r.gstAmount, r.netAmount, r.balance])
              )
            }
          />
        );
      }

      case 'salesDetail':
        return (
          <ReportTable
            columns={[
              { key: 'invoiceNo', label: 'Invoice', render: (r) => <span className="font-bold">{r.invoiceNo}</span> },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'partyName', label: 'Customer' },
              { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmtAmt(r.taxable) },
              { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => fmtAmt(r.gstAmount) },
              { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
              { key: 'paidAmount', label: 'Received', align: 'right', render: (r) => fmtAmt(r.paidAmount) },
              { key: 'balance', label: 'Balance', align: 'right', render: (r) => fmtAmt(r.balance) },
            ]}
            rows={salesRows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No sales in selected period"
            onExport={() =>
              downloadCsv(
                'sales-register.csv',
                ['Invoice', 'Date', 'Customer', 'Taxable', 'GST', 'Net', 'Received', 'Balance'],
                salesRows.map((r) => [r.invoiceNo, fmtDate(r.date), r.partyName, r.taxable, r.gstAmount, r.netAmount, r.paidAmount, r.balance])
              )
            }
          />
        );

      case 'purchaseSummary': {
        const rows = summarizeByParty(purchaseRows);
        return (
          <ReportTable
            columns={[
              { key: 'partyName', label: 'Supplier', render: (r) => <span className="font-semibold">{r.partyName}</span> },
              { key: 'count', label: 'Bills', align: 'right' },
              { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmtAmt(r.taxable) },
              { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => fmtAmt(r.gstAmount) },
              { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
              { key: 'balance', label: 'Balance', align: 'right', render: (r) => fmtAmt(r.balance) },
            ]}
            rows={rows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No purchases for selected party / period"
            onExport={() =>
              downloadCsv(
                'purchase-summary.csv',
                ['Supplier', 'Bills', 'Taxable', 'GST', 'Net', 'Balance'],
                rows.map((r) => [r.partyName, r.count, r.taxable, r.gstAmount, r.netAmount, r.balance])
              )
            }
          />
        );
      }

      case 'purchaseDetail':
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
              { key: 'balance', label: 'Balance', align: 'right', render: (r) => fmtAmt(r.balance) },
            ]}
            rows={purchaseRows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No purchases in selected period"
            onExport={() =>
              downloadCsv(
                'purchase-register.csv',
                ['Bill No', 'Date', 'Supplier', 'Taxable', 'GST', 'Net', 'Paid', 'Balance'],
                purchaseRows.map((r) => [r.billNo, fmtDate(r.date), r.partyName, r.taxable, r.gstAmount, r.netAmount, r.paidAmount, r.balance])
              )
            }
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
              { key: 'source', label: 'Source' },
            ]}
            rows={(data.stockReport || []).map((r, i) => ({ ...r, _key: i }))}
            emptyText="No inventory lots"
            onExport={() =>
              downloadCsv(
                'stock-report.csv',
                ['Lot', 'Item', 'Pcs', 'Mtrs Rem', 'Status', 'Source'],
                (data.stockReport || []).map((r) => [r.lotId, r.itemName, r.remainingPcs, r.remainingMtrs, r.status, r.source])
              )
            }
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
              { key: 'usedMtrs', label: 'Used Mtrs', align: 'right', render: (r) => (r.usedMtrs || 0).toFixed(2) },
            ]}
            rows={(data.stockByItem || []).map((r, i) => ({ ...r, _key: i }))}
            emptyText="No stock by item"
            onExport={() =>
              downloadCsv(
                'stock-by-item.csv',
                ['Item', 'Group', 'Lots', 'Pcs', 'Mtrs Rem', 'Used Mtrs'],
                (data.stockByItem || []).map((r) => [r.itemName, r.group, r.lotCount, r.remainingPcs, r.remainingMtrs, r.usedMtrs])
              )
            }
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
                { key: 'b90p', label: '90+d', align: 'right', render: (r) => fmtAmt(r.aging?.bucket90Plus) },
              ]}
              rows={osFiltered.map((r, i) => ({ ...r, _key: i }))}
              emptyText="No outstanding balance"
              onExport={() =>
                downloadCsv(
                  `${osType}-outstanding.csv`,
                  ['Party', 'Mobile', 'Outstanding', '0-30', '31-60', '61-90', '90+'],
                  osFiltered.map((r) => [
                    r.partyName,
                    r.phone,
                    r.totalOutstanding,
                    r.aging?.bucket30,
                    r.aging?.bucket60,
                    r.aging?.bucket90,
                    r.aging?.bucket90Plus,
                  ])
                )
              }
            />
          </div>
        );

      case 'jobwork':
      case 'jobworkPending':
      case 'jobworkChallan': {
        let rows = jobRows;
        if (reportKey === 'jobworkPending') {
          rows = jobRows.filter((r) => String(r.status || '').toLowerCase() !== 'completed' && String(r.status || '').toLowerCase() !== 'received');
        }
        return jobTable(rows, 'No job work in period');
      }

      case 'processSend':
        return jobTable(
          filterByParty(data.processSend || [], partyName, 'workerName'),
          'No process send in period'
        );

      case 'processReceiptSummary': {
        const rows = filterByParty(data.processReceipt || [], partyName, 'workerName');
        const map = new Map();
        for (const r of rows) {
          const key = r.workerName || '—';
          const cur = map.get(key) || { workerName: key, jobs: 0, issueQty: 0, receivedQty: 0, wastage: 0 };
          cur.jobs += 1;
          cur.issueQty += Number(r.issueQty) || 0;
          cur.receivedQty += Number(r.receivedQty) || 0;
          cur.wastage += Number(r.wastage) || 0;
          map.set(key, cur);
        }
        const summaryRows = Array.from(map.values());
        return (
          <ReportTable
            columns={[
              { key: 'workerName', label: 'Worker / Process Party' },
              { key: 'jobs', label: 'Jobs', align: 'right' },
              { key: 'issueQty', label: 'Issued', align: 'right', render: (r) => fmtAmt(r.issueQty) },
              { key: 'receivedQty', label: 'Received', align: 'right', render: (r) => fmtAmt(r.receivedQty) },
              { key: 'wastage', label: 'Wastage', align: 'right', render: (r) => fmtAmt(r.wastage) },
            ]}
            rows={summaryRows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No process receipts"
            onExport={() =>
              downloadCsv(
                'process-receipt-summary.csv',
                ['Worker', 'Jobs', 'Issued', 'Received', 'Wastage'],
                summaryRows.map((r) => [r.workerName, r.jobs, r.issueQty, r.receivedQty, r.wastage])
              )
            }
          />
        );
      }

      case 'processReceiptDetail':
        return jobTable(
          filterByParty(data.processReceipt || [], partyName, 'workerName'),
          'No process receipts'
        );

      case 'salesItemWise': {
        const rows = (data.salesItemWise || []).filter((r) => {
          const q = partyName.trim().toLowerCase();
          if (!q) return true;
          return String(r.itemName || '').toLowerCase().includes(q);
        });
        return (
          <ReportTable
            columns={[
              { key: 'itemName', label: 'Item', render: (r) => <span className="font-semibold">{r.itemName}</span> },
              { key: 'hsnCode', label: 'HSN' },
              { key: 'bills', label: 'Lines', align: 'right' },
              { key: 'partyCount', label: 'Parties', align: 'right' },
              { key: 'pcs', label: 'Pcs', align: 'right' },
              { key: 'mts', label: 'Mtrs', align: 'right', render: (r) => fmtAmt(r.mts) },
              { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmtAmt(r.amount) },
            ]}
            rows={rows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No item-wise sales"
            onExport={() =>
              downloadCsv(
                'sales-item-wise.csv',
                ['Item', 'HSN', 'Lines', 'Parties', 'Pcs', 'Mtrs', 'Amount'],
                rows.map((r) => [r.itemName, r.hsnCode, r.bills, r.partyCount, r.pcs, r.mts, r.amount])
              )
            }
          />
        );
      }

      case 'purchaseItemWise': {
        const rows = (data.purchaseItemWise || []).filter((r) => {
          const q = partyName.trim().toLowerCase();
          if (!q) return true;
          return String(r.itemName || '').toLowerCase().includes(q);
        });
        return (
          <ReportTable
            columns={[
              { key: 'itemName', label: 'Item', render: (r) => <span className="font-semibold">{r.itemName}</span> },
              { key: 'hsnCode', label: 'HSN' },
              { key: 'bills', label: 'Lines', align: 'right' },
              { key: 'partyCount', label: 'Parties', align: 'right' },
              { key: 'pcs', label: 'Pcs', align: 'right' },
              { key: 'mts', label: 'Mtrs', align: 'right', render: (r) => fmtAmt(r.mts) },
              { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmtAmt(r.amount) },
            ]}
            rows={rows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No item-wise purchases"
            onExport={() =>
              downloadCsv(
                'purchase-item-wise.csv',
                ['Item', 'HSN', 'Lines', 'Parties', 'Pcs', 'Mtrs', 'Amount'],
                rows.map((r) => [r.itemName, r.hsnCode, r.bills, r.partyCount, r.pcs, r.mts, r.amount])
              )
            }
          />
        );
      }

      case 'salesHaste': {
        const rows = filterByParty(data.salesHaste || [], partyName);
        return (
          <ReportTable
            columns={[
              { key: 'invoiceNo', label: 'Invoice', render: (r) => <span className="font-bold">{r.invoiceNo}</span> },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'partyName', label: 'Party' },
              { key: 'haste', label: 'Haste' },
              { key: 'transport', label: 'Transport' },
              { key: 'station', label: 'Station' },
              { key: 'lrNo', label: 'LR No' },
              { key: 'freight', label: 'Freight', align: 'right', render: (r) => fmtAmt(r.freight) },
              { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
            ]}
            rows={rows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No haste/transport data"
            onExport={() =>
              downloadCsv(
                'sales-haste-transport.csv',
                ['Invoice', 'Date', 'Party', 'Haste', 'Transport', 'Station', 'LR', 'Freight', 'Net'],
                rows.map((r) => [r.invoiceNo, fmtDate(r.date), r.partyName, r.haste, r.transport, r.station, r.lrNo, r.freight, r.netAmount])
              )
            }
          />
        );
      }

      case 'salesOrder':
        return orderTable(filterByParty(data.salesOrders || [], partyName), 'No sales orders');

      case 'purchaseOrder':
        return orderTable(filterByParty(data.purchaseOrders || [], partyName), 'No purchase orders');

      case 'salesChallan': {
        const rows = filterByParty(data.salesChallans || [], partyName);
        return (
          <ReportTable
            columns={[
              { key: 'challanNo', label: 'Challan', render: (r) => <span className="font-bold">{r.challanNo}</span> },
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'partyName', label: 'Party' },
              { key: 'transport', label: 'Transport' },
              { key: 'lrNo', label: 'LR No' },
              { key: 'status', label: 'Status' },
              { key: 'invoiceNo', label: 'Invoice' },
              { key: 'qty', label: 'Qty', align: 'right', render: (r) => fmtAmt(r.qty) },
              { key: 'amount', label: 'Amount', align: 'right', render: (r) => fmtAmt(r.amount) },
            ]}
            rows={rows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No delivery challans"
            onExport={() =>
              downloadCsv(
                'sales-challan.csv',
                ['Challan', 'Date', 'Party', 'Transport', 'LR', 'Status', 'Invoice', 'Qty', 'Amount'],
                rows.map((r) => [r.challanNo, fmtDate(r.date), r.partyName, r.transport, r.lrNo, r.status, r.invoiceNo, r.qty, r.amount])
              )
            }
          />
        );
      }

      case 'salesReturn':
        return returnTable(filterByParty(data.salesReturns || [], partyName), 'No sales returns');

      case 'purchaseReturn':
        return returnTable(filterByParty(data.purchaseReturns || [], partyName), 'No purchase returns');

      case 'tds': {
        const rows = filterByParty(data.tdsRegister || [], partyName);
        return (
          <ReportTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'docType', label: 'Type' },
              { key: 'docNo', label: 'Doc No' },
              { key: 'partyName', label: 'Party' },
              { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmtAmt(r.taxable) },
              { key: 'tdsAmount', label: 'TDS', align: 'right', render: (r) => fmtAmt(r.tdsAmount) },
              { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
            ]}
            rows={rows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No TDS entries in period"
            onExport={() =>
              downloadCsv(
                'tds-register.csv',
                ['Date', 'Type', 'Doc', 'Party', 'Taxable', 'TDS', 'Net'],
                rows.map((r) => [fmtDate(r.date), r.docType, r.docNo, r.partyName, r.taxable, r.tdsAmount, r.netAmount])
              )
            }
          />
        );
      }

      case 'tcs': {
        const rows = filterByParty(data.tcsRegister || [], partyName);
        return (
          <ReportTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
              { key: 'docType', label: 'Type' },
              { key: 'docNo', label: 'Doc No' },
              { key: 'partyName', label: 'Party' },
              { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => fmtAmt(r.taxable) },
              { key: 'tcsAmount', label: 'TCS', align: 'right', render: (r) => fmtAmt(r.tcsAmount) },
              { key: 'netAmount', label: 'Net', align: 'right', render: (r) => fmtAmt(r.netAmount) },
            ]}
            rows={rows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No TCS entries in period"
            onExport={() =>
              downloadCsv(
                'tcs-register.csv',
                ['Date', 'Type', 'Doc', 'Party', 'Taxable', 'TCS', 'Net'],
                rows.map((r) => [fmtDate(r.date), r.docType, r.docNo, r.partyName, r.taxable, r.tcsAmount, r.netAmount])
              )
            }
          />
        );
      }

      case 'balanceSheet': {
        const bs = data.balanceSheet || { rows: [] };
        return (
          <div className="max-w-2xl space-y-3">
            <p className="text-[11px] text-[var(--text-muted)]">
              Snapshot as on {bs.asOn || toDate} — stock + debtors / creditors (simplified books view).
            </p>
            <ReportTable
              columns={[
                { key: 'side', label: 'Side' },
                {
                  key: 'particular',
                  label: 'Particulars',
                  render: (r) => (
                    <span className={r.isTotal ? 'font-bold' : ''}>{r.particular}</span>
                  ),
                },
                {
                  key: 'amount',
                  label: 'Amount',
                  align: 'right',
                  render: (r) => (
                    <span className={r.isTotal ? 'font-bold' : ''}>₹ {fmtAmt(r.amount)}</span>
                  ),
                },
              ]}
              rows={(bs.rows || []).map((r, i) => ({ ...r, _key: i }))}
              emptyText="No balance sheet data"
              onExport={() =>
                downloadCsv(
                  'balance-sheet.csv',
                  ['Side', 'Particulars', 'Amount'],
                  (bs.rows || []).map((r) => [r.side, r.particular, r.amount])
                )
              }
            />
          </div>
        );
      }

      case 'pl': {
        const pl = data.profitLoss || {};
        return (
          <div className="max-w-lg erp-card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold">Profit & Loss</h3>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(`profit-loss.csv`, ['Particulars', 'Amount'], [
                    ['Sales (Taxable)', pl.revenue],
                    ['Sales GST', pl.salesGst],
                    ['Purchase (Taxable / COGS)', pl.cogs],
                    ['Gross Profit', pl.grossProfit],
                    ['Net Profit (approx)', pl.netProfit],
                  ])
                }
                className="erp-btn erp-btn-secondary h-7 px-3 text-[10px] gap-1"
              >
                <Download size={12} /> Export CSV
              </button>
            </div>
            <table className="w-full text-[11px] border-collapse">
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {[
                  ['Sales (Taxable)', pl.revenue],
                  ['Sales GST', pl.salesGst],
                  ['Sales Net', pl.salesNet],
                  ['Purchase (Taxable / COGS)', pl.cogs],
                  ['Purchase GST', pl.purchaseGst],
                  ['Purchase Net', pl.purchaseNet],
                  ['Gross Profit', pl.grossProfit],
                  ['Net Profit (approx)', pl.netProfit],
                ].map(([label, val]) => (
                  <tr key={label}>
                    <td className="py-1.5 align-middle leading-none font-medium">{label}</td>
                    <td className="py-1.5 align-middle leading-none text-right font-semibold tabular-nums whitespace-nowrap">₹ {fmtAmt(val)}</td>
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
              { key: 'debit', label: 'Debit', align: 'right', render: (r) => (r.debit ? fmtAmt(r.debit) : '—') },
              { key: 'credit', label: 'Credit', align: 'right', render: (r) => (r.credit ? fmtAmt(r.credit) : '—') },
            ]}
            rows={dailyRows.map((r, i) => ({ ...r, _key: i }))}
            emptyText="No transactions in period"
            onExport={() =>
              downloadCsv(
                'daily-transactions.csv',
                ['Date', 'Type', 'Doc No', 'Party', 'Debit', 'Credit'],
                dailyRows.map((r) => [fmtDate(r.date), r.type, r.docNo, r.party, r.debit || 0, r.credit || 0])
              )
            }
          />
        );

      case 'masters':
        return (
          <div className="space-y-4">
            <ReportTable
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type' },
                { key: 'group', label: 'Group' },
                { key: 'city', label: 'City' },
                { key: 'mobile', label: 'Mobile' },
              ]}
              rows={(data.masterSummary?.accounts || []).map((r, i) => ({ ...r, _key: `a${i}` }))}
              emptyText="No accounts"
              onExport={() =>
                downloadCsv(
                  'master-accounts.csv',
                  ['Name', 'Type', 'Group', 'City', 'Mobile'],
                  (data.masterSummary?.accounts || []).map((r) => [r.name, r.type, r.group, r.city, r.mobile])
                )
              }
              exportLabel="Export Accounts"
            />
          </div>
        );

      default:
        return (
          <div className="py-16 text-center text-[var(--text-muted)] text-sm">
            Report type “{reportKey}” is not wired yet.
          </div>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reports — JSM Hierarchy" className="max-w-[98vw] w-full h-[92vh] p-0">
      <div className="flex h-[calc(92vh-48px)] min-h-0">
        {/* Left tree */}
        <aside className="w-[260px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] flex flex-col min-h-0">
          <div className="p-2 border-b border-[var(--border)]">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={treeFilter}
                onChange={(e) => setTreeFilter(e.target.value)}
                placeholder="Search reports…"
                className="w-full h-8 pl-7 pr-2 text-[11px] border border-[var(--border)] rounded-md bg-[var(--bg-base)]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                selectedId={selectedLeafId}
                onToggle={toggleExpand}
                onSelect={selectLeaf}
              />
            ))}
          </div>
        </aside>

        {/* Right pane */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">{selectedLeaf?.label || 'Report'}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{pathLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handlePrint} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
                  <Printer size={12} /> Print
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold uppercase text-[var(--text-muted)]">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 px-2 text-xs border border-[var(--border-strong)] rounded-md"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold uppercase text-[var(--text-muted)]">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 px-2 text-xs border border-[var(--border-strong)] rounded-md"
                />
              </div>
              <div className="flex flex-col gap-0.5 min-w-[180px] flex-1 max-w-xs">
                <label className="text-[9px] font-bold uppercase text-[var(--text-muted)]">Party</label>
                <input
                  type="text"
                  list="report-party-list"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="All parties / type name…"
                  className="h-8 px-2 text-xs border border-[var(--border-strong)] rounded-md"
                />
                <datalist id="report-party-list">
                  {partyOptions.slice(0, 200).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !selectedLeaf}
                className="erp-btn erp-btn-primary h-8 px-4 text-[11px] gap-1 disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Generating…' : 'Generate Report'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 print:p-2">{renderReportBody()}</div>
        </div>
      </div>
    </Modal>
  );
};

export default ReportsHub;
