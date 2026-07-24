import React, {
  useState, useRef, useEffect, useMemo, useCallback, useId,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { highlightMatch } from '../../utils/highlightMatch';
import { getRecent, pushRecent } from '../../hooks/useRecentSelections';
import { focusNextField } from '../../utils/formEnterNavigation';

/**
 * Enterprise searchable combobox — replaces native <select> in billing forms.
 * Keyboard: ↑↓ navigate, Enter select, Escape close, Tab exit.
 */
export default function ERPCombobox({
  value,
  onChange,
  options = [],
  placeholder = 'Search…',
  disabled = false,
  readOnly = false,
  error = null,
  className = '',
  inputClassName = '',
  recentKey = null,
  onCreateNew = null,
  createLabel = 'Record',
  onSearch = null,
  debounceMs = 180,
  emptyMessage = 'No matches',
  allowClear = false,
  'data-enter-nav': enterNav,
}) {
  const inputId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const debounceRef = useRef(null);
  const [serverOptions, setServerOptions] = useState(null);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const recentIds = useMemo(
    () => (recentKey ? getRecent(recentKey) : []),
    [recentKey, open, options.length]
  );

  const filtered = useMemo(() => {
    const base = serverOptions ?? options;
    const q = query.trim().toLowerCase();
    let list = base;
    if (q && !onSearch) {
      list = base.filter(
        (o) =>
          String(o.label || '').toLowerCase().includes(q) ||
          String(o.meta || '').toLowerCase().includes(q) ||
          String(o.code || '').toLowerCase().includes(q)
      );
    }
    if (recentKey && !q && recentIds.length) {
      const recentSet = new Set(recentIds);
      const recentOpts = recentIds
        .map((id) => list.find((o) => String(o.value) === id))
        .filter(Boolean);
      const rest = list.filter((o) => !recentSet.has(String(o.value)));
      return [...recentOpts, ...rest];
    }
    return list;
  }, [options, serverOptions, query, onSearch, recentKey, recentIds]);

  const showCreate =
    onCreateNew &&
    query.trim() &&
    !filtered.some((o) => String(o.label).toLowerCase() === query.trim().toLowerCase());

  const listCount = filtered.length + (showCreate ? 1 : 0);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 220),
      zIndex: 10050,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!onSearch || !open) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await onSearch(query.trim());
        if (Array.isArray(result)) setServerOptions(result);
      } catch {
        setServerOptions(null);
      }
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, onSearch, debounceMs, open]);

  const selectOption = (opt) => {
    if (!opt || disabled || readOnly) return;
    if (recentKey) pushRecent(recentKey, opt.value);
    onChange?.(opt.value, opt);
    setOpen(false);
    setQuery('');
    setActiveIdx(0);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        focusNextField(inputRef.current);
      }
    });
  };

  const handleInputKeyDown = (e) => {
    if (disabled || readOnly) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIdx(0);
        return;
      }
      setActiveIdx((i) => Math.min(i + 1, listCount - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setQuery('');
      return;
    }

    if (e.key === 'Enter') {
      if (open && listCount > 0) {
        e.preventDefault();
        e.stopPropagation();
        if (showCreate && activeIdx === filtered.length) {
          onCreateNew(query.trim());
          setOpen(false);
          setQuery('');
          return;
        }
        const opt = filtered[activeIdx];
        if (opt) selectOption(opt);
        return;
      }
      /* closed: let global Enter-nav move to next field */
    }

    if (e.key === 'Tab') {
      setOpen(false);
      setQuery('');
    }
  };

  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const displayValue = open ? query : (selected?.label || '');

  const dropdown = open && !disabled && !readOnly ? createPortal(
    <div
      ref={listRef}
      className="erp-combobox-dropdown"
      style={dropdownStyle}
      role="listbox"
    >
      {filtered.length === 0 && !showCreate ? (
        <div className="erp-combobox-empty">{emptyMessage}</div>
      ) : (
        filtered.map((opt, idx) => {
          const isRecent = recentKey && recentIds.includes(String(opt.value)) && !query.trim();
          return (
            <div
              key={String(opt.value)}
              data-idx={idx}
              role="option"
              aria-selected={idx === activeIdx}
              className={`erp-combobox-option ${idx === activeIdx ? 'active' : ''} ${String(opt.value) === String(value) ? 'selected' : ''}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={(ev) => {
                ev.preventDefault();
                selectOption(opt);
              }}
            >
              <span className="erp-combobox-option-label">
                {highlightMatch(opt.label, query).map((p, i) =>
                  p.match ? (
                    <mark key={i} className="erp-combobox-highlight">{p.text}</mark>
                  ) : (
                    <span key={i}>{p.text}</span>
                  )
                )}
              </span>
              {opt.meta ? <span className="erp-combobox-option-meta">{opt.meta}</span> : null}
              {isRecent && idx < recentIds.length ? (
                <span className="erp-combobox-recent-badge">Recent</span>
              ) : null}
            </div>
          );
        })
      )}
      {showCreate ? (
        <div
          data-idx={filtered.length}
          role="option"
          className={`erp-combobox-option erp-combobox-create ${activeIdx === filtered.length ? 'active' : ''}`}
          onMouseEnter={() => setActiveIdx(filtered.length)}
          onMouseDown={(ev) => {
            ev.preventDefault();
            onCreateNew(query.trim());
            setOpen(false);
            setQuery('');
          }}
        >
          <Plus size={14} />
          <span>Create {createLabel}: &quot;{query.trim()}&quot;</span>
        </div>
      ) : null}
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`erp-combobox ${error ? 'erp-combobox--error' : ''} ${disabled ? 'erp-combobox--disabled' : ''} ${className}`}
      data-enter-skip={open ? 'true' : undefined}
    >
      <div className="erp-combobox-control">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className={`erp-combobox-input classic-erp-input ${inputClassName}`}
          value={displayValue}
          placeholder={selected ? selected.label : placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete="off"
          data-erp-combobox-input="true"
          data-enter-nav={enterNav}
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => {
            if (!disabled && !readOnly) {
              setOpen(true);
              setQuery('');
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(0);
            if (!e.target.value && allowClear) onChange?.('', null);
          }}
          onKeyDown={handleInputKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          className="erp-combobox-chevron"
          disabled={disabled || readOnly}
          onClick={() => {
            if (disabled || readOnly) return;
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
        >
          <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
        </button>
      </div>
      {error ? <span className="erp-combobox-error">{error}</span> : null}
      {dropdown}
    </div>
  );
}
