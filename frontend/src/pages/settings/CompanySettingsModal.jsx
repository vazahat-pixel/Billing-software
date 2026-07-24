import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import ThemePicker from '../../components/ui/ThemePicker';
import UserRightsPanel from './UserRightsPanel';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import { configApi } from '../../api';
import { useConfig } from '../../context/ConfigContext';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { InlineLoader } from '../../components/ui/loaders';
import { Save, ChevronDown, ChevronUp, Sliders, ExternalLink } from 'lucide-react';
import {
  BILL_MODULES,
  BILL_TAB_IDS,
  FORM_MODULES,
  FORM_TAB_MAP,
  NAV_SECTIONS,
  SETTINGS_TAB_IDS,
  ACTION_TABS,
  TAB_COUNT,
  resolveInitialTab,
  MODULE_FIELD_LABELS,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
} from './settingsNav';

const COLUMN_TABLES = [
  { key: 'records.sales', label: 'Sales Invoice List' },
  { key: 'records.purchases', label: 'Purchase Bill List' },
  { key: 'records.inventory', label: 'Inventory Lots List' },
];

const MODULE_LABELS = {
  sales: 'Sales',
  purchase: 'Purchase',
  jobWork: 'Job Work / Mill',
  accounting: 'Accounting',
  gst: 'GST & Compliance',
  inventory: 'Inventory',
  reports: 'Reports',
  masters: 'Masters',
  utilities: 'Utilities',
};

const SECTIONS = [
  { id: 'header', label: 'Header Fields', prop: 'headerFields' },
  { id: 'line', label: 'Line / Grid Columns', prop: 'lineColumns' },
  { id: 'footer', label: 'Footer Fields', prop: 'footerFields' },
];

const FY_OPTIONS = [
  { value: '2024-25', label: '2024-25' },
  { value: '2025-26', label: '2025-26' },
  { value: '2026-27', label: '2026-27' },
];

const GST_SCHEME_OPTIONS = [
  { value: 'Regular (Monthly)', label: 'Regular (Monthly)' },
  { value: 'Composition', label: 'Composition' },
  { value: 'Quarterly', label: 'Quarterly' },
];

const CURRENCY_OPTIONS = [
  { value: 'INR (₹)', label: 'INR (₹)' },
  { value: 'USD ($)', label: 'USD ($)' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'sales', label: 'Sales Staff' },
  { value: 'viewer', label: 'Viewer' },
];

const PRINT_TEMPLATES = [
  { value: 'gst-formal', label: 'GST Formal (Professional)' },
  { value: 'classic-ledger', label: 'Classic Ledger' },
  { value: 'corporate-minimal', label: 'Corporate Minimal' },
  { value: 'gold-letterhead', label: 'Gold Letterhead' },
  { value: 'festive-edition', label: 'Festive Edition' },
  { value: 'compact-thermal', label: 'Compact Thermal' },
  // legacy aliases kept for older saved configs
  { value: 'classic', label: 'Classic (legacy → Ledger)' },
  { value: 'compact', label: 'Compact (legacy → Thermal)' },
  { value: 'modern', label: 'Modern (legacy → Corporate)' },
];

const emptySettings = () => ({
  legalName: '', shortName: '', gstin: '', pan: '', tan: '', phone: '', email: '', website: '',
  address: '', city: '', state: '', pincode: '', stateCode: '', financialYear: '2025-26',
  gstScheme: 'Regular (Monthly)', currency: 'INR (₹)', dateFormat: 'DD/MM/YYYY',
  tdsEnabled: false, tcsEnabled: false, eway: false, eInvoice: false, businessType: 'Textile',
  invoicePrefix: 'INV', purchasePrefix: 'PUR', challanPrefix: 'CHL', receiptPrefix: 'RCP',
  paymentPrefix: 'PAY', autoVoucherNo: true, notifyExpiry: true, notifyLowStock: false,
  notifyOverdue: true, showLogo: true, printWatermark: false, primaryColor: '', logoUrl: '',
  offlineModeEnabled: false,
  bankName: '', accountName: '', accountNo: '', ifsc: '', bankBranch: '', upiId: '',
  invoiceTerms: '', invoiceTemplateId: 'gst-formal',
  autoFestiveTheme: false, showFestivalGreeting: false,
  customField1Label: '', customField2Label: '', customField3Label: '',
});

const needsSettingsLoad = (tab) => {
  const id = tab === 'company' ? 'companyInfo' : tab;
  return SETTINGS_TAB_IDS.has(id) || id === 'offline';
};

const SaveBar = ({ onSave, saving, loading, canEdit, label = 'Save' }) =>
  canEdit ? (
    <button type="button" onClick={onSave} disabled={saving || loading} className="erp-btn erp-btn-primary h-8 px-4 text-[11px] gap-1.5 shrink-0">
      <Save size={12} /> {saving ? <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</> : label}
    </button>
  ) : null;

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
      checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);

const FieldRow = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="text-[10px] font-semibold text-[var(--text-muted)] block mb-1">{label}</label>
    {children}
  </div>
);

const PanelHeader = ({ title, subtitle, onSave, saving, loading, canEdit, saveLabel }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {subtitle && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
    </div>
    {onSave && <SaveBar onSave={onSave} saving={saving} loading={loading} canEdit={canEdit} label={saveLabel} />}
  </div>
);

const ViewOnlyBanner = ({ canEdit }) =>
  !canEdit ? (
    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      View only — Owner/Admin can edit.
    </p>
  ) : null;

const CompanySettingsModal = ({ isOpen, onClose, initialTab = 'appearance', initialBillType = 'sales', onAction }) => {
  const { user } = useStore();
  const { refreshConfig, bundle } = useConfig();
  const canEdit = ['owner', 'admin'].includes(user?.companyRole || 'owner') || user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState(() => resolveInitialTab(initialTab, initialBillType));
  const [billConfig, setBillConfig] = useState(null);
  const [formConfig, setFormConfig] = useState(null);
  const [settings, setSettings] = useState(emptySettings);
  const [moduleConfig, setModuleConfig] = useState({ modules: {}, subMenus: {}, fields: {} });
  const [columnConfig, setColumnConfig] = useState(null);
  const [columnTableKey, setColumnTableKey] = useState('records.sales');
  const [featureFlags, setFeatureFlags] = useState([]);
  const [reports, setReports] = useState([]);
  const [notificationRules, setNotificationRules] = useState([]);
  const [permissions, setPermissions] = useState({ roles: {}, sections: {} });
  const [permissionRole, setPermissionRole] = useState('admin');
  const [printBillType, setPrintBillType] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState('header');
  const bundleRef = useRef(bundle);
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);

  useEffect(() => {
    if (!isOpen) {
      settingsLoadedRef.current = false;
      setSettings(emptySettings());
    }
  }, [isOpen]);

  const isBillTab = BILL_TAB_IDS.has(activeTab);
  const formKey = FORM_TAB_MAP[activeTab];
  const isFormTab = Boolean(formKey);
  const billLabel = BILL_MODULES.find((b) => b.key === activeTab)?.label;
  const formLabel = FORM_MODULES.find((f) => f.id === activeTab)?.label;

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(resolveInitialTab(initialTab, initialBillType));
    setExpanded('header');
  }, [isOpen, initialTab, initialBillType]);

  const loadBill = useCallback(async () => {
    if (!isOpen || (!isBillTab && activeTab !== 'print')) return;
    const billType = activeTab === 'print' ? printBillType : activeTab;
    setLoading(true);
    try {
      const data = await configApi.billConfig(billType);
      setBillConfig(data);
    } catch {
      const fallback = bundle?.bills?.[billType];
      setBillConfig(fallback || null);
      if (!fallback) toast.error('Failed to load bill field settings');
    } finally {
      setLoading(false);
    }
  }, [isOpen, isBillTab, activeTab, printBillType, bundle]);

  const loadForm = useCallback(async () => {
    if (!isOpen || !isFormTab) return;
    setLoading(true);
    try {
      setFormConfig(await configApi.formConfig(formKey));
    } catch {
      const fallback = bundle?.forms?.[formKey];
      setFormConfig(fallback || null);
      if (!fallback) toast.error('Failed to load form settings');
    } finally {
      setLoading(false);
    }
  }, [isOpen, isFormTab, formKey, bundle]);

  const loadSettings = useCallback(async () => {
    if (!isOpen || !needsSettingsLoad(activeTab)) return;
    if (settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    setLoading(true);
    try {
      const data = await configApi.getSettings();
      setSettings({ ...emptySettings(), ...data });
    } catch {
      setSettings({ ...emptySettings(), ...(bundleRef.current?.companySettings || {}) });
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeTab]);

  const loadModules = useCallback(async () => {
    if (!isOpen || !['modules', 'moduleFields'].includes(activeTab)) return;
    setLoading(true);
    try {
      const data = await configApi.getModules();
      setModuleConfig(data);
    } catch {
      setModuleConfig({
        modules: bundle?.modules || {},
        subMenus: bundle?.subMenus || {},
        fields: bundle?.moduleFields || {},
      });
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeTab, bundle]);

  const loadColumns = useCallback(async () => {
    if (!isOpen || activeTab !== 'columns') return;
    setLoading(true);
    try {
      const list = await configApi.listColumns();
      const found = list.find((c) => c.tableKey === columnTableKey) || list[0];
      setColumnConfig(found || { tableKey: columnTableKey, columns: [] });
      if (found?.tableKey) setColumnTableKey(found.tableKey);
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeTab, columnTableKey]);

  const loadFeatures = useCallback(async () => {
    if (!isOpen || activeTab !== 'features') return;
    setLoading(true);
    try {
      setFeatureFlags(await configApi.listFeatures());
    } catch {
      const flags = bundle?.featureFlags || {};
      setFeatureFlags(Object.entries(flags).map(([flagKey, enabled]) => ({ flagKey, enabled, label: flagKey })));
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeTab, bundle]);

  const loadReports = useCallback(async () => {
    if (!isOpen || activeTab !== 'reports') return;
    setLoading(true);
    try {
      setReports(await configApi.listReports());
    } catch {
      setReports(bundle?.reports || []);
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeTab, bundle]);

  const loadNotificationRules = useCallback(async () => {
    if (!isOpen || activeTab !== 'notificationRules') return;
    setLoading(true);
    try {
      setNotificationRules(await configApi.listNotifications());
    } catch {
      setNotificationRules(bundle?.notificationRules || []);
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeTab, bundle]);

  const loadPermissions = useCallback(async () => {
    if (!isOpen || activeTab !== 'permissions') return;
    setLoading(true);
    try {
      setPermissions(await configApi.getPermissions());
    } catch {
      setPermissions(bundle?.permissions || { roles: {}, sections: {} });
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeTab, bundle]);

  useEffect(() => { loadBill(); }, [loadBill]);
  useEffect(() => { loadForm(); }, [loadForm]);
  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadModules(); }, [loadModules]);
  useEffect(() => { loadColumns(); }, [loadColumns]);
  useEffect(() => { loadFeatures(); }, [loadFeatures]);
  useEffect(() => { loadReports(); }, [loadReports]);
  useEffect(() => { loadNotificationRules(); }, [loadNotificationRules]);
  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  useEffect(() => {
    if (activeTab !== 'columns') return;
    configApi.listColumns().then((list) => {
      const found = list.find((c) => c.tableKey === columnTableKey);
      if (found) setColumnConfig(found);
    }).catch(() => {});
  }, [columnTableKey, activeTab]);

  const submenuEntries = useMemo(() => {
    const entries = [];
    Object.entries(moduleConfig.subMenus || {}).forEach(([mod, items]) => {
      if (typeof items !== 'object') return;
      Object.entries(items).forEach(([label, enabled]) => {
        entries.push({ mod, label, enabled: enabled !== false });
      });
    });
    return entries;
  }, [moduleConfig.subMenus]);

  const toggleField = (config, setConfig, sectionProp, index) => {
    setConfig((prev) => {
      const arr = [...(prev[sectionProp] || prev.fields || [])];
      const key = sectionProp === 'fields' ? 'fields' : sectionProp;
      const list = key === 'fields' ? [...(prev.fields || [])] : [...(prev[sectionProp] || [])];
      list[index] = { ...list[index], visible: !list[index].visible };
      return key === 'fields' ? { ...prev, fields: list } : { ...prev, [sectionProp]: list };
    });
  };

  const handleSaveFields = async () => {
    if (!billConfig || !canEdit) return;
    const billType = activeTab === 'print' ? printBillType : activeTab;
    if (!BILL_TAB_IDS.has(billType) && activeTab !== 'print') return;
    setSaving(true);
    try {
      await configApi.saveBillConfig(billType, {
        label: billConfig.label,
        headerFields: billConfig.headerFields,
        lineColumns: billConfig.lineColumns,
        footerFields: billConfig.footerFields,
        calculations: billConfig.calculations,
        printTemplate: billConfig.printTemplate,
      });
      await refreshConfig();
      toast.success(`${billLabel || 'Bill'} settings saved`);
    } catch (err) {
      toast.error(err, { fallback: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveForm = async () => {
    if (!formConfig || !canEdit || !formKey) return;
    setSaving(true);
    try {
      await configApi.saveFormConfig(formKey, {
        label: formConfig.label,
        module: formConfig.module,
        fields: formConfig.fields,
      });
      await refreshConfig();
      toast.success(`${formLabel} fields saved`);
    } catch (err) {
      toast.error(err, { fallback: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await configApi.saveSettings(settings);
      await refreshConfig();
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err, { fallback: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModules = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await configApi.saveModules(moduleConfig);
      await refreshConfig();
      toast.success('Module settings saved — refresh page to see menu changes');
    } catch (err) {
      toast.error(err, { fallback: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveColumns = async () => {
    if (!columnConfig || !canEdit) return;
    setSaving(true);
    try {
      await configApi.saveColumns(columnConfig.tableKey, columnConfig);
      await refreshConfig();
      toast.success('List columns saved');
    } catch (err) {
      toast.error(err, { fallback: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeature = async (flag) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await configApi.saveFeature(flag.flagKey, flag);
      await refreshConfig();
      toast.success(`${flag.label || flag.flagKey} updated`);
    } catch (err) {
      toast.error(err, { fallback: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await configApi.savePermissions(permissions);
      await refreshConfig();
      toast.success('Role permissions saved');
    } catch (err) {
      toast.error(err, { fallback: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const setSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const renderFieldList = (config, setConfig, sections, title, onSave, saveLabel) => (
    <div className="space-y-4">
      <PanelHeader title={title} subtitle="Toggle fields visible on this form." onSave={onSave} saving={saving} loading={loading} canEdit={canEdit} saveLabel={saveLabel} />
      <ViewOnlyBanner canEdit={canEdit} />
      {loading && <InlineLoader message="Loading fields…" />}
      {!loading && config && sections.map((sec) => {
        const fields = sec.prop === 'fields' ? (config.fields || []) : (config[sec.prop] || []);
        if (!fields.length) return null;
        const open = expanded === sec.id;
        return (
          <div key={sec.id} className="erp-card overflow-hidden">
            <button type="button" onClick={() => setExpanded(open ? '' : sec.id)} className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--bg-subtle)]">
              <span className="text-[12px] font-semibold">{sec.label}</span>
              <span className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                {fields.filter((f) => f.visible !== false).length}/{fields.length}
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {open && (
              <div className="border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                {fields.map((field, idx) => (
                  <div key={field.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-[11px] font-medium">{field.label}{field.required && <span className="ml-1 text-[9px] text-rose-500">REQ</span>}</p>
                      <p className="text-[9px] text-[var(--text-muted)] font-mono">{field.key}</p>
                    </div>
                    <Toggle
                      checked={field.visible !== false}
                      onChange={() => toggleField(config, setConfig, sec.prop, idx)}
                      disabled={!canEdit || field.required}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderCompanyInfo = () => (
    <div className="space-y-4">
      <PanelHeader title="Company Info" subtitle="Basic identity used across the ERP." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Legal Name"><ERPInput className="w-full" value={settings.legalName} onChange={(e) => setSetting('legalName', e.target.value)} disabled={!canEdit} /></FieldRow>
          <FieldRow label="Short Name"><ERPInput className="w-full" value={settings.shortName} onChange={(e) => setSetting('shortName', e.target.value)} disabled={!canEdit} /></FieldRow>
          <FieldRow label="Phone"><ERPInput className="w-full" value={settings.phone} onChange={(e) => setSetting('phone', e.target.value)} disabled={!canEdit} /></FieldRow>
          <FieldRow label="Email"><ERPInput type="email" className="w-full" value={settings.email} onChange={(e) => setSetting('email', e.target.value)} disabled={!canEdit} /></FieldRow>
          <FieldRow label="Business Type"><ERPInput className="w-full" value={settings.businessType} onChange={(e) => setSetting('businessType', e.target.value)} disabled={!canEdit} /></FieldRow>
        </div>
      )}
    </div>
  );

  const renderAddress = () => (
    <div className="space-y-4">
      <PanelHeader title="Address" subtitle="Billing & correspondence address." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Address" className="sm:col-span-2"><ERPInput className="w-full" value={settings.address} onChange={(e) => setSetting('address', e.target.value)} disabled={!canEdit} /></FieldRow>
          <FieldRow label="City"><ERPInput className="w-full" value={settings.city} onChange={(e) => setSetting('city', e.target.value)} disabled={!canEdit} /></FieldRow>
          <FieldRow label="State"><ERPInput className="w-full" value={settings.state} onChange={(e) => setSetting('state', e.target.value)} disabled={!canEdit} /></FieldRow>
          <FieldRow label="State Code"><ERPInput className="w-full" value={settings.stateCode || ''} onChange={(e) => setSetting('stateCode', e.target.value)} disabled={!canEdit} placeholder="e.g. 24" /></FieldRow>
          <FieldRow label="Pincode"><ERPInput className="w-full" value={settings.pincode} onChange={(e) => setSetting('pincode', e.target.value)} disabled={!canEdit} /></FieldRow>
        </div>
      )}
    </div>
  );

  const renderGst = () => (
    <div className="space-y-4">
      <PanelHeader title="GST & Tax" subtitle="Tax registration and compliance switches." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="GSTIN"><ERPInput className="w-full" value={settings.gstin} onChange={(e) => setSetting('gstin', e.target.value)} disabled={!canEdit} /></FieldRow>
            <FieldRow label="PAN"><ERPInput className="w-full" value={settings.pan} onChange={(e) => setSetting('pan', e.target.value)} disabled={!canEdit} /></FieldRow>
            <FieldRow label="TAN"><ERPInput className="w-full" value={settings.tan} onChange={(e) => setSetting('tan', e.target.value)} disabled={!canEdit} /></FieldRow>
            <FieldRow label="GST Scheme"><ERPSelect className="w-full" value={settings.gstScheme} onChange={(e) => setSetting('gstScheme', e.target.value)} options={GST_SCHEME_OPTIONS} disabled={!canEdit} /></FieldRow>
          </div>
          <div className="erp-card divide-y divide-[var(--border-subtle)]">
            {[
              { key: 'tdsEnabled', label: 'TDS enabled' },
              { key: 'tcsEnabled', label: 'TCS enabled' },
              { key: 'eway', label: 'E-Way Bill' },
              { key: 'eInvoice', label: 'E-Invoice' },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between px-4 py-3">
                <span className="text-[11px] font-medium">{row.label}</span>
                <Toggle checked={!!settings[row.key]} onChange={(v) => setSetting(row.key, v)} disabled={!canEdit} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderFinancial = () => (
    <div className="space-y-4">
      <PanelHeader title="Financial Year" subtitle="Default period & display formats." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
          <FieldRow label="Financial Year"><ERPSelect className="w-full" value={settings.financialYear} onChange={(e) => setSetting('financialYear', e.target.value)} options={FY_OPTIONS} disabled={!canEdit} /></FieldRow>
          <FieldRow label="Currency"><ERPSelect className="w-full" value={settings.currency} onChange={(e) => setSetting('currency', e.target.value)} options={CURRENCY_OPTIONS} disabled={!canEdit} /></FieldRow>
          <FieldRow label="Date Format"><ERPSelect className="w-full" value={settings.dateFormat} onChange={(e) => setSetting('dateFormat', e.target.value)} options={DATE_FORMAT_OPTIONS} disabled={!canEdit} /></FieldRow>
        </div>
      )}
    </div>
  );

  const renderBranding = () => (
    <div className="space-y-4">
      <PanelHeader title="Branding & Logo" subtitle="Print & portal appearance." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="Website"><ERPInput className="w-full" value={settings.website} onChange={(e) => setSetting('website', e.target.value)} disabled={!canEdit} placeholder="https://" /></FieldRow>
            <FieldRow label="Logo URL"><ERPInput className="w-full" value={settings.logoUrl} onChange={(e) => setSetting('logoUrl', e.target.value)} disabled={!canEdit} placeholder="https://…/logo.png" /></FieldRow>
            <FieldRow label="Primary Color"><ERPInput className="w-full" value={settings.primaryColor} onChange={(e) => setSetting('primaryColor', e.target.value)} disabled={!canEdit} placeholder="#292524" /></FieldRow>
            <FieldRow label="Default Invoice Template">
              <ERPSelect
                className="w-full"
                value={settings.invoiceTemplateId || 'gst-formal'}
                onChange={(e) => setSetting('invoiceTemplateId', e.target.value)}
                options={PRINT_TEMPLATES.filter((t) =>
                  ['gst-formal', 'classic-ledger', 'corporate-minimal', 'gold-letterhead', 'festive-edition', 'compact-thermal'].includes(t.value)
                )}
                disabled={!canEdit}
              />
            </FieldRow>
            <div className="flex items-center justify-between py-2">
              <span className="text-[11px] font-medium">Show logo on print</span>
              <Toggle checked={!!settings.showLogo} onChange={(v) => setSetting('showLogo', v)} disabled={!canEdit} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[11px] font-medium">Auto festive invoice theme</span>
              <Toggle checked={!!settings.autoFestiveTheme} onChange={(v) => setSetting('autoFestiveTheme', v)} disabled={!canEdit} />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[11px] font-medium">Show festival greeting on invoices</span>
              <Toggle checked={!!settings.showFestivalGreeting} onChange={(v) => setSetting('showFestivalGreeting', v)} disabled={!canEdit} />
            </div>
          </div>

          <div className="erp-card p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Bank & UPI (invoice print)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldRow label="Account Name"><ERPInput className="w-full" value={settings.accountName || ''} onChange={(e) => setSetting('accountName', e.target.value)} disabled={!canEdit} /></FieldRow>
              <FieldRow label="Bank Name"><ERPInput className="w-full" value={settings.bankName || ''} onChange={(e) => setSetting('bankName', e.target.value)} disabled={!canEdit} /></FieldRow>
              <FieldRow label="Account No."><ERPInput className="w-full" value={settings.accountNo || ''} onChange={(e) => setSetting('accountNo', e.target.value)} disabled={!canEdit} /></FieldRow>
              <FieldRow label="IFSC"><ERPInput className="w-full" value={settings.ifsc || ''} onChange={(e) => setSetting('ifsc', e.target.value)} disabled={!canEdit} /></FieldRow>
              <FieldRow label="Branch"><ERPInput className="w-full" value={settings.bankBranch || ''} onChange={(e) => setSetting('bankBranch', e.target.value)} disabled={!canEdit} /></FieldRow>
              <FieldRow label="UPI ID"><ERPInput className="w-full" value={settings.upiId || ''} onChange={(e) => setSetting('upiId', e.target.value)} disabled={!canEdit} placeholder="business@upi" /></FieldRow>
            </div>
            <FieldRow label="Invoice Terms & Conditions">
              <textarea
                className="erp-input w-full min-h-[72px] text-[11px] p-2"
                value={settings.invoiceTerms || ''}
                onChange={(e) => setSetting('invoiceTerms', e.target.value)}
                disabled={!canEdit}
                placeholder="Shown on printed invoices…"
              />
            </FieldRow>
          </div>
        </div>
      )}
    </div>
  );

  const renderVouchers = () => (
    <div className="space-y-4">
      <PanelHeader title="Vouchers & Print" subtitle="Bill prefixes & print options." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ['invoicePrefix', 'Sales Invoice Prefix'],
            ['purchasePrefix', 'Purchase Prefix'],
            ['challanPrefix', 'Challan Prefix'],
            ['receiptPrefix', 'Receipt Prefix'],
            ['paymentPrefix', 'Payment Prefix'],
          ].map(([k, label]) => (
            <FieldRow key={k} label={label}><ERPInput className="w-full" value={settings[k]} onChange={(e) => setSetting(k, e.target.value)} disabled={!canEdit} /></FieldRow>
          ))}
          {[
            ['autoVoucherNo', 'Auto Voucher Number'],
            ['printWatermark', 'Print Watermark'],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between py-2">
              <span className="text-[11px] font-medium">{label}</span>
              <Toggle checked={!!settings[k]} onChange={(v) => setSetting(k, v)} disabled={!canEdit} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPrint = () => (
    <div className="space-y-4">
      <PanelHeader title="Bill Print Layout" subtitle="Print template per bill type." onSave={handleSaveFields} saving={saving} loading={loading} canEdit={canEdit} saveLabel="Save Print" />
      <div className="flex flex-wrap gap-1.5">
        {BILL_MODULES.map((b) => (
          <button key={b.key} type="button" onClick={() => setPrintBillType(b.key)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold ${printBillType === b.key ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'}`}>
            {b.label}
          </button>
        ))}
      </div>
      {loading ? <InlineLoader /> : billConfig && (
        <div className="erp-card p-4 space-y-3 max-w-md">
          <FieldRow label="Print Template">
            <ERPSelect
              className="w-full"
              value={billConfig.printTemplate?.templateId || 'classic'}
              onChange={(e) => setBillConfig((prev) => ({
                ...prev,
                printTemplate: { ...(prev.printTemplate || {}), templateId: e.target.value },
              }))}
              options={PRINT_TEMPLATES}
              disabled={!canEdit}
            />
          </FieldRow>
          {[
            ['showLogo', 'Show logo on this bill'],
            ['watermark', 'Show watermark'],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[11px] font-medium">{label}</span>
              <Toggle
                checked={!!billConfig.printTemplate?.[k]}
                onChange={(v) => setBillConfig((prev) => ({
                  ...prev,
                  printTemplate: { ...(prev.printTemplate || {}), [k]: v },
                }))}
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderModuleFields = () => (
    <div className="space-y-4">
      <PanelHeader title="Module Field Flags" subtitle="Quick toggles for optional fields in modules." onSave={handleSaveModules} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        Object.entries(MODULE_FIELD_LABELS).map(([mod, fields]) => (
          <div key={mod} className="erp-card divide-y divide-[var(--border-subtle)]">
            <p className="px-4 py-2 text-[10px] font-semibold uppercase text-[var(--text-muted)]">{MODULE_LABELS[mod] || mod}</p>
            {Object.entries(fields).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[11px] font-medium">{label}</span>
                <Toggle
                  checked={moduleConfig.fields?.[mod]?.[key] !== false}
                  onChange={(v) => setModuleConfig((mc) => ({
                    ...mc,
                    fields: { ...mc.fields, [mod]: { ...(mc.fields?.[mod] || {}), [key]: v } },
                  }))}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );

  const renderModules = () => (
    <div className="space-y-4">
      <PanelHeader title="Modules & Menus" subtitle="Show/hide modules and menu items." onSave={handleSaveModules} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <>
          <div className="erp-card divide-y divide-[var(--border-subtle)]">
            <p className="px-4 py-2 text-[10px] font-semibold uppercase text-[var(--text-muted)]">Main Modules</p>
            {Object.entries(moduleConfig.modules || {}).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[11px] font-medium">{MODULE_LABELS[key] || key}</span>
                <Toggle checked={enabled !== false} onChange={(v) => setModuleConfig((mc) => ({ ...mc, modules: { ...mc.modules, [key]: v } }))} disabled={!canEdit} />
              </div>
            ))}
          </div>
          <div className="erp-card divide-y divide-[var(--border-subtle)] max-h-64 overflow-y-auto">
            <p className="px-4 py-2 text-[10px] font-semibold uppercase text-[var(--text-muted)] sticky top-0 bg-[var(--bg-card)]">Menu Items</p>
            {submenuEntries.map(({ mod, label, enabled }) => (
              <div key={`${mod}-${label}`} className="flex items-center justify-between px-4 py-2">
                <span className="text-[11px]"><span className="text-[var(--text-muted)]">{MODULE_LABELS[mod] || mod} →</span> {label}</span>
                <Toggle checked={enabled} onChange={(v) => setModuleConfig((mc) => ({ ...mc, subMenus: { ...mc.subMenus, [mod]: { ...(mc.subMenus?.[mod] || {}), [label]: v } } }))} disabled={!canEdit} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderColumns = () => (
    <div className="space-y-4">
      <PanelHeader title="List Columns" subtitle="Records hub table columns." onSave={handleSaveColumns} saving={saving} loading={loading} canEdit={canEdit} />
      <div className="flex flex-wrap gap-1.5">
        {COLUMN_TABLES.map((t) => (
          <button key={t.key} type="button" onClick={() => setColumnTableKey(t.key)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold ${columnTableKey === t.key ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? <InlineLoader /> : (
        <div className="erp-card divide-y divide-[var(--border-subtle)]">
          {(columnConfig?.columns || []).map((col, idx) => (
            <div key={col.key} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[11px] font-medium">{col.label} <span className="text-[9px] text-[var(--text-muted)] font-mono">({col.key})</span></span>
              <Toggle checked={col.visible !== false} onChange={() => setColumnConfig((prev) => { const cols = [...(prev.columns || [])]; cols[idx] = { ...cols[idx], visible: !cols[idx].visible }; return { ...prev, columns: cols }; })} disabled={!canEdit} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFeatures = () => (
    <div className="space-y-4">
      <PanelHeader title="Feature Switches" subtitle="Enable/disable optional ERP features." />
      {loading ? <InlineLoader /> : (
        <div className="erp-card divide-y divide-[var(--border-subtle)]">
          {featureFlags.map((flag) => (
            <div key={flag.flagKey} className="flex items-center justify-between px-4 py-2.5 gap-3">
              <div>
                <p className="text-[11px] font-medium">{flag.label || flag.flagKey}</p>
                <p className="text-[9px] text-[var(--text-muted)]">{flag.module || 'global'} · {flag.flagKey}</p>
              </div>
              <Toggle checked={flag.enabled !== false} onChange={async (v) => { const next = { ...flag, enabled: v }; setFeatureFlags((fs) => fs.map((f) => (f.flagKey === flag.flagKey ? next : f))); await handleSaveFeature(next); }} disabled={!canEdit || saving} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCustom = () => (
    <div className="space-y-4">
      <PanelHeader title="Custom Field Labels" subtitle="Extra labels on party/item forms." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <div className="grid gap-3 max-w-md">
          {[1, 2, 3].map((n) => (
            <FieldRow key={n} label={`Custom Field ${n} Label`}>
              <ERPInput className="w-full" value={settings[`customField${n}Label`]} onChange={(e) => setSetting(`customField${n}Label`, e.target.value)} disabled={!canEdit} placeholder={`e.g. Agent Code ${n}`} />
            </FieldRow>
          ))}
        </div>
      )}
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-4">
      <PanelHeader title="Quick Alerts" subtitle="Simple on/off alert toggles." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <div className="erp-card divide-y divide-[var(--border-subtle)]">
          {[
            { key: 'notifyExpiry', label: 'Licence / subscription expiry' },
            { key: 'notifyLowStock', label: 'Low stock warnings' },
            { key: 'notifyOverdue', label: 'Overdue receivable reminders' },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between px-4 py-3">
              <span className="text-[11px] font-medium">{row.label}</span>
              <Toggle checked={!!settings[row.key]} onChange={(v) => setSetting(row.key, v)} disabled={!canEdit} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNotificationRules = () => (
    <div className="space-y-4">
      <PanelHeader title="Notification Rules" subtitle="Detailed event-based notification rules." />
      {loading ? <InlineLoader /> : (
        <div className="space-y-3">
          {notificationRules.map((rule) => (
            <div key={rule.ruleKey} className="erp-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold">{rule.name || rule.ruleKey}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">Event: {rule.event}</p>
                </div>
                <Toggle
                  checked={rule.enabled !== false}
                  onChange={async (v) => {
                    const next = { ...rule, enabled: v };
                    setNotificationRules((rs) => rs.map((r) => (r.ruleKey === rule.ruleKey ? next : r)));
                    if (!canEdit) return;
                    try {
                      await configApi.saveNotification(rule.ruleKey, next);
                      await refreshConfig();
                    } catch (err) {
                      toast.error(err, { fallback: 'Save failed. Please try again.' });
                    }
                  }}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                {['inApp', 'email'].map((ch) => (
                  <label key={ch} className="flex items-center gap-2 text-[10px]">
                    <input
                      type="checkbox"
                      checked={!!rule.channels?.[ch]}
                      disabled={!canEdit}
                      onChange={async (e) => {
                        const next = { ...rule, channels: { ...(rule.channels || {}), [ch]: e.target.checked } };
                        setNotificationRules((rs) => rs.map((r) => (r.ruleKey === rule.ruleKey ? next : r)));
                        if (!canEdit) return;
                        try {
                          await configApi.saveNotification(rule.ruleKey, next);
                          await refreshConfig();
                        } catch (err) {
                          toast.error(err, { fallback: 'Save failed. Please try again.' });
                        }
                      }}
                    />
                    {ch === 'inApp' ? 'In-app' : 'Email'}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReports = () => (
    <div className="space-y-4">
      <PanelHeader title="Reports Setup" subtitle="Enable reports and export formats." />
      {loading ? <InlineLoader /> : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.reportKey} className="erp-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold">{report.name || report.reportKey}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">{report.module} · {(report.exportFormats || []).join(', ')}</p>
                </div>
                <Toggle
                  checked={report.enabled !== false}
                  onChange={async (v) => {
                    const next = { ...report, enabled: v };
                    setReports((rs) => rs.map((r) => (r.reportKey === report.reportKey ? next : r)));
                    if (!canEdit) return;
                    try {
                      await configApi.saveReport(report.reportKey, next);
                      await refreshConfig();
                    } catch (err) {
                      toast.error(err, { fallback: 'Save failed. Please try again.' });
                    }
                  }}
                  disabled={!canEdit}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPermissions = () => {
    const rolePerms = permissions.roles?.[permissionRole] || [];
    return (
      <div className="space-y-4">
        <PanelHeader title="Role Permissions" subtitle="Module access matrix per role." onSave={handleSavePermissions} saving={saving} loading={loading} canEdit={canEdit} />
        <FieldRow label="Role">
          <ERPSelect className="w-full max-w-xs" value={permissionRole} onChange={(e) => setPermissionRole(e.target.value)} options={ROLE_OPTIONS} />
        </FieldRow>
        {loading ? <InlineLoader /> : (
          <div className="erp-card overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                  <th className="text-left px-3 py-2 font-semibold">Module</th>
                  {PERMISSION_ACTIONS.map((a) => (
                    <th key={a} className="px-2 py-2 font-semibold text-center">{PERMISSION_ACTION_LABELS[a]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rolePerms.map((row, idx) => (
                  <tr key={row.module} className="border-b border-[var(--border-subtle)]">
                    <td className="px-3 py-2 font-medium">{MODULE_LABELS[row.module] || row.module}</td>
                    {PERMISSION_ACTIONS.map((action) => (
                      <td key={action} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!row[action]}
                          disabled={!canEdit}
                          onChange={(e) => {
                            setPermissions((prev) => {
                              const roles = { ...prev.roles };
                              const list = [...(roles[permissionRole] || [])];
                              list[idx] = { ...list[idx], [action]: e.target.checked };
                              roles[permissionRole] = list;
                              return { ...prev, roles };
                            });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderOffline = () => (
    <div className="space-y-4">
      <PanelHeader title="Offline & Sync" subtitle="Work without internet and sync later." onSave={handleSaveSettings} saving={saving} loading={loading} canEdit={canEdit} />
      {loading ? <InlineLoader /> : (
        <div className="erp-card px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium">Enable offline mode</p>
            <p className="text-[9px] text-[var(--text-muted)]">Allow billing when network is unavailable</p>
          </div>
          <Toggle checked={!!settings.offlineModeEnabled} onChange={(v) => setSetting('offlineModeEnabled', v)} disabled={!canEdit} />
        </div>
      )}
    </div>
  );

  const renderShortcut = (actionKey, title, description) => (
    <div className="space-y-4 max-w-md">
      <PanelHeader title={title} subtitle={description} />
      <button
        type="button"
        className="erp-btn erp-btn-primary gap-2"
        onClick={() => {
          onClose();
          onAction?.(actionKey);
        }}
      >
        <ExternalLink size={14} /> Open {title}
      </button>
    </div>
  );

  const renderContent = () => {
    if (activeTab === 'appearance') {
      return (
        <div className="space-y-4 max-w-md">
          <PanelHeader title="Theme" subtitle="Saved in this browser." />
          <ThemePicker />
        </div>
      );
    }
    if (activeTab === 'companyInfo') return renderCompanyInfo();
    if (activeTab === 'address') return renderAddress();
    if (activeTab === 'gst') return renderGst();
    if (activeTab === 'financial') return renderFinancial();
    if (activeTab === 'branding') return renderBranding();
    if (isBillTab) return renderFieldList(billConfig, setBillConfig, SECTIONS, `${billLabel} — Field Layout`, handleSaveFields, 'Save Fields');
    if (isFormTab) return renderFieldList(formConfig, setFormConfig, [{ id: 'fields', label: 'Form Fields', prop: 'fields' }], `${formLabel} — Field Layout`, handleSaveForm, 'Save Fields');
    if (activeTab === 'vouchers') return renderVouchers();
    if (activeTab === 'print') return renderPrint();
    if (activeTab === 'moduleFields') return renderModuleFields();
    if (activeTab === 'modules') return renderModules();
    if (activeTab === 'columns') return renderColumns();
    if (activeTab === 'features') return renderFeatures();
    if (activeTab === 'custom') return renderCustom();
    if (activeTab === 'notifications') return renderNotifications();
    if (activeTab === 'notificationRules') return renderNotificationRules();
    if (activeTab === 'reports') return renderReports();
    if (activeTab === 'permissions') return renderPermissions();
    if (activeTab === 'offline') return renderOffline();
    if (activeTab === 'users') return <UserRightsPanel active />;
    if (activeTab === 'shortcutBooks') return renderShortcut('books', 'Book Master', 'Manage accounting books and ledgers.');
    if (activeTab === 'shortcutAutomation') return renderShortcut('automation', 'Automation Engine', 'Business rules and automated workflows.');
    if (activeTab === 'shortcutOpeningBalance') return renderShortcut('openingBalance', 'Opening Balance', 'Set opening balances for accounts.');
    if (activeTab === 'shortcutOpeningStock') return renderShortcut('openingStock', 'Opening Stock', 'Enter opening stock quantities.');
    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Settings (${TAB_COUNT} tabs)`} className="max-w-6xl">
      <div className="flex flex-col md:flex-row min-h-[520px] max-h-[85vh]">
        <nav className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] p-2 overflow-y-auto max-h-[45vh] md:max-h-[calc(85vh-4rem)] bg-[var(--bg-subtle)]/40">
          <p className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Sliders size={11} /> Setup System · {TAB_COUNT} tabs
          </p>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-2">
              <p className="px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{section.title}</p>
              {section.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveTab(id); setExpanded('header'); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-[10px] font-semibold transition-colors ${
                    activeTab === id ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'
                  }`}
                >
                  <Icon size={13} className="shrink-0" /> <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-5">{renderContent()}</div>
      </div>
    </Modal>
  );
};

export default CompanySettingsModal;
