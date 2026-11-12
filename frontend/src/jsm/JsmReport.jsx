import React, { useEffect, useRef, useState } from 'react';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import JsmFormDialog from './JsmFormDialog';
import JsmGridReport from './JsmGridReport';
import JsmGridReportsTwoColumn from './JsmGridReportsTwoColumn';
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
  // `today` is for the screens JSM opens on the current date rather than on the year's range
  // (its "AsOn Date" and "Current Date" boxes).
  return {
    fyFrom: toDisplayDate(`${y}-04-01`),
    fyTo: toDisplayDate(`${y + 1}-03-31`),
    today: toDisplayDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`),
  };
}

export function hasJsmReport(formName) {
  return Boolean(JSM_REPORTS[formName]);
}

/** A JSM report: its parameter screen, then JSM's "Report Control" grid. */
export default function JsmReport({ formName, isOpen, onClose, companyName = '', onOpenRow }) {
  const config = JSM_REPORTS[formName];
  // Two menu entries can share one JSM form (a register's Summary and Detail): the config then
  // names which blueprint screen to draw and which backend report to ask.
  const screenForm = config?.blueprintForm || formName;
  const apiForm = config?.apiForm || formName;
  const [blueprint, setBlueprint] = useState(null);
  const [lists, setLists] = useState({});
  const [rawOptions, setRawOptions] = useState({});
  const [state, setState] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !config) return;
    let live = true;
    setResult(null);
    setError('');
    setState(config.defaults(financialYear()));
    loadBlueprint().then((bp) => live && setBlueprint(bp));
    jsmReportApi.options(apiForm)
      .then((opts) => {
        if (!live) return;
        setRawOptions(opts || {});
        const next = {};
        for (const [lv, key] of Object.entries(config.lists || {})) next[lv] = opts?.[key] || [];
        setLists(next);
      })
      .catch((e) => live && setError(e?.message || 'Could not load lists'));
    return () => { live = false; };
  }, [isOpen, formName, config, apiForm]);

  if (!isOpen || !config) return null;
  const form = blueprint?.forms?.[screenForm];
  // A few screens swap a list on a radio button (Account / Acc Head): the config picks it from the state.
  const shownLists = config.dynamicLists ? { ...lists, ...config.dynamicLists(state, rawOptions) } : lists;

  const activeListView = () => {
    const tabControl = form?.controls.find((c) => c.type === 'TabControl');
    const page = state[`${tabControl?.name}.__tab`]
      || form?.controls.filter((c) => c.type === 'TabPage' && c.parent === tabControl?.name)
        .sort((a, b) => Number(a.name.match(/(\d+)$/)?.[1] ?? 999) - Number(b.name.match(/(\d+)$/)?.[1] ?? 999))[0]?.name;
    return form?.controls.find((c) => c.type === 'ListView' && c.parent === page)?.name;
  };

  // Most JSM report screens name their two buttons btn_screen and btn_exit; a few name them
  // something else (the Job P&L grid has Btn_Refresh / Btn_Exit), and those configs say so.
  const runButtons = config.runButtons || ['btn_screen'];
  const exitButtons = config.exitButtons || ['btn_exit'];
  const excelButtons = config.excelButtons || [];
  const browseButtons = config.browseButtons || [];

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || typeof config.onBrowseFile !== 'function') return;
    setBusy(true);
    setError('');
    try {
      const patch = await config.onBrowseFile(file, state);
      setState((s) => ({ ...s, ...(patch || {}) }));
    } catch (err) {
      setError(err?.message || 'Could not read selected file');
    } finally {
      setBusy(false);
    }
  };

  const onButton = async (name, value) => {
    if (exitButtons.includes(name)) { onClose?.(); return; }
    if (browseButtons.includes(name)) { fileInputRef.current?.click(); return; }
    if (name === 'Check_Select_UnSelectAll') {
      const lv = activeListView();
      if (lv) setState((s) => ({ ...s, [lv]: value ? [...(shownLists[lv] || [])] : [] }));
      return;
    }
    if (excelButtons.includes(name) && typeof config.onExcel === 'function') {
      setBusy(true);
      setError('');
      try {
        const res = result || await jsmReportApi.run(apiForm, config.toParams(state));
        config.onExcel(res, state, companyName);
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || 'Excel export failed');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (runButtons.includes(name)) {
      setBusy(true);
      setError('');
      try {
        const params = config.toParams(state, name);
        const invoke = config.method === 'POST' ? jsmReportApi.runPost : jsmReportApi.run;
        setResult(await invoke(apiForm, params));
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || 'Report failed');
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <>
      {browseButtons.length > 0 && (
        <input
          ref={fileInputRef}
          type="file"
          accept={config.browseAccept || '.xlsx,.xlsm,.xls,.json,.txt'}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}
      <ErpWindowedModal
        isOpen={!result}
        onClose={onClose}
        title={config.title || form?.title || 'Report'}
        windowId={`jsm-${formName}`}
        initialSize={form?.width && form?.height ? { w: form.width + 24, h: form.height + 56 } : undefined}
      >
        {({ WindowControls }) => (
          <div className="jsm-window">
            <div className="jsm-titlebar">
              <span>{config.title || form?.runtimeTitle || form?.title}</span>
              <WindowControls />
            </div>
            {error && <div className="jsm-error">{error}</div>}
            {form ? (
              <JsmFormDialog
                form={form}
                state={state}
                onChange={setState}
                lists={shownLists}
                onButton={onButton}
                busy={busy}
                overrides={config.overrides ? config.overrides(state) : undefined}
              />
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
              {config.renderer === 'twoColumn' ? (
                <JsmGridReportsTwoColumn
                  result={result}
                  companyName={companyName}
                  onClose={() => setResult(null)}
                />
              ) : (
                <JsmGridReport
                  result={result}
                  layouts={blueprint?.layouts}
                  fallbackColumns={config.fallbackColumns}
                  companyName={companyName}
                  onClose={() => setResult(null)}
                  onOpenRow={onOpenRow}
                  onExcel={config.onExcel ? (res) => { config.onExcel(res, state, companyName); return true; } : undefined}
                />
              )}
            </div>
          </div>
        )}
      </ErpWindowedModal>
    </>
  );
}
