import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDesktop,
  faDownload,
  faCheckCircle,
  faBolt,
  faPrint,
  faCloudArrowUp,
  faKeyboard,
  faShieldHalved,
  faCopy,
  faCheck,
  faTimes,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '../ui/Modal';
import { toast } from '../../store/useToastStore';

export default function DownloadDesktopModal({ isOpen, onClose }) {
  const [downloadInfo, setDownloadInfo] = useState({
    fileName: 'BillingSoftware-Setup.exe',
    version: '1.0.0',
    sizeMB: '79.6 MB',
    releaseDate: 'October 2026',
    os: 'Windows 10 / 11 (64-bit)',
    downloadUrl: '/downloads/BillingSoftware-Setup.exe',
  });
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/desktop/download-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((res) => {
        if (res?.success && res.data) {
          setDownloadInfo((prev) => ({
            ...prev,
            ...res.data,
            downloadUrl: res.data.directUrl || res.data.downloadUrl || prev.downloadUrl,
          }));
        }
      })
      .catch(() => {
        // Fallback to default direct static link
      });
  }, [isOpen]);

  const handleDownload = () => {
    setDownloading(true);
    const link = document.createElement('a');
    link.href = downloadInfo.downloadUrl || '/downloads/BillingSoftware-Setup.exe';
    link.setAttribute('download', downloadInfo.fileName || 'BillingSoftware-Setup.exe');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Downloading Billing Software Desktop Setup (.exe)...');
    setTimeout(() => {
      setDownloading(false);
    }, 3000);
  };

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${downloadInfo.downloadUrl || '/downloads/BillingSoftware-Setup.exe'}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      toast.success('Download link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-md">
              <FontAwesomeIcon icon={faDesktop} className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Billing Software for Windows</h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                  Official Desktop App
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Native Windows experience • Real-time cloud database sync • Direct POS/Laser printing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <FontAwesomeIcon icon={faTimes} className="text-lg" />
          </button>
        </div>

        {/* Hero Card */}
        <div className="mt-5 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/10 text-white text-[11px] font-medium backdrop-blur-xs mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Version {downloadInfo.version} • Windows 64-bit</span>
              </div>
              <h3 className="text-lg font-bold text-white leading-tight">
                Textile & General Billing ERP
              </h3>
              <p className="text-xs text-blue-200/90 mt-1 max-w-md">
                Fast keyboard entry, background cloud sync to <strong className="text-white">app.dealingindia.com</strong>, zero browser distractions.
              </p>
              <div className="mt-2 text-[11px] text-blue-300/80">
                Setup File: <span className="text-white font-mono">{downloadInfo.fileName}</span> ({downloadInfo.sizeMB})
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-75"
              >
                <FontAwesomeIcon
                  icon={downloading ? faCheckCircle : faDownload}
                  className={`text-base ${downloading ? 'animate-bounce' : ''}`}
                />
                <span>{downloading ? 'Downloading...' : 'Download Setup (.exe)'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                title="Copy direct download link to share with staff or clients"
              >
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="text-xs text-blue-300" />
                <span>{copied ? 'Link Copied!' : 'Copy Download Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <FontAwesomeIcon icon={faBolt} className="text-sm" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Ultra-Fast Desktop Engine</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Launches instantly with an independent window. Smooth animations and no browser tab refresh delays.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              <FontAwesomeIcon icon={faCloudArrowUp} className="text-sm" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">100% Live Cloud Synced</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Directly connected to cloud MongoDB. Multiple PCs and web logins stay synchronized in real time.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
              <FontAwesomeIcon icon={faPrint} className="text-sm" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Hardware & Thermal Printing</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Prints GST invoices, delivery challans, and 3-inch thermal receipts without browser print dialog boxes.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <FontAwesomeIcon icon={faKeyboard} className="text-sm" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Tally / JSM Hotkeys</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Full shortcut system (F2 Date, F4 Sales, F5 Purchase, Esc Back, Enter forward) for lightning data entry.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Step Installation Guide */}
        <div className="mt-5 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <FontAwesomeIcon icon={faShieldHalved} className="text-blue-600" />
            <span>Quick 3-Step Setup Instructions</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-white border border-blue-200 shadow-2xs">
              <div className="font-bold text-blue-950 flex items-center gap-1.5 mb-1">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Download</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Click the download button above to get <code className="text-slate-800 font-mono bg-slate-100 px-1 rounded">BillingSoftware-Setup.exe</code>.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-blue-200 shadow-2xs">
              <div className="font-bold text-blue-950 flex items-center gap-1.5 mb-1">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Install</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Double click the downloaded file, click "Next" and finish the install. A desktop icon will be created automatically.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-blue-200 shadow-2xs">
              <div className="font-bold text-blue-950 flex items-center gap-1.5 mb-1">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                <span>Sign In</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Open from Desktop, login with your existing company credentials and all your data is ready instantly!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-500">
          <div>
            Direct Link: <a href={downloadInfo.downloadUrl} className="text-blue-600 hover:underline font-mono text-[11px]" target="_blank" rel="noreferrer">{window.location.origin}{downloadInfo.downloadUrl}</a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
