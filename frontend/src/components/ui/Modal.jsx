import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const Modal = ({ isOpen, onClose, title, children, className }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
          />
          
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className={twMerge(
              "relative bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col z-[1000] border border-slate-100 w-full max-w-5xl max-h-[90vh]",
              className
            )}
          >
            {/* Header */}
            <div className="bg-black py-6 px-10 flex items-center justify-between shrink-0">
               <div>
                  <h3 className="text-white font-black text-[12px] uppercase tracking-[0.2em] italic font-heading">
                    {title}<span className="text-white/30">.</span>
                  </h3>
               </div>
               <button 
                 onClick={onClose} 
                 className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white text-white hover:text-black rounded-xl transition-all"
               >
                 <X size={18} />
               </button>
            </div>
            
            {/* Body */}
            <div className="p-0 overflow-y-auto flex-1 bg-white text-black no-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
