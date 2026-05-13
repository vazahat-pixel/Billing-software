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
      <div className={`fixed inset-0 overflow-hidden flex flex-col select-none transition-colors duration-500 bg-[#FDFCF9] ${isDark ? 'text-white' : 'text-black'}`}>

         {/* Top Header - Monochromatic Modern */}
         <div className={`flex items-center justify-between h-10 text-[10px] font-bold border-b relative z-[100] shadow-sm bg-white border-slate-100`}>
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
                        className={`px-4 h-full border-r border-slate-100 hover:bg-slate-50 transition-all uppercase tracking-widest text-slate-500 hover:text-black ${activeMenu === menu ? 'bg-slate-100 text-black' : ''}`}
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
                                 className="absolute top-10 left-0 w-64 bg-white border border-slate-100 shadow-2xl rounded-xl py-2 z-[110]"
                              >
                                 {menuData[menu].map((item, idx) => {
                                    const label = typeof item === 'object' ? item.label : item;
                                    const key = typeof item === 'object' ? item.key : null;
                                    const color = typeof item === 'object' ? item.color : 'text-slate-700';

                                    return (
                                       <button
                                          key={idx}
                                          onClick={() => {
                                             if (key) toggleModal(key, true);
                                             setActiveMenu(null);
                                          }}
                                          className={`w-full text-left px-4 py-2 text-[10px] hover:bg-slate-50 transition-colors flex justify-between items-center group font-bold uppercase tracking-widest ${color} hover:text-black`}
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
               <div className="text-black font-black flex items-center gap-2">
                  <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
                  ID: 5630
               </div>
               <div className="flex items-center gap-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <button className="hover:text-black transition-colors flex items-center gap-2"><FontAwesomeIcon icon={faFilePen} /> Notepad</button>
                  <button className="hover:text-black transition-colors flex items-center gap-2"><FontAwesomeIcon icon={faDisplay} /> Remote</button>
                  <button className="hover:text-black transition-colors flex items-center gap-2" onClick={toggleTheme}><FontAwesomeIcon icon={isDark ? faSun : faMoon} /> {isDark ? 'Light' : 'Dark'}</button>
               </div>
            </div>
         </div>

         {/* Main Content Area */}
         <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {[
                  { label: "Today's Revenue", val: "₹ 1,84,500", icon: faIndianRupeeSign, color: "text-green-500" },
                  { label: "Receivables", val: "₹ 12,40,200", icon: faScaleBalanced, color: "text-blue-500" },
                  { label: "Active Jobs", val: "14 Orders", icon: faWarehouse, color: "text-amber-500" },
                  { label: "Compliance", val: "₹ 45,300", icon: faChartColumn, color: "text-cyan-500" }
               ].map((kpi, idx) => (
                  <div key={idx} className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm group hover:shadow-md transition-all">
                     <div className="flex justify-between items-start mb-6">
                        <div className={`p-4 bg-slate-50 rounded-2xl group-hover:bg-black group-hover:text-white transition-all`}>
                           <FontAwesomeIcon icon={kpi.icon} className="text-lg" />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${kpi.color}`}>{kpi.label.split(' ')[0]}</span>
                     </div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                     <h3 className="text-3xl font-black text-black mt-1 tracking-tight">{kpi.val}</h3>
                  </div>
               ))}
            </div>

            {/* Shortcut Grid */}
            <div className="space-y-6">
               <div className="flex items-center gap-4">
                  <h3 className="text-[11px] font-bold text-black uppercase tracking-[0.4em] whitespace-nowrap">Rapid Access</h3>
                  <div className="h-[1px] flex-1 bg-slate-100" />
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
                  {desktopIcons.map((icon) => (
                     <button
                        key={icon.id}
                        onClick={() => toggleModal(icon.key, true)}
                        className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-black transition-all flex flex-col items-center gap-3 group"
                     >
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:text-white transition-all">
                           <FontAwesomeIcon icon={icon.icon} />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-center text-slate-400 group-hover:text-black">{icon.label}</span>
                     </button>
                  ))}
               </div>
            </div>

            {/* Bottom Row: Activity + Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
               <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                     <h3 className="text-[12px] font-bold text-black uppercase tracking-widest">Recent Activity</h3>
                     <button className="text-[10px] font-bold text-slate-400 hover:text-black uppercase tracking-widest transition-all">View Analytics</button>
                  </div>
                  <div className="p-4 overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                              <th className="px-6 py-4">Reference</th>
                              <th className="px-6 py-4">Counterparty</th>
                              <th className="px-6 py-4 text-right">Amount</th>
                              <th className="px-6 py-4 text-center">Protocol</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {[
                              { ref: 'INV-2026-004', entity: 'Ankit Fabrics Pvt Ltd', val: '₹ 42,500.00', status: 'SETTLED' },
                              { ref: 'INV-2026-003', entity: 'Balaji Creation', val: '₹ 88,000.00', status: 'PENDING' },
                              { ref: 'INV-2026-002', entity: 'Vardhman Textiles', val: '₹ 1,18,400.00', status: 'PENDING' },
                           ].map((inv, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                                 <td className="px-6 py-5 font-bold text-black text-[11px] tracking-tight">{inv.ref}</td>
                                 <td className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase">{inv.entity}</td>
                                 <td className="px-6 py-5 text-right font-black text-black text-[11px]">{inv.val}</td>
                                 <td className="px-6 py-5 text-center">
                                    <span className={`px-3 py-1 text-[9px] font-bold uppercase rounded-lg ${inv.status === 'SETTLED' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                       {inv.status}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>

               <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                     <h3 className="text-[12px] font-bold text-black uppercase tracking-widest">Stock Alerts</h3>
                     <span className="px-3 py-1 bg-red-50 text-red-600 text-[9px] font-bold uppercase rounded-lg">2 Priority</span>
                  </div>
                  <div className="space-y-6 flex-1">
                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-[11px] shadow-sm">45M</div>
                           <div>
                              <p className="text-[11px] font-bold text-black uppercase tracking-tight">Lycra Cotton 180</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Refill Recommended</p>
                           </div>
                        </div>
                        <button className="px-5 py-2 bg-black text-white text-[9px] font-bold rounded-lg hover:bg-slate-800 transition-all">ORDER</button>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-[11px] shadow-sm">12M</div>
                           <div>
                              <p className="text-[11px] font-bold text-black uppercase tracking-tight">Premium Knit Blue</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Critical Low</p>
                           </div>
                        </div>
                        <button className="px-5 py-2 bg-black text-white text-[9px] font-bold rounded-lg hover:bg-slate-800 transition-all">ORDER</button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Compact Status Bar */}
         <div className="h-10 bg-white border-t border-slate-100 flex items-center justify-between px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <div className="flex gap-10">
               <span className="hover:text-black transition-colors cursor-pointer">Ctrl+L : Ledger</span>
               <span className="hover:text-black transition-colors cursor-pointer">F4 : Master</span>
               <span className="hover:text-black transition-colors cursor-pointer">F12 : Save</span>
            </div>
            <div className="flex items-center gap-8">
               <span className="flex items-center gap-2"><FontAwesomeIcon icon={faBuilding} /> MAHAVEER IMPEX</span>
               <button onClick={() => window.close()} className="px-6 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all">Exit ERP</button>
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
