import React, { useEffect, useMemo, useRef, useState } from 'react';

const companyId = (c) => String(c?._id || c?.id || '');

const haystack = (c) => [
  c?.name,
  c?.legalName,
  c?.shortName,
  c?.city,
  c?.state,
  c?.district,
  c?.gstin,
  c?.ownerId?.email,
  c?.ownerId?.name,
  c?.planId?.name,
].filter(Boolean).join(' ').toLowerCase();

/**
 * Searchable company picker for the admin panel.
 * Type to filter, Up/Down to move, Enter to choose, Esc to close.
 */
export default function AdminCompanySelect({
  companies = [],
  value = '',
  onChange,
  placeholder = 'Search company name, city, GSTIN…',
  emptyLabel = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => companies.find((c) => companyId(c) === String(value || '')) || null,
    [companies, value]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q ? companies : companies.filter((c) => haystack(c).includes(q));
    return list.slice(0, 80);
  }, [companies, query]);

  useEffect(() => {
    setIdx(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const choose = (id) => {
    onChange?.(id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setIdx(0);
        return;
      }
      setIdx((i) => Math.min(i + 1, Math.max(0, matches.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const row = matches[idx];
      if (row) choose(companyId(row));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        className="dark-input"
        value={open ? query : (selected?.name || '')}
        placeholder={selected && !open ? selected.name : placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        aria-label="Search company"
        autoComplete="off"
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 40,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            maxHeight: 280,
            overflow: 'auto',
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            boxShadow: '0 12px 30px rgba(15,23,42,0.15)',
          }}
        >
          {emptyLabel && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); choose(''); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                border: 'none',
                background: !value ? '#eff6ff' : '#fff',
                fontSize: 12,
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              {emptyLabel}
            </button>
          )}
          {matches.length === 0 && (
            <div style={{ padding: '12px 10px', fontSize: 12, color: '#94a3b8' }}>No company matches “{query}”</div>
          )}
          {matches.map((c, i) => {
            const id = companyId(c);
            const active = i === idx;
            const meta = [c.city, c.state, c.gstin, c.ownerId?.email, c.planId?.name].filter(Boolean).join(' · ');
            return (
              <button
                key={id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(id); }}
                onMouseEnter={() => setIdx(i)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
                  border: 'none',
                  borderTop: '1px solid #f1f5f9',
                  background: active || id === String(value || '') ? '#dbeafe' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{c.name}</span>
                {meta && <span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>{meta}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
