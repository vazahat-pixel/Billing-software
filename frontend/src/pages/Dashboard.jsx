import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
   faFileInvoiceDollar, faCartFlatbed, faMoneyCheckDollar,
   faHandHoldingDollar, faTruckArrowRight, faWarehouse,
   faScrewdriverWrench, faClipboardCheck, faChartPie,
   faChevronDown, faSync, faSearch, faBell,
   faTriangleExclamation, faUserTie,
   faRightFromBracket, faBook, faCircleQuestion, faGear,
   faRightLeft
} from '@fortawesome/free-solid-svg-icons';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';
import useEntitlements from '../hooks/useEntitlements';
import PanelSwitcher from '../components/PanelSwitcher';
import OfflineIndicator from '../components/OfflineIndicator';
import FailedSyncModal from '../components/FailedSyncModal';
import ErpWindowDockTray from '../components/erp/ErpWindowDockTray';
import { yieldOtherWindows } from '../store/useWindowDockStore';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import Modal from '../components/ui/Modal';
import useUiStore from '../store/useUiStore';
import { stage8Api } from '../api/stage8.api';
import { authApi } from '../api/auth.api';
import { salesApi } from '../api/sales.api';
import { purchasesApi } from '../api/purchase.api';
import { notesApi } from '../api/masters.api';
import { focusErpWindow, minimizeErpWindow } from '../hooks/useErpWindow';
import { showDevTools, DEV_ONLY_MENU_LABELS } from '../utils/showDevTools';
import BookSelectionModal from '../components/BookSelectionModal';
import ErpKeyboardHintBar, { APP_KEYBOARD_HINTS } from '../components/erp/ErpKeyboardHintBar';
import { getDefaultBooksForModule } from '../utils/defaultBooks';
import CompanySettingsModal from './settings/CompanySettingsModal';
import ReportsHub from './reports/ReportsHub';
import DataRecordsHub from './records/DataRecordsHub';
import GenericMasterModal from './masters/GenericMasterModal';
import WarehouseMasterModal from './masters/WarehouseMasterModal';
import MergeMasterModal from './masters/MergeMasterModal';
import OrderModal from './transactions/OrderModal';
import ReturnModal from './transactions/ReturnModal';
import NoteModal from './transactions/NoteModal';
import ContraVoucherModal from './transactions/ContraVoucherModal';
import TdsEntryModal from './transactions/TdsEntryModal';
import JournalEntryModal from './transactions/JournalEntryModal';
import OpeningBalanceModal from './masters/OpeningBalanceModal';
import OpeningStockModal from './masters/OpeningStockModal';
import { getPermissions } from '../utils/permissions';
import { useConfig } from '../context/ConfigContext';
import { isFlagEnabled } from '../utils/configHelpers';
import { toast } from '../store/useToastStore';
import { CardGridLoader, InlineLoader, TopProgressBar } from '../components/ui/loaders';
import { buildReportsMenuItems } from '../utils/reportTree';

// Daily-path modals — eager so click → form is instant (no blank Suspense wait)
import SalesModal from './sales/SalesModal';
import PurchaseModal from './purchase/PurchaseModal';
import CashBankBookModal from './accounting/CashBankBookModal';
import LedgerModal from './LedgerModal';
import IssueModal from './jobwork/IssueModal';
import ReceiveModal from './jobwork/ReceiveModal';
import UpdateModal from './jobwork/UpdateModal';
import JobReceiptModal from './jobwork/JobReceiptModal';
import ProcessUpdateModal from './jobwork/ProcessUpdateModal';
import AccountMasterModal from './masters/AccountMasterModal';
import ItemMasterModal from './masters/ItemMasterModal';
import BookMasterModal from './masters/BookMasterModal';
import PartyModal from './masters/PartyModal';
import OutstandingReportModal from './reports/OutstandingReportModal';
import SystemUtilitiesModal from './utilities/SystemUtilitiesModal';
import TrialBalanceModal from './accounting/TrialBalanceModal';

// Rare / heavy screens — lazy OK
const PurchaseEngineModal = lazy(() => import('./purchase/PurchaseEngineModal'));
const InventoryEngineModal = lazy(() => import('./inventory/InventoryEngineModal'));
const ProductionEngineModal = lazy(() => import('./jobwork/ProductionEngineModal'));
const SalesEngineModal = lazy(() => import('./sales/SalesEngineModal'));
const AutomationEngineModal = lazy(() => import('./admin/AutomationEngineModal'));
const Stage2OpsModal = lazy(() => import('./admin/Stage2OpsModal'));
const EnterprisePlatformModal = lazy(() => import('./enterprise/EnterprisePlatformModal'));
const InfrastructureModal = lazy(() => import('./infrastructure/InfrastructureModal'));
const CommercialReleaseModal = lazy(() => import('./commercial/CommercialReleaseModal'));
const EnterpriseTestingDashboard = lazy(() => import('./commercial/EnterpriseTestingDashboard'));
const OnboardingWizard = lazy(() => import('./commercial/OnboardingWizard'));
const SalesOutstanding = lazy(() => import('./reports/SalesOutstanding'));
const GstComplianceReportsModal = lazy(() => import('./reports/GstComplianceReportsModal'));
const LotNoEntryModal = lazy(() => import('./inventory/LotNoEntryModal'));
const IssueMultipleModal = lazy(() => import('./jobwork/IssueMultipleModal'));
const CuttingBeamEntryModal = lazy(() => import('./inventory/CuttingBeamEntryModal'));
const JobWorkerMaster = lazy(() => import('./masters/JobWorkerMaster'));
const InventoryPage = lazy(() => import('./inventory/InventoryPage'));
const Gst3bMonthlyModal = lazy(() => import('./gst/GstModals').then((m) => ({ default: m.Gst3bMonthlyModal })));
const Gstr1Modal = lazy(() => import('./gst/GstModals').then((m) => ({ default: m.Gstr1Modal })));
const Gst2bMatchingModal = lazy(() => import('./gst/GstModals').then((m) => ({ default: m.Gst2bMatchingModal })));
const Gst3bDetailModal = lazy(() => import('./gst/GstModals').then((m) => ({ default: m.Gst3bDetailModal })));
const Gstr1ErrorChekModal = lazy(() => import('./gst/GstModals').then((m) => ({ default: m.Gstr1ErrorChekModal })));
const GstComplianceModal = lazy(() => import('./gst/GstModals').then((m) => ({ default: m.GstComplianceModal })));
const GstReportsHub = lazy(() => import('./gst/GstReportsHub'));
const CADashboardModal = lazy(() => import('./gst/CADashboardModal'));
const GstinReportsPage = lazy(() => import('./gst/GstinReportsPage'));
const Gstr2ReportModal = lazy(() => import('./gst/Gstr2ReportModal'));
const Gstr9ReportModal = lazy(() => import('./gst/Gstr9ReportModal'));
const EWayBillHub = lazy(() => import('./gst/EWayBillHub'));
const VisitLogModal = lazy(() => import('./crm/VisitLogModal'));

const MODULE_PARENT_MAP = {
  sales: 'sales',
  purchase: 'purchase',
  receipt: 'accounting',
  payment: 'accounting',
  cashPayment: 'accounting',
  cashReceipt: 'accounting',
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
  gstinReports: 'gst',
  gstr2: 'gst',
  gstr9: 'gst',
  ewayBill: 'gst',
  visit: 'sales',
  outstanding: 'reports',
  inventoryPage: 'inventory'
};

const MODULE_SUBMENU_MAP = {
  sales: 'Sales Billing',
  purchase: 'Purchase Bill',
  receipt: 'Bank Receipt',
  payment: 'Bank Payment',
  cashPayment: 'Cash Payment',
  cashReceipt: 'Cash Receipt',
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
  gstinReports: 'GSTIN Reports',
  gstr2: 'GSTR-2 Purchase',
  gstr9: 'GSTR-9 Annual Return',
  ewayBill: 'E-Way Bill Hub',
  visit: 'Visit Log',
  outstanding: 'Outstanding Report',
  inventoryPage: 'Stock Ledger',
  accountMaster: 'Account Master',
  itemMaster: 'Item Master',
  bookMaster: 'Book Master'
};

const idOf = (value) => {
   if (value == null || value === '') return '';
   if (typeof value === 'object') return String(value._id || value.id || '');
   return String(value);
};

const ledgerRefId = (row) => idOf(row?.refId);

async function resolveSaleDoc(sales, refId, docNo) {
   const found = (sales || []).find((s) =>
      (refId && idOf(s._id || s.id) === refId) ||
      (docNo && (s.invoiceNo === docNo || s.billNo === docNo))
   );
   if (Array.isArray(found?.items) && found.items.length) return found;
   const id = idOf(found?._id || found?.id) || refId;
   if (!id) return null;
   try {
      const full = await salesApi.get(id);
      return Array.isArray(full?.items) ? full : null;
   } catch {
      return Array.isArray(found?.items) ? found : null;
   }
}

async function resolvePurchaseDoc(purchases, refId, docNo) {
   const found = (purchases || []).find((p) =>
      (refId && idOf(p._id || p.id) === refId) ||
      (docNo && (p.invoiceNo === docNo || p.billNo === docNo || p.supplierInvoiceNo === docNo))
   );
   if (Array.isArray(found?.items) && found.items.length) return found;
   const id = idOf(found?._id || found?.id) || refId;
   if (!id) return null;
   try {
      const full = await purchasesApi.get(id);
      return Array.isArray(full?.items) ? full : null;
   } catch {
      return Array.isArray(found?.items) ? found : null;
   }
}

function pickNote(list, refId, docNo, hint) {
   const rows = (list || []).filter((n) => {
      if (String(n.status || '').toLowerCase() === 'reversed') return false;
      if (refId && idOf(n.sourceVoucherId) === refId) return true;
      if (refId && idOf(n._id || n.id) === refId) return true;
      if (docNo && (n.noteNo === docNo || n.voucherNo === docNo)) return true;
      return false;
   });
   if (!rows.length) return null;
   const text = String(hint || '');
   return rows.find((n) => text && (text.includes(n.billNo || '') || text.includes(n.noteNo || ''))) || rows[0];
}

async function resolveNoteDoc(notes, refId, docNo, hint) {
   const local = pickNote(notes, refId, docNo, hint);
   if (local) return local;
   try {
      const list = await notesApi.list();
      return pickNote(list, refId, docNo, hint);
   } catch {
      return null;
   }
}

const Dashboard = () => {
   const navigate = useNavigate();
   const { user, logout, bootstrapMasters, refreshAllData, sales, purchases, inventoryLots, jobWorkEntries, parties, items, plan, fetchDashboardSummary, dashboardSummary, dashboardLoading, vouchers, notes, books: storeBooks, ledgers, fetchBooks } = useStore();
   const companySettings = useConfigStore((s) => s.companySettings);
   const companyMeta = useConfigStore((s) => s.company);
   const [mobileNarrow, setMobileNarrow] = useState(() =>
      typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches
   );
   useEffect(() => {
      const mq = window.matchMedia('(max-width: 820px)');
      const onChange = () => setMobileNarrow(mq.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
   }, []);
   const mobileViewOnly = mobileNarrow && plan?.mobileView === true;

   const setupGaps = useMemo(() => {
      const st = companySettings || {};
      const meta = companyMeta?.meta || {};
      const gaps = [];
      const name = String(st.legalName || st.shortName || companyMeta?.name || '').trim();
      if (!name || /^company$/i.test(name) || /^my company$/i.test(name)) gaps.push('Company legal name');
      const gstin = String(st.gstin || meta.gstin || '').replace(/\s/g, '').toUpperCase();
      if (!gstin || gstin.length < 15) gaps.push('GSTIN');
      if (!String(st.address || meta.address || '').trim()) gaps.push('Address');
      const stateCode =
         String(st.stateCode || meta.stateCode || '').trim() ||
         (gstin.length >= 2 && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '');
      if (!stateCode) gaps.push('State code');
      if (!String(st.bankName || st.accountNo || '').trim()) gaps.push('Bank details');
      return gaps;
   }, [companySettings, companyMeta]);
   const { bundle, moduleConfig: liveModuleConfig, lastSynced } = useConfig();
   const { hasModule } = useEntitlements();
   const openCommandPalette = useUiStore((s) => s.openCommandPalette);
   const openNotificationCenter = useUiStore((s) => s.openNotificationCenter);
   const notificationUnread = useUiStore((s) => s.notificationUnread);
   const moduleConfig = liveModuleConfig || user?.moduleConfig;
   const showRecordsHub = isFlagEnabled(bundle, 'records_hub', true);
   const showCADesk = isFlagEnabled(bundle, 'ca_desk', true);
   const permissions = useMemo(() => getPermissions(user?.companyRole, user?.role), [user?.companyRole, user?.role]);
   const isCaUser = user?.companyRole === 'ca';
   const [caPwd, setCaPwd] = useState({ current: '', next: '' });
   const [caPwdSaving, setCaPwdSaving] = useState(false);

   const handleLogout = async () => {
      await logout();
      navigate('/login');
   };

   /** Menu visible only when Plan sells it AND Module Control leaves it on. */
   const isParentModuleEnabled = (parentKey) => {
      if (!parentKey) return true;
      if (user?.role === 'super_admin') return true;
      // Entitlements = plan.features.modules ∩ company moduleConfig (backend truth)
      if (!hasModule(parentKey)) return false;
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
      // Nested report folders stay visible; leaf gating happens inside runner / plan modules
      if (Array.isArray(item?.children) && item.children.length > 0) return true;

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
   const [millIssueInitialData, setMillIssueInitialData] = useState(null);
   const [purchaseInitialData, setPurchaseInitialData] = useState(null);
   const [salesInitialData, setSalesInitialData] = useState(null);
   const [voucherInitialId, setVoucherInitialId] = useState(null);
   const [noteInitialId, setNoteInitialId] = useState(null);
   const [outstandingSeed, setOutstandingSeed] = useState(null);
   const [productionEngineTab, setProductionEngineTab] = useState('Board');
   const [modals, setModals] = useState({
      sales: false,
      purchase: false,
      receipt: false,
      payment: false,
      cashPayment: false,
      cashReceipt: false,
      cashBook: false,
      bankBook: false,
      millIssue: false,
      millRec: false,
      jobIssue: false,
      jobRec: false,
      updateJob: false,
      outstanding: false,
      partyOsReport: false,
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
      outstandingSalesFull: false,
      outstandingPurchaseFull: false,
      contraVoucher: false,
      tdsEntry: false,
      gstComplianceReports: false,
      gstinReports: false,
      gstinReportsSection: 'sales',
      gstr2: false,
      gstr9: false,
      ewayBill: false,
      systemUtilities: false,
      zTrial: false,
      issueMultiple: false,
      lotNoEntry: false,
      cuttingEntry: false,
      beamEntry: false,
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
      reportsTab: 'summary',
      reportsLeafId: null,
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
   const [openFlyoutPath, setOpenFlyoutPath] = useState(null);
   const [isRefreshing, setIsRefreshing] = useState(false);
   const menuBarRef = useRef(null);

   // Soft refresh: keep existing KPIs visible; only full skeleton on first empty load.
   const hasDashboardData = Boolean(dashboardSummary);
   const showDashboardSkeleton = dashboardLoading && !hasDashboardData;
   const showSoftSync = isRefreshing || (dashboardLoading && hasDashboardData);

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
            setOpenFlyoutPath(null);
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
         if (typeof fetchBooks === 'function') fetchBooks();
      }
   }, [user?.companyId, user?.role, fetchDashboardSummary, fetchBooks]);

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
   const CORE_MODULES_WITH_BOOKS = ['sales', 'purchase', 'receipt', 'payment', 'cashPayment', 'cashReceipt', 'cashBook', 'bankBook', 'millIssue', 'millRec', 'jobIssue', 'jobRec'];

   const BOOK_MODULE_ALIAS = {
      cashBook: 'receipt',
      bankBook: 'receipt',
      cashPayment: 'payment',
      cashReceipt: 'receipt',
   };

   const getAvailableBooksForModule = useCallback((key) => {
      const bookMod = BOOK_MODULE_ALIAS[key] || key;
      let list = (storeBooks || []).filter((b) => b.module === bookMod);
      if (!list.length) {
         list = getDefaultBooksForModule(bookMod);
      }

      // For cash/bank books, also include bank & cash ledgers if not already present as books
      const isCashOrBank = ['receipt', 'payment', 'cashBook', 'bankBook', 'cashPayment', 'cashReceipt'].includes(bookMod);
      if (isCashOrBank && Array.isArray(ledgers) && ledgers.length > 0) {
         const existingNames = new Set(list.map((b) => (b.name || '').trim().toLowerCase()));
         const bankLedgerBooks = ledgers
            .filter((l) => ['Bank', 'Cash'].includes(l.accountType) && l.isActive !== false)
            .filter((l) => !existingNames.has((l.name || '').trim().toLowerCase()))
            .map((l, i) => ({
               _id: `ledger_book_${l._id || l.id}`,
               name: l.name,
               code: l.code || String(100 + i + 1),
               module: bookMod,
               ledgerId: l._id || l.id,
               accountType: l.accountType,
            }));
         list = [...list, ...bankLedgerBooks];
      }

      if (['cashBook', 'cashPayment', 'cashReceipt'].includes(key)) {
         const filtered = list.filter((b) => {
            const n = (b.name || '').toLowerCase();
            return n.includes('cash') || b.accountType === 'Cash';
         });
         if (filtered.length > 0) list = filtered;
      } else if (['bankBook'].includes(key)) {
         const filtered = list.filter((b) => {
            const n = (b.name || '').toLowerCase();
            return n.includes('bank') || b.accountType === 'Bank';
         });
         if (filtered.length > 0) list = filtered;
      }

      return list;
   }, [storeBooks, ledgers]);

   const toggleModal = (key, val) => {
      if (val === true && CORE_MODULES_WITH_BOOKS.includes(key)) {
         const available = getAvailableBooksForModule(key);

         // 1. Single Book: If only 1 book exists for this module, auto-select and open form directly!
         if (available.length <= 1) {
            const singleBook = available[0] || { name: key.toUpperCase(), code: '101', module: key };
            setSelectedBooks(prev => ({ ...prev, [key]: singleBook }));
            yieldOtherWindows(key);
            setModals(prev => ({ ...prev, [key]: true }));
            return;
         }

         // 2. Previously Selected Book: If user already selected a book in this session, reuse it directly!
         if (selectedBooks[key]) {
            yieldOtherWindows(key);
            setModals(prev => ({ ...prev, [key]: true }));
            return;
         }

         // 3. Multiple books (> 1) and none selected yet: ask user to pick
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

      // Opening any other screen — park maximized bills into the dock
      if (val === true) {
         yieldOtherWindows(key);
      }
      setModals(prev => ({ ...prev, [key]: val }));
   };

   const promptChangeBook = (key) => {
      setBookSelection({
         isOpen: true,
         module: key,
         bookModule: BOOK_MODULE_ALIAS[key] || key,
      });
   };

   const openPlaceholder = (name) => {
      setPlaceholderName(name);
      setModals(prev => ({ ...prev, placeholder: true }));
   };

   const handleSelectBook = (book) => {
      const key = bookSelection.module;
      setSelectedBooks(prev => ({ ...prev, [key]: book }));
      setBookSelection({ isOpen: false, module: null, bookModule: null });
      // Keep other bills open — minimize maximized ones so the new window can show
      yieldOtherWindows(key);
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

   /** side = Purchase | Sales, type = Debit | Credit — the two axes of a note. */
   const openNote = (type, side = 'Sales') => {
      setModals(prev => ({
         ...prev,
         note: true,
         noteType: type,
         noteSide: side
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

   const openReportsHub = (tab = 'summary', leafId = null) => {
      setModals(prev => ({
         ...prev,
         reportsHub: true,
         reportsTab: tab,
         reportsLeafId: leafId,
      }));
   };

   const openReportLeaf = (leafId) => {
      openReportsHub('summary', leafId);
   };

   const shellOpen = Object.values(modals).some((v) => v === true) || bookSelection.isOpen || syncModalOpen;
   useEffect(() => {
      if (isCaUser) toggleModal('caDashboard', true);
   }, [isCaUser]);
   useEffect(() => {
      const onKey = (e) => {
         if (e.repeat || e.isComposing || user?.companyRole === 'ca') return;
         const el = e.target;
         const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
         if (typing || shellOpen) return;
         const key = String(e.key || '').toLowerCase();
         const ctrl = e.ctrlKey || e.metaKey;
         if (ctrl && !e.altKey && !e.shiftKey && key === 's') {
            e.preventDefault();
            toggleModal('sales', true);
            return;
         }
         if (!e.altKey || ctrl || e.shiftKey) return;
         const open = {
            s: () => toggleModal('sales', true),
            p: () => toggleModal('purchase', true),
            r: () => openReportsHub('summary'),
            l: () => toggleModal('ledger', true),
            b: () => toggleModal('receipt', true),
            y: () => toggleModal('payment', true),
            m: () => toggleModal('millIssue', true),
            g: () => toggleModal('gstr1', true),
            o: () => toggleModal('outstanding', true),
         }[key];
         if (!open) return;
         e.preventDefault();
         open();
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
   }, [shellOpen, user?.companyRole]);

   useEffect(() => {
      const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const triggers = () => [...document.querySelectorAll('.erp-menu-bar .erp-menu-trigger')];
      const openItems = () => [...document.querySelectorAll('.erp-menu-dropdown button.erp-menu-item')].filter((el) => el.offsetParent !== null);
      const onMenuKey = (e) => {
         if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
         const el = e.target;
         if (e.key === 'F9') {
            e.preventDefault();
            e.stopPropagation();
            const rail = [...document.querySelectorAll('aside.erp-rail button')];
            const current = rail.find((btn) => btn.className.includes('bg-[var(--accent)]')) || rail[0];
            current?.focus();
            return;
         }
         if (e.key === 'F10') {
            if (isTyping(el)) return;
            e.preventDefault();
            const first = triggers()[0];
            first?.focus();
            return;
         }
         const onRail = el?.closest?.('aside.erp-rail button');
         if (onRail && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End')) {
            const rail = [...document.querySelectorAll('aside.erp-rail button')];
            const i = rail.indexOf(onRail);
            if (i < 0) return;
            e.preventDefault();
            e.stopPropagation();
            const next = e.key === 'Home' ? rail[0]
               : e.key === 'End' ? rail[rail.length - 1]
               : rail[(i + (e.key === 'ArrowDown' ? 1 : rail.length - 1)) % rail.length];
            next?.focus();
            return;
         }
         const onTrigger = el?.closest?.('.erp-menu-trigger');
         const inMenu = el?.closest?.('.erp-menu-dropdown');
         if (!onTrigger && !inMenu) return;
         if (e.key === 'Escape') {
            e.preventDefault();
            setOpenMenuSection(null);
            setOpenFlyoutPath(null);
            return;
         }
         if (onTrigger && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
            const list = triggers();
            const i = list.indexOf(onTrigger);
            if (i < 0) return;
            e.preventDefault();
            const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
            next?.focus();
            next?.click();
            return;
         }
         if (onTrigger && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            e.preventDefault();
            if (!document.querySelector('.erp-menu-dropdown')) onTrigger.click();
            setTimeout(() => openItems()[0]?.focus(), 30);
            return;
         }
         if (inMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            const list = openItems();
            const i = list.indexOf(el.closest('button') || el);
            if (i < 0) return;
            e.preventDefault();
            const next = list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length];
            next?.focus();
         }
      };
      window.addEventListener('keydown', onMenuKey, true);
      return () => window.removeEventListener('keydown', onMenuKey, true);
   }, []);

   const openGstinReports = (section = 'sales') => {
      setModals(prev => ({
         ...prev,
         gstinReports: true,
         gstinReportsSection: section
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
      
      sales.forEach((s) => acts.push({
        text: `Sales Invoice ${s.invoiceNo} — ₹${(s.netAmount || 0).toLocaleString('en-IN')}`,
        timeStr: fmtRel(s.date || s.createdAt),
        timestamp: new Date(s.date || s.createdAt).getTime(),
        type: 'sales'
      }));
      
      purchases.forEach((p) => acts.push({
        text: `Purchase Bill ${p.billNo || p.invoiceNo || 'N/A'} — ₹${(p.netAmount || 0).toLocaleString('en-IN')}`,
        timeStr: fmtRel(p.date || p.createdAt),
        timestamp: new Date(p.date || p.createdAt).getTime(),
        type: 'purchase'
      }));
      
      jobWorkEntries.forEach((j) => acts.push({
        text: `${j.status === 'Issued' ? 'Mill Issue' : 'Mill Receipt'} ${j.jobCardNo || j.challanNo} — ${j.status}`,
        timeStr: fmtRel(j.issueDate || j.createdAt),
        timestamp: new Date(j.issueDate || j.createdAt).getTime(),
        type: 'job'
      }));
      
      // Sort chronologically descending
      acts.sort((a, b) => b.timestamp - a.timestamp);
      
      return acts.slice(0, 6).map(act => ({
        text: act.text,
        time: act.timeStr,
        type: act.type
      }));
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
         { label: 'Cash Receipt', action: () => toggleModal('cashReceipt', true) },
         { label: 'Cash Payment', action: () => toggleModal('cashPayment', true) },
         { label: 'Voucher Entry', action: () => setModals(prev => ({ ...prev, contraVoucher: true })) },
         { label: 'Journal (GST)', action: () => openJournal() },
         { label: 'Debit Note On Purchase - GSTR2', action: () => openNote('Debit', 'Purchase') },
         { label: 'Credit Note On Purchase - GSTR2', action: () => openNote('Credit', 'Purchase') },
         { label: 'Debit Note On Sales - GSTR1', action: () => openNote('Debit', 'Sales') },
         { label: 'Credit Note On Sales - GSTR1', action: () => openNote('Credit', 'Sales') },
         { label: 'Tds Entry', action: () => setModals(prev => ({ ...prev, tdsEntry: true })) },
         { label: 'Sales Return', action: () => openReturn('Sales') },
         { label: 'Purchase Return', action: () => openReturn('Purchase') },
      ],
      Inventory: [
         { label: 'Issue', key: 'millIssue' },
         { label: 'Issue Multiple', action: () => setModals(prev => ({ ...prev, issueMultiple: true })) },
         { label: 'Receipt', key: 'millRec' },
         { label: 'LotNo Entry', action: () => setModals(prev => ({ ...prev, lotNoEntry: true })) },
         { label: 'Work Process', action: () => { setProductionEngineTab('Mapping'); setModals(prev => ({ ...prev, productionEngine: true })); } },
         { label: 'Job Issue', key: 'jobIssue' },
         { label: 'Job Receive', key: 'jobRec' },
         { label: 'Update Job', key: 'updateJob' },
         { label: 'Production', action: () => { setProductionEngineTab('Board'); setModals(prev => ({ ...prev, productionEngine: true })); } },
         { label: 'Cutting Entry', action: () => setModals(prev => ({ ...prev, cuttingEntry: true })) },
         { label: 'Beam Entry', action: () => setModals(prev => ({ ...prev, beamEntry: true })) },
         { label: 'Stock Ledger', key: 'inventoryPage' },
      ],
      'GST / Tax': [
         { label: 'GSTIN Sales Report', action: () => openGstinReports('sales') },
         { label: 'GSTIN Purchase Report', action: () => openGstinReports('purchase') },
         { label: 'GSTIN Process Report', action: () => openGstinReports('process') },
         { label: 'GSTIN JobWork Report', action: () => openGstinReports('jobwork') },
         { label: 'GSTIN Journal Report', action: () => openGstinReports('journal') },
         { label: 'GSTIN Expense Report', action: () => openGstinReports('expense') },
         { label: 'GSTR-1 Outward Return', key: 'gstr1' },
         { label: 'GSTR-1 Error Checking', key: 'gstr1Errorchek' },
         { label: 'GSTR-2 Purchase Report', action: () => setModals(prev => ({ ...prev, gstr2: true })) },
         { label: 'GSTR-2B Matching / Reconcile', key: 'gst2bMatching' },
         { label: 'GSTR-3B Monthly Return', key: 'gst3bMonthly' },
         { label: 'GSTR-3B Detailed Breakdown', key: 'gst3bDetail' },
         { label: 'GSTR-9 Annual Return', action: () => setModals(prev => ({ ...prev, gstr9: true })) },
         { label: 'ITC-04 Job Work Return', action: () => openGstinReports('itc04') },
         { label: 'GST Reconciliation Dashboard', action: () => openGstinReports('reconciliation') },
         { label: 'E-Way Bill Hub', action: () => setModals(prev => ({ ...prev, ewayBill: true })) },
         { label: 'CA Audit Desk', key: 'caDashboard' },
         { label: 'GST Reports Hub', action: () => toggleModal('gstReports', true) },
      ],
      Reports: [
         ...buildReportsMenuItems({
            openLeaf: openReportLeaf,
            openHub: openReportsHub,
            openExternal: (ext) => {
               if (ext === 'gstReports') toggleModal('gstReports', true);
               else if (ext === 'gstr1') toggleModal('gstr1', true);
               else toggleModal(ext, true);
            },
         }),
         { label: 'Outstanding Report (Sales)', action: () => setModals(prev => ({ ...prev, outstandingSalesFull: true })) },
         { label: 'Outstanding Report (Purchase)', action: () => setModals(prev => ({ ...prev, outstandingPurchaseFull: true })) },
         { label: 'CA Desk', key: 'caDashboard' },
         { label: 'Z Trial (Trial Balance)', action: () => setModals(prev => ({ ...prev, zTrial: true })) },
      ],
      'Others Reports': [
         { label: 'Outstanding Zoom', key: 'outstanding' },
         { label: 'Daily Transaction', action: () => openReportsHub('daily') },
         { label: 'Master List', action: () => openReportsHub('masters') },
         { label: 'Item Ledger', action: () => openReportsHub('stockItem') },
         { label: '3B Monthly Return', key: 'gst3bMonthly' },
         { label: 'Gstr-1 Error Checking', key: 'gstr1Errorchek' },
         { label: 'Gstr Matching', key: 'gst2bMatching' },
         { label: 'Gstr-9', action: () => setModals(prev => ({ ...prev, gstComplianceReports: true })) },
         { label: 'Tds Reports', action: () => setModals(prev => ({ ...prev, gstComplianceReports: true })) },
         { label: 'Tcs Reports', action: () => setModals(prev => ({ ...prev, gstComplianceReports: true })) },
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
         {
            label: 'Backup',
            action: () => {
               if (showDevTools()) {
                  setModals(prev => ({ ...prev, infrastructure: true }));
               } else {
                  toast.info('Backup is managed by your admin or the desktop installer — not from this screen.');
               }
            },
         },
         { label: 'Closing / UnClosing Year', action: () => setModals(prev => ({ ...prev, systemUtilities: true })) },
         { label: 'New A/c. Year ( Manual )', action: () => setModals(prev => ({ ...prev, systemUtilities: true })) },
         { label: 'MisMatch Data Scanner', action: () => setModals(prev => ({ ...prev, systemUtilities: true })) },
         { label: 'Missing Series', action: () => setModals(prev => ({ ...prev, systemUtilities: true })) },
         { label: 'Update Main Account Master', action: () => toggleModal('accountMaster', true) },
         { label: 'Gst Updation', action: () => toggleModal('caDashboard', true) },
         { label: 'Application Sync', action: () => refreshAllData().then(() => toast.success('All data refreshed.')) },
      ],
      'Setup System': [
         { label: 'Setting', action: () => openSettings('appearance') },
         { label: 'Company Info', action: () => openSettings('company') },
         { label: 'CA Access', action: () => openSettings('caAccess') },
         { label: 'Extra Event', action: () => openSettings('notificationRules') },
         { label: 'Extra Event DetailData', action: () => openSettings('notificationRules') },
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
         if (section === 'Advanced') return;
         if (permissions.canAccessSection(section)) {
            let allowedItems = items.filter(isMenuItemAllowed);
            if (section === 'Admin') {
               allowedItems = allowedItems.filter(i => i.label !== 'User Rights' || permissions.canManageUsers);
            }
            if (!showDevTools()) {
               allowedItems = allowedItems.filter((i) => !DEV_ONLY_MENU_LABELS.has(i.label));
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
      // Sales Return & Purchase Return hidden from rail — use Transaction menu instead
      { id: 3, label: 'Bank Receipt', icon: faMoneyCheckDollar, key: 'receipt' },
      { id: 4, label: 'Bank Payment', icon: faHandHoldingDollar, key: 'payment' },
      { id: 5, label: 'Mill Issue', icon: faTruckArrowRight, key: 'millIssue' },
      { id: 6, label: 'Mill Receive', icon: faWarehouse, key: 'millRec' },
      { id: 7, label: 'Job Issue', icon: faScrewdriverWrench, key: 'jobIssue' },
      { id: 8, label: 'Job Receive', icon: faClipboardCheck, key: 'jobRec' },
      { id: 9, label: 'CA Desk', icon: faUserTie, key: 'caDashboard', flag: 'ca_desk' },
      { id: 10, label: 'GSTR-1', icon: faChartPie, key: 'gstr1' },
      { id: 16, label: 'GST Reports', icon: faChartPie, key: 'gstReports' },
      { id: 11, label: 'GSTR-2', icon: faChartPie, key: 'gst2bMatching' },
      { id: 14, label: 'Outstanding', icon: faChartPie, key: 'outstanding' },
   ];

   const coreModules = useMemo(() => {
      if (isCaUser) return ALL_CORE_MODULES.filter((mod) => mod.key === 'caDashboard');
      const filtered = ALL_CORE_MODULES.filter(
         mod => isModuleAllowed(mod.key) && (!mod.flag || isFlagEnabled(bundle, mod.flag, true))
      );
      return filtered.length > 0 ? filtered : ALL_CORE_MODULES;
   }, [moduleConfig, bundle, user?.role, isCaUser]);

   const openModalDirect = (key) => {
      yieldOtherWindows(key);
      setModals(prev => ({ ...prev, [key]: true }));
   };

   return (
      <div className="erp-shell erp-shell-with-kbd fixed inset-0 flex overflow-hidden">

         {/* Core modules — compact rail */}
         <aside className="erp-rail flex flex-col py-2 gap-0.5 shrink-0 overflow-y-auto no-scrollbar">
            <p className="px-3 py-1.5 text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0" title="F9 focuses this list. Up and Down move. Enter opens.">Quick · F9</p>
            {coreModules.map((mod) => (
               <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                     setActiveMenuKey(mod.key);
                     if (mod.key === 'salesReturn') openReturn('Sales');
                     else if (mod.key === 'purchaseReturn') openReturn('Purchase');
                     else toggleModal(mod.key, true);
                  }}
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
               {!isCaUser && <button
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
               </button>}
               {isCaUser && <button
                  type="button"
                  onClick={() => setCaPwd((p) => ({ ...p, open: !p.open }))}
                  className="w-full flex items-center gap-2 h-8 px-2 rounded-lg text-left transition-colors cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
               >
                  <FontAwesomeIcon icon={faGear} className="text-[11px] w-3.5 shrink-0" />
                  <span className="text-[11px] font-medium truncate leading-tight">Settings</span>
               </button>}
               {!isCaUser && <button
                  type="button"
                  onClick={() => openSettings('appearance')}
                  className="w-full flex items-center gap-2 h-8 px-2 rounded-lg text-left transition-colors cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
               >
                  <FontAwesomeIcon icon={faGear} className="text-[11px] w-3.5 shrink-0" />
                  <span className="text-[11px] font-medium truncate leading-tight">Settings</span>
               </button>}
               <button
                  type="button"
                  onClick={() => toast.info('Ctrl+S Sales · Alt+P Purchase · Alt+R Reports · Alt+L Ledger · Alt+B Receipt · Alt+Y Payment · Alt+M Mill · Alt+G GSTR-1 · Alt+O Outstanding. Bill open hone par yeh keys nahi chalti. Save ab bhi Ctrl+Enter hai.')}
                  className="w-full flex items-center gap-2 h-8 px-2 rounded-lg text-left transition-colors cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
               >
                  <FontAwesomeIcon icon={faCircleQuestion} className="text-[11px] w-3.5 shrink-0" />
                  <span className="text-[11px] font-medium truncate leading-tight">Help</span>
               </button>
            </div>
         </aside>

         {/* Main area */}
         <main className="flex-1 min-w-0 flex flex-col bg-[var(--bg-base)] relative min-h-0">
            <header className="shrink-0 relative z-[4000] bg-[var(--bg-card)] border-b border-[var(--border)]">
               {mobileViewOnly && (
                  <div className="px-3 py-1 text-[11px] font-semibold text-amber-900 bg-amber-100 border-b border-amber-200">
                     Mobile view — is plan par sirf dekh sakte ho. Bill edit, save aur master change phone par band hai.
                  </div>
               )}
               <div className="flex items-center justify-between gap-2 px-3 h-8">
                  <div className="flex items-center gap-2 min-w-0">
                     <div className="w-5 h-5 rounded bg-[var(--accent)] text-white flex items-center justify-center font-semibold text-[10px] shrink-0">
                        {(user?.companyName || user?.company?.name || companySettings?.legalName || companySettings?.shortName || companyMeta?.name || 'C').charAt(0)}
                     </div>
                     <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate leading-none">
                        {user?.companyName || user?.company?.name || companySettings?.legalName || companySettings?.shortName || companyMeta?.name || 'Company'}
                     </p>
                  </div>

                  {!isCaUser && <div className="hidden md:flex flex-1 max-w-xs mx-2">
                     <div className="relative w-full">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px]" />
                        <button
                           type="button"
                           onClick={() => openCommandPalette()}
                           className="w-full h-6 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-md py-0 pl-7 pr-2 text-[11px] text-left text-[var(--text-muted)] hover:border-[var(--accent)]"
                        >
                           Search… <span className="text-[9px] opacity-70">Ctrl+K</span>
                        </button>
                     </div>
                  </div>}

                  <div className="flex items-center gap-2 shrink-0">
                     {!isCaUser && <OfflineIndicator onOpenSync={() => setSyncModalOpen(true)} />}
                     {!isCaUser && <PanelSwitcher variant="light" />}
                     {!isCaUser && <button
                        type="button"
                        onClick={() => navigate('/subscription')}
                        className="h-6 px-2 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] rounded-md bg-white hover:bg-[var(--bg-subtle)]"
                        title="Subscription & billing"
                     >
                        Plan
                     </button>}
                     {!isCaUser && <button type="button" onClick={() => refreshAllData()} className="h-6 px-2 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] rounded-md bg-white hover:bg-[var(--bg-subtle)]">
                        <FontAwesomeIcon icon={faSync} className={`text-[9px] mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />Sync
                     </button>}
                     {!isCaUser && <button
                        type="button"
                        onClick={() => openNotificationCenter()}
                        className="relative w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Notifications"
                     >
                        <FontAwesomeIcon icon={faBell} className="text-[12px]" />
                        {notificationUnread > 0 && (
                           <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-600 text-white text-[8px] font-bold flex items-center justify-center">
                              {notificationUnread > 99 ? '99+' : notificationUnread}
                           </span>
                        )}
                     </button>}
                     <div className="flex items-center gap-2 pl-2 border-l border-[var(--border)]">
                        <div className="text-right hidden sm:block">
                           <p className="text-[11px] font-medium text-[var(--text-primary)] leading-none">{user?.name || user?.email || 'User'}</p>
                           <p className="text-[9px] text-[var(--text-muted)] capitalize">{isCaUser ? 'CA' : String(user?.companyRole || user?.role || 'access').replace(/_/g, ' ')}</p>
                        </div>
                        <div className="w-5 h-5 rounded bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-semibold text-[9px]">
                           {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <button
                           type="button"
                           onClick={handleLogout}
                           title="Sign out"
                           className="h-6 px-2 flex items-center gap-1 text-[10px] font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-md transition-colors"
                        >
                           <FontAwesomeIcon icon={faRightFromBracket} className="text-[9px]" />
                           <span className="hidden sm:inline">Logout</span>
                        </button>
                     </div>
                  </div>
               </div>

               {!isCaUser && <div ref={menuBarRef} className="erp-menu-bar select-none">
                  {Object.keys(visibleMenuData).map((section) => {
                     const isOpen = openMenuSection === section;
                     return (
                     <div key={section} className="relative shrink-0">
                        <button
                           type="button"
                           onClick={() => {
                              setOpenMenuSection(isOpen ? null : section);
                              setOpenFlyoutPath(null);
                           }}
                           className={`erp-menu-trigger ${isOpen ? 'erp-menu-trigger--open' : ''}`}
                        >
                           {section}
                        </button>
                        {isOpen && (
                           <div className="erp-menu-dropdown">
                                 {visibleMenuData[section].map((item, idx) => {
                                    const renderMenuNode = (node, keyPrefix) => {
                                       const label = typeof node === 'object' ? node.label : node;
                                       const { badge, text } = parseMenuLabel(label);
                                       const kids = Array.isArray(node.children) ? node.children : null;
                                       const needsSeparator = text === 'Closing / UnClosing Year' || text === 'Voucher Relndex';
                                       const flyoutOpen = openFlyoutPath === keyPrefix
                                          || (typeof openFlyoutPath === 'string' && openFlyoutPath.startsWith(`${keyPrefix}-`));

                                       if (kids?.length) {
                                          return (
                                             <React.Fragment key={keyPrefix}>
                                                {needsSeparator && <div className="erp-menu-separator" />}
                                                <div className="erp-menu-item-row">
                                                   <button
                                                      type="button"
                                                      className={`erp-menu-item erp-menu-item--parent ${openFlyoutPath === keyPrefix ? 'erp-menu-trigger--open' : ''}`}
                                                      onClick={(e) => {
                                                         e.stopPropagation();
                                                         setOpenFlyoutPath((prev) => (prev === keyPrefix ? null : keyPrefix));
                                                      }}
                                                   >
                                                      {badge && (
                                                         <span className="text-[9px] text-white bg-[var(--accent)] px-1 rounded font-mono shrink-0">
                                                            {badge}
                                                         </span>
                                                      )}
                                                      <span className="truncate">{text}</span>
                                                      <span className="erp-menu-chevron">{flyoutOpen ? '▾' : '▸'}</span>
                                                   </button>
                                                   {flyoutOpen && (
                                                      <div className={section === 'Reports' ? 'erp-menu-nest' : 'erp-menu-flyout erp-menu-flyout--open'}>
                                                         {kids.map((child, cIdx) => renderMenuNode(child, `${keyPrefix}-${cIdx}`))}
                                                      </div>
                                                   )}
                                                </div>
                                             </React.Fragment>
                                          );
                                       }

                                       return (
                                          <React.Fragment key={keyPrefix}>
                                             {needsSeparator && <div className="erp-menu-separator" />}
                                             <button
                                                type="button"
                                                onClick={() => {
                                                   setOpenMenuSection(null);
                                                   setOpenFlyoutPath(null);
                                                   handleMenuItemClick(node);
                                                }}
                                                className="erp-menu-item"
                                             >
                                                {badge && (
                                                   <span className="text-[9px] text-white bg-[var(--accent)] px-1 rounded font-mono shrink-0">
                                                      {badge}
                                                   </span>
                                                )}
                                                <span className="truncate">{text}</span>
                                                {node.soon && <span className="erp-menu-soon">Soon</span>}
                                             </button>
                                          </React.Fragment>
                                       );
                                    };

                                    return renderMenuNode(item, String(idx));
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
               </div>}

            </header>

            <div className="flex-1 overflow-y-auto p-4 erp-scroll-smooth relative">
               <TopProgressBar show={showSoftSync} />
               <div className="max-w-6xl mx-auto flex flex-col gap-4 erp-motion-content">
               {isCaUser ? (
                  <div className="erp-card p-6 max-w-lg">
                     <p className="text-sm font-semibold">CA Desk</p>
                     <p className="text-[12px] text-[var(--text-muted)] mt-1">You only see the reports this company allowed. Sales, purchase and accounts entry stay with the owner.</p>
                     <button type="button" className="erp-btn erp-btn-primary h-8 px-3 text-[11px] mt-3" onClick={() => toggleModal('caDashboard', true)}>Open CA Desk</button>
                  </div>
               ) : null}
               {isCaUser && caPwd.open && (
                  <div className="erp-card p-6 max-w-lg space-y-3">
                     <p className="text-sm font-semibold">Change password</p>
                     <p className="text-[12px] text-[var(--text-muted)]">Use the password the company gave you, then set a new one.</p>
                     <input type="password" value={caPwd.current} onChange={(e) => setCaPwd((p) => ({ ...p, current: e.target.value }))} placeholder="Current password" className="h-8 w-full px-2 text-[12px] rounded border border-[var(--border)]" />
                     <input type="password" value={caPwd.next} onChange={(e) => setCaPwd((p) => ({ ...p, next: e.target.value }))} placeholder="New password" className="h-8 w-full px-2 text-[12px] rounded border border-[var(--border)]" />
                     <button
                        type="button"
                        disabled={caPwdSaving}
                        className="erp-btn erp-btn-primary h-8 px-3 text-[11px]"
                        onClick={async () => {
                           setCaPwdSaving(true);
                           try {
                              await authApi.changePassword({ currentPassword: caPwd.current, newPassword: caPwd.next });
                              setCaPwd({ current: '', next: '', open: true });
                              toast.success('Password changed');
                           } catch (err) {
                              toast.error(err?.message || 'Could not change password');
                           } finally {
                              setCaPwdSaving(false);
                           }
                        }}
                     >
                        {caPwdSaving ? 'Saving…' : 'Update password'}
                     </button>
                  </div>
               )}
               {!isCaUser && (<>
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
                     <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={handleSync} disabled={showSoftSync || showDashboardSkeleton}>
                        <FontAwesomeIcon icon={faSync} className={`text-[9px] mr-1 ${showSoftSync || showDashboardSkeleton ? 'animate-spin' : ''}`} />
                        {showSoftSync || showDashboardSkeleton ? 'Syncing…' : 'Sync'}
                     </button>
                     {showRecordsHub && (
                        <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => openRecordsHub('accounts')}>Records</button>
                     )}
                     <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => openReportsHub('summary')}>Reports</button>
                     {showCADesk && isModuleAllowed('caDashboard') && (
                        <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => toggleModal('caDashboard', true)}>CA Desk</button>
                     )}
                     <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => toggleModal('ledger', true)}>Ledger</button>
                     <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={() => setModals(prev => ({ ...prev, zTrial: true }))}>Z Trial</button>
                     <button type="button" className="erp-btn erp-btn-primary h-7 px-3 text-[11px]" onClick={() => toggleModal('sales', true)}>+ Invoice</button>
                  </div>
               </div>

               {showDashboardSkeleton ? (
                  <CardGridLoader count={6} />
               ) : (
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 erp-motion-stagger">
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
                  {showSoftSync && !showDashboardSkeleton && (
                     <div className="absolute top-2 right-3 z-10">
                        <InlineLoader message="Updating…" />
                     </div>
                  )}
                  <h3 className="text-[12px] font-semibold mb-3 text-[var(--text-primary)]">Recent Activity</h3>
                  <div className="flex flex-col gap-2">
                     {(recentActivity.length ? recentActivity : [{ text: 'No recent transactions', time: '—', type: 'empty' }]).map((act, i) => (
                        <div key={i} className="flex gap-2 items-start erp-motion-fade-in">
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
               </>)}
               </div>
            </div>
         </main>

         {/* Modals — daily path is eager; rare screens stay in Suspense */}
         <SalesModal
            isOpen={modals.sales}
            onClose={() => {
               setSalesInitialData(null);
               toggleModal('sales', false);
            }}
            initialData={salesInitialData}
            selectedBook={selectedBooks.sales?.name}
            readOnly={!permissions.canSave || mobileViewOnly}
            onChangeBook={() => promptChangeBook('sales')}
         />
         <PurchaseModal 
            isOpen={modals.purchase} 
            onClose={() => {
               setPurchaseInitialData(null);
               toggleModal('purchase', false);
            }}
            initialData={purchaseInitialData}
            selectedBook={selectedBooks.purchase?.name} 
            readOnly={!permissions.canSave || mobileViewOnly} 
            onChangeBook={() => promptChangeBook('purchase')}
            onOpenSales={() => { yieldOtherWindows('sales'); toggleModal('sales', true); }}
            onOpenJobIssue={() => { yieldOtherWindows('jobIssue'); toggleModal('jobIssue', true); }}
            onOpenMillIssue={(data) => {
               setMillIssueInitialData(data || null);
               yieldOtherWindows('millIssue');
               toggleModal('millIssue', true);
            }}
         />

         <CashBankBookModal
            isOpen={modals.cashBook}
            onClose={() => { setVoucherInitialId(null); toggleModal('cashBook', false); }}
            bookKind="cash"
            initialType="Receipt"
            initialVoucherId={voucherInitialId}
            selectedBook={selectedBooks.cashBook}
            readOnly={!permissions.canSave || mobileViewOnly}
         />
         <CashBankBookModal
            isOpen={modals.bankBook}
            onClose={() => { setVoucherInitialId(null); toggleModal('bankBook', false); }}
            bookKind="bank"
            initialType="Receipt"
            initialVoucherId={voucherInitialId}
            selectedBook={selectedBooks.bankBook}
            readOnly={!permissions.canSave || mobileViewOnly}
         />
         <CashBankBookModal
            isOpen={modals.receipt}
            onClose={() => { setVoucherInitialId(null); toggleModal('receipt', false); }}
            bookKind="bank"
            initialType="Receipt"
            initialVoucherId={voucherInitialId}
            selectedBook={selectedBooks.receipt}
            readOnly={!permissions.canSave || mobileViewOnly}
         />
         <CashBankBookModal
            isOpen={modals.payment}
            onClose={() => { setVoucherInitialId(null); toggleModal('payment', false); }}
            bookKind="bank"
            initialType="Payment"
            initialVoucherId={voucherInitialId}
            selectedBook={selectedBooks.payment}
            readOnly={!permissions.canSave || mobileViewOnly}
         />
         <CashBankBookModal
            isOpen={modals.cashPayment}
            onClose={() => { setVoucherInitialId(null); toggleModal('cashPayment', false); }}
            bookKind="cash"
            initialType="Payment"
            initialVoucherId={voucherInitialId}
            selectedBook={selectedBooks.cashPayment}
            readOnly={!permissions.canSave || mobileViewOnly}
         />
         <CashBankBookModal
            isOpen={modals.cashReceipt}
            onClose={() => { setVoucherInitialId(null); toggleModal('cashReceipt', false); }}
            bookKind="cash"
            initialType="Receipt"
            initialVoucherId={voucherInitialId}
            selectedBook={selectedBooks.cashReceipt}
            readOnly={!permissions.canSave || mobileViewOnly}
         />
         <IssueModal
            isOpen={modals.millIssue}
            onClose={() => {
               setMillIssueInitialData(null);
               toggleModal('millIssue', false);
            }}
            selectedBook={selectedBooks.millIssue?.name}
            initialData={millIssueInitialData}
         />
         <ReceiveModal
            isOpen={modals.millRec}
            onClose={() => toggleModal('millRec', false)}
            selectedBook={selectedBooks.millRec?.name}
            onOpenPayment={(partyId) => {
               setVoucherInitialId(null);
               openModalDirect('payment');
            }}
         />
         <UpdateModal isOpen={modals.jobIssue} onClose={() => toggleModal('jobIssue', false)} selectedBook={selectedBooks.jobIssue?.name} />
         <JobReceiptModal
            isOpen={modals.jobRec}
            onClose={() => toggleModal('jobRec', false)}
            selectedBook={selectedBooks.jobRec?.name}
            onOpenPayment={(partyId) => {
               setVoucherInitialId(null);
               openModalDirect('payment');
            }}
         />
         <ProcessUpdateModal isOpen={modals.updateJob} onClose={() => toggleModal('updateJob', false)} />
         <LedgerModal
            isOpen={modals.ledger}
            onClose={() => toggleModal('ledger', false)}
            onOpenJournal={() => {
               minimizeErpWindow('ledger');
               openModalDirect('journal');
            }}
            onOpenPayment={(data) => {
               const docNo = data?.voucherNo || data?.docNo || data?.row?.billVoucherNo || '';
               const refId = ledgerRefId(data?.row);
               const found = (vouchers || []).find(v => (refId && idOf(v._id || v.id) === refId) || (docNo && (v.voucherNo === docNo || v.billNo === docNo)));
               const vId = found?._id || refId || null;
               setVoucherInitialId(vId);
               minimizeErpWindow('ledger');
               const isCash = String(data?.row?.particulars || '').toLowerCase().includes('cash') || docNo.startsWith('CPV') || (found && found.bookKind === 'cash');
               if (isCash) {
                  openModalDirect('cashPayment');
                  focusErpWindow('cashbank-cash-Payment');
               } else {
                  openModalDirect('payment');
                  focusErpWindow('cashbank-bank-Payment');
               }
            }}
            onOpenReceipt={(data) => {
               const docNo = data?.voucherNo || data?.docNo || data?.row?.billVoucherNo || '';
               const refId = ledgerRefId(data?.row);
               const found = (vouchers || []).find(v => (refId && idOf(v._id || v.id) === refId) || (docNo && (v.voucherNo === docNo || v.billNo === docNo)));
               const vId = found?._id || refId || null;
               setVoucherInitialId(vId);
               minimizeErpWindow('ledger');
               const isCash = String(data?.row?.particulars || '').toLowerCase().includes('cash') || docNo.startsWith('CRV') || (found && found.bookKind === 'cash');
               if (isCash) {
                  openModalDirect('cashReceipt');
                  focusErpWindow('cashbank-cash-Receipt');
               } else {
                  openModalDirect('receipt');
                  focusErpWindow('cashbank-bank-Receipt');
               }
            }}
            onOpenSales={async (data) => {
               const docNo = data?.invoiceNo || data?.docNo || data?.voucherNo || data?.row?.billVoucherNo || '';
               const refId = ledgerRefId(data?.row);
               const found = await resolveSaleDoc(sales, refId, docNo);
               if (!found) {
                  toast.error('Sales bill could not be opened');
                  return;
               }
               minimizeErpWindow('ledger');
               setSalesInitialData(found);
               openModalDirect('sales');
               focusErpWindow('sales');
            }}
            onOpenPurchase={async (data) => {
               const docNo = data?.invoiceNo || data?.docNo || data?.voucherNo || data?.row?.billVoucherNo || '';
               const refId = ledgerRefId(data?.row);
               const found = await resolvePurchaseDoc(purchases, refId, docNo);
               if (!found) {
                  toast.error('Purchase bill could not be opened');
                  return;
               }
               minimizeErpWindow('ledger');
               setPurchaseInitialData(found);
               openModalDirect('purchase');
               focusErpWindow('purchase');
            }}
            onOpenNote={async (data) => {
               const docNo = data?.docNo || data?.voucherNo || data?.row?.billVoucherNo || '';
               const refId = ledgerRefId(data?.row);
               const hint = `${data?.row?.remarks || ''} ${data?.row?.narration || ''} ${docNo}`;
               const found = await resolveNoteDoc(notes, refId, docNo, hint);
               if (!found) {
                  toast.warning('Discount note is not saved on this line. Opening the voucher instead.');
                  minimizeErpWindow('ledger');
                  const vt = String(data?.row?.voucherType || data?.row?.refType || '').toLowerCase();
                  if (vt.includes('payment')) {
                     const vId = refId || null;
                     setVoucherInitialId(vId);
                     openModalDirect('payment');
                     focusErpWindow('cashbank-bank-Payment');
                  } else {
                     setVoucherInitialId(refId || null);
                     openModalDirect('receipt');
                     focusErpWindow('cashbank-bank-Receipt');
                  }
                  return;
               }
               minimizeErpWindow('ledger');
               setNoteInitialId(found._id || found.id);
               setModals((prev) => ({
                  ...prev,
                  note: true,
                  noteType: found.noteType || prev.noteType,
                  noteSide: found.noteSide || prev.noteSide || 'Sales',
               }));
               yieldOtherWindows('note');
               const noteWindowId = `note-${found.noteSide || 'Sales'}-${found.noteType || 'Credit'}`;
               setTimeout(() => focusErpWindow(noteWindowId), 40);
            }}
            onOpenOutstanding={(data) => {
               setOutstandingSeed({
                  partyId: data?.partyId || '',
                  partyName: data?.partyName || '',
                  osType: data?.osType || 'receivable',
               });
               setModals((prev) => ({ ...prev, partyOsReport: true }));
            }}
         />
         <AccountMasterModal isOpen={modals.accountMaster} onClose={() => toggleModal('accountMaster', false)} readOnly={permissions.readOnlyMasters || mobileViewOnly} />
         <ItemMasterModal isOpen={modals.itemMaster} onClose={() => toggleModal('itemMaster', false)} readOnly={permissions.readOnlyMasters || mobileViewOnly} />
         {modals.outstandingSalesFull && (
            <OutstandingReportModal
               isOpen={modals.outstandingSalesFull}
               onClose={() => setModals(prev => ({ ...prev, outstandingSalesFull: false }))}
               type="receivable"
            />
         )}
         {modals.outstandingPurchaseFull && (
            <OutstandingReportModal
               isOpen={modals.outstandingPurchaseFull}
               onClose={() => setModals(prev => ({ ...prev, outstandingPurchaseFull: false }))}
               type="payable"
            />
         )}
         {modals.systemUtilities && (
            <SystemUtilitiesModal
               isOpen={modals.systemUtilities}
               onClose={() => setModals(prev => ({ ...prev, systemUtilities: false }))}
            />
         )}
         {modals.zTrial && (
            <TrialBalanceModal
               isOpen={modals.zTrial}
               onClose={() => setModals(prev => ({ ...prev, zTrial: false }))}
            />
         )}
         <PartyModal isOpen={modals.party} onClose={() => toggleModal('party', false)} />
         <BookMasterModal isOpen={modals.bookMaster} onClose={() => toggleModal('bookMaster', false)} readOnly={permissions.readOnlyMasters || mobileViewOnly} />

         {/* Lazy-only island — must NOT wrap Sales/Purchase or clicks go blank */}
         <Suspense fallback={null}>
            {modals.outstanding && (
               <SalesOutstanding
                  isOpen={modals.outstanding}
                  initialPartyId={outstandingSeed?.partyId || ''}
                  initialType={outstandingSeed?.osType || 'receivable'}
                  autoRun={!!outstandingSeed?.partyId}
                  onClose={() => {
                     setOutstandingSeed(null);
                     toggleModal('outstanding', false);
                  }}
               />
            )}
            {modals.partyOsReport && outstandingSeed?.partyId && (
               <OutstandingReportModal
                  isOpen
                  type={outstandingSeed.osType || 'receivable'}
                  directPartyId={outstandingSeed.partyId}
                  directPartyName={outstandingSeed.partyName || ''}
                  onClose={() => {
                     setOutstandingSeed(null);
                     setModals((prev) => ({ ...prev, partyOsReport: false }));
                  }}
               />
            )}
            {modals.gstComplianceReports && (
               <GstComplianceReportsModal
                  isOpen={modals.gstComplianceReports}
                  onClose={() => setModals(prev => ({ ...prev, gstComplianceReports: false }))}
               />
            )}
            {modals.lotNoEntry && (
               <LotNoEntryModal
                  isOpen={modals.lotNoEntry}
                  onClose={() => setModals(prev => ({ ...prev, lotNoEntry: false }))}
               />
            )}
            {modals.issueMultiple && (
               <IssueMultipleModal
                  isOpen={modals.issueMultiple}
                  onClose={() => setModals(prev => ({ ...prev, issueMultiple: false }))}
               />
            )}
            {modals.cuttingEntry && (
               <CuttingBeamEntryModal
                  isOpen={modals.cuttingEntry}
                  onClose={() => setModals(prev => ({ ...prev, cuttingEntry: false }))}
                  mode="cutting"
               />
            )}
            {modals.beamEntry && (
               <CuttingBeamEntryModal
                  isOpen={modals.beamEntry}
                  onClose={() => setModals(prev => ({ ...prev, beamEntry: false }))}
                  mode="beam"
               />
            )}
            {modals.gst3bMonthly && <Gst3bMonthlyModal isOpen onClose={() => toggleModal('gst3bMonthly', false)} />}
            {modals.gstr1 && <Gstr1Modal isOpen onClose={() => toggleModal('gstr1', false)} />}
            {modals.gstReports && <GstReportsHub isOpen onClose={() => toggleModal('gstReports', false)} />}
            {modals.gst2bMatching && <Gst2bMatchingModal isOpen onClose={() => toggleModal('gst2bMatching', false)} />}
            {modals.gst3bDetail && <Gst3bDetailModal isOpen onClose={() => toggleModal('gst3bDetail', false)} />}
            {modals.gstr1Errorchek && <Gstr1ErrorChekModal isOpen onClose={() => toggleModal('gstr1Errorchek', false)} />}
            {modals.gstCompliance && <GstComplianceModal isOpen onClose={() => toggleModal('gstCompliance', false)} />}
            {modals.gstinReports && (
               <GstinReportsPage
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, gstinReports: false }))}
                  initialSection={modals.gstinReportsSection || 'sales'}
               />
            )}
            {modals.gstr2 && (
               <Gstr2ReportModal isOpen onClose={() => setModals(prev => ({ ...prev, gstr2: false }))} />
            )}
            {modals.gstr9 && (
               <Gstr9ReportModal isOpen onClose={() => setModals(prev => ({ ...prev, gstr9: false }))} />
            )}
            {modals.ewayBill && (
               <EWayBillHub isOpen onClose={() => setModals(prev => ({ ...prev, ewayBill: false }))} />
            )}
            {modals.caDashboard && (
               <CADashboardModal
                  isOpen
                  onClose={() => toggleModal('caDashboard', false)}
                  onOpenGstr1={() => { toggleModal('caDashboard', false); toggleModal('gstr1', true); }}
                  onOpenGstr2={() => { toggleModal('caDashboard', false); toggleModal('gst2bMatching', true); }}
                  onOpenGstr3b={() => { toggleModal('caDashboard', false); toggleModal('gst3bMonthly', true); }}
               />
            )}
            {modals.visit && <VisitLogModal isOpen onClose={() => toggleModal('visit', false)} />}
            {modals.inventoryPage && (
               <Modal isOpen={modals.inventoryPage} onClose={() => toggleModal('inventoryPage', false)} title="Inventory Stock Control" className="max-w-[90vw]">
                  <div className="bg-[var(--bg-card)] p-2 rounded-[2.5rem] overflow-hidden">
                     <InventoryPage />
                  </div>
               </Modal>
            )}
            {modals.jobWorker && (
               <Modal isOpen={modals.jobWorker} onClose={() => toggleModal('jobWorker', false)} title="Processing Partner Registry" className="max-w-[90vw]">
                  <div className="bg-[var(--bg-card)] p-10 rounded-[2.5rem]">
                     <JobWorkerMaster />
                  </div>
               </Modal>
            )}
         </Suspense>

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
               <p className="text-body text-[var(--text-secondary)]">
                  This menu item is not wired in your plan or is still being built. Use Sales, Purchase, GST reports, or ask your admin to enable the module.
               </p>
            </div>
         </Modal>

         {/* Book Selection Modal */}
         <BookSelectionModal
            isOpen={bookSelection.isOpen}
            onClose={() => setBookSelection({ isOpen: false, module: null, bookModule: null })}
            moduleName={bookSelection.bookModule || bookSelection.module}
            onSelectBook={handleSelectBook}
            bookFilter={
              ['cashBook', 'cashPayment', 'cashReceipt'].includes(bookSelection.module)
                ? (b) => /cash/i.test(b.name || '') || b.accountType === 'Cash'
                : null
            }
         />

         {/* New Database-Connected Modals */}
         <GenericMasterModal 
            isOpen={modals.genericMaster} 
            onClose={() => setModals(prev => ({ ...prev, genericMaster: false }))} 
            type={modals.genericMasterType}
            readOnly={permissions.readOnlyMasters || mobileViewOnly}
         />
         <OpeningBalanceModal
            isOpen={modals.openingBalance}
            onClose={() => setModals(prev => ({ ...prev, openingBalance: false }))}
            readOnly={permissions.readOnlyMasters || mobileViewOnly}
         />
         <OpeningStockModal
            isOpen={modals.openingStock}
            onClose={() => setModals(prev => ({ ...prev, openingStock: false }))}
            readOnly={permissions.readOnlyMasters || mobileViewOnly}
         />
         <WarehouseMasterModal
            isOpen={modals.warehouseMaster}
            onClose={() => setModals(prev => ({ ...prev, warehouseMaster: false }))}
            readOnly={permissions.readOnlyMasters || mobileViewOnly}
         />
         <MergeMasterModal
            isOpen={modals.mergeMaster}
            onClose={() => setModals(prev => ({ ...prev, mergeMaster: false }))}
         />
         <Suspense fallback={null}>
            {modals.purchaseEngine && (
               <PurchaseEngineModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, purchaseEngine: false }))}
               />
            )}
            {modals.inventoryEngine && (
               <InventoryEngineModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, inventoryEngine: false }))}
               />
            )}
            {modals.productionEngine && (
               <ProductionEngineModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, productionEngine: false }))}
                  initialTab={productionEngineTab}
               />
            )}
            {modals.salesEngine && (
               <SalesEngineModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, salesEngine: false }))}
               />
            )}
            {modals.automationEngine && (
               <AutomationEngineModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, automationEngine: false }))}
               />
            )}
            {modals.stage2Ops && (
               <Stage2OpsModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, stage2Ops: false }))}
               />
            )}
            {modals.enterprisePlatform && (
               <EnterprisePlatformModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, enterprisePlatform: false }))}
               />
            )}
            {modals.infrastructure && (
               <InfrastructureModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, infrastructure: false }))}
               />
            )}
            {modals.commercialRelease && (
               <CommercialReleaseModal
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, commercialRelease: false }))}
               />
            )}
            {modals.enterpriseTesting && (
               <EnterpriseTestingDashboard
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, enterpriseTesting: false }))}
               />
            )}
            {modals.onboardingWizard && (
               <OnboardingWizard
                  isOpen
                  onClose={() => setModals(prev => ({ ...prev, onboardingWizard: false }))}
               />
            )}
         </Suspense>
         <OrderModal 
            isOpen={modals.order} 
            onClose={() => setModals(prev => ({ ...prev, order: false }))} 
            initialType={modals.orderType} 
         />
         <ReturnModal 
            key={`return-${modals.returnType || 'Sales'}`}
            isOpen={modals.returnInv} 
            onClose={() => setModals(prev => ({ ...prev, returnInv: false }))} 
            initialType={modals.returnType} 
         />
         <NoteModal
            isOpen={modals.note}
            onClose={() => {
               setNoteInitialId(null);
               setModals(prev => ({ ...prev, note: false }));
            }}
            initialNoteId={noteInitialId}
            initialType={modals.noteType}
            initialSide={modals.noteSide || 'Sales'}
            readOnly={!permissions.canSave || mobileViewOnly}
         />
         <JournalEntryModal
            isOpen={modals.journal}
            onClose={() => setModals(prev => ({ ...prev, journal: false }))}
         />
         <ContraVoucherModal
            isOpen={modals.contraVoucher}
            onClose={() => setModals(prev => ({ ...prev, contraVoucher: false }))}
         />
         <TdsEntryModal
            isOpen={modals.tdsEntry}
            onClose={() => setModals(prev => ({ ...prev, tdsEntry: false }))}
         />
         <CompanySettingsModal
            isOpen={modals.companySettings}
            onClose={() => setModals(prev => ({ ...prev, companySettings: false }))}
            initialTab={modals.settingsTab}
            initialBillType={modals.settingsBillType}
            onAction={(action) => {
               if (action === 'books') toggleModal('bookMaster', true);
               else if (action === 'automation' && showDevTools()) setModals(prev => ({ ...prev, automationEngine: true }));
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
            onClose={() => setModals(prev => ({ ...prev, reportsHub: false, reportsLeafId: null }))}
            initialTab={modals.reportsTab}
            initialLeafId={modals.reportsLeafId}
            popupOnly={Boolean(modals.reportsLeafId)}
            onOpenExternal={(ext) => {
               setModals(prev => ({ ...prev, reportsHub: false, reportsLeafId: null }));
               if (ext === 'gstReports') toggleModal('gstReports', true);
               else if (ext === 'gstr1') toggleModal('gstr1', true);
               else toggleModal(ext, true);
            }}
         />

         <FailedSyncModal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
         <ErpWindowDockTray />
         <PwaInstallPrompt />
         <ErpKeyboardHintBar
            className="erp-shell-kbd-fixed"
            items={[
               ...APP_KEYBOARD_HINTS,
               { keys: 'Ctrl+S', label: 'Sales' },
               { keys: 'Alt+P', label: 'Purchase' },
               { keys: 'Alt+R', label: 'Reports' },
               { keys: 'Alt+L', label: 'Ledger' },
               { keys: 'Alt+B', label: 'Receipt' },
               { keys: 'Alt+Y', label: 'Payment' },
               { keys: 'Alt+M', label: 'Mill' },
               { keys: 'Alt+G', label: 'GSTR-1' },
               { keys: 'Alt+O', label: 'Outstanding' },
            ]}
         />

      </div>
   );
};

export default Dashboard;
