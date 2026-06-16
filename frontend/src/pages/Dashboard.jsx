import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
   faFileInvoiceDollar, faCartFlatbed, faMoneyCheckDollar,
   faHandHoldingDollar, faTruckArrowRight, faWarehouse,
   faScrewdriverWrench, faClipboardCheck, faChartPie,
   faChevronRight, faChevronDown, faSync, faSearch, faBell,
   faTriangleExclamation, faHandshake
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
import OpeningBalanceModal from './masters/OpeningBalanceModal';
import OpeningStockModal from './masters/OpeningStockModal';
import DataRecordsHub from './records/DataRecordsHub';
import { getPermissions } from '../utils/permissions';

const Dashboard = () => {
   const { user, bootstrapMasters, refreshAllData, sales, purchases, inventoryLots, jobWorkEntries, parties, items } = useStore();
   const permissions = useMemo(() => getPermissions(user?.companyRole), [user?.companyRole]);
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
      userRights: false,
      openingBalance: false,
      openingStock: false,
      recordsHub: false,
      recordsTab: 'accounts'
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
   const [sidebarOpen, setSidebarOpen] = useState(true);
   const [activeMenuKey, setActiveMenuKey] = useState(null);

   const parseMenuLabel = (label) => {
      const match = label.match(/^(\d+)\s+(.+)$/);
      if (match) return { badge: match[1], text: match[2] };
      return { badge: null, text: label };
   };
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

   const openRecordsHub = (tab = 'accounts') => {
      setModals(prev => ({
         ...prev,
         recordsHub: true,
         recordsTab: tab
      }));
   };

   const dashboardStats = useMemo(() => {
      const totalSales = sales.reduce((a, s) => a + (s.netAmount || s.totals?.total || 0), 0);
      const totalPurchases = purchases.reduce((a, p) => a + (p.netAmount || p.totals?.total || 0), 0);
      const stockMtrs = inventoryLots.reduce((a, l) => a + (l.remainingMtrs || 0), 0);
      const activeJobs = jobWorkEntries.filter(j => j.status !== 'Received' && j.status !== 'Closed').length;
      return { totalSales, totalPurchases, stockMtrs, activeJobs, accountCount: parties.length, itemCount: items.length };
   }, [sales, purchases, inventoryLots, jobWorkEntries, parties, items]);

   const toggleSection = (section) => {
      setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
   };

   const handleMenuItemClick = (item) => {
      const key = item.key || item.label;
      setActiveMenuKey(key);
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
         { label: 'HSN Code', action: () => openGenericMaster('HSN') },
         { label: 'Opening Balance', action: () => setModals(prev => ({ ...prev, openingBalance: true })) },
         { label: 'Opening Stock Entry', action: () => setModals(prev => ({ ...prev, openingStock: true })) },
         { label: 'Bank Setup (Recon)', action: () => openPlaceholder('Bank Setup') }
      ],
      Transaction: [
         { label: 'Bank Receipt', key: 'receipt' },
         { label: 'Bank Payment', key: 'payment' },
         { label: 'Sales Billing', key: 'sales' },
         { label: 'Purchase', key: 'purchase' },
         { label: 'Mill Issue', key: 'millIssue' },
         { label: 'Mill Receive', key: 'millRec' },
         { label: 'Job Issue', key: 'jobIssue' },
         { label: 'Job Receive', key: 'jobRec' },
         { label: 'Journal Entry', action: () => openJournal() },
         { label: 'Debit/Credit Note', action: () => openNote('Credit') },
         { label: 'Sales Return', action: () => openReturn('Sales') },
         { label: 'Purchase Return', action: () => openReturn('Purchase') },
         { label: 'Sales Order', action: () => openOrder('Sales') },
         { label: 'Purchase Order', action: () => openOrder('Purchase') }
      ],
      Records: [
         { label: 'All Saved Data', action: () => openRecordsHub('accounts') },
         { label: 'Account List', action: () => openRecordsHub('accounts') },
         { label: 'Item List', action: () => openRecordsHub('items') },
         { label: 'Inventory Lots', action: () => openRecordsHub('inventory') },
         { label: 'Sales Invoices', action: () => openRecordsHub('sales') },
         { label: 'Purchase Bills', action: () => openRecordsHub('purchases') },
         { label: 'Mill Issue List', action: () => openRecordsHub('millIssue') },
         { label: 'Bank Receipts', action: () => openRecordsHub('receipts') },
         { label: 'Bank Payments', action: () => openRecordsHub('payments') },
         { label: 'Sales Orders', action: () => openRecordsHub('salesOrders') },
         { label: 'Purchase Orders', action: () => openRecordsHub('purchaseOrders') },
         { label: 'Sales Returns', action: () => openRecordsHub('salesReturns') },
         { label: 'Purchase Returns', action: () => openRecordsHub('purchaseReturns') },
         { label: 'Debit/Credit Notes', action: () => openRecordsHub('notes') },
         { label: 'Visit Logs', action: () => openRecordsHub('visits') },
         { label: 'Book List', action: () => openRecordsHub('books') }
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
         { label: 'Data Refresh', action: () => refreshAllData().then(() => alert('All data refreshed from server.')) },
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

   const visibleMenuData = useMemo(() => {
      const filtered = {};
      Object.entries(menuData).forEach(([section, items]) => {
         if (permissions.canAccessSection(section)) {
            filtered[section] = section === 'Admin'
              ? items.filter(i => i.label !== 'User Rights' || permissions.canManageUsers)
              : items;
         }
      });
      return filtered;
   }, [permissions]);

   const coreModules = [
      { id: 1, label: 'Sales Billing', icon: faFileInvoiceDollar, key: 'sales' },
      { id: 2, label: 'Purchase', icon: faCartFlatbed, key: 'purchase' },
      { id: 3, label: 'Bank Receipt', icon: faMoneyCheckDollar, key: 'receipt' },
      { id: 4, label: 'Bank Payment', icon: faHandHoldingDollar, key: 'payment' },
      { id: 5, label: 'Mill Issue', icon: faTruckArrowRight, key: 'millIssue' },
      { id: 6, label: 'Mill Receive', icon: faWarehouse, key: 'millRec' },
      { id: 7, label: 'Job Issue', icon: faScrewdriverWrench, key: 'jobIssue' },
      { id: 8, label: 'Job Receive', icon: faClipboardCheck, key: 'jobRec' },
      { id: 9, label: 'GSTR-1', icon: faChartPie, key: 'gstr1' },
      { id: 10, label: 'GSTR-2', icon: faChartPie, key: 'gst2bMatching' },
      { id: 11, label: 'ETB', icon: faFileInvoiceDollar, key: 'gstCompliance' },
      { id: 12, label: 'Visit Log', icon: faHandshake, key: 'visit' },
      { id: 13, label: 'Outstanding', icon: faChartPie, key: 'outstanding' },
   ];

   return (
      <div className="erp-shell fixed inset-0 flex overflow-hidden select-none">

         {/* Core modules sidebar */}
         <aside className="erp-rail flex flex-col py-3 gap-1 shrink-0 overflow-y-auto no-scrollbar bg-white/50 backdrop-blur-md">
            <p className="px-4 py-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest shrink-0">Core Modules</p>
            {coreModules.map((mod) => (
               <button
                  key={mod.id}
                  type="button"
                  onClick={() => { setActiveMenuKey(mod.key); toggleModal(mod.key, true); }}
                  className={`mx-2 flex items-center gap-3 h-10 px-3 rounded-xl text-left transition-all group ${
                     activeMenuKey === mod.key
                        ? 'bg-[var(--accent)] text-white shadow-md'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]'
                  }`}
               >
                  <FontAwesomeIcon icon={mod.icon} className={`text-sm w-4 shrink-0 transition-transform group-hover:scale-110 ${activeMenuKey === mod.key ? 'text-white' : 'text-[var(--accent)]'}`} />
                  <span className="text-[13px] font-semibold truncate leading-tight">{mod.label}</span>
               </button>
            ))}
         </aside>

         {/* Menu sidebar removed, moved to Top Bar */}

         {/* Main Dashboard Area */}
         <main className="flex-1 min-w-0 flex flex-col bg-[var(--bg-base)] overflow-y-auto relative no-scrollbar">
            
            {/* Premium Top Navbar */}
            <header className="sticky top-0 z-50 flex flex-col bg-white/80 backdrop-blur-md border-b border-[var(--border)] transition-all">
               {/* Top Row */}
               <div className="flex items-center justify-between px-6 h-[56px]">
                  <div className="flex items-center gap-4">
                     <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        {user?.companyName ? user.companyName.charAt(0) : 'E'}
                     </div>
                     <nav className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-secondary)]">
                        <span className="text-[var(--text-primary)] font-bold tracking-tight text-[14px]">{user?.companyName || 'Mahaveer Impex'}</span>
                        <span className="text-[var(--text-muted)] px-1">•</span>
                        <span className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Enterprise Plan</span>
                     </nav>
                  </div>

                  <div className="flex-1 max-w-md mx-6 hidden md:block">
                     <div className="relative group">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors text-[12px]" />
                        <input type="text" placeholder="Global Search (Ctrl+K)..." className="w-full bg-white border border-[var(--border-strong)] rounded-full py-1.5 pl-8 pr-4 text-[12px] shadow-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all" />
                     </div>
                  </div>

                  <div className="flex items-center gap-5">
                     <button type="button" onClick={() => refreshAllData().then(() => alert('Data refreshed.'))} className="text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors flex items-center gap-2">
                        <FontAwesomeIcon icon={faSync} className="text-[10px]" />
                        <span className="hidden sm:inline">Sync</span>
                     </button>
                     <div className="h-4 w-[1px] bg-[var(--border-strong)]"></div>
                     <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors relative">
                        <FontAwesomeIcon icon={faBell} className="text-[14px]" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[var(--red)] rounded-full border border-white"></span>
                     </button>
                     <div className="h-4 w-[1px] bg-[var(--border-strong)]"></div>
                     <div className="flex items-center gap-3 cursor-pointer group">
                        <div className="text-right hidden sm:block">
                           <div className="text-[12px] font-semibold text-[var(--text-primary)] leading-none mb-0.5">{user?.name || 'Administrator'}</div>
                           <div className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wide">{user?.role || 'System Access'}</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-[12px] group-hover:scale-105 transition-transform shadow-sm">
                           {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                        </div>
                     </div>
                  </div>
               </div>

               {/* Bottom Row - Mega Menu */}
               <div className="flex items-center gap-2 px-6 h-[44px] border-t border-[var(--border-subtle)] bg-white/40">
                  {Object.keys(visibleMenuData).map((section) => (
                     <div key={section} className="relative group h-full flex items-center">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--accent)] group-hover:bg-[var(--accent-light)] transition-colors uppercase tracking-widest">
                           {section}
                           <FontAwesomeIcon icon={faChevronDown} className="text-[9px] opacity-70" />
                        </button>
                        
                        {/* Dropdown Content */}
                        <div className="absolute top-[40px] left-0 mt-0 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-50">
                           <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-xl shadow-[var(--shadow-float)] overflow-y-auto max-h-[calc(100vh-120px)] py-2 mt-1 no-scrollbar">
                              {visibleMenuData[section].map((item, idx) => {
                                 const label = typeof item === 'object' ? item.label : item;
                                 const { badge, text } = parseMenuLabel(label);
                                 return (
                                    <button
                                       key={idx}
                                       type="button"
                                       onClick={() => handleMenuItemClick(item)}
                                       className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-left text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--blue-bg)] transition-colors font-medium"
                                    >
                                       {badge && <span className="text-[10px] text-white bg-[var(--accent)] px-1.5 py-0.5 rounded w-5 text-center font-mono shrink-0">{badge}</span>}
                                       <span className="truncate">{text}</span>
                                    </button>
                                 );
                              })}
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </header>

            <div className="p-6 relative flex-1 flex flex-col">
               <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white/40 to-transparent pointer-events-none"></div>
               
               <div className="w-full max-w-7xl mx-auto relative z-10 flex flex-col gap-6">
               
               {/* Dashboard Header */}
               <div className="flex items-end justify-between animate-fade-in-up">
                  <div>
                     <h2 className="text-display mb-1 text-[22px]">Dashboard Overview</h2>
                     <p className="text-body text-[var(--text-muted)]">Here's what's happening with your business today.</p>
                  </div>
                  <div className="flex gap-3">
                     <button className="erp-btn erp-btn-secondary h-8 px-4 text-[12px]" onClick={() => refreshAllData()}><FontAwesomeIcon icon={faSync} className="text-[10px]" /> Sync Data</button>
                     <button className="erp-btn erp-btn-secondary h-8 px-4 text-[12px]" onClick={() => openRecordsHub('accounts')}>View Records</button>
                     <button className="erp-btn erp-btn-primary h-8 px-4 text-[12px]" onClick={() => toggleModal('sales', true)}>+ New Invoice</button>
                  </div>
               </div>

               {/* KPI Cards removed to hide sensitive information on home screen */}

               {/* Secondary Grid (Charts & Activity) */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                  
                  {/* Recent Activity Timeline - taking full width since quick access modules are removed */}
                  <div className="erp-card p-5 lg:col-span-3 max-w-4xl">
                     <h3 className="text-[14px] font-semibold mb-4 text-[var(--text-primary)]">Recent Activity</h3>
                     <div className="flex flex-col gap-4">
                        {[
                           { text: 'New Sales Invoice #INV-2041 created', time: '10 mins ago', type: 'sales' },
                           { text: 'Payment of ₹50,000 received from Acme Corp', time: '1 hour ago', type: 'receipt' },
                           { text: 'Job Work issue challan generated', time: '3 hours ago', type: 'job' },
                           { text: 'Purchase bill #PB-902 entered', time: '5 hours ago', type: 'purchase' },
                           { text: 'Stock transfer to Warehouse B completed', time: 'Yesterday', type: 'inventory' },
                        ].map((act, i) => (
                           <div key={i} className="flex gap-3 items-start">
                              <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--accent)] shrink-0 shadow-[0_0_0_4px_var(--accent-light)]"></div>
                              <div>
                                 <div className="text-[12px] font-medium text-[var(--text-primary)]">{act.text}</div>
                                 <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{act.time}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                     <button type="button" onClick={() => openRecordsHub('sales')} className="w-full mt-5 py-2 text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent-light)] rounded-lg transition-colors">View All Records →</button>
                  </div>
               </div>

            </div>
         </div>
         </main>

         {/* Modals */}
         <SalesModal isOpen={modals.sales} onClose={() => toggleModal('sales', false)} selectedBook={selectedBooks.sales?.name} readOnly={!permissions.canSave} />
         <PurchaseModal isOpen={modals.purchase} onClose={() => toggleModal('purchase', false)} selectedBook={selectedBooks.purchase?.name} readOnly={!permissions.canSave} />
         <AccountingModal isOpen={modals.receipt} onClose={() => toggleModal('receipt', false)} initialType="Receipt" selectedBook={selectedBooks.receipt?.name} />
         <AccountingModal isOpen={modals.payment} onClose={() => toggleModal('payment', false)} initialType="Payment" selectedBook={selectedBooks.payment?.name} />
         <IssueModal isOpen={modals.millIssue} onClose={() => toggleModal('millIssue', false)} selectedBook={selectedBooks.millIssue?.name} />
         <ReceiveModal isOpen={modals.millRec} onClose={() => toggleModal('millRec', false)} selectedBook={selectedBooks.millRec?.name} />
         <UpdateModal isOpen={modals.jobIssue} onClose={() => toggleModal('jobIssue', false)} selectedBook={selectedBooks.jobIssue?.name} />
         <JobReceiptModal isOpen={modals.jobRec} onClose={() => toggleModal('jobRec', false)} selectedBook={selectedBooks.jobRec?.name} />
         <LedgerModal isOpen={modals.ledger} onClose={() => toggleModal('ledger', false)} selectedBook={selectedBooks.ledger?.name} />
         <AccountMasterModal isOpen={modals.accountMaster} onClose={() => toggleModal('accountMaster', false)} readOnly={permissions.readOnlyMasters} />
         <ItemMasterModal isOpen={modals.itemMaster} onClose={() => toggleModal('itemMaster', false)} readOnly={permissions.readOnlyMasters} />
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
            <div className="bg-[var(--bg-card)] p-2 rounded-[2.5rem] overflow-hidden">
               <InventoryPage />
            </div>
         </Modal>

         {/* Job Worker Modal Wrap */}
         <Modal isOpen={modals.jobWorker} onClose={() => toggleModal('jobWorker', false)} title="Processing Partner Registry" className="max-w-[90vw]">
            <div className="bg-[var(--bg-card)] p-10 rounded-[2.5rem]">
               <JobWorkerMaster />
            </div>
         </Modal>

         {/* Module Placeholder Modal */}
         <Modal
            isOpen={modals.placeholder}
            onClose={() => toggleModal('placeholder', false)}
            title={placeholderName}
            className="max-w-sm"
            footer={
               <button type="button" className="erp-btn erp-btn-primary" onClick={() => toggleModal('placeholder', false)}>
                  OK
               </button>
            }
         >
            <div className="erp-modal-body text-center py-4">
               <FontAwesomeIcon icon={faTriangleExclamation} className="text-2xl text-[var(--amber)] mb-3" />
               <p className="text-body text-[var(--text-secondary)]">This module is not available yet.</p>
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
            readOnly={permissions.readOnlyMasters}
         />
         <OpeningBalanceModal
            isOpen={modals.openingBalance}
            onClose={() => setModals(prev => ({ ...prev, openingBalance: false }))}
            readOnly={permissions.readOnlyMasters}
         />
         <OpeningStockModal
            isOpen={modals.openingStock}
            onClose={() => setModals(prev => ({ ...prev, openingStock: false }))}
            readOnly={permissions.readOnlyMasters}
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

         <DataRecordsHub
            isOpen={modals.recordsHub}
            onClose={() => setModals(prev => ({ ...prev, recordsHub: false }))}
            initialTab={modals.recordsTab}
         />

      </div>
   );
};

export default Dashboard;
