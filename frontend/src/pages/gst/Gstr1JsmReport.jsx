import React, { useMemo, useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { notifyError } from '../../utils/notify';
import { toast } from '../../store/useToastStore';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fyStart = (d) => new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1);
const dmy = (v) => { if (!v) return ''; const t = new Date(v); return Number.isNaN(t.getTime()) ? v : `${String(t.getDate()).padStart(2, '0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][t.getMonth()]}-${t.getFullYear()}`; };
const n2 = (v) => (Number(v) || 0).toFixed(2);

const TABS = ['B2B','B2CL','B2CS','CDNR','CDNU','HSN','HSN B2C','DOCS','EXP','EXEMP'];

const B2B_COLS = [
  { key: 'gstin',          label: 'GSTIN_NO',    w: 160 },
  { key: 'partyName',      label: 'PARTY',        w: 180 },
  { key: 'invoiceNo',      label: 'NCBILL_NO',    w: 90 },
  { key: 'date',           label: 'BILL_DATE',    w: 100, fmt: dmy },
  { key: 'netAmount',      label: 'NET_TOT',      w: 90,  num: true, fmt: n2 },
  { key: 'stateName',      label: 'STATE_NAME',   w: 120 },
  { key: 'reverseCharge',  label: 'RVRS_YN',      w: 70  },
  { key: 'taxRate',        label: 'A_TAX_RATE',   w: 80,  num: true },
  { key: 'invType',        label: 'INV_TYPE',     w: 110 },
];
const B2CL_COLS = [
  { key: 'invoiceNo',  label: 'BILL_NO',    w: 90 },
  { key: 'date',       label: 'BILL_DATE',  w: 100, fmt: dmy },
  { key: 'stateName',  label: 'POS',        w: 120 },
  { key: 'taxRate',    label: 'TAX_RATE',   w: 80,  num: true },
  { key: 'taxableAmount', label: 'TAXABLE', w: 110, num: true, fmt: n2 },
  { key: 'igst',       label: 'IGST',       w: 100, num: true, fmt: n2 },
  { key: 'netAmount',  label: 'BILL_AMT',   w: 110, num: true, fmt: n2 },
];
const B2CS_COLS = [
  { key: 'typ',       label: 'TYPE',     w: 60  },
  { key: 'pos',       label: 'POS',      w: 120 },
  { key: 'taxRate',   label: 'TAX_RATE', w: 80, num: true },
  { key: 'taxableAmount', label: 'TAXABLE', w: 110, num: true, fmt: n2 },
  { key: 'cgst',     label: 'CGST',     w: 100, num: true, fmt: n2 },
  { key: 'sgst',     label: 'SGST',     w: 100, num: true, fmt: n2 },
  { key: 'igst',     label: 'IGST',     w: 100, num: true, fmt: n2 },
];
const CDNR_COLS = [
  { key: 'gstin',    label: 'GSTIN_NO',  w: 160 },
  { key: 'partyName',label: 'PARTY',     w: 160 },
  { key: 'noteNo',   label: 'NOTE_NO',   w: 80  },
  { key: 'noteDate', label: 'NOTE_DATE', w: 100, fmt: dmy },
  { key: 'noteType', label: 'NOTE_TYPE', w: 80  },
  { key: 'taxRate',  label: 'TAX_RATE',  w: 80, num: true },
  { key: 'taxableAmount', label: 'TAXABLE', w: 110, num: true, fmt: n2 },
  { key: 'cgst',    label: 'CGST',      w: 100, num: true, fmt: n2 },
  { key: 'sgst',    label: 'SGST',      w: 100, num: true, fmt: n2 },
  { key: 'igst',    label: 'IGST',      w: 100, num: true, fmt: n2 },
  { key: 'netAmount',label: 'NOTE_AMT', w: 110, num: true, fmt: n2 },
];
const HSN_COLS = [
  { key: 'hsn_sc', label: 'HSN',       w: 100 },
  { key: 'desc',   label: 'DESCRIPTION', w: 200 },
  { key: 'uqc',   label: 'UQC',        w: 60  },
  { key: 'qty',   label: 'QTY',        w: 80, num: true },
  { key: 'txval', label: 'TAXABLE',    w: 110, num: true, fmt: n2 },
  { key: 'camt',  label: 'CGST',       w: 100, num: true, fmt: n2 },
  { key: 'samt',  label: 'SGST',       w: 100, num: true, fmt: n2 },
  { key: 'iamt',  label: 'IGST',       w: 100, num: true, fmt: n2 },
];
const DOCS_COLS = [
  { key: 'docType', label: 'DOC_TYPE',   w: 200 },
  { key: 'from',    label: 'FROM',       w: 100 },
  { key: 'to',      label: 'TO',         w: 100 },
  { key: 'totnum',  label: 'TOTAL',      w: 80, num: true },
  { key: 'cancel',  label: 'CANCELLED',  w: 80, num: true },
  { key: 'net_issue', label: 'NET_ISSUED', w: 80, num: true },
];
const EXP_COLS = [
  { key: 'exportType', label: 'EXP_TYPE', w: 80  },
  { key: 'invoiceNo',  label: 'BILL_NO',  w: 90  },
  { key: 'date',       label: 'BILL_DATE',w: 100, fmt: dmy },
  { key: 'taxRate',    label: 'TAX_RATE', w: 80, num: true },
  { key: 'taxableAmount', label: 'TAXABLE', w: 110, num: true, fmt: n2 },
  { key: 'igst',       label: 'IGST',    w: 100, num: true, fmt: n2 },
  { key: 'invoiceValue', label: 'BILL_AMT',w: 110, num: true, fmt: n2 },
];
const EXEMP_COLS = [
  { key: 'description', label: 'DESCRIPTION', w: 300 },
  { key: 'nilRated',    label: 'NIL_RATED',   w: 110, num: true, fmt: n2 },
  { key: 'exempted',    label: 'EXEMPTED',     w: 110, num: true, fmt: n2 },
  { key: 'nonGst',      label: 'NON_GST',      w: 110, num: true, fmt: n2 },
];

const COLS_MAP = { B2B: B2B_COLS, B2CL: B2CL_COLS, B2CS: B2CS_COLS, CDNR: CDNR_COLS, CDNU: CDNR_COLS, HSN: HSN_COLS, 'HSN B2C': HSN_COLS, DOCS: DOCS_COLS, EXP: EXP_COLS, EXEMP: EXEMP_COLS };

const flat = (data, tab) => {
  const p = data?.payload || data || {};
  switch (tab) {
    case 'B2B': return p.b2bRows || [];
    case 'B2CL': return p.b2clRows || [];
    case 'B2CS': return p.b2cs || [];
    case 'CDNR': return p.cdnrRows || [];
    case 'CDNU': return p.cdnuRows || [];
    case 'HSN': return p.hsnRows || p.hsn?.data || [];
    case 'HSN B2C': return p.hsnB2cRows || p.hsn?.data || [];
    case 'DOCS': return p.docsRows || [];
    case 'EXP': return p.expRows || [];
    case 'EXEMP': return p.exempRows || [];
    default: return [];
  }
};

const SALES_TABS = new Set(['B2B', 'B2CL', 'B2CS']);

const Grid = ({ cols, rows, tab, onOpenInvoice }) => {
  const th = 'px-1.5 py-[2px] border border-[#888] text-left text-[11px] font-bold whitespace-nowrap bg-[#e0e0e0] text-black';
  const td = (num) => `px-1.5 py-[1px] border border-[#ccc] text-[11px] whitespace-nowrap${num ? ' text-right tabular-nums' : ''}`;
  if (!rows.length) return <div className="p-4 text-[12px] text-[#555]">No records found.</div>;
  const clickable = onOpenInvoice && SALES_TABS.has(tab);
  return (
    <div className="overflow-auto flex-1 min-h-0">
      <table className="border-collapse w-max min-w-full">
        <thead className="sticky top-0 z-10">
          <tr>{cols.map((c) => <th key={c.key} className={th} style={{ minWidth: c.w }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#f7f7f7]'}${clickable && r.invoiceNo ? ' cursor-pointer hover:bg-blue-50' : ''}`}
              onClick={clickable && r.invoiceNo ? () => onOpenInvoice(r.invoiceNo) : undefined}
            >
              {cols.map((c) => {
                const v = r[c.key];
                const disp = c.fmt ? c.fmt(v) : (v ?? '');
                return <td key={c.key} className={td(c.num)}>{String(disp)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** JSM-style GSTR-1 window: header bar + B2B/B2CL/… tabs + JSM column names + Generate Excel / Exit */
const Gstr1JsmReport = ({ isOpen, onClose, onOpenInvoice }) => {
  const { fetchGstr1 } = useStore();
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => iso(fyStart(today)));
  const [to, setTo] = useState(() => iso(today));
  const [tab, setTab] = useState('B2B');
  const [gstSlab, setGstSlab] = useState(true);
  const [hsnDesc, setHsnDesc] = useState(false);
  const [ecomm, setEcomm] = useState(false);
  const [printType, setPrintType] = useState('Regular');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!isOpen) setData(null); }, [isOpen]);

  const load = async () => {
    setLoading(true);
    try { setData(await fetchGstr1(from, to)); }
    catch (err) { notifyError(err, 'GSTR-1 load failed'); }
    finally { setLoading(false); }
  };

  const rows = useMemo(() => (data ? flat(data, tab) : []), [data, tab]);
  const cols = COLS_MAP[tab] || B2B_COLS;

  const genExcel = () => {
    if (!data) { toast.info('Click LoadData first'); return; }
    const header = cols.map((c) => c.label).join('\t');
    const body = rows.map((r) => cols.map((c) => { const v = r[c.key]; return c.fmt ? c.fmt(v) : (v ?? ''); }).join('\t')).join('\n');
    const tsv = `${header}\n${body}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([tsv], { type: 'text/tab-separated-values' }));
    a.download = `GSTR1_${tab}_${from}_${to}.xls`; a.click();
    toast.success('Excel file downloaded');
  };

  const hdr = 'px-3 py-[1px] border border-[#777] text-[11px] font-bold cursor-pointer select-none';
  const activeHdr = `${hdr} bg-[#fff] text-[#000] border-b-0 relative z-10 -mb-px`;
  const inactiveHdr = `${hdr} bg-[#c8c8c8] text-[#333] border-b border-[#777]`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="GSTR1_V3_2_2" className="max-w-[1300px] w-full h-[min(92vh,840px)] p-0">
      <div className="flex flex-col h-full min-h-0 bg-[#f0f0f0] text-black text-[11px]">
        {/* JSM-style top filter bar */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-2 py-1 bg-[#d4d0c8] border-b border-[#888]">
          <select className="h-6 border border-[#999] bg-white px-1 text-[11px]"><option>None</option></select>
          <label className="font-bold">From</label>
          <input type="date" className="h-6 border border-[#999] bg-white px-1 text-[11px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="font-bold">To</label>
          <input type="date" className="h-6 border border-[#999] bg-white px-1 text-[11px]" value={to} onChange={(e) => setTo(e.target.value)} />
          <label className="flex items-center gap-1 font-bold text-[#003399]"><input type="checkbox" checked={gstSlab} onChange={(e) => setGstSlab(e.target.checked)} /> Gst Slab Wise</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={hsnDesc} onChange={(e) => setHsnDesc(e.target.checked)} /> HsnDescriptionWise</label>
          <div className="flex items-center gap-1 ml-2">
            {['Regular','Pcs','Qty','Kgs'].map((v) => <label key={v} className="flex items-center gap-0.5"><input type="radio" name="qty_type" checked={printType === v} onChange={() => setPrintType(v)} />{v}</label>)}
          </div>
          <label className="flex items-center gap-1 ml-2 text-white bg-[#000080] px-2 py-0.5 border border-[#000]"><input type="checkbox" checked={ecomm} onChange={(e) => setEcomm(e.target.checked)} className="accent-white" /> E-COMM</label>
          <div className="flex items-center gap-1 ml-2">
            <label className="font-bold">Report Type</label>
            <select className="h-6 border border-[#999] bg-white px-1 text-[11px]"><option>GSTR-1</option></select>
          </div>
          <button type="button" onClick={load} disabled={loading} className="h-6 px-3 border border-[#666] bg-[#d4d0c8] font-bold text-[11px] hover:bg-[#e8e8e8] active:bg-[#c0c0c0]">
            {loading ? 'Loading…' : 'LoadData'}
          </button>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex items-end px-2 pt-1 border-b border-[#777] bg-[#d4d0c8]">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={tab === t ? activeHdr : inactiveHdr}>
              {t}
            </button>
          ))}
        </div>

        {/* Grid area */}
        <div className="flex-1 min-h-0 bg-white flex flex-col overflow-hidden">
          {!data ? (
            <div className="flex items-center justify-center flex-1 text-[13px] text-[#555]">
              {loading ? 'Loading data…' : 'Press LoadData to fetch GSTR-1 data'}
            </div>
          ) : (
            <Grid cols={cols} rows={rows} tab={tab} onOpenInvoice={onOpenInvoice} />
          )}
        </div>

        {/* Bottom bar */}
        <div className="shrink-0 flex items-center gap-2 px-2 py-1 bg-[#d4d0c8] border-t border-[#888]">
          <button type="button" className="h-6 px-3 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]" onClick={() => toast.info('Email not configured')}>Email Send</button>
          <div className="flex items-center gap-1 mx-2">
            <label className="flex items-center gap-0.5"><input type="radio" name="xl_type" defaultChecked /> Regular</label>
            <label className="flex items-center gap-0.5"><input type="radio" name="xl_type" /> EPPlus</label>
          </div>
          <button type="button" className="h-6 px-3 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]" onClick={() => toast.info('No Excel process running')}>Kill Excel Process</button>
          <div className="flex-1" />
          <button type="button" onClick={genExcel} disabled={!data} className="h-6 px-4 border border-[#666] bg-[#d4d0c8] font-bold text-[11px] hover:bg-[#e8e8e8] disabled:opacity-50">Generate Excel</button>
          <button type="button" onClick={onClose} className="h-6 px-4 border border-[#666] bg-[#d4d0c8] text-[11px] hover:bg-[#e8e8e8]">Exit</button>
        </div>
      </div>
    </Modal>
  );
};

export default Gstr1JsmReport;
