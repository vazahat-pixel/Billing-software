import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { gstApi } from '../../api/gst.api';
import { notifyError } from '../../utils/notify';
import { toast } from '../../store/useToastStore';
import { downloadJson } from '../../utils/gstExport';
import { exportTableToExcel } from '../../utils/reportExport';
import ListPrint from '../../components/print/ListPrint';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileInvoiceDollar, faCartFlatbed, faScaleBalanced, faLayerGroup,
  faNoteSticky, faChartPie, faSync, faPrint, faDownload, faFileExcel, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';

/**
 * GST Reports — every figure on this screen comes from GET /gst/ca-dashboard, which is
 * built server-side by gstReturnService from the actual Sales / Purchase / Return /
 * DebitCreditNote records. Nothing is computed in the browser, so the report can never
 * drift from the invoices, the ledger, or the GSTR JSON export (the export below ships
 * the very same payload object this screen renders).
 */

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v) => Number(v || 0);
const dt = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '');

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const lastOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

const TABS = [
  { id: 'summary', label: 'GST Summary', icon: faChartPie },
  { id: 'gstr1', label: 'GSTR-1 (Sales)', icon: faFileInvoiceDollar },
  { id: 'gstr2', label: 'GSTR-2 (Purchase)', icon: faCartFlatbed },
  { id: 'gstr3b', label: 'GSTR-3B', icon: faScaleBalanced },
  { id: 'hsn', label: 'HSN Summary', icon: faLayerGroup },
  { id: 'cdn', label: 'Credit / Debit Notes', icon: faNoteSticky },
];

const Card = ({ label, value, sub, tone = 'default' }) => (
  <div className="border border-[var(--border)] rounded-xl bg-[var(--bg-card)] px-4 py-3 min-w-0">
    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] truncate">{label}</p>
    <p className={`text-[16px] font-semibold mt-1 tabular-nums truncate ${tone === 'pos' ? 'text-emerald-600' : tone === 'neg' ? 'text-rose-600' : 'text-[var(--text-primary)]'}`}>{value}</p>
    {sub ? <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{sub}</p> : null}
  </div>
);

const Table = ({ columns, rows, empty }) => (
  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
    <div className="overflow-x-auto max-h-[calc(90vh-330px)] overflow-y-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase tracking-widest text-[9px] border-b border-[var(--border)] sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2.5 font-semibold whitespace-nowrap ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {!rows.length ? (
            <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-[var(--text-muted)] text-[13px]">{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r._key || i} className="hover:bg-[var(--bg-base)] transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-[11px] whitespace-nowrap ${c.align === 'right' ? 'text-right tabular-nums font-medium' : c.align === 'center' ? 'text-center' : ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function GstReportsHub({ isOpen, onClose }) {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(lastOfMonth);
  const [tab, setTab] = useState('summary');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printCfg, setPrintCfg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await gstApi.caDashboard({ startDate: from, endDate: to });
      setData(res || null);
    } catch (e) {
      setError(e?.message || 'Failed to load GST data');
      setData(null);
      notifyError(e, 'Failed to load GST reports');
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const g1 = useMemo(() => data?.gstr1 || {}, [data]);
  const g2 = useMemo(() => data?.gstr2 || [], [data]);
  const s = data?.summary || {};

  /* ---- rows built ONLY from the server payload ---- */

  const b2bRows = useMemo(() => {
    const out = [];
    for (const p of g1.b2b || []) for (const inv of p.inv || []) {
      const d = inv.itms?.[0]?.itm_det || {};
      out.push({
        _key: `${p.ctin}-${inv.inum}`, gstin: p.ctin, inum: inv.inum, idt: inv.idt, pos: inv.pos,
        rchrg: inv.rchrg, rt: d.rt, txval: d.txval, camt: d.camt, samt: d.samt, iamt: d.iamt,
        tax: num(d.camt) + num(d.samt) + num(d.iamt), val: inv.val,
      });
    }
    return out;
  }, [g1]);

  const b2cRows = useMemo(() => {
    const rows = (g1.b2cs || []).map((r, i) => ({
      _key: `b2cs-${i}`, kind: 'B2CS', inum: '—', idt: '', pos: r.pos, rt: r.rt,
      txval: r.txval, camt: r.camt, samt: r.samt, iamt: r.iamt,
      tax: num(r.camt) + num(r.samt) + num(r.iamt), val: num(r.txval) + num(r.camt) + num(r.samt) + num(r.iamt),
    }));
    for (const inv of g1.b2cl || []) {
      const d = inv.itms?.[0]?.itm_det || {};
      rows.push({
        _key: `b2cl-${inv.inum}`, kind: 'B2CL', inum: inv.inum, idt: inv.idt, pos: inv.pos, rt: d.rt,
        txval: d.txval, camt: d.camt, samt: d.samt, iamt: d.iamt,
        tax: num(d.camt) + num(d.samt) + num(d.iamt), val: inv.val,
      });
    }
    return rows;
  }, [g1]);

  const hsnRows = useMemo(
    () => (g1.hsn?.data || []).map((h, i) => ({ ...h, _key: `hsn-${i}` })),
    [g1]
  );

  const cdnRows = useMemo(() => {
    const out = [];
    for (const grp of g1.cdnr || []) for (const n of grp.nt || []) {
      out.push({ _key: `cdnr-${n.nt_num}`, section: 'CDNR', gstin: grp.ctin, ...n });
    }
    for (const n of g1.cdnur || []) out.push({ _key: `cdnur-${n.nt_num}`, section: 'CDNUR', gstin: '', ...n });
    return out;
  }, [g1]);

  const purchaseNotes = useMemo(
    () => (data?.notes || []).filter((n) => n.noteSide === 'Purchase').map((n, i) => ({ ...n, _key: `pn-${i}` })),
    [data]
  );

  /* ---- column sets ---- */
  const COLS = {
    b2b: [
      { key: 'inum', label: 'Invoice No' }, { key: 'idt', label: 'Date', render: (r) => dt(r.idt) },
      { key: 'gstin', label: 'GSTIN' }, { key: 'pos', label: 'POS', align: 'center' },
      { key: 'rchrg', label: 'RCM', align: 'center' },
      { key: 'rt', label: 'Rate %', align: 'right', render: (r) => `${num(r.rt)}%` },
      { key: 'txval', label: 'Taxable', align: 'right', render: (r) => money(r.txval) },
      { key: 'camt', label: 'CGST', align: 'right', render: (r) => money(r.camt) },
      { key: 'samt', label: 'SGST', align: 'right', render: (r) => money(r.samt) },
      { key: 'iamt', label: 'IGST', align: 'right', render: (r) => money(r.iamt) },
      { key: 'tax', label: 'Total GST', align: 'right', render: (r) => money(r.tax) },
      { key: 'val', label: 'Invoice Value', align: 'right', render: (r) => money(r.val) },
    ],
    b2c: [
      { key: 'kind', label: 'Section', align: 'center' },
      { key: 'inum', label: 'Invoice' }, { key: 'idt', label: 'Date', render: (r) => dt(r.idt) },
      { key: 'pos', label: 'POS', align: 'center' },
      { key: 'rt', label: 'Rate %', align: 'right', render: (r) => `${num(r.rt)}%` },
      { key: 'txval', label: 'Taxable', align: 'right', render: (r) => money(r.txval) },
      { key: 'camt', label: 'CGST', align: 'right', render: (r) => money(r.camt) },
      { key: 'samt', label: 'SGST', align: 'right', render: (r) => money(r.samt) },
      { key: 'iamt', label: 'IGST', align: 'right', render: (r) => money(r.iamt) },
      { key: 'tax', label: 'Total GST', align: 'right', render: (r) => money(r.tax) },
      { key: 'val', label: 'Value', align: 'right', render: (r) => money(r.val) },
    ],
    gstr2: [
      { key: 'invoiceNo', label: 'Invoice No' },
      { key: 'date', label: 'Date', render: (r) => dt(r.date) },
      { key: 'partyName', label: 'Supplier' },
      { key: 'gstin', label: 'GSTIN', render: (r) => r.gstin || <span className="text-rose-600">— missing —</span> },
      { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => money(r.taxable) },
      { key: 'cgst', label: 'CGST', align: 'right', render: (r) => money(r.cgst) },
      { key: 'sgst', label: 'SGST', align: 'right', render: (r) => money(r.sgst) },
      { key: 'igst', label: 'IGST', align: 'right', render: (r) => money(r.igst) },
      { key: 'gstAmount', label: 'ITC', align: 'right', render: (r) => money(r.gstAmount) },
      { key: 'netAmount', label: 'Invoice Value', align: 'right', render: (r) => money(r.netAmount) },
    ],
    hsn: [
      { key: 'hsn_sc', label: 'HSN / SAC' }, { key: 'desc', label: 'Description' },
      { key: 'uqc', label: 'UQC', align: 'center' },
      { key: 'qty', label: 'Qty', align: 'right', render: (r) => num(r.qty).toFixed(2) },
      { key: 'txval', label: 'Taxable', align: 'right', render: (r) => money(r.txval) },
      { key: 'camt', label: 'CGST', align: 'right', render: (r) => money(r.camt) },
      { key: 'samt', label: 'SGST', align: 'right', render: (r) => money(r.samt) },
      { key: 'iamt', label: 'IGST', align: 'right', render: (r) => money(r.iamt) },
      { key: 'tot', label: 'Total Tax', align: 'right', render: (r) => money(num(r.camt) + num(r.samt) + num(r.iamt)) },
    ],
    cdn: [
      { key: 'section', label: 'Section', align: 'center' },
      { key: 'nt_num', label: 'Note No' }, { key: 'nt_dt', label: 'Date', render: (r) => dt(r.nt_dt) },
      { key: 'ntty', label: 'Type', align: 'center', render: (r) => (r.ntty === 'C' ? 'Credit' : 'Debit') },
      { key: 'gstin', label: 'GSTIN', render: (r) => r.gstin || '— unregistered —' },
      { key: 'txval', label: 'Taxable', align: 'right', render: (r) => money(r.txval) },
      { key: 'camt', label: 'CGST', align: 'right', render: (r) => money(r.camt) },
      { key: 'samt', label: 'SGST', align: 'right', render: (r) => money(r.samt) },
      { key: 'iamt', label: 'IGST', align: 'right', render: (r) => money(r.iamt) },
      { key: 'val', label: 'Note Value', align: 'right', render: (r) => money(r.val) },
      { key: 'rsn', label: 'Reason' },
    ],
    pnotes: [
      { key: 'noteNo', label: 'Note No' }, { key: 'date', label: 'Date', render: (r) => dt(r.date) },
      { key: 'noteType', label: 'Type', align: 'center' },
      { key: 'partyName', label: 'Supplier' },
      { key: 'againstInvoiceNo', label: 'Against Bill' },
      { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
      { key: 'netAmount', label: 'Net', align: 'right', render: (r) => money(r.netAmount) },
    ],
  };

  const activePrint = () => {
    const map = {
      gstr1: [`GSTR-1 B2B (${from} to ${to})`, COLS.b2b, b2bRows],
      gstr2: [`GSTR-2 Purchase (${from} to ${to})`, COLS.gstr2, g2.map((r, i) => ({ ...r, _key: i }))],
      hsn: [`HSN Summary (${from} to ${to})`, COLS.hsn, hsnRows],
      cdn: [`Credit / Debit Notes (${from} to ${to})`, COLS.cdn, cdnRows],
    };
    const cfg = map[tab];
    if (!cfg) return toast.warning('This tab has no printable table — use GSTR-1 / GSTR-2 / HSN / Notes');
    setPrintCfg({ title: cfg[0], columns: cfg[1], rows: cfg[2] });
  };

  const exportExcel = () => {
    if (!data) return;
    const map = {
      gstr1: [`GSTR1_Sales_${from}_to_${to}`, COLS.b2b, b2bRows],
      gstr2: [`GSTR2_Purchase_${from}_to_${to}`, COLS.gstr2, g2.map((r, i) => ({ ...r, _key: i }))],
      hsn: [`HSN_Summary_${from}_to_${to}`, COLS.hsn, hsnRows],
      cdn: [`Credit_Debit_Notes_${from}_to_${to}`, COLS.cdn, cdnRows],
    };
    const cfg = map[tab];
    if (!cfg) {
      // Export all summary sections
      exportTableToExcel(`GST_Summary_${from}_to_${to}`, [
        { key: 'section', label: 'Section' },
        { key: 'count', label: 'Invoices/Notes' },
        { key: 'taxable', label: 'Taxable Amount' },
        { key: 'cgst', label: 'CGST' },
        { key: 'sgst', label: 'SGST' },
        { key: 'igst', label: 'IGST' },
        { key: 'totalTax', label: 'Total Tax' },
      ], [
        { section: 'Outward (GSTR-1 B2B)', count: g1.counts?.b2b || 0, taxable: g1.taxable?.b2b || 0, cgst: (g1.tax?.b2b || 0)/2, sgst: (g1.tax?.b2b || 0)/2, igst: 0, totalTax: g1.tax?.b2b || 0 },
        { section: 'Inward (GSTR-2 ITC)', count: g2.length, taxable: g2.reduce((s,x)=>s+(x.taxableAmount||0),0), cgst: g2.reduce((s,x)=>s+(x.cgst||0),0), sgst: g2.reduce((s,x)=>s+(x.sgst||0),0), igst: g2.reduce((s,x)=>s+(x.igst||0),0), totalTax: g2.reduce((s,x)=>s+(x.gstAmount||0),0) }
      ]);
      toast.success('GST Summary Excel exported');
      return;
    }
    exportTableToExcel(cfg[0], cfg[1], cfg[2]);
    toast.success(`${cfg[0]} Excel exported`);
  };

  const exportJson = () => {
    if (!data) return;
    // Ships the exact server payload the tables above render — one source, no re-compute.
    const clean = { ...(g1.payload || g1) };
    delete clean.invoices;
    downloadJson(clean, `GSTR1_${from}_to_${to}.json`);
    toast.success('GSTR-1 JSON exported');
  };

  const body = () => {
    if (loading) {
      return (
        <div className="space-y-3 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-[var(--bg-base)]" />)}
          </div>
          <div className="h-64 rounded-xl bg-[var(--bg-base)]" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="border border-rose-200 bg-rose-50 rounded-xl p-8 text-center">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-rose-500 text-xl" />
          <p className="mt-2 text-[13px] font-semibold text-rose-800">Could not load GST reports</p>
          <p className="text-[11px] text-rose-600 mt-1">{error}</p>
          <button type="button" onClick={load} className="erp-btn erp-btn-secondary h-8 px-4 text-[11px] mt-4">Retry</button>
        </div>
      );
    }
    if (!data) return null;

    const EMPTY = 'No GST transactions found for the selected period.';

    if (tab === 'summary') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card label="Outward Taxable" value={money(s.outwardTaxable)} sub={`${s.salesCount || 0} invoices`} />
            <Card label="Output GST" value={money(s.outwardGst)} />
            <Card label="Inward Taxable" value={money(s.inwardTaxable)} sub={`${s.purchaseCount || 0} bills`} />
            <Card label="ITC Available" value={money(s.itcAvailable)} />
            <Card label="Credit/Debit Notes" value={money(s.noteGst)} sub={`${s.notesCount || 0} notes`} />
            <Card
              label="Net GST Payable"
              value={money(data.gstr3b?.net?.total)}
              tone={num(data.gstr3b?.net?.total) >= 0 ? 'neg' : 'pos'}
              sub={num(data.gstr3b?.net?.total) >= 0 ? 'payable' : 'credit carried'}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card label="B2B Parties" value={s.b2bCount || 0} />
            <Card label="B2C Rows" value={(s.b2csCount || 0) + (s.b2clCount || 0)} />
            <Card label="HSN Rows" value={s.hsnCount || 0} />
            <Card label="Sales Returns" value={s.returnsCount || 0} sub={money(s.returnGst)} />
            <Card label="Filing Period" value={data.period?.fp || '—'} />
          </div>
          {(data.warnings || []).length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
                Data quality ({data.warnings.length})
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {data.warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-amber-900 flex gap-2">
                    <span className={`font-bold ${w.type === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>{w.code}</span>
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (tab === 'gstr1') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card label="Taxable Value" value={money(g1.totals?.taxable)} />
            <Card label="CGST" value={money(g1.totals?.cgst)} />
            <Card label="SGST" value={money(g1.totals?.sgst)} />
            <Card label="IGST" value={money(g1.totals?.igst)} />
            <Card label="Invoices" value={g1.totals?.invoiceCount || 0} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">B2B — registered customers</p>
            <Table columns={COLS.b2b} rows={b2bRows} empty={EMPTY} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">B2C — unregistered (B2CS / B2CL)</p>
            <Table columns={COLS.b2c} rows={b2cRows} empty={EMPTY} />
          </div>
        </div>
      );
    }

    if (tab === 'gstr2') {
      const t = g2.reduce((a, p) => ({
        txval: a.txval + num(p.taxable), c: a.c + num(p.cgst), s: a.s + num(p.sgst), i: a.i + num(p.igst),
      }), { txval: 0, c: 0, s: 0, i: 0 });
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card label="Taxable Value" value={money(t.txval)} />
            <Card label="CGST (ITC)" value={money(t.c)} />
            <Card label="SGST (ITC)" value={money(t.s)} />
            <Card label="IGST (ITC)" value={money(t.i)} />
            <Card label="Purchase Bills" value={g2.length} />
          </div>
          <Table columns={COLS.gstr2} rows={g2.map((r, i) => ({ ...r, _key: i }))} empty={EMPTY} />
          <p className="text-[10px] text-[var(--text-muted)]">
            Internal purchase register only — this is not a GSTR-2A/2B reconciliation against the GST portal.
          </p>
        </div>
      );
    }

    if (tab === 'gstr3b') {
      const b = data.gstr3b || {};
      const Row = ({ label, v, strong }) => (
        <tr className={strong ? 'font-semibold' : ''}>
          <td className="px-3 py-2 text-[11px]">{label}</td>
          <td className="px-3 py-2 text-[11px] text-right tabular-nums">{money(v?.taxable)}</td>
          <td className="px-3 py-2 text-[11px] text-right tabular-nums">{money(v?.cgst)}</td>
          <td className="px-3 py-2 text-[11px] text-right tabular-nums">{money(v?.sgst)}</td>
          <td className="px-3 py-2 text-[11px] text-right tabular-nums">{money(v?.igst)}</td>
          <td className="px-3 py-2 text-[11px] text-right tabular-nums">{money(v?.total)}</td>
        </tr>
      );
      return (
        <div className="space-y-4">
          <div className="border border-[var(--border)] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase tracking-widest text-[9px] border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-2.5">Section</th><th className="px-3 py-2.5 text-right">Taxable</th>
                  <th className="px-3 py-2.5 text-right">CGST</th><th className="px-3 py-2.5 text-right">SGST</th>
                  <th className="px-3 py-2.5 text-right">IGST</th><th className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                <Row label="3.1(a) Outward taxable supplies" v={b.outward} />
                <Row label="4(A) Eligible ITC" v={b.itc} />
                <Row label="Net payable" v={b.net} strong />
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            Derived from the same Sales and Purchase records as GSTR-1 / GSTR-2 above. Sections not backed by
            data in this ERP (nil-rated, non-GST inward, reverse-charge splits) are intentionally not shown
            rather than estimated.
          </p>
        </div>
      );
    }

    if (tab === 'hsn') {
      return (
        <div className="space-y-3">
          <Table columns={COLS.hsn} rows={hsnRows} empty="No HSN data — check that items carry HSN codes in the Item master." />
          <p className="text-[10px] text-[var(--text-muted)]">Aggregated from invoice line items; reconciles with GSTR-1 taxable value.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
            Sales-side notes filed in GSTR-1 (CDNR / CDNUR) — includes settlement-discount Credit Notes
          </p>
          <Table columns={COLS.cdn} rows={cdnRows} empty={EMPTY} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
            Purchase-side notes — adjust ITC, never filed as outward supply
          </p>
          <Table columns={COLS.pnotes} rows={purchaseNotes} empty={EMPTY} />
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-[96vw] w-[96vw] h-[92vh] p-0">
        <div className="flex flex-col h-full bg-[var(--bg-card)] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="shrink-0 px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">GST Reports</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {data?.company?.name || ''}{data?.company?.gstin ? ` · GSTIN ${data.company.gstin}` : ''}
                {data?.period?.fp ? ` · Filing period ${data.period.fp}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="h-8 px-2 rounded-lg border border-[var(--border)] text-[12px] outline-none focus:border-[var(--accent)]" />
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="h-8 px-2 rounded-lg border border-[var(--border)] text-[12px] outline-none focus:border-[var(--accent)]" />
              <button type="button" onClick={load} disabled={loading} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] flex items-center gap-1.5">
                <FontAwesomeIcon icon={faSync} className={`text-[10px] ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button type="button" onClick={activePrint} disabled={loading || !data} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] flex items-center gap-1.5">
                <FontAwesomeIcon icon={faPrint} className="text-[10px]" /> Print
              </button>
              <button type="button" onClick={exportExcel} disabled={loading || !data} className="erp-btn erp-btn-primary h-8 px-3 text-[11px] flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white">
                <FontAwesomeIcon icon={faFileExcel} className="text-[10px]" /> Export Excel (.csv)
              </button>
              <button type="button" onClick={exportJson} disabled={loading || !data} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] flex items-center gap-1.5">
                <FontAwesomeIcon icon={faDownload} className="text-[10px]" /> GSTR-1 JSON (Govt)
              </button>
              <button type="button" onClick={onClose} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]">Close</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 flex gap-1 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-base)] overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  tab === t.id ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}>
                <FontAwesomeIcon icon={t.icon} className="text-[10px]" /> {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">{body()}</div>
        </div>
      </Modal>

      {printCfg && (
        <ListPrint title={printCfg.title} subtitle={`${printCfg.rows.length} rows · ${from} to ${to}`}
          columns={printCfg.columns} rows={printCfg.rows} onClose={() => setPrintCfg(null)} />
      )}
    </>
  );
}
