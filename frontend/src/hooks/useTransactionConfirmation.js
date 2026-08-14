import { useState, useCallback } from 'react';

/**
 * Hook for managing transaction success confirmations with inventory details
 * Usage:
 *   const { show, confirmation, close } = useTransactionConfirmation();
 *   show({ type: 'purchase', title: '...', message: '...', details: [...], actions: [...] })
 */
export const useTransactionConfirmation = () => {
  const [confirmation, setConfirmation] = useState({
    isVisible: false,
    type: 'success',
    title: '',
    message: '',
    details: [],
    quickActions: [],
    transactionId: null,
  });

  const show = useCallback((config) => {
    setConfirmation((prev) => ({
      ...prev,
      isVisible: true,
      type: config.type || 'success',
      title: config.title || 'Transaction Completed',
      message: config.message || '',
      details: config.details || [],
      quickActions: config.quickActions || [],
      transactionId: config.transactionId || null,
    }));
  }, []);

  const close = useCallback(() => {
    setConfirmation((prev) => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  const update = useCallback((partial) => {
    setConfirmation((prev) => ({
      ...prev,
      ...partial,
    }));
  }, []);

  return { show, close, update, confirmation };
};

export default useTransactionConfirmation;
