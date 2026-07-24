import React, { useState } from 'react';

/** Preview-only setup tip — never appears on printed/PDF paper */
export function FieldWarning({ children }) {
  if (!children) return null;
  return (
    <div
      className="invoice-field-warning print:hidden"
      style={{
        fontSize: 10,
        color: '#475569',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        padding: '6px 10px',
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Compact collapsible setup checklist — kept OFF the invoice paper when used
 * in InvoicePDFViewer. Templates should not embed this on the letterhead.
 */
export function WarningsBanner({ warnings = [] }) {
  const [open, setOpen] = useState(false);
  if (!warnings.length) return null;
  return (
    <div className="print:hidden" style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          fontSize: 11,
          fontWeight: 700,
          color: '#334155',
          background: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: '8px 12px',
          cursor: 'pointer',
        }}
      >
        Setup tips ({warnings.length}) — fill Company Settings for a complete letterhead
        <span style={{ float: 'right', color: '#64748b' }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 4 }}>
          {warnings.map((w) => (
            <FieldWarning key={w}>{w}</FieldWarning>
          ))}
        </div>
      )}
    </div>
  );
}

export function MetaRow({ label, value }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div style={{ fontWeight: 700, fontSize: 11, color: '#0f172a' }}>{value || '—'}</div>
    </div>
  );
}

export function Placeholder({ label }) {
  return (
    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 9 }}>
      {label}
    </span>
  );
}
