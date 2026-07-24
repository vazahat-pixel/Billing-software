import React from 'react';
import { TEMPLATE_CATALOG } from './InvoiceTemplate';

/** Compact vertical style list for invoice sidebar */
export default function TemplatePicker({ selectedId, onSelect }) {
  return (
    <div className="invoice-template-picker print:hidden flex flex-col gap-0.5">
      {TEMPLATE_CATALOG.map((t) => {
        const active = t.id === selectedId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            title={t.blurb}
            className={`w-full text-left px-2.5 py-2 border text-[11px] leading-tight transition-colors ${
              active
                ? 'bg-[#3d2914] text-white border-[#3d2914] font-bold'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="font-bold">{t.name}</div>
            <div className={`text-[9px] mt-0.5 ${active ? 'text-amber-100/80' : 'text-slate-500'}`}>
              {t.blurb}
            </div>
          </button>
        );
      })}
    </div>
  );
}
