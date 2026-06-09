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
import Modal from '../components/ui/Modal';

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
import BookMasterModal from './masters/BookMasterModal';
import InventoryPage from './inventory/InventoryPage';

// GST Compliance Modals
import {
   Gst3bMonthlyModal,
   Gstr1Modal,
   Gst2bMatchingModal,
   Gst3bDetailModal,
   Gstr1ErrorChekModal,
   GstComplianceModal
} from './gst/GstModals';
import VisitLogModal from './crm/VisitLogModal';
import PartyModal from './masters/PartyModal';
import JobWorkerMaster from './masters/JobWorkerMaster';
import BookSelectionModal from '../components/BookSelectionModal';

// New Database Modals
import GenericMasterModal from './masters/GenericMasterModal';
import OrderModal from './transactions/OrderModal';
import ReturnModal from './transactions/ReturnModal';
import NoteModal from './transactions/NoteModal';
import JournalEntryModal from './transactions/JournalEntryModal';
import UserRightsModal from './admin/UserRightsModal';

const Dashboard = () => {
   const { theme, toggleTheme, user, bootstrapMasters } = useStore();
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
      gstCompliance: false,
      visit: false,
      party: false,
      jobWorker: false,
      bookMaster: false,
      inventoryPage: false,
      placeholder: false,
      // New database-connected modals
      genericMaster: false,
      genericMasterType: '',
      order: false,
      orderType: 'Sales',
      returnInv: false,
      returnType: 'Sales',
      note: false,
      noteType: 'Credit',
      journal: false,
      userRights: false
   });

   const [placeholderName, setPlaceholderName] = useState('');
   const [collapsedSections, setCollapsedSections] = useState({
      Master: false,
      Transaction: false,
      Reports: false,
      Ledger: false,
      Utilities: false,
      Admin: false,
      Company: false
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
         return;
      }

      // Handle navigation or placeholder for missing modules
      if (val === true && !key) {
         setPlaceholderName('MODULE');
         setModals(prev => ({ ...prev, placeholder: true }));
         return;
      }

      setModals(prev => ({ ...prev, [key]: val }));
   };

   const openPlaceholder = (name) => {
      setPlaceholderName(name);
      setModals(prev => ({ ...prev, placeholder: true }));
   };

   const handleSelectBook = (book) => {
      const key = bookSelection.module;
      setSelectedBooks(prev => ({ ...prev, [key]: book }));
      setBookSelection({ isOpen: false, module: null });
      setModals(prev => ({ ...prev, [key]: true }));
   };

   const openGenericMaster = (type) => {
      setModals(prev => ({
         ...prev,
         genericMaster: true,
         genericMasterType: type
      }));
   };

   const openOrder = (type) => {
      setModals(prev => ({
         ...prev,
         order: true,
         orderType: type
      }));
   };

   const openReturn = (type) => {
      setModals(prev => ({
         ...prev,
         returnInv: true,
         returnType: type
      }));
   };

   const openNote = (type) => {
      setModals(prev => ({
         ...prev,
         note: true,
         noteType: type
      }));
   };

   const openJournal = () => {
      setModals(prev => ({
         ...prev,
         journal: true
      }));
   };

   const toggleSection = (section) => {
      setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
   };

   const handleMenuItemClick = (item) => {
      if (item.action) {
         item.action();
      } else if (item.key) {
         toggleModal(item.key, true);
      } else {
         openPlaceholder(item.label || item);
      }
   };

   const menuData = {
      Master: [
         { label: 'Account', key: 'accountMaster' },
         { label: 'Item', key: 'itemMaster' },
         { label: 'Party Master', key: 'party' },
         { label: 'Job Worker Master', key: 'jobWorker' },
         { label: 'Book Master', key: 'bookMaster' },
         { label: 'Account Group', action: () => openGenericMaster('AccountGroup') },
         { label: 'Item Group', action: () => openGenericMaster('ItemGroup') },
         { label: 'City', action: () => openGenericMaster('City') },
         { label: 'Transport', action: () => openGenericMaster('Transport') },
         { label: 'Color', action: () => openGenericMaster('Color') },
         { label: 'Design', action: () => openGenericMaster('Design') },
         { label: 'Opening Balance', action: () => openPlaceholder('Opening Balance') },
         { label: 'Opening Stock Entry', action: () => openPlaceholder('Opening Stock Entry') },
         { label: 'Bank Setup (Recon)', action: () => openPlaceholder('Bank Setup') }
      ],
      Transaction: [
         { label: '1 Bank Receipt', key: 'receipt' },
         { label: '2 Bank Payment', key: 'payment' },
         { label: '3 Sales Billing', key: 'sales' },
         { label: '4 Purchase', key: 'purchase' },
         { label: '5 Mill Issue', key: 'millIssue' },
         { label: '6 Mill Receive', key: 'millRec' },
         { label: '7 Job Issue', key: 'jobIssue' },
         { label: '8 Job Receive', key: 'jobRec' },
         { label: 'Journal Entry', action: () => openJournal() },
         { label: 'Debit/Credit Note', action: () => openNote('Credit') },
         { label: 'Sales Return', action: () => openReturn('Sales') },
         { label: 'Purchase Return', action: () => openReturn('Purchase') },
         { label: 'Sales Order', action: () => openOrder('Sales') },
         { label: 'Purchase Order', action: () => openOrder('Purchase') }
      ],
      Reports: [
         { label: 'Sales Outstanding', key: 'outstanding' },
         { label: 'Inventory Stock', key: 'inventoryPage' },
         { label: 'GSTR-3B Monthly', key: 'gst3bMonthly' },
         { label: 'GSTR-1 Registry', key: 'gstr1' },
         { label: 'GSTR-2B Matching', key: 'gst2bMatching' },
         { label: 'Purchase Reports', action: () => openPlaceholder('Purchase Reports') },
         { label: 'Process Reports', action: () => openPlaceholder('Process Reports') },
         { label: 'Final Accounts', action: () => openPlaceholder('Final Accounts') }
      ],
      Ledger: [
         { label: 'Account Ledger Book', key: 'ledger' }
      ],
      Utilities: [
         { label: 'Data Refresh', action: () => bootstrapMasters().then(() => alert('All master data refreshed from server.')) },
         { label: 'Backup Database', action: () => openPlaceholder('Backup') },
         { label: 'Import Masters', action: () => openPlaceholder('Import Masters') },
         { label: 'Print Barcode', action: () => openPlaceholder('Print Barcode') },
         { label: 'Sql Tool', action: () => openPlaceholder('Sql Tool') }
      ],
      Admin: [
         { label: 'User Rights', action: () => setModals(prev => ({ ...prev, userRights: true })) },
         { label: 'Change Password', action: () => openPlaceholder('Change Password') },
         { label: 'Log Report', action: () => openPlaceholder('Log Report') }
      ],
      Company: [
         { label: 'Select Company', action: () => openPlaceholder('Select Company') },
         { label: 'Create Company', action: () => openPlaceholder('Create Company') },
         { label: 'Edit Company', action: () => openPlaceholder('Edit Company') }
      ]
   };

   const desktopIcons = [
      { id: 1, label: 'Sales Billing', icon: faFileInvoiceDollar, key: 'sales' },
      { id: 2, label: 'Purchase', icon: faCartFlatbed, key: 'purchase' },
      { id: 3, label: 'Bank Receipt', icon: faMoneyCheckDollar, key: 'receipt' },
      { id: 4, label: 'Bank Payment', icon: faHandHoldingDollar, key: 'payment' },
      { id: 5, label: 'Mill Issue', icon: faTruckArrowRight, key: 'millIssue' },
      { id: 6, label: 'Mill Receive', icon: faWarehouse, key: 'millRec' },
      { id: 7, label: 'Job Issue', icon: faScrewdriverWrench, key: 'jobIssue' },
      { id: 8, label: 'Job Receive', icon: faClipboardCheck, key: 'jobRec' },
      { id: 9, label: 'Visit Log', icon: faHandshake, key: 'visit' },
      { id: 10, label: 'Outstanding', icon: faChartPie, key: 'outstanding' },
   ];

   return (
      <div className={`fixed inset-0 overflow-hidden flex flex-col select-none transition-colors duration-500 bg-white ${isDark ? 'text-white bg-zinc-950' : 'text-black bg-white'}`}>

         {/* Top Header - Monochromatic Modern */}
         <div className={`flex items-center justify-between h-10 text-[10px] font-bold border-b relative z-[100] shadow-sm bg-black border-slate-800`}>
            <div className="flex items-center h-full pl-6 gap-3">
               <div className="w-3 h-3 bg-white rounded-sm" />
               <span className="text-white font-black uppercase tracking-[0.2em]">MAHAVEER IMPEX ERP</span>
            </div>

            <div className="flex items-center h-full pr-6 gap-8">
               <div className="text-white font-black flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]" />
                  {user?.name || 'User'}
               </div>
               <div className="flex items-center gap-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <button className="hover:text-white transition-colors flex items-center gap-2"><FontAwesomeIcon icon={faFilePen} /> Notepad</button>
                  <button className="hover:text-white transition-colors flex items-center gap-2"><FontAwesomeIcon icon={faDisplay} /> Remote</button>
                  <button className="hover:text-white transition-colors flex items-center gap-2" onClick={toggleTheme}><FontAwesomeIcon icon={isDark ? faSun : faMoon} /> {isDark ? 'Light' : 'Dark'}</button>
               </div>
            </div>
         </div>

         {/* Main Workspace with Double Sidebar */}
         <div className="flex-1 flex overflow-hidden">
            
            {/* Outer Sidebar (Narrow: 64px) */}
            <div className="w-16 flex flex-col items-center py-4 justify-between border-r shrink-0 z-10 transition-colors duration-500 bg-black border-slate-800 text-slate-400">
               <div className="flex flex-col gap-2 items-center w-full">
                  {desktopIcons.map((icon) => (
                     <button
                        key={icon.id}
                        onClick={() => toggleModal(icon.key, true)}
                        title={icon.label}
                        className="w-12 h-12 flex flex-col items-center justify-center rounded-xl transition-all hover:bg-slate-800 hover:text-white group relative"
                     >
                        <FontAwesomeIcon icon={icon.icon} className="text-sm" />
                        <span className="text-[7px] font-black uppercase tracking-tighter mt-1 text-center scale-90 opacity-70 group-hover:opacity-100">{icon.label.split(' ')[0]}</span>
                     </button>
                  ))}
               </div>
               
               <div className="flex flex-col items-center gap-4">
                  <button 
                     onClick={toggleTheme}
                     title={isDark ? "Light Mode" : "Dark Mode"}
                     className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 hover:text-white transition-all text-slate-400"
                  >
                     <FontAwesomeIcon icon={isDark ? faSun : faMoon} />
                  </button>
               </div>
            </div>

            {/* Inner Sidebar (Wide: 240px) */}
            <div className={`w-60 flex flex-col border-r overflow-y-auto no-scrollbar shrink-0 transition-colors duration-500 ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
               <div className="flex-1 flex flex-col divide-y divide-slate-150 dark:divide-zinc-800">
                  {Object.keys(menuData).map((section) => {
                     const isCollapsed = collapsedSections[section];
                     const items = menuData[section];
                     
                     return (
                        <div key={section} className="flex flex-col">
                           <button
                              onClick={() => toggleSection(section)}
                              className={`w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${isDark ? 'bg-zinc-950/40 hover:bg-zinc-950/80 text-zinc-400 hover:text-white' : 'bg-slate-100/50 hover:bg-slate-100 text-slate-500 hover:text-black'}`}
                           >
                              <span>{section}</span>
                              <FontAwesomeIcon 
                                 icon={faChevronRight} 
                                 className={`text-[8px] transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} 
                              />
                           </button>
                           
                           {!isCollapsed && (
                              <div className="py-1 flex flex-col bg-transparent">
                                 {items.map((item, idx) => {
                                    const label = typeof item === 'object' ? item.label : item;
                                    return (
                                       <button
                                          key={idx}
                                          onClick={() => handleMenuItemClick(item)}
                                          className={`w-full text-left px-6 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-600 hover:text-black hover:bg-slate-200/50'}`}
                                       >
                                          {label}
                                       </button>
                                    );
                                 })}
                              </div>
                           )}
                        </div>
                     );
                  })}
               </div>
            </div>

            {/* Main Content Workspace Container (Right pane) */}
            <div className={`flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar transition-colors duration-500 ${isDark ? 'bg-zinc-950 text-white' : 'bg-slate-50/10 text-black'}`}>
               
               {/* Branding Panel */}
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 animate-fadeIn">
                  <div>
                     <h1 className={`text-5xl font-black tracking-tight uppercase leading-none italic ${isDark ? 'text-white' : 'text-black'}`}>MAHAVEER IMPEX<span className="text-slate-200">.</span></h1>
                     <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.3em] mt-3">Professional ERP Command Center • v5.6.30</p>
                  </div>
                  <div className="flex items-center gap-4">
                     <button onClick={() => toggleModal('sales', true)} className={`px-8 py-3.5 font-bold text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center gap-3 ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-slate-800'}`}>
                        <FontAwesomeIcon icon={faFileInvoiceDollar} /> New Invoice
                     </button>
                     <button onClick={() => toggleModal('purchase', true)} className={`px-8 py-3.5 border font-bold text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-3 ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-slate-200 text-black hover:bg-slate-50'}`}>
                        <FontAwesomeIcon icon={faCartFlatbed} /> New Purchase
                     </button>
                  </div>
               </div>

               {/* Metrics Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                     { label: "Today's Sales", val: "₹ 1,84,500", icon: faIndianRupeeSign },
                     { label: "Pending Receivables", val: "₹ 12,40,200", icon: faScaleBalanced },
                     { label: "14 Active", sub: "Open Job Work Orders", icon: faWarehouse },
                     { label: "GST Liability This Month", val: "₹ 45,300", icon: faChartColumn }
                  ].map((kpi, idx) => (
                     <div key={idx} className={`rounded-xl border p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group ${isDark ? 'bg-zinc-900 border-zinc-800/80 text-white' : 'bg-white border-slate-100 text-black'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 border ${isDark ? 'bg-zinc-950 text-zinc-400 border-zinc-800 group-hover:bg-white group-hover:text-black' : 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-black group-hover:text-white'}`}>
                           <FontAwesomeIcon icon={kpi.icon} className="text-xs" />
                        </div>
                        <div className="flex flex-col">
                           <h3 className={`text-lg font-black tracking-tight leading-none ${isDark ? 'text-white' : 'text-black'}`}>
                              {kpi.val || kpi.label.split(' ')[0] + ' ' + kpi.label.split(' ')[1]}
                           </h3>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              {kpi.val ? kpi.label : kpi.sub}
                           </p>
                        </div>
                     </div>
                  ))}
               </div>

               {/* Shortcut Grid */}
               <div className="space-y-8 pt-4">
                  <div className="flex flex-col items-center gap-2">
                     <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] ${isDark ? 'text-zinc-400' : 'text-black'}`}>Core Modules Shortcuts</h3>
                     <div className={`h-[1px] w-12 ${isDark ? 'bg-zinc-700' : 'bg-black'}`} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
                     {desktopIcons.map((icon) => (
                        <button
                           key={icon.id}
                           onClick={() => toggleModal(icon.key, true)}
                           className={`border p-4 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-3 group ${isDark ? 'bg-zinc-900 border-zinc-800/80 hover:border-zinc-500' : 'bg-white border-slate-100 hover:border-black'}`}
                        >
                           <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-lg group-hover:scale-110 ${isDark ? 'bg-white text-black shadow-white/5' : 'bg-black text-white shadow-black/10'}`}>
                              <FontAwesomeIcon icon={icon.icon} size="sm" />
                           </div>
                           <span className={`text-[8px] font-black uppercase tracking-widest text-center ${isDark ? 'text-zinc-300' : 'text-black'}`}>{icon.label}</span>
                        </button>
                     ))}
                  </div>
               </div>

               {/* Advanced Intelligence & Compliance Section */}
               <div className="space-y-8 pt-4">
                  <div className="flex flex-col items-center gap-2">
                     <h3 className={`text-[10px] font-black uppercase tracking-[0.5em] ${isDark ? 'text-zinc-400' : 'text-black'}`}>Intelligence & Compliance</h3>
                     <div className={`h-[1px] w-12 ${isDark ? 'bg-zinc-700' : 'bg-black'}`} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                     {[
                        { label: 'Visit Management', icon: faHandshake, key: 'visit', desc: 'CRM & Field Intelligence' },
                        { label: 'GSTR-1 Advanced', icon: faFilePen, key: 'gstr1', desc: 'Compliant Schema Export' },
                        { label: '2B Matching', icon: faClipboardCheck, key: 'gst2bMatching', desc: 'Automated ITC Matching' },
                        { label: 'Compliance Overview', icon: faUserShield, key: 'gstCompliance', desc: 'GST Health Scorecard' },
                     ].map((item, idx) => (
                        <button
                           key={idx}
                           onClick={() => toggleModal(item.key, true)}
                           className={`p-8 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all flex flex-col items-center gap-4 group relative overflow-hidden ${isDark ? 'bg-zinc-900 border border-zinc-800 text-white' : 'bg-black text-white'}`}
                        >
                           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                              <FontAwesomeIcon icon={item.icon} size="4x" />
                           </div>
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-all ${isDark ? 'bg-zinc-950 text-white group-hover:bg-white group-hover:text-black' : 'bg-white/10 text-white group-hover:bg-white group-hover:text-black'}`}>
                              <FontAwesomeIcon icon={item.icon} size="lg" />
                           </div>
                           <div className="text-center">
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] block">{item.label}</span>
                              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-2 block">{item.desc}</span>
                           </div>
                        </button>
                     ))}
                  </div>
               </div>

               {/* Bottom Row: Activity + Alerts */}
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                  
                  {/* Activity list */}
                  <div className={`lg:col-span-7 rounded-2xl border shadow-sm overflow-hidden flex flex-col ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-100'}`}>
                     <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'bg-zinc-950/45 border-zinc-800' : 'bg-slate-50/30 border-slate-50'}`}>
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.4em] ${isDark ? 'text-zinc-400' : 'text-black'}`}>Recent Activity</h3>
                        <button className="text-[9px] font-bold text-slate-400 hover:text-black uppercase tracking-widest transition-all">View Analytics</button>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className={`text-[9px] font-bold uppercase tracking-widest border-b ${isDark ? 'text-zinc-500 border-zinc-800 bg-zinc-950/20' : 'text-slate-300 border-slate-50'}`}>
                                 <th className="px-6 py-3">Reference</th>
                                 <th className="px-6 py-3">Counterparty</th>
                                 <th className="px-6 py-3 text-right">Amount</th>
                                 <th className="px-6 py-3 text-center">Protocol</th>
                              </tr>
                           </thead>
                           <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-slate-50'}`}>
                              {[
                                 { ref: 'INV-2026-004', entity: 'Ankit Fabrics Pvt Ltd', val: '₹ 42,500.00', status: 'SETTLED' },
                                 { ref: 'INV-2026-003', entity: 'Balaji Creation', val: '₹ 88,000.00', status: 'PENDING' },
                                 { ref: 'INV-2026-002', entity: 'Vardhman Textiles', val: '₹ 1,18,400.00', status: 'PENDING' },
                              ].map((inv, idx) => (
                                 <tr key={idx} className={`transition-all group border-b last:border-0 ${isDark ? 'border-zinc-805 hover:bg-zinc-950/20' : 'border-slate-50 hover:bg-slate-50/50'}`}>
                                    <td className={`px-6 py-3 font-bold text-[10px] tracking-tight uppercase ${isDark ? 'text-white' : 'text-black'}`}>{inv.ref}</td>
                                    <td className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase">{inv.entity}</td>
                                    <td className={`px-6 py-3 text-right font-black text-[10px] ${isDark ? 'text-white' : 'text-black'}`}>{inv.val}</td>
                                    <td className="px-6 py-3 text-center">
                                       <span className={`px-3 py-1 text-[8px] font-bold uppercase rounded-lg ${inv.status === 'SETTLED' ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : (isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-400')}`}>
                                          {inv.status}
                                       </span>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>

                  {/* Alerts */}
                  <div className={`lg:col-span-5 rounded-2xl border shadow-sm p-6 flex flex-col ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-100 text-black'}`}>
                     <div className="flex justify-between items-center mb-6">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.4em] ${isDark ? 'text-zinc-400' : 'text-black'}`}>Stock Alerts</h3>
                        <span className={`px-3 py-1 text-[8px] font-bold uppercase rounded-lg tracking-widest ${isDark ? 'bg-white text-black' : 'bg-black text-white'}`}>2 Priority</span>
                     </div>
                     <div className="space-y-4 flex-1">
                        <div className={`flex items-center justify-between p-3 rounded-xl border transition-all group ${isDark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-500' : 'bg-slate-50 border-slate-50 hover:border-black'}`}>
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-[10px] shadow-sm transition-all ${isDark ? 'bg-zinc-900 text-zinc-400 group-hover:bg-white group-hover:text-black' : 'bg-white text-slate-600 group-hover:bg-black group-hover:text-white'}`}>45M</div>
                              <div>
                                 <p className={`text-[10px] font-bold uppercase tracking-tight leading-none ${isDark ? 'text-white' : 'text-black'}`}>Lycra Cotton 180</p>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Refill Recommended</p>
                              </div>
                           </div>
                           <button className={`px-4 py-1.5 text-[8px] font-bold rounded-lg transition-all uppercase tracking-widest ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-slate-800'}`}>ORDER</button>
                        </div>
                        <div className={`flex items-center justify-between p-3 rounded-xl border transition-all group ${isDark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-500' : 'bg-slate-50 border-slate-50 hover:border-black'}`}>
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-[10px] shadow-sm transition-all ${isDark ? 'bg-zinc-900 text-zinc-400 group-hover:bg-white group-hover:text-black' : 'bg-white text-slate-600 group-hover:bg-black group-hover:text-white'}`}>12M</div>
                              <div>
                                 <p className={`text-[10px] font-bold uppercase tracking-tight leading-none ${isDark ? 'text-white' : 'text-black'}`}>Premium Knit Blue</p>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Critical Low</p>
                              </div>
                           </div>
                           <button className={`px-4 py-1.5 text-[8px] font-bold rounded-lg transition-all uppercase tracking-widest ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-slate-800'}`}>ORDER</button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Compact Status Bar */}
         <div className="h-10 bg-black border-t border-slate-800 flex items-center justify-between px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <div className="flex gap-10">
               <span className="hover:text-white transition-colors cursor-pointer" onClick={() => toggleModal('ledger', true)}>Ctrl+L : Ledger</span>
               <span className="hover:text-white transition-colors cursor-pointer" onClick={() => openGenericMaster('AccountGroup')}>F4 : Master</span>
               <span className="hover:text-white transition-colors cursor-pointer">F12 : Save</span>
            </div>
            <div className="flex items-center gap-8">
               <span className="flex items-center gap-2 text-white"><FontAwesomeIcon icon={faBuilding} /> MAHAVEER IMPEX</span>
               <button onClick={() => window.close()} className="px-6 py-1 bg-white text-black rounded-lg hover:bg-slate-200 transition-all font-black">Exit ERP</button>
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
         <GstComplianceModal isOpen={modals.gstCompliance} onClose={() => toggleModal('gstCompliance', false)} />
         <VisitLogModal isOpen={modals.visit} onClose={() => toggleModal('visit', false)} />
         <PartyModal isOpen={modals.party} onClose={() => toggleModal('party', false)} />
         <BookMasterModal isOpen={modals.bookMaster} onClose={() => toggleModal('bookMaster', false)} />
         <Modal isOpen={modals.inventoryPage} onClose={() => toggleModal('inventoryPage', false)} title="Inventory Stock Control" className="max-w-[90vw]">
            <div className="bg-white p-2 rounded-[2.5rem] overflow-hidden">
               <InventoryPage />
            </div>
         </Modal>

         {/* Job Worker Modal Wrap */}
         <Modal isOpen={modals.jobWorker} onClose={() => toggleModal('jobWorker', false)} title="Processing Partner Registry" className="max-w-[90vw]">
            <div className="bg-white p-10 rounded-[2.5rem]">
               <JobWorkerMaster />
            </div>
         </Modal>

         {/* Module Placeholder Modal */}
         <Modal
            isOpen={modals.placeholder}
            onClose={() => toggleModal('placeholder', false)}
            title="System Command Center"
            className="max-w-md"
         >
            <div className="p-10 text-center space-y-6">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="text-slate-200 text-3xl" />
               </div>
               <div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-black">{placeholderName} Under Construction</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4 leading-relaxed">
                     This module is currently being optimized for the new monochromatic design system. Functional logic is active, but UI rendering is pending.
                  </p>
               </div>
               <button
                  onClick={() => toggleModal('placeholder', false)}
                  className="w-full py-4 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-xl"
               >
                  Acknowledge & Continue
               </button>
            </div>
         </Modal>

         {/* Book Selection Modal */}
         <BookSelectionModal
            isOpen={bookSelection.isOpen}
            onClose={() => setBookSelection({ isOpen: false, module: null })}
            moduleName={bookSelection.module}
            onSelectBook={handleSelectBook}
         />

         {/* New Database-Connected Modals */}
         <GenericMasterModal 
            isOpen={modals.genericMaster} 
            onClose={() => setModals(prev => ({ ...prev, genericMaster: false }))} 
            type={modals.genericMasterType} 
         />
         <OrderModal 
            isOpen={modals.order} 
            onClose={() => setModals(prev => ({ ...prev, order: false }))} 
            initialType={modals.orderType} 
         />
         <ReturnModal 
            isOpen={modals.returnInv} 
            onClose={() => setModals(prev => ({ ...prev, returnInv: false }))} 
            initialType={modals.returnType} 
         />
         <NoteModal 
            isOpen={modals.note} 
            onClose={() => setModals(prev => ({ ...prev, note: false }))} 
            initialType={modals.noteType} 
         />
         <JournalEntryModal 
            isOpen={modals.journal} 
            onClose={() => setModals(prev => ({ ...prev, journal: false }))} 
         />
         <UserRightsModal
            isOpen={modals.userRights}
            onClose={() => setModals(prev => ({ ...prev, userRights: false }))}
         />

      </div>
   );
};

export default Dashboard;
