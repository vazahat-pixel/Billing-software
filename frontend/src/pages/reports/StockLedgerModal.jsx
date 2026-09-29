import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import { reportApi } from '../../api/report.api';
import useConfigStore from '../../store/useConfigStore';
import { toast } from '../../store/useToastStore';
import { exportTableToExcel } from '../../utils/reportExport';

const todayISO = () => new Date().toISOString().split('T')[0];
const dmy = (iso) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
};
const num = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KINDS = {
  stockMts: { title: 'Stock Meter Report', head: 'Monthwise Stock Mts Report', basis: 'mts', mode: 'movement' },
  stockKgs: { title: 'Stock Kgs Report', head: 'Monthwise Stock Kgs Report', basis: 'kgs', mode: 'movement' },
  finishShop: { title: 'Finish At Shop Stock', head: 'Finish At Shop Stock', basis: 'mts', mode: 'shop', category: 'finish' },
  greyShop: { title: 'Grey At Shop Stock', head: 'Grey At Shop Stock', basis: 'mts', mode: 'shop', category: 'grey' },
  greyShopPcs: { title: 'Grey At Shop Stock (Pcs)', head: 'Grey At Shop Stock (Pcs)', basis: 'pcs', mode: 'shop', category: 'grey' },
  greyMill: { title: 'Grey At Mill Stock - Format 2', head: 'Grey At Mill Stock', basis: 'mts', mode: 'mill' },
  finishExcel: { title: 'Finish Stock Excel', head: 'Finish Stock', basis: 'mts', mode: 'shop', category: 'finish' },
  finishBook: { title: 'Finish At Shop Stock(Book-Acc)', head: 'Finish At Shop Stock (Book)', basis: 'mts', mode: 'shop', category: 'finish', money: true },
  stockValue: { title: 'Stock Value Reports', head: 'Stock Value Report', basis: 'mts', mode: 'shop', money: true },
};

const SCOPES = [
  ['all', '1-All'],
  ['grey', '2-Grey Stock'],
  ['mill', '3-Grey In Mill'],
  ['finish', '4-Finish Stock'],
  ['job', '5-Job Stock'],
  ['ni', '6-NI'],
];

function companyLine(company) {
  const meta = company?.meta || {};
  const raw = meta.address;
  const parts = [];
  if (typeof raw === 'string' && raw.trim()) parts.push(raw.trim());
  else if (raw && typeof raw === 'object') parts.push([raw.line1, raw.line2, raw.street].filter(Boolean).join(', '));
  [meta.city, meta.state, meta.pincode].forEach((part) => { if (part) parts.push(part); });
  return parts.filter(Boolean).join(', ');
}

const StockLedgerModal = ({ isOpen, onClose, kind = 'stockMts' }) => {
  const spec = KINDS[kind] || KINDS.stockMts;
  const company = useConfigStore((s) => s.company);
  const [stage, setStage] = useState('filter');
  const [asOn, setAsOn] = useState(todayISO());
  const [foldWise, setFoldWise] = useState(true);
  const [withJobWork, setWithJobWork] = useState(true);
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const qtyLabel = spec.basis === 'kgs' ? 'Kgs' : spec.basis === 'pcs' ? 'Pcs' : 'Mts';

  const rowsFor = (payload) => {
    const shop = (payload?.shopRows || []).filter((row) => !spec.category || row.category === spec.category);
    return spec.mode === 'mill' ? (payload?.millRows || []) : shop;
  };

  const exportPayload = (payload) => {
    if (spec.mode === 'movement') {
      const rows = [];
      (payload?.sections || []).forEach((section) => {
        section.rows.forEach((row) => rows.push({ section: section.title, particular: row.label, qty: row.qty }));
      });
      exportTableToExcel(spec.head, [
        { key: 'section', label: 'Section' },
        { key: 'particular', label: 'Particular' },
        { key: 'qty', label: qtyLabel },
      ], rows);
      return;
    }
    exportTableToExcel(spec.head, [
      { key: 'itemName', label: 'Item' },
      { key: 'lotNo', label: spec.mode === 'mill' ? 'Challan' : 'Lot' },
      { key: 'pcs', label: 'Pcs' },
      { key: 'qty', label: qtyLabel },
      { key: 'issued', label: 'Issued' },
      { key: 'received', label: 'Received' },
      { key: 'rate', label: 'Rate' },
      { key: 'value', label: 'Value' },
      { key: 'place', label: 'Place' },
    ], rowsFor(payload));
  };

  const load = async (after) => {
    setLoading(true);
    try {
      const res = await reportApi.stockLedger({
        asOn,
        basis: spec.basis,
        foldWise: foldWise ? '1' : '0',
        withJobWork: withJobWork ? '1' : '0',
        scope: spec.mode === 'movement' ? scope : 'all',
      });
      setData(res);
      setStage('screen');
      if (after === 'print') setTimeout(() => window.print(), 250);
      if (after === 'excel') exportPayload(res);
    } catch (err) {
      toast.error(err?.message || 'Stock report failed');
    } finally {
      setLoading(false);
    }
  };

  const listRows = rowsFor(data);

  const onFilterKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      load();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={stage === 'screen' ? () => setStage('filter') : onClose}
      title={stage === 'filter' ? spec.title : spec.head}
      className="max-w-4xl w-[920px]"
    >
      {stage === 'filter' ? (
        <div className="bg-[#d9e6f2] text-[13px] text-slate-900" onKeyDown={onFilterKey}>
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[#b7c9dc]">
            <label className="flex items-center gap-3 font-bold">
              As on Date
              <input
                type="date"
                value={asOn}
                onChange={(e) => setAsOn(e.target.value)}
                className="h-7 px-2 bg-[#ffe7c2] border border-slate-500"
              />
            </label>
            {spec.mode === 'movement' && spec.basis !== 'pcs' && (
              <label className="flex items-center gap-2 font-bold text-white bg-[#1d4ed8] px-2 py-1">
                <input type="checkbox" checked={foldWise} onChange={(e) => setFoldWise(e.target.checked)} />
                Fold.Mts Wise
              </label>
            )}
          </div>
          {spec.mode === 'movement' && (
            <div className="px-4 py-3 border-b border-[#b7c9dc]">
              <div className="font-bold mb-2">A</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {SCOPES.map(([id, label]) => (
                  <label key={id} className="inline-flex items-center gap-1 font-semibold">
                    <input type="radio" name="stock-scope" checked={scope === id} onChange={() => setScope(id)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="min-h-[88px] flex items-end justify-end px-4 py-3">
            {spec.mode === 'movement' && (
              <label className="flex items-center gap-2 font-bold text-white bg-[#1d4ed8] px-2 py-1">
                <input type="checkbox" checked={withJobWork} onChange={(e) => setWithJobWork(e.target.checked)} />
                With JobWork
              </label>
            )}
          </div>
          <div className="flex justify-center gap-3 bg-[#1d4ed8] py-3">
            <button type="button" className="classic-erp-btn min-w-[88px]" onClick={() => load('screen')} disabled={loading}>{loading ? 'Wait' : 'Screen'}</button>
            <button type="button" className="classic-erp-btn min-w-[88px]" onClick={() => load('print')} disabled={loading}>Print</button>
            <button type="button" className="classic-erp-btn min-w-[88px]" onClick={() => load('excel')} disabled={loading}>Excel</button>
            <button type="button" className="classic-erp-btn min-w-[88px]" onClick={onClose}>Exit</button>
          </div>
        </div>
      ) : (
        <div className="bg-white text-slate-900">
          <div className="stock-ledger-sheet px-8 py-4 font-mono text-[12px] leading-5">
            <div className="text-center font-bold text-[15px] font-sans">{company?.name || company?.companyName || 'Company'}</div>
            {companyLine(company) && <div className="text-center text-[11px] font-sans">{companyLine(company)}</div>}
            <div className="flex justify-between mt-2 font-sans text-[12px]">
              <span>Report : {spec.head}</span>
              <span>Stock As on Date : {dmy(data?.asOn || asOn)}</span>
            </div>
            {spec.mode === 'movement' ? (
              <div className="mt-3">
                {(data?.sections || []).map((section) => (
                  <div key={section.title} className="mb-3">
                    <div className="font-bold">{section.title} →</div>
                    {section.rows.map((row) => (
                      <div key={row.label} className={`flex ${row.strong ? 'font-bold' : ''}`}>
                        <span className="w-44 pl-6">{row.label}</span>
                        <span className="px-2">:</span>
                        <span className="w-28 text-right">{num(row.qty)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full mt-3 border-collapse font-sans text-[12px]">
                <thead>
                  <tr className="border-b border-slate-400 text-left">
                    <th className="py-1">Item</th>
                    <th>{spec.mode === 'mill' ? 'Challan' : 'Lot'}</th>
                    <th className="text-right">Pcs</th>
                    {spec.mode === 'mill' && <th className="text-right">Issued</th>}
                    {spec.mode === 'mill' && <th className="text-right">Received</th>}
                    <th className="text-right">{spec.mode === 'mill' ? 'Pending' : qtyLabel}</th>
                    {(spec.money || spec.mode === 'shop') && spec.basis !== 'pcs' && <th className="text-right">Rate</th>}
                    {spec.money && <th className="text-right">Value</th>}
                  </tr>
                </thead>
                <tbody>
                  {listRows.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-500">No stock on this date.</td></tr>
                  )}
                  {listRows.map((row, idx) => (
                    <tr key={`${row.lotNo}-${idx}`} className="border-b border-slate-100">
                      <td className="py-1">{row.itemName}</td>
                      <td>{row.lotNo}</td>
                      <td className="text-right">{num(row.pcs)}</td>
                      {spec.mode === 'mill' && <td className="text-right">{num(row.issued)}</td>}
                      {spec.mode === 'mill' && <td className="text-right">{num(row.received)}</td>}
                      <td className="text-right font-semibold">{num(row.qty)}</td>
                      {(spec.money || spec.mode === 'shop') && spec.basis !== 'pcs' && <td className="text-right">{num(row.rate)}</td>}
                      {spec.money && <td className="text-right">{num(row.value)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-center gap-3 bg-[#1d4ed8] py-3">
            <button type="button" className="classic-erp-btn min-w-[88px]" onClick={() => window.print()}>Print</button>
            <button type="button" className="classic-erp-btn min-w-[88px]" onClick={() => exportPayload(data)}>Excel</button>
            <button type="button" className="classic-erp-btn min-w-[88px]" onClick={() => setStage('filter')}>Back</button>
            <button type="button" className="classic-erp-btn min-w-[88px]" onClick={onClose}>Exit</button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default StockLedgerModal;
