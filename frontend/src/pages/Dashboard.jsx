import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
   faFileInvoiceDollar, faCartFlatbed, faMoneyCheckDollar,
   faHandHoldingDollar, faTruckArrowRight, faWarehouse,
   faScrewdriverWrench, faClipboardCheck, faChartPie,
   faChevronDown, faSync, faSearch, faBell,
   faTriangleExclamation, faHandshake, faUserTie,
   faRightFromBracket, faBook, faCircleQuestion, faGear
} from '@fortawesome/free-solid-svg-icons';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';
import PanelSwitcher from '../components/PanelSwitcher';
import OfflineIndicator from '../components/OfflineIndicator';
import FailedSyncModal from '../components/FailedSyncModal';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import Modal from '../components/ui/Modal';

// Legacy Modals
import SalesModal from './sales/SalesModal';
import PurchaseModal from './purchase/PurchaseModal';
import PurchaseEngineModal from './purchase/PurchaseEngineModal';
import InventoryEngineModal from './inventory/InventoryEngineModal';
import ProductionEngineModal from './jobwork/ProductionEngineModal';
import SalesEngineModal from './sales/SalesEngineModal';
import AutomationEngineModal from './admin/AutomationEngineModal';
import Stage2OpsModal from './admin/Stage2OpsModal';
import EnterprisePlatformModal from './enterprise/EnterprisePlatformModal';
import InfrastructureModal from './infrastructure/InfrastructureModal';
import CommercialReleaseModal from './commercial/CommercialReleaseModal';
import EnterpriseTestingDashboard from './commercial/EnterpriseTestingDashboard';
import OnboardingWizard from './commercial/OnboardingWizard';
import useUiStore from '../store/useUiStore';
import { stage8Api } from '../api/stage8.api';
import CashBankBookModal from './accounting/CashBankBookModal';
import IssueModal from './jobwork/IssueModal';
import ReceiveModal from './jobwork/ReceiveModal';
import UpdateModal from './jobwork/UpdateModal';
import JobReceiptModal from './jobwork/JobReceiptModal';
import ProcessUpdateModal from './jobwork/ProcessUpdateModal';
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
import CADashboardModal from './gst/CADashboardModal';
import VisitLogModal from './crm/VisitLogModal';
import PartyModal from './masters/PartyModal';
import JobWorkerMaster from './masters/JobWorkerMaster';
import BookSelectionModal from '../components/BookSelectionModal';

// New Database Modals
import GenericMasterModal from './masters/GenericMasterModal';
import WarehouseMasterModal from './masters/WarehouseMasterModal';
import MergeMasterModal from './masters/MergeMasterModal';
import OrderModal from './transactions/OrderModal';
import ReturnModal from './transactions/ReturnModal';
import NoteModal from './transactions/NoteModal';
import JournalEntryModal from './transactions/JournalEntryModal';
import CompanySettingsModal from './settings/CompanySettingsModal';
import OpeningBalanceModal from './masters/OpeningBalanceModal';
import OpeningStockModal from './masters/OpeningStockModal';
import DataRecordsHub from './records/DataRecordsHub';
import ReportsHub from './reports/ReportsHub';
import { getPermissions } from '../utils/permissions';
import { useConfig } from '../context/ConfigContext';
import { isFlagEnabled } from '../utils/configHelpers';
import { toast } from '../store/useToastStore';
import { CardGridLoader, InlineLoader } from '../components/ui/loaders';

const MODULE_PARENT_MAP = {
  sales: 'sales',
  purchase: 'purchase',
  receipt: 'accounting',
  payment: 'accounting',
  cashBook: 'accounting',
  bankBook: 'accounting',
  millIssue: 'jobWork',
  millRec: 'jobWork',
  jobIssue: 'jobWork',
  jobRec: 'jobWork',
  updateJob: 'jobWork',
  accountMaster: 'masters',
  itemMaster: 'masters',
  bookMaster: 'masters',
  gstr1: 'gst',
  gst2bMatching: 'gst',
  gstCompliance: 'gst',
  caDashboard: 'gst',
  visit: 'sales',
  outstanding: 'reports',
  inventoryPage: 'inventory'
};

const MODULE_SUBMENU_MAP = {
  sales: 'Sales Billing',
  purchase: 'Purchase Bill',
  receipt: 'Bank Receipt',
  payment: 'Bank Payment',
  cashBook: 'Cash Book',
  bankBook: 'Bank Book',
  millIssue: 'Mill Issue',
  millRec: 'Mill Receive',
  jobIssue: 'Job Issue',
  jobRec: 'Job Receive',
  updateJob: 'Update Job',
  gstr1: 'GSTR-1',
  gst2bMatching: 'GSTR-2B Matching',
  gstCompliance: 'GST Compliance',
  caDashboard: 'CA Desk',
  visit: 'Visit Log',
  outstanding: 'Outstanding Report',
  inventoryPage: 'Stock Ledger',
  accountMaster: 'Account Master',
  itemMaster: 'Item Master',
  bookMaster: 'Book Master'
};

const Dashboard = () => {
   const navigate = useNavigate();
   const { user, logout, bootstrapMasters, refreshAllData, sales, purchases, inventoryLots, jobWorkEntries, parties, items, plan, fetchDashboardSummary, dashboardSummary, dashboardLoading } = useStore();
   const companySettings = useConfigStore((s) => s.companySettings);
   const companyMeta = useConfigStore((s) => s.company);

   const setupGaps = useMemo(() => {
      const st = companySettings || {};
      const meta = companyMeta?.meta || {};
      const gaps = [];
      const name = st.legalName || st.shortName || companyMeta?.name || '';
      if (!name || name === 'Company' || name === 'My Company') gaps.push('Company legal name');
      if (!(st.gstin || meta.gstin)) gaps.push('GSTIN');
      if (!(st.address || meta.address)) gaps.push('Address');
      if (!(st.stateCode || meta.stateCode)) gaps.push('State code');
      if (!(st.bankName || st.accountNo)) gaps.push('Bank details');
      return gaps;
   }, [companySettings, companyMeta]);
   const { bundle, moduleConfig: liveModuleConfig, lastSynced } = useConfig();
   const openCommandPalette = useUiStore((s) => s.openCommandPalette);
   const openNotificationCenter = useUiStore((s) => s.openNotificationCenter);
   const notificationUnread = useUiStore((s) => s.notificationUnread);
   const moduleConfig = liveModuleConfig || user?.moduleConfig;
   const showRecordsHub = isFlagEnabled(bundle, 'records_hub', true);
   const showCADesk = isFlagEnabled(bundle, 'ca_desk', true);
   const permissions = useMemo(() => getPermissions(user?.companyRole, user?.role), [user?.companyRole, user?.role]);

   const handleLogout = async () => {
      await logout();
      navigate('/login');
   };

   /** Show menu unless admin explicitly disabled (opt-out). Plan does not hide menus. */
   const isParentModuleEnabled = (parentKey) => {
      if (!parentKey) return true;
      if (user?.role === 'super_admin') return true;
      if (moduleConfig?.modules?.[parentKey] === false) return false;
      if (bundle?.modules?.[parentKey] === false) return false;
      return true;
   };

   const isSubMenuItemEnabled = (parentKey, subLabel) => {
      if (!parentKey || !subLabel) return true;
      if (user?.role === 'super_admin') return true;
      const fromConfig = moduleConfig?.subMenus?.[parentKey];
      if (fromConfig && fromConfig[subLabel] === false) return false;
      const fromBundle = bundle?.subMenus?.[parentKey];
      if (fromBundle && fromBundle[subLabel] === false) return false;
      return true;
   };

   const isModuleAllowed = (moduleKey) => {
      if (user?.role === 'super_admin') return true;
      const parentModule = MODULE_PARENT_MAP[moduleKey];
      if (!parentModule) return true;
      if (!isParentModuleEnabled(parentModule)) return false;
      const subMenuLabel = MODULE_SUBMENU_MAP[moduleKey];
      return isSubMenuItemEnabled(parentModule, subMenuLabel);
   };

   const isMenuItemAllowed = (item) => {
      if (user?.role === 'super_admin') return true;

      const label = item.label;
      const key = item.key;

      if (key) return isModuleAllowed(key);

      let parentModule = null;
      let subMenuLabel = label;

      if (label.includes('Sales') || label === 'Visit Log') {
         parentModule = 'sales';
      } else if (label.includes('Purchase') || label === 'Job Purchase') {
         parentModule = 'purchase';
      } else if (label.includes('Job') || label.includes('Mill') || label.includes('Cutting') || label.includes('Beam') || label.includes('Looms') || label.includes('Production')) {
         parentModule = 'jobWork';
         if (label === 'Cutting Entry') subMenuLabel = 'Mill Issue';
         if (label === 'Beam Entry') subMenuLabel = 'Mill Receive';
      } else if (label.includes('Gst') || label.includes('GST') || label.startsWith('GSTR-') || label.startsWith('GST ')) {
         parentModule = 'gst';
      } else if (label.includes('Ledger') || label.includes('Account') || label.includes('Cash') || label.includes('Bank') || label.includes('Voucher') || label.includes('Journal') || label.includes('Debit/Credit Note') || label.includes('Tds') || label.includes('Tcs') || label.includes('Opening Balance') || label.includes('Fas Reports') || label.includes('Final Reports') || label.includes('Receipt') || label.includes('Payment') || label === 'Opening StockEntry') {
         const mastersList = ['Account', 'Account Main Group', 'Account Head', 'Book Master', 'Book Type', 'Item', 'Item Group', 'Unit', 'Item TaxSlab', 'Station', 'Transport', 'Type', 'OtherMaster', 'Lastyear BillEntry', 'Merge Event', 'Item Rate Master', 'Opening StockEntry'];
         if (mastersList.includes(label)) {
            parentModule = 'masters';
            if (label === 'Account') subMenuLabel = 'Account Master';
            if (label === 'Item') subMenuLabel = 'Item Master';
            if (label === 'Station') subMenuLabel = 'Station/City';
            if (label === 'Account Main Group') subMenuLabel = 'Account Group';
            if (label === 'Opening StockEntry') subMenuLabel = 'Opening Stock';
         } else {
            parentModule = 'accounting';
            if (label === 'Opening Balance') subMenuLabel = 'Opening Balance';
            if (label === 'Journal (GST)') subMenuLabel = 'Journal (GST)';
            if (label === 'Tds Entry') subMenuLabel = 'TDS Entry';
         }
      } else if (label.includes('Item') || label.includes('Stock') || label.includes('Unit') || label === 'Process' || label === 'Work Process') {
         parentModule = 'inventory';
         if (label === 'Inv Stock Ledger') subMenuLabel = 'Stock Ledger';
      } else if (label.includes('Outstanding') || label.includes('Report') || label.includes('Statement') || label.includes('List') || label.includes('Transaction') || label === 'Letter Pad') {
         parentModule = 'reports';
         if (label === 'Outstanding Zoom') subMenuLabel = 'Outstanding Report';
         if (label === 'Outstanding') subMenuLabel = 'Outstanding Report';
         if (label === 'Brokreg Statment') subMenuLabel = 'Broker Statement';
      } else if (label === 'Backup' || label === 'Restore' || label.includes('Year') || label.includes('Transfer') || label.includes('Voucher Relndex') || label.includes('Series') || label.includes('Expense') || label.includes('Update Main') || label.includes('Scanner') || label === 'Email Option' || label.includes('Views') || label === 'Application Sync' || label === 'Bulk Whatsapp') {
         parentModule = 'utilities';
         if (label === 'Closing / UnClosing Year') subMenuLabel = 'Year Closing';
         if (label === 'New A/c. Year ( Auto )' || label === 'New A/c. Year ( Manual )') subMenuLabel = 'New A/c Year';
         if (label === 'Bulk Whatsapp') subMenuLabel = 'Bulk WhatsApp';
      }

      if (parentModule) {
         if (!isParentModuleEnabled(parentModule)) return false;
         return isSubMenuItemEnabled(parentModule, subMenuLabel);
      }

      return true;
   };
   const [modals, setModals] = useState({
      sales: false,
      purchase: false,
      receipt: false,
      payment: false,
      cashBook: false,
      bankBook: false,
      millIssue: false,
      millRec: false,
      jobIssue: false,
      jobRec: false,
      updateJob: false,
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
      caDashboard: false,
      visit: false,
      party: false,
      jobWorker: false,
      bookMaster: false,
      inventoryPage: false,
      placeholder: false,
      // New database-connected modals
      genericMaster: false,
      genericMasterType: '',
      warehouseMaster: false,
      mergeMaster: false,
      purchaseEngine: false,
      inventoryEngine: false,
      productionEngine: false,
      salesEngine: false,
      automationEngine: false,
      stage2Ops: false,
      enterprisePlatform: false,
      infrastructure: false,
      commercialRelease: false,
      enterpriseTesting: false,
      onboardingWizard: false,
      order: false,
      orderType: 'Sales',
      returnInv: false,
      returnType: 'Sales',
      note: false,
      noteType: 'Credit',
      journal: false,
      companySettings: false,
      settingsTab: 'appearance',
      settingsBillType: 'sales',
      openingBalance: false,
      openingStock: false,
      recordsHub: false,
      recordsTab: 'accounts',
      reportsHub: false,
      reportsTab: 'summary'
   });

   const [placeholderName, setPlaceholderName] = useState('');
   const [syncModalOpen, setSyncModalOpen] = useState(false);
   const [bookSelection, setBookSelection] = useState({
      isOpen: false,
      module: null,
      bookModule: null,
   });
   const [selectedBooks, setSelectedBooks] = useState({});
   const [activeMenuKey, setActiveMenuKey] = useState(null);
   const [openMenuSection, setOpenMenuSection] = useState(null);
   const [isRefreshing, setIsRefreshing] = useState(false);
   const menuBarRef = useRef(null);

   const showDashboardSkeleton = dashboardLoading || isRefreshing;

   const openSettings = (tab = 'appearance', billType = 'sales') => {
      const resolved = tab === 'fields' ? (billType || 'sales') : tab;
      setModals((prev) => ({
         ...prev,
         companySettings: true,
         settingsTab: resolved,
         settingsBillType: billType,
      }));
   };

   const handleSync = async () => {
      setIsRefreshing(true);
      try {
         await Promise.all([refreshAllData(), fetchDashboardSummary()]);
      } finally {
         setIsRefreshing(false);
      }
   };

   useEffect(() => {
      const onDocMouseDown = (e) => {
         if (menuBarRef.current && !menuBarRef.current.contains(e.target)) {
            setOpenMenuSection(null);
         }
      };
      document.addEventListener('mousedown', onDocMouseDown);
      return () => document.removeEventListener('mousedown', onDocMouseDown);
   }, []);

   useEffect(() => {
      const onOpen = (e) => {
         const modal = e.detail?.modal;
         if (!modal) return;
         if (modal === 'reportsHub') {
            openReportsHub('summary');
            return;
         }
         if (modal === 'companySettings') {
            openSettings(e.detail?.tab || 'appearance', e.detail?.billType || 'sales');
            return;
         }
         toggleModal(modal, true);
      };
      window.addEventListener('erp:open-modal', onOpen);
      return () => window.removeEventListener('erp:open-modal', onOpen);
   }, []);

   useEffect(() => {
      if (user?.companyId || user?.role === 'super_admin') {
         fetchDashboardSummary();
      }
   }, [user?.companyId, user?.role, fetchDashboardSummary]);

   useEffect(() => {
      if (!user?.companyId || user?.role === 'super_admin') return;
      const dismissed = sessionStorage.getItem('erp_onboarding_dismissed');
      if (dismissed) return;
      stage8Api
         .onboarding()
         .then((s) => {
            if (s?.status === 'pending' || ((s?.progressPct || 0) < 100 && s?.status !== 'skipped' && s?.status !== 'completed')) {
               setModals((prev) => ({ ...prev, onboardingWizard: true }));
            }
         })
         .catch(() => {});
   }, [user?.companyId, user?.role]);

   const parseMenuLabel = (label) => {
      const match = label.match(/^(\d+)\s+(.+)$/);
      if (match) return { badge: match[1], text: match[2] };
      return { badge: null, text: label };
   };
   const CORE_MODULES_WITH_BOOKS = ['sales', 'purchase', 'receipt', 'payment', 'cashBook', 'bankBook', 'millIssue', 'millRec', 'jobIssue', 'jobRec', 'ledger'];

   const BOOK_MODULE_ALIAS = {
      cashBook: 'receipt',
      bankBook: 'receipt',
   };

   const toggleModal = (key, val) => {
      if (val === true && CORE_MODULES_WITH_BOOKS.includes(key)) {
         setBookSelection({
            isOpen: true,
            module: key,
            bookModule: BOOK_MODULE_ALIAS[key] || key,
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
      setBookSelection({ isOpen: false, module: null, bookModule: null });
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

   const openReportsHub = (tab = 'summary') => {
      setModals(prev => ({
         ...prev,
         reportsHub: true,
         reportsTab: tab
      }));
   };

   const recentActivity = useMemo(() => {
      const fmtRel = (d) => {
         if (!d) return '';
         const diff = Date.now() - new Date(d).getTime();
         const mins = Math.floor(diff / 60000);
         if (mins < 60) return `${mins || 1} mins ago`;
         const hrs = Math.floor(mins / 60);
         if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
         return new Date(d).toLocaleDateString('en-IN');
      };
      const acts = [];
      sales.slice(0, 3).forEach((s) => acts.push({
        text: `Sales Invoice ${s.invoiceNo} — ₹${(s.netAmount || 0).toLocaleString('en-IN')}`,
        time: fmtRel(s.date || s.createdAt),
        type: 'sales'
      }));
      purchases.slice(0, 2).forEach((p) => acts.push({
        text: `Purchase Bill ${p.billNo || p.invoiceNo}`,
        time: fmtRel(p.date || p.createdAt),
        type: 'purchase'
      }));
      jobWorkEntries.slice(0, 2).forEach((j) => acts.push({
        text: `Job ${j.jobCardNo} — ${j.status}`,
        time: fmtRel(j.issueDate || j.createdAt),
        type: 'job'
      }));
      return acts.slice(0, 6);
   }, [sales, purchases, jobWorkEntries]);

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
         { label: 'Account Main Group', action: () => openGenericMaster('AccountGroup') },
         { label: 'Account Head', action: () => openGenericMaster('AccountHead') },
         { label: 'Book Master', key: 'bookMaster' },
         { label: 'Book Type', action: () => openGenericMaster('BookType') },
         { label: 'Item', key: 'itemMaster' },
         { label: 'Item Group', action: () => openGenericMaster('ItemGroup') },
         { label: 'Unit', action: () => openGenericMaster('Unit') },
         { label: 'Item TaxSlab', action: () => openGenericMaster('ItemTaxSlab') },
         { label: 'Station', action: () => openGenericMaster('City') },
         { label: 'Transport', action: () => openGenericMaster('Transport') },
         { label: 'Color', action: () => openGenericMaster('Color') },
         { label: 'Design', action: () => openGenericMaster('Design') },
         { label: 'Quality', action: () => openGenericMaster('Quality') },
         { label: 'Pattern', action: () => openGenericMaster('Pattern') },
         { label: 'Brand', action: () => openGenericMaster('Brand') },
         { label: 'Shade', action: () => openGenericMaster('Shade') },
         { label: 'Process', action: () => openGenericMaster('Process') },
         { label: 'Machine', action: () => openGenericMaster('Machine') },
         { label: 'Department', action: () => openGenericMaster('Department') },
         { label: 'Payment Terms', action: () => openGenericMaster('PaymentTerms') },
         { label: 'Currency', action: () => openGenericMaster('Currency') },
         { label: 'Warehouse', action: () => setModals(prev => ({ ...prev, warehouseMaster: true })) },
         { label: 'Type', action: () => openGenericMaster('Type') },
         { label: 'OtherMaster', action: () => openGenericMaster('OtherMaster') },
         { label: 'Job Worker', action: () => setModals(prev => ({ ...prev, jobWorker: true })) },
         { label: 'Lastyear BillEntry', action: () => openRecordsHub('sales') },
         { label: 'Opening Balance', action: () => setModals(prev => ({ ...prev, openingBalance: true })) },
         { label: 'Opening StockEntry', action: () => setModals(prev => ({ ...prev, openingStock: true })) },
         { label: 'Merge Event', action: () => setModals(prev => ({ ...prev, mergeMaster: true })) },
         { label: 'Item Rate Master', action: () => toggleModal('itemMaster', true) }
      ],
      Transaction: [
         { label: 'Sales', key: 'sales' },
         { label: 'Purchase', key: 'purchase' },
         { label: 'Cash Book', action: () => toggleModal('cashBook', true) },
         { label: 'Bank Book', action: () => toggleModal('bankBook', true) },
         { label: 'Bank Receipt', action: () => toggleModal('receipt', true) },
         { label: 'Bank Payment', action: () => toggleModal('payment', true) },
         { label: 'Journal (GST)', action: () => openJournal() },
         { label: 'Debit/Credit Note', action: () => openNote('Credit') },
         { label: 'Sales Return', action: () => openReturn('Sales') },
         { label: 'Purchase Return', action: () => openReturn('Purchase') },
      ],
      Inventory: [
         { label: 'Mill Issue', key: 'millIssue' },
         { label: 'Mill Receive', key: 'millRec' },
         { label: 'Job Issue', key: 'jobIssue' },
         { label: 'Job Receive', key: 'jobRec' },
         { label: 'Update Job', key: 'updateJob' },
         { label: 'Stock Ledger', key: 'inventoryPage' },
      ],
      Reports: [
         { label: 'All Reports Hub', action: () => openReportsHub('summary') },
         { label: 'Sales Reports', action: () => openReportsHub('sales') },
         { label: 'Purchase Reports', action: () => openReportsHub('purchase') },
         { label: 'Job Work Reports', action: () => openReportsHub('jobwork') },
         { label: 'Stock Reports', action: () => openReportsHub('stock') },
         { label: 'Outstanding', key: 'outstanding' },
         { label: 'GSTR-1', key: 'gstr1' },
         { label: 'CA Desk', key: 'caDashboard' },
      ],
      'Others Reports': [
         { label: 'Outstanding Zoom', key: 'outstanding' },
         { label: 'Daily Transaction', action: () => openReportsHub('daily') },
         { label: 'Master List', action: () => openReportsHub('masters') },
         { label: 'Item Ledger', action: () => openReportsHub('stockItem') },
      ],
      Advanced: [
         { label: 'Purchase Order / GRN', action: () => setModals(prev => ({ ...prev, purchaseEngine: true })) },
         { label: 'Sales Order / Challan', action: () => setModals(prev => ({ ...prev, salesEngine: true })) },
         { label: 'Inventory Engine', action: () => setModals(prev => ({ ...prev, inventoryEngine: true })) },
         { label: 'Production Engine', action: () => setModals(prev => ({ ...prev, productionEngine: true })) },
         { label: 'Business Automation', action: () => setModals(prev => ({ ...prev, automationEngine: true })) },
         { label: 'Enterprise Platform', action: () => setModals(prev => ({ ...prev, enterprisePlatform: true })) },
         { label: 'Infrastructure & Security', action: () => setModals(prev => ({ ...prev, infrastructure: true })) },
         { label: 'Welcome Wizard', action: () => setModals(prev => ({ ...prev, onboardingWizard: true })) },
         { label: 'Stage 2 Ops', action: () => setModals(prev => ({ ...prev, stage2Ops: true })) },
         { label: 'Refresh All Data', action: () => refreshAllData().then(() => toast.success('All data refreshed.')) },
      ],
      Utilities: [
         { label: 'Update Main Account Master', action: () => toggleModal('accountMaster', true) },
         { label: 'Gst Updation', action: () => toggleModal('caDashboard', true) },
         { label: 'Application Sync', action: () => refreshAllData().then(() => toast.success('All data refreshed.')) },
      ],
      'Setup System': [
         { label: 'Setting', action: () => openSettings('appearance') },
         { label: 'Company Info', action: () => openSettings('company') },
         { label: 'User Setup', action: () => openSettings('users') },
      ],
      Records: showRecordsHub ? [
         { label: 'All Records Hub', action: () => openRecordsHub('accounts') },
         { label: 'Sales Records', action: () => openRecordsHub('sales') },
         { label: 'Purchase Records', action: () => openRecordsHub('purchases') },
         { label: 'Job Work Records', action: () => openRecordsHub('jobs') },
         { label: 'Party Records', action: () => openRecordsHub('parties') },
         { label: 'Item Records', action: () => openRecordsHub('items') }
      ] : [],
      Company: [
         { label: 'Company Master', action: () => openSettings('company') },
         { label: 'Information', action: () => toast.info('Textile ERP — use Setup → Setting for company GSTIN, bank & print.') },
      ]
   };

   const visibleMenuData = useMemo(() => {
      const filtered = {};
      Object.entries(menuData).forEach(([section, items]) => {
         if (permissions.canAccessSection(section)) {
            let allowedItems = items.filter(isMenuItemAllowed);
            if (section === 'Admin') {
               allowedItems = allowedItems.filter(i => i.label !== 'User Rights' || permissions.canManageUsers);
            }
            if (allowedItems.length > 0) {
               filtered[section] = allowedItems;
            }
         }
      });
      return filtered;
   }, [permissions, moduleConfig, bundle, user?.role, showRecordsHub]);

   const ALL_CORE_MODULES = [
      { id: 1, label: 'Sales Billing', icon: faFileInvoiceDollar, key: 'sales' },
      { id: 2, label: 'Purchase', icon: faCartFlatbed, key: 'purchase' },
      { id: 3, label: 'Bank Receipt', icon: faMoneyCheckDollar, key: 'receipt' },
      { id: 4, label: 'Bank Payment', icon: faHandHoldingDollar, key: 'payment' },
      { id: 5, label: 'Mill Issue', icon: faTruckArrowRight, key: 'millIssue' },
      { id: 6, label: 'Mill Receive', icon: faWarehouse, key: 'millRec' },
      { id: 7, label: 'Job Issue', icon: faScrewdriverWrench, key: 'jobIssue' },
      { id: 8, label: 'Job Receive', icon: faClipboardCheck, key: 'jobRec' },
      { id: 15, label: 'Update Job', icon: faScrewdriverWrench, key: 'updateJob' },
      { id: 9, label: 'CA Desk', icon: faUserTie, key: 'caDashboard', flag: 'ca_desk' },
      { id: 10, label: 'GSTR-1', icon: faChartPie, key: 'gstr1' },
      { id: 11, label: 'GSTR-2', icon: faChartPie, key: 'gst2bMatching' },
      { id: 12, label: 'ETB', icon: faFileInvoiceDollar, key: 'gstCompliance' },
      { id: 13, label: 'Visit Log', icon: faHandshake, key: 'visit' },
      { id: 14, label: 'Outstanding', icon: faChartPie, key: 'outstanding' },
   ];

   const coreModules = useMemo(() => {
      const filtered = ALL_CORE_MODULES.filter(
         mod => isModuleAllowed(mod.key) && (!mod.flag || isFlagEnabled(bundle, mod.flag, true))
      );
      return filtered.length > 0 ? filtered : ALL_CORE_MODULES;
   }, [moduleConfig, bundle, user?.role]);

   return (
      <div className="erp-shell fixed inset-0 flex overflow-hidden">

         {/* Core modules — compact rail */}
         <aside className="erp-rail flex flex-col py-2 gap-0.5 shrink-0 overflow-y-auto no-scrollbar">
            <p className="px-3 py-1.5 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0">Quick</p>
            {coreModules.map((mod) => (
               <button
                  key={mod.id}
                  type="button"
                  onClick={() => { setActiveMenuKey(mod.key); toggleModal(mod.key, true); }}
                  className={`mx-1.5 flex items-center gap-2 h-8 px-2 rounded-lg text-left transition-colors cursor-pointer ${
                     activeMenuKey === mod.key
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]'
                  }`}
               >
                  <FontAwesomeIcon icon={mod.icon} className="text-[11px] w-3.5 shrink-0" />
                  <span className="text-[11px] font-medium truncate leading-tight">{mod.label}</span>
               </button>
            ))}
            <div className="mt-auto pt-2 border-t border-[var(--border)] mx-1.5">
               <button
                  type="button"
                  onClick={() => { setActiveMenuKey('ledger'); toggleModal('ledger', true); }}
                  className={`w-full flex items-center gap-2 h-8 px-2 rounded-lg text-left transition-colors cursor-pointer ${
                     activeMenuKey === 'ledger'
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]'
                  }`}
               >
                  <FontAwesomeIcon icon={faBook} className="text-[11px] w-3.5 shrink-0" />
                  <span className="text-[11px] font-medium truncate leading-tight">Ledger</span>
               </button>
               <button
                  type="button"
                  onClick={() => openSettings('appearance')}
                  className="w-full flex items-center gap-2 h-8 px-2 rounded-lg text-left transition-colors cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
               >
                  <FontAwesomeIcon icon={faGear} className="text-[11px] w-3.5 shrink-0" />
                  <span className="text-[11px] font-medium truncate leading-tight">Settings</span>
               </button>
               <button
                  type="button"
                  onClick={() => toast.info('Ctrl+K or Ctrl+Space opens Command Center. Bell opens Notifications. Enterprise button opens Stage 6 platform.')}
                  className="w-full flex items-center gap-2 h-8 px-2 rounded-lg text-left transition-colors cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
               >
                  <FontAwesomeIcon icon={faCircleQuestion} className="text-[11px] w-3.5 shrink-0" />
                  <span className="text-[11px] font-medium truncate leading-tight">Help</span>
               </button>
            </div>
         </aside>

         {/* Main area */}
         <main className="flex-1 min-w-0 flex flex-col bg-[var(--bg-base)] relative min-h-0">
            <header className="shrink-0 relative z-50 bg-[var(--bg-card)] border-b border-[var(--border)]">
               <div className="flex items-center justify-between gap-3 px-4 h-11">
                  <div className="flex items-center gap-3 min-w-0">
                     <div className="w-7 h-7 rounded-md bg-[var(--accent)] text-white flex items-center justify-center font-semibold text-[11px] shrink-0">
                        {(user?.companyName || user?.company?.name || 'E').charAt(0)}
                     </div>
                     <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                           {user?.companyName || user?.company?.name || 'Company'}
                        </p>
                        <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide">Enterprise</p>
                     </div>
                  </div>

                  <div className="hidden md:flex flex-1 max-w-xs mx-2">
                     <div className="relative w-full">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px]" />
                        <button
                           type="button"
                           onClick={() => openCommandPalette()}
                           className="w-full h-7 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-md py-0 pl-7 pr-2 text-[11px] text-left text-[var(--text-muted)] hover:border-[var(--accent)]"
                        >
                           Search… <span className="text-[9px] opacity-70">Ctrl+K</span>
                        </button>
                     </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                     <OfflineIndicator onOpenSync={() => setSyncModalOpen(true)} />
                     <PanelSwitcher variant="light" />
                     <button type="button" onClick={() => refreshAllData()} className="h-7 px-2 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] rounded-md bg-white hover:bg-[var(--bg-subtle)]">
                        <FontAwesomeIcon icon={faSync} className={`text-[9px] mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />Sync
                     </button>
                     <button
                        type="button"
                        onClick={() => openNotificationCenter()}
                        className="relative w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Notifications"
                     >
                        <FontAwesomeIcon icon={faBell} className="text-[12px]" />
                        {notificationUnread > 0 && (
                           <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-600 text-white text-[8px] font-bold flex items-center justify-center">
                              {notificationUnread > 99 ? '99+' : notificationUnread}
                           </span>
                        )}
                     </button>
                     <div className="flex items-center gap-2 pl-2 border-l border-[var(--border)]">
                        <div className="text-right hidden sm:block">
                           <p className="text-[11px] font-medium text-[var(--text-primary)] leading-none">{user?.name || 'User'}</p>
                           <p className="text-[9px] text-[var(--text-muted)] capitalize">{user?.role?.replace('_', ' ') || 'access'}</p>
                        </div>
                        <div className="w-7 h-7 rounded-md bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-semibold text-[10px]">
                           {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <button
                           type="button"
                           onClick={handleLogout}
                           title="Sign out"
                           className="h-7 px-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-md transition-colors"
                        >
                           <FontAwesomeIcon icon={faRightFromBracket} className="text-[9px]" />
                           <span className="hidden sm:inline">Logout</span>
                        </button>
                     </div>
                  </div>
               </div>

               {/* Menu Bar */}
               <div ref={menuBarRef} className="erp-menu-bar select-none">
                  {Object.keys(visibleMenuData).map((section) => {
                     const isOpen = openMenuSection === section;
                     return (
                     <div key={section} className="relative shrink-0">
                        <button
                           type="button"
                           onClick={() => setOpenMenuSection(isOpen ? null : section)}
                           className={`erp-menu-trigger ${isOpen ? 'erp-menu-trigger--open' : ''}`}
                        >
                           {section}
                        </button>
                        {isOpen && (
                           <div className="erp-menu-dropdown">
                                 {visibleMenuData[section].map((item, idx) => {
                                    const label = typeof item === 'object' ? item.label : item;
                                    const { badge, text } = parseMenuLabel(label);
                                    const needsSeparator = text === 'Closing / UnClosing Year' || text === 'Voucher Relndex';
                                    return (
                                       <React.Fragment key={idx}>
                                          {needsSeparator && <div className="erp-menu-separator" />}
                                          <button
                                             type="button"
                                             onClick={() => {
                                                setOpenMenuSection(null);
                                                handleMenuItemClick(item);
                                             }}
                                             className="erp-menu-item"
                                          >
                                             {badge && (
                                                <span className="text-[9px] text-white bg-[var(--accent)] px-1 rounded font-mono shrink-0">
                                                   {badge}
                                                </span>
                                             )}
                                             <span className="truncate">{text}</span>
                                          </button>
                                       </React.Fragment>
                                    );
                                 })}
                           </div>
                        )}
                     </div>
                  );})}
                  <button
                     type="button"
                     className="erp-menu-trigger ml-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                     onClick={handleLogout}
                  >
                     Exit
                  </button>
               </div>

            </header>

            <div className="flex-1 overflow-y-auto p-4">
               <div className="max-w-6xl mx-auto flex flex-col gap-4">
               {setupGaps.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-950">
                     <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-600 text-[12px] shrink-0" />
                     <div className="flex-1 min-w-[200px]">
                        <p className="text-[12px] font-semibold">Complete Company Setup before live billing</p>
                        <p className="text-[11px] text-amber-800/90 mt-0.5">
                           Missing: {setupGaps.join(' · ')}. Fill these so invoices & ledger look correct.
                        </p>
                     </div>
                     <button
                        type="button"
                        className="erp-btn erp-btn-primary h-7 px-3 text-[11px] shrink-0"
                        onClick={() => openSettings('company')}
                     >
                        Open Settings
                     </button>
                  </div>
               )}
               <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                     <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Dashboard</h2>
                     <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Daily flow: Purchase → Mill → Sales → Cash/Bank → Ledger
                     </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                     {lastSynced && (
                        <span className="text-[9px] font-medium text-emerald-600 self-center">Live</span>
                     )}
                     <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={handleSync} disabled={showDashboardSkeleton}>
                        <FontAwesomeIcon icon={faSync} className={`text-[9px] mr-1 ${showDashboardSkeleton ? 'animate-spin' : ''}`} />
                        {showDashboardSkeleton ? 'Syncing…' : 'Sync'}
                     </button>
                     {showRecordsHub && (
                        <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => openRecordsHub('accounts')}>Records</button>
                     )}
                     <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => openReportsHub('summary')}>Reports</button>
                     {showCADesk && isModuleAllowed('caDashboard') && (
                        <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => toggleModal('caDashboard', true)}>CA Desk</button>
                     )}
                     <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => toggleModal('ledger', true)}>Ledger</button>
                     <button type="button" className="erp-btn erp-btn-primary h-7 px-3 text-[11px]" onClick={() => toggleModal('sales', true)}>+ Invoice</button>
                  </div>
               </div>

               {showDashboardSkeleton ? (
                  <CardGridLoader count={6} />
               ) : (
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {[
                     { label: 'Sales Today', value: dashboardSummary?.salesToday?.amount, sub: dashboardSummary?.salesToday?.count != null ? `${dashboardSummary.salesToday.count} bills` : null },
                     { label: 'Purchase Today', value: dashboardSummary?.purchaseToday?.amount, sub: dashboardSummary?.purchaseToday?.count != null ? `${dashboardSummary.purchaseToday.count} bills` : null },
                     { label: 'Cash / Receipts', value: dashboardSummary?.cashToday },
                     { label: 'Receivable', value: dashboardSummary?.receivable },
                     { label: 'Payable', value: dashboardSummary?.payable },
                     { label: 'Low Stock Lots', value: dashboardSummary?.lowStockLots, raw: true },
                  ].map((card) => (
                     <div key={card.label} className="erp-card p-3">
                        <p className="text-[9px] uppercase tracking-wide text-[var(--text-muted)] font-semibold">{card.label}</p>
                        <p className="text-[14px] font-bold text-[var(--text-primary)] mt-1 tabular-nums">
                          {card.raw
                              ? (card.value ?? '—')
                              : `₹ ${Number(card.value || 0).toLocaleString('en-IN')}`}
                        </p>
                        {card.sub && <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{card.sub}</p>}
                     </div>
                  ))}
               </div>
               )}

               <div className="erp-card p-4 relative">
                  {showDashboardSkeleton && (
                     <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-card)]/80 rounded-[inherit]">
                        <InlineLoader message="Loading activity…" />
                     </div>
                  )}
                  <h3 className="text-[12px] font-semibold mb-3 text-[var(--text-primary)]">Recent Activity</h3>
                  <div className="flex flex-col gap-2">
                     {(recentActivity.length ? recentActivity : [{ text: 'No recent transactions', time: '—', type: 'empty' }]).map((act, i) => (
                        <div key={i} className="flex gap-2 items-start">
                           <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                           <div>
                              <div className="text-[11px] text-[var(--text-primary)]">{act.text}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">{act.time}</div>
                           </div>
                        </div>
                     ))}
                  </div>
                  {showRecordsHub && (
                     <button type="button" onClick={() => openRecordsHub('sales')} className="mt-3 text-[11px] font-medium text-[var(--accent)] hover:underline">View all records →</button>
                  )}
               </div>
            </div>
            </div>
         </main>

         {/* Modals */}
         <SalesModal isOpen={modals.sales} onClose={() => toggleModal('sales', false)} selectedBook={selectedBooks.sales?.name} readOnly={!permissions.canSave} />
         <PurchaseModal 
            isOpen={modals.purchase} 
            onClose={() => toggleModal('purchase', false)} 
            selectedBook={selectedBooks.purchase?.name} 
            readOnly={!permissions.canSave} 
            onOpenSales={() => { toggleModal('purchase', false); toggleModal('sales', true); }}
            onOpenJobIssue={() => { toggleModal('purchase', false); toggleModal('jobIssue', true); }}
            onOpenMillIssue={() => { toggleModal('purchase', false); toggleModal('millIssue', true); }}
         />

         <CashBankBookModal
            isOpen={modals.cashBook}
            onClose={() => toggleModal('cashBook', false)}
            bookKind="cash"
            initialType="Receipt"
            selectedBook={selectedBooks.cashBook}
            readOnly={!permissions.canSave}
         />
         <CashBankBookModal
            isOpen={modals.bankBook}
            onClose={() => toggleModal('bankBook', false)}
            bookKind="bank"
            initialType="Receipt"
            selectedBook={selectedBooks.bankBook}
            readOnly={!permissions.canSave}
         />
         <CashBankBookModal
            isOpen={modals.receipt}
            onClose={() => toggleModal('receipt', false)}
            bookKind="bank"
            initialType="Receipt"
            selectedBook={selectedBooks.receipt}
            readOnly={!permissions.canSave}
         />
         <CashBankBookModal
            isOpen={modals.payment}
            onClose={() => toggleModal('payment', false)}
            bookKind="bank"
            initialType="Payment"
            selectedBook={selectedBooks.payment}
            readOnly={!permissions.canSave}
         />
         <IssueModal isOpen={modals.millIssue} onClose={() => toggleModal('millIssue', false)} selectedBook={selectedBooks.millIssue?.name} />
         <ReceiveModal isOpen={modals.millRec} onClose={() => toggleModal('millRec', false)} selectedBook={selectedBooks.millRec?.name} />
         <UpdateModal isOpen={modals.jobIssue} onClose={() => toggleModal('jobIssue', false)} selectedBook={selectedBooks.jobIssue?.name} />
         <JobReceiptModal isOpen={modals.jobRec} onClose={() => toggleModal('jobRec', false)} selectedBook={selectedBooks.jobRec?.name} />
         <ProcessUpdateModal isOpen={modals.updateJob} onClose={() => toggleModal('updateJob', false)} />
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
         <CADashboardModal
            isOpen={modals.caDashboard}
            onClose={() => toggleModal('caDashboard', false)}
            onOpenGstr1={() => { toggleModal('caDashboard', false); toggleModal('gstr1', true); }}
            onOpenGstr2={() => { toggleModal('caDashboard', false); toggleModal('gst2bMatching', true); }}
            onOpenGstr3b={() => { toggleModal('caDashboard', false); toggleModal('gst3bMonthly', true); }}
         />
         <VisitLogModal isOpen={modals.visit} onClose={() => toggleModal('visit', false)} />
         <PartyModal isOpen={modals.party} onClose={() => toggleModal('party', false)} />
         <BookMasterModal isOpen={modals.bookMaster} onClose={() => toggleModal('bookMaster', false)} readOnly={permissions.readOnlyMasters} />
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
            onClose={() => setBookSelection({ isOpen: false, module: null, bookModule: null })}
            moduleName={bookSelection.bookModule || bookSelection.module}
            onSelectBook={handleSelectBook}
            bookFilter={
              bookSelection.module === 'cashBook'
                ? (b) => /cash/i.test(b.name || '')
                : bookSelection.module === 'bankBook'
                  ? (b) => /bank/i.test(b.name || '') && !/cash/i.test(b.name || '')
                  : null
            }
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
         <WarehouseMasterModal
            isOpen={modals.warehouseMaster}
            onClose={() => setModals(prev => ({ ...prev, warehouseMaster: false }))}
            readOnly={permissions.readOnlyMasters}
         />
         <MergeMasterModal
            isOpen={modals.mergeMaster}
            onClose={() => setModals(prev => ({ ...prev, mergeMaster: false }))}
         />
         <PurchaseEngineModal
            isOpen={modals.purchaseEngine}
            onClose={() => setModals(prev => ({ ...prev, purchaseEngine: false }))}
         />
         <InventoryEngineModal
            isOpen={modals.inventoryEngine}
            onClose={() => setModals(prev => ({ ...prev, inventoryEngine: false }))}
         />
         <ProductionEngineModal
            isOpen={modals.productionEngine}
            onClose={() => setModals(prev => ({ ...prev, productionEngine: false }))}
         />
         <SalesEngineModal
            isOpen={modals.salesEngine}
            onClose={() => setModals(prev => ({ ...prev, salesEngine: false }))}
         />
         <AutomationEngineModal
            isOpen={modals.automationEngine}
            onClose={() => setModals(prev => ({ ...prev, automationEngine: false }))}
         />
         <Stage2OpsModal
            isOpen={modals.stage2Ops}
            onClose={() => setModals(prev => ({ ...prev, stage2Ops: false }))}
         />
         <EnterprisePlatformModal
            isOpen={modals.enterprisePlatform}
            onClose={() => setModals(prev => ({ ...prev, enterprisePlatform: false }))}
         />
         <InfrastructureModal
            isOpen={modals.infrastructure}
            onClose={() => setModals(prev => ({ ...prev, infrastructure: false }))}
         />
         <CommercialReleaseModal
            isOpen={modals.commercialRelease}
            onClose={() => setModals(prev => ({ ...prev, commercialRelease: false }))}
         />
         <EnterpriseTestingDashboard
            isOpen={modals.enterpriseTesting}
            onClose={() => setModals(prev => ({ ...prev, enterpriseTesting: false }))}
         />
         <OnboardingWizard
            isOpen={modals.onboardingWizard}
            onClose={() => setModals(prev => ({ ...prev, onboardingWizard: false }))}
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
         <CompanySettingsModal
            isOpen={modals.companySettings}
            onClose={() => setModals(prev => ({ ...prev, companySettings: false }))}
            initialTab={modals.settingsTab}
            initialBillType={modals.settingsBillType}
            onAction={(action) => {
               if (action === 'books') toggleModal('bookMaster', true);
               else if (action === 'automation') setModals(prev => ({ ...prev, automationEngine: true }));
               else if (action === 'openingBalance') setModals(prev => ({ ...prev, openingBalance: true }));
               else if (action === 'openingStock') setModals(prev => ({ ...prev, openingStock: true }));
            }}
         />

         <DataRecordsHub
            isOpen={modals.recordsHub}
            onClose={() => setModals(prev => ({ ...prev, recordsHub: false }))}
            initialTab={modals.recordsTab}
         />
         <ReportsHub
            isOpen={modals.reportsHub}
            onClose={() => setModals(prev => ({ ...prev, reportsHub: false }))}
            initialTab={modals.reportsTab}
         />

         <FailedSyncModal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
         <PwaInstallPrompt />

      </div>
   );
};

export default Dashboard;
