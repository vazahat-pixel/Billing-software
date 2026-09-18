import React from 'react';

/**
 * Compact bottom strip of keyboard shortcuts (classic ERP status-bar style).
 * @param {{ items?: { keys: string, label: string }[], className?: string, dense?: boolean }} props
 */
const DEFAULT_APP_HINTS = [
  { keys: 'Ctrl+K', label: 'Search' },
  { keys: 'Alt+N', label: 'New' },
  { keys: 'F2', label: 'Edit' },
  { keys: 'F3', label: 'Find' },
  { keys: 'Ctrl+Enter', label: 'Save' },
  { keys: 'Enter', label: 'Next field' },
  { keys: 'Shift+Enter', label: 'Back' },
  { keys: 'Esc', label: 'Close' },
];

const FORM_HINTS = [
  { keys: 'Enter', label: 'Next' },
  { keys: 'Shift+Enter', label: 'Back' },
  { keys: 'F3', label: 'Find' },
  { keys: 'F2', label: 'Edit' },
  { keys: 'Alt+N', label: 'New' },
  { keys: 'Ctrl+Enter', label: 'Save' },
  { keys: 'Esc', label: 'Close' },
];

export const APP_KEYBOARD_HINTS = DEFAULT_APP_HINTS;
export const FORM_KEYBOARD_HINTS = FORM_HINTS;

const ErpKeyboardHintBar = ({ items = DEFAULT_APP_HINTS, className = '', dense = false }) => {
  if (!items?.length) return null;

  return (
    <div
      className={`erp-kbd-hint-bar ${dense ? 'erp-kbd-hint-bar--dense' : ''} ${className}`.trim()}
      role="note"
      aria-label="Keyboard shortcuts"
    >
      <span className="erp-kbd-hint-bar__title">Keys</span>
      <div className="erp-kbd-hint-bar__scroll">
        {items.map((item, i) => (
          <span key={`${item.keys}-${item.label}-${i}`} className="erp-kbd-hint-item">
            <kbd className="erp-kbd">{item.keys}</kbd>
            <span className="erp-kbd-hint-label">{item.label}</span>
            {i < items.length - 1 ? <span className="erp-kbd-hint-sep" aria-hidden>·</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ErpKeyboardHintBar;
