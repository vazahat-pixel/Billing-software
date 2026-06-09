import React, { useEffect } from 'react';
import useStore from '../../store/useStore';

const AuthBootstrap = ({ children }) => {
  const { sessionReady, restoreSession, bootstrapMasters, token } = useStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (sessionReady && token) {
      bootstrapMasters();
    }
  }, [sessionReady, token, bootstrapMasters]);

  if (!sessionReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading ERP...</p>
      </div>
    );
  }

  return children;
};

export default AuthBootstrap;
