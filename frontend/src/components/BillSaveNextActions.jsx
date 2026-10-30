import React, { useEffect, useRef } from 'react';
import ErpTopLayer from './erp/ErpTopLayer';

/**
 * Desktop ERP style — after bill save, show next-step options.
 */
const BillSaveNextActions = ({
  open,
  title = 'Bill Saved',
  invoiceNo,
  offlinePending,
  actions = [],
  onPrint,
  onPdf,
  onWhatsApp,
  onNew,
  onClose
}) => {
  const cardRef = useRef(null);
  // Callers rebuild these every render; refs keep the key handler (and initial focus) set up once per open.
  const latest = useRef({ actions, onClose });
  latest.current = { actions, onClose };

  // Keyboard, in capture phase so the bill window behind never sees these keys:
  // Esc closes, arrows move between buttons, Enter presses the focused one, 1-9 pick "Continue to".
  useEffect(() => {
    if (!open) return undefined;
    const buttons = () => [...(cardRef.current?.querySelectorAll('button:not([disabled]):not([data-nav-skip])') || [])];
    const focusTimer = setTimeout(() => buttons()[0]?.focus(), 30);
    const onKey = (e) => {
      const list = buttons();
      const at = list.indexOf(document.activeElement);
      const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      const { actions, onClose } = latest.current;
      if (e.key === 'Escape') {
        stop();
        onClose?.();
      } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key) && list.length) {
        stop();
        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        list[(at + step + list.length) % list.length].focus();
      } else if (e.key === 'Enter' && at >= 0) {
        stop();
        list[at].click();
      } else if (/^[1-9]$/.test(e.key) && actions[Number(e.key) - 1]) {
        stop();
        actions[Number(e.key) - 1].onClick();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (!open) return null;

  return (
    <ErpTopLayer>
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div ref={cardRef} className="[&_button:focus]:outline [&_button:focus]:outline-[3px] [&_button:focus]:outline-blue-600 [&_button:focus]:outline-offset-2 w-full max-w-md bg-white border border-[var(--border)] rounded-xl shadow-[var(--shadow-float)] overflow-hidden">
        <div className="bg-[var(--accent-gradient)] text-white px-4 py-3 text-[13px] font-semibold flex justify-between items-center">
          <span>{title}</span>
          <button type="button" data-nav-skip onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/15 rounded-md w-7 h-7 flex items-center justify-center">
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">
            {invoiceNo ? `Voucher #${invoiceNo} saved successfully.` : 'Saved successfully.'}
          </p>
          {offlinePending && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Offline save — will sync when you are back online.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {onPdf && (
              <button type="button" onClick={onPdf} className="erp-btn erp-btn-primary h-10 text-[11px] col-span-2">
                📄 Open Invoice PDF (Download / Print)
              </button>
            )}
            {onPrint && (
              <button type="button" onClick={onPrint} className="erp-btn erp-btn-secondary h-9 text-[11px]">
                🖨 Print
              </button>
            )}
            {onWhatsApp && (
              <button type="button" onClick={onWhatsApp} className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold">
                WhatsApp
              </button>
            )}
          </div>

          {actions.length > 0 && (
            <>
              <p className="text-[11px] text-[var(--text-muted)] font-medium pt-1">Continue to</p>
              <div className="grid grid-cols-1 gap-2">
                {actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className="erp-btn erp-btn-secondary w-full justify-start h-9 text-[12px]"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
            {onNew && (
              <button type="button" onClick={onNew} className="erp-btn erp-btn-secondary flex-1 min-w-[100px] h-8 text-[11px]">
                New Bill
              </button>
            )}
            <button type="button" onClick={onClose} className="erp-btn erp-btn-secondary flex-1 min-w-[100px] h-8 text-[11px]">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
    </ErpTopLayer>
  );
};

export default BillSaveNextActions;
