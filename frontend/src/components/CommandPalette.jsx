import React, { useEffect, useMemo, useRef, useState } from 'react';
import useUiStore from '../store/useUiStore';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';

/**
 * Enterprise Ctrl+K search — navigates by opening Dashboard modals via custom event.
 * Does not redesign chrome; overlays existing shell.
 */
export default function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const query = useUiStore((s) => s.globalSearchQuery);
  const setQuery = useUiStore((s) => s.setGlobalSearchQuery);
  const inputRef = useRef(null);

  const parties = useStore((s) => s.parties);
  const items = useStore((s) => s.items);
  const sales = useStore((s) => s.sales);
  const purchases = useStore((s) => s.purchases);
  const companyName = useConfigStore((s) => s.company?.name || s.companySettings?.legalName || 'Company');

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, setQuery]);

  const actions = useMemo(
    () => [
      { id: 'sales', label: 'Sales Billing', group: 'Modules', event: 'erp:open-modal', payload: 'sales' },
      { id: 'purchase', label: 'Purchase Bill', group: 'Modules', event: 'erp:open-modal', payload: 'purchase' },
      { id: 'receipt', label: 'Bank Receipt', group: 'Modules', event: 'erp:open-modal', payload: 'receipt' },
      { id: 'payment', label: 'Bank Payment', group: 'Modules', event: 'erp:open-modal', payload: 'payment' },
      { id: 'inventory', label: 'Stock Ledger', group: 'Modules', event: 'erp:open-modal', payload: 'inventoryPage' },
      { id: 'outstanding', label: 'Outstanding', group: 'Reports', event: 'erp:open-modal', payload: 'outstanding' },
      { id: 'gstr1', label: 'GSTR-1', group: 'GST', event: 'erp:open-modal', payload: 'gstr1' },
      { id: 'ca', label: 'CA Desk', group: 'GST', event: 'erp:open-modal', payload: 'caDashboard' },
      { id: 'ledger', label: 'Ledger Statement', group: 'Accounting', event: 'erp:open-modal', payload: 'ledger' },
      { id: 'party', label: 'Account Master', group: 'Masters', event: 'erp:open-modal', payload: 'accountMaster' },
      { id: 'item', label: 'Item Master', group: 'Masters', event: 'erp:open-modal', payload: 'itemMaster' },
      { id: 'reports', label: 'Reports Hub', group: 'Reports', event: 'erp:open-modal', payload: 'reportsHub' },
    ],
    []
  );

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    const rows = [];
    actions.forEach((a) => {
      if (!q || a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q)) {
        rows.push({ ...a, kind: 'action' });
      }
    });
    if (q.length >= 1) {
      parties.slice(0, 80).forEach((p) => {
        const name = p.name || '';
        if (name.toLowerCase().includes(q)) {
          rows.push({
            id: `party-${p._id || p.id}`,
            label: name,
            group: 'Parties',
            kind: 'party',
            event: 'erp:open-modal',
            payload: 'accountMaster',
          });
        }
      });
      items.slice(0, 80).forEach((it) => {
        const name = it.name || '';
        if (name.toLowerCase().includes(q)) {
          rows.push({
            id: `item-${it._id || it.id}`,
            label: name,
            group: 'Items',
            kind: 'item',
            event: 'erp:open-modal',
            payload: 'itemMaster',
          });
        }
      });
      sales.slice(0, 40).forEach((s) => {
        const no = String(s.invoiceNo || '');
        if (no.toLowerCase().includes(q)) {
          rows.push({
            id: `sale-${s._id || s.id}`,
            label: `Sale ${no}`,
            group: 'Sales',
            kind: 'sale',
            event: 'erp:open-modal',
            payload: 'sales',
          });
        }
      });
      purchases.slice(0, 40).forEach((p) => {
        const no = String(p.invoiceNo || p.billNo || '');
        if (no.toLowerCase().includes(q)) {
          rows.push({
            id: `pur-${p._id || p.id}`,
            label: `Purchase ${no}`,
            group: 'Purchases',
            kind: 'purchase',
            event: 'erp:open-modal',
            payload: 'purchase',
          });
        }
      });
    }
    return rows.slice(0, 40);
  }, [actions, q, parties, items, sales, purchases]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const run = (row) => {
    if (!row) return;
    window.dispatchEvent(new CustomEvent(row.event, { detail: { modal: row.payload, row } }));
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    }
  };

  return (
    <div className="fixed inset-0 z-[99998] flex items-start justify-center pt-[12vh] bg-black/40" onClick={close}>
      <div
        className="w-[min(640px,92vw)] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command search"
      >
        <div className="px-4 py-3 border-b border-slate-100">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Search ${companyName} — parties, items, invoices, modules…`}
            className="w-full text-[13px] font-medium outline-none bg-transparent"
          />
          <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider">Ctrl+K · Esc to close</p>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-4 py-6 text-[12px] text-slate-500 text-center">No matches</li>
          )}
          {results.map((row, idx) => (
            <li key={row.id}>
              <button
                type="button"
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-[12px] ${
                  idx === active ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-800'
                }`}
                onMouseEnter={() => setActive(idx)}
                onClick={() => run(row)}
              >
                <span className="font-semibold truncate">{row.label}</span>
                <span className={`text-[10px] uppercase tracking-wide shrink-0 ${idx === active ? 'text-slate-300' : 'text-slate-400'}`}>
                  {row.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
