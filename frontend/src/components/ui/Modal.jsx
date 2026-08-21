import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/**
 * @param {boolean} inertBackdrop — restore/floating mode: no dim overlay, clicks pass through to UI behind
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  footer,
  bare = false,
  enableEscape = true,
  style,
  inertBackdrop = false,
}) => {
  const contentRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !enableEscape || !onClose) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (e.target.closest('[data-command-palette]')) return;
      if (e.target.closest('.erp-combobox-dropdown')) return;
      // Floating windows: Esc should not always kill the bill — only when focus inside
      if (inertBackdrop) {
        const root = contentRef.current;
        if (root && !root.contains(document.activeElement) && document.activeElement !== root) {
          return;
        }
      }
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, enableEscape, inertBackdrop]);

  useEffect(() => {
    if (!isOpen || inertBackdrop) return undefined;
    const t = setTimeout(() => {
      const root = contentRef.current;
      if (!root) return;
      const first = root.querySelector(
        'input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), [data-erp-combobox-input]'
      );
      first?.focus();
    }, 120);
    return () => clearTimeout(t);
  }, [isOpen, inertBackdrop]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={twMerge(
            'fixed inset-0 z-[1200]',
            inertBackdrop
              ? 'pointer-events-none overflow-hidden'
              : 'z-[1200] flex items-center justify-center p-1.5 sm:p-2 overflow-hidden'
          )}
        >
          {!inertBackdrop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-[6px]"
            />
          )}

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            style={style}
            className={twMerge(
              'relative flex flex-col w-full max-h-[calc(100dvh-12px)] overflow-hidden border border-slate-200/80 shadow-[0_20px_50px_rgba(15,23,42,0.12)]',
              inertBackdrop ? 'pointer-events-auto z-[2000]' : 'z-[1500]',
              bare
                ? 'max-w-5xl rounded-[var(--radius-card)] bg-[var(--bg-card)]'
                : 'max-w-4xl rounded-2xl bg-[var(--bg-card)]',
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {!bare && (
              <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div ref={contentRef} className="flex-1 min-h-0 overflow-hidden flex flex-col" data-form-enter-nav>
              {children}
            </div>

            {footer && (
              <div className="erp-modal-footer shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
