import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { onApiLoadingChange } from '../../api/client';

const SHOW_BAR_AFTER_MS = 0;
const HIDE_BAR_AFTER_MS = 350;

const ApiLoader = () => {
  const [topBarLoading, setTopBarLoading] = useState(false);
  const [syncBadgeVisible, setSyncBadgeVisible] = useState(false);
  const [syncBadgeLabel, setSyncBadgeLabel] = useState('Loading…');
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onApiLoadingChange((isLoading, isMutating) => {
      setSyncBadgeLabel(isMutating ? 'Saving…' : 'Loading…');
      setSyncBadgeVisible(!!isLoading);

      if (isLoading) {
        busyRef.current = true;
        if (hideTimer.current) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }
        if (!showTimer.current) {
          showTimer.current = setTimeout(() => {
            showTimer.current = null;
            if (busyRef.current) setTopBarLoading(true);
          }, SHOW_BAR_AFTER_MS);
        }
      } else {
        busyRef.current = false;
        if (showTimer.current) {
          clearTimeout(showTimer.current);
          showTimer.current = null;
        }
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          hideTimer.current = null;
          setTopBarLoading(false);
        }, HIDE_BAR_AFTER_MS);
      }
    });
    return () => {
      unsubscribe();
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {topBarLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[9999] erp-loader-bar pointer-events-none"
          >
            <div className="erp-loader-bar__track" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {syncBadgeVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-4 left-4 z-[9998] pointer-events-none"
          >
            <div className="erp-sync-badge rounded-full pl-3 pr-4 py-2 flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-4 h-4 erp-sync-badge__icon animate-spin" />
              </div>
              <span className="text-[11px] font-semibold erp-sync-badge__label tracking-wide uppercase select-none">
                {syncBadgeLabel}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ApiLoader;
