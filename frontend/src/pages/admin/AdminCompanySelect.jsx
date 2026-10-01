import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Check, Building2, X, RefreshCw, Layers } from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';

const companyId = (c) => String(c?._id || c?.id || '');

const haystack = (c) => [
  c?.name,
  c?.legalName,
  c?.shortName,
  c?.city,
  c?.location?.city,
  c?.state,
  c?.location?.state,
  c?.district,
  c?.location?.district,
  c?.gstin,
  c?.location?.gstin,
  c?.ownerId?.email,
  c?.ownerId?.name,
  c?.planId?.name,
].filter(Boolean).join(' ').toLowerCase();

const getCompanyMeta = (c) => {
  const city = c.city || c.location?.city;
  const state = c.state || c.location?.state;
  const gstin = c.gstin || c.location?.gstin;
  const owner = c.ownerId?.email || c.ownerId?.name;
  return [city, state, gstin ? `GSTIN: ${gstin}` : '', owner].filter(Boolean).join(' · ');
};

/**
 * Premium searchable company dropdown picker for the admin panel.
 * - Always shows clear dropdown trigger with chevron indicator & clear button
 * - In-menu dedicated search input with instant real-time filtering
 * - Full keyboard navigation (Up / Down / Enter / Escape)
 * - Safe fallback to useAdminStore if prop companies is still loading
 */
export default function AdminCompanySelect({
  companies: propCompanies,
  value = '',
  onChange,
  placeholder = 'Select company…',
  emptyLabel = '',
}) {
  const storeCompanies = useAdminStore((s) => s.companies);
  const fetchCompanies = useAdminStore((s) => s.fetchCompanies);
  const companiesLoading = useAdminStore((s) => s.loading);

  const companies = useMemo(() => {
    if (Array.isArray(propCompanies) && propCompanies.length > 0) return propCompanies;
    if (Array.isArray(storeCompanies) && storeCompanies.length > 0) return storeCompanies;
    return [];
  }, [propCompanies, storeCompanies]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);

  const boxRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(
    () => companies.find((c) => companyId(c) === String(value || '')) || null,
    [companies, value]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => haystack(c).includes(q));
  }, [companies, query]);

  // Reset highlight index when query or open state changes
  useEffect(() => {
    setIdx(0);
  }, [query, open]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
    } else {
      setQuery('');
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-item-index="${idx}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [idx, open]);

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
      const maxIdx = emptyLabel ? matches.length : Math.max(0, matches.length - 1);
      setIdx((i) => Math.min(i + 1, maxIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (emptyLabel && idx === 0) {
        choose('');
        return;
      }
      const itemIndex = emptyLabel ? idx - 1 : idx;
      const row = matches[itemIndex];
      if (row) choose(companyId(row));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const selectedMetaCity = selected?.city || selected?.location?.city;
  const selectedPlanName = selected?.planId?.name;

  return (
    <div
      ref={boxRef}
      className="admin-company-select-box"
      style={{
        position: 'relative',
        width: '100%',
        zIndex: open ? 60 : 'auto',
      }}
    >
      {/* ── Main Trigger Button ── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onKeyDown}
        className="dark-input"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          padding: '8px 12px',
          minHeight: 40,
          background: '#ffffff',
          textAlign: 'left',
          borderColor: open ? 'var(--admin-accent)' : undefined,
          boxShadow: open ? '0 0 0 3px var(--admin-accent-glow)' : undefined,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <Building2
            size={16}
            style={{
              color: selected ? 'var(--admin-accent)' : '#94a3b8',
              flexShrink: 0,
            }}
          />
          {selected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {selected.name}
              </span>
              {selectedMetaCity && (
                <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                  ({selectedMetaCity})
                </span>
              )}
              {selectedPlanName && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#f0fdf4',
                    color: '#059669',
                    border: '1px solid #bbf7d0',
                    padding: '1px 6px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedPlanName}
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
              {emptyLabel && !value ? emptyLabel : placeholder}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {selected && (
            <span
              role="button"
              tabIndex={0}
              title="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                choose('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  choose('');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#f1f5f9',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={16}
            style={{
              color: '#64748b',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      {/* ── Dropdown Popover ── */}
      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 9999,
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            minWidth: 320,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            boxShadow: '0 20px 35px -4px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06)',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Search Header Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <Search size={15} style={{ color: '#0d9488', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search company, city, GSTIN, owner…"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 12,
                fontWeight: 600,
                color: '#0f172a',
                fontFamily: 'inherit',
              }}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  border: 'none',
                  background: '#e2e8f0',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                <X size={11} />
              </button>
            )}
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                background: '#e2e8f0',
                color: '#475569',
                padding: '2px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {matches.length}
            </span>
          </div>

          {/* List of Options */}
          <div
            ref={listRef}
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              padding: '4px 0',
            }}
            role="listbox"
          >
            {/* Optional Empty / All Companies row */}
            {emptyLabel && (
              <button
                type="button"
                data-item-index={0}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose('');
                }}
                onMouseEnter={() => setIdx(0)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  border: 'none',
                  background: idx === 0 || !value ? '#f0fdfa' : '#ffffff',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={14} style={{ color: '#0d9488' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                    {emptyLabel}
                  </span>
                </div>
                {!value && <Check size={14} style={{ color: '#0d9488', strokeWidth: 2.5 }} />}
              </button>
            )}

            {/* No matches state */}
            {matches.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: 0 }}>
                  No company matches “{query}”
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Try searching by legal name, GSTIN number or city
                </p>
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#0d9488',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear search query
                  </button>
                )}
              </div>
            )}

            {/* Companies list empty fallback */}
            {companies.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  {companiesLoading ? 'Loading companies list…' : 'No companies loaded yet.'}
                </p>
                {fetchCompanies && (
                  <button
                    type="button"
                    onClick={() => fetchCompanies()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 8,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 6,
                      color: '#1d4ed8',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={11} className={companiesLoading ? 'animate-spin' : ''} />
                    Reload Companies
                  </button>
                )}
              </div>
            )}

            {/* Company Items */}
            {matches.map((c, i) => {
              const id = companyId(c);
              const isSelected = id === String(value || '');
              const itemIdx = emptyLabel ? i + 1 : i;
              const isHighlighted = itemIdx === idx;
              const meta = getCompanyMeta(c);
              const plan = c.planId?.name;

              return (
                <button
                  key={id || i}
                  type="button"
                  data-item-index={itemIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(id);
                  }}
                  onMouseEnter={() => setIdx(itemIdx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    border: 'none',
                    borderBottom: '1px solid #f8fafc',
                    background: isHighlighted ? '#f0fdfa' : isSelected ? '#f8fafc' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    {/* Company Initial Badge */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: isSelected ? '#0d9488' : '#e2e8f0',
                        color: isSelected ? '#ffffff' : '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {(c.name || 'C').charAt(0).toUpperCase()}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: isSelected ? 800 : 700,
                            color: isSelected ? '#0d9488' : '#0f172a',
                          }}
                        >
                          {c.name}
                        </span>
                        {plan && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              background: '#f1f5f9',
                              color: '#475569',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            {plan}
                          </span>
                        )}
                        {c.status && c.status !== 'active' && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              background: '#fef2f2',
                              color: '#dc2626',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            {c.status}
                          </span>
                        )}
                      </div>
                      {meta && (
                        <div
                          style={{
                            fontSize: 10,
                            color: '#64748b',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {meta}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check
                      size={15}
                      style={{
                        color: '#0d9488',
                        strokeWidth: 2.5,
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
