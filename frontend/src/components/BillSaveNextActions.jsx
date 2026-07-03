import React from 'react';

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
  onNew,
  onClose
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-white border border-[var(--border)] rounded-xl shadow-[var(--shadow-float)] overflow-hidden">
        <div className="bg-[var(--accent-gradient)] text-white px-4 py-3 text-[13px] font-semibold flex justify-between items-center">
          <span>{title}</span>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/15 rounded-md w-7 h-7 flex items-center justify-center">
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
          <p className="text-[11px] text-[var(--text-muted)] font-medium">What would you like to do next?</p>

          <div className="grid grid-cols-1 gap-2">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className="erp-btn erp-btn-primary w-full justify-start h-9 text-[12px]"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
            {onPrint && (
              <button type="button" onClick={onPrint} className="erp-btn erp-btn-secondary flex-1 min-w-[100px] h-8 text-[11px]">
                Print
              </button>
            )}
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
  );
};

export default BillSaveNextActions;
