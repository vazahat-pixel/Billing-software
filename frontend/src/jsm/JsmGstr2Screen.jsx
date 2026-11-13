import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import JsmFormDialog from './JsmFormDialog';
import { jsmReportApi } from '../api/jsmReport.api';
import { toast } from '../store/useToastStore';
import { notifyError } from '../utils/notify';
import { toDisplayDate, toIsoDate } from './winforms';
import './jsm.css';

/**
 * JSM: Reports > Gst Reports > Gstr-2 Report > Gstr2 Excel Format (Rpt_Jsm_GSTR2_AllExcel).
 * The captured form is drawn as is; LoadData fills its seven grids and the GSTR-2 button writes them
 * as one workbook, a sheet per grid.
 */
const FORM = 'Rpt_Jsm_GSTR2_AllExcel';

const n = (key, label, width = 90) => ({ key, label, width, num: true, fmt: (v) => Number(v || 0).toFixed(2) });
const t = (key, label, width = 90) => ({ key, label, width });
const TAX = [n('TAX_RATE', 'Rate', 50), n('TAXABLE_AMT', 'Taxable Value'), n('IGST_AMT', 'Integrated Tax'), n('CGST_AMT', 'Central Tax'), n('SGST_AMT', 'State/UT Tax'), n('CESS', 'Cess', 60)];

const SHEETS = {
  Dgv_B2B: ['B2B', [t('GSTIN_NO', 'GSTIN of Supplier', 130), t('PARTY', 'Party', 140), t('NCBILL_NO', 'Invoice Number', 90), t('BILL_DATE', 'Invoice date', 80),
    n('INV_AMT', 'Invoice Value'), t('STATE_NAME', 'Place Of Supply', 100), t('RVRS_CHRG_YN', 'Reverse Charge', 60), t('INV_TYPE', 'Invoice Type', 70), ...TAX, t('E_ITC', 'Eligibility For ITC', 80)]],
  Dgv_B2BUR: ['B2BUR', [t('PARTY', 'Supplier Name', 140), t('NCBILL_NO', 'Invoice Number', 90), t('BILL_DATE', 'Invoice date', 80), n('INV_AMT', 'Invoice Value'),
    t('STATE_NAME', 'Place Of Supply', 100), t('SUPPLY_TYPE', 'Supply Type', 80), ...TAX, t('E_ITC', 'Eligibility For ITC', 80)]],
  Dgv_CDNR: ['CDNR', [t('GSTIN_NO', 'GSTIN of Supplier', 130), t('PARTY', 'Party', 140), t('NOTE_NO', 'Note Number', 90), t('NOTE_DATE', 'Note date', 80), t('NOTE_TYPE', 'Document Type', 70),
    t('STATE_NAME', 'Place Of Supply', 100), ...TAX, n('NET_TOT', 'Note Value')]],
  Dgv_CDNUR: ['CDNUR', [t('PARTY', 'Supplier Name', 140), t('NOTE_NO', 'Note Number', 90), t('NOTE_DATE', 'Note date', 80), t('NOTE_TYPE', 'Document Type', 70),
    t('STATE_NAME', 'Place Of Supply', 100), ...TAX, n('NET_TOT', 'Note Value')]],
  Dgv_EXEMP: ['EXEMP', [t('DESCRIPTION', 'Description', 160), n('NIL_RATED', 'Nil Rated Supplies', 110), n('EXEMPTED', 'Exempted (other than nil rated/non GST supply)', 150), n('NON_GST', 'Non-GST supplies', 110)]],
  Dgv_HSN: ['HSN', [t('HSN_CODE', 'HSN', 80), t('UNIT_NAME', 'UQC', 60), n('IT_QTY', 'Total Quantity'), n('VALUE', 'Total Value'), n('TAXABLE_AMT', 'Taxable Value'),
    n('IGST_AMT', 'Integrated Tax'), n('CGST_AMT', 'Central Tax'), n('SGST_AMT', 'State/UT Tax')]],
  DGV_RETURN: ['RETURN', [t('MONTH', 'Month', 80), t('YEAR_NO', 'Year', 60), n('BILLS', 'Bills', 60), n('TAXABLE_AMT', 'Taxable Value'), n('IGST_AMT', 'Integrated Tax'),
    n('CGST_AMT', 'Central Tax'), n('SGST_AMT', 'State/UT Tax'), n('NET_TOT', 'Invoice Value')]],
};

let blueprintPromise;
const loadForms = () => {
  blueprintPromise ||= import('./blueprint/forms.json').then((m) => m.default);
  return blueprintPromise;
};

export default function JsmGstr2Screen({ isOpen, onClose }) {
  const [forms, setForms] = useState(null);
  const [state, setState] = useState({});
  const [sheets, setSheets] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    setSheets(null);
    setState({
      txt_dt_from: toDisplayDate(`${y}-04-01`),
      txt_dt_to: toDisplayDate(now.toISOString().slice(0, 10)),
      Cbo_OrderBy1: 'GSTR-2',
      Rd_Excel: true,
      RdBtn_HsnCode: true,
    });
    loadForms().then(setForms);
  }, [isOpen]);

  const form = forms?.[FORM];

  const grids = useMemo(() => {
    if (!form) return {};
    const out = {};
    for (const c of form.controls) {
      const def = SHEETS[c.name];
      if (def) out[c.name] = { columns: def[1], rows: sheets?.[def[0]] || [] };
    }
    return out;
  }, [form, sheets]);

  if (!isOpen) return null;

  const run = async (name) => {
    if (name === 'btn_exit') { onClose?.(); return; }
    if (name === 'Btn_LoadData') {
      const from = toIsoDate(state.txt_dt_from);
      const to = toIsoDate(state.txt_dt_to);
      if (!from || !to) { toast.info('Enter a valid From and To date'); return; }
      setBusy(true);
      try {
        const res = await jsmReportApi.run(FORM, { from, to, fromText: state.txt_dt_from, toText: state.txt_dt_to });
        setSheets(res?.sheets || {});
      } catch (e) { notifyError(e, 'GSTR-2 load failed'); } finally { setBusy(false); }
      return;
    }
    if (name === 'Btn_Gstr2') {
      if (!sheets) { toast.info('Click LoadData first'); return; }
      try {
        const wb = XLSX.utils.book_new();
        for (const [sheetName, cols] of Object.values(SHEETS)) {
          const aoa = [cols.map((c) => c.label), ...(sheets[sheetName] || []).map((r) => cols.map((c) => r[c.key] ?? ''))];
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName.toLowerCase());
        }
        XLSX.writeFile(wb, `GSTR2_${toIsoDate(state.txt_dt_from)}_${toIsoDate(state.txt_dt_to)}.xlsx`);
        toast.success('Excel file downloaded');
      } catch (e) { notifyError(e, 'Excel export failed'); }
      return;
    }
    if (name === 'Btn_EmailSend') toast.info('Email is not configured');
  };

  return (
    <ErpWindowedModal
      isOpen
      onClose={onClose}
      title={form?.title || 'GSTR-2'}
      windowId={`jsm-${FORM}`}
      initialSize={form?.width && form?.height ? { w: form.width + 24, h: form.height + 56 } : undefined}
    >
      {({ WindowControls }) => (
        <div className="jsm-window">
          <div className="jsm-titlebar">
            <span>{form?.title || 'GSTR-2'}</span>
            <WindowControls />
          </div>
          {form ? (
            <JsmFormDialog form={form} state={state} onChange={setState} onButton={run} busy={busy} grids={grids} />
          ) : (
            <div style={{ padding: 16 }}>Loading…</div>
          )}
        </div>
      )}
    </ErpWindowedModal>
  );
}
