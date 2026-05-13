import React from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { motion, AnimatePresence } from 'framer-motion';

const MainLayout = () => {
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  if (isDashboard) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-900">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-5 no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={window.location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
