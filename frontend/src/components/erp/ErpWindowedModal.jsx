import React from 'react';
import { twMerge } from 'tailwind-merge';
import Modal from '../ui/Modal';
import ErpWindowControls from './ErpWindowControls';
import useErpWindow from '../../hooks/useErpWindow';

/**
 * Modal + minimize / maximize / resize — dock chips live in global ErpWindowDockTray.
 */
export default function ErpWindowedModal({
  isOpen,
  onClose,
  title = 'Window',
  windowId,
  bare = true,
  className,
  children,
  ...modalProps
}) {
  const id = windowId || title || 'window';
  const win = useErpWindow(isOpen, { id, title, onClose });

  const WindowControls = () => (
    <ErpWindowControls
      isMaximized={win.isMaximized}
      onMinimize={win.minimize}
      onToggleMax={win.toggleMax}
      onClose={onClose}
    />
  );

  return (
    <Modal
      isOpen={isOpen && !win.isMinimized}
      onClose={onClose}
      bare={bare}
      style={win.modalStyle}
      className={twMerge(win.modalClassName, className)}
      inertBackdrop={win.inertBackdrop}
      {...modalProps}
    >
      <div
        className="flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg-card)] erp-bill-window-shell relative"
        onPointerDown={win.onShellPointerDown}
      >
        {typeof children === 'function' ? children({ win, WindowControls }) : children}
        {win.mode === 'normal' && (
          <div
            className="erp-window-resize-handle"
            onPointerDown={win.onResizePointerDown}
            title="Drag to resize"
          />
        )}
      </div>
    </Modal>
  );
}
