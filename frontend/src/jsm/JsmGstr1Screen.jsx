import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import JsmFormDialog from './JsmFormDialog';
import { GSTR1_COLS_MAP, flatGstr1 } from '../pages/gst/Gstr1JsmReport';
import { exportGstr1TemplateExcel } from '../utils/gstr1TemplateExport';
import useStore from '../store/useStore';
import { toast } from '../store/useToastStore';
import { notifyError } from '../utils/notify';
import { toDisplayDate, toIsoDate } from './winforms';
import './jsm.css';

/**
 * JSM's GSTR-1 screens (Rpt_Jsm_GSTR1_*): the form is drawn from the captured blueprint (same
 * positions, tabs and buttons), LoadData fills the tab grids from this software's GSTR-1 data and
 * Generate Excel writes the offline-utility workbook of that version (v1.7 / v1.9 / v2.0).
 */
const FORMS = {
  Rpt_Jsm_GSTR1_3_2_2: { version: 'v3_2_2' },
  Rpt_Jsm_GSTR1_Old2_0_GovAllExcel: { version: 'v2_0' },
  Rpt_Jsm_GSTR1_1_8_GovAllExcel: { version: 'v1_9' },
  Rpt_Jsm_GSTR1_7_GovAllExcel: { version: 'v1_7' },
  Rpt_Jsm_GSTR1_1x_8_GovAllExcel_Old: { version: 'v1_9' },
};
export const hasJsmGstr1 = (name) => Boolean(FORMS[name]);

// JSM's grid names -> the tab keys of the data helpers.
const GRID_TAB = {
  b2b: 'B2B', b2cl: 'B2CL', b2cs: 'B2CS', cdnr: 'CDNR', cdnur: 'CDNU', hsn: 'HSN', hsn_b2cs: 'HSN B2C',
  docs: 'DOCS', exp: 'EXP', exemp: 'EXEMP',
};

let blueprintPromise;
const loadForms = () => {
  blueprintPromise ||= import('./blueprint/forms.json').then((m) => m.default);
  return blueprintPromise;
};

const financialYearStart = (now = new Date()) => (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1);

export default function JsmGstr1Screen({ formName, isOpen, onClose, onOpenInvoice }) {
  const cfg = FORMS[formName];
  const fetchGstr1 = useStore((s) => s.fetchGstr1);
  const [forms, setForms] = useState(null);
  const [state, setState] = useState({});
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !cfg) return;
    const y = financialYearStart();
    setData(null);
    setState({
      txt_dt_from: toDisplayDate(`${y}-04-01`),
      txt_dt_to: toDisplayDate(new Date().toISOString().slice(0, 10)),
      CHK_GstSlabWise: true,
      RdBtn_UnitWise: true,
      BtnRdo_Regular: true,
      Cbo_OrderBy1: 'GSTR-1',
    });
    loadForms().then(setForms);
  }, [isOpen, formName, cfg]);

  const form = forms?.[formName];

  const grids = useMemo(() => {
    if (!form) return {};
    const out = {};
    for (const c of form.controls) {
      if (!/DataGridView$/.test(c.type)) continue;
      const tab = GRID_TAB[c.name.replace(/^dgv_/i, '').toLowerCase()];
      if (!tab) continue;
      const rows = data ? flatGstr1(data, tab) : [];
      const columns = (GSTR1_COLS_MAP[tab] || []).map((k) => ({ key: k.key, label: k.label, width: k.w, num: k.num, fmt: k.fmt }));
      const sales = ['B2B', 'B2CL', 'B2CS'].includes(tab) && onOpenInvoice;
      out[c.name] = { columns, rows, onRowClick: sales ? (r) => r.invoiceNo && onOpenInvoice(r.invoiceNo) : undefined };
    }
    return out;
  }, [form, data, onOpenInvoice]);

  if (!isOpen || !cfg) return null;

  const run = async (name) => {
    if (name === 'btn_exit') { onClose?.(); return; }
    if (name === 'Btn_LoadData') {
      const from = toIsoDate(state.txt_dt_from);
      const to = toIsoDate(state.txt_dt_to);
      if (!from || !to) { toast.info('Enter a valid From and To date'); return; }
      setBusy(true);
      try { setData(await fetchGstr1(from, to)); } catch (e) { notifyError(e, 'GSTR-1 load failed'); } finally { setBusy(false); }
      return;
    }
    if (name === 'Btn_ExcelGstr1') {
      if (!data) { toast.info('Click LoadData first'); return; }
      const p = data.payload || data;
      const stamp = `${toIsoDate(state.txt_dt_from)}_${toIsoDate(state.txt_dt_to)}`;
      try {
        if (cfg.version) {
          exportGstr1TemplateExcel(p, cfg.version, `GSTR1_${cfg.version}_${stamp}.xlsx`);
        } else {
          // No offline template is captured for v3.2.2: one sheet per tab with JSM's grid columns.
          const wb = XLSX.utils.book_new();
          for (const [tab, cols] of Object.entries(GSTR1_COLS_MAP)) {
            const rows = flatGstr1(data, tab);
            const aoa = [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => (c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? ''))))];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), tab.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 31));
          }
          XLSX.writeFile(wb, `GSTR1_${stamp}.xlsx`);
        }
        toast.success('Excel file downloaded');
      } catch (e) { notifyError(e, 'Excel export failed'); }
      return;
    }
    if (name === 'Btn_Kill_Excel') { toast.info('No Excel process running'); return; }
    if (name === 'Btn_EmailSend') { toast.info('Email is not configured'); return; }
    if (name === 'Btn_Power_gst') toast.info('Power GST is not available in this software');
  };

  return (
    <ErpWindowedModal
      isOpen
      onClose={onClose}
      title={form?.title || 'GSTR-1'}
      windowId={`jsm-${formName}`}
      initialSize={form?.width && form?.height ? { w: form.width + 24, h: form.height + 56 } : undefined}
    >
      {({ WindowControls }) => (
        <div className="jsm-window">
          <div className="jsm-titlebar">
            <span>{form?.title || 'GSTR-1'}</span>
            <WindowControls />
          </div>
          {form ? (
            <JsmFormDialog form={form} state={state} onChange={setState} onButton={run} busy={busy} grids={grids} overrides={{ lbl_Progress: { text: '', visible: false } }} />
          ) : (
            <div style={{ padding: 16 }}>Loading…</div>
          )}
        </div>
      )}
    </ErpWindowedModal>
  );
}
