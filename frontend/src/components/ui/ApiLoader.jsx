import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { onApiLoadingChange } from '../../api/client';

// Top progress bar   → shows for NON-silent API traffic (debounced so short GETs don't flicker)
// Bottom-right badge → ONLY for mutating requests: POST / PUT / PATCH / DELETE

const SHOW_BAR_AFTER_MS = 280;
const HIDE_BAR_AFTER_MS = 120;

const ApiLoader = () => {
  const [topBarLoading, setTopBarLoading] = useState(false);
  const [syncBadgeVisible, setSyncBadgeVisible] = useState(false);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onApiLoadingChange((isLoading, isMutating) => {
      setSyncBadgeVisible(!!isMutating);

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
            className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-slate-100 overflow-hidden pointer-events-none"
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="h-full w-1/2 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]"
            />
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
            className="fixed bottom-4 right-4 z-[9999] pointer-events-none"
          >
            <div className="bg-white/80 border border-slate-200/60 shadow-[0_8px_30px_rgb(15,23,42,0.06)] backdrop-blur-md rounded-full pl-3 pr-4 py-2 flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75 animate-ping" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700 tracking-wide uppercase select-none">
                Saving...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ApiLoader;
