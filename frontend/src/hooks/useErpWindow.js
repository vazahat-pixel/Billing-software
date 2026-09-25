import { useCallback, useEffect, useRef, useState } from 'react';
import useWindowDockStore, { yieldOtherWindows } from '../store/useWindowDockStore';

const TOP_CHROME = 72;
let windowZ = 1200;

/** Pull one ERP window above the others (ledger line → bill). */
export function focusErpWindow(windowId) {
  if (typeof window === 'undefined' || !windowId) return;
  window.dispatchEvent(new CustomEvent('erp-window-focus', { detail: { id: windowId } }));
}

/** Step a window into the dock so the document just opened is the one on screen. */
export function minimizeErpWindow(windowId) {
  if (typeof window === 'undefined' || !windowId) return;
  window.dispatchEvent(new CustomEvent('erp-window-minimize', { detail: { id: windowId } }));
}

const floatingSize = () => {
  if (typeof window === 'undefined') return { w: 1100, h: 640 };
  const maxW = Math.max(320, window.innerWidth - 24);
  const maxH = Math.max(280, window.innerHeight - TOP_CHROME - 28);
  return {
    w: Math.min(maxW, 1180),
    h: Math.min(maxH, 660),
  };
};

const floatingPos = (box) => {
  if (typeof window === 'undefined') return { x: 24, y: TOP_CHROME };
  return {
    x: Math.max(8, Math.round((window.innerWidth - box.w) / 2)),
    y: TOP_CHROME,
  };
};

/**
 * ERP bill window: maximized | normal (floating) | minimized (global dock tray).
 * @param {boolean} isOpen
 * @param {{ id?: string, title?: string, onClose?: () => void }} options
 */
export default function useErpWindow(isOpen, options = {}) {
  const { id = 'window', title = 'Window', onClose, defaultMode = 'normal' } = options;
  const [mode, setMode] = useState(defaultMode);
  const [z, setZ] = useState(1200);
  const [box, setBox] = useState(floatingSize);
  const [pos, setPos] = useState(() => floatingPos(floatingSize(), id));
  const resizing = useRef(null);
  const dragging = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleRef = useRef(title);
  onCloseRef.current = onClose;
  titleRef.current = title;

  const raise = useCallback(() => {
    setZ((current) => {
      if (current === windowZ && current > 1200) return current;
      windowZ += 1;
      return windowZ;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) setZ(1200);
  }, [isOpen]);

  useEffect(() => {
    const onFocus = (e) => {
      if (e.detail?.id === id) raise();
    };
    const onMin = (e) => {
      if (e.detail?.id === id && isOpen) setMode('minimized');
    };
    window.addEventListener('erp-window-focus', onFocus);
    window.addEventListener('erp-window-minimize', onMin);
    return () => {
      window.removeEventListener('erp-window-focus', onFocus);
      window.removeEventListener('erp-window-minimize', onMin);
    };
  }, [id, isOpen, raise]);

  useEffect(() => {
    if (!isOpen) {
      setMode(defaultMode);
      useWindowDockStore.getState().unregister(id);
    }
  }, [isOpen, id, defaultMode]);

  useEffect(() => {
    if (!isOpen || mode !== 'normal') return undefined;
    const fit = () => {
      const next = floatingSize();
      setBox(next);
      setPos(floatingPos(next));
    };
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [isOpen, mode]);
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
        raise();
        setMode(defaultMode === 'maximized' ? 'maximized' : 'normal');
      },
      close: () => {
        useWindowDockStore.getState().unregister(id);
        onCloseRef.current?.();
      },
    });
    return () => useWindowDockStore.getState().unregister(id);
  }, [isOpen, mode, id, title, raise, defaultMode]);

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

  // Opening maximized claims focus â€” ask others to minimize
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
      raise();
      if (mode !== 'normal') return;
      if (!e.target.closest?.('.classic-erp-header')) return;
      if (e.target.closest?.('button, input, select, textarea, a, .erp-window-controls')) return;
      onDragPointerDown(e);
    },
    [mode, onDragPointerDown, raise]
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
      ? 'erp-bill-window--max flex flex-col'
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
    inertBackdrop: mode !== 'maximized', // minimized windows must NOT block UI behind them
    windowId: id,
    z,
    focus: raise,
  };
}

