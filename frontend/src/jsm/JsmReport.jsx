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

  // Some JSM tabs (Salesman, Area, MSME Type, ...) hold a tick-list this software has no data for. Drawn
  // as is, they are empty boxes with dead checkboxes, so such a tab is left out — but only when it holds
  // nothing except lists we do not fill, and never the last tab standing.
  const deadTabs = (() => {
    if (!form) return {};
    const wired = new Set(Object.keys(config.lists || {}));
    if (config.dynamicLists) Object.keys(config.dynamicLists(state, rawOptions) || {}).forEach((k) => wired.add(k));
    const byName = new Map(form.controls.map((c) => [c.name, c]));
    const byParent = new Map();
    for (const c of form.controls) {
      if (!byParent.has(c.parent)) byParent.set(c.parent, []);
      byParent.get(c.parent).push(c);
    }
    const under = (name) => (byParent.get(name) || []).flatMap((k) => [k, ...under(k.name)]);
    const isList = (c) => c.type === 'ListView' || /DataGridView$/.test(c.type);
    const inert = /^(Label|Panel|GroupBox|TabPage|ColumnHeader|ToolTip)$|ColumnHeader|DataGridView.+Column/;
    const hidden = {};
    for (const tab of form.controls.filter((c) => c.type === 'TabControl')) {
      const pages = (byParent.get(tab.name) || []).filter((c) => c.type === 'TabPage' && c.visible !== false && c.runtime?.visible !== false);
      const dead = pages.filter((p) => {
        const kids = under(p.name);
        const lists = kids.filter(isList);
        const others = kids.filter((k) => !isList(k) && !inert.test(k.type));
        return lists.length > 0 && others.length === 0 && lists.every((l) => !wired.has(l.name));
      });
      if (dead.length && dead.length < pages.length) dead.forEach((p) => { hidden[p.name] = { visible: false }; });
    }
    // The same for a stray tick-list that sits outside any tab beside lists we do fill.
    const anyWired = form.controls.some((c) => isList(c) && wired.has(c.name));
    if (anyWired) {
      const inTab = (c) => { for (let cur = byName.get(c.parent), g = 0; cur && g < 20; cur = byName.get(cur.parent), g += 1) if (cur.type === 'TabPage') return true; return false; };
      for (const c of form.controls) {
        if (c.type === 'ListView' && !wired.has(c.name) && !inTab(c)) hidden[c.name] = { visible: false };
      }
    }
    return hidden;
  })();
  const formOverrides = { ...deadTabs, ...(config.overrides ? config.overrides(state) : {}) };

  // The tick-list a "Select/UnSelect All" box acts on: the one on screen. Lists sit inside tab pages
  // (only the selected page is drawn), group boxes or panels, and some are DataGridViews filled from
  // `lists`, so walk each list's parents and keep the first whose tab pages are all the selected ones.
  const activeListView = () => {
    if (!form) return undefined;
    const byName = new Map(form.controls.map((c) => [c.name, c]));
    const isShown = (c) => {
      const o = formOverrides[c.name];
      if (o && o.visible !== undefined) return o.visible;
      if (c.runtime?.visible !== undefined) return c.runtime.visible;
      return c.visible !== false;
    };
    const drawn = (c) => {
      for (let cur = c, guard = 0; cur && guard < 20; cur = byName.get(cur.parent), guard += 1) {
        if (!isShown(cur)) return false;
        if (cur.type === 'TabPage') {
          const tab = byName.get(cur.parent);
          const pages = form.controls
            .filter((k) => k.type === 'TabPage' && k.parent === tab?.name && isShown(k))
            .sort((x, y) => Number(x.name.match(/(\d+)$/)?.[1] ?? 999) - Number(y.name.match(/(\d+)$/)?.[1] ?? 999));
          const active = state[`${tab?.name}.__tab`] || pages[0]?.name;
          if (cur.name !== active) return false;
        }
      }
      return true;
    };
    return form.controls.find((c) => (c.type === 'ListView' || /DataGridView$/.test(c.type))
      && Array.isArray(shownLists[c.name]) && drawn(c))?.name;
  };

  // Most JSM report screens name their two buttons btn_screen and btn_exit; a few name them
  // something else (the Job P&L grid has Btn_Refresh / Btn_Exit), and those configs say so.
  // Print and File (Word/Excel) on a screen open the same report grid, which has its own print and export.
  const runButtons = config.runButtons || ['btn_screen', 'btn_print', 'btn_word'];
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

  // Button names differ in case between screens (btn_exit / Btn_Exit), so compare without case.
  const isOneOf = (list, name) => list.some((x) => String(x).toLowerCase() === String(name).toLowerCase());
  const onButton = async (name, value) => {
    if (isOneOf(exitButtons, name)) { onClose?.(); return; }
    if (isOneOf(browseButtons, name)) { fileInputRef.current?.click(); return; }
    if (name === 'Check_Select_UnSelectAll') {
      const lv = activeListView();
      if (lv) setState((s) => ({ ...s, [lv]: value ? [...(shownLists[lv] || [])] : [] }));
      return;
    }
    if (isOneOf(excelButtons, name) && typeof config.onExcel === 'function') {
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
    if (isOneOf(runButtons, name)) {
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
                overrides={formOverrides}
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
