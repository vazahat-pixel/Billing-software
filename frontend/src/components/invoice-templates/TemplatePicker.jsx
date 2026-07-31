import React from 'react';
import { TEMPLATE_CATALOG } from './InvoiceTemplate';

/** Premium visual template picker with color swatches and badges */
export default function TemplatePicker({ selectedId, onSelect }) {
  return (
    <div className="invoice-template-picker print:hidden flex flex-col gap-1">
      {TEMPLATE_CATALOG.map((t) => {
        const active = t.id === selectedId;
        const [c1, c2, c3] = t.swatch || ['#333', '#999', '#fff'];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            title={t.blurb}
            style={{
              all: 'unset',
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 8px',
              border: active ? `2px solid ${c1}` : '1.5px solid #e2e8f0',
              borderRadius: '6px',
              background: active ? `linear-gradient(135deg, ${c1}10, ${c2}20)` : '#fff',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: active ? `0 2px 8px ${c1}40` : '0 1px 2px rgba(0,0,0,0.06)',
              marginBottom: '1px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              {/* Color swatches */}
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                {[c1, c2, c3].map((c, i) => (
                  <div key={i} style={{ width: '10px', height: '28px', background: c, borderRadius: '2px', border: '0.5px solid rgba(0,0,0,0.1)' }} />
                ))}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: active ? 800 : 600, color: active ? c1 : '#1e293b', letterSpacing: '-0.01em' }}>
                    {t.name}
                  </span>
                  {t.badge && (
                    <span style={{
                      fontSize: '7px',
                      fontWeight: 800,
                      background: t.badge === 'RECOMMENDED' ? '#0f2f5a' : t.badge === 'PREMIUM' ? '#b8921a' : '#10b981',
                      color: '#fff',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      letterSpacing: '0.04em',
                    }}>
                      {t.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '9px', color: active ? '#64748b' : '#94a3b8', marginTop: '1px', lineHeight: 1.3 }}>
                  {t.preview ? `${t.preview} · ` : ''}{t.blurb}
                </div>
              </div>

              {/* Active checkmark */}
              {active && (
                <div style={{ flexShrink: 0, width: '16px', height: '16px', background: c1, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: '9px', fontWeight: 900 }}>✓</span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
