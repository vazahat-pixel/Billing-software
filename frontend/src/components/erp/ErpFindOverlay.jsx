import React from 'react';

/** Shared F3 find list — same keys as Sale / Purchase. */
export default function ErpFindOverlay({
  title = 'FIND',
  search,
  onSearch,
  inputRef,
  onKeyDown,
  countLabel = 'bills',
  rows = [],
  activeIdx = 0,
  onSelect,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-[10070] flex items-center justify-center p-4"
      data-find-modal
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl border-2 border-slate-700 w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '82vh' }}
      >
        <div className="bg-[#1a3353] text-white px-4 py-2.5 flex items-center justify-between">
          <span className="bg-amber-400 text-slate-900 font-black px-1.5 py-0.5 rounded text-[11px]">{title}</span>
          <span className="text-[10px] text-slate-300">
            <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">+</kbd> /
            <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">-</kbd> ·
            <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">Enter</kbd>
          </span>
        </div>
        <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 shrink-0">No:</span>
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type number or press + / −"
            className="flex-1 px-3 py-1.5 border-2 border-blue-600 rounded text-sm font-bold bg-[#fffde6] text-slate-900 focus:outline-none font-mono"
          />
          <span className="text-[11px] font-bold text-slate-600 shrink-0">{rows.length} {countLabel}</span>
        </div>
        <div className="overflow-y-auto p-2 flex-1 space-y-1 max-h-72 bg-slate-50">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">No match for “{search}”</div>
          ) : (
            rows.map((row, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  type="button"
                  key={row.id || idx}
                  onClick={() => onSelect(row)}
                  className={`w-full text-left px-3 py-2 rounded flex items-center justify-between text-xs ${
                    active ? 'bg-blue-600 text-white font-bold' : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`font-mono font-black px-2 py-0.5 rounded ${active ? 'bg-amber-400 text-slate-900' : 'bg-slate-200'}`}>
                      #{row.no}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{row.party}</div>
                      <div className={active ? 'text-blue-100' : 'text-slate-500'}>{row.meta}</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold shrink-0">{row.amount}</div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
