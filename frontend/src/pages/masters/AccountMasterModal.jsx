import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import Modal from '../../components/ui/Modal';
import { ERPSelect } from '../../components/forms/FormElements';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const EMPTY_ACCOUNT = {
  name: '',
  accd: '',
  group: 'SUNDRY DEBTORS',
  openingBalance: 0,
  openingBalanceType: 'Dr',
  mainGroup: false,
  mainGroupId: '',
  address: '',
  address2: '',
  city: 'SURAT',
  pincode: '395002',
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
  stateName: '24-Gujarat',
  gstType: 'INVOICE (IN STATE)',
  udyamAadhar: '',
  msmeType: 'None',
  dueDays: 0,
  rdRate: 0,
  disc1: 0,
  disc2: 0,
  addPer: 0,
  intPer: 0,
  commi: 0,
  maxLevel: 0,
  minLevel: 0,
  tdsPer: 0,
  tcsPer: 0
};

const AccountMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null, readOnly = false }) => {
  const { addParty, updateParty, deleteParty, parties, fetchParties } = useStore();
  const [activeTab, setActiveTab] = useState('Account');
  const [mode, setMode] = useState('View'); // 'View', 'Add', 'Edit'
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  
  const [formData, setFormData] = useState({ ...EMPTY_ACCOUNT });

  useEffect(() => {
    if (!isOpen) {
      setBootLoading(false);
      return;
    }
    let cancelled = false;
    setBootLoading(true);
    Promise.resolve(fetchParties())
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    if (initialData) {
      setFormData({ ...EMPTY_ACCOUNT, ...initialData });
      setSelectedPartyId(initialData._id || initialData.id || '');
      const hasId = !!(initialData._id || initialData.id);
      setMode(readOnly ? 'View' : hasId ? 'Edit' : 'Add');
    } else if (readOnly) {
      setMode('View');
    } else {
      setFormData({ ...EMPTY_ACCOUNT });
      setSelectedPartyId('');
      setMode('Add');
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialData, readOnly, fetchParties]);

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
      
      const payload = { ...formData, name: formData.name.trim(), type };
      
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
      setMode('View');
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-5xl">
      <div className="classic-erp-window">
        <ErpBusyOverlay show={bootLoading} message="Loading accounts…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Saving account…" />
        <div className="classic-erp-header">
          <span>Account Master — {formData.group || 'SUNDRY DEBTORS'}</span>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 500 }}>{mode} Mode</span>
            <button type="button" className="classic-erp-close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="classic-erp-tabs">
          <button className={`classic-erp-tab-button ${activeTab === 'Account' ? 'active' : ''}`} onClick={() => setActiveTab('Account')}>Account</button>
          <button className={`classic-erp-tab-button ${activeTab === 'Other Detail' ? 'active' : ''}`} onClick={() => setActiveTab('Other Detail')}>Other Detail</button>
        </div>

        {/* Form Body */}
        <div className="classic-erp-body">
          {mode === 'View' && (
            <div className="classic-erp-frame mb-3">
              <div className="classic-erp-field-row">
                <span className="classic-erp-label blue-label classic-erp-label--fixed">Find Party</span>
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

          {activeTab === 'Account' ? (
            <div className="space-y-3">
              <div className="classic-erp-frame">
                <div className="classic-erp-field-row">
                  <span className="classic-erp-label red-label classic-erp-label--fixed">Account</span>
                  <input type="text" className="classic-erp-input flex-1" value={formData.name} onChange={setField('name')} disabled={locked} placeholder="Party / account name" />
                  <span className="classic-erp-label classic-erp-label--fixed-sm">Accd</span>
                  <input type="text" className="classic-erp-input w-20" value={formData.accd || ''} readOnly placeholder="Auto" />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="classic-erp-frame space-y-2">
                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label red-label classic-erp-label--fixed">A/c Head</span>
                    <select className="classic-erp-select flex-1" value={formData.group} onChange={setField('group')} disabled={locked}>
                      <option value="SUNDRY DEBTORS">SUNDRY DEBTORS</option>
                      <option value="SUNDRY CREDITORS">SUNDRY CREDITORS</option>
                      <option value="BROKER">BROKER</option>
                      <option value="JOB WORKER">JOB WORKER</option>
                      <option value="BANK ACCOUNTS">BANK ACCOUNTS</option>
                    </select>
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Op. Balance</span>
                    <input type="number" className="classic-erp-input flex-1" value={formData.openingBalance} onChange={setField('openingBalance')} disabled={locked} />
                    <select className="classic-erp-select w-16" value={formData.openingBalanceType} onChange={setField('openingBalanceType')} disabled={locked}>
                      <option value="Dr">DR</option>
                      <option value="Cr">CR</option>
                    </select>
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Main Group</span>
                    <input type="checkbox" checked={formData.mainGroup} onChange={setField('mainGroup')} disabled={locked} />
                    <select className="classic-erp-select flex-1" value={formData.mainGroupId} onChange={setField('mainGroupId')} disabled={locked || !formData.mainGroup}>
                      <option value="">- Select Head Group -</option>
                      <option value="DEBTORS">DEBTORS</option>
                      <option value="CREDITORS">CREDITORS</option>
                    </select>
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Address 1</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.address} onChange={setField('address')} disabled={locked} />
                  </div>
                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Address 2</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.address2} onChange={setField('address2')} disabled={locked} />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed-sm">City</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.city} onChange={setField('city')} disabled={locked} />
                    <span className="classic-erp-label classic-erp-label--fixed-sm">Pin</span>
                    <input type="text" className="classic-erp-input w-24" value={formData.pincode} onChange={setField('pincode')} disabled={locked} />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Phone (O)</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.phoneO} onChange={setField('phoneO')} disabled={locked} />
                  </div>
                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Phone (R)</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.phoneR} onChange={setField('phoneR')} disabled={locked} />
                  </div>
                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Mobile</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.mobile} onChange={setField('mobile')} disabled={locked} />
                  </div>
                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Contact</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.contactPerson} onChange={setField('contactPerson')} disabled={locked} />
                  </div>
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
                    <input type="text" className="classic-erp-input flex-1" value={formData.transport} onChange={setField('transport')} disabled={locked} />
                  </div>
                </div>

                <div className="classic-erp-frame space-y-2">
                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Status</span>
                    <select className="classic-erp-select flex-1" value={formData.status} onChange={setField('status')} disabled={locked}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">All Firm</span>
                    <select className="classic-erp-select w-20" value={formData.updateInAllFirm} onChange={setField('updateInAllFirm')} disabled={locked}>
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                    <span className="classic-erp-label classic-erp-label--fixed-sm">Year</span>
                    <select className="classic-erp-select w-20" value={formData.updateInAllYear} onChange={setField('updateInAllYear')} disabled={locked}>
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Aadhar No</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.aadharNo} onChange={setField('aadharNo')} disabled={locked} />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label red-label classic-erp-label--fixed">GSTIN</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.gstin} onChange={setField('gstin')} disabled={locked} maxLength={15} placeholder="15 char GSTIN" />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed-sm">State</span>
                    <input type="text" className="classic-erp-input w-12" value={formData.stateCode} readOnly />
                    <input type="text" className="classic-erp-input flex-1" value={formData.stateName} readOnly />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">GST Type</span>
                    <select className="classic-erp-select flex-1" value={formData.gstType} onChange={setField('gstType')} disabled={locked}>
                      <option value="INVOICE (IN STATE)">INVOICE (IN STATE)</option>
                      <option value="INVOICE (OUT OF STATE)">INVOICE (OUT OF STATE)</option>
                    </select>
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Udyam</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.udyamAadhar} onChange={setField('udyamAadhar')} disabled={locked} />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">MSME Type</span>
                    <select className="classic-erp-select flex-1" value={formData.msmeType} onChange={setField('msmeType')} disabled={locked}>
                      <option value="None">None</option>
                      <option value="Micro">Micro</option>
                      <option value="Small">Small</option>
                      <option value="Medium">Medium</option>
                    </select>
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">TIN CST</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.tinCstNo} onChange={setField('tinCstNo')} disabled={locked} />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">TIN GST</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.tinGstNo} onChange={setField('tinGstNo')} disabled={locked} />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">PAN</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.pan} onChange={setField('pan')} disabled={locked} />
                  </div>

                  <div className="classic-erp-field-row">
                    <span className="classic-erp-label classic-erp-label--fixed">Email</span>
                    <input type="text" className="classic-erp-input flex-1" value={formData.email} onChange={setField('email')} disabled={locked} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
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

        {/* Action Button Bar */}
        <div className="classic-erp-form-footer">
          <button className="classic-erp-btn" type="button" onClick={handleNew} disabled={readOnly || mode !== 'View' || saving}>New</button>
          <button className="classic-erp-btn" type="button" onClick={handleEdit} disabled={readOnly || mode !== 'View' || saving}>Edit</button>
          <button className="classic-erp-btn btn-blue" type="button" onClick={handleSave} disabled={locked || saving || bootLoading}>
            <SaveButtonLabel saving={saving} />
          </button>
          <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked || saving}>Cancel</button>
          <button className="classic-erp-btn" type="button" onClick={() => setMode('View')} disabled={readOnly || mode === 'View' || saving}>Find</button>
          <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || locked || saving || !(formData._id || formData.id)}>Delete</button>
          <button className="classic-erp-btn" type="button" onClick={onClose} disabled={saving}>Exit</button>
        </div>
      </div>
    </Modal>
  );
};

export default AccountMasterModal;
