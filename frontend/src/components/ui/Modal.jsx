import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const Modal = ({ isOpen, onClose, title, children, className }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            style={{ width: 'min(90vw, 900px)', maxHeight: '90vh' }}
            className={twMerge(
              "relative bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col z-[1000] border border-slate-200",
              className
            )}
          >
            {/* Header: 56px height, bg Black, text white */}
            <div className="bg-black h-[52px] px-6 flex items-center justify-between shrink-0">
              <h3 className="text-white font-bold text-[13px] uppercase tracking-widest">{title}</h3>
              <button 
                onClick={onClose} 
                className="p-1.5 hover:bg-white/20 rounded-md text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-white text-black no-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
