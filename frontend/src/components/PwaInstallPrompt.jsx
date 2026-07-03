import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const PwaInstallPrompt = () => {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwaInstallDismissed') === 'true'
  );

  useEffect(() => {
    const onInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwaInstallDismissed', 'true');
    setDeferred(null);
  };

  if (!deferred || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[900] bg-white border border-slate-200 shadow-2xl rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
          <Download size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Install Textile ERP</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Add to your home screen for faster access and better offline support.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleInstall}
              className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-black text-white"
            >
              Install App
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border border-slate-200 text-slate-600"
            >
              Not Now
            </button>
          </div>
        </div>
        <button type="button" onClick={handleDismiss} className="text-slate-400 hover:text-slate-700">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
