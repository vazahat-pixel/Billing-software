import React, { useState, useEffect, useMemo, useRef } from 'react';
import { authApi } from '../../api/auth.api';
import useStore from '../../store/useStore';
import useConfigStore from '../../store/useConfigStore';
import { toast } from '../../store/useToastStore';
import { stateCodeFromGstin, stateNameFromCode } from '../../utils/gstStateCodes';
import { X, Search, Landmark, Minus, Square } from 'lucide-react';

const emptyCompany = {
  id: '',
  coCode: '100',
  codeRef: '17145',
  name: '',
  shortName: '',
  workType: '',
  address: '',
  address2: '',
  city: '',
  pincode: '',
  phone: '',
  phone2: '',
  mobile: '',
  fax: '',
  email: '',
  portalPassword: '',
  website: '',
  designation: '',
  signature: '',
  pan: '',
  gstin: '',
  stateCode: '',
  msmeNumber: '',
  tinCstNo: '',
  serviceTaxNo: '',
  tanNo: '',
  tcsApplicable: 'No',
  tdsApplicable: 'Yes',
  fyFrom: '2026-04-01',
  fyTo: '2027-03-31',
  coDataPath: 'SC27',
  coType: 'TEXT',
  bankDetail: {
    bankName: '',
    accountNo: '',
    accountName: '',
    ifsc: '',
    branch: '',
    accountType: 'Current',
    upiId: '',
  },
  others: {
    groupCode: '',
    cinNo: '',
    iecNo: '',
    udyamNo: '',
    ewayUsername: '',
    ewayPassword: '',
    einvoiceUsername: '',
    einvoicePassword: '',
    jurisdiction: '',
    notes: '',
  },
};

export default function CompanyMasterModal({ isOpen, initialCompanyId, onClose }) {
  const user = useStore((s) => s.user);
  const setAuth = useStore((s) => s.setAuth);
  const patchCompanySettings = useConfigStore((s) => s.patchCompanySettings);

  const [activeTab, setActiveTab] = useState('companyDetail'); // 'companyDetail' | 'others'
  const [companies, setCompanies] = useState([]);
  const [groupCode, setGroupCode] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [formData, setFormData] = useState(emptyCompany);
  const [originalData, setOriginalData] = useState(emptyCompany);
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'new'
  const [busy, setBusy] = useState(false);
  const [showFindModal, setShowFindModal] = useState(false);
  const [findFilter, setFindFilter] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  // Live clock for ERP status bar & timestamp
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = String(hours).padStart(2, '0');
      setCurrentTime(`${d}/${m}/${y} ${strHours}:${minutes}:${seconds} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch companies on mount / open
  const loadCompanies = async (selectCompanyId) => {
    try {
      setBusy(true);
      const res = await authApi.listCompanies();
      const list = res?.companies || [];
      setCompanies(list);
      setGroupCode(res?.groupCode || '');

      let target = null;
      if (selectCompanyId) {
        target = list.find((c) => String(c.id) === String(selectCompanyId));
      }
      if (!target && user?.companyId) {
        target = list.find((c) => String(c.id) === String(user.companyId));
      }
      if (!target && list.length > 0) {
        target = list[0];
      }

      if (target) {
        setSelectedId(String(target.id));
        populateForm(target);
        setMode('view');
      } else {
        initNewCompany(list, res?.groupCode);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Could not load company details');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCompanies(initialCompanyId);
    }
  }, [isOpen, initialCompanyId]);

  const populateForm = (comp) => {
    const bank = comp.bankDetail || {};
    const others = comp.others || {};
    const normalized = {
      id: comp.id || '',
      coCode: comp.coCode || '',
      codeRef: comp.codeRef || comp.coCode || '17145',
      name: comp.name || '',
      shortName: comp.shortName || '',
      workType: comp.workType || '',
      address: comp.address || '',
      address2: comp.address2 || '',
      city: comp.city || '',
      pincode: comp.pincode || '',
      phone: comp.phone || '',
      phone2: comp.phone2 || '',
      mobile: comp.mobile || '',
      fax: comp.fax || '',
      email: comp.email || '',
      portalPassword: comp.portalPassword || '',
      website: comp.website || '',
      designation: comp.designation || '',
      signature: comp.signature || '',
      pan: comp.pan || '',
      gstin: comp.gstin || '',
      stateCode: comp.stateCode || (comp.gstin ? stateCodeFromGstin(comp.gstin) : ''),
      msmeNumber: comp.msmeNumber || '',
      tinCstNo: comp.tinCstNo || '',
      serviceTaxNo: comp.serviceTaxNo || '',
      tanNo: comp.tanNo || '',
      tcsApplicable: comp.tcsApplicable || 'No',
      tdsApplicable: comp.tdsApplicable || 'Yes',
      fyFrom: comp.fyFrom || '2026-04-01',
      fyTo: comp.fyTo || '2027-03-31',
      coDataPath: comp.coDataPath || 'SC27',
      coType: comp.coType || 'TEXT',
      bankDetail: {
        bankName: bank.bankName || '',
        accountNo: bank.accountNo || '',
        accountName: bank.accountName || comp.name || '',
        ifsc: bank.ifsc || '',
        branch: bank.branch || '',
        accountType: bank.accountType || 'Current',
        upiId: bank.upiId || '',
      },
      others: {
        groupCode: comp.groupCode || others.groupCode || '',
        cinNo: others.cinNo || '',
        iecNo: others.iecNo || '',
        udyamNo: others.udyamNo || '',
        ewayUsername: others.ewayUsername || '',
        ewayPassword: others.ewayPassword || '',
        einvoiceUsername: others.einvoiceUsername || '',
        einvoicePassword: others.einvoicePassword || '',
        jurisdiction: others.jurisdiction || '',
        notes: others.notes || '',
      },
    };
    setFormData(normalized);
    setOriginalData(JSON.parse(JSON.stringify(normalized)));
  };

  const initNewCompany = (existingList = companies, gCode = groupCode) => {
    const list = existingList || [];
    const nums = list.map((r) => Number(r.coCode)).filter((n) => Number.isFinite(n) && n > 0);
    const nextCode = String((nums.length ? Math.max(...nums) : 100) + 1);
    const rndRef = String(Math.floor(10000 + Math.random() * 90000));

    const nextNew = {
      ...emptyCompany,
      coCode: nextCode,
      codeRef: rndRef,
      coDataPath: `SC${new Date().getFullYear().toString().slice(-2)}`,
      others: {
        ...emptyCompany.others,
        groupCode: gCode || user?.company?.groupCode || '',
      },
    };
    setFormData(nextNew);
    setOriginalData(JSON.parse(JSON.stringify(nextNew)));
    setSelectedId('');
    setMode('new');
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBankChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      bankDetail: {
        ...prev.bankDetail,
        [field]: value,
      },
    }));
  };

  const handleOthersChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      others: {
        ...prev.others,
        [field]: value,
      },
    }));
  };

  // Auto-fill from GSTIN
  const handleGstFillData = () => {
    const gst = String(formData.gstin || '').trim().toUpperCase();
    if (!gst) {
      toast.info('Please enter GSTIN first');
      return;
    }
    const stateCode = stateCodeFromGstin(gst);
    const pan = gst.length >= 12 ? gst.substring(2, 12) : '';
    setFormData((prev) => ({
      ...prev,
      gstin: gst,
      stateCode: stateCode || prev.stateCode,
      pan: pan || prev.pan,
    }));
    const sName = stateNameFromCode(stateCode);
    toast.success(`Data filled from GST: State ${stateCode || ''} (${sName}), PAN ${pan}`);
  };

  const handleGstProfile = () => {
    const gst = String(formData.gstin || '').trim().toUpperCase();
    if (!gst) {
      toast.info('Please enter GSTIN first');
      return;
    }
    const url = `https://services.gst.gov.in/services/searchtp?gstin=${gst}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Toolbar Actions - NO ADMIN RESTRICTION, ANY USER CAN USE
  const handleNew = () => {
    initNewCompany();
  };

  const handleEdit = () => {
    setMode('edit');
  };

  const handleCancel = () => {
    setFormData(JSON.parse(JSON.stringify(originalData)));
    setMode('view');
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Company Name is required');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'new') {
        const payload = {
          ...formData,
          groupCode: groupCode || formData.others?.groupCode || user?.company?.groupCode,
        };
        const created = await authApi.createCompany(payload);
        toast.success(`Company "${created.name}" created successfully`);
        await loadCompanies(created.id);
      } else {
        const targetId = selectedId || user?.companyId;
        const updated = await authApi.updateCompany(formData, targetId);
        toast.success(`Company "${updated.name}" saved successfully`);

        // If this is the active company, sync in store
        if (String(targetId) === String(user?.companyId)) {
          patchCompanySettings({
            legalName: updated.name,
            shortName: updated.shortName,
            gstin: updated.gstin,
            pan: updated.pan,
            tan: updated.tanNo,
            address: updated.address,
            address2: updated.address2,
            city: updated.city,
            stateCode: updated.stateCode,
            pincode: updated.pincode,
            phone: updated.phone,
            mobile: updated.mobile,
            fax: updated.fax,
            email: updated.email,
            website: updated.website,
            bankName: updated.bankDetail?.bankName,
            accountNo: updated.bankDetail?.accountNo,
            accountName: updated.bankDetail?.accountName,
            ifsc: updated.bankDetail?.ifsc,
            bankBranch: updated.bankDetail?.branch,
            upiId: updated.bankDetail?.upiId,
          });
          const currentUser = useStore.getState().user;
          if (currentUser) {
            setAuth({
              token: useStore.getState().token,
              user: {
                ...currentUser,
                companyName: updated.name,
                company: {
                  ...(currentUser.company || {}),
                  name: updated.name,
                  coCode: updated.coCode,
                },
              },
            });
          }
        }
        await loadCompanies(targetId);
      }
      setMode('view');
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to save company');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const current = companies.find((c) => String(c.id) === String(selectedId));
    if (current?.isMaster) {
      toast.error('Primary Master company cannot be deleted');
      return;
    }
    if (String(selectedId) === String(user?.companyId)) {
      toast.error('Cannot delete currently active company. Switch company first.');
      return;
    }
    if (!window.confirm(`Deactivate company "${formData.name}"?`)) {
      return;
    }
    setBusy(true);
    try {
      await authApi.deleteCompany(selectedId);
      toast.success(`Company "${formData.name}" removed successfully`);
      await loadCompanies();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Could not delete company');
    } finally {
      setBusy(false);
    }
  };

  const handleSelectCompanyFromFind = (comp) => {
    setSelectedId(String(comp.id));
    populateForm(comp);
    setMode('view');
    setShowFindModal(false);
  };

  const filteredCompanies = useMemo(() => {
    if (!findFilter.trim()) return companies;
    const q = findFilter.toLowerCase();
    return companies.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.coCode?.toLowerCase().includes(q) ||
        c.gstin?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q)
    );
  }, [companies, findFilter]);

  const readOnly = mode === 'view';

  if (!isOpen) return null;

  // Exact Classic Desktop ERP Styles (matching original screenshot)
  const erpInput =
    'h-[23px] px-1.5 text-[11px] font-semibold border border-[#a0a8b4] rounded-[1px] bg-white text-[#111827] focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] disabled:bg-[#f1f3f6] disabled:text-[#374151] transition-all';
  const erpLabel =
    'text-[11px] font-medium text-[#475569] select-none whitespace-nowrap text-right';

  const fyYearDisplay = formData.fyFrom
    ? `${formData.fyFrom.slice(0, 4)}-${(Number(formData.fyFrom.slice(0, 4)) + 1).toString().slice(-2)}`
    : '2026-27';

  return (
    <div className="fixed inset-0 z-[2500] flex flex-col items-center justify-start pt-14 pb-2 px-2 bg-black/60 backdrop-blur-xs select-none overflow-y-auto">
      {/* Outer ERP Window Box - Classic Desktop Theme */}
      <div className="flex flex-col w-[940px] max-w-[99vw] bg-[#eef2f7] border-2 border-[#1e40af] rounded-[3px] shadow-2xl overflow-hidden font-sans shrink-0">
        
        {/* Aero Classic Title Bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-white">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-[1px] bg-amber-400 flex items-center justify-center text-blue-900 font-black text-[9px]">
              C
            </span>
            <span className="text-[12px] font-bold tracking-wide">Company Form</span>
            {mode !== 'view' && (
              <span className="px-1.5 py-0.2 bg-amber-300 text-amber-950 font-black text-[9px] uppercase rounded-[2px]">
                {mode === 'new' ? 'NEW RECORD' : 'EDIT MODE'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="w-5 h-4 flex items-center justify-center rounded-[2px] bg-white/10 hover:bg-white/20 text-white"
              title="Minimize"
            >
              <Minus size={11} />
            </button>
            <button
              type="button"
              className="w-5 h-4 flex items-center justify-center rounded-[2px] bg-white/10 hover:bg-white/20 text-white"
              title="Maximize"
            >
              <Square size={9} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-4 flex items-center justify-center rounded-[2px] bg-[#dc2626] hover:bg-[#b91c1c] text-white transition-colors ml-0.5"
              title="Close (Esc)"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Tab Headers - Classic Light ERP */}
        <div className="flex items-center px-2 pt-1 border-b border-[#cbd5e1] bg-[#e2e8f0] gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('companyDetail')}
            className={`px-3 py-0.5 text-[11px] font-bold rounded-t-[3px] border-t border-x transition-colors ${
              activeTab === 'companyDetail'
                ? 'bg-white border-[#cbd5e1] text-[#1d4ed8] border-b-0 -mb-[1px] shadow-xs'
                : 'bg-[#cbd5e1] border-transparent text-[#64748b] hover:text-gray-900'
            }`}
          >
            Company Detail
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('others')}
            className={`px-3 py-0.5 text-[11px] font-bold rounded-t-[3px] border-t border-x transition-colors ${
              activeTab === 'others'
                ? 'bg-white border-[#cbd5e1] text-[#1d4ed8] border-b-0 -mb-[1px] shadow-xs'
                : 'bg-[#cbd5e1] border-transparent text-[#64748b] hover:text-gray-900'
            }`}
          >
            Others
          </button>
        </div>

        {/* Form Body - Classic Light Theme, Pure White Inputs, Single Screen */}
        <form onSubmit={handleSave} className="bg-white p-2.5 space-y-1.5">
          {activeTab === 'companyDetail' ? (
            <div className="space-y-1">
              {/* TOP SPLIT: Left (Company Fields) | Right (Large ID & Maroon Bank Box) */}
              <div className="grid grid-cols-12 gap-2">
                {/* Left 7 Columns */}
                <div className="col-span-7 space-y-1">
                  {/* Row 1: Co Code */}
                  <div className="flex items-center gap-2">
                    <span className={`${erpLabel} w-24`}>Co Code</span>
                    <input
                      type="text"
                      className={`${erpInput} w-20 text-center font-bold`}
                      value={formData.coCode}
                      onChange={(e) => handleFieldChange('coCode', e.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  {/* Row 2: Company Name + Short Code */}
                  <div className="flex items-center gap-2">
                    <span className={`${erpLabel} w-24`}>Company Name</span>
                    <input
                      type="text"
                      className={`${erpInput} flex-1 font-bold uppercase`}
                      value={formData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value.toUpperCase())}
                      placeholder="COMPANY NAME"
                      required
                      disabled={readOnly}
                    />
                    <input
                      type="text"
                      className={`${erpInput} w-16 text-center uppercase font-bold`}
                      value={formData.shortName}
                      onChange={(e) => handleFieldChange('shortName', e.target.value.toUpperCase())}
                      placeholder="SCC"
                      title="Short Code"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Row 3: Type Of Work */}
                  <div className="flex items-center gap-2">
                    <span className={`${erpLabel} w-24`}>Type Of Work</span>
                    <input
                      type="text"
                      className={`${erpInput} flex-1`}
                      value={formData.workType}
                      onChange={(e) => handleFieldChange('workType', e.target.value)}
                      placeholder="mfg readymade blouse"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Row 4: Address Line 1 */}
                  <div className="flex items-center gap-2">
                    <span className={`${erpLabel} w-24`}>Address</span>
                    <input
                      type="text"
                      className={`${erpInput} flex-1`}
                      value={formData.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      placeholder="Premises / Market / Street"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Row 5: Address Line 2 */}
                  <div className="flex items-center gap-2">
                    <span className={`${erpLabel} w-24`} />
                    <input
                      type="text"
                      className={`${erpInput} flex-1`}
                      value={formData.address2}
                      onChange={(e) => handleFieldChange('address2', e.target.value)}
                      placeholder="Area / Road / Landmark"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Row 6: City + PinCode */}
                  <div className="flex items-center gap-2">
                    <span className={`${erpLabel} w-24`}>City</span>
                    <input
                      type="text"
                      className={`${erpInput} flex-1 uppercase font-bold`}
                      value={formData.city}
                      onChange={(e) => handleFieldChange('city', e.target.value.toUpperCase())}
                      placeholder="SURAT"
                      disabled={readOnly}
                    />
                    <span className={`${erpLabel} w-14`}>PinCode</span>
                    <input
                      type="text"
                      className={`${erpInput} w-24 text-center font-mono`}
                      value={formData.pincode}
                      onChange={(e) => handleFieldChange('pincode', e.target.value)}
                      placeholder="395012"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Row 7: Phone (O) + Second Phone */}
                  <div className="flex items-center gap-2">
                    <span className={`${erpLabel} w-24`}>Phone (O)</span>
                    <input
                      type="text"
                      className={`${erpInput} flex-1 font-mono`}
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      placeholder="Phone 1"
                      disabled={readOnly}
                    />
                    <input
                      type="text"
                      className={`${erpInput} flex-1 font-mono`}
                      value={formData.phone2}
                      onChange={(e) => handleFieldChange('phone2', e.target.value)}
                      placeholder="Phone 2"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Row 8: Mobile + Fax */}
                  <div className="flex items-center gap-2">
                    <span className={`${erpLabel} w-24`}>Mobile</span>
                    <input
                      type="text"
                      className={`${erpInput} flex-1 font-mono`}
                      value={formData.mobile}
                      onChange={(e) => handleFieldChange('mobile', e.target.value)}
                      placeholder="Mobile No."
                      disabled={readOnly}
                    />
                    <span className={`${erpLabel} w-8`}>Fax</span>
                    <input
                      type="text"
                      className={`${erpInput} w-32`}
                      value={formData.fax}
                      onChange={(e) => handleFieldChange('fax', e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {/* Right 5 Columns: Large Number Display + Classic Maroon Bank Box */}
                <div className="col-span-5 flex flex-col justify-between pl-2">
                  {/* Large Grey Reference Code */}
                  <div className="flex justify-end items-center pr-3">
                    <span className="text-[26px] font-black tracking-widest text-[#64748b] font-mono">
                      {formData.codeRef || formData.coCode || '17145'}
                    </span>
                  </div>

                  {/* Classic Maroon Red Bank Detail Box (Exact Match to Screenshot) */}
                  <div className="bg-[#8b1414] text-white p-2 rounded-[2px] shadow-sm border border-[#701010] flex flex-col gap-1">
                    <div className="flex items-center justify-between border-b border-red-700/70 pb-0.5 mb-0.5">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                        <Landmark size={12} className="text-amber-300" /> Bank Detail
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-red-200">Payment Routing</span>
                    </div>

                    <div className="grid grid-cols-12 gap-1 items-center">
                      <span className="col-span-4 text-[10px] text-red-100 text-right font-medium">Bank Name</span>
                      <input
                        type="text"
                        className="col-span-8 h-[21px] px-1.5 text-[11px] font-bold text-gray-900 bg-white rounded-[1px] border border-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        value={formData.bankDetail?.bankName}
                        onChange={(e) => handleBankChange('bankName', e.target.value)}
                        placeholder="HDFC Bank"
                        disabled={readOnly}
                      />
                    </div>

                    <div className="grid grid-cols-12 gap-1 items-center">
                      <span className="col-span-4 text-[10px] text-red-100 text-right font-medium">Account No</span>
                      <input
                        type="text"
                        className="col-span-8 h-[21px] px-1.5 text-[11px] font-bold text-gray-900 bg-white rounded-[1px] border border-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                        value={formData.bankDetail?.accountNo}
                        onChange={(e) => handleBankChange('accountNo', e.target.value)}
                        placeholder="50200012345678"
                        disabled={readOnly}
                      />
                    </div>

                    <div className="grid grid-cols-12 gap-1 items-center">
                      <span className="col-span-4 text-[10px] text-red-100 text-right font-medium">IFSC Code</span>
                      <input
                        type="text"
                        className="col-span-8 h-[21px] px-1.5 text-[11px] font-bold text-gray-900 bg-white rounded-[1px] border border-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400 uppercase font-mono"
                        value={formData.bankDetail?.ifsc}
                        onChange={(e) => handleBankChange('ifsc', e.target.value.toUpperCase())}
                        placeholder="HDFC0001234"
                        disabled={readOnly}
                      />
                    </div>

                    <div className="grid grid-cols-12 gap-1 items-center">
                      <span className="col-span-4 text-[10px] text-red-100 text-right font-medium">Branch</span>
                      <input
                        type="text"
                        className="col-span-8 h-[21px] px-1.5 text-[10px] text-gray-900 bg-white rounded-[1px] border border-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        value={formData.bankDetail?.branch}
                        onChange={(e) => handleBankChange('branch', e.target.value)}
                        placeholder="Ring Road Surat"
                        disabled={readOnly}
                      />
                    </div>

                    <div className="grid grid-cols-12 gap-1 items-center">
                      <span className="col-span-4 text-[10px] text-red-100 text-right font-medium">UPI ID</span>
                      <input
                        type="text"
                        className="col-span-8 h-[21px] px-1.5 text-[10px] text-gray-900 bg-white rounded-[1px] border border-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        value={formData.bankDetail?.upiId}
                        onChange={(e) => handleBankChange('upiId', e.target.value)}
                        placeholder="name@upi"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* LOWER FULL-WIDTH GRID (Rows 9 to 16) */}
              <div className="space-y-1 pt-1 border-t border-gray-300">
                {/* Row 9: Email | Password | Live Timestamp */}
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-24`}>Email</span>
                  <input
                    type="email"
                    className={`${erpInput} flex-1`}
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="accounts@sanchal.com"
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-16`}>Password</span>
                  <input
                    type="text"
                    className={`${erpInput} w-52 font-mono text-[10px]`}
                    value={formData.portalPassword}
                    onChange={(e) => handleFieldChange('portalPassword', e.target.value)}
                    placeholder="Portal Key / Password Hash"
                    disabled={readOnly}
                  />
                  <span className="text-[10px] font-mono text-[#334155] bg-[#f1f5f9] px-2 py-0.5 rounded-[1px] border border-gray-300 whitespace-nowrap">
                    {currentTime || '30/09/2026 5:29:52 PM'}
                  </span>
                </div>

                {/* Row 10: Web site | Designation | Signature */}
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-24`}>Web site</span>
                  <input
                    type="text"
                    className={`${erpInput} flex-1`}
                    value={formData.website}
                    onChange={(e) => handleFieldChange('website', e.target.value)}
                    placeholder="www.sanchalcreation.com"
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-20`}>Designation</span>
                  <input
                    type="text"
                    className={`${erpInput} w-36`}
                    value={formData.designation}
                    onChange={(e) => handleFieldChange('designation', e.target.value)}
                    placeholder="Proprietor / Partner"
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-16`}>Signature</span>
                  <input
                    type="text"
                    className={`${erpInput} w-40`}
                    value={formData.signature}
                    onChange={(e) => handleFieldChange('signature', e.target.value)}
                    placeholder="Authorized Signatory"
                    disabled={readOnly}
                  />
                </div>

                {/* Row 11: Pan No | New Gst No + Profile & FillData Buttons */}
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-24`}>Pan No</span>
                  <input
                    type="text"
                    className={`${erpInput} w-40 font-mono uppercase font-bold`}
                    value={formData.pan}
                    onChange={(e) => handleFieldChange('pan', e.target.value.toUpperCase())}
                    placeholder="DZPPB8552M"
                    maxLength={10}
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-24`}>New Gst No</span>
                  <input
                    type="text"
                    className={`${erpInput} w-52 font-mono uppercase font-bold`}
                    value={formData.gstin}
                    onChange={(e) => handleFieldChange('gstin', e.target.value.toUpperCase())}
                    placeholder="24DZPPB8552M2ZS"
                    maxLength={15}
                    disabled={readOnly}
                  />
                  <button
                    type="button"
                    onClick={handleGstProfile}
                    className="h-[21px] px-2.5 text-[10px] font-bold bg-[#475569] hover:bg-[#334155] text-white rounded-[1px] transition-colors shadow-xs"
                    title="Open Public GST Profile"
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleGstFillData}
                    className="h-[21px] px-2.5 text-[10px] font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[1px] transition-colors shadow-xs"
                    title="Auto-fill PAN and State Code from GSTIN"
                  >
                    FillData
                  </button>
                </div>

                {/* Row 12: MSME Number | State Code */}
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-24`}>MSME Number</span>
                  <input
                    type="text"
                    className={`${erpInput} w-48`}
                    value={formData.msmeNumber}
                    onChange={(e) => handleFieldChange('msmeNumber', e.target.value)}
                    placeholder="UDYAM-XX-00-0000000"
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-24`}>State Code</span>
                  <input
                    type="text"
                    className={`${erpInput} w-16 text-center font-bold`}
                    value={formData.stateCode}
                    onChange={(e) => handleFieldChange('stateCode', e.target.value)}
                    placeholder="24"
                    disabled={readOnly}
                  />
                  {formData.stateCode && (
                    <span className="text-[10px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-[1px]">
                      {stateNameFromCode(formData.stateCode) || 'Gujarat'}
                    </span>
                  )}
                </div>

                {/* Row 13: Tin Cst No | Tcs Applicable */}
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-24`}>Tin Cst No</span>
                  <input
                    type="text"
                    className={`${erpInput} w-48`}
                    value={formData.tinCstNo}
                    onChange={(e) => handleFieldChange('tinCstNo', e.target.value)}
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-24`}>Tcs Applicable</span>
                  <select
                    className={`${erpInput} w-24 font-bold`}
                    value={formData.tcsApplicable}
                    onChange={(e) => handleFieldChange('tcsApplicable', e.target.value)}
                    disabled={readOnly}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                {/* Row 14: Service Tax No | Tds Applicable */}
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-24`}>Service Tax No</span>
                  <input
                    type="text"
                    className={`${erpInput} w-48`}
                    value={formData.serviceTaxNo}
                    onChange={(e) => handleFieldChange('serviceTaxNo', e.target.value)}
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-24`}>Tds Applicable</span>
                  <select
                    className={`${erpInput} w-24 font-bold`}
                    value={formData.tdsApplicable}
                    onChange={(e) => handleFieldChange('tdsApplicable', e.target.value)}
                    disabled={readOnly}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {/* Row 15: TAN No. */}
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-24`}>TAN No.</span>
                  <input
                    type="text"
                    className={`${erpInput} w-48 uppercase font-mono`}
                    value={formData.tanNo}
                    onChange={(e) => handleFieldChange('tanNo', e.target.value.toUpperCase())}
                    placeholder="SRTA12345B"
                    disabled={readOnly}
                  />
                </div>

                {/* Row 16: From Date | To Date | Co Data Path | Co Type */}
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-24`}>From Date</span>
                  <input
                    type="date"
                    className={`${erpInput} w-32`}
                    value={formData.fyFrom}
                    onChange={(e) => handleFieldChange('fyFrom', e.target.value)}
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-16`}>To Date</span>
                  <input
                    type="date"
                    className={`${erpInput} w-32`}
                    value={formData.fyTo}
                    onChange={(e) => handleFieldChange('fyTo', e.target.value)}
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-24`}>Co Data Path</span>
                  <input
                    type="text"
                    className={`${erpInput} w-20 uppercase font-mono text-center`}
                    value={formData.coDataPath}
                    onChange={(e) => handleFieldChange('coDataPath', e.target.value.toUpperCase())}
                    placeholder="SC27"
                    disabled={readOnly}
                  />
                  <span className={`${erpLabel} w-16`}>Co Type</span>
                  <input
                    type="text"
                    className={`${erpInput} w-20 uppercase text-center font-bold`}
                    value={formData.coType}
                    onChange={(e) => handleFieldChange('coType', e.target.value.toUpperCase())}
                    placeholder="TEXT"
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: OTHERS */
            <div className="space-y-2 py-1">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-28`}>Group Code</span>
                  <input
                    type="text"
                    className={`${erpInput} flex-1 uppercase font-bold`}
                    value={formData.others?.groupCode || groupCode}
                    onChange={(e) => handleOthersChange('groupCode', e.target.value.toUpperCase())}
                    placeholder="Group Code"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-28`}>CIN No</span>
                  <input
                    type="text"
                    className={`${erpInput} flex-1 uppercase`}
                    value={formData.others?.cinNo}
                    onChange={(e) => handleOthersChange('cinNo', e.target.value.toUpperCase())}
                    placeholder="Corporate Identity No"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-28`}>IEC Number</span>
                  <input
                    type="text"
                    className={`${erpInput} flex-1 uppercase`}
                    value={formData.others?.iecNo}
                    onChange={(e) => handleOthersChange('iecNo', e.target.value.toUpperCase())}
                    placeholder="Import Export Code"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-28`}>Udyam Reg.</span>
                  <input
                    type="text"
                    className={`${erpInput} flex-1 uppercase`}
                    value={formData.others?.udyamNo}
                    onChange={(e) => handleOthersChange('udyamNo', e.target.value.toUpperCase())}
                    placeholder="UDYAM-XX-00-0000000"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-28`}>E-Way User</span>
                  <input
                    type="text"
                    className={`${erpInput} flex-1`}
                    value={formData.others?.ewayUsername}
                    onChange={(e) => handleOthersChange('ewayUsername', e.target.value)}
                    placeholder="E-Way Bill Username"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-28`}>E-Way Password</span>
                  <input
                    type="password"
                    className={`${erpInput} flex-1 font-mono`}
                    value={formData.others?.ewayPassword}
                    onChange={(e) => handleOthersChange('ewayPassword', e.target.value)}
                    placeholder="••••••••"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-28`}>E-Invoice User</span>
                  <input
                    type="text"
                    className={`${erpInput} flex-1`}
                    value={formData.others?.einvoiceUsername}
                    onChange={(e) => handleOthersChange('einvoiceUsername', e.target.value)}
                    placeholder="E-Invoice Username"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${erpLabel} w-28`}>E-Invoice Pwd</span>
                  <input
                    type="password"
                    className={`${erpInput} flex-1 font-mono`}
                    value={formData.others?.einvoicePassword}
                    onChange={(e) => handleOthersChange('einvoicePassword', e.target.value)}
                    placeholder="••••••••"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <span className={`${erpLabel} w-28`}>Jurisdiction</span>
                  <input
                    type="text"
                    className={`${erpInput} flex-1`}
                    value={formData.others?.jurisdiction}
                    onChange={(e) => handleOthersChange('jurisdiction', e.target.value)}
                    placeholder="Tax Ward / Circle / Jurisdiction Area"
                    disabled={readOnly}
                  />
                </div>
                <div className="flex items-start gap-2 col-span-2">
                  <span className={`${erpLabel} w-28 pt-1`}>Terms / Notes</span>
                  <textarea
                    rows={3}
                    className="flex-1 px-1.5 py-1 text-[11px] border border-[#a0a8b4] rounded-[1px] bg-white disabled:bg-[#f1f3f6] text-[#111827] focus:outline-none focus:border-[#2563eb]"
                    value={formData.others?.notes}
                    onChange={(e) => handleOthersChange('notes', e.target.value)}
                    placeholder="Invoice terms, statutory notes, or company remarks"
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>
          )}
        </form>

        {/* BOTTOM ACTION BUTTON BAR - Classic Light Desktop Style */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#e2e8f0] border-t border-[#cbd5e1]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleNew}
              className={`h-[27px] px-5 text-[11px] font-bold rounded-[2px] border border-gray-400 transition-all shadow-xs ${
                mode === 'new'
                  ? 'bg-[#1e40af] text-white ring-1 ring-blue-500'
                  : 'bg-white text-[#1e40af] hover:bg-blue-50'
              }`}
            >
              New
            </button>
            <button
              type="button"
              onClick={handleEdit}
              disabled={mode === 'edit' || mode === 'new'}
              className={`h-[27px] px-5 text-[11px] font-bold rounded-[2px] border border-gray-400 transition-all shadow-xs ${
                mode === 'edit'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-50'
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={readOnly || busy}
              className="h-[27px] px-5 text-[11px] font-bold rounded-[2px] border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-all shadow-xs"
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={readOnly}
              className="h-[27px] px-5 text-[11px] font-bold rounded-[2px] border border-gray-400 bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-50 transition-all shadow-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowFindModal(true)}
              className="h-[27px] px-5 text-[11px] font-bold rounded-[2px] border border-gray-400 bg-white text-gray-800 hover:bg-gray-100 transition-all shadow-xs flex items-center gap-1"
            >
              Find
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={mode === 'new' || !selectedId}
              className="h-[27px] px-5 text-[11px] font-bold rounded-[2px] border border-red-400 bg-white text-red-600 hover:bg-red-50 disabled:opacity-40 transition-all shadow-xs"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-[27px] px-5 text-[11px] font-bold rounded-[2px] border border-gray-400 bg-white text-gray-800 hover:bg-gray-100 transition-all shadow-xs"
            >
              Exit
            </button>
          </div>
          <div className="text-[10px] text-gray-600 font-medium">
            Press <kbd className="px-1 py-0.5 bg-gray-200 border border-gray-300 rounded font-mono">Esc</kbd> to Exit
          </div>
        </div>

        {/* BOTTOM CLASSIC ERP STATUS BAR (Exact Replica from Screenshot) */}
        <div className="flex items-center justify-between px-3 py-1 bg-black text-white text-[11px] font-mono tracking-wider">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="font-bold text-amber-300">
              | {formData.codeRef || formData.coCode || '100'} |
            </span>
            <span className="font-bold uppercase text-white truncate max-w-[280px]">
              {formData.name || 'SURAT DEMO TEXTILE MILLS PVT LTD'}
            </span>
            <span className="text-gray-300">| {fyYearDisplay} |</span>
            <span className="text-gray-300">{formData.coDataPath || 'SC27'} |</span>
            <span className="text-gray-300">{currentTime ? currentTime.split(' ')[0] : '30/09/2026'} |</span>
            <span className="text-gray-400 text-[10px]">Ver.20/07 - 17:0 |</span>
            <span className="text-emerald-400 font-bold">
              {currentTime ? currentTime.split(' ').slice(1).join(' ') : '06:01:38 PM'}
            </span>
          </div>
          <div className="w-10 h-2 bg-emerald-500 rounded-[1px] shrink-0 ml-2" title="Online System State" />
        </div>
      </div>

      {/* QUICK FIND / COMPANY SEARCH MODAL */}
      {showFindModal && (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-[640px] max-w-full bg-white border-2 border-[#1e40af] rounded-[3px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#1d4ed8] text-white">
              <span className="text-xs font-bold">Find Company in Group</span>
              <button
                type="button"
                onClick={() => setShowFindModal(false)}
                className="hover:bg-red-600 p-0.5 rounded"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-2.5 border-b border-gray-200 bg-gray-50">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by company name, code, GSTIN, or city..."
                  value={findFilter}
                  onChange={(e) => setFindFilter(e.target.value)}
                  className="w-full h-7 pl-8 pr-3 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 border-b">
                    <th className="p-1.5 text-left font-bold">Code</th>
                    <th className="p-1.5 text-left font-bold">Company Name</th>
                    <th className="p-1.5 text-left font-bold">GSTIN</th>
                    <th className="p-1.5 text-left font-bold">City</th>
                    <th className="p-1.5 text-center font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => handleSelectCompanyFromFind(c)}
                      className={`cursor-pointer border-b hover:bg-blue-50 ${
                        String(c.id) === String(selectedId) ? 'bg-blue-100 font-bold' : ''
                      }`}
                    >
                      <td className="p-1.5 font-mono">{c.coCode}</td>
                      <td className="p-1.5 uppercase">{c.name}</td>
                      <td className="p-1.5 font-mono">{c.gstin || '—'}</td>
                      <td className="p-1.5">{c.city || '—'}</td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCompanyFromFind(c);
                          }}
                          className="px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500">
                        No companies found matching search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-2 bg-gray-100 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setShowFindModal(false)}
                className="h-6 px-4 text-xs font-semibold bg-gray-200 border border-gray-300 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
