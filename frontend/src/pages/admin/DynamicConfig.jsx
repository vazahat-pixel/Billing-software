import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Save, RefreshCw, FileText, Columns, Flag, Shield, History,
  ChevronDown, ChevronUp, Zap, AlertCircle
} from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';
import { adminApi } from '../../api';
import { notifyError } from '../../utils/notify';

const TABS = [
  { id: 'bills', label: 'Bill Fields', icon: FileText },
  { id: 'columns', label: 'Table Columns', icon: Columns },
  { id: 'flags', label: 'Feature Flags', icon: Flag },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'logs', label: 'Change Log', icon: History }
];

const BILL_TYPES = [
  { key: 'sales', label: 'Sales Invoice' },
  { key: 'purchase', label: 'Purchase Bill' },
  { key: 'millIssue', label: 'Mill Issue' },
  { key: 'millReceive', label: 'Mill Receive' },
  { key: 'jobIssue', label: 'Job Issue' },
  { key: 'jobReceive', label: 'Job Receive' },
];

const COLUMN_TABLES = [
  { key: 'records.sales', label: 'Sales Invoice List' },
  { key: 'records.purchases', label: 'Purchase Bill List' },
  { key: 'records.inventory', label: 'Inventory Lots' }
];

const ROLES = ['owner', 'admin', 'accountant', 'sales', 'viewer'];
const PERM_ACTIONS = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport', 'canPrint'];

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}
  >
    <motion.div className="toggle-knob" animate={{ x: checked ? 16 : 2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} />
  </button>
);

const FieldRow = ({ label, sub, checked, onChange }) => (
  <div className="admin-config-field-row">
    <div>
      <p className="admin-config-field-label">{label}</p>
      {sub && <p className="admin-config-field-sub">{sub}</p>}
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const ConfigTab = ({ active, onClick, children, tone = 'blue' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`admin-config-tab admin-config-tab--${tone} ${active ? 'admin-config-tab--active' : ''}`}
  >
    {children}
  </button>
);

const DynamicConfig = () => {
  const { companies, fetchCompanies } = useAdminStore();
  const [selectedCompany, setSelectedCompany] = useState('');
  const [activeTab, setActiveTab] = useState('bills');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [billType, setBillType] = useState('sales');
  const [billConfig, setBillConfig] = useState(null);
  const [columnTable, setColumnTable] = useState('records.sales');
  const [columnConfig, setColumnConfig] = useState(null);
  const [flags, setFlags] = useState([]);
  const [permissions, setPermissions] = useState(null);
  const [permRole, setPermRole] = useState('owner');
  const [logs, setLogs] = useState([]);
  const [expandedSection, setExpandedSection] = useState('header');

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const loadBill = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const data = await adminApi.billConfig(selectedCompany, billType);
      setBillConfig(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, billType]);

  const loadColumns = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const list = await adminApi.columnConfigs(selectedCompany);
      const found = list.find((c) => c.tableKey === columnTable);
      setColumnConfig(found || { tableKey: columnTable, columns: [] });
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, columnTable]);

  const loadFlags = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const data = await adminApi.featureFlags(selectedCompany);
      setFlags(data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  const loadPermissions = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const data = await adminApi.permissions(selectedCompany);
      setPermissions(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  const loadLogs = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const data = await adminApi.configLogs(selectedCompany, { limit: 30 });
      setLogs(data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (!selectedCompany) return;
    setError('');
    if (activeTab === 'bills') loadBill();
    else if (activeTab === 'columns') loadColumns();
    else if (activeTab === 'flags') loadFlags();
    else if (activeTab === 'permissions') loadPermissions();
    else if (activeTab === 'logs') loadLogs();
  }, [selectedCompany, activeTab, billType, columnTable, loadBill, loadColumns, loadFlags, loadPermissions, loadLogs]);

  const saveBill = async () => {
    if (!billConfig) return;
    setSaving(true);
    try {
      await adminApi.saveBillConfig(selectedCompany, billType, billConfig);
      flashSaved();
    } catch (err) {
      notifyError(err, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveColumns = async () => {
    if (!columnConfig) return;
    setSaving(true);
    try {
      await adminApi.saveColumnConfig(selectedCompany, columnTable, columnConfig);
      flashSaved();
    } catch (err) {
      notifyError(err, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveFlag = async (flag) => {
    setSaving(true);
    try {
      await adminApi.saveFeatureFlag(selectedCompany, flag.flagKey, flag);
      flashSaved();
    } catch (err) {
      notifyError(err, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async () => {
    if (!permissions) return;
    setSaving(true);
    try {
      await adminApi.savePermissions(selectedCompany, permissions);
      flashSaved();
    } catch (err) {
      notifyError(err, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleBillField = (section, index) => {
    const key = section === 'header' ? 'headerFields' : section === 'footer' ? 'footerFields' : 'lineColumns';
    setBillConfig((prev) => {
      const arr = [...(prev[key] || [])];
      arr[index] = { ...arr[index], visible: !arr[index].visible };
      return { ...prev, [key]: arr };
    });
  };

  const toggleColumn = (index) => {
    setColumnConfig((prev) => {
      const arr = [...(prev.columns || [])];
      arr[index] = { ...arr[index], visible: !arr[index].visible };
      return { ...prev, columns: arr };
    });
  };

  const togglePerm = (moduleKey, action) => {
    setPermissions((prev) => {
      const roles = { ...(prev.roles || {}) };
      const rolePerms = [...(roles[permRole] || [])];
      const idx = rolePerms.findIndex((p) => p.module === moduleKey);
      if (idx >= 0) {
        rolePerms[idx] = { ...rolePerms[idx], [action]: !rolePerms[idx][action] };
      } else {
        rolePerms.push({ module: moduleKey, [action]: true });
      }
      roles[permRole] = rolePerms;
      return { ...prev, roles };
    });
  };

  const getPerm = (moduleKey, action) => {
    const rolePerms = permissions?.roles?.[permRole] || [];
    const entry = rolePerms.find((p) => p.module === moduleKey);
    return entry?.[action] ?? false;
  };

  const renderBillTab = () => {
    if (!billConfig) return <p className="admin-page-sub-inline">Loading bill config...</p>;
    const sections = [
      { id: 'header', label: 'Header Fields', fields: billConfig.headerFields },
      { id: 'line', label: 'Line Columns', fields: billConfig.lineColumns },
      { id: 'footer', label: 'Footer Fields', fields: billConfig.footerFields }
    ];

    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {BILL_TYPES.map((b) => (
            <ConfigTab key={b.key} active={billType === b.key} onClick={() => setBillType(b.key)} tone="blue">
              {b.label}
            </ConfigTab>
          ))}
        </div>

        {sections.map((sec) => (
          <div key={sec.id} className="glass-card" style={{ padding: 12, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setExpandedSection(expandedSection === sec.id ? '' : sec.id)}
              className="admin-config-section-btn"
            >
              <span>{sec.label} ({(sec.fields || []).length})</span>
              {expandedSection === sec.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSection === sec.id && (
              <div style={{ marginTop: 10 }}>
                {(sec.fields || []).map((f, i) => (
                  <FieldRow
                    key={f.key}
                    label={f.label || f.key}
                    sub={f.key}
                    checked={f.visible !== false}
                    onChange={() => toggleBillField(sec.id, i)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        <button type="button" className="admin-primary-btn" onClick={saveBill} disabled={saving}>
          {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
          {saved ? 'Saved — live in ~5s' : 'Save Bill Config'}
        </button>
      </div>
    );
  };

  const renderColumnsTab = () => {
    if (!columnConfig) return <p className="admin-page-sub-inline">Loading columns...</p>;

    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {COLUMN_TABLES.map((t) => (
            <ConfigTab key={t.key} active={columnTable === t.key} onClick={() => setColumnTable(t.key)} tone="blue">
              {t.label}
            </ConfigTab>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 12 }}>
          {(columnConfig.columns || []).map((col, i) => (
            <FieldRow
              key={col.key}
              label={col.label || col.key}
              sub={col.key}
              checked={col.visible !== false}
              onChange={() => toggleColumn(i)}
            />
          ))}
        </div>

        <button type="button" className="admin-primary-btn" style={{ marginTop: 12 }} onClick={saveColumns} disabled={saving}>
          {saving ? <RefreshCw size={13} /> : <Save size={13} />}
          {saved ? 'Saved — live in ~5s' : 'Save Column Config'}
        </button>
      </div>
    );
  };

  const renderFlagsTab = () => (
    <div className="glass-card" style={{ padding: 12 }}>
      {flags.length === 0 && <p className="admin-page-sub-inline">No feature flags. Run seed or create company.</p>}
      {flags.map((flag) => (
        <FieldRow
          key={flag.flagKey}
          label={flag.label || flag.flagKey}
          sub={`${flag.module || 'global'} • ${flag.flagKey}`}
          checked={flag.enabled !== false}
          onChange={async (val) => {
            const updated = { ...flag, enabled: val };
            setFlags((prev) => prev.map((f) => (f.flagKey === flag.flagKey ? updated : f)));
            await saveFlag(updated);
          }}
        />
      ))}
    </div>
  );

  const renderPermissionsTab = () => {
    const modules = ['sales', 'purchase', 'accounting', 'inventory', 'jobWork', 'masters', 'reports', 'gst'];
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {ROLES.map((r) => (
            <ConfigTab key={r} active={permRole === r} onClick={() => setPermRole(r)} tone="green">
              <span style={{ textTransform: 'capitalize' }}>{r}</span>
            </ConfigTab>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 12, overflowX: 'auto' }}>
          <table className="admin-config-perm-table" style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Module</th>
                {PERM_ACTIONS.map((a) => (
                  <th key={a} style={{ textAlign: 'center' }}>{a.replace('can', '')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <tr key={mod}>
                  <td>{mod}</td>
                  {PERM_ACTIONS.map((action) => (
                    <td key={action} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={getPerm(mod, action)}
                        onChange={() => togglePerm(mod, action)}
                        style={{ accentColor: '#0d9488' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" className="admin-primary-btn" style={{ marginTop: 12 }} onClick={savePermissions} disabled={saving}>
          <Save size={13} />
          {saved ? 'Saved — live in ~5s' : 'Save Permissions'}
        </button>
      </div>
    );
  };

  const renderLogsTab = () => (
    <div className="glass-card" style={{ padding: 12 }}>
      {logs.length === 0 && <p className="admin-page-sub-inline">No config changes logged yet.</p>}
      {logs.map((log) => (
        <div key={log._id} className="admin-config-field-row" style={{ fontSize: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span className="admin-config-log-title">{log.configType} / {log.configKey}</span>
              <span className="admin-page-sub-inline" style={{ margin: 0 }}>{log.action}</span>
            </div>
            <p className="admin-config-log-meta">
              v{log.version} • {log.actorId?.name || 'System'} • {new Date(log.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="admin-page-title-inline">Dynamic Config Studio</h2>
          <p className="admin-page-sub-inline">
            Bill fields, table columns, feature flags & permissions — changes sync to user panel within 5 seconds
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8 }}>
          <Zap size={12} style={{ color: '#059669' }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>Live Sync Active</span>
        </div>
      </motion.div>

      <div className="glass-card" style={{ padding: 14 }}>
        <label className="dark-input__label">Select Company</label>
        <select className="dark-input" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
          <option value="">— Choose company —</option>
          {companies.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
          <AlertCircle size={14} style={{ color: '#dc2626' }} />
          <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {selectedCompany && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <ConfigTab
                  key={tab.id}
                  active={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  tone="blue"
                >
                  <Icon size={12} />
                  {tab.label}
                </ConfigTab>
              );
            })}
          </div>

          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: 16 }}>
            {loading && <p className="admin-page-sub-inline" style={{ marginBottom: 10 }}>Loading...</p>}
            {activeTab === 'bills' && renderBillTab()}
            {activeTab === 'columns' && renderColumnsTab()}
            {activeTab === 'flags' && renderFlagsTab()}
            {activeTab === 'permissions' && renderPermissionsTab()}
            {activeTab === 'logs' && renderLogsTab()}
          </motion.div>
        </>
      )}

      {!selectedCompany && (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
          <p className="admin-page-sub-inline" style={{ fontWeight: 700, fontSize: 13 }}>Select a company to configure dynamic UI</p>
        </div>
      )}
    </div>
  );
};

export default DynamicConfig;
