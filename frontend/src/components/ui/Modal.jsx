import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const Modal = ({ isOpen, onClose, title, children, className, footer }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={twMerge(
              'relative flex flex-col z-[1000] w-full max-w-4xl max-h-[96vh] rounded-2xl overflow-hidden',
              'bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-float)]',
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-[var(--border)] bg-gradient-to-r from-[var(--bg-base)] to-[var(--bg-card)]">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

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
