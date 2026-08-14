import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X } from 'lucide-react';

/**
 * Smart transaction confirmation panel shown after successful saves
 * Displays what happened and offers quick navigation options
 */
const TransactionSuccessPanel = ({
  isVisible,
  onClose,
  title,
  message,
  details = [],
  quickActions = [],
  type = 'success', // success, warning, info
}) => {
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(onClose, 6000); // Auto-close after 6 seconds
    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  const bgColor = {
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  }[type];

  const iconColor = {
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  }[type];

  const titleColor = {
    success: 'text-emerald-900',
    warning: 'text-amber-900',
    info: 'text-blue-900',
  }[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`fixed top-6 right-6 z-[1000] w-full max-w-md rounded-xl border-2 ${bgColor} shadow-xl p-5`}
        >
          <div className="flex gap-4">
            <CheckCircle className={`${iconColor} shrink-0 mt-1`} size={24} />

            <div className="flex-1 min-w-0">
              <h4 className={`font-bold text-lg ${titleColor} mb-1`}>
                {title}
              </h4>

              {message && (
                <p className={`text-sm ${titleColor} opacity-80 mb-3`}>
                  {message}
                </p>
              )}

              {details.length > 0 && (
                <div className={`text-sm space-y-1 mb-4 p-3 rounded-lg ${type === 'success' ? 'bg-emerald-100/50' : type === 'warning' ? 'bg-amber-100/50' : 'bg-blue-100/50'}`}>
                  {details.map((detail, idx) => (
                    <div key={idx} className={`flex justify-between gap-3 ${titleColor} opacity-75`}>
                      <span className="font-medium">{detail.label}:</span>
                      <span className="font-bold text-right">{detail.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {quickActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        action.onClick?.();
                        onClose();
                      }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        action.variant === 'primary'
                          ? `${type === 'success' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : type === 'warning' ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`
                          : `${type === 'success' ? 'bg-emerald-200 text-emerald-900 hover:bg-emerald-300' : type === 'warning' ? 'bg-amber-200 text-amber-900 hover:bg-amber-300' : 'bg-blue-200 text-blue-900 hover:bg-blue-300'}`
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className={`shrink-0 mt-1 p-1 rounded-full hover:bg-black/5 transition-colors ${titleColor} opacity-60 hover:opacity-100`}
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TransactionSuccessPanel;
