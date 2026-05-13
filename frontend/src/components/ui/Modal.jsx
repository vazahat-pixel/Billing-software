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
              "relative bg-white rounded-xl shadow-xl overflow-hidden flex flex-col z-[1000] border border-[#E2E8F0]",
              className
            )}
          >
            {/* Header: 56px height, bg #1B3A6B, text white 16px font-weight 600 */}
            <div className="bg-[#1B3A6B] h-[56px] px-6 flex items-center justify-between shrink-0">
              <h3 className="text-white font-semibold text-[16px] tracking-tight">{title}</h3>
              <button 
                onClick={onClose} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Body: padding 20px 24px */}
            <div className="p-[20px_24px] overflow-y-auto flex-1 bg-white text-slate-800 no-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
