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

// GST Compliance Modals
import {
   Gst3bMonthlyModal,
   Gstr1Modal,
   Gst2bMatchingModal,
   Gst3bDetailModal,
   Gstr1ErrorChekModal
} from './gst/GstModals';
import VisitLogModal from './crm/VisitLogModal';
import PartyModal from './masters/PartyModal';
import JobWorkerMaster from './masters/JobWorkerMaster';
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
      visit: false,
      party: false,
      jobWorker: false,
      placeholder: false
   });
   
   const [placeholderName, setPlaceholderName] = useState('');

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
      
      // Handle navigation or placeholder for missing modules
      if (val === true && !key) {
         setPlaceholderName('MODULE');
         setModals(prev => ({ ...prev, placeholder: true }));
         return;
      }

      setModals(prev => ({ ...prev, [key]: val }));
      setActiveMenu(null);
   };

   const openPlaceholder = (name) => {
      setPlaceholderName(name);
      setModals(prev => ({ ...prev, placeholder: true }));
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
         { label: 'Party Master', key: 'party' },
         { label: 'Job Worker Master', key: 'jobWorker' },
         { label: 'Account Group', action: () => openPlaceholder('Account Group') },
         { label: 'Item Group', action: () => openPlaceholder('Item Group') },
         { label: 'City', action: () => openPlaceholder('City Master') },
         { label: 'Transport', action: () => openPlaceholder('Transport') },
         'Opening Balance', 'Opening Stock Entry', 'Bank Setup (Recon)', 'Color', 'Design'
      ],
      Transaction: [
         { label: '1 Bank Receipt', key: 'receipt' },
         { label: '2 Sales Billing', key: 'sales' },
         { label: '3 Purchase', key: 'purchase' },
         { label: '4 Mill Issue', key: 'millIssue' },
         { label: '5 Mill Receive', key: 'millRec' },
         { label: '6 Job Issue', key: 'jobIssue' },
         { label: '7 Job Receive', key: 'jobRec' },
         'Journal Entry', 'Debit/Credit Note', 'Sales Return', 'Purchase Return', 'Purchase Order', 'Sales Order'
      ],
      Reports: [
         { label: 'Sales Outstanding', key: 'outstanding' },
         { label: 'GSTR-3B Monthly', key: 'gst3bMonthly' },
         { label: 'GSTR-1 Registry', key: 'gstr1' },
         { label: 'GSTR-2B Matching', key: 'gst2bMatching' },
         'Purchase Reports', 'Process Reports', 'Final Accounts'
      ],
      Ledger: [],
      Utilities: [
         { label: 'Data Refresh', action: () => openPlaceholder('Data Refresh') },
         { label: 'Backup Database', action: () => openPlaceholder('Backup') },
         'Import Masters', 'Print Barcode', 'Sql Tool'
      ],
      Admin: ['User Rights', 'Change Password', 'Log Report'],
      Company: ['Select Company', 'Create Company', 'Edit Company']
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
      <div className={`fixed inset-0 overflow-hidden flex flex-col select-none transition-colors duration-500 bg-white ${isDark ? 'text-white' : 'text-black'}`}>

         {/* Top Header - Monochromatic Modern */}
         <div className={`flex items-center justify-between h-10 text-[10px] font-bold border-b relative z-[100] shadow-sm bg-black border-slate-800`}>
            <div className="flex h-full">
               {Object.keys(menuData).map(menu => (
                  <div key={menu} className="relative h-full">
                     <button
                        onClick={() => {
                           if (menu === 'Ledger') {
                              toggleModal('ledger', true);
                           } else {
                              setActiveMenu(activeMenu === menu ? null : menu);
                           }
                        }}
                        className={`px-4 h-full border-r border-slate-800 hover:bg-slate-900 transition-all uppercase tracking-widest text-slate-400 hover:text-white ${activeMenu === menu ? 'bg-slate-900 text-white' : ''}`}
                     >
                        {menu}
                     </button>

                     <AnimatePresence>
                        {activeMenu === menu && menuData[menu].length > 0 && (
                           <>
                              <div className="fixed inset-0 z-[105]" onClick={() => setActiveMenu(null)}></div>
                              <motion.div
                                 initial={{ opacity: 0, y: 5 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 exit={{ opacity: 0, y: 5 }}
                                 className="absolute top-10 left-0 w-64 bg-black border border-slate-800 shadow-2xl rounded-xl py-2 z-[110]"
                              >
                                 {menuData[menu].map((item, idx) => {
                                    const label = typeof item === 'object' ? item.label : item;
                                    const key = typeof item === 'object' ? item.key : null;

                                    return (
                                       <button
                                          key={idx}
                                          onClick={() => {
                                             if (key) toggleModal(key, true);
                                             else if (item.action) item.action();
                                             else openPlaceholder(label);
                                             setActiveMenu(null);
                                          }}
                                          className={`w-full text-left px-4 py-2 text-[10px] hover:bg-white hover:text-black transition-colors flex justify-between items-center group font-bold uppercase tracking-widest text-slate-400`}
                                       >
                                          <span>{label}</span>
                                          {['Process', 'Job Work', 'Import', 'Reports'].some(s => label.includes(s)) &&
                                             <FontAwesomeIcon icon={faChevronRight} className="text-[9px] opacity-20 group-hover:opacity-100" />
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
            </div>

            <div className="flex items-center h-full pr-6 gap-8">
               <div className="text-white font-black flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]" />
                  ID: 5630
               </div>
               <div className="flex items-center gap-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <button className="hover:text-white transition-colors flex items-center gap-2"><FontAwesomeIcon icon={faFilePen} /> Notepad</button>
                  <button className="hover:text-white transition-colors flex items-center gap-2"><FontAwesomeIcon icon={faDisplay} /> Remote</button>
                  <button className="hover:text-white transition-colors flex items-center gap-2" onClick={toggleTheme}><FontAwesomeIcon icon={isDark ? faSun : faMoon} /> {isDark ? 'Light' : 'Dark'}</button>
               </div>
            </div>
         </div>

         {/* Main Content Area */}
         <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
            {/* Branding Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
               <div>
                  <h1 className="text-5xl font-black tracking-tight uppercase leading-none italic">MAHAVEER IMPEX<span className="text-slate-200">.</span></h1>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.3em] mt-3">Professional ERP Command Center • v5.6.30</p>
               </div>
               <div className="flex items-center gap-4">
                  <button onClick={() => toggleModal('sales', true)} className="px-8 py-3.5 bg-black text-white font-bold text-[11px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center gap-3">
                     <FontAwesomeIcon icon={faFileInvoiceDollar} /> New Invoice
                  </button>
                  <button onClick={() => toggleModal('purchase', true)} className="px-8 py-3.5 bg-white border border-slate-200 text-black font-bold text-[11px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-3">
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
                   <div key={idx} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                      <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:text-white transition-all shrink-0 border border-slate-100">
                         <FontAwesomeIcon icon={kpi.icon} className="text-xs" />
                      </div>
                      <div className="flex flex-col">
                         <h3 className="text-lg font-black text-black tracking-tight leading-none">
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
                  <h3 className="text-[10px] font-black text-black uppercase tracking-[0.5em]">Core Modules Shortcuts</h3>
                  <div className="h-[1px] w-12 bg-black" />
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
                  {desktopIcons.map((icon) => (
                     <button
                        key={icon.id}
                        onClick={() => toggleModal(icon.key, true)}
                        className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-black transition-all flex flex-col items-center gap-3 group"
                     >
                        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white transition-all shadow-lg shadow-black/10 group-hover:scale-110">
                           <FontAwesomeIcon icon={icon.icon} size="sm" />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-center text-black">{icon.label}</span>
                     </button>
                  ))}
               </div>
            </div>

            {/* Bottom Row: Activity + Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                     <h3 className="text-[10px] font-black text-black uppercase tracking-[0.4em]">Recent Activity</h3>
                     <button className="text-[9px] font-bold text-slate-400 hover:text-black uppercase tracking-widest transition-all">View Analytics</button>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="text-[9px] font-bold text-slate-300 uppercase tracking-widest border-b border-slate-50">
                              <th className="px-6 py-3">Reference</th>
                              <th className="px-6 py-3">Counterparty</th>
                              <th className="px-6 py-3 text-right">Amount</th>
                              <th className="px-6 py-3 text-center">Protocol</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {[
                              { ref: 'INV-2026-004', entity: 'Ankit Fabrics Pvt Ltd', val: '₹ 42,500.00', status: 'SETTLED' },
                              { ref: 'INV-2026-003', entity: 'Balaji Creation', val: '₹ 88,000.00', status: 'PENDING' },
                              { ref: 'INV-2026-002', entity: 'Vardhman Textiles', val: '₹ 1,18,400.00', status: 'PENDING' },
                           ].map((inv, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                                 <td className="px-6 py-3 font-bold text-black text-[10px] tracking-tight uppercase">{inv.ref}</td>
                                 <td className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase">{inv.entity}</td>
                                 <td className="px-6 py-3 text-right font-black text-black text-[10px]">{inv.val}</td>
                                 <td className="px-6 py-3 text-center">
                                    <span className={`px-3 py-1 text-[8px] font-bold uppercase rounded-lg ${inv.status === 'SETTLED' ? 'bg-black text-white' : 'bg-slate-100 text-slate-400'}`}>
                                       {inv.status}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>

               <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-[10px] font-black text-black uppercase tracking-[0.4em]">Stock Alerts</h3>
                     <span className="px-3 py-1 bg-black text-white text-[8px] font-bold uppercase rounded-lg tracking-widest">2 Priority</span>
                  </div>
                  <div className="space-y-4 flex-1">
                     <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-50 hover:border-black transition-all group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black text-[10px] shadow-sm group-hover:bg-black group-hover:text-white transition-all">45M</div>
                           <div>
                              <p className="text-[10px] font-bold text-black uppercase tracking-tight leading-none">Lycra Cotton 180</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Refill Recommended</p>
                           </div>
                        </div>
                        <button className="px-4 py-1.5 bg-black text-white text-[8px] font-bold rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest">ORDER</button>
                     </div>
                     <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-50 hover:border-black transition-all group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black text-[10px] shadow-sm group-hover:bg-black group-hover:text-white transition-all">12M</div>
                           <div>
                              <p className="text-[10px] font-bold text-black uppercase tracking-tight leading-none">Premium Knit Blue</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Critical Low</p>
                           </div>
                        </div>
                        <button className="px-4 py-1.5 bg-black text-white text-[8px] font-bold rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest">ORDER</button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Compact Status Bar */}
         <div className="h-10 bg-black border-t border-slate-800 flex items-center justify-between px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <div className="flex gap-10">
               <span className="hover:text-white transition-colors cursor-pointer">Ctrl+L : Ledger</span>
               <span className="hover:text-white transition-colors cursor-pointer">F4 : Master</span>
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
         <VisitLogModal isOpen={modals.visit} onClose={() => toggleModal('visit', false)} />
         <PartyModal isOpen={modals.party} onClose={() => toggleModal('party', false)} />

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

      </div>
   );
};

export default Dashboard;
