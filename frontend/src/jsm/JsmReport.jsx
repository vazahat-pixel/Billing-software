import React, { useEffect, useState } from 'react';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import JsmFormDialog from './JsmFormDialog';
import JsmGridReport from './JsmGridReport';
import { JSM_REPORTS } from './reports';
import { jsmReportApi } from '../api/jsmReport.api';
import { toDisplayDate } from './winforms';
import './jsm.css';

let blueprintPromise;
const loadBlueprint = () => {
  blueprintPromise ||= Promise.all([import('./blueprint/forms.json'), import('./blueprint/layouts.json')])
    .then(([f, l]) => ({ forms: f.default, layouts: l.default }));
  return blueprintPromise;
};

function financialYear(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { fyFrom: toDisplayDate(`${y}-04-01`), fyTo: toDisplayDate(`${y + 1}-03-31`) };
}

export function hasJsmReport(formName) {
  return Boolean(JSM_REPORTS[formName]);
}

/** A JSM report: its parameter screen, then JSM's "Report Control" grid. */
export default function JsmReport({ formName, isOpen, onClose, companyName = '', onOpenRow }) {
  const config = JSM_REPORTS[formName];
  const [blueprint, setBlueprint] = useState(null);
  const [lists, setLists] = useState({});
  const [state, setState] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !config) return;
    let live = true;
    setResult(null);
    setError('');
    setState(config.defaults(financialYear()));
    loadBlueprint().then((bp) => live && setBlueprint(bp));
    jsmReportApi.options(formName)
      .then((opts) => {
        if (!live) return;
        const next = {};
        for (const [lv, key] of Object.entries(config.lists || {})) next[lv] = opts?.[key] || [];
        setLists(next);
      })
      .catch((e) => live && setError(e?.message || 'Could not load lists'));
    return () => { live = false; };
  }, [isOpen, formName, config]);

  if (!isOpen || !config) return null;
  const form = blueprint?.forms?.[formName];

  const activeListView = () => {
    const tabControl = form?.controls.find((c) => c.type === 'TabControl');
    const page = state[`${tabControl?.name}.__tab`]
      || form?.controls.filter((c) => c.type === 'TabPage' && c.parent === tabControl?.name)
        .sort((a, b) => Number(a.name.match(/(\d+)$/)?.[1] ?? 999) - Number(b.name.match(/(\d+)$/)?.[1] ?? 999))[0]?.name;
    return form?.controls.find((c) => c.type === 'ListView' && c.parent === page)?.name;
  };

  const onButton = async (name, value) => {
    if (name === 'btn_exit') { onClose?.(); return; }
    if (name === 'Check_Select_UnSelectAll') {
      const lv = activeListView();
      if (lv) setState((s) => ({ ...s, [lv]: value ? [...(lists[lv] || [])] : [] }));
      return;
    }
    if (name === 'btn_screen') {
      setBusy(true);
      setError('');
      try {
        setResult(await jsmReportApi.run(formName, config.toParams(state)));
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || 'Report failed');
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <>
      <ErpWindowedModal
        isOpen={!result}
        onClose={onClose}
        title={form?.title || 'Report'}
        windowId={`jsm-${formName}`}
        initialSize={form?.width && form?.height ? { w: form.width + 24, h: form.height + 56 } : undefined}
      >
        {({ WindowControls }) => (
          <div className="jsm-window">
            <div className="jsm-titlebar">
              <span>{form?.runtimeTitle || form?.title}</span>
              <WindowControls />
            </div>
            {error && <div className="jsm-error">{error}</div>}
            {form ? (
              <JsmFormDialog form={form} state={state} onChange={setState} lists={lists} onButton={onButton} busy={busy} />
            ) : (
              <div style={{ padding: 16 }}>Loading…</div>
            )}
          </div>
        )}
      </ErpWindowedModal>
      <ErpWindowedModal
        isOpen={Boolean(result)}
        onClose={() => setResult(null)}
        title="Report Control"
        windowId={`jsm-grid-${formName}`}
        defaultMode="maximized"
      >
        {({ WindowControls }) => (
          <div className="jsm-window" style={{ height: '100%' }}>
            <div className="jsm-titlebar">
              <span>Report Control</span>
              <WindowControls />
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <JsmGridReport
                result={result}
                layouts={blueprint?.layouts}
                fallbackColumns={config.fallbackColumns}
                companyName={companyName}
                onClose={() => setResult(null)}
                onOpenRow={onOpenRow}
              />
            </div>
          </div>
        )}
      </ErpWindowedModal>
    </>
  );
}
