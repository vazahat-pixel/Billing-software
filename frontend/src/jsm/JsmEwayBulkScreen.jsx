import React, { useEffect, useMemo, useState } from 'react';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import JsmFormDialog from './JsmFormDialog';
import { jsmReportApi } from '../api/jsmReport.api';
import { buildEwayBulkJson } from '../utils/ewayBulkJson';
import { toast } from '../store/useToastStore';
import { notifyError } from '../utils/notify';
import { toDisplayDate, toIsoDate } from './winforms';
import './jsm.css';

/**
 * JSM: Reports > Gst Reports > E-Way Bill Bulk Generation (Eway_Billing_Bulk).
 * The captured form is drawn as is. Load Data lists the book's sales bills in JSM's 41 columns,
 * Check Error lists bills still missing a value NIC requires, and Generating E-WAY Bulk Json
 * downloads the file to upload on the e-way bill portal. The buttons that drive NIC's own website
 * inside JSM (login, Part-B, transporter...) need a portal session and say so.
 */
const FORM = 'Eway_Billing_Bulk';
const PORTAL_BUTTONS = new Set([
  'btn_ewy_web', 'Btn_Download_Eway', 'btn_login_details', 'btn_brows_online', 'btn_part_b', 'btn_transporter', 'Button2', 'Button1',
]);

let blueprintPromise;
const loadForms = () => {
  blueprintPromise ||= import('./blueprint/forms.json').then((m) => m.default);
  return blueprintPromise;
};

const keyOf = (label) => String(label).replace('*', '').trim().replace(/[. ]+/g, '_');

export default function JsmEwayBulkScreen({ isOpen, onClose }) {
  const [forms, setForms] = useState(null);
  const [state, setState] = useState({});
  const [books, setBooks] = useState(['All']);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    setRows([]);
    setState({
      txt_dt_from: toDisplayDate(`${y}-04-01`),
      txt_dt_to: toDisplayDate(now.toISOString().slice(0, 10)),
      cbo_book_select: 'All',
    });
    loadForms().then(setForms);
    jsmReportApi.options(FORM).then((o) => setBooks(o?.books?.length ? o.books : ['All'])).catch(() => {});
  }, [isOpen]);

  const form = forms?.[FORM];

  const grids = useMemo(() => {
    if (!form) return {};
    const cols = form.controls
      .filter((c) => c.type === 'ColumnHeader' && c.parent === 'ListView1')
      .sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0))
      .map((c) => ({ key: keyOf(c.text), label: c.text, width: 90 }));
    return { ListView1: { columns: cols, rows } };
  }, [form, rows]);

  if (!isOpen) return null;

  const params = (extra = {}) => ({
    from: toIsoDate(state.txt_dt_from),
    to: toIsoDate(state.txt_dt_to),
    book: state.cbo_book_select || 'All',
    ...extra,
  });

  const run = async (name) => {
    if (name === 'btn_exit') { onClose?.(); return; }
    if (PORTAL_BUTTONS.has(name)) {
      toast.info('This needs your e-way bill portal login. Generate the JSON here and upload it on ewaybillgst.gov.in.');
      return;
    }
    if (!['Btn_ok', 'btn_error_check', 'txt_pre_json', 'btn_e_way_json'].includes(name)) return;
    setBusy(true);
    try {
      const res = await jsmReportApi.run(FORM, params({ checkError: name === 'btn_error_check' }));
      setRows(res.rows || []);
      if (name === 'btn_error_check') {
        const errs = res.errors || [];
        if (!errs.length) toast.success('No errors found');
        else toast.error(`${errs.length} bill(s) need attention: ${errs.slice(0, 3).map((e) => `${e.DOC_NO} - ${e.ERROR}`).join('; ')}`);
      } else if (name === 'Btn_ok') {
        if (!(res.rows || []).length) toast.info('No bills found for this period');
      } else {
        if (!(res.rows || []).length) { toast.info('Load Data first - no bills to write'); return; }
        const blob = new Blob([JSON.stringify(buildEwayBulkJson(res.itemRows || res.rows), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `EWAY_BULK_${params().from}_${params().to}.json`;
        a.click();
        toast.success('E-way bulk JSON downloaded');
      }
    } catch (e) {
      notifyError(e, 'E-Way Bill Bulk Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const overrides = {
    cbo_book_select: { items: books },
    btn_forward: { visible: false },
    btn_back: { visible: false },
    ProgressBar1: { visible: false },
  };

  return (
    <ErpWindowedModal
      isOpen
      onClose={onClose}
      title="E-Way Bill Bulk Generation"
      windowId={`jsm-${FORM}`}
      initialSize={form?.width && form?.height ? { w: form.width + 24, h: form.height + 56 } : undefined}
    >
      {({ WindowControls }) => (
        <div className="jsm-window">
          <div className="jsm-titlebar">
            <span>E-Way Bill Bulk Generation</span>
            <WindowControls />
          </div>
          {form ? (
            <JsmFormDialog form={form} state={state} onChange={setState} onButton={run} busy={busy} grids={grids} overrides={overrides} />
          ) : (
            <div style={{ padding: 16 }}>Loading…</div>
          )}
        </div>
      )}
    </ErpWindowedModal>
  );
}
