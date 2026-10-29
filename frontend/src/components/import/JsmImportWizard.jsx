import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import migrationApi from '../../api/migration.api';
import { toast } from '../../store/useToastStore';
import useStore from '../../store/useStore';
import { erpConfirm } from '../../utils/confirm';

const CHUNK = 6 * 1024 * 1024; // 6 MB: under the 10 MB limit of the web server in front of the API
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const COUNT_LABELS = { Party: 'Parties', LedgerMaster: 'Ledger accounts', Item: 'Items', InventoryLot: 'Stock lots', Sales: 'Sales bills', Purchase: 'Purchase bills', Job: 'Mill / Job challans', PaymentVoucher: 'Receipts + Payments', DebitCreditNote: 'GST notes', ReturnInvoice: 'Sales returns', AccountingEntry: 'Ledger entries', BillSettlement: 'Bill outstanding records' };

/**
 * One-click import of a JSM installation, run from the Desktop app:
 * find JSM -> choose company/years -> read + upload -> check (preview) -> import -> reconciliation report -> undo.
 */
export default function JsmImportWizard({ isOpen, onClose }) {
  const desktop = typeof window !== 'undefined' ? window.textileDesktop?.jsm : null;
  const [step, setStep] = useState('detect'); // detect | select | work | preview | applying | done | error
  const [found, setFound] = useState(null);
  const [pick, setPick] = useState({ install: 0, db: '', company: 0 });
  const [years, setYears] = useState([]);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null);
  const [runId, setRunId] = useState('');
  const [exportFile, setExportFile] = useState('');
  const [preview, setPreview] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [undone, setUndone] = useState(false);
  const poll = useRef(null);
  const reload = () => { const st = useStore.getState(); st.refreshAllData?.().catch(() => {}); st.fetchItems?.(); st.fetchParties?.(); };

  const companies = useMemo(() => found?.installs?.[pick.install]?.databases?.find((d) => d.name === pick.db)?.companies || [], [found, pick]);

  useEffect(() => () => { clearInterval(poll.current); }, []);
  useEffect(() => {
    if (!isOpen) return undefined;
    setStep('detect'); setError(''); setPreview(null); setReport(null); setRunId(''); setUndone(false);
    if (!desktop) return undefined;
    let off = () => {};
    off = desktop.onProgress((p) => setProg(p));
    (async () => {
      setBusy('Looking for JSM on this computer...');
      const r = await desktop.detect();
      setBusy('');
      setFound(r);
      if (!r.ok) { setError(r.message); setStep('error'); return; }
      const inst = r.installs.find((i) => i.databases.length) || r.installs[0];
      const db = inst.databases[0];
      setPick({ install: inst.index, db: db.name, company: 0 });
      setYears(db.companies[0].years.map((y) => y.coPath));
      setStep('select');
    })();
    return () => off();
  }, [isOpen, desktop]);

  const choose = (idx) => { setPick((p) => ({ ...p, company: idx })); setYears(companies[idx].years.map((y) => y.coPath)); };
  const toggleYear = (coPath) => setYears((cur) => (cur.includes(coPath) ? cur.filter((c) => c !== coPath) : [...cur, coPath]));

  const fail = (e) => { setError(e?.response?.data?.message || e?.message || String(e)); setStep('error'); setBusy(''); };

  /** Read JSM, upload the package, then show what would be imported. */
  const start = async () => {
    try {
      setStep('work'); setPreview(null);
      setBusy('Reading JSM data (this PC only, JSM is not changed)...');
      const ex = await desktop.exportPackage({ install: pick.install, db: pick.db, coPaths: years });
      setExportFile(ex.file);
      setBusy(`Uploading ${(ex.bytes / 1048576).toFixed(1)} MB ...`);
      const run = await migrationApi.createRun('JSM');
      setRunId(run.id);
      const chunks = Math.max(1, Math.ceil(ex.bytes / CHUNK));
      for (let i = 0; i < chunks; i += 1) {
        const bytes = new Uint8Array(await desktop.readChunk(ex.file, i, CHUNK)); // exact-size copy: a view would upload its whole backing buffer
        let sent = false;
        for (let attempt = 0; attempt < 4 && !sent; attempt += 1) {
          try { await migrationApi.uploadChunk(run.id, i, bytes); sent = true; } catch (err) { if (attempt === 3) throw err; await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
        }
        setProg({ upload: i + 1, uploadTotal: chunks });
      }
      const done = await migrationApi.complete(run.id, ex.bytes);
      if (done.status !== 'uploaded') throw new Error(`The upload is incomplete: ${(done.problems || []).join('; ')}`);
      setBusy('Checking the data...');
      const pv = await migrationApi.preview(run.id, years);
      setPreview(pv); setBusy(''); setStep('preview');
      desktop.cleanup(ex.file);
    } catch (e) { fail(e); }
  };

  const apply = async () => {
    try {
      setStep('applying'); setBusy('Importing...');
      await migrationApi.apply(runId, years);
      await new Promise((resolve, reject) => {
        poll.current = setInterval(async () => {
          try {
            const r = await migrationApi.getRun(runId);
            setProg({ stage: r.progress?.stage, done: r.progress?.done, total: r.progress?.total });
            if (r.status === 'applied') { clearInterval(poll.current); resolve(); }
            if (r.status === 'failed') { clearInterval(poll.current); reject(new Error(r.error || 'Import failed; nothing was kept')); }
          } catch (e) { clearInterval(poll.current); reject(e); }
        }, 1500);
      });
      setBusy('Comparing with JSM...');
      setReport(await migrationApi.reconcile(runId));
      setBusy(''); setStep('done');
      reload();
    } catch (e) { fail(e); }
  };

  const undo = async () => {
    if (!(await erpConfirm({ title: 'Undo this import', message: 'All data brought in by this import will be removed from this company. Continue?', confirmLabel: 'Undo import', danger: true }))) return;
    try { setBusy('Removing imported data...'); await migrationApi.undo(runId); setUndone(true); setBusy(''); reload(); toast.success('Import undone'); } catch (e) { fail(e); }
  };

  const downloadCsv = async () => {
    const blob = await migrationApi.reportCsv(runId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'import-reconciliation.csv'; a.click(); URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;
  const mism = report?.checks?.filter((c) => !c.ok) || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from JSM" className="max-w-4xl">
      <div className="p-6 flex flex-col gap-4 text-slate-800 flex-1 min-h-0 overflow-y-auto text-xs">
        {!desktop && (
          <div className="border border-amber-300 bg-amber-50 rounded p-3">
            Import from JSM runs in the <b>Desktop app</b> installed on the computer where JSM is installed. Open the Desktop app there, or use the Excel import for other software.
          </div>
        )}

        {busy && <div className="flex items-center gap-3 border border-blue-200 bg-blue-50 rounded p-3"><span className="animate-spin inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" /> <b>{busy}</b>
          {prog?.table && <span className="text-slate-600">{prog.table} ({prog.doneTables}/{prog.totalTables})</span>}
          {prog?.uploadTotal && <span className="text-slate-600">part {prog.upload}/{prog.uploadTotal}</span>}
          {prog?.stage && <span className="text-slate-600">{prog.stage} {prog.total ? `${prog.done}/${prog.total}` : ''}</span>}</div>}

        {step === 'error' && (
          <div className="border border-rose-300 bg-rose-50 rounded p-3 text-rose-800"><b>Could not continue.</b> {error}
            <div className="mt-2"><button type="button" className="px-3 py-1.5 border border-slate-300 bg-white rounded font-bold" onClick={() => { setStep(found?.ok ? 'select' : 'detect'); setError(''); }}>Back</button></div></div>
        )}

        {step === 'select' && found?.ok && (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] text-slate-600">JSM found in <b>{found.installs[pick.install].folder}</b>. Choose the company to bring into this software. All its years are selected; every bill, voucher, challan and ledger entry is imported.</div>
            {found.installs[pick.install].databases.length > 1 && (
              <label className="flex items-center gap-2 font-bold">Database
                <select className="border rounded px-2 py-1" value={pick.db} onChange={(e) => { const d = found.installs[pick.install].databases.find((x) => x.name === e.target.value); setPick({ ...pick, db: d.name, company: 0 }); setYears(d.companies[0].years.map((y) => y.coPath)); }}>
                  {found.installs[pick.install].databases.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select></label>
            )}
            {companies.map((c, idx) => (
              <div key={c.name + idx} className={`border rounded p-3 ${idx === pick.company ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200'}`}>
                <label className="flex items-center gap-2 font-bold text-sm"><input type="radio" checked={idx === pick.company} onChange={() => choose(idx)} /> {c.name}</label>
                {idx === pick.company && <div className="flex flex-wrap gap-3 mt-2 pl-6">{c.years.map((y) => (
                  <label key={y.coPath} className="flex items-center gap-1"><input type="checkbox" checked={years.includes(y.coPath)} onChange={() => toggleYear(y.coPath)} /> {y.from} to {y.to}</label>))}</div>}
              </div>
            ))}
            <div className="text-[11px] text-slate-500">This company in the software must be new (no bills yet). JSM itself is only read, never changed.</div>
            <div><button type="button" disabled={!years.length} onClick={start} className="px-5 py-2.5 bg-black text-white font-bold rounded uppercase tracking-wider disabled:opacity-50">Read JSM and check</button></div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="flex flex-col gap-3">
            {preview.blockers?.length > 0 && <div className="border border-rose-300 bg-rose-50 rounded p-3 text-rose-800"><b>Cannot import:</b> {preview.blockers.join(' ')}</div>}
            <div className="grid grid-cols-3 gap-2">{Object.entries(preview.counts).filter(([, n]) => n > 0).map(([k, n]) => (
              <div key={k} className="bg-slate-50 border border-slate-200 rounded p-2 text-center"><div className="text-[10px] uppercase font-bold text-slate-500">{COUNT_LABELS[k] || k}</div><div className="text-base font-black">{fmt(n)}</div></div>))}</div>
            <div className="text-[11px] text-slate-600">JSM totals: sales Rs {fmt(preview.expected.totals.salesNet)}, purchase Rs {fmt(preview.expected.totals.purchaseNet)}, receipts Rs {fmt(preview.expected.totals.receipts)}, payments Rs {fmt(preview.expected.totals.payments)}. After the import these are compared with what is saved here.</div>
            {preview.warningCount > 0 && <div className="border border-amber-200 bg-amber-50 rounded p-2 max-h-32 overflow-y-auto text-[10px] text-amber-900"><b>{preview.warningCount} notes</b> (the data is imported; these are things in JSM worth knowing):{preview.warnings.slice(0, 40).map((w, i) => <div key={i}>- {w}</div>)}</div>}
            <div className="flex gap-3"><button type="button" onClick={() => setStep('select')} className="px-4 py-2 border border-slate-300 rounded font-bold">Back</button>
              <button type="button" disabled={preview.blockers?.length > 0} onClick={apply} className="px-5 py-2.5 bg-black text-white font-bold rounded uppercase tracking-wider disabled:opacity-50">Import everything</button></div>
          </div>
        )}

        {step === 'done' && report && (
          <div className="flex flex-col gap-3">
            {undone ? <div className="border border-slate-300 bg-slate-50 rounded p-3"><b>The import was undone.</b> The company is as it was before.</div> : (
              <div className={`border rounded p-3 ${report.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                <b>{report.ok ? 'Import complete: everything matches JSM.' : `Import complete: ${report.mismatched} of ${report.total} checks differ from JSM.`}</b>
                <div>{report.matched} of {report.total} checks match (counts, totals, every account balance, every party's outstanding).</div></div>)}
            {mism.length > 0 && <div className="border border-rose-200 rounded max-h-48 overflow-auto"><table className="w-full text-[10px]"><thead className="bg-slate-100"><tr><th className="p-1 text-left">Area</th><th className="p-1 text-left">Item</th><th className="p-1 text-right">JSM</th><th className="p-1 text-right">Here</th><th className="p-1 text-right">Difference</th></tr></thead>
              <tbody>{mism.map((c, i) => <tr key={i} className="border-t"><td className="p-1">{c.area}</td><td className="p-1">{c.key}</td><td className="p-1 text-right">{fmt(c.jsm)}</td><td className="p-1 text-right">{fmt(c.mern)}</td><td className="p-1 text-right font-bold text-rose-700">{fmt(c.diff)}</td></tr>)}</tbody></table></div>}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadCsv} className="px-4 py-2 border border-slate-300 rounded font-bold">Download full comparison (CSV)</button>
              {!undone && <button type="button" onClick={undo} className="px-4 py-2 border border-rose-400 text-rose-700 rounded font-bold">Undo this import</button>}
              <button type="button" onClick={onClose} className="px-5 py-2 bg-blue-600 text-white rounded font-bold uppercase tracking-wider">Done</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
