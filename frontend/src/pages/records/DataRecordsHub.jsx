import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { useConfig } from '../../context/ConfigContext';
import { applyColumnConfig, isFlagEnabled } from '../../utils/configHelpers';
import { formatPaymentSplits } from '../../utils/paymentFormat';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faBox, faWarehouse, faFileInvoiceDollar, faCartFlatbed,
  faTruckArrowRight, faMoneyCheckDollar, faHandHoldingDollar, faClipboardList,
  faRotateLeft, faNoteSticky, faHandshake, faBook, faSync, faSearch, faPrint
} from '@fortawesome/free-solid-svg-icons';
import SalesPrint from '../sales/SalesPrint';
import PurchasePrint from '../purchase/PurchasePrint';
import { EmptyStateSVG } from '../../components/ui/Illustrations';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');
const fmtAmt = (n) => `₹ ${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const resolveName = (ref, parties = []) => {
  if (!ref) return '—';
  if (typeof ref === 'object') return ref.name || ref.itemName || '—';
  const found = parties.find(p => p._id === ref || p.id === ref);
  return found?.name || '—';
};

const RECORD_SECTIONS = [
  { id: 'accounts', label: 'Accounts', group: 'Master', icon: faUsers },
  { id: 'items', label: 'Items', group: 'Master', icon: faBox },
  { id: 'books', label: 'Books', group: 'Master', icon: faBook },
  { id: 'inventory', label: 'Inventory Stock', group: 'Inventory', icon: faWarehouse },
  { id: 'sales', label: 'Sales Invoices', group: 'Transaction', icon: faFileInvoiceDollar },
  { id: 'purchases', label: 'Purchase Bills', group: 'Transaction', icon: faCartFlatbed },
  { id: 'millIssue', label: 'Mill Issue', group: 'Transaction', icon: faTruckArrowRight },
  { id: 'receipts', label: 'Bank Receipts', group: 'Transaction', icon: faMoneyCheckDollar },
  { id: 'payments', label: 'Bank Payments', group: 'Transaction', icon: faHandHoldingDollar },
  { id: 'salesOrders', label: 'Sales Orders', group: 'Transaction', icon: faClipboardList },
  { id: 'purchaseOrders', label: 'Purchase Orders', group: 'Transaction', icon: faClipboardList },
  { id: 'salesReturns', label: 'Sales Returns', group: 'Transaction', icon: faRotateLeft },
  { id: 'purchaseReturns', label: 'Purchase Returns', group: 'Transaction', icon: faRotateLeft },
  { id: 'notes', label: 'Debit/Credit Notes', group: 'Transaction', icon: faNoteSticky },
  { id: 'visits', label: 'Visit Logs', group: 'Transaction', icon: faHandshake },
];

const GROUPS = ['Master', 'Inventory', 'Transaction'];

const StatusBadge = ({ status }) => {
  const s = (status || 'active').toLowerCase();
  const cls = s.includes('cancel') || s === 'closed'
    ? 'bg-red-50 text-red-700 border-red-100'
    : s.includes('received') || s.includes('completed') || s === 'paid'
      ? 'bg-green-50 text-green-700 border-green-100'
      : s.includes('partial') || s.includes('pending') || s.includes('issued')
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-slate-50 text-slate-600 border-slate-100';
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${cls}`}>
      {status || 'Active'}
    </span>
  );
};

const RecordsTable = ({ columns, rows, emptyText }) => (
  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
    <div className="overflow-x-auto max-h-[calc(90vh-220px)] overflow-y-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase tracking-widest text-[9px] border-b border-[var(--border)] sticky top-0 z-10">
          <tr>
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 font-semibold ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-[var(--text-muted)] animate-fade-in-up">
                <div className="flex flex-col items-center justify-center gap-4">
                  <EmptyStateSVG />
                  <span className="font-medium text-[14px]">{emptyText}</span>
                </div>
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={row._key || i} className="hover:bg-[var(--bg-base)] transition-colors">
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-3 text-[11px] ${col.align === 'right' ? 'text-right font-semibold' : col.align === 'center' ? 'text-center' : ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const DataRecordsHub = ({ isOpen, onClose, initialTab = 'accounts' }) => {
  const store = useStore();
  const { bundle } = useConfig();
  const {
    parties, items, inventoryLots, sales, purchases, jobWorkEntries,
    orders, returns, notes, visits, vouchers, books,
    fetchParties, fetchItems, fetchInventory, fetchSales, fetchPurchases,
    fetchJobs, fetchOrders, fetchReturns, fetchNotes, fetchVisits, fetchVouchers, fetchBooks,
    refreshAllData, loading
  } = store;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [printSalesId, setPrintSalesId] = useState(null);
  const [printPurchaseId, setPrintPurchaseId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearch('');
      refreshAllData();
    }
  }, [isOpen, initialTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  }, [refreshAllData]);

  const counts = useMemo(() => ({
    accounts: parties.length,
    items: items.length,
    books: books.length,
    inventory: inventoryLots.length,
    sales: sales.length,
    purchases: purchases.length,
    millIssue: jobWorkEntries.length,
    receipts: vouchers.filter(v => v.voucherType === 'Receipt').length,
    payments: vouchers.filter(v => v.voucherType === 'Payment').length,
    salesOrders: orders.filter(o => o.orderType === 'Sales').length,
    purchaseOrders: orders.filter(o => o.orderType === 'Purchase').length,
    salesReturns: returns.filter(r => r.returnType === 'Sales').length,
    purchaseReturns: returns.filter(r => r.returnType === 'Purchase').length,
    notes: notes.length,
    visits: visits.length,
  }), [parties, items, books, inventoryLots, sales, purchases, jobWorkEntries, vouchers, orders, returns, notes, visits]);

  const filterText = (text) => !search || String(text || '').toLowerCase().includes(search.toLowerCase());

  const baseTableConfig = useMemo(() => {
    switch (activeTab) {
      case 'accounts':
        return {
          title: 'Account List',
          subtitle: `${counts.accounts} accounts saved`,
          columns: [
            { key: 'name', label: 'Name', render: r => <span className="font-semibold">{r.name}</span> },
            { key: 'type', label: 'Type' },
            { key: 'group', label: 'Group' },
            { key: 'station', label: 'City' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'gstin', label: 'GSTIN' },
          ],
          rows: parties.filter(p =>
            filterText(p.name) || filterText(p.type) || filterText(p.group) || filterText(p.mobile)
          ).map(p => ({ ...p, _key: p._id })),
          emptyText: 'No accounts found. Add accounts from Master → Account.',
        };

      case 'items':
        return {
          title: 'Item List',
          subtitle: `${counts.items} items in master`,
          columns: [
            { key: 'itemName', label: 'Item Name', render: r => <span className="font-semibold uppercase">{r.itemName || r.name}</span> },
            { key: 'group', label: 'Group' },
            { key: 'unit', label: 'Unit' },
            { key: 'hsnCode', label: 'HSN' },
            { key: 'taxRate', label: 'Tax %', align: 'right' },
            { key: 'salesRate', label: 'Sale Rate', align: 'right', render: r => fmtAmt(r.salesRate) },
            { key: 'purRate', label: 'Pur Rate', align: 'right', render: r => fmtAmt(r.purRate || r.purchaseRate) },
          ],
          rows: items.filter(i =>
            filterText(i.itemName || i.name) || filterText(i.group) || filterText(i.hsnCode)
          ).map(i => ({ ...i, _key: i._id })),
          emptyText: 'No items found. Add items from Master → Item.',
        };

      case 'books':
        return {
          title: 'Book Master List',
          subtitle: `${counts.books} books configured`,
          columns: [
            { key: 'name', label: 'Book Name', render: r => <span className="font-semibold">{r.name}</span> },
            { key: 'module', label: 'Module' },
            { key: 'prefix', label: 'Prefix' },
            { key: 'financialYear', label: 'FY' },
            { key: 'isDefault', label: 'Default', align: 'center', render: r => r.isDefault ? 'Yes' : '—' },
          ],
          rows: books.filter(b => filterText(b.name) || filterText(b.module)).map(b => ({ ...b, _key: b._id })),
          emptyText: 'No books found. Add from Master → Book Master.',
        };

      case 'inventory': {
        const totalMtrs = inventoryLots.reduce((a, l) => a + (l.remainingMtrs || 0), 0);
        return {
          title: 'Inventory Stock',
          subtitle: `${counts.inventory} lots • ${totalMtrs.toFixed(1)} MTRS total remaining`,
          columns: [
            { key: 'lotId', label: 'Lot ID', render: r => <span className="font-bold">{r.lotId}</span> },
            { key: 'item', label: 'Item', render: r => (r.itemId?.name || r.itemName || '—').toUpperCase() },
            { key: 'remainingPcs', label: 'Pcs', align: 'right' },
            { key: 'remainingMtrs', label: 'Meters', align: 'right', render: r => `${(r.remainingMtrs || 0).toFixed(2)}` },
            { key: 'rate', label: 'Rate', align: 'right', render: r => fmtAmt(r.rate) },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
          ],
          rows: inventoryLots.filter(l =>
            filterText(l.lotId) || filterText(l.itemId?.name || l.itemName) || filterText(l.status)
          ).map(l => ({ ...l, _key: l._id })),
          emptyText: 'No inventory lots. Stock is created via Purchase or Opening Stock.',
        };
      }

      case 'sales': {
        const getSalePayments = (saleId) => {
          const modes = [];
          vouchers
            .filter(v => v.voucherType === 'Receipt' && v.status === 'Posted')
            .forEach(v => {
              const match = (v.againstInvoices || []).find(i => String(i.invoiceId) === String(saleId));
              if (match) modes.push(formatPaymentSplits(v));
            });
          return modes.length ? modes.join(' | ') : '—';
        };
        return {
          title: 'Sales Invoice List',
          subtitle: `${counts.sales} invoices`,
          columns: [
            { key: 'invoiceNo', label: 'Invoice No', render: r => <span className="font-bold uppercase">{r.invoiceNo}</span> },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Customer', render: r => resolveName(r.customerId || r.partyId, parties) },
            { key: 'total', label: 'Total', align: 'right', render: r => fmtAmt(r.netAmount || r.totals?.total) },
            { key: 'paid', label: 'Received', align: 'right', render: r => fmtAmt(r.paidAmount || 0) },
            { key: 'payment', label: 'Payment Mode', render: r => <span className="text-[10px] font-medium">{getSalePayments(r._id)}</span> },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
            { key: 'actions', label: '', align: 'center', render: r => (
                <button type="button" onClick={() => setPrintSalesId(r._id || r.id)} className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1" title="PDF / Print Invoice">
                  <FontAwesomeIcon icon={faPrint} />
                </button>
            ) },
          ],
          rows: sales.filter(s =>
            filterText(s.invoiceNo) || filterText(resolveName(s.customerId || s.partyId, parties))
          ).map(s => ({ ...s, _key: s._id })),
          emptyText: 'No sales invoices. Create from Transaction → Sales Billing.',
        };
      }

      case 'purchases': {
        const getPurchasePayments = (purchaseId) => {
          const modes = [];
          vouchers
            .filter(v => v.voucherType === 'Payment' && v.status === 'Posted')
            .forEach(v => {
              const match = (v.againstInvoices || []).find(i => String(i.invoiceId) === String(purchaseId));
              if (match) modes.push(formatPaymentSplits(v));
            });
          return modes.length ? modes.join(' | ') : '—';
        };
        return {
          title: 'Purchase Bill List',
          subtitle: `${counts.purchases} bills`,
          columns: [
            { key: 'billNo', label: 'Bill No', render: r => <span className="font-bold uppercase">{r.billNo || r.invoiceNo}</span> },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Supplier', render: r => resolveName(r.supplierId || r.partyId, parties) },
            { key: 'total', label: 'Total', align: 'right', render: r => fmtAmt(r.netAmount || r.totals?.total) },
            { key: 'paid', label: 'Paid', align: 'right', render: r => fmtAmt(r.paidAmount || 0) },
            { key: 'payment', label: 'Payment Mode', render: r => <span className="text-[10px] font-medium">{getPurchasePayments(r._id)}</span> },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
            { key: 'actions', label: '', align: 'center', render: r => (
                <button type="button" onClick={() => setPrintPurchaseId(r._id || r.id)} className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1" title="PDF / Print Bill">
                  <FontAwesomeIcon icon={faPrint} />
                </button>
            ) },
          ],
          rows: purchases.filter(p =>
            filterText(p.billNo || p.invoiceNo) || filterText(resolveName(p.supplierId || p.partyId, parties))
          ).map(p => ({ ...p, _key: p._id })),
          emptyText: 'No purchase bills. Create from Transaction → Purchase.',
        };
      }

      case 'millIssue':
        return {
          title: 'Mill Issue List',
          subtitle: `${counts.millIssue} job cards`,
          columns: [
            { key: 'date', label: 'Issue Date', render: r => fmtDate(r.issueDate) },
            { key: 'jobCardNo', label: 'Job Card', render: r => <span className="font-bold uppercase">{r.jobCardNo}</span> },
            { key: 'worker', label: 'Mill / Worker', render: r => resolveName(r.workerId, parties) },
            { key: 'process', label: 'Process' },
            { key: 'issueQty', label: 'Issued Qty', align: 'right', render: r => `${r.issueQty || 0} Mtrs` },
            { key: 'receivedQty', label: 'Received', align: 'right', render: r => `${r.receivedQty || 0} Mtrs` },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
          ],
          rows: jobWorkEntries.filter(j =>
            filterText(j.jobCardNo) || filterText(resolveName(j.workerId, parties)) || filterText(j.processType)
          ).map(j => ({ ...j, _key: j._id, process: j.processType })),
          emptyText: 'No mill issues. Create from Transaction → Mill Issue.',
        };

      case 'receipts':
        return {
          title: 'Bank Receipt List',
          subtitle: `${counts.receipts} receipts`,
          columns: [
            { key: 'voucherNo', label: 'Voucher No', render: r => <span className="font-bold">{r.voucherNo}</span> },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Party', render: r => r.partyName || '—' },
            { key: 'amount', label: 'Amount', align: 'right', render: r => fmtAmt(r.amount) },
            { key: 'mode', label: 'Payment Breakdown', render: r => <span className="font-medium">{formatPaymentSplits(r)}</span> },
            { key: 'invoices', label: 'Against', render: r => (r.againstInvoices || []).map(i => i.invoiceNo).join(', ') || '—' },
            { key: 'narration', label: 'Narration', render: r => <span className="text-[var(--text-muted)] truncate max-w-[180px] block">{r.narration || '—'}</span> },
          ],
          rows: vouchers.filter(v => v.voucherType === 'Receipt').filter(v =>
            filterText(v.voucherNo) || filterText(v.partyName) || filterText(formatPaymentSplits(v))
          ).map(v => ({ ...v, _key: v._id })),
          emptyText: 'No bank receipts. Create from Transaction → Bank Receipt.',
        };

      case 'payments':
        return {
          title: 'Bank Payment List',
          subtitle: `${counts.payments} payments`,
          columns: [
            { key: 'voucherNo', label: 'Voucher No', render: r => <span className="font-bold">{r.voucherNo}</span> },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Party', render: r => r.partyName || '—' },
            { key: 'amount', label: 'Amount', align: 'right', render: r => fmtAmt(r.amount) },
            { key: 'mode', label: 'Payment Breakdown', render: r => <span className="font-medium">{formatPaymentSplits(r)}</span> },
            { key: 'invoices', label: 'Against', render: r => (r.againstInvoices || []).map(i => i.invoiceNo).join(', ') || '—' },
            { key: 'narration', label: 'Narration', render: r => <span className="text-[var(--text-muted)] truncate max-w-[180px] block">{r.narration || '—'}</span> },
          ],
          rows: vouchers.filter(v => v.voucherType === 'Payment').filter(v =>
            filterText(v.voucherNo) || filterText(v.partyName) || filterText(formatPaymentSplits(v))
          ).map(v => ({ ...v, _key: v._id })),
          emptyText: 'No bank payments. Create from Transaction → Bank Payment.',
        };

      case 'salesOrders':
        return {
          title: 'Sales Order List',
          subtitle: `${counts.salesOrders} orders`,
          columns: [
            { key: 'orderNo', label: 'Order No', render: r => <span className="font-bold">{r.orderNo}</span> },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Customer', render: r => resolveName(r.partyId, parties) },
            { key: 'items', label: 'Items', align: 'right', render: r => (r.items?.length || 0) },
            { key: 'total', label: 'Total', align: 'right', render: r => fmtAmt(r.totalAmount || r.netAmount) },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
          ],
          rows: orders.filter(o => o.orderType === 'Sales').filter(o =>
            filterText(o.orderNo) || filterText(resolveName(o.partyId, parties))
          ).map(o => ({ ...o, _key: o._id })),
          emptyText: 'No sales orders. Create from Transaction → Sales Order.',
        };

      case 'purchaseOrders':
        return {
          title: 'Purchase Order List',
          subtitle: `${counts.purchaseOrders} orders`,
          columns: [
            { key: 'orderNo', label: 'Order No', render: r => <span className="font-bold">{r.orderNo}</span> },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Supplier', render: r => resolveName(r.partyId, parties) },
            { key: 'items', label: 'Items', align: 'right', render: r => (r.items?.length || 0) },
            { key: 'total', label: 'Total', align: 'right', render: r => fmtAmt(r.totalAmount || r.netAmount) },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
          ],
          rows: orders.filter(o => o.orderType === 'Purchase').filter(o =>
            filterText(o.orderNo) || filterText(resolveName(o.partyId, parties))
          ).map(o => ({ ...o, _key: o._id })),
          emptyText: 'No purchase orders. Create from Transaction → Purchase Order.',
        };

      case 'salesReturns':
        return {
          title: 'Sales Return List',
          subtitle: `${counts.salesReturns} returns`,
          columns: [
            { key: 'invoiceNo', label: 'Return No', render: r => <span className="font-bold">{r.invoiceNo}</span> },
            { key: 'original', label: 'Original Inv.' },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Customer', render: r => resolveName(r.partyId, parties) },
            { key: 'total', label: 'Amount', align: 'right', render: r => fmtAmt(r.totalAmount || r.netAmount) },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
          ],
          rows: returns.filter(r => r.returnType === 'Sales').filter(r =>
            filterText(r.invoiceNo) || filterText(resolveName(r.partyId, parties))
          ).map(r => ({ ...r, _key: r._id, original: r.originalInvoiceNo || '—' })),
          emptyText: 'No sales returns. Create from Transaction → Sales Return.',
        };

      case 'purchaseReturns':
        return {
          title: 'Purchase Return List',
          subtitle: `${counts.purchaseReturns} returns`,
          columns: [
            { key: 'invoiceNo', label: 'Return No', render: r => <span className="font-bold">{r.invoiceNo}</span> },
            { key: 'original', label: 'Original Bill' },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Supplier', render: r => resolveName(r.partyId, parties) },
            { key: 'total', label: 'Amount', align: 'right', render: r => fmtAmt(r.totalAmount || r.netAmount) },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
          ],
          rows: returns.filter(r => r.returnType === 'Purchase').filter(r =>
            filterText(r.invoiceNo) || filterText(resolveName(r.partyId, parties))
          ).map(r => ({ ...r, _key: r._id, original: r.originalInvoiceNo || '—' })),
          emptyText: 'No purchase returns. Create from Transaction → Purchase Return.',
        };

      case 'notes':
        return {
          title: 'Debit / Credit Note List',
          subtitle: `${counts.notes} notes`,
          columns: [
            { key: 'noteNo', label: 'Note No', render: r => <span className="font-bold">{r.noteNo || r.invoiceNo}</span> },
            { key: 'noteType', label: 'Type' },
            { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
            { key: 'party', label: 'Party', render: r => resolveName(r.partyId, parties) },
            { key: 'amount', label: 'Amount', align: 'right', render: r => fmtAmt(r.amount || r.totalAmount) },
            { key: 'reason', label: 'Reason', render: r => <span className="text-[var(--text-muted)]">{r.reason || '—'}</span> },
          ],
          rows: notes.filter(n =>
            filterText(n.noteNo || n.invoiceNo) || filterText(n.noteType) || filterText(resolveName(n.partyId, parties))
          ).map(n => ({ ...n, _key: n._id })),
          emptyText: 'No debit/credit notes. Create from Transaction → Debit/Credit Note.',
        };

      case 'visits':
        return {
          title: 'Visit Log List',
          subtitle: `${counts.visits} visits logged`,
          columns: [
            { key: 'date', label: 'Visit Date', render: r => fmtDate(r.visitDate) },
            { key: 'party', label: 'Party', render: r => resolveName(r.partyId, parties) },
            { key: 'purpose', label: 'Purpose' },
            { key: 'discussion', label: 'Discussion', render: r => <span className="text-[var(--text-muted)] max-w-[200px] truncate block">{r.discussion}</span> },
            { key: 'outcome', label: 'Outcome', render: r => r.outcome || '—' },
            { key: 'status', label: 'Status', align: 'center', render: r => <StatusBadge status={r.status} /> },
          ],
          rows: visits.filter(v =>
            filterText(resolveName(v.partyId, parties)) || filterText(v.purpose) || filterText(v.discussion)
          ).map(v => ({ ...v, _key: v._id })),
          emptyText: 'No visit logs. Create from Core → Visit Log.',
        };

      default:
        return { title: 'Records', subtitle: '', columns: [], rows: [], emptyText: 'Select a category' };
    }
  }, [activeTab, parties, items, books, inventoryLots, sales, purchases, jobWorkEntries, vouchers, orders, returns, notes, visits, counts, search]);

  const tableConfig = useMemo(() => {
    const columnKeyMap = {
      sales: 'records.sales',
      purchases: 'records.purchases',
      inventory: 'records.inventory'
    };
    const tableKey = columnKeyMap[activeTab];
    if (!tableKey || !baseTableConfig.columns?.length) return baseTableConfig;
    return {
      ...baseTableConfig,
      columns: applyColumnConfig(bundle, tableKey, baseTableConfig.columns)
    };
  }, [baseTableConfig, activeTab, bundle]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Records — View All Saved Data"
      className="max-w-[96vw] w-full h-[92vh] p-0"
    >
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: 'calc(92vh - 48px)' }}>
        {/* Left navigation */}
        <nav className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-base)] overflow-y-auto no-scrollbar">
          {GROUPS.map(group => {
            const items = RECORD_SECTIONS.filter(s => s.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="py-2">
                <p className="px-4 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{group}</p>
                {items.map(section => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => { setActiveTab(section.id); setSearch(''); }}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-[12px] transition-colors border-l-2 ${
                      activeTab === section.id
                        ? 'border-[var(--accent)] bg-[var(--blue-bg)] text-[var(--accent)] font-medium'
                        : 'border-transparent text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FontAwesomeIcon icon={section.icon} className="text-[10px] w-3 shrink-0" />
                      {section.label}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">{counts[section.id] ?? 0}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="shrink-0 px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4 bg-white">
            <div>
              <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">{tableConfig.title}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{tableConfig.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-8 pr-3 h-8 w-48 rounded-lg border border-[var(--border)] text-[12px] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] flex items-center gap-1.5"
              >
                <FontAwesomeIcon icon={faSync} className={`text-[10px] ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-5 animate-fade-in-up">
            <RecordsTable
              columns={tableConfig.columns}
              rows={tableConfig.rows}
              emptyText={tableConfig.emptyText}
            />
          </div>
        </div>
      </div>
      {printSalesId && <SalesPrint invoiceId={printSalesId} onClose={() => setPrintSalesId(null)} />}
      {printPurchaseId && <PurchasePrint invoiceId={printPurchaseId} onClose={() => setPrintPurchaseId(null)} />}
    </Modal>
  );
};

export { RECORD_SECTIONS };
export default DataRecordsHub;
