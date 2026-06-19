import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const Modal = ({ isOpen, onClose, title, children, className, footer, bare = false }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={twMerge(
              'relative flex flex-col z-[1000] w-full max-h-[96vh] overflow-hidden',
              bare
                ? 'max-w-5xl rounded-[var(--radius-card)] border border-[var(--border)] shadow-[var(--shadow-float)] bg-[var(--bg-card)]'
                : 'max-w-4xl rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-float)]',
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {!bare && (
              <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--bg-base)]">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
