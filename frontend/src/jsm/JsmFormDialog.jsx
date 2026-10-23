import React, { useEffect, useMemo, useRef, useState } from 'react';
import { accel, cssColor, cssFont } from './winforms';

/**
 * Renders a JSM parameter screen from its blueprint (positions, captions, colors, fonts as in Jsm_Winsoft.exe).
 * State is a plain object keyed by control name: text/select values, booleans for check/radio boxes,
 * arrays of ticked names for ListViews, and `<TabControl>.__tab` for the selected tab.
 */
const INPUT_TYPES = /^(Js1_textBox|TextBox|Js1_MaskDate|MaskedTextBox)$/;
const COMBO_TYPES = /^(Js1_ComboBox|ComboBox)$/;
const CHECK_TYPES = /^(Js1_CheckBox|CheckBox)$/;
const RADIO_TYPES = /^(Js1_RadioButton|RadioButton)$/;
const BUTTON_TYPES = /^(Js1_Button|Button)$/;
const SKIP_TYPES = /ColumnHeader|DataGridView.+Column|ToolTip|ErrorProvider|Timer|ImageList|BindingSource/;

function Caption({ text }) {
  const { text: t, index } = accel(text);
  if (index < 0) return t;
  return (
    <>
      {t.slice(0, index)}
      <u>{t[index]}</u>
      {t.slice(index + 1)}
    </>
  );
}

function pageOrder(a, b) {
  const n = (p) => Number((String(p.name).match(/(\d+)$/) || [])[1] ?? 999);
  return n(a) - n(b) || String(a.name).localeCompare(String(b.name));
}

function boxStyle(c, extra = {}) {
  return {
    position: 'absolute',
    left: c.x ?? 0,
    top: c.y ?? 0,
    width: c.w > 0 ? c.w : undefined,
    height: c.h > 0 ? c.h : undefined,
    background: cssColor(c.back),
    color: cssColor(c.fore),
    ...cssFont(c.font),
    ...extra,
  };
}

export default function JsmFormDialog({
  form, state, onChange, lists = {}, onButton, overrides = {}, busy = false,
}) {
  const [search, setSearch] = useState('');
  const [focusList, setFocusList] = useState(null);
  const rootRef = useRef(null);

  const controls = useMemo(
    () => (form?.controls || []).filter((c) => !SKIP_TYPES.test(c.type)),
    [form]
  );
  const columnsOf = useMemo(() => {
    const map = {};
    for (const c of form?.controls || []) {
      if (c.type === 'ColumnHeader') (map[c.parent] = map[c.parent] || []).push(c);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0));
    return map;
  }, [form]);
  const childrenOf = useMemo(() => {
    const map = {};
    for (const c of controls) (map[c.parent || '__root'] = map[c.parent || '__root'] || []).push(c);
    return map;
  }, [controls]);

  const isVisible = (c) => {
    const o = overrides[c.name];
    if (o && o.visible !== undefined) return o.visible;
    if (c.runtime?.visible !== undefined) return c.runtime.visible;
    return c.visible !== false;
  };
  const captionOf = (c) => overrides[c.name]?.text ?? c.runtime?.text ?? c.text ?? '';
  const itemsOf = (c) => overrides[c.name]?.items || (c.runtime?.items?.length ? c.runtime.items : c.items) || [];

  const set = (name, value) => onChange({ ...state, [name]: value });

  // Alt+<letter> presses the button whose caption has that accelerator; Esc = Exit, like JSM.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onButton?.('btn_exit'); return; }
      if (!e.altKey) return;
      const btn = controls.find((c) => BUTTON_TYPES.test(c.type) && isVisible(c) && accel(c.text).key === e.key.toLowerCase());
      if (btn) { e.preventDefault(); onButton?.(btn.name); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // JSM moves to the next field on Enter.
  const onEnterNext = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    const fields = [...rootRef.current.querySelectorAll('input, select, button')].filter((el) => !el.disabled && el.offsetParent);
    const i = fields.indexOf(e.target);
    if (i > -1 && fields[i + 1]) fields[i + 1].focus();
  };

  const renderListView = (c) => {
    const rows = lists[c.name] || [];
    const ticked = new Set(state[c.name] || []);
    const cols = columnsOf[c.name] || [{ text: 'Name' }];
    const widths = cols.map((h, i) => (i === 0 ? 420 : i === 1 ? 90 : 60));
    const q = focusList === c.name ? search.toUpperCase() : '';
    const hit = q ? rows.findIndex((r) => String(r).toUpperCase().startsWith(q)) : -1;
    return (
      <div
        key={c.name}
        className="jsmf-listview"
        tabIndex={0}
        style={boxStyle(c, { overflow: 'auto' })}
        onFocus={() => setFocusList(c.name)}
        onKeyDown={(e) => {
          if (e.key.length === 1 && !e.ctrlKey && !e.altKey) { setSearch((s) => s + e.key); e.preventDefault(); }
          else if (e.key === 'Backspace') { setSearch((s) => s.slice(0, -1)); e.preventDefault(); }
          else if (e.key === ' ' && hit > -1) {
            const name = rows[hit];
            const next = new Set(ticked);
            if (next.has(name)) next.delete(name); else next.add(name);
            set(c.name, [...next]);
            e.preventDefault();
          }
        }}
      >
        <table>
          <thead>
            <tr>{cols.map((h, i) => <th key={i} style={{ width: widths[i] }}>{h.text}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((name, i) => (
              <tr key={`${name}-${i}`} className={i === hit ? 'is-hit' : ''} ref={i === hit ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      checked={ticked.has(name)}
                      onChange={(e) => {
                        const next = new Set(ticked);
                        if (e.target.checked) next.add(name); else next.delete(name);
                        set(c.name, [...next]);
                      }}
                    />
                    {name === '' ? ' ' : name}
                  </label>
                </td>
                {cols.slice(1).map((_, k) => <td key={k} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderControl = (c) => {
    if (!isVisible(c)) return null;
    const kids = childrenOf[c.name] || [];
    const disabled = busy || overrides[c.name]?.enabled === false;

    if (c.type === 'TabControl') {
      // WinForms shows tab pages in the order they were added (TabPage0, TabPage1…), not by TabIndex.
      const pages = kids.filter((k) => k.type === 'TabPage' && isVisible(k)).sort(pageOrder);
      const active = state[`${c.name}.__tab`] || pages[0]?.name;
      return (
        <div key={c.name} className="jsmf-tabs" style={boxStyle(c)}>
          <div className="jsmf-tabstrip">
            {pages.map((p) => (
              <button
                type="button"
                key={p.name}
                className={p.name === active ? 'is-active' : ''}
                onClick={() => { set(`${c.name}.__tab`, p.name); setSearch(''); }}
              >
                {captionOf(p)}
              </button>
            ))}
          </div>
          {pages.filter((p) => p.name === active).map((p) => (
            <div key={p.name} className="jsmf-tabpage" style={boxStyle(p, { left: 2, top: 22 })}>
              {(childrenOf[p.name] || []).map(renderControl)}
            </div>
          ))}
        </div>
      );
    }
    if (c.type === 'Panel' || c.type === 'TabPage') {
      return <div key={c.name} style={boxStyle(c)}>{kids.map(renderControl)}</div>;
    }
    if (c.type === 'GroupBox') {
      return (
        <fieldset key={c.name} className="jsmf-group" style={boxStyle(c)}>
          {captionOf(c) ? <legend>{captionOf(c)}</legend> : null}
          {kids.map(renderControl)}
        </fieldset>
      );
    }
    if (c.type === 'Label') {
      const text = c.name === 'Lbl_Find' ? search : captionOf(c);
      return <span key={c.name} className="jsmf-label" style={boxStyle(c, { width: undefined, minWidth: c.w })}>{text}</span>;
    }
    if (INPUT_TYPES.test(c.type)) {
      const isDate = /MaskDate|Masked/.test(c.type);
      return (
        <input
          key={c.name}
          className="jsmf-input"
          style={boxStyle(c)}
          value={state[c.name] ?? ''}
          placeholder={isDate ? 'dd/mm/yyyy' : undefined}
          maxLength={isDate ? 10 : undefined}
          disabled={disabled}
          onKeyDown={onEnterNext}
          onChange={(e) => {
            let v = e.target.value;
            if (isDate) {
              const d = v.replace(/\D/g, '').slice(0, 8);
              v = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
            }
            set(c.name, v);
          }}
        />
      );
    }
    if (COMBO_TYPES.test(c.type)) {
      const items = itemsOf(c);
      return (
        <select
          key={c.name}
          className="jsmf-combo"
          style={boxStyle(c)}
          value={state[c.name] ?? items[0] ?? ''}
          disabled={disabled}
          onKeyDown={onEnterNext}
          onChange={(e) => set(c.name, e.target.value)}
        >
          {items.map((it) => <option key={it} value={it}>{it}</option>)}
        </select>
      );
    }
    if (CHECK_TYPES.test(c.type) || RADIO_TYPES.test(c.type)) {
      const radio = RADIO_TYPES.test(c.type);
      return (
        <label key={c.name} className="jsmf-check" style={boxStyle(c)}>
          <input
            type={radio ? 'radio' : 'checkbox'}
            name={radio ? `radio-${c.parent}` : undefined}
            checked={Boolean(state[c.name])}
            disabled={disabled}
            onKeyDown={onEnterNext}
            onChange={(e) => {
              if (radio) {
                const group = controls.filter((x) => x.parent === c.parent && RADIO_TYPES.test(x.type));
                const next = { ...state };
                group.forEach((g) => { next[g.name] = g.name === c.name; });
                onChange(next);
              } else if (c.name === 'Check_Select_UnSelectAll') {
                onButton?.('Check_Select_UnSelectAll', e.target.checked);
                set(c.name, e.target.checked);
              } else set(c.name, e.target.checked);
            }}
          />
          <span><Caption text={captionOf(c)} /></span>
        </label>
      );
    }
    if (BUTTON_TYPES.test(c.type)) {
      return (
        <button
          key={c.name}
          type="button"
          className="jsmf-button"
          style={boxStyle(c)}
          disabled={disabled}
          onClick={() => onButton?.(c.name)}
        >
          <Caption text={captionOf(c)} />
        </button>
      );
    }
    if (c.type === 'ListView') return renderListView(c);
    if (c.type === 'DataGridView') return <div key={c.name} className="jsmf-grid" style={boxStyle(c)} />;
    if (c.type === 'ProgressBar') return <div key={c.name} className="jsmf-progress" style={boxStyle(c)} />;
    return null;
  };

  if (!form) return null;
  return (
    <div
      ref={rootRef}
      className="jsmf-form"
      style={{
        position: 'relative',
        width: form.width,
        height: form.height,
        background: cssColor(form.back) || '#f0f0f0',
        color: cssColor(form.fore),
        ...cssFont(form.font || 'Microsoft Sans Serif|8.25|0'),
      }}
    >
      {(childrenOf.__root || []).map(renderControl)}
    </div>
  );
}
