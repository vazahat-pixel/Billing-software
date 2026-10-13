import React from 'react';

/** Classic ERP title-bar window buttons: minimize / maximize-restore / close */
export default function ErpWindowControls({
  isMaximized,
  onMinimize,
  onToggleMax,
  onClose,
}) {
  const press = (e, fn) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.();
  };

  return (
    <div className="erp-window-controls" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="erp-window-btn"
        title="Minimize"
        aria-label="Minimize"
        onPointerDown={(e) => press(e, onMinimize)}
      >
        _
      </button>
      <button
        type="button"
        className="erp-window-btn"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        onPointerDown={(e) => press(e, onToggleMax)}
      >
        {isMaximized ? '❐' : '□'}
      </button>
      <button
        type="button"
        className="erp-window-btn erp-window-btn--close"
        title="Close"
        aria-label="Close"
        onPointerDown={(e) => press(e, onClose)}
      >
        X
      </button>
    </div>
  );
}
