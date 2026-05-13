import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileInvoiceDollar, faCartFlatbed, faMoneyCheckDollar, 
  faHandHoldingDollar, faTruckArrowRight, faWarehouse,
  faScrewdriverWrench, faClipboardCheck, faChartPie,
  faCircleQuestion, faPowerOff, faFilePen, faDisplay, faSync,
  faBuilding, faUserShield, faChevronRight, faPhone,
  faMoon, faSun,
  faIndianRupeeSign, faBagShopping, faScaleBalanced, faChartColumn, faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons';
import useStore from '../store/useStore';

// Legacy Modals
import SalesModal from './sales/SalesModal';
import PurchaseModal from './purchase/PurchaseModal';
import { PaymentForm as AccountingModal } from './accounting/AccountingForms';
import IssueModal from './jobwork/IssueModal';
import ReceiveModal from './jobwork/ReceiveModal';
import UpdateModal from './jobwork/UpdateModal';
import JobReceiptModal from './jobwork/JobReceiptModal';
import SalesOutstanding from './reports/SalesOutstanding';
import LedgerModal from './LedgerModal';
import AccountMasterModal from './masters/AccountMasterModal';
import ItemMasterModal from './masters/ItemMasterModal';

// GST Compliance Modals
import { 
  Gst3bMonthlyModal, 
  Gstr1Modal, 
  Gst2bMatchingModal, 
  Gst3bDetailModal, 
  Gstr1ErrorChekModal 
} from './gst/GstModals';
import BookSelectionModal from '../components/BookSelectionModal';

const Dashboard = () => {
  const { theme, toggleTheme } = useStore();
  const [activeMenu, setActiveMenu] = useState(null);
  const [modals, setModals] = useState({
    sales: false,
    purchase: false,
    receipt: false,
    payment: false,
    millIssue: false,
    millRec: false,
    jobIssue: false,
    jobRec: false,
    outstanding: false,
    ledger: false,
    accountMaster: false,
    itemMaster: false,
    gst3bMonthly: false,
    gstr1: false,
    gst2bMatching: false,
    gst3bDetail: false,
    gstr1Errorchek: false
  });

  const [bookSelection, setBookSelection] = useState({
    isOpen: false,
    module: null
  });
  const [selectedBooks, setSelectedBooks] = useState({});

  const isDark = theme === 'dark';

  const CORE_MODULES_WITH_BOOKS = ['sales', 'purchase', 'receipt', 'payment', 'millIssue', 'millRec', 'jobIssue', 'jobRec', 'ledger'];

  const toggleModal = (key, val) => {
    if (val === true && CORE_MODULES_WITH_BOOKS.includes(key)) {
      setBookSelection({
        isOpen: true,
        module: key
      });
      setActiveMenu(null);
      return;
    }
    setModals(prev => ({ ...prev, [key]: val }));
    setActiveMenu(null);
  };

  const handleSelectBook = (book) => {
    const key = bookSelection.module;
    setSelectedBooks(prev => ({ ...prev, [key]: book }));
    setBookSelection({ isOpen: false, module: null });
    setModals(prev => ({ ...prev, [key]: true }));
  };

  const menuData = {
    Master: [
      { label: 'Account', key: 'accountMaster' },
      { label: 'Item', key: 'itemMaster' },
      'Account Group', 'ScreenName', 'Item Group', 'Unit', 
      'Item Tax Master', 'City', 'State', 'Transport', 'Opening Balance', 
      'Opening Stock Entry', 'ColorWise Opening Stock', 'Haste', 'Brand', 
      'Bank Setup (Recon)', 'Color', 'Old Year Bill Entry', 'Design', 'Others'
    ],
    Transaction: [
      { label: '1 Bank', key: 'receipt' },
      { label: '2 Sales Billing', key: 'sales' },
      { label: '3 Purchase Grey/Finish/Other', key: 'purchase' },
      '4 Journal Entry', 
      '5 Sales Debit/Credit Note', '6 Purchase Debit/Credit Note', '7 Sales Return', 
      '8 Purchase Return', '9 Purchase Order', 'Sales Order', 
      { label: 'Process', key: 'millIssue' }, 
      { label: 'Job Work / Value Additions', key: 'jobIssue' }, 
      'Purchase Challan', 'LRNO. Entry', 
      'Bulk Eway/EInvoice Generation', 'Cuting Card', 'Adjustment Entry', 'Send Multi Watsapp'
    ],
    Reports: [
      { label: 'Sales Outstanding', key: 'outstanding' },
      'Purchase Outstanding (All)', 'Sales Reports', 
      'Purchase Reports (Grey/Fin/Other)', 'Process (Mill) Reports', 'Job Reports', 
      'Gst Reports', 'Tds/Tcs Reports', 'Stock/Inventory Reports', 
      'Final Account Reports', 'Multiple Ledgers / Interest Reports', 
      'Brokerage Reports', 'Interest Reports', 'Other Reports'
    ],
    Ledger: [], 
    Utilities: [
      { label: 'Transfer Data / Create New Year', color: isDark ? 'text-rose-400 font-bold' : 'text-rose-600 font-bold' },
      'Import Masters', 'Import Previous Year Data', 'Send Sms', 'Merge Account', 
      'Merge Item', 'WA Settings', 'Print Barcode', 'Cut Change', 'Import Online', 
      'Import From Other Software', 'Sql Tool', 'Courier Details', 
      'Data Serialization', 'HsnCode Change', 'Broker Change (Sale)', 
      'Data Refresh', 'Delete Unsed', 'Compliaint Form', 'Update Barcode Images', 'Merge City'
    ],
    Admin: ['User Rights', 'Change Password', 'Log Report', 'Backup Database', 'Restore Database'],
    Company: ['Select Company', 'Create Company', 'Edit Company', 'Delete Company', 'Refresh List']
  };

  const desktopIcons = [
    { id: 1, label: 'Sales Billing', icon: faFileInvoiceDollar, color: isDark ? 'from-cyan-500 to-blue-700' : 'from-[#3b82f6] to-[#1e40af]', key: 'sales' },
    { id: 2, label: 'Purchase', icon: faCartFlatbed, color: isDark ? 'from-emerald-400 to-teal-700' : 'from-[#60a5fa] to-[#2563eb]', key: 'purchase' },
    { id: 3, label: 'Bank Receipt', icon: faMoneyCheckDollar, color: isDark ? 'from-amber-400 to-orange-700' : 'from-[#06b6d4] to-[#0891b2]', key: 'receipt' },
    { id: 4, label: 'Bank Payment', icon: faHandHoldingDollar, color: isDark ? 'from-violet-400 to-indigo-700' : 'from-[#6366f1] to-[#4338ca]', key: 'payment' },
    { id: 5, label: 'Mill Issue', icon: faTruckArrowRight, color: isDark ? 'from-rose-400 to-red-700' : 'from-[#3b82f6] to-[#1d4ed8]', key: 'millIssue' },
    { id: 6, label: 'Mill Receive', icon: faWarehouse, color: isDark ? 'from-cyan-400 to-blue-600' : 'from-[#2dd4bf] to-[#0d9488]', key: 'millRec' },
    { id: 7, label: 'Job Issue', icon: faScrewdriverWrench, color: isDark ? 'from-orange-400 to-amber-600' : 'from-[#0ea5e9] to-[#0369a1]', key: 'jobIssue' },
    { id: 8, label: 'Job Receive', icon: faClipboardCheck, color: isDark ? 'from-indigo-400 to-purple-600' : 'from-[#8b5cf6] to-[#6d28d9]', key: 'jobRec' },
    { id: 9, label: 'Outstanding', icon: faChartPie, color: isDark ? 'from-teal-400 to-emerald-600' : 'from-[#14b8a6] to-[#0f766e]', key: 'outstanding' },
  ];

  const gstIcons = [
    { id: 1, label: '3B Monthly', icon: faIndianRupeeSign, color: isDark ? 'from-indigo-500 to-purple-700' : 'from-[#8b5cf6] to-[#5b21b6]', key: 'gst3bMonthly' },
    { id: 2, label: 'GSTR-1', icon: faBagShopping, color: isDark ? 'from-blue-500 to-indigo-700' : 'from-[#3b82f6] to-[#1d4ed8]', key: 'gstr1' },
    { id: 3, label: '2B Matching', icon: faScaleBalanced, color: isDark ? 'from-amber-500 to-orange-700' : 'from-[#f59e0b] to-[#b45309]', key: 'gst2bMatching' },
    { id: 4, label: '3B Detail', icon: faChartColumn, color: isDark ? 'from-teal-500 to-emerald-700' : 'from-[#14b8a6] to-[#047857]', key: 'gst3bDetail' },
    { id: 5, label: 'R-1 Errorchek', icon: faTriangleExclamation, color: isDark ? 'from-rose-500 to-red-700' : 'from-[#f43f5e] to-[#be123c]', key: 'gstr1Errorchek' }
  ];

  return (
    <div className={`fixed inset-0 overflow-hidden flex flex-col select-none transition-colors duration-500 ${isDark ? 'bg-[#0f172a] text-white' : 'bg-[#f8faff] text-[#1e3a8a]'}`}>
      
      {/* Background Gradients */}
      <div className="absolute inset-0 opacity-40">
        <div className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] transition-colors duration-700 ${isDark ? 'bg-blue-900/30' : 'bg-[#dbeafe]'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] transition-colors duration-700 ${isDark ? 'bg-indigo-900/30' : 'bg-[#e0f2fe]'}`} />
      </div>

      {/* Top Header - Compacted Height */}
      <div className={`flex items-center justify-between h-8 text-[10px] font-bold border-b relative z-[100] shadow-sm transition-colors duration-500 ${isDark ? 'bg-slate-900 border-white/5 text-white' : 'bg-[#1e3a8a] border-[#1d4ed8] text-white'}`}>
        <div className="flex h-full">
          {Object.keys(menuData).map(menu => (
            <div 
              key={menu} 
              className="relative h-full"
              onMouseEnter={() => setActiveMenu(menu)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <button 
                onClick={() => menu === 'Ledger' ? toggleModal('ledger', true) : null}
                className={`px-4 h-full border-r border-white/10 hover:bg-white/10 transition-all uppercase tracking-tight ${activeMenu === menu ? 'bg-white/20' : ''}`}
              >
                {menu}
              </button>
              
              <AnimatePresence>
                {activeMenu === menu && menuData[menu].length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    className={`absolute top-8 left-0 w-56 border shadow-2xl py-1 z-[110] ${isDark ? 'bg-slate-900 border-white/10' : 'bg-[#1e3a8a] border-white/10'}`}
                  >
                    {menuData[menu].map((item, idx) => {
                      const label = typeof item === 'object' ? item.label : item;
                      const key = typeof item === 'object' ? item.key : null;
                      const color = typeof item === 'object' ? item.color : 'text-white/90';
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => key ? toggleModal(key, true) : null}
                          className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/20 transition-colors flex justify-between items-center group ${color}`}
                        >
                          <span>{label}</span>
                          {['Process', 'Job Work', 'Import', 'Reports'].some(s => label.includes(s)) && 
                            <FontAwesomeIcon icon={faChevronRight} className="text-[9px] opacity-40 group-hover:opacity-100" />
                          }
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          <button className="px-4 border-r border-white/10 hover:bg-white/10 transition-colors uppercase tracking-tight">
            Exit
          </button>
          <button className="px-4 border-r border-white/10 hover:bg-white/10 transition-colors uppercase tracking-tight text-yellow-300 flex items-center gap-1.5">
             <FontAwesomeIcon icon={faPhone} className="animate-bounce" /> Support
          </button>
        </div>
        
        <div className="flex items-center h-full pr-4 gap-6">
           {/* Theme Toggle - Compact */}
           <button 
             onClick={toggleTheme}
             className={`p-1 px-2.5 rounded-full flex items-center gap-2 transition-all border ${isDark ? 'bg-slate-800 border-white/10 text-yellow-400 hover:bg-slate-700' : 'bg-white/10 border-white/20 text-yellow-300 hover:bg-white/20'}`}
           >
             <FontAwesomeIcon icon={isDark ? faSun : faMoon} className="text-[9px]" />
             <span className="text-[9px] uppercase font-black">{isDark ? 'Light' : 'Dark'}</span>
           </button>

           <div className="text-yellow-300 font-black flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse shadow-[0_0_6px_rgba(253,224,71,1)]" />
             Id: 5630
           </div>
           <div className="flex items-center gap-4 text-white/70 text-[9px]">
             <button className="hover:text-white transition-colors flex items-center gap-1.5"><FontAwesomeIcon icon={faFilePen} /> Notepad</button>
             <button className="hover:text-white transition-colors flex items-center gap-1.5"><FontAwesomeIcon icon={faDisplay} /> UltraViewer</button>
             <button className="hover:text-white transition-colors flex items-center gap-1.5"><FontAwesomeIcon icon={faSync} /> Auto Update</button>
           </div>
        </div>
      </div>

      {/* Main Desktop Area - Analytics Command Center */}
      <div className="flex-1 relative overflow-y-auto p-6 z-10 space-y-6 no-scrollbar">
         {/* Top Header & Branding Panel */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/90 backdrop-blur-md border border-[#E2E8F0] p-5 rounded-xl shadow-sm">
            <div>
               <h1 className="text-2xl font-black text-[#1B3A6B] tracking-tight">MAHAVEER IMPEX</h1>
               <p className="text-[#0D7377] text-xs font-bold uppercase tracking-[0.3em] mt-1">ERP Command Center • Professional Edition 5.6.30</p>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={() => toggleModal('sales', true)} className="h-[38px] bg-[#1B3A6B] text-white font-medium text-xs px-4 py-2 rounded-lg hover:bg-[#142d56] transition-all flex items-center gap-2 shadow-sm">
                  <FontAwesomeIcon icon={faFileInvoiceDollar} />
                  New Sales Bill
               </button>
               <button onClick={() => toggleModal('purchase', true)} className="h-[38px] bg-white border border-[#1B3A6B] text-[#1B3A6B] font-medium text-xs px-4 py-2 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                  <FontAwesomeIcon icon={faCartFlatbed} />
                  New Purchase
               </button>
            </div>
         </div>

         {/* 4 KPI Metric Cards Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-md flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-[#0D7377]/10 text-[#0D7377] flex items-center justify-center text-lg shrink-0">
                  <FontAwesomeIcon icon={faIndianRupeeSign} />
               </div>
               <div>
                  <p className="text-[28px] font-bold text-slate-800 leading-none">₹ 1,84,500</p>
                  <p className="text-[13px] text-[#64748B] mt-1 font-medium">Today's Sales</p>
               </div>
            </div>
            {/* KPI 2 */}
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-md flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-[#0D7377]/10 text-[#0D7377] flex items-center justify-center text-lg shrink-0">
                  <FontAwesomeIcon icon={faScaleBalanced} />
               </div>
               <div>
                  <p className="text-[28px] font-bold text-slate-800 leading-none">₹ 12,40,200</p>
                  <p className="text-[13px] text-[#64748B] mt-1 font-medium">Pending Receivables</p>
               </div>
            </div>
            {/* KPI 3 */}
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-md flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-[#0D7377]/10 text-[#0D7377] flex items-center justify-center text-lg shrink-0">
                  <FontAwesomeIcon icon={faWarehouse} />
               </div>
               <div>
                  <p className="text-[28px] font-bold text-slate-800 leading-none">14 Active</p>
                  <p className="text-[13px] text-[#64748B] mt-1 font-medium">Open Job Work Orders</p>
               </div>
            </div>
            {/* KPI 4 */}
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-md flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-[#0D7377]/10 text-[#0D7377] flex items-center justify-center text-lg shrink-0">
                  <FontAwesomeIcon icon={faChartColumn} />
               </div>
               <div>
                  <p className="text-[28px] font-bold text-slate-800 leading-none">₹ 45,300</p>
                  <p className="text-[13px] text-[#64748B] mt-1 font-medium">GST Liability This Month</p>
               </div>
            </div>
         </div>

         {/* Second Row: Recent Invoices (60%) + Stock Alerts (40%) */}
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Recent Invoices (60%) */}
            <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
               <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-[#1B3A6B] uppercase tracking-wider">Recent Invoices</h3>
                  <button onClick={() => toggleModal('outstanding', true)} className="text-[#0D7377] hover:underline text-xs font-semibold">View Outstanding</button>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                     <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] h-[44px]">
                           <th className="px-4 py-2 font-semibold text-[#64748B] uppercase tracking-[0.05em] text-[11px]">Invoice No</th>
                           <th className="px-4 py-2 font-semibold text-[#64748B] uppercase tracking-[0.05em] text-[11px]">Customer</th>
                           <th className="px-4 py-2 font-semibold text-[#64748B] uppercase tracking-[0.05em] text-[11px] text-right">Amount</th>
                           <th className="px-4 py-2 font-semibold text-[#64748B] uppercase tracking-[0.05em] text-[11px] text-center">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#F1F5F9]">
                        <tr className="h-[44px] hover:bg-[#F8FAFC] transition-colors">
                           <td className="px-4 py-2 font-semibold text-[#0D7377]">INV-2026-004</td>
                           <td className="px-4 py-2 font-medium text-slate-700">Ankit Fabrics Pvt Ltd</td>
                           <td className="px-4 py-2 text-right font-bold text-[#1B3A6B]">₹ 42,500.00</td>
                           <td className="px-4 py-2 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534]">Paid</span>
                           </td>
                        </tr>
                        <tr className="h-[44px] hover:bg-[#F8FAFC] transition-colors">
                           <td className="px-4 py-2 font-semibold text-[#0D7377]">INV-2026-003</td>
                           <td className="px-4 py-2 font-medium text-slate-700">Shree Balaji Creation</td>
                           <td className="px-4 py-2 text-right font-bold text-[#1B3A6B]">₹ 1,18,400.00</td>
                           <td className="px-4 py-2 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF9C3] text-[#854D0E]">Pending</span>
                           </td>
                        </tr>
                        <tr className="h-[44px] hover:bg-[#F8FAFC] transition-colors">
                           <td className="px-4 py-2 font-semibold text-[#0D7377]">INV-2026-002</td>
                           <td className="px-4 py-2 font-medium text-slate-700">Vardhman Textiles</td>
                           <td className="px-4 py-2 text-right font-bold text-[#1B3A6B]">₹ 85,200.00</td>
                           <td className="px-4 py-2 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534]">Paid</span>
                           </td>
                        </tr>
                        <tr className="h-[44px] hover:bg-[#F8FAFC] transition-colors">
                           <td className="px-4 py-2 font-semibold text-[#0D7377]">INV-2026-001</td>
                           <td className="px-4 py-2 font-medium text-slate-700">Krishna Mill Agency</td>
                           <td className="px-4 py-2 text-right font-bold text-[#1B3A6B]">₹ 24,100.00</td>
                           <td className="px-4 py-2 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B]">Cancelled</span>
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Critical Stock Alerts (40%) */}
            <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
               <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-[#1B3A6B] uppercase tracking-wider">Stock Alerts</h3>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">2 Items Low</span>
               </div>
               <div className="p-4 space-y-4 flex-1 flex flex-col justify-center">
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                     <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-[#FEE2E2] text-[#991B1B] rounded-md text-xs font-bold">45 Mtrs</span>
                        <div>
                           <p className="text-xs font-bold text-slate-800">Lycra Cotton 180GSM</p>
                           <p className="text-[10px] text-slate-400">Min Threshold: 200 Mtrs</p>
                        </div>
                     </div>
                     <button onClick={() => toggleModal('purchase', true)} className="h-8 px-3 bg-[#1B3A6B] hover:bg-[#142d56] text-white text-[11px] font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                        Create PO
                     </button>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                     <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-[#FEE2E2] text-[#991B1B] rounded-md text-xs font-bold">12 Mtrs</span>
                        <div>
                           <p className="text-xs font-bold text-slate-800">Ponte Roma Premium Knit</p>
                           <p className="text-[10px] text-slate-400">Min Threshold: 150 Mtrs</p>
                        </div>
                     </div>
                     <button onClick={() => toggleModal('purchase', true)} className="h-8 px-3 bg-[#1B3A6B] hover:bg-[#142d56] text-white text-[11px] font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                        Create PO
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* Grid Modules Shortcuts */}
         <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1B3A6B]">Core Modules Shortcuts</span>
               <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-4">
               {desktopIcons.map((icon, idx) => (
                  <div 
                     key={icon.id}
                     onClick={() => toggleModal(icon.key, true)}
                     className="group flex flex-col items-center cursor-pointer bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-sm hover:shadow-md hover:border-[#0D7377] transition-all duration-300"
                  >
                     <div className={`w-11 h-11 bg-gradient-to-br ${icon.color} rounded-lg flex items-center justify-center text-white mb-2 transition-transform group-hover:scale-105 shadow-sm`}>
                        <FontAwesomeIcon icon={icon.icon} className="text-sm" />
                     </div>
                     <p className="text-[10px] font-bold uppercase tracking-tight text-center text-slate-700 leading-tight group-hover:text-[#1B3A6B]">
                        {icon.label}
                     </p>
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* Status Bar - Compact Height */}
      <div className={`text-[9px] font-bold px-6 py-2 flex justify-between items-center border-t relative z-50 shadow-lg transition-colors duration-500 ${isDark ? 'bg-slate-900 border-white/5 text-white/80' : 'bg-[#1e3a8a] border-[#1d4ed8] text-white/80'}`}>
        <div className="flex gap-8 uppercase tracking-widest opacity-80">
          <span className="hover:text-cyan-400 transition-colors cursor-pointer">Ctrl+L : Ledger</span>
          <span className="hover:text-cyan-400 transition-colors cursor-pointer">F4 : Master</span>
          <span className="hover:text-cyan-400 transition-colors cursor-pointer">F5 : Missing</span>
        </div>
        <div className="flex items-center gap-8">
           <div className="flex items-center gap-1.5"><FontAwesomeIcon icon={faBuilding} className={isDark ? 'text-cyan-400' : 'text-blue-300'}/> <span className="opacity-60">Company:</span> <span className="font-black">MAHAVEER IMPEX</span></div>
           <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"><FontAwesomeIcon icon={faCircleQuestion} /> Support</div>
           <button 
             onClick={() => window.close()}
             className={`flex items-center gap-2 px-4 py-1 rounded-full font-black uppercase tracking-tighter transition-all shadow-md active:scale-95 ${isDark ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-[#ef4444] hover:bg-[#dc2626] text-white'}`}
           >
             <FontAwesomeIcon icon={faPowerOff} className="text-[10px]" /> Close ERP
           </button>
        </div>
      </div>

      {/* Modals */}
      <SalesModal isOpen={modals.sales} onClose={() => toggleModal('sales', false)} selectedBook={selectedBooks.sales?.name} />
      <PurchaseModal isOpen={modals.purchase} onClose={() => toggleModal('purchase', false)} selectedBook={selectedBooks.purchase?.name} />
      <AccountingModal isOpen={modals.receipt} onClose={() => toggleModal('receipt', false)} initialType="Receipt" selectedBook={selectedBooks.receipt?.name} />
      <AccountingModal isOpen={modals.payment} onClose={() => toggleModal('payment', false)} initialType="Payment" selectedBook={selectedBooks.payment?.name} />
      <IssueModal isOpen={modals.millIssue} onClose={() => toggleModal('millIssue', false)} selectedBook={selectedBooks.millIssue?.name} />
      <ReceiveModal isOpen={modals.millRec} onClose={() => toggleModal('millRec', false)} selectedBook={selectedBooks.millRec?.name} />
      <UpdateModal isOpen={modals.jobIssue} onClose={() => toggleModal('jobIssue', false)} selectedBook={selectedBooks.jobIssue?.name} />
      <JobReceiptModal isOpen={modals.jobRec} onClose={() => toggleModal('jobRec', false)} selectedBook={selectedBooks.jobRec?.name} />
      <LedgerModal isOpen={modals.ledger} onClose={() => toggleModal('ledger', false)} selectedBook={selectedBooks.ledger?.name} />
      <AccountMasterModal isOpen={modals.accountMaster} onClose={() => toggleModal('accountMaster', false)} />
      <ItemMasterModal isOpen={modals.itemMaster} onClose={() => toggleModal('itemMaster', false)} />
      {modals.outstanding && <SalesOutstanding isOpen={modals.outstanding} onClose={() => toggleModal('outstanding', false)} />}

      {/* GST Compliance Modals */}
      <Gst3bMonthlyModal isOpen={modals.gst3bMonthly} onClose={() => toggleModal('gst3bMonthly', false)} />
      <Gstr1Modal isOpen={modals.gstr1} onClose={() => toggleModal('gstr1', false)} />
      <Gst2bMatchingModal isOpen={modals.gst2bMatching} onClose={() => toggleModal('gst2bMatching', false)} />
      <Gst3bDetailModal isOpen={modals.gst3bDetail} onClose={() => toggleModal('gst3bDetail', false)} />
      <Gstr1ErrorChekModal isOpen={modals.gstr1Errorchek} onClose={() => toggleModal('gstr1Errorchek', false)} />

      {/* Book Selection Modal */}
      <BookSelectionModal
        isOpen={bookSelection.isOpen}
        onClose={() => setBookSelection({ isOpen: false, module: null })}
        moduleName={bookSelection.module}
        onSelectBook={handleSelectBook}
      />

    </div>
  );
};

export default Dashboard;
