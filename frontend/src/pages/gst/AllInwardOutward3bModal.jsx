import React, { useMemo, useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { gstinReportApi } from '../../api/gstinReport.api';
import useStore from '../../store/useStore';
import { notifyError } from '../../utils/notify';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fyStart = (d) => new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1);
const dmy = (v) => { if (!v) return ''; const t = new Date(v); return Number.isNaN(t.getTime()) ? v : `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`; };
const n2 = (v) => (Number(v) || 0).toFixed(2);
const sum = (rows, k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);

/** fetch all transaction types and group into books */
const fetchAll = async (fromDate, toDate) => {
  const sources = [
    { name: 'SALES BOOK',    fn: 'salesDetail'    },
    { name: 'GREY PURCHASE', fn: 'purchaseDetail' },
    { name: 'MILL',          fn: 'process'        },
    { name: 'WORK',          fn: 'jobwork'        },
    { name: 'JOURNAL',       fn: 'journal'        },
    { name: 'EXPENSE',       fn: 'expense'        },
  ];
  const books = [];
  await Promise.allSettled(
    sources.map(async ({ name, fn }) => {
      if (!gstinReportApi[fn]) return;
      try {
        const res = await gstinReportApi[fn]({ fromDate, toDate });
        let rows = [];
        if (res && Array.isArray(res.rows)) rows = res.rows;
        else if (res && Array.isArray(res.groups)) rows = res.groups.flatMap((g) => g.rows || (g.subGroups || []).flatMap((s) => s.rows || []));
        else if (Array.isArray(res)) rows = res;
        if (rows.length) books.push({ name, rows });
      } catch { /* skip missing endpoints */ }
    })
  );
  // Also collect by bookName from salesDetail/purchaseDetail
  return books;
};

const billNo = (r) => r.invoiceNo || r.supplierInvoiceNo || r.jobCardNo || r.challanNo || r.voucherNo || r.noteNo || '';

const COLS = ['BILL.DATE','BILL.NO','PARTY','GST.NO','TAX.RATE','TAXABLE','SGST','CGST','IGST','BILL.AMT'];

const ROW_KEYS = [
  { key: 'date',         fmt: dmy },
  { key: '_billNo',      fmt: null },
  { key: 'partyName',   fmt: null },
  { key: 'gstin',       fmt: null },
  { key: 'taxRate',     fmt: null },
  { key: 'taxableAmount', fmt: n2, num: true },
  { key: 'sgst',        fmt: n2, num: true },
  { key: 'cgst',        fmt: n2, num: true },
  { key: 'igst',        fmt: n2, num: true },
  { key: 'netAmount',   fmt: n2, num: true },
];

const AllInwardOutward3bModal = ({ isOpen, onClose }) => {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => iso(fyStart(today)));
  const [to, setTo] = useState(() => iso(today));
  const [direction, setDirection] = useState('Both');
  const [filterTab, setFilterTab] = useState('Party');
  const [summary, setSummary] = useState(false);
  const [groupBy1, setGroupBy1] = useState('Book');
  const [groupBy2, setGroupBy2] = useState('None');
  const [books, setBooks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedParties, setSelectedParties] = useState(new Set());
  const parties = useStore((st) => st.parties) || [];

  // Reset on close
  useEffect(() => { if (!isOpen) setBooks(null); }, [isOpen]);

  // Init selected all parties
  useEffect(() => {
    if (parties.length) setSelectedParties(new Set(parties.map((p) => p._id || p.id)));
  }, [parties.length]);

  const toggleParty = (id) => setSelectedParties((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const toggleAll = (v) => setSelectedParties(v ? new Set(parties.map((p) => p._id || p.id)) : new Set());

  const run = async () => {
    setLoading(true);
    try {
      const raw = await fetchAll(from, to);
      // filter direction
      const outBooks = new Set(['SALES BOOK']);
      const filteredBooks = direction === 'Both' ? raw
        : direction === 'OutWard' ? raw.filter((b) => outBooks.has(b.name))
        : raw.filter((b) => !outBooks.has(b.name));
      // tag bill numbers
      setBooks(filteredBooks.map((b) => ({
        ...b,
        rows: b.rows.map((r) => ({ ...r, _billNo: billNo(r) })),
      })));
    } catch (err) { notifyError(err, 'Could not load report'); }
    finally { setLoading(false); }
  };

  const grandTotals = useMemo(() => {
    if (!books) return null;
    const all = books.flatMap((b) => b.rows);
    return { taxable: sum(all,'taxableAmount'), sgst: sum(all,'sgst'), cgst: sum(all,'cgst'), igst: sum(all,'igst'), bill: sum(all,'netAmount') };
  }, [books]);

  const td = (num) => `px-1 py-[1px] border border-[#ccc] text-[11px] whitespace-nowrap${num ? ' text-right tabular-nums' : ''}`;
  const th = 'px-1.5 py-[2px] border border-[#888] text-[11px] font-bold whitespace-nowrap bg-[#e0e0e0]';

  const FILTER_TABS = ['Party','State_Name','Type','Book','TaxRate'];

  if (!books) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="All INWARD &amp; OUTWARD SUPPLY - 3B" className="max-w-3xl w-full p-0">
        <div className="bg-[#d4d0c8] text-black text-[11px] flex flex-col max-h-[calc(90vh-60px)] min-h-0 overflow-y-auto">
          {/* Header */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#888]">
            <label className="font-bold">From</label>
            <input type="date" className="h-6 border border-[#999] bg-white px-1 text-[11px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            <label className="font-bold">To</label>
            <input type="date" className="h-6 border border-[#999] bg-white px-1 text-[11px]" value={to} onChange={(e) => setTo(e.target.value)} />
            <div className="ml-auto flex items-center gap-1">
              <label className="font-bold">InWard/OutWard</label>
              <select className="h-6 border border-[#999] bg-white px-1 text-[11px] w-28" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option>Both</option><option>InWard</option><option>OutWard</option>
              </select>
            </div>
          </div>
          {/* Select All row */}
          <div className="shrink-0 flex justify-end px-3 py-1 border-b border-[#888] bg-[#dcd8d0]">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} defaultChecked /> Select/UnSelect All
            </label>
          </div>
          {/* Filter tabs */}
          <div className="shrink-0 flex border-b border-[#888] bg-[#c8c8c8]">
            {FILTER_TABS.map((t) => (
              <button key={t} type="button" onClick={() => setFilterTab(t)}
                className={`px-3 py-1 border-r border-[#999] text-[11px] font-bold cursor-pointer${filterTab === t ? ' bg-white' : ' bg-[#c8c8c8] text-[#555]'}`}>{t}</button>
            ))}
          </div>
          {/* Party list - fixed height with internal scrollbar so it never overflows */}
          <div className="h-48 max-h-48 min-h-[140px] overflow-y-auto border-b border-[#888] bg-white px-2 py-1 shrink-0">
            {filterTab === 'Party' && parties.map((p) => {
              const id = p._id || p.id;
              return (
                <div key={id} className="flex items-center gap-1 py-0.5 text-[11px] hover:bg-[#eef2ff]">
                  <input type="checkbox" id={`p-${id}`} checked={selectedParties.has(id)} onChange={() => toggleParty(id)} className="cursor-pointer" />
                  <label htmlFor={`p-${id}`} className="cursor-pointer select-none truncate">{p.name || p.partyName}</label>
                </div>
              );
            })}
            {filterTab !== 'Party' && <div className="text-[11px] text-[#555] p-2">Filter by {filterTab} — select All to include all.</div>}
          </div>
          {/* Bottom bar */}
          <div className="shrink-0 flex flex-wrap items-center gap-3 px-3 py-2 border-t border-[#888]">
            <label className="font-bold">Printout Pattern</label>
            <select className="h-6 border border-[#999] bg-white px-1 text-[11px]"><option>1-Continue</option></select>
            <label className="flex items-center gap-1 ml-4 cursor-pointer select-none">
              <input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} /> Summary Reports
            </label>
            <div className="ml-auto flex items-center gap-2">
              <label className="font-bold">GroupBy 1</label>
              <select className="h-6 border border-[#999] bg-white px-1 text-[11px]" value={groupBy1} onChange={(e) => setGroupBy1(e.target.value)}>
                <option>Book</option><option>Party</option><option>TaxRate</option>
              </select>
              <label className="font-bold">GroupBy 2</label>
              <select className="h-6 border border-[#999] bg-white px-1 text-[11px]" value={groupBy2} onChange={(e) => setGroupBy2(e.target.value)}>
                <option>None</option><option>Party</option>
              </select>
            </div>
          </div>
          {/* Action buttons row - always visible */}
          <div className="shrink-0 flex justify-end gap-2 px-3 py-2 border-t border-[#aaa] bg-[#d4d0c8]">
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="h-7 px-6 border border-[#666] bg-[#d4d0c8] font-bold text-[11px] hover:bg-white active:bg-[#bbb] shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Ok'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-7 px-6 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-white active:bg-[#bbb] shadow-sm cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Result grid (Report Control style)
  const exportExcel = () => {
    const lines = [COLS.join('\t')];
    books.forEach((b) => {
      lines.push(`BOOK - ${b.name}`);
      if (!summary) {
        b.rows.forEach((r) => {
          lines.push(ROW_KEYS.map((c) => { const v = r[c.key]; return c.fmt ? c.fmt(v) : (v ?? ''); }).join('\t'));
        });
      }
      const bt = { taxable: sum(b.rows,'taxableAmount'), sgst: sum(b.rows,'sgst'), cgst: sum(b.rows,'cgst'), igst: sum(b.rows,'igst'), bill: sum(b.rows,'netAmount') };
      lines.push(['BOOK-TOTAL','','','',' ',n2(bt.taxable),n2(bt.sgst),n2(bt.cgst),n2(bt.igst),n2(bt.bill)].join('\t'));
    });
    lines.push(['GRAND TOTAL','','','',' ',n2(grandTotals.taxable),n2(grandTotals.sgst),n2(grandTotals.cgst),n2(grandTotals.igst),n2(grandTotals.bill)].join('\t'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/tab-separated-values' }));
    a.download = `3B_InwardOutward_${from}_${to}.xls`; a.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Control — All Inward &amp; Outward Supply 3B" className="max-w-[1300px] w-full h-[min(92vh,840px)] p-0">
      <div className="flex flex-col h-full min-h-0 bg-white text-black text-[11px]">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="border-collapse w-max min-w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1a3a8f] text-white">
                <th className="w-6 border border-[#888]" />
                {COLS.map((c) => <th key={c} className="px-2 py-[2px] border border-[#888] text-[11px] font-bold whitespace-nowrap text-left">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {books.map((b) => {
                const bt = { taxable: sum(b.rows,'taxableAmount'), sgst: sum(b.rows,'sgst'), cgst: sum(b.rows,'cgst'), igst: sum(b.rows,'igst'), bill: sum(b.rows,'netAmount') };
                return (
                  <React.Fragment key={b.name}>
                    <tr className="bg-[#fce8c3]">
                      <td className="border border-[#ccc]" />
                      <td colSpan={10} className="px-2 py-[2px] border border-[#ccc] font-bold text-[11px]">BOOK - {b.name}</td>
                    </tr>
                    {!summary && b.rows.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-[#fff8e8]' : 'bg-[#f7f7f7] hover:bg-[#fff8e8]'}>
                        <td className="border border-[#ddd] w-6" />
                        {ROW_KEYS.map((c, ci) => {
                          const v = r[c.key];
                          const disp = c.fmt ? c.fmt(v) : (v ?? '');
                          return <td key={ci} className={td(c.num)}>{String(disp)}</td>;
                        })}
                      </tr>
                    ))}
                    <tr className="bg-[#fce8c3] font-bold">
                      <td className="border border-[#ccc]" />
                      <td className="px-2 py-[1px] border border-[#ccc] font-bold text-[11px]">BOOK-TOTAL</td>
                      <td className="border border-[#ccc]" /><td className="border border-[#ccc]" /><td className="border border-[#ccc]" />
                      <td className={td(true)}>{n2(bt.taxable)}</td>
                      <td className={td(true)}>{n2(bt.sgst)}</td>
                      <td className={td(true)}>{n2(bt.cgst)}</td>
                      <td className={td(true)}>{n2(bt.igst)}</td>
                      <td className={td(true)}>{n2(bt.bill)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              <tr className="bg-[#e8e8e8] font-bold">
                <td className="border border-[#ccc]" />
                <td className="px-2 py-[1px] border border-[#ccc] font-bold text-[11px]">GRAND TOTAL</td>
                <td className="border border-[#ccc]" /><td className="border border-[#ccc]" /><td className="border border-[#ccc]" />
                <td className={td(true)}>{n2(grandTotals.taxable)}</td>
                <td className={td(true)}>{n2(grandTotals.sgst)}</td>
                <td className={td(true)}>{n2(grandTotals.cgst)}</td>
                <td className={td(true)}>{n2(grandTotals.igst)}</td>
                <td className={td(true)}>{n2(grandTotals.bill)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom bar */}
        <div className="shrink-0 flex items-center gap-2 px-2 py-1 border-t border-[#888] bg-[#d4d0c8]">
          <button type="button" className="h-6 px-3 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]">ColumnSet</button>
          <button type="button" className="flex-1 h-6 border border-[#666] bg-[#90d890] text-[11px] text-left px-2">Total Lenth</button>
          <button type="button" onClick={exportExcel} className="h-6 px-3 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]">Excel</button>
          <button type="button" onClick={() => window.print()} className="h-6 px-3 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]">PreView</button>
          <button type="button" className="h-6 px-3 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]">WhatsApp<br />Mail</button>
          <button type="button" onClick={() => window.print()} className="h-6 px-3 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]">Print</button>
          <button type="button" onClick={onClose} className="h-6 px-3 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]">Exit</button>
          <button type="button" className="h-6 px-2 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]">aBC</button>
          <div className="ml-auto flex items-center gap-1 text-[11px]">
            <span className="font-bold text-red-700">{n2(grandTotals.bill)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AllInwardOutward3bModal;
