import React from 'react';

/** Classic ERP title-bar window buttons: minimize / maximize-restore / close */
export default function ErpWindowControls({
  isMaximized,
  onMinimize,
  onToggleMax,
  onClose,
}) {
  return (
    <div className="erp-window-controls" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="erp-window-btn"
        title="Minimize"
        aria-label="Minimize"
        onClick={onMinimize}
      >
        _
      </button>
      <button
        type="button"
        className="erp-window-btn"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        onClick={onToggleMax}
      >
        {isMaximized ? '❐' : '□'}
      </button>
      <button
        type="button"
        className="erp-window-btn erp-window-btn--close"
        title="Close"
        aria-label="Close"
        onClick={onClose}
      >
        X
      </button>
    </div>
  );
}
