import React, { useState, useEffect, useMemo, useRef } from 'react';
import useStore from '../../store/useStore';
import Modal from '../../components/ui/Modal';
import { ERPSelect } from '../../components/forms/FormElements';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import DataImportModal from '../../components/import/DataImportModal';
import { GST_STATE_CODES } from '../../utils/gstStateCodes';

const EMPTY_ACCOUNT = {
  name: '',
  accd: '',
  connectedCode: '',
  group: 'SUNDRY DEBTORS',
  openingBalance: 0,
  openingBalanceType: 'Dr',
  mainGroup: false,
  mainGroupId: '',
  address: '',
  address2: '',
  city: '',
  pincode: '',
  phoneO: '',
  phoneR: '',
  mobile: '',
  contactPerson: '',
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
  dueDays: 0,
  creditLimit: 0,
  tdsSection: '',
  rdRate: 0,
  disc1: 0,
  disc2: 0,
  addPer: 0,
  dharaPer: 0,
  intPer: 0,
  commi: 0,
  maxLevel: 0,
  minLevel: 0,
  tdsPer: 0,
  tcsPer: 0,
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

  const handleSelectParty = (e) => {
    const id = e?.target?.value ?? e;
    setSelectedPartyId(id);
    if (id) {
      const party = parties.find(p => p._id === id || p.id === id);
      if (party) {
        setFormData({ ...formData, ...party });
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-5xl">
      <div
        className="classic-erp-window erp-master-form"
        data-form-enter-nav="true"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.altKey && e.key.toLowerCase() === 's')) {
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
            <div className="relative space-y-2">
              {/* Option Box in Top-Right corner matching JSM Screenshot 1 */}
              <div className="absolute right-2 top-0 border border-[#9aa4b8] bg-[#f8f9fa] p-2 rounded-sm shadow-sm w-36 text-center select-none z-10">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Option</div>
                <div className="text-[11px] font-bold text-gray-700 mb-1">Conected Code</div>
                <input
                  type="text"
                  className="classic-erp-input w-full text-center font-mono font-bold"
                  value={formData.connectedCode || ''}
                  onChange={setField('connectedCode')}
                  disabled={locked}
                  placeholder="Code"
                />
              </div>

              {/* JSM Screenshot 1 Exact Fields Stack */}
              <div className="classic-erp-frame space-y-2 pr-40">
                {/* 1. Account */}
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label red-label classic-erp-label--fixed">Account</span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    className="classic-erp-input flex-1 font-bold"
                    value={formData.name}
                    onChange={setField('name')}
                    disabled={locked}
                    placeholder="Party / Account Name"
                    autoFocus={mode === 'Add'}
                  />
                  <span className="classic-erp-label classic-erp-label--fixed-sm">Accd</span>
                  <input type="text" className="classic-erp-input w-20 text-center font-mono" value={formData.accd || ''} readOnly placeholder="Auto" />
                </div>

                {/* 2. A/c. Head */}
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label red-label classic-erp-label--fixed">A/c. Head</span>
                  <select
                    className="classic-erp-select flex-1 font-bold"
                    value={formData.group}
                    onChange={setField('group')}
                    disabled={locked}
                  >
                    {groupOptions.map((grp) => (
                      <option key={grp} value={grp}>{grp}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Address Line 1 */}
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label classic-erp-label--fixed">Address</span>
                  <input
                    type="text"
                    className="classic-erp-input flex-1"
                    value={formData.address}
                    onChange={setField('address')}
                    disabled={locked}
                    placeholder="Address Line 1"
                  />
                </div>

                {/* 4. Address Line 2 */}
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label classic-erp-label--fixed"></span>
                  <input
                    type="text"
                    className="classic-erp-input flex-1"
                    value={formData.address2}
                    onChange={setField('address2')}
                    disabled={locked}
                    placeholder="Address Line 2 (Area, Landmark)"
                  />
                </div>

                {/* 5. City */}
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label classic-erp-label--fixed">City</span>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      list="city-options-list"
                      className="classic-erp-input flex-1 uppercase"
                      value={formData.city}
                      onChange={setField('city')}
                      disabled={locked}
                      placeholder="Select or type City"
                    />
                    <datalist id="city-options-list">
                      {cityOptions.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                    <span className="classic-erp-label classic-erp-label--fixed-sm">Pin</span>
                    <input
                      type="text"
                      className="classic-erp-input w-24 font-mono"
                      value={formData.pincode}
                      onChange={setField('pincode')}
                      disabled={locked}
                      placeholder="Pincode"
                    />
                  </div>
                </div>

                {/* 6. Phone (O) */}
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label classic-erp-label--fixed">Phone (O)</span>
                  <input
                    type="text"
                    className="classic-erp-input flex-1 font-mono"
                    value={formData.phoneO}
                    onChange={setField('phoneO')}
                    disabled={locked}
                    placeholder="Office Phone"
                  />
                </div>

                {/* 7. Phone (R) */}
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label classic-erp-label--fixed">Phone (R)</span>
                  <input
                    type="text"
                    className="classic-erp-input flex-1 font-mono"
                    value={formData.phoneR}
                    onChange={setField('phoneR')}
                    disabled={locked}
                    placeholder="Residence Phone"
                  />
                </div>

                {/* 8. Mobile */}
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label classic-erp-label--fixed">Mobile</span>
                  <input
                    type="text"
                    className="classic-erp-input flex-1 font-mono font-bold"
                    value={formData.mobile}
                    onChange={setField('mobile')}
                    disabled={locked}
                    placeholder="Mobile Number"
                  />
                </div>
              </div>

              {/* Additional Account Details & Tax Section */}
              <div className="classic-erp-frame bg-[#f8f9fa] p-2 mt-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">
                  Additional Details & Tax
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <div className="classic-erp-field-row">
                      <span className="classic-erp-label classic-erp-label--fixed">Op. Balance</span>
                      <input type="number" className="classic-erp-input flex-1 text-right" value={formData.openingBalance} onChange={setField('openingBalance')} disabled={locked} />
                      <select className="classic-erp-select w-16 font-bold" value={formData.openingBalanceType} onChange={setField('openingBalanceType')} disabled={locked}>
                        <option value="Dr">DR</option>
                        <option value="Cr">CR</option>
                      </select>
                    </div>

                    <div className="classic-erp-field-row">
                      <span className="classic-erp-label classic-erp-label--fixed">GSTIN</span>
                      <input
                        type="text"
                        className="classic-erp-input flex-1 font-mono uppercase font-bold"
                        maxLength={15}
                        value={formData.gstin}
                        onChange={setField('gstin')}
                        disabled={locked}
                        placeholder="GSTIN (15 Digits)"
                      />
                    </div>

                    <div className="classic-erp-field-row">
                      <span className="classic-erp-label classic-erp-label--fixed">PAN</span>
                      <input
                        type="text"
                        className="classic-erp-input flex-1 font-mono uppercase"
                        maxLength={10}
                        value={formData.pan}
                        onChange={setField('pan')}
                        disabled={locked}
                        placeholder="PAN (10 digits)"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="classic-erp-field-row">
                      <span className="classic-erp-label classic-erp-label--fixed">Broker</span>
                      <ERPSelect
                        className="classic-erp-select flex-1"
                        value={formData.brokerId}
                        onChange={setField('brokerId')}
                        disabled={locked}
                        options={brokerOptions}
                        placeholder="- Direct/No Broker -"
                        recentKey="account-broker"
                      />
                    </div>

                    <div className="classic-erp-field-row">
                      <span className="classic-erp-label classic-erp-label--fixed">Transport</span>
                      <input type="text" className="classic-erp-input flex-1" value={formData.transport} onChange={setField('transport')} disabled={locked} placeholder="Transport Name" />
                    </div>

                    <div className="classic-erp-field-row">
                      <span className="classic-erp-label classic-erp-label--fixed">Status</span>
                      <select className="classic-erp-select flex-1" value={formData.status} onChange={setField('status')} disabled={locked}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
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
            /* Other Detail Tab */
            <div className="classic-erp-frame grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">DueDay:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.dueDays} onChange={setField('dueDays')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">RdRate:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.rdRate} onChange={setField('rdRate')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Disc.1%:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.disc1} onChange={setField('disc1')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Disc.2%:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.disc2} onChange={setField('disc2')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Add%:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.addPer} onChange={setField('addPer')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Int. %:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.intPer} onChange={setField('intPer')} disabled={locked} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Commi%:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.commi} onChange={setField('commi')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Max Level:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.maxLevel} onChange={setField('maxLevel')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Min Level:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.minLevel} onChange={setField('minLevel')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Tds.Per:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.tdsPer} onChange={setField('tdsPer')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Tcs Per:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right" value={formData.tcsPer} onChange={setField('tcsPer')} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-24">Credit Limit:</span>
                  <input type="number" className="classic-erp-input flex-1 text-right font-bold" value={formData.creditLimit} onChange={setField('creditLimit')} disabled={locked} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button Bar matching JSM Screenshot 1 */}
        <div className="classic-erp-form-footer select-none">
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
