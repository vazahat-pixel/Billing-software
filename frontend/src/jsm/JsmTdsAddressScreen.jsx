import React, { useEffect, useState } from 'react';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import JsmFormDialog from './JsmFormDialog';
import { jsmReportApi } from '../api/jsmReport.api';
import { toast } from '../store/useToastStore';
import { notifyError } from '../utils/notify';
import './jsm.css';

/**
 * JSM: Reports › Tds Reports › Address/Acknowledge (Rpt_Tds3_Add_Ackn).
 * The captured form: CIT address and the four quarterly acknowledgement numbers, Save / Cancel.
 */
const FORM = 'Rpt_Tds3_Add_Ackn';

let blueprintPromise;
const loadForms = () => {
  blueprintPromise ||= import('./blueprint/forms.json').then((m) => m.default);
  return blueprintPromise;
};

export default function JsmTdsAddressScreen({ isOpen, onClose }) {
  const [forms, setForms] = useState(null);
  const [state, setState] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadForms().then(setForms);
    jsmReportApi.runPost(FORM, { action: 'load' })
      .then((res) => {
        const r = res.rows?.[0] || {};
        setState({ Rtxt_add: r.TDS_ADDR || '', txt_q1: r.TDS_Q1 || '', txt_q2: r.TDS_Q2 || '', txt_q3: r.TDS_Q3 || '', txt_q4: r.TDS_Q4 || '' });
      })
      .catch((e) => notifyError(e, 'Could not load the saved details'));
  }, [isOpen]);

  const form = forms?.[FORM];
  if (!isOpen) return null;

  const run = async (name) => {
    if (name === 'btn_cancel') { onClose?.(); return; }
    if (name !== 'btn_save') return;
    setBusy(true);
    try {
      const res = await jsmReportApi.runPost(FORM, {
        action: 'save', TDS_ADDR: state.Rtxt_add || '', TDS_Q1: state.txt_q1 || '', TDS_Q2: state.txt_q2 || '', TDS_Q3: state.txt_q3 || '', TDS_Q4: state.txt_q4 || '',
      });
      toast.success(res.message || 'Record saved...');
    } catch (e) {
      notifyError(e, 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpWindowedModal
      isOpen
      onClose={onClose}
      title={form?.title || 'Tds Address & Acknowledgement'}
      windowId={`jsm-${FORM}`}
      initialSize={form?.width && form?.height ? { w: form.width + 24, h: form.height + 56 } : undefined}
    >
      {({ WindowControls }) => (
        <div className="jsm-window">
          <div className="jsm-titlebar">
            <span>{form?.title || 'Tds Address & Acknowledgement'}</span>
            <WindowControls />
          </div>
          {form ? <JsmFormDialog form={form} state={state} onChange={setState} onButton={run} busy={busy} /> : <div style={{ padding: 16 }}>Loading…</div>}
        </div>
      )}
    </ErpWindowedModal>
  );
}
