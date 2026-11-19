import React, { useEffect, useMemo, useRef, useState } from 'react';
import { accel, cssColor, cssFont, lastFill } from './winforms';

/**
 * Renders a JSM parameter screen from its blueprint (positions, captions, colors, fonts as in Jsm_Winsoft.exe).
 * State is a plain object keyed by control name: text/select values, booleans for check/radio boxes,
 * arrays of ticked names for ListViews, and `<TabControl>.__tab` for the selected tab.
 */
const INPUT_TYPES = /^(Js1_textBox|TextBox|Js1_MaskDate|MaskedTextBox)$/;
const TEXTAREA_TYPES = /^RichTextBox$/;
const COMBO_TYPES = /^(Js1_ComboBox|ComboBox)$/;
const CHECK_TYPES = /^(Js1_CheckBox|CheckBox)$/;
const RADIO_TYPES = /^(Js1_RadioButton|RadioButton)$/;
const BUTTON_TYPES = /^(Js1_Button|Button)$/;
const SKIP_TYPES = /ColumnHeader|DataGridView.+Column|.+Column$|ToolTip|ErrorProvider|Timer|ImageList|BindingSource/;

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
  form, state, onChange, lists = {}, onButton, overrides = {}, busy = false, grids = {},
}) {
  const [search, setSearch] = useState('');
  const [focusList, setFocusList] = useState(null);
  const [activeRow, setActiveRow] = useState(0);
  const rootRef = useRef(null);

  const controls = useMemo(
    () => (form?.controls || []).filter((c) => !SKIP_TYPES.test(c.type)),
    [form]
  );
  const columnsOf = useMemo(() => {
    const map = {};
    for (const c of form?.controls || []) {
      if ((c.type === 'ColumnHeader' || /Column$/.test(c.type)) && c.visible !== false) {
        (map[c.parent] = map[c.parent] || []).push(c);
      }
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
  const itemsOf = (c) => overrides[c.name]?.items || (c.runtime?.items?.length ? lastFill(c.runtime.items) : c.items) || [];

  // Functional update: "Select/UnSelect All" changes the list in the parent first and then this box, and a
  // plain `{ ...state }` here would write the stale copy back over the list it just filled.
  const set = (name, value) => onChange((s) => ({ ...s, [name]: value }));

  const getFocusableControls = () => {
    if (!rootRef.current) return [];
    return Array.from(
      rootRef.current.querySelectorAll(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), .jsmf-listview[tabindex="0"]'
      )
    ).filter((el) => el.offsetParent !== null && !el.disabled)
      // top-to-bottom, left-to-right as drawn (the blueprint lists controls in creation order, not screen order)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .sort((a, b) => Math.round(a.r.top / 10) - Math.round(b.r.top / 10) || a.r.left - b.r.left)
      .map((x) => x.el);
  };

  // The Enter chain, as in JSM: every field in screen order, a radio group as ONE stop (its selected
  // button), no side buttons (the small "T" test button etc.), and finally the run button (OK / Screen).
  const enterChain = () => {
    const all = getFocusableControls();
    const seen = new Set();
    const fields = all.filter((el) => {
      if (el.tagName === 'BUTTON') return false;
      // option boxes are not Enter stops (Space ticks, arrows walk them, Tab reaches them): Enter goes
      // straight through the dates / lists / combos to OK, so a form is never 25 Enters long
      if (el.type === 'checkbox') return false;
      // a tick-list is one stop (the list itself); its row checkboxes are walked with the arrows
      if (!el.classList.contains('jsmf-listview') && el.closest('.jsmf-listview')) return false;
      if (el.type === 'radio') {
        if (seen.has(el.name || el)) return false;
        const group = all.filter((x) => x.type === 'radio' && x.name === el.name);
        const rep = group.find((x) => x.checked) || group[0];
        seen.add(el.name || el);
        return el === rep || (rep !== el && false);
      }
      return true;
    });
    // a radio that was not the representative still has to find its group's stop
    // The account / party list is the last stop: after picking accounts there, Enter goes straight to
    // OK — never on through the option boxes, combos and filters drawn below the list.
    const lastList = fields.map((el) => el.classList.contains('jsmf-listview')).lastIndexOf(true);
    if (lastList > -1) fields.splice(lastList + 1);
    const repOf = (el) => (el.type === 'radio'
      ? fields.find((x) => x.type === 'radio' && x.name === el.name) || el
      : el);
    const caption = (b) => String(b.textContent || '').replace(/&/g, '').trim();
    const buttons = all.filter((el) => el.tagName === 'BUTTON');
    // Several screens carry a second small "Ok" (a utility) beside the real one: the real one is named
    // btn_ok / btn_screen, else it is the lowest matching button (the bottom bar).
    const lowest = (list) => [...list].sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
    const byName = buttons.filter((b) => /^btn_?(ok|screen)$/i.test(b.dataset?.buttonName || ''));
    const byCaption = buttons.filter((b) => /^(ok|screen|show|display|refresh|generate|run|load|preview)$/i.test(caption(b)));
    const run = (byName.length ? lowest(byName) : null)
      || (byCaption.length ? lowest(byCaption) : null)
      || buttons.find((b) => caption(b).length > 2 && !/^(exit|cancel|close)$/i.test(caption(b)));
    return { fields, run, repOf };
  };

  // Initial Auto-Focus: Focus first text/date input or combo or first control
  useEffect(() => {
    if (!rootRef.current) return;
    const timer = setTimeout(() => {
      const focusables = getFocusableControls();
      if (!focusables.length) return;
      const firstInput = focusables.find(
        (el) => (el.tagName === 'INPUT' && el.type !== 'radio' && el.type !== 'checkbox') || el.tagName === 'SELECT'
      );
      (firstInput || focusables[0])?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [form?.name, form?.title]);

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

  // JSM moves to next field on Enter. Up/Down moves vertically.
  const onEnterNext = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const { fields, run, repOf } = enterChain();
      const i = fields.indexOf(repOf(e.target));
      if (e.shiftKey) {
        if (i > 0 && fields[i - 1]) fields[i - 1].focus();
        return;
      }
      if (i > -1 && fields[i + 1]) fields[i + 1].focus();
      else (run || fields[i])?.focus(); // after the last field the cursor lands on OK / Screen; Enter there runs it
    } else if (e.key === 'ArrowDown' && e.target.tagName === 'INPUT' && e.target.type !== 'radio' && e.target.type !== 'checkbox') {
      e.preventDefault();
      const fields = getFocusableControls();
      const i = fields.indexOf(e.target);
      if (i > -1 && fields[i + 1]) fields[i + 1].focus();
    } else if (e.key === 'ArrowUp' && e.target.tagName === 'INPUT' && e.target.type !== 'radio' && e.target.type !== 'checkbox') {
      e.preventDefault();
      const fields = getFocusableControls();
      const i = fields.indexOf(e.target);
      if (i > 0 && fields[i - 1]) fields[i - 1].focus();
    }
  };

  const renderListView = (c) => {
    const rows = lists[c.name] || [];
    const ticked = new Set(state[c.name] || []);
    const cols = columnsOf[c.name]?.length ? columnsOf[c.name] : [{ text: 'Name' }];
    const widths = cols.map((h, i) => (i === 0 ? (cols.length === 1 ? 420 : 300) : i === 1 ? 120 : 60));
    const q = focusList === c.name ? search.toUpperCase() : '';
    const hit = q ? rows.findIndex((r) => String(r).toUpperCase().startsWith(q)) : -1;
    const curIndex = hit > -1 ? hit : Math.min(Math.max(0, activeRow), Math.max(0, rows.length - 1));

    return (
      <div
        key={c.name}
        className="jsmf-listview"
        tabIndex={0}
        style={boxStyle(c, { overflow: 'auto' })}
        onFocus={() => setFocusList(c.name)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSearch('');
            setActiveRow((prev) => Math.min(rows.length - 1, (prev < 0 ? 0 : prev) + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSearch('');
            setActiveRow((prev) => Math.max(0, (prev < 0 ? 0 : prev) - 1));
          } else if (e.key === 'PageDown') {
            e.preventDefault();
            setSearch('');
            setActiveRow((prev) => Math.min(rows.length - 1, (prev < 0 ? 0 : prev) + 10));
          } else if (e.key === 'PageUp') {
            e.preventDefault();
            setSearch('');
            setActiveRow((prev) => Math.max(0, (prev < 0 ? 0 : prev) - 10));
          } else if (e.key === 'Home') {
            e.preventDefault();
            setSearch('');
            setActiveRow(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            setSearch('');
            setActiveRow(Math.max(0, rows.length - 1));
          } else if (e.key === ' ' && rows.length > 0 && curIndex >= 0 && curIndex < rows.length) {
            e.preventDefault();
            const name = rows[curIndex];
            const next = new Set(ticked);
            if (next.has(name)) next.delete(name); else next.add(name);
            set(c.name, [...next]);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const { fields, run } = enterChain();
            const i = fields.indexOf(e.currentTarget);
            if (e.shiftKey) {
              if (i > 0 && fields[i - 1]) fields[i - 1].focus();
              return;
            }
            if (i > -1 && fields[i + 1]) fields[i + 1].focus();
            else run?.focus();
          } else if (e.key === 'Backspace') {
            setSearch((s) => s.slice(0, -1));
            e.preventDefault();
          } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && e.key !== ' ') {
            const nextSearch = (search + e.key).toUpperCase();
            setSearch((s) => s + e.key);
            const found = rows.findIndex((r) => String(r).toUpperCase().startsWith(nextSearch));
            if (found > -1) setActiveRow(found);
            e.preventDefault();
          }
        }}
      >
        <table>
          <thead>
            <tr>{cols.map((h, i) => <th key={i} style={{ width: widths[i] }}>{h.text}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((name, i) => {
              const isSelected = i === curIndex;
              return (
                <tr
                  key={`${name}-${i}`}
                  className={isSelected ? 'is-hit' : ''}
                  ref={isSelected ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  onClick={() => setActiveRow(i)}
                >
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        tabIndex={-1}
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
              );
            })}
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
    if (TEXTAREA_TYPES.test(c.type)) {
      return (
        <textarea
          key={c.name}
          className="jsmf-input"
          style={boxStyle(c)}
          value={state[c.name] ?? ''}
          disabled={disabled}
          // Enter moves on (Ctrl+Enter / Shift+Enter keep a new line in a notes box)
          onKeyDown={(e) => { if (!(e.shiftKey || e.ctrlKey)) onEnterNext(e); }}
          onChange={(e) => set(c.name, e.target.value)}
        />
      );
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
            onKeyDown={(e) => {
              if (radio) {
                const group = controls.filter((x) => x.parent === c.parent && RADIO_TYPES.test(x.type));
                const idx = group.findIndex((g) => g.name === c.name);
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const next = group[(idx + 1) % group.length];
                  if (next) {
                    const patch = { ...state };
                    group.forEach((g) => { patch[g.name] = g.name === next.name; });
                    onChange(patch);
                    setTimeout(() => {
                      const allRadios = Array.from(rootRef.current?.querySelectorAll('input[type="radio"]') || []);
                      const targetEl = allRadios.find((r) => r.checked);
                      targetEl?.focus();
                    }, 10);
                  }
                  return;
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prev = group[(idx - 1 + group.length) % group.length];
                  if (prev) {
                    const patch = { ...state };
                    group.forEach((g) => { patch[g.name] = g.name === prev.name; });
                    onChange(patch);
                    setTimeout(() => {
                      const allRadios = Array.from(rootRef.current?.querySelectorAll('input[type="radio"]') || []);
                      const targetEl = allRadios.find((r) => r.checked);
                      targetEl?.focus();
                    }, 10);
                  }
                  return;
                }
              } else {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  const checks = Array.from(rootRef.current?.querySelectorAll('input[type="checkbox"]:not([tabindex="-1"])') || []);
                  const idx = checks.indexOf(e.target);
                  if (idx > -1 && checks[idx + 1]) {
                    e.preventDefault();
                    checks[idx + 1].focus();
                    return;
                  }
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  const checks = Array.from(rootRef.current?.querySelectorAll('input[type="checkbox"]:not([tabindex="-1"])') || []);
                  const idx = checks.indexOf(e.target);
                  if (idx > 0 && checks[idx - 1]) {
                    e.preventDefault();
                    checks[idx - 1].focus();
                    return;
                  }
                }
              }
              onEnterNext(e);
            }}
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
          data-button-name={c.name}
          className="jsmf-button"
          style={boxStyle(c)}
          disabled={disabled}
          onClick={() => onButton?.(c.name)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              const allButtons = Array.from(rootRef.current?.querySelectorAll('button.jsmf-button:not([disabled])') || []);
              const idx = allButtons.indexOf(e.currentTarget);
              if (allButtons.length > 1 && idx > -1) {
                const nextIdx = e.key === 'ArrowRight'
                  ? (idx + 1) % allButtons.length
                  : (idx - 1 + allButtons.length) % allButtons.length;
                allButtons[nextIdx]?.focus();
              }
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              const focusables = getFocusableControls().filter((el) => el.tagName !== 'BUTTON');
              focusables[focusables.length - 1]?.focus();
              return;
            }
          }}
        >
          <Caption text={captionOf(c)} />
        </button>
      );
    }
    if (c.type === 'ListView') return renderListView(c);
    // A tick-list that JSM draws as a DataGridView (Sales Summary's Party tab, Balance Sheet's Dgv1) is filled from `lists`.
    if (/DataGridView$/.test(c.type) && !grids[c.name] && (lists[c.name] !== undefined || c.name in lists)) return renderListView(c);
    if (/DataGridView$|ListView$/.test(c.type) && grids[c.name]) {
      // Data grids carry no columns in the blueprint (JSM adds them in code), so the screen supplies
      // { columns: [{ key, label, width, num, fmt }], rows, onRowClick } per grid name.
      const g = grids[c.name];
      return (
        <div key={c.name} className="jsmf-grid jsmf-dgv" style={boxStyle(c, { overflow: 'auto' })}>
          <table>
            <thead>
              <tr>{g.columns.map((col) => <th key={col.key} style={{ minWidth: col.width }}>{col.label}</th>)}</tr>
            </thead>
            <tbody>
              {g.rows.map((r, i) => (
                <tr key={i} className={g.onRowClick ? 'is-click' : ''} onClick={g.onRowClick ? () => g.onRowClick(r) : undefined}>
                  {g.columns.map((col) => {
                    const v = r[col.key];
                    return <td key={col.key} className={col.num ? 'num' : ''}>{String(col.fmt ? col.fmt(v) : (v ?? ''))}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (/DataGridView$/.test(c.type)) return <div key={c.name} className="jsmf-grid" style={boxStyle(c)} />;
    if (c.type === 'ProgressBar') return <div key={c.name} className="jsmf-progress" style={boxStyle(c)} />;
    return null;
  };

  if (!form) return null;
  return (
    <div
      ref={rootRef}
      data-enter-skip="true"
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
