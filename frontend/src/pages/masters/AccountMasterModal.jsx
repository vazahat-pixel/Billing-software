import React, { useState, useEffect, useMemo, useRef } from 'react';
import useStore from '../../store/useStore';
import Modal from '../../components/ui/Modal';
import { ERPSelect } from '../../components/forms/FormElements';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import DataImportModal from '../../components/import/DataImportModal';
import { GST_STATE_CODES } from '../../utils/gstStateCodes';

const MSME_TYPE_OPTIONS = [
  'None',
  'Manufacturing- Micro',
  'Manufacturing- Small',
  'Manufacturing- Medium',
  'Services- Micro',
  'Services- Small',
  'Services- Medium',
  'Traders- Micro',
  'Traders- Small',
  'Traders- Medium',
];

const EMPTY_ACCOUNT = {
  name: '',
  accd: '',
  connectedCode: '',
  group: 'SUNDRY DEBTORS',
  openingBalance: 0,
  openingBalanceType: 'Dr',
  agencyOpBal: 0,
  agencyDrCr: 'Dr',
  mainGroup: false,
  mainGroupId: '',
  address: '',
  address2: '',
  address3: '',
  city: '',
  pincode: '',
  phoneO: '',
  phoneR: '',
  mobile: '',
  contactPerson: '',
  hastePhone: '',
  brokerId: '',
  transport: '',
  tinCstNo: '',
  tinGstNo: '',
  pan: '',
  email: '',
  status: 'Active',
  updateInAllFirm: 'Y',
  updateInAllYear: 'N',
  aadharNo: '',
  gstin: '',
  stateCode: '24',
  stateName: '24-GUJARAT',
  gstType: 'INVOICE (IN STATE)',
  udyamAadhar: '',
  msmeType: 'None',
  msmeYear: '',
  dueDays: 0,
  creditLimit: 0,
  tdsSection: '',
  rdRate: 0,
  disc1: 0,
  disc2: 0,
  addPer: 0,
  dharaPer: 0,
  dharaType: '',
  intPer: 0,
  commi: 0,
  maxLevel: 0,
  minLevel: 0,
  tdsPer: 0,
  tcsPer: 0,
  surchargePer: 0,
  ewayPassword: '',
  nature: '',
  indexCd: '',
  alias: '',
  salesMan: '',
  areaName: '',
  haste: '',
  expCity: '',
  hsnCode: '',
  dob: '',
  ref1: '',
  ref2: '',
  ref3: '',
  ref4: '',
  factoryAddress1: '',
  factoryAddress2: '',
  factoryCity: '',
  factoryMobile: '',
  eCommerce: false,
  banks: []
};

const emptyBankRow = () => ({ name: '', accountNo: '', ifsc: '' });

const AccountMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null, readOnly = false, initialTab = 'Account', prefillBankName = '' }) => {
  const { addParty, updateParty, deleteParty, parties, fetchParties, subMasters, fetchSubMasters } = useStore();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mode, setMode] = useState('View'); // 'View', 'Add', 'Edit'
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  
  const [formData, setFormData] = useState({ ...EMPTY_ACCOUNT });
  const nameInputRef = useRef(null);
  const saveBtnRef = useRef(null);

  // Auto-focus Party Name when opened in Add mode
  useEffect(() => {
    if (isOpen && mode === 'Add') {
      const t = setTimeout(() => {
        nameInputRef.current?.focus();
        try { nameInputRef.current?.select(); } catch {}
      }, 70);
      return () => clearTimeout(t);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) {
      setBootLoading(false);
      return undefined;
    }
    let cancelled = false;
    setBootLoading(true);
    Promise.all([
      Promise.resolve(fetchParties()),
      fetchSubMasters ? Promise.resolve(fetchSubMasters('City')) : Promise.resolve(),
      fetchSubMasters ? Promise.resolve(fetchSubMasters('AccountGroup')) : Promise.resolve(),
    ])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fetchParties, fetchSubMasters]);

  // Populate the form keyed on the PARTY ID, not the initialData object reference —
  // a caller re-rendering with a re-memoized (but same-party) object must not reset the form.
  const initialPartyId = initialData?._id || initialData?.id || '';
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    if (initialData) {
      const merged = { ...EMPTY_ACCOUNT, ...initialData };
      const wantedBank = String(prefillBankName || '').trim().toUpperCase();
      if (wantedBank && !(merged.banks || []).some((b) => String(b.name || '').toUpperCase() === wantedBank)) {
        merged.banks = [...(merged.banks || []), { name: wantedBank, accountNo: '', ifsc: '' }];
      }
      setFormData(merged);
      setSelectedPartyId(initialPartyId);
      setMode(readOnly ? 'View' : initialPartyId ? 'Edit' : 'Add');
    } else if (readOnly) {
      setMode('View');
    } else {
      setFormData({ ...EMPTY_ACCOUNT });
      setSelectedPartyId('');
      setMode('Add');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPartyId, readOnly, initialTab, prefillBankName]);

  // Derive State Details from GSTIN
  useEffect(() => {
    if (formData.gstin && formData.gstin.length >= 2) {
      const code = formData.gstin.substring(0, 2);
      let name = '';
      if (code === '24') name = '24-Gujarat';
      else if (code === '27') name = '27-Maharashtra';
      else if (code === '07') name = '07-Delhi';
      else name = `${code}-Other State`;
      
      const pan = formData.gstin.length >= 12 ? formData.gstin.substring(2, 12) : '';
      const gstType = code === '24' ? 'INVOICE (IN STATE)' : 'INVOICE (OUT OF STATE)';
      
      setFormData(prev => ({
        ...prev,
        stateCode: code,
        stateName: name,
        gstType,
        pan: prev.pan || pan
      }));
    }
  }, [formData.gstin]);

  const currentIndex = useMemo(() => {
    if (!selectedPartyId || !parties.length) return -1;
    return parties.findIndex(p => (p._id || p.id) === selectedPartyId);
  }, [selectedPartyId, parties]);

  const navigateTo = (index) => {
    if (!parties.length) return;
    const bounded = Math.max(0, Math.min(index, parties.length - 1));
    const target = parties[bounded];
    if (target) {
      const id = target._id || target.id;
      setSelectedPartyId(id);
      setFormData({ ...EMPTY_ACCOUNT, ...target });
      setMode('View');
    }
  };

  const handleFirst = () => navigateTo(0);
  const handlePrev = () => navigateTo(currentIndex <= 0 ? 0 : currentIndex - 1);
  const handleNext = () => navigateTo(currentIndex >= parties.length - 1 ? parties.length - 1 : (currentIndex < 0 ? 0 : currentIndex + 1));
  const handleLast = () => navigateTo(parties.length - 1);

  const handleBankFieldChange = (index, field, val) => {
    setFormData(prev => {
      const nextBanks = [...(prev.banks || [])];
      while (nextBanks.length <= index) {
        nextBanks.push({ name: '', accountNo: '', ifsc: '' });
      }
      nextBanks[index] = { ...nextBanks[index], [field]: val };
      return { ...prev, banks: nextBanks };
    });
  };

  const handleSelectParty = (e) => {
    const id = e?.target?.value ?? e;
    setSelectedPartyId(id);
    if (id) {
      const party = parties.find(p => p._id === id || p.id === id);
      if (party) {
        setFormData({ ...EMPTY_ACCOUNT, ...party });
        setMode('View');
      }
    }
  };

  const handleNew = () => {
    setFormData({ ...EMPTY_ACCOUNT });
    setSelectedPartyId('');
    setMode('Add');
  };

  const handleEdit = () => {
    if (!formData._id && !formData.id) return notifyWarning('Please select an account first');
    setMode('Edit');
  };

  const handleCancel = () => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
      setMode('View');
    } else if (selectedPartyId) {
      const party = parties.find(p => p._id === selectedPartyId || p.id === selectedPartyId);
      if (party) setFormData({ ...formData, ...party });
      setMode('View');
    } else {
      setMode('View');
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!formData.name?.trim()) return notifyWarning('Account name is required');
    setSaving(true);
    try {
      let type = 'Customer';
      const g = (formData.group || '').toUpperCase();
      if (g.includes('CREDITOR')) type = 'Supplier';
      else if (g.includes('BROKER')) type = 'Broker';
      else if (g.includes('JOB') || g.includes('WORKER')) type = 'Job Worker';
      
      const banks = (formData.banks || [])
        .map((b) => ({
          name: String(b.name || '').trim().toUpperCase(),
          accountNo: String(b.accountNo || '').trim(),
          ifsc: String(b.ifsc || '').trim().toUpperCase(),
        }))
        .filter((b) => b.name);

      const finalStateCode = formData.stateCode || '24';
      const finalStateName = formData.stateName || `${finalStateCode}-${GST_STATE_CODES[finalStateCode] || 'GUJARAT'}`;
      const payload = {
        ...formData,
        name: formData.name.trim(),
        stateCode: finalStateCode,
        stateName: finalStateName,
        type,
        banks,
      };
      
      let result;
      if (mode === 'Edit' && (formData._id || formData.id)) {
        result = await updateParty(formData._id || formData.id, payload);
        notifySuccess('Account updated successfully!');
      } else {
        result = await addParty(payload);
        notifySuccess('Account saved successfully!');
      }
      
      if (onSuccess) onSuccess(result);
      fetchParties();
      if (onSuccess || mode === 'Add') {
        onClose?.();
      } else {
        setMode('View');
      }
    } catch (err) {
      notifyError(err, 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const id = formData._id || formData.id;
    if (!id) return notifyWarning('Please select an account to delete');
    if (!(await erpConfirm({
      title: 'Delete Account',
      message: `Are you sure you want to delete ${formData.name}?`,
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
      try {
        await deleteParty(id);
        notifySuccess('Account deleted!');
        handleNew();
        fetchParties();
      } catch (err) {
        notifyError(err, 'Failed to delete account');
      }
  };

  const locked = readOnly || mode === 'View';

  const partyOptions = useMemo(
    () => parties.map((p) => ({ value: p._id || p.id, label: `${p.name} (${p.accd || 'No Code'})` })),
    [parties]
  );

  const cityOptions = useMemo(() => {
    const list = new Set(['SURAT', 'AHMEDABAD', 'MUMBAI', 'DELHI', 'JAIPUR', 'KOLKATA', 'LUDHIANA', 'CHENNAI']);
    (subMasters || [])
      .filter((sm) => sm.type === 'City')
      .forEach((sm) => { if (sm.name) list.add(sm.name.toUpperCase()); });
    parties.forEach((p) => { if (p.city) list.add(p.city.toUpperCase()); });
    return Array.from(list).sort();
  }, [subMasters, parties]);

  const groupOptions = useMemo(() => {
    const list = new Set(['SUNDRY DEBTORS', 'SUNDRY CREDITORS', 'EXPENCES', 'INCOME', 'BANK ACCOUNTS', 'BROKER', 'JOB WORKER', 'CASH-IN-HAND', 'CAPITAL ACCOUNT']);
    (subMasters || [])
      .filter((sm) => sm.type === 'AccountGroup')
      .forEach((sm) => { if (sm.name) list.add(sm.name.toUpperCase()); });
    return Array.from(list);
  }, [subMasters]);

  const brokerOptions = useMemo(
    () => [
      { value: '', label: '- Direct/No Broker -' },
      ...parties.filter((p) => p.type === 'Broker').map((p) => ({ value: p._id || p.id, label: p.name })),
    ],
    [parties]
  );

  const setField = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const addBankRow = () => {
    setFormData((prev) => ({ ...prev, banks: [...(prev.banks || []), emptyBankRow()] }));
  };

  const updateBankRow = (idx, key) => (e) => {
    const raw = e.target.value;
    const val = key === 'name' || key === 'ifsc' ? raw.toUpperCase() : raw;
    setFormData((prev) => {
      const banks = [...(prev.banks || [])];
      banks[idx] = { ...banks[idx], [key]: val };
      return { ...prev, banks };
    });
  };

  const removeBankRow = (idx) => {
    setFormData((prev) => ({ ...prev, banks: (prev.banks || []).filter((_, i) => i !== idx) }));
  };

  // JSM pixel layout: absolute position/size taken from the decompiled form.
  const at = (left, top, width, height = 22) => ({ position: 'absolute', left, top, width, height });
  const L = (left, top, text, red = false) => (
    <span key={`${left}-${top}`} style={{ position: 'absolute', left, top }} className={`jsm-am-lbl${red ? ' red-label' : ''}`}>{text}</span>
  );
  const T = (left, top, width, key, props = {}) => (
    <input style={at(left, top, width)} className="classic-erp-input" value={formData[key] ?? ''} onChange={setField(key)} disabled={locked} {...props} />
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-[1010px]">
      <div
        className="classic-erp-window erp-master-form"
        data-form-enter-nav="true"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.altKey && e.key.toLowerCase() === 's')) {
            // the app-wide Ctrl+Enter / Alt+S already pressed this window's Save; don't save a second time
            if (e.defaultPrevented) return;
            e.preventDefault();
            e.stopPropagation();
            if (!locked && !saving && !bootLoading) handleSave();
          }
          if (e.key === 'F3') {
            e.preventDefault();
            setMode('View');
            setTimeout(() => {
              const inp = document.querySelector('.classic-erp-select input');
              inp?.focus();
              try { inp?.select(); } catch {}
            }, 60);
          }
        }}
      >
        <ErpBusyOverlay show={bootLoading} message="Loading accounts…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Saving account…" />
        <div className="classic-erp-header">
          <span>Main Account Master</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded px-2 py-0.5 cursor-pointer"
            >
              📥 Import (Excel)
            </button>
            <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 500 }}>{mode} Mode</span>
            <button type="button" className="classic-erp-close-btn" onClick={onClose} data-action="exit" title="Exit (Alt+X / Esc)">×</button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="classic-erp-tabs">
          <button className={`classic-erp-tab-button ${activeTab === 'Account' ? 'active' : ''}`} onClick={() => setActiveTab('Account')}>Account</button>
          <button className={`classic-erp-tab-button ${activeTab === 'Bank Details' ? 'active' : ''}`} onClick={() => setActiveTab('Bank Details')}>Bank Details{formData.banks?.length ? ` (${formData.banks.length})` : ''}</button>
          <button className={`classic-erp-tab-button ${activeTab === 'Other Detail' ? 'active' : ''}`} onClick={() => setActiveTab('Other Detail')}>Other Detail</button>
        </div>

        {/* Form Body */}
        <div className="classic-erp-body">
          {mode === 'View' && (
            <div className="classic-erp-frame mb-3">
              <div className="classic-erp-field-row">
                <span className="classic-erp-label blue-label classic-erp-label--fixed">Find Party (F3)</span>
                <ERPSelect
                  className="classic-erp-select flex-1"
                  value={selectedPartyId}
                  onChange={handleSelectParty}
                  options={partyOptions}
                  placeholder="Select party to view or edit"
                  recentKey="account-party"
                />
              </div>
            </div>
          )}

          {activeTab === 'Account' && (
            /* Same positions, sizes and captions as JSM mst_acc_mast (GroupBox1, 978x502). */
            <div className="jsm-am-scroll">
              <div className="jsm-am-box">
                {L(10, 27, 'Account', true)}
                <input ref={nameInputRef} style={at(107, 26, 519)} className="classic-erp-input font-bold" value={formData.name} onChange={setField('name')} disabled={locked} autoFocus={mode === 'Add'} />
                {L(637, 31, 'A/c Id')}
                <input style={at(689, 28, 80)} className="classic-erp-input text-center font-mono" value={formData.accd || ''} readOnly />
                {L(883, 8, 'Accd')}
                {L(884, 32, 'Option')}
                {T(907, 56, 58, 'connectedCode', { title: 'Conected Code' })}
                {L(10, 53, 'Alias')}
                {T(107, 50, 519, 'alias')}
                {L(10, 75, 'A/c. Head', true)}
                <select style={at(107, 76, 376)} className="classic-erp-select font-bold" value={formData.group} onChange={setField('group')} disabled={locked}>
                  {groupOptions.map((grp) => <option key={grp} value={grp}>{grp}</option>)}
                </select>
                <label style={at(498, 76, 107)} className="jsm-am-chk">
                  <input type="checkbox" checked={!!formData.eCommerce} onChange={setField('eCommerce')} disabled={locked} /> E-Commerce
                </label>
                {L(638, 80, 'Status')}
                <select style={at(689, 76, 112, 24)} className="classic-erp-select" value={formData.status} onChange={setField('status')} disabled={locked}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                {L(807, 89, 'Update In All Firm')}
                {T(935, 86, 28, 'updateInAllFirm', { maxLength: 1, className: 'classic-erp-input text-center uppercase' })}
                {L(807, 110, 'Update In All Year')}
                {T(935, 107, 28, 'updateInAllYear', { maxLength: 1, className: 'classic-erp-input text-center uppercase' })}
                {L(10, 110, 'Op.Balance')}
                {T(107, 110, 160, 'openingBalance', { type: 'number', className: 'classic-erp-input text-right' })}
                <select style={at(272, 109, 63, 24)} className="classic-erp-select font-bold" value={formData.openingBalanceType} onChange={setField('openingBalanceType')} disabled={locked}>
                  <option value="Dr">DR</option>
                  <option value="Cr">CR</option>
                </select>
                <input type="checkbox" style={at(370, 112, 16, 16)} checked={!!formData.mainGroup} onChange={setField('mainGroup')} disabled={locked} title="Under Main Group" />
                {L(402, 112, 'Main Group')}
                {T(487, 108, 241, 'mainGroupId', { disabled: locked || !formData.mainGroup })}
                {L(10, 141, 'Address')}
                {T(107, 138, 519, 'address')}
                {T(107, 161, 519, 'address2')}
                {T(107, 184, 519, 'address3')}
                {L(10, 209, 'City')}
                <input style={at(107, 208, 234)} list="city-options-list" className="classic-erp-input uppercase" value={formData.city} onChange={setField('city')} disabled={locked} />
                <datalist id="city-options-list">
                  {cityOptions.map((c) => <option key={c} value={c} />)}
                </datalist>
                {L(347, 212, 'PinCode')}
                {T(413, 209, 114, 'pincode', { className: 'classic-erp-input font-mono' })}
                {L(630, 139, 'Aadhar No')}
                {T(709, 135, 181, 'aadharNo', { className: 'classic-erp-input font-mono' })}
                {L(630, 162, 'Gstin No')}
                {T(709, 160, 181, 'gstin', { maxLength: 15, className: 'classic-erp-input font-mono uppercase font-bold' })}
                {L(630, 187, 'StateCode')}
                {T(709, 184, 56, 'stateCode', { className: 'classic-erp-input font-mono' })}
                {L(630, 211, 'StateName')}
                {T(709, 208, 181, 'stateName')}
                {L(630, 235, 'GstType')}
                <select style={at(709, 232, 200)} className="classic-erp-select" value={formData.gstType} onChange={setField('gstType')} disabled={locked}>
                  {['INVOICE (IN STATE)', 'INVOICE (OUT OF STATE)'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {L(586, 258, 'Udyam Aadhar')}
                {T(709, 256, 192, 'udyamAadhar', { className: 'classic-erp-input font-mono uppercase', placeholder: 'UDYAM-XX-00-0000000' })}
                {L(605, 284, 'MSME Type')}
                <select style={at(691, 280, 211, 24)} className="classic-erp-select" value={formData.msmeType} onChange={setField('msmeType')} disabled={locked}>
                  {MSME_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {T(909, 280, 64, 'msmeYear', { title: 'MSME Year' })}
                {L(10, 241, 'Phone (O)')}
                {T(107, 241, 444, 'phoneO', { className: 'classic-erp-input font-mono' })}
                {L(10, 264, 'Phone (R)')}
                {T(107, 265, 444, 'phoneR', { className: 'classic-erp-input font-mono' })}
                {L(11, 290, 'Mobile')}
                {T(107, 289, 297, 'mobile', { className: 'classic-erp-input font-mono font-bold' })}
                {L(12, 315, 'Cont. Person')}
                {T(107, 313, 298, 'contactPerson')}
                {L(534, 308, 'SalesMan')}
                {T(611, 305, 298, 'salesMan')}
                {L(535, 331, 'AreaName')}
                {T(611, 327, 298, 'areaName')}
                {L(535, 352, 'Haste')}
                {T(611, 349, 158, 'haste')}
                {L(535, 377, 'Exp.City')}
                {T(611, 372, 158, 'expCity')}
                {L(10, 350, 'Broker')}
                <div style={at(107, 347, 345)}>
                  <ERPSelect className="classic-erp-select w-full" value={formData.brokerId} onChange={setField('brokerId')} disabled={locked} options={brokerOptions} placeholder="- Direct/No Broker -" recentKey="account-broker" />
                </div>
                {L(10, 374, 'Transport')}
                {T(107, 371, 345, 'transport')}
                {L(11, 407, 'TIN CstNo')}
                {T(107, 405, 225, 'tinCstNo')}
                {L(347, 410, 'Hsn Code')}
                {T(418, 407, 109, 'hsnCode', { className: 'classic-erp-input font-mono' })}
                {L(11, 432, 'TIN VatGstNo')}
                {T(107, 429, 225, 'tinGstNo')}
                {L(13, 455, 'Pan No')}
                {T(107, 452, 109, 'pan', { maxLength: 10, className: 'classic-erp-input font-mono uppercase' })}
                {L(270, 455, 'DOB')}
                {T(308, 452, 87, 'dob', { placeholder: 'dd/mm/yyyy' })}
                {L(402, 455, 'Tds.Per')}
                {T(460, 452, 67, 'tdsPer', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(547, 455, 'Tcs Per')}
                {T(608, 452, 74, 'tcsPer', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(538, 401, 'DueDay')}
                {T(599, 397, 63, 'dueDays', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(539, 421, 'RdRate')}
                {T(599, 419, 63, 'rdRate', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(705, 401, 'Disc.1%')}
                {T(764, 399, 63, 'disc1', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(704, 423, 'Disc.2%')}
                {T(764, 421, 63, 'disc2', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(852, 379, 'Add%')}
                {T(898, 375, 65, 'addPer', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(854, 401, 'Int. %')}
                {T(898, 397, 65, 'intPer', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(834, 422, 'Commi%')}
                {T(898, 419, 65, 'commi', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(790, 449, 'Max Level')}
                {T(866, 449, 97, 'maxLevel', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(790, 473, 'Min Level')}
                {T(866, 472, 97, 'minLevel', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(13, 479, 'Email')}
                {T(107, 476, 380, 'email')}
                {L(510, 479, 'Agcy Op.Bal')}
                {T(590, 476, 90, 'agencyOpBal', { type: 'number', className: 'classic-erp-input text-right' })}
                <select style={at(685, 475, 50, 24)} className="classic-erp-select font-bold" value={formData.agencyDrCr} onChange={setField('agencyDrCr')} disabled={locked}>
                  <option value="Dr">DR</option>
                  <option value="Cr">CR</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'Bank Details' && (
            <div className="classic-erp-frame">
              <div className="flex items-center justify-between mb-2">
                <span className="classic-erp-label red-label">Party Bank Accounts</span>
                {!locked && (
                  <button type="button" className="classic-erp-btn" onClick={addBankRow}>+ Add Bank</button>
                )}
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="classic-erp-label pb-1">Bank Name</th>
                    <th className="classic-erp-label pb-1">Account No</th>
                    <th className="classic-erp-label pb-1">IFSC Code</th>
                    {!locked && <th className="classic-erp-label pb-1 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {(formData.banks || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-gray-400 py-4">
                        No bank accounts added{!locked ? ' — click "+ Add Bank"' : ''}
                      </td>
                    </tr>
                  ) : (
                    formData.banks.map((b, idx) => (
                      <tr key={idx}>
                        <td className="pr-2 py-1">
                          <input type="text" className="classic-erp-input w-full" value={b.name} onChange={updateBankRow(idx, 'name')} disabled={locked} placeholder="Bank name" />
                        </td>
                        <td className="pr-2 py-1">
                          <input type="text" className="classic-erp-input w-full" value={b.accountNo} onChange={updateBankRow(idx, 'accountNo')} disabled={locked} placeholder="Account number" />
                        </td>
                        <td className="pr-2 py-1">
                          <input type="text" className="classic-erp-input w-full" value={b.ifsc} onChange={updateBankRow(idx, 'ifsc')} disabled={locked} placeholder="IFSC" maxLength={11} />
                        </td>
                        {!locked && (
                          <td className="py-1">
                            <button type="button" className="classic-erp-btn btn-red" style={{ padding: '2px 8px' }} onClick={() => removeBankRow(idx)}>×</button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Other Detail' && (
            /* JSM mst_acc_mast GroupBox2 (Ref.1-4, factory address); Credit Limit / Dhara % / TDS Section are MERN-only. */
            <div className="jsm-am-scroll">
              <div className="jsm-am-box" style={{ height: 440 }}>
                {L(62, 18, formData.name || '')}
                {L(704, 15, 'CreateDate')}
                <input style={at(785, 12, 87)} className="classic-erp-input" readOnly value={formData.createdAt ? new Date(formData.createdAt).toLocaleDateString('en-GB') : ''} />
                {L(25, 64, 'Ref.1')}
                {T(65, 63, 458, 'ref1')}
                {L(25, 89, 'Ref.2')}
                {T(65, 87, 458, 'ref2')}
                {L(25, 123, 'Ref.3')}
                {T(65, 121, 458, 'ref3')}
                {L(25, 149, 'Ref.4')}
                {T(65, 146, 458, 'ref4')}
                {L(21, 192, 'Factory Address')}
                {T(26, 212, 519, 'factoryAddress1')}
                {T(26, 235, 519, 'factoryAddress2')}
                {T(26, 256, 323, 'factoryCity')}
                {L(7, 311, 'Mobile')}
                <textarea style={at(65, 309, 448, 86)} className="classic-erp-input" value={formData.factoryMobile || ''} onChange={setField('factoryMobile')} disabled={locked} />
                {L(600, 64, 'Credit Limit')}
                {T(700, 63, 120, 'creditLimit', { type: 'number', className: 'classic-erp-input text-right font-bold' })}
                {L(600, 89, 'Dhara %')}
                {T(700, 87, 120, 'dharaPer', { type: 'number', className: 'classic-erp-input text-right' })}
                {L(600, 115, 'TDS Section')}
                {T(700, 113, 120, 'tdsSection', { className: 'classic-erp-input uppercase' })}

                {L(600, 145, 'Bank 1 Name')}
                <input style={at(700, 143, 200)} className="classic-erp-input uppercase" value={formData.banks?.[0]?.name || ''} onChange={(e) => handleBankFieldChange(0, 'name', e.target.value.toUpperCase())} disabled={locked} placeholder="Bank 1 Name" />
                {L(600, 171, 'Bank 1 A/c No')}
                <input style={at(700, 169, 200)} className="classic-erp-input font-mono" value={formData.banks?.[0]?.accountNo || ''} onChange={(e) => handleBankFieldChange(0, 'accountNo', e.target.value)} disabled={locked} placeholder="Bank 1 Account Number" />

                {L(600, 201, 'Bank 2 Name')}
                <input style={at(700, 199, 200)} className="classic-erp-input uppercase" value={formData.banks?.[1]?.name || ''} onChange={(e) => handleBankFieldChange(1, 'name', e.target.value.toUpperCase())} disabled={locked} placeholder="Bank 2 Name" />
                {L(600, 227, 'Bank 2 A/c No')}
                <input style={at(700, 225, 200)} className="classic-erp-input font-mono" value={formData.banks?.[1]?.accountNo || ''} onChange={(e) => handleBankFieldChange(1, 'accountNo', e.target.value)} disabled={locked} placeholder="Bank 2 Account Number" />
              </div>
            </div>
          )}
        </div>

        {/* Action Button Bar matching JSM Desktop Form */}
        <div className="classic-erp-form-footer select-none flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              className="classic-erp-btn"
              type="button"
              data-action="first"
              onClick={handleFirst}
              disabled={saving || !parties.length}
              title="First Record (<)"
            >
              &lt;
            </button>
            <button
              className="classic-erp-btn"
              type="button"
              data-action="prev"
              onClick={handlePrev}
              disabled={saving || !parties.length}
              title="Previous Record (<<)"
            >
              &lt;&lt;
            </button>
            <button
              className="classic-erp-btn"
              type="button"
              data-action="next"
              onClick={handleNext}
              disabled={saving || !parties.length}
              title="Next Record (>>)"
            >
              &gt;&gt;
            </button>
            <button
              className="classic-erp-btn"
              type="button"
              data-action="last"
              onClick={handleLast}
              disabled={saving || !parties.length}
              title="Last Record (>)"
            >
              &gt;
            </button>
            {currentIndex >= 0 && (
              <span className="text-[11px] font-mono text-gray-600 px-1">
                {currentIndex + 1} / {parties.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className={`classic-erp-btn ${mode === 'Add' ? 'bg-[#0000d0] text-white ring-2 ring-blue-400 font-bold' : ''}`}
              type="button"
              data-action="new"
              onClick={handleNew}
              disabled={readOnly || saving}
              title="New Account (Alt+N / F2)"
            >
              New
            </button>
            <button
              className={`classic-erp-btn ${mode === 'Edit' ? 'bg-[#0000d0] text-white ring-2 ring-blue-400 font-bold' : ''}`}
              type="button"
              data-action="edit"
              onClick={handleEdit}
              disabled={readOnly || saving}
              title="Edit Account (Alt+E)"
            >
              Edit
            </button>
            <button
              ref={saveBtnRef}
              className="classic-erp-btn btn-blue font-bold"
              type="button"
              data-action="save"
              data-enter-save="true"
              onClick={handleSave}
              disabled={locked || saving || bootLoading}
              title="Save Account (Alt+S / Enter on Save)"
            >
              <SaveButtonLabel saving={saving} />
            </button>
            <button
              className="classic-erp-btn"
              type="button"
              data-action="cancel"
              onClick={handleCancel}
              disabled={locked || saving}
              title="Cancel (Alt+C)"
            >
              Cancel
            </button>
            <button
              className="classic-erp-btn"
              type="button"
              data-action="find"
              data-master-find="true"
              onClick={() => {
                setMode('View');
                setTimeout(() => {
                  const inp = document.querySelector('.classic-erp-select input');
                  inp?.focus();
                  try { inp?.select(); } catch {}
                }, 50);
              }}
              disabled={saving}
              title="Find Party (F3)"
            >
              Find
            </button>
            <button
              className="classic-erp-btn btn-red"
              type="button"
              data-action="delete"
              onClick={handleDelete}
              disabled={readOnly || locked || saving || !(formData._id || formData.id)}
              title="Delete Account (Alt+D)"
            >
              Delete
            </button>
            <button
              className="classic-erp-btn"
              type="button"
              data-action="exit"
              onClick={onClose}
              disabled={saving}
              title="Exit (Alt+X / Esc)"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
      <DataImportModal
        isOpen={showImport}
        onClose={() => {
          setShowImport(false);
          fetchParties?.();
        }}
        initialEntity="party"
      />
    </Modal>
  );
};

export default AccountMasterModal;
