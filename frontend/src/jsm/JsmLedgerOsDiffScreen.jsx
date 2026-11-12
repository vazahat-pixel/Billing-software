import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import JsmFormDialog from './JsmFormDialog';
import { jsmReportApi } from '../api/jsmReport.api';
import { toast } from '../store/useToastStore';
import { notifyError } from '../utils/notify';
import './jsm.css';

/**
 * JSM: Reports › Final Reports › Check Diff Os/Ledger Cur.Year (Rpt_Jsm_Ledger_os_Diff_Check).
 * The captured form: Book type, Generate (fills the grid on the form itself), Excel and Exit.
 */
const FORM = 'Rpt_Jsm_Ledger_os_Diff_Check';
const n2 = (v) => (Number(v) || 0).toFixed(2);
const COLUMNS = [
  { key: 'AC_NAME', label: 'PARTY', width: 380 },
  { key: 'LED_BAL', label: 'LEDGER BAL', width: 110, num: true, fmt: n2 },
  { key: 'OS_BAL', label: 'O/S BAL', width: 110, num: true, fmt: n2 },
  { key: 'BAL_OS_AMT', label: 'DIFFERENCE', width: 110, num: true, fmt: n2 },
];

let blueprintPromise;
const loadForms = () => {
  blueprintPromise ||= import('./blueprint/forms.json').then((m) => m.default);
  return blueprintPromise;
};

export default function JsmLedgerOsDiffScreen({ isOpen, onClose }) {
  const [forms, setForms] = useState(null);
  const [state, setState] = useState({});
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRows([]);
    setState({ Cbo_BookType: 'Sales' });
    loadForms().then(setForms);
  }, [isOpen]);

  const form = forms?.[FORM];
  const grids = useMemo(() => ({ Dgv1: { columns: COLUMNS, rows } }), [rows]);
  if (!isOpen) return null;

  const run = async (name) => {
    if (name === 'btn_exit') { onClose?.(); return; }
    if (name === 'Btn_Generate') {
      setBusy(true);
      try {
        const res = await jsmReportApi.run(FORM, { book: state.Cbo_BookType || 'Sales' });
        setRows(res.rows || []);
        if (!(res.rows || []).length) toast.info('No difference found');
      } catch (e) {
        notifyError(e, 'Could not generate the report');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (name === 'Js1_Button1') {
      if (!rows.length) { toast.info('Generate first'); return; }
      const aoa = [COLUMNS.map((c) => c.label), ...rows.map((r) => COLUMNS.map((c) => r[c.key]))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Ledger And Os Diff');
      XLSX.writeFile(wb, `Ledger_Os_Diff_${state.Cbo_BookType || 'Sales'}.xlsx`);
    }
  };

  return (
    <ErpWindowedModal
      isOpen
      onClose={onClose}
      title={form?.title || 'Ledger And O/s. Diffrance'}
      windowId={`jsm-${FORM}`}
      initialSize={form?.width && form?.height ? { w: form.width + 24, h: form.height + 56 } : undefined}
    >
      {({ WindowControls }) => (
        <div className="jsm-window">
          <div className="jsm-titlebar">
            <span>{form?.title || 'Ledger And O/s. Diffrance'}</span>
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
