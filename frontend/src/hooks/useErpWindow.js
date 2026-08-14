import { useCallback, useEffect, useRef, useState } from 'react';
import useWindowDockStore, { yieldOtherWindows } from '../store/useWindowDockStore';

const MIN_W = 640;
const MIN_H = 400;

const saltFromId = (id) => {
  const s = String(id || '');
  let n = 0;
  for (let i = 0; i < s.length; i += 1) n += s.charCodeAt(i);
  return n;
};

const floatingSize = () => {
  if (typeof window === 'undefined') return { w: 880, h: 540 };
  return {
    w: Math.min(880, Math.max(MIN_W, Math.floor(window.innerWidth * 0.62))),
    h: Math.min(560, Math.max(MIN_H, Math.floor(window.innerHeight * 0.68))),
  };
};

const floatingPos = (box, id) => {
  if (typeof window === 'undefined') return { x: 48, y: 56 };
  const offset = (saltFromId(id) % 6) * 28;
  const x = Math.max(24, window.innerWidth - box.w - 28 - offset);
  const y = Math.max(40, Math.min(72 + offset, window.innerHeight - box.h - 24));
  return { x, y };
};

/**
 * ERP bill window: maximized | normal (floating) | minimized (global dock tray).
 * @param {boolean} isOpen
 * @param {{ id?: string, title?: string, onClose?: () => void }} options
 */
export default function useErpWindow(isOpen, options = {}) {
  const { id = 'window', title = 'Window', onClose, defaultMode = 'maximized' } = options;
  const [mode, setMode] = useState(defaultMode);
  const [box, setBox] = useState(floatingSize);
  const [pos, setPos] = useState(() => floatingPos(floatingSize(), id));
  const resizing = useRef(null);
  const dragging = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleRef = useRef(title);
  onCloseRef.current = onClose;
  titleRef.current = title;

  useEffect(() => {
    if (!isOpen) {
      setMode(defaultMode);
      useWindowDockStore.getState().unregister(id);
    }
  }, [isOpen, id, defaultMode]);

  // Register / unregister minimized chip in global tray
  useEffect(() => {
    if (!isOpen || mode !== 'minimized') {
      useWindowDockStore.getState().unregister(id);
      return undefined;
    }
    useWindowDockStore.getState().register({
      id,
      title: titleRef.current || title || id,
      restore: () => {
        yieldOtherWindows(id);
        setMode('maximized');
      },
      close: () => {
        useWindowDockStore.getState().unregister(id);
        onCloseRef.current?.();
      },
    });
    return () => useWindowDockStore.getState().unregister(id);
  }, [isOpen, mode, id, title]);

  // When another window opens maximized, yield this one to the dock
  useEffect(() => {
    const onYield = (e) => {
      if (!isOpen) return;
      if (e.detail?.except === id) return;
      setMode((m) => (m === 'maximized' ? 'minimized' : m));
    };
    window.addEventListener('erp-window-yield', onYield);
    return () => window.removeEventListener('erp-window-yield', onYield);
  }, [id, isOpen]);

  // Opening maximized claims focus — ask others to minimize
  useEffect(() => {
    if (isOpen && mode === 'maximized') {
      yieldOtherWindows(id);
    }
  }, [isOpen, mode, id]);

  const goFloating = useCallback(() => {
    const next = floatingSize();
    setBox(next);
    setPos(floatingPos(next, id));
    setMode('normal');
  }, [id]);

  const minimize = useCallback(() => setMode('minimized'), []);
  const maximize = useCallback(() => {
    yieldOtherWindows(id);
    setMode('maximized');
  }, [id]);
  const restore = useCallback(() => goFloating(), [goFloating]);

  const toggleMax = useCallback(() => {
    setMode((m) => {
      if (m === 'maximized') {
        const next = floatingSize();
        setBox(next);
        setPos(floatingPos(next, id));
        return 'normal';
      }
      yieldOtherWindows(id);
      return 'maximized';
    });
  }, [id]);

  const onResizePointerDown = useCallback(
    (e) => {
      if (mode !== 'normal') return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = box.w;
      const startH = box.h;
      resizing.current = { startX, startY, startW, startH };

      const onMove = (ev) => {
        if (!resizing.current) return;
        const dw = ev.clientX - resizing.current.startX;
        const dh = ev.clientY - resizing.current.startY;
        setBox({
          w: Math.min(window.innerWidth - 16, Math.max(MIN_W, resizing.current.startW + dw)),
          h: Math.min(window.innerHeight - 16, Math.max(MIN_H, resizing.current.startH + dh)),
        });
      };
      const onUp = () => {
        resizing.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [mode, box.w, box.h]
  );

  const onDragPointerDown = useCallback(
    (e) => {
      if (mode !== 'normal') return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { x: pos.x, y: pos.y };
      dragging.current = { startX, startY, origin };

      const onMove = (ev) => {
        if (!dragging.current) return;
        const dx = ev.clientX - dragging.current.startX;
        const dy = ev.clientY - dragging.current.startY;
        setPos({
          x: Math.min(window.innerWidth - 80, Math.max(0, dragging.current.origin.x + dx)),
          y: Math.min(window.innerHeight - 48, Math.max(0, dragging.current.origin.y + dy)),
        });
      };
      const onUp = () => {
        dragging.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [mode, pos.x, pos.y]
  );

  const onShellPointerDown = useCallback(
    (e) => {
      if (mode !== 'normal') return;
      if (!e.target.closest?.('.classic-erp-header')) return;
      if (e.target.closest?.('button, input, select, textarea, a, .erp-window-controls')) return;
      onDragPointerDown(e);
    },
    [mode, onDragPointerDown]
  );

  const isFloating = mode === 'normal';

  const modalStyle = isFloating
    ? {
        width: box.w,
        height: box.h,
        left: pos.x,
        top: pos.y,
        maxWidth: '98vw',
        maxHeight: '96dvh',
        ['--erp-win-w']: `${box.w}px`,
        ['--erp-win-h']: `${box.h}px`,
        ['--erp-win-x']: `${pos.x}px`,
        ['--erp-win-y']: `${pos.y}px`,
      }
    : undefined;

  const modalClassName =
    mode === 'maximized'
      ? 'max-w-[98vw] w-[98vw] !h-[calc(100dvh-16px)] !max-h-[calc(100dvh-16px)] flex flex-col'
      : mode === 'normal'
        ? 'erp-bill-window--normal erp-bill-window--floating flex flex-col'
        : 'hidden';

  return {
    mode,
    box,
    pos,
    minimize,
    maximize,
    restore,
    toggleMax,
    onResizePointerDown,
    onDragPointerDown,
    onShellPointerDown,
    modalStyle,
    modalClassName,
    isMinimized: mode === 'minimized',
    isMaximized: mode === 'maximized',
    isFloating,
    inertBackdrop: isFloating,
    windowId: id,
  };
}
