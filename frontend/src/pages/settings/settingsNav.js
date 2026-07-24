import {
  Palette, FileText, Building2, Users, Receipt, Bell, Sliders, LayoutGrid, Columns, ToggleLeft, Tags,
  MapPin, Landmark, Calendar, Paintbrush, UserCircle, Package, Wallet, CreditCard, Shield, BarChart3,
  Zap, BookOpen, Scale, Boxes, Wifi, Printer,
} from 'lucide-react';

export const BILL_MODULES = [
  { key: 'sales', label: 'Sales Billing' },
  { key: 'purchase', label: 'Purchase Bill' },
  { key: 'millIssue', label: 'Mill Issue' },
  { key: 'millReceive', label: 'Mill Receive' },
  { key: 'jobIssue', label: 'Job Issue' },
  { key: 'jobReceive', label: 'Job Receive' },
];

export const BILL_TAB_IDS = new Set(BILL_MODULES.map((m) => m.key));

export const FORM_MODULES = [
  { id: 'formParty', formKey: 'account.master', label: 'Party Master', icon: UserCircle },
  { id: 'formItem', formKey: 'item.master', label: 'Item Master', icon: Package },
  { id: 'formReceipt', formKey: 'accounting.receipt', label: 'Bank Receipt', icon: Wallet },
  { id: 'formPayment', formKey: 'accounting.payment', label: 'Bank Payment', icon: CreditCard },
];

export const FORM_TAB_MAP = Object.fromEntries(FORM_MODULES.map((f) => [f.id, f.formKey]));

export const SETTINGS_TAB_IDS = new Set([
  'companyInfo', 'address', 'gst', 'financial', 'branding',
  'vouchers', 'custom', 'notifications', 'offline',
  'company', // legacy alias
]);

export const ACTION_TABS = {
  shortcutBooks: 'books',
  shortcutAutomation: 'automation',
  shortcutOpeningBalance: 'openingBalance',
  shortcutOpeningStock: 'openingStock',
};

export const NAV_SECTIONS = [
  {
    title: 'General',
    items: [
      { id: 'appearance', label: 'Theme', icon: Palette },
      { id: 'companyInfo', label: 'Company Info', icon: Building2 },
      { id: 'address', label: 'Address', icon: MapPin },
      { id: 'gst', label: 'GST & Tax', icon: Landmark },
      { id: 'financial', label: 'Financial Year', icon: Calendar },
      { id: 'branding', label: 'Branding & Logo', icon: Paintbrush },
    ],
  },
  {
    title: 'Bill / Challan Fields',
    items: BILL_MODULES.map((m) => ({ id: m.key, label: m.label, icon: FileText })),
  },
  {
    title: 'Master Form Fields',
    items: FORM_MODULES.map(({ id, label, icon }) => ({ id, label, icon })),
  },
  {
    title: 'System Setup',
    items: [
      { id: 'moduleFields', label: 'Module Field Flags', icon: Sliders },
      { id: 'vouchers', label: 'Vouchers & Print', icon: Receipt },
      { id: 'print', label: 'Bill Print Layout', icon: Printer },
      { id: 'modules', label: 'Modules & Menus', icon: LayoutGrid },
      { id: 'columns', label: 'List Columns', icon: Columns },
      { id: 'features', label: 'Feature Switches', icon: ToggleLeft },
      { id: 'custom', label: 'Custom Field Labels', icon: Tags },
      { id: 'notifications', label: 'Quick Alerts', icon: Bell },
      { id: 'notificationRules', label: 'Notification Rules', icon: Bell },
      { id: 'reports', label: 'Reports Setup', icon: BarChart3 },
      { id: 'permissions', label: 'Role Permissions', icon: Shield },
      { id: 'users', label: 'Users & Roles', icon: Users },
    ],
  },
  {
    title: 'Quick Links',
    items: [
      { id: 'shortcutBooks', label: 'Book Master', icon: BookOpen },
      { id: 'shortcutAutomation', label: 'Automation Engine', icon: Zap },
      { id: 'shortcutOpeningBalance', label: 'Opening Balance', icon: Scale },
      { id: 'shortcutOpeningStock', label: 'Opening Stock', icon: Boxes },
      { id: 'offline', label: 'Offline & Sync', icon: Wifi },
    ],
  },
];

export const TAB_COUNT = NAV_SECTIONS.reduce((n, s) => n + s.items.length, 0);

export const resolveInitialTab = (tab, billType) => {
  if (tab === 'fields') return billType || 'sales';
  if (tab === 'company') return 'companyInfo';
  return tab || 'appearance';
};

export const MODULE_FIELD_LABELS = {
  sales: {
    broker: 'Broker field on sales',
    challan: 'Challan reference',
    bale: 'Bale count',
    weight: 'Weight field',
    lrNo: 'LR / transport no.',
  },
  purchase: {
    broker: 'Broker field on purchase',
    discount2: 'Second discount (DIS2)',
    lrNo: 'LR / transport no.',
    vehicleNo: 'Vehicle number',
    extraCharges: 'Extra charges row',
  },
  jobWork: {
    processType: 'Process type',
    ratePerMeter: 'Rate per meter',
    wastage: 'Wastage %',
  },
  accounting: {
    splitPayment: 'Split payment rows',
    chequeNo: 'Cheque number',
    utrNo: 'UTR / reference no.',
  },
};

export const PERMISSION_ACTIONS = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport', 'canPrint'];

export const PERMISSION_ACTION_LABELS = {
  canView: 'View',
  canCreate: 'Create',
  canEdit: 'Edit',
  canDelete: 'Delete',
  canExport: 'Export',
  canPrint: 'Print',
};
