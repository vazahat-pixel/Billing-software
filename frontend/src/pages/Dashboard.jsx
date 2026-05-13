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
   faIndianRupeeSign, faBagShopping, faScaleBalanced, faChartColumn, faTriangleExclamation,
   faHandshake
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
import VisitLogModal from './crm/VisitLogModal';
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
      gstr1Errorchek: false,
      visit: false
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
      { id: 1, label: 'Sales Billing', icon: faFileInvoiceDollar, color: 'from-slate-800 to-black', key: 'sales' },
      { id: 2, label: 'Purchase', icon: faCartFlatbed, color: 'from-slate-700 to-slate-900', key: 'purchase' },
      { id: 3, label: 'Bank Receipt', icon: faMoneyCheckDollar, color: 'from-slate-800 to-black', key: 'receipt' },
      { id: 4, label: 'Bank Payment', icon: faHandHoldingDollar, color: 'from-slate-700 to-slate-900', key: 'payment' },
      { id: 5, label: 'Mill Issue', icon: faTruckArrowRight, color: 'from-slate-800 to-black', key: 'millIssue' },
      { id: 6, label: 'Mill Receive', icon: faWarehouse, color: 'from-slate-700 to-slate-900', key: 'millRec' },
      { id: 7, label: 'Job Issue', icon: faScrewdriverWrench, color: 'from-slate-800 to-black', key: 'jobIssue' },
      { id: 8, label: 'Job Receive', icon: faClipboardCheck, color: 'from-slate-700 to-slate-900', key: 'jobRec' },
      { id: 9, label: 'Visit Log', icon: faHandshake, color: 'from-slate-800 to-black', key: 'visit' },
      { id: 10, label: 'Outstanding', icon: faChartPie, color: 'from-slate-700 to-slate-900', key: 'outstanding' },
   ];

   const gstIcons = [
      { id: 1, label: '3B Monthly', icon: faIndianRupeeSign, color: 'from-slate-800 to-black', key: 'gst3bMonthly' },
      { id: 2, label: 'GSTR-1', icon: faBagShopping, color: 'from-slate-700 to-slate-900', key: 'gstr1' },
      { id: 3, label: '2B Matching', icon: faScaleBalanced, color: 'from-slate-800 to-black', key: 'gst2bMatching' },
      { id: 4, label: '3B Detail', icon: faChartColumn, color: 'from-slate-700 to-slate-900', key: 'gst3bDetail' },
      { id: 5, label: 'R-1 Errorchek', icon: faTriangleExclamation, color: 'from-slate-800 to-black', key: 'gstr1Errorchek' }
   ];

   return (
      <div className={`fixed inset-0 overflow-hidden flex flex-col select-none transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-black'}`}>

         {/* Minimal Background */}
         <div className="absolute inset-0 opacity-10">
            <div className={`absolute top-0 left-0 w-full h-full ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`} />
         </div>

         {/* Top Header - High Contrast Black */}
         <div className={`flex items-center justify-between h-9 text-[10px] font-bold border-b relative z-[100] shadow-md transition-colors duration-500 ${isDark ? 'bg-black border-white/10 text-white' : 'bg-black border-slate-800 text-white'}`}>
            <div className="flex h-full">
               {Object.keys(menuData).map(menu => (
                  <div
                     key={menu}
                     className="relative h-full"
                  >
                     <button
                        onClick={() => {
                           if (menu === 'Ledger') {
                              toggleModal('ledger', true);
                           } else {
                              setActiveMenu(activeMenu === menu ? null : menu);
                           }
                        }}
                        className={`px-4 h-full border-r border-white/10 hover:bg-white/10 transition-all uppercase tracking-tight ${activeMenu === menu ? 'bg-white/20' : ''}`}
                     >
                        {menu}
                     </button>

                     <AnimatePresence>
                        {activeMenu === menu && menuData[menu].length > 0 && (
                           <>
                              <div className="fixed inset-0 z-[105]" onClick={() => setActiveMenu(null)}></div>
                              <motion.div
                                 initial={{ opacity: 0, y: -2 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -2 }}
                              className={`absolute top-8 left-0 w-56 border shadow-2xl py-1 z-[110] ${isDark ? 'bg-slate-900 border-white/10' : 'bg-black border-white/10'}`}
                           >
                              {menuData[menu].map((item, idx) => {
                                 const label = typeof item === 'object' ? item.label : item;
                                 const key = typeof item === 'object' ? item.key : null;
                                 const color = typeof item === 'object' ? item.color : 'text-white/90';

                                 return (
                                    <button
                                       key={idx}
                                       onClick={() => {
                                          if (key) toggleModal(key, true);
                                          setActiveMenu(null);
                                       }}
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
                        </>
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-black text-white p-8 border-none shadow-2xl">
                <div>
                   <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">MAHAVEER IMPEX</h1>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      ERP Command Center • Professional Edition 5.6.30
                   </p>
                </div>
               <div className="flex items-center gap-4">
                  <button onClick={() => toggleModal('sales', true)} className="px-8 py-3 bg-white text-black font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                     <FontAwesomeIcon icon={faFileInvoiceDollar} />
                     New Sales Bill
                  </button>
                  <button onClick={() => toggleModal('purchase', true)} className="px-8 py-3 bg-transparent border-2 border-white/20 text-white font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                     <FontAwesomeIcon icon={faCartFlatbed} />
                     New Purchase
                  </button>
               </div>
            </div>

            {/* Grid Modules Shortcuts — MOVED ABOVE KPIs */}
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-slate-200" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black">Core Modules Shortcuts</span>
                  <div className="h-[1px] flex-1 bg-slate-200" />
               </div>
               <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-4">
                  {desktopIcons.map((icon, idx) => (
                     <div
                        key={icon.id}
                        onClick={() => toggleModal(icon.key, true)}
                        className="group flex flex-col items-center cursor-pointer bg-white border-2 border-slate-100 p-5 hover:border-black transition-all duration-300"
                     >
                        <div className={`w-12 h-12 bg-black rounded-none flex items-center justify-center text-white mb-3 transition-all group-hover:bg-slate-800`}>
                           <FontAwesomeIcon icon={icon.icon} className="text-sm" />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-center text-black leading-tight">
                           {icon.label}
                        </p>
                     </div>
                  ))}
               </div>
            </div>

            {/* 4 KPI Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {[
                  { label: "Today's Sales", val: "₹ 1,84,500", icon: faIndianRupeeSign },
                  { label: "Pending Receivables", val: "₹ 12,40,200", icon: faScaleBalanced },
                  { label: "Open Job Orders", val: "14 Active", icon: faWarehouse },
                  { label: "GST Liability", val: "₹ 45,300", icon: faChartColumn }
               ].map((kpi, idx) => (
                  <div key={idx} className="bg-white border-2 border-black p-6 flex flex-col justify-between h-32 relative overflow-hidden group">
                     <div className="flex justify-between items-start z-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{kpi.label}</span>
                        <FontAwesomeIcon icon={kpi.icon} className="text-black text-xs" />
                     </div>
                     <div className="z-10">
                        <p className="text-3xl font-black text-black tracking-tighter">{kpi.val}</p>
                     </div>
                     <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50" />
                  </div>
               ))}
            </div>

            {/* Second Row: Recent Invoices (60%) + Stock Alerts (40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               {/* Recent Invoices (60%) */}
               <div className="lg:col-span-7 bg-white border-2 border-black overflow-hidden flex flex-col">
                  <div className="p-6 bg-black flex justify-between items-center">
                     <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Recent Transactions</h3>
                     <button onClick={() => toggleModal('outstanding', true)} className="text-white border-b border-white/30 hover:border-white text-[9px] font-black uppercase tracking-widest transition-all">View All Ledger</button>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left text-xs border-collapse">
                        <thead>
                           <tr className="bg-slate-50 border-b-2 border-black h-12">
                              <th className="px-6 font-black text-black uppercase tracking-widest text-[9px]">Invoice Ref</th>
                              <th className="px-6 font-black text-black uppercase tracking-widest text-[9px]">Entity</th>
                              <th className="px-6 font-black text-black uppercase tracking-widest text-[9px] text-right">Value</th>
                              <th className="px-6 font-black text-black uppercase tracking-widest text-[9px] text-center">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100">
                           {[
                              { ref: 'INV-2026-004', entity: 'Ankit Fabrics Pvt Ltd', val: '₹ 42,500.00', status: 'PAID' },
                              { ref: 'INV-2026-003', entity: 'Balaji Creation', val: '₹ 88,000.00', status: 'UNPAID' },
                              { ref: 'INV-2026-002', entity: 'Vardhman Textiles', val: '₹ 1,18,400.00', status: 'UNPAID' },
                           ].map((inv, idx) => (
                              <tr key={idx} className="h-14 hover:bg-slate-50 transition-colors">
                                 <td className="px-6 font-black text-black text-[10px] tracking-widest">{inv.ref}</td>
                                 <td className="px-6 font-bold text-slate-600 uppercase text-[10px]">{inv.entity}</td>
                                 <td className="px-6 text-right font-black text-black text-[11px]">{inv.val}</td>
                                 <td className="px-6 text-center">
                                    <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border-2 ${inv.status === 'PAID' ? 'bg-black text-white border-black' : 'border-slate-200 text-slate-400'}`}>
                                       {inv.status}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Critical Stock Alerts (40%) */}
               <div className="lg:col-span-5 bg-white border-2 border-black overflow-hidden flex flex-col">
                  <div className="p-6 bg-black flex justify-between items-center">
                     <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Inventory Alerts</h3>
                     <span className="px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-widest">2 CRITICAL</span>
                  </div>
                  <div className="p-8 space-y-6 flex-1 flex flex-col justify-center">
                     <div className="flex items-center justify-between border-b-2 border-slate-100 pb-5">
                        <div className="flex items-center gap-4">
                           <span className="w-14 h-14 bg-slate-100 flex items-center justify-center font-black text-xs">45M</span>
                           <div>
                              <p className="text-[10px] font-black text-black uppercase tracking-widest">Lycra Cotton 180GSM</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Below Safe Limit (200M)</p>
                           </div>
                        </div>
                        <button onClick={() => toggleModal('purchase', true)} className="px-6 py-2 bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                           RESTOCK
                        </button>
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <span className="w-14 h-14 bg-slate-100 flex items-center justify-center font-black text-xs">12M</span>
                           <div>
                              <p className="text-[10px] font-black text-black uppercase tracking-widest">Premium Knit</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Below Safe Limit (150M)</p>
                           </div>
                        </div>
                        <button onClick={() => toggleModal('purchase', true)} className="px-6 py-2 bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                           RESTOCK
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Status Bar - Compact Height */}
         <div className={`text-[9px] font-black px-6 py-3 flex justify-between items-center border-t relative z-50 transition-colors duration-500 bg-black text-white`}>
            <div className="flex gap-10 uppercase tracking-[0.2em] opacity-60">
               <span className="hover:text-white transition-colors cursor-pointer">Ctrl+L : Ledger</span>
               <span className="hover:text-white transition-colors cursor-pointer">F4 : Master Search</span>
               <span className="hover:text-white transition-colors cursor-pointer">F12 : Quick Save</span>
            </div>
            <div className="flex items-center gap-10">
               <div className="flex items-center gap-2"><FontAwesomeIcon icon={faBuilding} className="text-white" /> <span className="opacity-40 uppercase">Org:</span> <span className="font-black uppercase tracking-widest">MAHAVEER IMPEX</span></div>
               <div className="flex items-center gap-2 opacity-60 uppercase tracking-widest"><FontAwesomeIcon icon={faCircleQuestion} /> Help Desk</div>
               <button
                  onClick={() => window.close()}
                  className="px-8 py-1.5 bg-white text-black font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
               >
                  Shutdown ERP
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
         <VisitLogModal isOpen={modals.visit} onClose={() => toggleModal('visit', false)} />

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
