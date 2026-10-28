import React, { useMemo, useRef } from 'react';
import { cssColor, cssFont, accel } from '../../jsm/winforms';
import '../../styles/jsm-forms.css';

/**
 * Draws a JSM (WinForms) form from its own layout data — same pixel positions, sizes, fonts,
 * colours and tab order as JSM. Inputs are controlled by the caller through `values` / `onChange`.
 *
 * Keyboard as in JSM: Enter moves to the next field in tab order (from the last field to Save),
 * Alt+<underlined letter> presses that button.
 */

// WinForms colours / fonts / &-captions: the same helpers the JSM report screens use
export const jsmColor = (v) => cssColor(v);
export const jsmFont = (v) => (v ? cssFont(v) : null);
export function jsmMnemonic(caption) {
  const { text, key, index } = accel(caption);
  if (index < 0) return { label: text, key: null };
  return { label: (<>{text.slice(0, index)}<u>{text[index]}</u>{text.slice(index + 1)}</>), key };
}

const INPUT_TYPES = new Set(['textBox', 'TextBox', 'MaskDate', 'MaskedTextBox', 'ComboBox', 'CheckBox', 'RadioButton']);

export default function JsmFormCanvas({
  layout,
  values = {},
  onChange,
  fieldsEnabled = true,
  buttons = {}, // { btn_New: { enabled, onClick } }
  fieldProps = {}, // { txt_name: { options, onBlur, inputRef } }
  hiddenControls = [],
  renderControl, // optional (control) => node, for grids/lists
}) {
  const rootRef = useRef(null);

  const { children, order } = useMemo(() => {
    const byParent = {};
    const tabOf = {};
    for (const c of layout.controls) {
      if (hiddenControls.includes(c.n)) continue;
      (byParent[c.p || ''] ||= []).push(c);
      tabOf[c.n] = c;
    }
    // global tab order = parent's tab path + own tab (WinForms nested tab order)
    const path = (c) => (c.p && tabOf[c.p] ? [...path(tabOf[c.p]), c.tab] : [c.tab]);
    const cmp = (a, b) => {
      const pa = path(a); const pb = path(b);
      for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const d = (pa[i] ?? -1) - (pb[i] ?? -1);
        if (d) return d;
      }
      return 0;
    };
    const inputs = layout.controls.filter((c) => INPUT_TYPES.has(c.t) && !hiddenControls.includes(c.n)).sort(cmp);
    return { children: byParent, order: inputs.map((c) => c.n) };
  }, [layout, hiddenControls]);

  const focusControl = (name) => {
    const el = rootRef.current?.querySelector(`[data-jsm="${name}"]`);
    if (el) { el.focus(); if (el.select && el.tagName === 'INPUT' && el.type === 'text') el.select(); return true; }
    return false;
  };

  const onKeyDown = (e) => {
    if (e.altKey && !e.ctrlKey && e.key.length === 1) {
      const k = e.key.toLowerCase();
      const btn = layout.controls.find((c) => /Button/.test(c.t) && buttons[c.n]?.enabled && jsmMnemonic(c.text).key === k);
      if (btn) { e.preventDefault(); buttons[btn.n].onClick?.(); }
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey) return;
    const name = e.target?.dataset?.jsm;
    const at = order.indexOf(name);
    if (at < 0) return;
    e.preventDefault();
    for (let i = at + 1; i < order.length; i += 1) {
      const el = rootRef.current?.querySelector(`[data-jsm="${order[i]}"]`);
      if (el && !el.disabled) { focusControl(order[i]); return; }
    }
    // last field: on to Save, as in JSM
    const save = rootRef.current?.querySelector('[data-jsm="btn_sv"], [data-jsm="btn_Save"], [data-jsm="btn_save"]');
    save?.focus();
  };

  const draw = (c, parentFont) => {
    const font = jsmFont(c.font) || parentFont;
    const box = { position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, ...font };
    const custom = renderControl?.(c, box);
    if (custom !== undefined) return <React.Fragment key={c.n}>{custom}</React.Fragment>;
    const fp = fieldProps[c.n] || {};
    const enabled = fieldsEnabled && !c.disabled && !fp.disabled;

    if (c.t === 'GroupBox' || c.t === 'Panel') {
      const kids = (children[c.n] || []).map((k) => draw(k, font));
      return (
        <div key={c.n} style={{ ...box, background: c.t === 'Panel' ? jsmColor(c.back) : undefined }}>
          {c.t === 'GroupBox' && (
            <div style={{ position: 'absolute', inset: '7px 0 0 0', border: '1px solid #b9b9b9', borderRadius: 2, background: jsmColor(c.back), pointerEvents: 'none' }} />
          )}
          {c.t === 'GroupBox' && c.text && (
            <span style={{ position: 'absolute', left: 6, top: 0, padding: '0 2px', background: jsmColor(c.back), color: jsmColor(c.fore) || '#000', lineHeight: '14px' }}>{c.text}</span>
          )}
          {kids}
        </div>
      );
    }
    if (c.t === 'Label') {
      return (
        <div key={c.n} style={{ ...box, height: undefined, minHeight: c.h, width: undefined, minWidth: c.w, whiteSpace: 'nowrap', color: jsmColor(c.fore) || '#000', background: jsmColor(c.back), lineHeight: `${c.h}px`, overflow: 'visible', cursor: 'default' }}>
          {fp.text ?? c.text}
        </div>
      );
    }
    if (c.t === 'RadioButton') {
      // fieldProps: { checked, onCheck } — the caller decides what a radio stands for
      return (
        <label key={c.n} style={{ ...box, display: 'flex', alignItems: 'center', gap: 4, color: enabled ? (jsmColor(c.fore) || '#000') : '#8d8d8d', background: jsmColor(c.back) }}>
          <input type="radio" data-jsm={c.n} disabled={!enabled} checked={!!fp.checked} onChange={() => fp.onCheck?.()} style={{ margin: 0 }} />
          {c.text}
        </label>
      );
    }
    if (/Button/.test(c.t)) {
      const b = buttons[c.n] || {};
      const { label } = jsmMnemonic(c.text);
      return (
        <button
          key={c.n}
          type="button"
          data-jsm={c.n}
          disabled={!b.enabled}
          onClick={b.onClick}
          className="jsm-btn"
          style={{ ...box, background: jsmColor(c.back) || '#e1e1e1', color: b.enabled ? (jsmColor(c.fore) || '#000') : '#8d8d8d' }}
        >
          {label}
        </button>
      );
    }
    if (c.t === 'CheckBox') {
      return (
        <label key={c.n} style={{ ...box, display: 'flex', alignItems: 'center', gap: 4, color: jsmColor(c.fore) || '#000' }}>
          <input type="checkbox" data-jsm={c.n} disabled={!enabled} checked={!!values[c.n]} onChange={(e) => onChange?.(c.n, e.target.checked)} />
          {c.text}
        </label>
      );
    }
    if (c.t === 'ComboBox') {
      const options = fp.options || c.items || [];
      const v = values[c.n] ?? '';
      return (
        <select
          key={c.n}
          data-jsm={c.n}
          ref={fp.inputRef}
          disabled={!enabled}
          value={v}
          onChange={(e) => onChange?.(c.n, e.target.value)}
          className="jsm-input"
          style={{ ...box, background: enabled ? (jsmColor(c.back) || '#fff') : '#f0f0f0', color: enabled ? (jsmColor(c.fore) || '#000') : '#6d6d6d' }}
        >
          <option value="" />
          {v && !options.includes(v) && <option value={v}>{v}</option>}
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (INPUT_TYPES.has(c.t)) {
      return (
        <input
          key={c.n}
          type="text"
          data-jsm={c.n}
          ref={fp.inputRef}
          disabled={!enabled}
          maxLength={c.max}
          value={values[c.n] ?? ''}
          onChange={(e) => onChange?.(c.n, e.target.value)}
          onBlur={fp.onBlur}
          autoComplete="off"
          spellCheck={false}
          className="jsm-input"
          style={{ ...box, background: enabled ? (jsmColor(c.back) || '#fff') : '#f0f0f0', color: enabled ? (jsmColor(c.fore) || '#000') : '#6d6d6d', textAlign: fp.align }}
        />
      );
    }
    return null;
  };

  const rootFont = jsmFont(layout.font) || jsmFont('Microsoft Sans Serif|8.25|0');
  return (
    <div
      ref={rootRef}
      className="jsm-form"
      onKeyDown={onKeyDown}
      style={{ position: 'relative', width: layout.w, height: layout.h, background: jsmColor(layout.back) || '#f0f0f0', ...rootFont }}
    >
      {(children[''] || []).map((c) => draw(c, rootFont))}
    </div>
  );
}

