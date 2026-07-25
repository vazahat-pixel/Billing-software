import React from 'react';
import useWindowDockStore from '../../store/useWindowDockStore';

/** Bottom taskbar — one chip per minimized ERP window */
export default function ErpWindowDockTray() {
  const items = useWindowDockStore((s) => s.items);
  if (!items.length) return null;

  return (
    <div className="erp-window-dock-tray" role="toolbar" aria-label="Minimized windows">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="erp-window-dock"
          onClick={() => item.restore?.()}
          title={`Restore ${item.title}`}
        >
          <span className="erp-window-dock-label">{item.title}</span>
          <span
            role="button"
            tabIndex={0}
            className="erp-window-dock-x"
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              item.close?.();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                item.close?.();
              }
            }}
          >
            X
          </span>
        </button>
      ))}
    </div>
  );
}
