import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Download,
  Monitor,
  Cloud,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  BarChart3,
  FileText,
  Layers,
  Lock,
  RefreshCw,
  Star,
  Award,
  HelpCircle,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Cpu,
  Check,
  Copy,
  ExternalLink,
  Laptop,
  Truck,
  Scissors,
  Receipt,
  Building2,
  Calendar,
  CheckCircle,
  FileCheck2,
  Smartphone,
  Users,
  Printer,
  Database,
  Network,
  HardDrive,
  Info,
  Sun,
  Moon,
  Building,
  Clock,
  Shield
} from 'lucide-react';
import { toast } from '../../store/useToastStore';

export default function LandingPage() {
  const navigate = useNavigate();
  // Light theme by default as requested: "light bhi them bhi rakho enhance need and clean type ok"
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('di_landing_theme');
    return saved === 'dark';
  });

  const [activeTab, setActiveTab] = useState('sales');
  const [openFaq, setOpenFaq] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    document.title = 'Dealing India - Textile Billing & ERP Software | Offline Desktop & Cloud';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Dealing India Billing Software — Complete Textile ERP for traders, weavers, grey mills, and job workers. Download Windows desktop application (.exe) or login online.'
      );
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('di_landing_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const downloadUrl = '/downloads/BillingSoftware-Setup.exe';
  const downloadAltUrl = '/downloads/TextileERP-Setup-1.0.0.exe';

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${downloadUrl}`;
    navigator.clipboard?.writeText(fullUrl).then(() => {
      setCopiedLink(true);
      toast.success('Download link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 3000);
    }).catch(() => {
      toast.info(`Download link: ${fullUrl}`);
    });
  };

  const tabs = [
    {
      id: 'sales',
      label: 'Textile Billing (Sales)',
      icon: Receipt,
      headline: 'Lightning-Fast Sales Invoicing Tailored for Textile Mandis',
      description: 'Enter sales invoices with taka, pcs, meters, cut length, fold less/add percentage, broker commission, LR number, and transport details with 100% keyboard navigation.',
      features: [
        'Detailed Taka & Pcs breakdown (Pcs × Qty/Bndl auto-multiplier)',
        'Fold Less / Fold Add deduction automatically synced with net amount',
        'Multi-broker support with optional empty broker selection',
        'Direct 1-click Thermal & A4/A5 GST Invoice printing with QR code & LR details'
      ],
      previewStats: [
        { label: 'Avg Invoicing Time', val: '45 Seconds' },
        { label: 'Shortcuts', val: '100% Keyboard (Enter/F2/F4)' },
        { label: 'Print Layouts', val: 'A4, A5 & Surat Standard' }
      ]
    },
    {
      id: 'mill',
      label: 'Mill Issue & Receive',
      icon: Truck,
      headline: 'Complete Job Work & Process House Management',
      description: 'Track grey fabric sent to process mills for dyeing, printing, bleaching, and finishing. Maintain auto-incrementing challan numbers and shrinkage/wastage records.',
      features: [
        'Sequential Auto-Increment Challans (1, 2, 3, 4...) with zero duplicates',
        'Track process charges per meter (Dyeing, Printing, Bleaching, Finishing)',
        'Tolerance & Wastage/Shrinkage percentage monitoring per lot',
        'Direct Mill Return entry with auto-adjustment of open challans'
      ],
      previewStats: [
        { label: 'Challan Tracking', val: 'Auto-Sequence 1, 2, 3...' },
        { label: 'Wastage Analysis', val: 'Real-Time Shrinkage %' },
        { label: 'Process Houses', val: 'Unlimited Dyeing/Finishing' }
      ]
    },
    {
      id: 'inventory',
      label: 'Grey Stock & Lot Inventory',
      icon: Layers,
      headline: 'Real-Time Roll, Taka & Godown Lot Tracking',
      description: 'Never lose track of fabric meters across multiple godowns. Manage grey stock receipts, beam entries, cut lengths, roll numbers, and physical stock reconciliation.',
      features: [
        'Lot-wise Grey & Finished Fabric stock valuation',
        'Cut-length and roll piece tracking with barcode generation',
        'Multiple Godown & Branch stock transfers with audit trails',
        'Physical stock check & meter discrepancy reconciliation'
      ],
      previewStats: [
        { label: 'Inventory Accuracy', val: '99.98% Yardage' },
        { label: 'Stock Lookup', val: '< 0.1s by Lot/Item' },
        { label: 'Godown Locations', val: 'Multi-Godown Support' }
      ]
    },
    {
      id: 'gst',
      label: 'GST Filing & E-Way Bill',
      icon: FileCheck2,
      headline: '1-Click GST Returns & Instant E-Way Bill Generation',
      description: 'Generate government-compliant GSTR-1 and GSTR-3B JSON exports, automate HSN summaries, and generate E-Way Bills without repetitive portal data entry.',
      features: [
        'Direct GSTR-1 (B2B, B2C, HSN, CDNR) JSON export ready for GST portal',
        'Automated E-Way Bill generation with vehicle and distance autofill',
        'Comprehensive 2A/2B Purchase reconciliation with AI OCR invoice import',
        'CA Dashboard portal for your Chartered Accountant to audit returns'
      ],
      previewStats: [
        { label: 'GSTR-1 Export', val: 'Portal Ready JSON' },
        { label: 'E-Way Bill Time', val: 'Instant 1-Click' },
        { label: 'Tax Calculations', val: '100% Error-Free GST' }
      ]
    },
    {
      id: 'accounting',
      label: 'Cash, Bank & Accounting',
      icon: BarChart3,
      headline: 'Full Double-Entry Financial Accounting Built-in',
      description: 'Manage Bank Receipts, Bank Payments, Cash Books, Party Ledgers with Zoom drill-down, and Cheque Clearance dates — all integrated directly with your bills.',
      features: [
        'Automatic Outstanding Bill adjustment on Receipt/Payment entry',
        'Bank Cheque Clearance date tracking with default today fill',
        'Zoom Ledger: Click any entry to inspect original voucher instantly',
        'Age-wise Outstanding Reports & Party payment reminders'
      ],
      previewStats: [
        { label: 'Ledger Audit', val: 'Instant Zoom Drill' },
        { label: 'Cheque Tracking', val: 'Clear Dt & Status' },
        { label: 'Outstanding', val: 'Age-Wise (0-90 Days)' }
      ]
    }
  ];

  const softwareSpecs = [
    {
      icon: Laptop,
      color: 'blue',
      title: '100% Offline-First Architecture',
      desc: 'Runs on a high-speed local engine (SQLite / Embedded DB). Even if your internet connection goes down for hours, billing, printing, and challans work without interruption.'
    },
    {
      icon: Cloud,
      color: 'emerald',
      title: 'Seamless Real-Time Cloud Sync',
      desc: 'The moment internet connectivity is detected, all local vouchers sync securely with cloud servers with zero collisions, ensuring multi-branch consistency.'
    },
    {
      icon: Printer,
      color: 'purple',
      title: 'Universal Hardware & Printer Support',
      desc: 'Direct plug-and-play with 2-inch and 3-inch thermal POS receipt printers, ESC/POS printers, TSC/Argox barcode label printers, and regular A4/A5 laser printers.'
    },
    {
      icon: Zap,
      color: 'amber',
      title: 'High-Density Keyboard Speed',
      desc: 'Engineered for fast mandi counters: 100% keyboard navigation with Enter key jumping, arrow key dropdown selection, and custom hotkeys (F2, F4, Alt+S).'
    },
    {
      icon: ShieldCheck,
      color: 'indigo',
      title: 'Military-Grade Data Security',
      desc: 'Local database encryption (AES-256), encrypted API channels, automated daily local ZIP backups, and automatic cloud snapshots to prevent data loss.'
    },
    {
      icon: Users,
      color: 'rose',
      title: 'Multi-User & Role-Based Access',
      desc: 'Connect unlimited computers on your office LAN. Assign granular permissions for Billing Operators, Accountants, Godown Incharges, and Administrators.'
    }
  ];

  const faqs = [
    {
      q: 'Does Dealing India Billing Software work completely offline without Internet?',
      a: 'Yes! Dealing India is built on an enterprise offline-first hybrid architecture. When you install the Windows Desktop (.exe) application, you can generate sales bills, mill issues, print invoices, and check stock completely offline without any Internet connection. As soon as your internet connects, all data automatically syncs with the secure cloud.'
    },
    {
      q: 'How do I download and install the software on my PC?',
      a: 'Simply click the "Download Windows App (.EXE)" button on this page. Save the installer file (BillingSoftware-Setup.exe), double-click to install it. An icon will appear on your desktop. Open the app, login or create your company, and you are ready to bill in under 2 minutes!'
    },
    {
      q: 'Can multiple users or computers access the same company data?',
      a: 'Absolutely. Dealing India supports multi-user networking. Multiple computers in your office or shop can connect over your local LAN or sync over the cloud so your sales team, accountant, and godown manager can work together simultaneously.'
    },
    {
      q: 'Can I upload supplier purchase bills in PDF or photo format to autofill?',
      a: 'Yes! The software includes an AI Auto Bill Fill engine. You can upload any supplier purchase bill in PDF, JPG, or PNG format. The software reads the bill number, vendor GSTIN, and item line rows (meters, rate, amount) automatically and fills the purchase voucher in 1 click.'
    },
    {
      q: 'Is my data secure and backed up?',
      a: 'Your data is 100% encrypted and backed up. With the offline-first engine, your database remains safely stored on your local hard drive, and an automated backup is synced to enterprise cloud servers with daily snapshots.'
    },
    {
      q: 'Can I use the software online in a web browser without installing?',
      a: 'Yes! Click the "Online Web Login" button in the navigation bar to access app.dealingindia.com from any laptop, Mac, tablet, or smartphone without installing anything.'
    }
  ];

  const activeTabData = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-200 ${
      isDark ? 'bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white' : 'bg-slate-50/60 text-slate-900 selection:bg-blue-600 selection:text-white'
    }`}>
      {/* 1. TOP ANNOUNCEMENT BANNER */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-emerald-600 text-white text-[12px] font-medium py-2 px-4 text-center flex items-center justify-center gap-2 shadow-sm">
        <Sparkles size={14} className="animate-pulse shrink-0" />
        <span>Dealing India v2.4.0 Released: Offline Windows Desktop App + Live Cloud Sync Now Available!</span>
        <a
          href={downloadUrl}
          download="BillingSoftware-Setup.exe"
          className="underline ml-2 hover:text-amber-200 transition-colors font-bold inline-flex items-center gap-1"
        >
          Download Free (.EXE) <ArrowRight size={12} />
        </a>
      </div>

      {/* 2. STICKY NAVBAR */}
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors ${
        isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white/95 border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/landing" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform font-black text-xl tracking-wider">
              DI
            </div>
            <div>
              <div className={`text-lg font-black tracking-tight flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                DEALING INDIA
                <span className="text-[10px] uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20 px-1.5 py-0.2 rounded font-bold">
                  ERP
                </span>
              </div>
              <div className={`text-[10px] font-medium tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Textile Billing & Inventory Software
              </div>
            </div>
          </Link>

          {/* Desktop Nav Links (Updated with Software Information and About) */}
          <nav className={`hidden md:flex items-center gap-6 text-[13px] font-semibold ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#software-info" className="hover:text-blue-600 transition-colors">Software Information</a>
            <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
            <a href="#desktop-app" className="hover:text-blue-600 transition-colors">Desktop (.EXE)</a>
            <a href="#faqs" className="hover:text-blue-600 transition-colors">FAQs</a>
          </nav>

          {/* Action CTAs & Theme Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title={isDark ? 'Switch to Clean Light Theme' : 'Switch to Dark Theme'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              <span className="hidden sm:inline text-[11px]">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            <Link
              to="/login"
              className={`px-3.5 py-2 text-[12px] font-bold rounded-lg border transition-all flex items-center gap-1.5 shadow-sm ${
                isDark
                  ? 'text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border-slate-700'
                  : 'text-slate-700 hover:text-blue-600 bg-white hover:bg-slate-50 border-slate-200'
              }`}
              title="Launch Dealing India Cloud Web Version"
            >
              <Cloud size={14} className="text-blue-600" />
              <span>Online Login</span>
            </Link>

            <a
              href={downloadUrl}
              download="BillingSoftware-Setup.exe"
              className="px-4 py-2 text-[12px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-md shadow-blue-600/20 hover:shadow-blue-600/40 transition-all flex items-center gap-2 group"
            >
              <Download size={14} className="group-hover:-translate-y-0.5 transition-transform" />
              <span className="hidden sm:inline">Download</span> .EXE
            </a>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className={`relative pt-14 pb-16 overflow-hidden ${
        isDark
          ? 'bg-slate-950'
          : 'bg-gradient-to-b from-white via-slate-50/50 to-blue-50/30'
      }`}>
        {/* Ambient Subtle Glow Background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-blue-500/10 via-indigo-500/10 to-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Pill Badge */}
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5 shadow-sm border ${
            isDark
              ? 'bg-slate-900 border-blue-500/30 text-blue-400'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-4" />
            <span>India's Most Trusted Textile & Fabric Billing Software</span>
          </div>

          {/* Main Headline */}
          <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-[1.15] ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            Speed, Precision & Full Control For Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500">
              Textile Business
            </span>
          </h1>

          {/* Subtitle */}
          <p className={`mt-5 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}>
            Manage Grey & Finished Stock, Mill Issue/Receive, Job Cards, Lot Tracking, Taka Pcs Breakdown, GST Returns & Financial Accounting — <strong className={isDark ? 'text-white' : 'text-slate-900'}>100% Offline on Windows Desktop PC</strong> with Instant Cloud Sync.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <a
              href={downloadUrl}
              download="BillingSoftware-Setup.exe"
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25 flex items-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download size={18} />
              <span>Download for Windows (.EXE)</span>
              <span className="text-[11px] bg-blue-900/60 px-2 py-0.5 rounded text-blue-100 font-mono font-normal">
                v2.4.0
              </span>
            </a>

            <Link
              to="/login"
              className={`px-6 py-3.5 rounded-xl font-bold text-sm border shadow-sm flex items-center gap-2 transition-all hover:scale-[1.02] ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              <Cloud size={18} className="text-blue-600" />
              <span>Launch Cloud Web Version</span>
              <ArrowRight size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
            </Link>

            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-4 py-3.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                isDark
                  ? 'bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                  : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200'
              }`}
              title="Copy direct installer download link"
            >
              {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Download Link'}</span>
            </button>
          </div>

          {/* Micro Trust Indicators */}
          <div className={`mt-7 flex flex-wrap items-center justify-center gap-6 text-[12px] font-medium ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-emerald-600" /> 100% Virus-Free & Safe Setup
            </span>
            <span className="flex items-center gap-1.5">
              <Monitor size={15} className="text-blue-600" /> Windows 10 & 11 (64-bit)
            </span>
            <span className="flex items-center gap-1.5">
              <Zap size={15} className="text-amber-500" /> Offline-First Engine
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 size={15} className="text-indigo-600" /> Surat Textile Standard
            </span>
          </div>

          {/* 4. REALISTIC ERP SOFTWARE PREVIEW MOCKUP */}
          <div className={`mt-10 relative max-w-5xl mx-auto rounded-2xl p-2 shadow-2xl border transition-all ${
            isDark
              ? 'bg-gradient-to-b from-slate-800/60 to-slate-900/80 border-slate-700/80 shadow-blue-950/40'
              : 'bg-gradient-to-b from-slate-200 to-slate-300/80 border-slate-300 shadow-slate-300/60'
          }`}>
            <div className={`rounded-xl overflow-hidden border shadow-inner ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              {/* Window Titlebar */}
              <div className={`px-4 py-2.5 border-b flex items-center justify-between text-xs ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <span className={`font-mono ml-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Dealing India — Surat Demo Textile Mills Pvt Ltd [PROCESS ISSUE & RECEIPT]
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1 text-[11px] font-semibold border px-2 py-0.5 rounded ${
                    isDark
                      ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE SYNC
                  </span>
                  <span className={`text-[11px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>v2.4.0</span>
                </div>
              </div>

              {/* High-Density ERP Screen Body */}
              <div className={`p-4 text-left space-y-3 ${isDark ? 'bg-slate-900/90' : 'bg-slate-50/70'}`}>
                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className={`p-2.5 rounded-lg border shadow-xs ${
                    isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Today Sales</div>
                    <div className={`text-lg font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>₹ 4,82,450.00</div>
                    <div className="text-[10px] text-emerald-600 font-semibold">↑ 12 Invoices Generated</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border shadow-xs ${
                    isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Outstanding</div>
                    <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">₹ 18,92,300.00</div>
                    <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>24 Parties with Dues</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border shadow-xs ${
                    isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Grey Stock Lots</div>
                    <div className="text-lg font-bold text-blue-600 font-mono mt-0.5">1,48,220 Mts</div>
                    <div className="text-[10px] text-blue-600 font-medium">84 Active Godown Lots</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border shadow-xs ${
                    isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>In Process at Mill</div>
                    <div className="text-lg font-bold text-indigo-600 font-mono mt-0.5">62,800 Mts</div>
                    <div className="text-[10px] text-indigo-600 font-medium">Challan #1 to #8 Pending</div>
                  </div>
                </div>

                {/* Sample Grid Preview */}
                <div className={`border rounded-lg overflow-hidden shadow-xs ${
                  isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div className={`px-3 py-1.5 text-[11px] font-bold flex justify-between items-center ${
                    isDark ? 'bg-slate-800/80 text-slate-200' : 'bg-slate-100 text-slate-800 border-b border-slate-200'
                  }`}>
                    <span>LIVE VOUCHER: SALES BILL #INV-2026-0042 [PARTY: HARSHIKA TEXTILES, SURAT]</span>
                    <span className="text-emerald-600 font-mono">STATUS: SAVED & E-WAY SYNCED</span>
                  </div>
                  <div className="overflow-x-auto text-[11px] font-mono">
                    <table className="w-full text-left border-collapse">
                      <thead className={`border-b text-[10px] uppercase ${
                        isDark ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <tr>
                          <th className="p-2">Item Name</th>
                          <th className="p-2 text-center">Fold %</th>
                          <th className="p-2 text-center">Cut</th>
                          <th className="p-2 text-center">Pcs</th>
                          <th className="p-2 text-right">Mts</th>
                          <th className="p-2 text-right">Rate</th>
                          <th className="p-2 text-right">Amount</th>
                          <th className="p-2 text-center">GST</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${
                        isDark ? 'divide-slate-800/60 text-slate-300' : 'divide-slate-200 text-slate-700'
                      }`}>
                        <tr className={isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/80'}>
                          <td className={`p-2 font-sans font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>60 GRAM CRUSH PRINT</td>
                          <td className="p-2 text-center text-amber-600 font-medium">100.00</td>
                          <td className="p-2 text-center">100.0</td>
                          <td className="p-2 text-center font-bold text-blue-600">12</td>
                          <td className="p-2 text-right font-bold">1,200.00</td>
                          <td className="p-2 text-right">₹ 48.50</td>
                          <td className={`p-2 text-right font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹ 58,200.00</td>
                          <td className="p-2 text-center text-emerald-600 font-bold">5.0%</td>
                        </tr>
                        <tr className={isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/80'}>
                          <td className={`p-2 font-sans font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>HEAVY CAPSULE FOIL</td>
                          <td className="p-2 text-center text-amber-600 font-medium">100.00</td>
                          <td className="p-2 text-center">80.0</td>
                          <td className="p-2 text-center font-bold text-blue-600">18</td>
                          <td className="p-2 text-right font-bold">1,440.00</td>
                          <td className="p-2 text-right">₹ 62.00</td>
                          <td className={`p-2 text-right font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹ 89,280.00</td>
                          <td className="p-2 text-center text-emerald-600 font-bold">5.0%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className={`px-3 py-2 border-t flex justify-between items-center text-xs ${
                    isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Broker: <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>PRAVINBHAI SHAH (1.0%)</span> · Transport: <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>SURAT GOODS (LR: 48210)</span>
                    </div>
                    <div className="text-right">
                      <span className={`mr-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Net Bill Amount:</span>
                      <span className="text-sm font-bold text-emerald-600 font-mono">₹ 1,54,854.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. QUICK METRICS */}
      <section className={`py-10 border-y transition-colors ${
        isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-black text-blue-600 font-mono">
                5,000+
              </div>
              <div className={`text-xs mt-1 font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Textile Businesses
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">
                ₹850 Cr+
              </div>
              <div className={`text-xs mt-1 font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Vouchers Processed
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-amber-500 font-mono">
                100%
              </div>
              <div className={`text-xs mt-1 font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Offline Desktop Support
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-indigo-600 font-mono">
                0.2s
              </div>
              <div className={`text-xs mt-1 font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Keyboard Navigation
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. INTERACTIVE FEATURE MODULE EXPLORER */}
      <section id="features" className="py-16 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1.5">
              Comprehensive ERP Suite
            </h2>
            <h3 className={`text-3xl sm:text-4xl font-black tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Engineered for Every Stage of the Textile Supply Chain
            </h3>
            <p className={`mt-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Click through the modules below to see how Dealing India transforms everyday billing, inventory control, and accounting into effortless operations.
            </p>
          </div>

          {/* Module Selector Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-105'
                      : isDark
                      ? 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Detailed View Card */}
          <div className={`border rounded-2xl p-6 sm:p-8 shadow-lg transition-all ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={12} /> {activeTabData.label}
                </div>
                <h4 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {activeTabData.headline}
                </h4>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {activeTabData.description}
                </p>

                <div className="space-y-2.5 pt-2">
                  {activeTabData.features.map((feat, idx) => (
                    <div key={idx} className={`flex items-start gap-2.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <a
                    href={downloadUrl}
                    download="BillingSoftware-Setup.exe"
                    className="px-5 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-all shadow-sm"
                  >
                    <Download size={14} /> Download & Try It Free
                  </a>
                  <Link
                    to="/login"
                    className={`px-4 py-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span>Open Web Demo</span> <ArrowRight size={12} />
                  </Link>
                </div>
              </div>

              {/* Right Side Card Preview with Metrics */}
              <div className={`lg:col-span-5 p-6 rounded-xl border shadow-inner space-y-3.5 text-left ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <span>Performance Benchmarks</span>
                  <Award size={15} className="text-amber-500" />
                </div>
                <div className="space-y-2.5">
                  {activeTabData.previewStats.map((st, i) => (
                    <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}>
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{st.label}</span>
                      <span className="text-xs font-bold font-mono text-emerald-600">{st.val}</span>
                    </div>
                  ))}
                </div>
                <div className={`p-3 rounded-lg text-[11px] leading-snug border ${
                  isDark
                    ? 'bg-blue-950/40 border-blue-800/30 text-blue-300'
                    : 'bg-blue-50/80 border-blue-200 text-blue-800'
                }`}>
                  💡 <strong>Surat Mandi Standard:</strong> Designed with feedback from textile merchants in Ring Road, Mill Gate, and Bombay Market for maximum speed.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. NEW SECTION: SOFTWARE INFORMATION */}
      <section id="software-info" className={`py-16 border-t transition-colors ${
        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
              <Info size={14} /> Software Specifications & Technical Details
            </h2>
            <h3 className={`text-3xl sm:text-4xl font-black tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Built for Unstoppable Reliability & Textile Scale
            </h3>
            <p className={`mt-3 text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Dealing India combines the rock-solid speed of native Windows desktop applications with the flexibility of modern cloud enterprise architecture.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {softwareSpecs.map((spec, i) => {
              const Icon = spec.icon;
              return (
                <div
                  key={i}
                  className={`p-6 rounded-2xl border transition-all hover:shadow-md ${
                    isDark
                      ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200 hover:border-blue-200 hover:bg-white'
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-4">
                    <Icon size={22} />
                  </div>
                  <h4 className={`text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {spec.title}
                  </h4>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {spec.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Quick Technical Specs Table */}
          <div className={`mt-10 rounded-2xl border overflow-hidden ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className={`px-5 py-3 border-b text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              <span>Technical Compatibility & System Specifications</span>
              <span className="text-blue-600 font-mono">v2.4.0 Certified</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 text-xs">
              <div className="p-4 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Operating System</div>
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Windows 10, 11 (64-bit)</div>
                <div className="text-[10px] text-slate-500">Also runs on Web & Tablets</div>
              </div>
              <div className="p-4 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Hardware Min Req.</div>
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>4 GB RAM / 1 GB Disk</div>
                <div className="text-[10px] text-slate-500">Intel Core i3 or equivalent</div>
              </div>
              <div className="p-4 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Printer Drivers</div>
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>TSC, TVS, Epson, Laser</div>
                <div className="text-[10px] text-slate-500">ESC/POS & Standard A4/A5</div>
              </div>
              <div className="p-4 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Backup Engine</div>
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Daily Local + Cloud</div>
                <div className="text-[10px] text-slate-500">AES-256 Encrypted Snapshots</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. NEW SECTION: ABOUT US */}
      <section id="about" className={`py-16 border-t transition-colors ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50/60 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-5 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 text-xs font-bold uppercase tracking-wider">
                <Building size={14} /> About Dealing India
              </div>
              <h3 className={`text-3xl sm:text-4xl font-black tracking-tight leading-snug ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Born in Surat's Textile Markets, Built for Indian Fabric Leaders
              </h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Dealing India was founded with one primary goal: to free textile traders, grey fabric brokers, weavers, and process houses from cumbersome manual registers and slow, generic accounting software.
              </p>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Our engineering team worked directly inside the textile hubs of <strong>Ring Road, Mill Gate, and Bombay Market</strong> in Surat to understand how fabric bills actually move — handling taka fold percentage deductions, cut lengths, multi-broker commissions, and mill process challans in seconds.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}>
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>10+ Years Experience</div>
                    <div className="text-[11px] text-slate-500">Dedicated textile ERP domain</div>
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}>
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <Phone size={18} />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Direct Local Support</div>
                    <div className="text-[11px] text-slate-500">Phone, WhatsApp & On-site Help</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side Stats & Mission Card */}
            <div className={`lg:col-span-5 p-7 rounded-3xl border shadow-xl text-left space-y-5 ${
              isDark
                ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                  DI
                </div>
                <div>
                  <div className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Dealing India Tech</div>
                  <div className="text-xs text-slate-500">Empowering Bharat's Textile Mandis</div>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Headquarters:</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Surat, Gujarat, India</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Platform Availability:</span>
                  <span className="font-semibold text-emerald-600">Windows (.EXE) + Web Cloud</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500">Compliance:</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>GST, E-Way Bill & E-Invoice</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Direct Support Hotline:</span>
                  <span className="font-bold text-blue-600">+91-98765-43210</span>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={downloadUrl}
                  download="BillingSoftware-Setup.exe"
                  className="w-full py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all"
                >
                  <Download size={15} /> Download Windows Software Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. DESKTOP APP (.EXE) HIGHLIGHT SECTION */}
      <section id="desktop-app" className={`py-16 border-t transition-colors ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-gradient-to-b from-white to-blue-50/40 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`rounded-3xl p-8 sm:p-12 relative overflow-hidden border shadow-xl ${
            isDark
              ? 'bg-gradient-to-tr from-blue-950/60 via-slate-900 to-slate-950 border-blue-500/20'
              : 'bg-gradient-to-tr from-blue-50/80 via-white to-indigo-50/60 border-blue-200'
          }`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-7 space-y-5 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                  <Laptop size={14} />
                  <span>Native Windows Desktop Software</span>
                </div>

                <h3 className={`text-3xl sm:text-4xl font-black tracking-tight leading-snug ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Work 100% Offline When Internet is Down. Sync Automatically When Online.
                </h3>

                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Broadband fluctuations or power outages shouldn't stop your billing counter. The Dealing India Windows Desktop app runs completely offline with a high-speed local engine. The moment connection restores, your data syncs securely with cloud servers without duplicates or collisions.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                  }`}>
                    <CheckCircle size={15} className="text-blue-600 shrink-0" />
                    <span>Pure Keyboard Speed (No mouse needed)</span>
                  </div>
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                  }`}>
                    <CheckCircle size={15} className="text-blue-600 shrink-0" />
                    <span>Instant Local Printing to Thermal/Laser</span>
                  </div>
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                  }`}>
                    <CheckCircle size={15} className="text-blue-600 shrink-0" />
                    <span>Automatic Local Data Backup</span>
                  </div>
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                  }`}>
                    <CheckCircle size={15} className="text-blue-600 shrink-0" />
                    <span>Multi-PC Local Network Support</span>
                  </div>
                </div>

                {/* Direct Download Box */}
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <a
                    href={downloadUrl}
                    download="BillingSoftware-Setup.exe"
                    className="px-7 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/25 flex items-center gap-2.5 transition-all hover:scale-105"
                  >
                    <Download size={18} />
                    <span>Download Installer (.EXE)</span>
                    <span className="text-[11px] bg-emerald-950/40 px-2 py-0.5 rounded text-emerald-100 font-mono">
                      ~238 MB
                    </span>
                  </a>

                  <a
                    href={downloadAltUrl}
                    download="TextileERP-Setup-1.0.0.exe"
                    className="text-xs text-slate-500 hover:text-blue-600 underline"
                    title="Alternate mirror link"
                  >
                    Mirror Download Link
                  </a>
                </div>
              </div>

              {/* 3 Step Installation Visual Guide */}
              <div className={`lg:col-span-5 p-6 rounded-2xl border shadow-lg space-y-4 text-left ${
                isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="text-xs font-bold uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>How to Install & Get Started</span>
                  <span className="text-emerald-600 text-[10px] font-bold">Takes 2 Minutes</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                      1
                    </div>
                    <div>
                      <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Download the .EXE file</div>
                      <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Click the download button above to save <code className="text-blue-600 bg-blue-50 dark:bg-slate-900 px-1 py-0.5 rounded font-mono">BillingSoftware-Setup.exe</code> on your computer.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                      2
                    </div>
                    <div>
                      <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Run Setup & Install</div>
                      <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Double-click the downloaded setup file. Follow the quick on-screen prompt. A desktop shortcut will be created automatically.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                      3
                    </div>
                    <div>
                      <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Login & Start Billing!</div>
                      <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Launch the desktop app, log in with your credentials or click "Create Company", and generate GST bills instantly.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  System Requirements: Windows 10, 11 (64-bit), 4 GB RAM, 1 GB Storage.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. FAQ ACCORDION */}
      <section id="faqs" className={`py-16 border-t transition-colors ${
        isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/70 border-slate-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1.5">
              Got Questions?
            </h2>
            <h3 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className={`border rounded-xl overflow-hidden transition-colors ${
                    isDark
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className={`w-full p-4 sm:p-5 text-left flex justify-between items-center gap-4 text-sm font-bold transition-colors ${
                      isDark ? 'text-slate-200 hover:text-white' : 'text-slate-800 hover:text-blue-600'
                    }`}
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={16} className="text-blue-600 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className={`px-5 pb-5 text-xs leading-relaxed border-t pt-3 ${
                      isDark
                        ? 'text-slate-300 border-slate-800/60'
                        : 'text-slate-600 border-slate-100'
                    }`}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 11. BOTTOM FINAL CALL TO ACTION */}
      <section className="py-14 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight leading-snug">
            Ready to Upgrade Your Textile Mandi Operations?
          </h3>
          <p className="mt-3 text-sm text-blue-100 max-w-xl mx-auto leading-relaxed">
            Download the Windows offline software now or register your company to use the cloud web portal. Zero installation hassle.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <a
              href={downloadUrl}
              download="BillingSoftware-Setup.exe"
              className="px-6 py-3 rounded-xl font-bold text-xs bg-white text-blue-800 hover:bg-blue-50 shadow-lg flex items-center gap-2 transition-all hover:scale-105"
            >
              <Download size={16} />
              <span>Download Free Windows App (.EXE)</span>
            </a>

            <Link
              to="/signup"
              className="px-6 py-3 rounded-xl font-bold text-xs bg-blue-900/60 hover:bg-blue-900 text-white border border-blue-400/40 flex items-center gap-2 transition-all"
            >
              <Users size={16} />
              <span>Register New Company</span>
            </Link>

            <Link
              to="/login"
              className="px-5 py-3 rounded-xl font-bold text-xs bg-transparent hover:bg-blue-600/40 text-blue-100 border border-blue-400/30 flex items-center gap-1.5 transition-all"
            >
              <Cloud size={16} />
              <span>Online Login</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 12. COMPREHENSIVE FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900 text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                  DI
                </div>
                <div className="text-white font-black tracking-tight">DEALING INDIA</div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                India's premier offline-first textile billing, inventory, and accounting ERP platform. Empowering traders, weavers, and process houses across Surat, Ahmedabad, Mumbai, and all textile mandis.
              </p>
            </div>

            <div>
              <div className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">Product & Downloads</div>
              <ul className="space-y-2 text-[11px]">
                <li><a href={downloadUrl} download="BillingSoftware-Setup.exe" className="hover:text-blue-400 flex items-center gap-1"><Download size={12} /> Windows Desktop App (.EXE)</a></li>
                <li><Link to="/login" className="hover:text-blue-400 flex items-center gap-1"><Cloud size={12} /> Online Web Portal</Link></li>
                <li><Link to="/signup" className="hover:text-blue-400 flex items-center gap-1"><Users size={12} /> New Company Registration</Link></li>
                <li><a href="#software-info" className="hover:text-blue-400">Software Information</a></li>
                <li><a href="#about" className="hover:text-blue-400">About Dealing India</a></li>
              </ul>
            </div>

            <div>
              <div className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">Textile Mandi Solutions</div>
              <ul className="space-y-2 text-[11px]">
                <li><a href="#features" className="hover:text-blue-400">Grey Stock & Roll Tracking</a></li>
                <li><a href="#features" className="hover:text-blue-400">Mill Issue & Receive Challans</a></li>
                <li><a href="#features" className="hover:text-blue-400">Taka Pcs Breakdown Calculator</a></li>
                <li><a href="#features" className="hover:text-blue-400">AI PDF Purchase Bill Import</a></li>
              </ul>
            </div>

            <div>
              <div className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">Support & Contact</div>
              <p className="text-slate-400 text-[11px] leading-relaxed mb-2">
                Surat Support Center · Ring Road & Mill Gate Market Support
              </p>
              <div className="flex items-center gap-2 text-slate-300 text-[11px] mb-1">
                <Mail size={12} className="text-blue-400" /> support@dealingindia.com
              </div>
              <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                <Phone size={12} className="text-emerald-400" /> +91-98765-43210
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div>
              © {new Date().getFullYear()} Dealing India. All rights reserved. GST & E-Way Bill Certified.
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="hover:text-slate-300">Login</Link>
              <Link to="/signup" className="hover:text-slate-300">Register</Link>
              <a href={downloadUrl} download="BillingSoftware-Setup.exe" className="hover:text-slate-300">Download .EXE</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
