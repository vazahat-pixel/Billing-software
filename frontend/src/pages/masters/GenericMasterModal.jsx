import React, { useState, useEffect, useMemo, useRef } from 'react';
import useStore from '../../store/useStore';
import Modal from '../../components/ui/Modal';
import { Plus, Edit2, Save, X, Search, Trash2, FileText } from 'lucide-react';
import { erpConfirmDelete } from '../../utils/confirm';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notify';

const GenericMasterModal = ({ isOpen, onClose, type, readOnly = false }) => {
  const { subMasters, fetchSubMasters, addSubMaster, updateSubMaster, deleteSubMaster } = useStore();

  // Mode: 'VIEW' | 'ADD' | 'EDIT'
  const [mode, setMode] = useState('VIEW');
  const [selectedId, setSelectedId] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Goods');
  const [sgstRate, setSgstRate] = useState('2.5');
  const [cgstRate, setCgstRate] = useState('2.5');
  const [igstRate, setIgstRate] = useState('5');
  const [cessRate, setCessRate] = useState('0');

  // Transport & location fields
  const [transporterId, setTransporterId] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [route, setRoute] = useState('');
  const [stateName, setStateName] = useState('24-GUJARAT');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [branch, setBranch] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [ratio, setRatio] = useState('1');
  const [description, setDescription] = useState('');

  // Table search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const searchInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleTableKeyDown = (e) => {
    if (!filteredList || filteredList.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(focusedIndex + 1, filteredList.length - 1);
      setFocusedIndex(next);
      loadRecord(filteredList[next], false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(focusedIndex - 1, 0);
      setFocusedIndex(prev);
      loadRecord(filteredList[prev], false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredList[focusedIndex]) {
        loadRecord(filteredList[focusedIndex], true);
        setTimeout(() => nameInputRef.current?.focus(), 50);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setCode('');
    setCategory('Goods');
    setSgstRate('2.5');
    setCgstRate('2.5');
    setIgstRate('5');
    setCessRate('0');
    setTransporterId('');
    setPhone('');
    setContactPerson('');
    setRoute('');
    setStateName('24-GUJARAT');
    setPincode('');
    setCity('');
    setBranch('');
    setIfsc('');
    setRatio('1');
    setDescription('');
    setSelectedId(null);
    setErrorMsg('');
  };

  useEffect(() => {
    if (isOpen && type) {
      fetchSubMasters(type);
      resetForm();
      setSearchQuery('');
      setMode(readOnly ? 'VIEW' : 'ADD');
    }
  }, [isOpen, type]);

  // Compute readable title
  const title = useMemo(() => {
    switch (type) {
      case 'AccountGroup': return 'Account Main Group Master';
      case 'AccountHead': return 'Account Head Master';
      case 'BookType': return 'Book Type Master';
      case 'ItemGroup': return 'Item Group Master';
      case 'Unit': return 'Unit Master';
      case 'ItemTaxSlab': return 'Item Tax Slab Master';
      case 'City': return 'Station / City Master';
      case 'Transport': return 'Transport Master';
      case 'Type': return 'Transaction Type Master';
      case 'OtherMaster': return 'Other Master';
      case 'Color': return 'Colour Master';
      case 'Design': return 'Design Master';
      case 'HSN': return 'HSN Master';
      case 'Quality': return 'Quality Master';
      case 'Pattern': return 'Pattern Master';
      case 'Brand': return 'Brand Master';
      case 'Shade': return 'Shade Master';
      case 'Process': return 'Process Master';
      case 'Machine': return 'Machine Master';
      case 'Department': return 'Department Master';
      case 'PaymentTerms': return 'Payment Terms Master';
      case 'Currency': return 'Currency Master';
      case 'Size': return 'Size Master';
      case 'Area': return 'Area Master';
      case 'PartyBank': return 'Party Bank Master';
      default: return type ? `${type} Master` : 'Master Registry';
    }
  }, [type]);

  const filteredList = useMemo(() => {
    return subMasters.filter(item => {
      if (item.type !== type) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const nm = (item.name || '').toLowerCase();
      const cd = (item.extraFields?.code || item.extraFields?.transporterId || '').toLowerCase();
      const cat = (item.extraFields?.category || '').toLowerCase();
      return nm.includes(q) || cd.includes(q) || cat.includes(q);
    });
  }, [subMasters, type, searchQuery]);

  // Load record for edit or viewing
  const loadRecord = (item, editMode = false) => {
    setSelectedId(item._id);
    setName(item.name || '');
    const ex = item.extraFields || {};
    setCode(ex.code || '');
    setCategory(ex.category || 'Goods');
    setSgstRate(String(ex.sgstRate ?? '2.5'));
    setCgstRate(String(ex.cgstRate ?? '2.5'));
    setIgstRate(String(ex.igstRate ?? ex.gstRate ?? '5'));
    setCessRate(String(ex.cessRate ?? '0'));
    setTransporterId(ex.transporterId || '');
    setPhone(ex.phone || '');
    setContactPerson(ex.contactPerson || '');
    setRoute(ex.route || '');
    setStateName(ex.state || '24-GUJARAT');
    setPincode(ex.pincode || '');
    setCity(ex.city || '');
    setBranch(ex.branch || '');
    setIfsc(ex.ifsc || '');
    setRatio(String(ex.ratio ?? '1'));
    setDescription(ex.description || '');
    setErrorMsg('');
    setMode(editMode && !readOnly ? 'EDIT' : 'VIEW');
  };

  // Tax slab auto-split: changing IGST splits equally into SGST and CGST
  const handleIgstChange = (val) => {
    setIgstRate(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const half = (num / 2).toFixed(2).replace(/\.00$/, '');
      setSgstRate(half);
      setCgstRate(half);
    }
  };

  const handleNew = () => {
    if (readOnly) return;
    resetForm();
    setMode('ADD');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleEdit = () => {
    if (readOnly || !selectedId) {
      notifyWarning('Please select a record from the list to edit');
      return;
    }
    setMode('EDIT');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleCancel = () => {
    resetForm();
    setMode('VIEW');
  };

  const handleFind = () => {
    searchInputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (readOnly) return;
    setErrorMsg('');

    if (type === 'HSN') {
      if (!code.trim() || code.trim().length < 4) {
        setErrorMsg('Valid HSN code (at least 4 digits) is required');
        return;
      }
      if (!name.trim()) {
        setErrorMsg('Description is required');
        return;
      }
    } else if (!name.trim()) {
      setErrorMsg('Master Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      let extraFields = {};
      if (type === 'ItemTaxSlab') {
        extraFields = {
          code: code.trim(),
          category,
          sgstRate: Number(sgstRate || 0),
          cgstRate: Number(cgstRate || 0),
          igstRate: Number(igstRate || 0),
          gstRate: Number(igstRate || 0),
          cessRate: Number(cessRate || 0)
        };
      } else if (type === 'Transport') {
        extraFields = {
          transporterId: transporterId.trim(),
          phone: phone.trim(),
          contactPerson: contactPerson.trim(),
          route: route.trim(),
          code: code.trim()
        };
      } else if (type === 'City') {
        extraFields = {
          state: stateName.trim(),
          pincode: pincode.trim(),
          code: code.trim()
        };
      } else if (type === 'HSN') {
        extraFields = {
          code: code.trim(),
          description: name.trim(),
          gstRate: Number(igstRate || 5)
        };
      } else if (type === 'Size') {
        extraFields = {
          code: code.trim(),
          ratio: Number(ratio || 1)
        };
      } else if (type === 'Area') {
        extraFields = {
          city: city.trim(),
          pincode: pincode.trim()
        };
      } else if (type === 'PartyBank') {
        extraFields = {
          branch: branch.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          accountType: category
        };
      } else {
        extraFields = {
          code: code.trim(),
          category,
          description: description.trim()
        };
      }

      const payload = {
        type,
        name: name.trim(),
        extraFields
      };

      if (mode === 'EDIT' && selectedId) {
        await updateSubMaster(selectedId, payload);
        notifySuccess(`${title} record updated`);
      } else {
        await addSubMaster(payload);
        notifySuccess(`${title} record saved`);
      }

      resetForm();
      setMode('VIEW');
      fetchSubMasters(type);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (readOnly) return;
    if (!(await erpConfirmDelete('this master record'))) return;
    try {
      await deleteSubMaster(id);
      notifySuccess('Record deleted');
      if (selectedId === id) resetForm();
    } catch (err) {
      notifyError(err, 'Failed to delete record');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-4xl">
      <div
        className="classic-erp-window flex flex-col max-h-[92vh]"
        data-form-enter-nav="true"
        onKeyDown={(e) => {
          if (e.key === 'F3') {
            e.preventDefault();
            searchInputRef.current?.focus();
            try { searchInputRef.current?.select(); } catch {}
          }
        }}
      >
        {/* Header */}
        <div className="classic-erp-header flex items-center justify-between">
          <span className="font-bold tracking-wide flex items-center gap-2">
            <FileText size={13} /> {title}
          </span>
          <button type="button" className="classic-erp-close-btn" onClick={onClose} data-action="exit" title="Exit (Alt+X / Esc)">×</button>
        </div>

        {/* JSM Standard Desktop Action Bar */}
        <div className="bg-[#e8ebf0] border-b border-[var(--border)] px-3 py-1.5 flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-action="new"
              onClick={handleNew}
              disabled={readOnly}
              className={`classic-erp-btn ${mode === 'ADD' ? 'btn-blue font-bold shadow-sm' : ''}`}
              title="Add New Record (Alt+N / F2)"
            >
              <Plus size={11} /> New
            </button>
            <button
              type="button"
              data-action="edit"
              onClick={handleEdit}
              disabled={readOnly || !selectedId}
              className={`classic-erp-btn ${mode === 'EDIT' ? 'btn-blue font-bold shadow-sm' : ''}`}
              title="Edit Selected Record (Alt+E)"
            >
              <Edit2 size={11} /> Edit
            </button>
            <button
              type="button"
              data-action="save"
              data-enter-save="true"
              onClick={handleSubmit}
              disabled={readOnly || (mode !== 'ADD' && mode !== 'EDIT') || isSubmitting}
              className="classic-erp-btn btn-green font-bold"
              title="Save Record (Alt+S / Enter on Save)"
            >
              <Save size={11} /> Save
            </button>
            <button
              type="button"
              data-action="cancel"
              onClick={handleCancel}
              className="classic-erp-btn"
              title="Cancel Current Operation (Alt+C / Esc)"
            >
              <X size={11} /> Cancel
            </button>
            <button
              type="button"
              data-action="find"
              data-master-find-btn="true"
              onClick={handleFind}
              className="classic-erp-btn"
              title="Find / Search Records (F3)"
            >
              <Search size={11} /> Find
            </button>
            {selectedId && (
              <button
                type="button"
                data-action="delete"
                onClick={() => handleDelete(selectedId)}
                disabled={readOnly}
                className="classic-erp-btn btn-red"
                title="Delete Selected Record (Alt+D)"
              >
                <Trash2 size={11} /> Delete
              </button>
            )}
          </div>

          <div className="text-[11px] font-mono text-[var(--text-muted)] font-semibold">
            Mode: <span className={mode === 'ADD' ? 'text-blue-600 font-bold' : mode === 'EDIT' ? 'text-amber-600 font-bold' : 'text-gray-600'}>{mode}</span>
          </div>
        </div>

        {/* Master Input Form Section */}
        <div className={`p-3 border-b border-[var(--border)] transition-colors ${mode !== 'VIEW' ? 'bg-[#fcfdfd]' : 'bg-[#f8f9fa]'}`}>
          <form onSubmit={handleSubmit} className="space-y-2">
            {type === 'ItemTaxSlab' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <label className="classic-erp-label red-label">Tax Slab Name *</label>
                    <input
                      ref={nameInputRef}
                      className="classic-erp-input w-full mt-0.5"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. GST 5% (TAXABLE)"
                      disabled={readOnly || mode === 'VIEW'}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="classic-erp-label">Slab Code</label>
                    <input
                      className="classic-erp-input w-full mt-0.5 font-mono"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="e.g. SLAB05"
                      disabled={readOnly || mode === 'VIEW'}
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="classic-erp-label">Category</label>
                    <select
                      className="classic-erp-select w-full mt-0.5"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      disabled={readOnly || mode === 'VIEW'}
                    >
                      <option value="Goods">Goods (Fabrics / Yarn / Garments)</option>
                      <option value="Services">Services (Job Work / Transport)</option>
                      <option value="Both">Both (Goods & Services)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-dashed border-[var(--border)]">
                  <div>
                    <label className="classic-erp-label red-label">IGST % *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="classic-erp-input w-full mt-0.5 text-right font-bold"
                      value={igstRate}
                      onChange={e => handleIgstChange(e.target.value)}
                      placeholder="5.00"
                      disabled={readOnly || mode === 'VIEW'}
                    />
                  </div>
                  <div>
                    <label className="classic-erp-label">SGST %</label>
                    <input
                      type="number"
                      step="0.01"
                      className="classic-erp-input w-full mt-0.5 text-right font-mono"
                      value={sgstRate}
                      onChange={e => setSgstRate(e.target.value)}
                      placeholder="2.50"
                      disabled={readOnly || mode === 'VIEW'}
                    />
                  </div>
                  <div>
                    <label className="classic-erp-label">CGST %</label>
                    <input
                      type="number"
                      step="0.01"
                      className="classic-erp-input w-full mt-0.5 text-right font-mono"
                      value={cgstRate}
                      onChange={e => setCgstRate(e.target.value)}
                      placeholder="2.50"
                      disabled={readOnly || mode === 'VIEW'}
                    />
                  </div>
                  <div>
                    <label className="classic-erp-label">CESS %</label>
                    <input
                      type="number"
                      step="0.01"
                      className="classic-erp-input w-full mt-0.5 text-right font-mono"
                      value={cessRate}
                      onChange={e => setCessRate(e.target.value)}
                      placeholder="0.00"
                      disabled={readOnly || mode === 'VIEW'}
                    />
                  </div>
                </div>
              </div>
            ) : type === 'Transport' ? (
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <label className="classic-erp-label red-label">Transport Name *</label>
                  <input
                    ref={nameInputRef}
                    className="classic-erp-input w-full mt-0.5"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Surat Delhi Roadways"
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-3">
                  <label className="classic-erp-label">Transporter ID / GSTIN</label>
                  <input
                    className="classic-erp-input w-full mt-0.5 font-mono uppercase"
                    value={transporterId}
                    onChange={e => setTransporterId(e.target.value)}
                    placeholder="15-digit GSTIN / Trans ID"
                    maxLength={15}
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-2">
                  <label className="classic-erp-label">Phone / Mobile</label>
                  <input
                    className="classic-erp-input w-full mt-0.5"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Phone No"
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-3">
                  <label className="classic-erp-label">Route / Destination</label>
                  <input
                    className="classic-erp-input w-full mt-0.5"
                    value={route}
                    onChange={e => setRoute(e.target.value)}
                    placeholder="e.g. Surat - Delhi Daily"
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
              </div>
            ) : type === 'City' ? (
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="classic-erp-label red-label">Station / City Name *</label>
                  <input
                    ref={nameInputRef}
                    className="classic-erp-input w-full mt-0.5"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Surat, Mumbai, Ahmedabad"
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-4">
                  <label className="classic-erp-label">State</label>
                  <input
                    className="classic-erp-input w-full mt-0.5"
                    value={stateName}
                    onChange={e => setStateName(e.target.value)}
                    placeholder="24-GUJARAT"
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-3">
                  <label className="classic-erp-label">Pincode</label>
                  <input
                    className="classic-erp-input w-full mt-0.5 font-mono"
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    placeholder="395002"
                    maxLength={6}
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
              </div>
            ) : type === 'HSN' ? (
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-3">
                  <label className="classic-erp-label red-label">HSN Code *</label>
                  <input
                    ref={nameInputRef}
                    className="classic-erp-input w-full mt-0.5 font-mono font-bold"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="5208"
                    maxLength={8}
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-6">
                  <label className="classic-erp-label red-label">Description *</label>
                  <input
                    className="classic-erp-input w-full mt-0.5"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Woven fabrics of cotton"
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-3">
                  <label className="classic-erp-label">GST Rate %</label>
                  <input
                    type="number"
                    step="0.01"
                    className="classic-erp-input w-full mt-0.5 font-mono text-right"
                    value={igstRate}
                    onChange={e => setIgstRate(e.target.value)}
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <label className="classic-erp-label red-label">{type} Name *</label>
                  <input
                    ref={nameInputRef}
                    className="classic-erp-input w-full mt-0.5"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={`Enter ${type} name`}
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-3">
                  <label className="classic-erp-label">Code / Key</label>
                  <input
                    className="classic-erp-input w-full mt-0.5 font-mono"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Code"
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
                <div className="col-span-3">
                  <label className="classic-erp-label">Category / Note</label>
                  <input
                    className="classic-erp-input w-full mt-0.5"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Category"
                    disabled={readOnly || mode === 'VIEW'}
                  />
                </div>
              </div>
            )}
          </form>
          {errorMsg && <p className="text-[11px] text-[var(--red)] font-semibold mt-1.5">{errorMsg}</p>}
        </div>

        {/* Master Registry Table / Grid */}
        <div className="classic-erp-body flex-1 min-h-0 flex flex-col p-3">
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              data-master-find="true"
              placeholder={`Find (F3) in ${title} (Search name, code, category)...`}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setFocusedIndex(0);
              }}
              onKeyDown={handleTableKeyDown}
              className="classic-erp-input w-full pl-8"
            />
          </div>

          <div
            className="classic-erp-table-container flex-1 min-h-[220px]"
            tabIndex={0}
            onKeyDown={handleTableKeyDown}
          >
            <table className="classic-erp-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>{type === 'HSN' ? 'HSN Code' : 'Name'}</th>
                  {type === 'ItemTaxSlab' ? (
                    <>
                      <th>Code</th>
                      <th>Category</th>
                      <th className="text-right">SGST%</th>
                      <th className="text-right">CGST%</th>
                      <th className="text-right">IGST%</th>
                      <th className="text-right">CESS%</th>
                    </>
                  ) : type === 'Transport' ? (
                    <>
                      <th>Transporter ID</th>
                      <th>Phone</th>
                      <th>Route</th>
                    </>
                  ) : type === 'City' ? (
                    <>
                      <th>State</th>
                      <th>Pincode</th>
                    </>
                  ) : type === 'HSN' ? (
                    <>
                      <th>Description</th>
                      <th className="text-right">GST %</th>
                    </>
                  ) : (
                    <>
                      <th>Code</th>
                      <th>Category / Note</th>
                    </>
                  )}
                  <th className="text-right" style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((item, index) => {
                  const isSelected = selectedId === item._id || (!selectedId && index === focusedIndex);
                  const ex = item.extraFields || {};
                  return (
                    <tr
                      key={item._id}
                      onClick={() => loadRecord(item, false)}
                      onDoubleClick={() => loadRecord(item, true)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 font-medium' : 'hover:bg-slate-50'}`}
                    >
                      <td className="text-center font-mono text-[10px] text-gray-500">{index + 1}</td>
                      <td className="font-medium text-slate-800">
                        {type === 'HSN' ? (ex.code || item.name) : item.name}
                      </td>

                      {type === 'ItemTaxSlab' ? (
                        <>
                          <td className="font-mono text-gray-600">{ex.code || '—'}</td>
                          <td><span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-semibold">{ex.category || 'Goods'}</span></td>
                          <td className="text-right font-mono">{ex.sgstRate ?? '—'}%</td>
                          <td className="text-right font-mono">{ex.cgstRate ?? '—'}%</td>
                          <td className="text-right font-mono font-bold text-blue-700">{ex.igstRate ?? ex.gstRate ?? 5}%</td>
                          <td className="text-right font-mono">{ex.cessRate ?? 0}%</td>
                        </>
                      ) : type === 'Transport' ? (
                        <>
                          <td className="font-mono text-xs">{ex.transporterId || '—'}</td>
                          <td>{ex.phone || '—'}</td>
                          <td>{ex.route || '—'}</td>
                        </>
                      ) : type === 'City' ? (
                        <>
                          <td>{ex.state || '24-GUJARAT'}</td>
                          <td className="font-mono">{ex.pincode || '—'}</td>
                        </>
                      ) : type === 'HSN' ? (
                        <>
                          <td>{ex.description || item.name}</td>
                          <td className="text-right font-mono font-bold">{ex.gstRate ?? 5}%</td>
                        </>
                      ) : (
                        <>
                          <td className="font-mono text-gray-600">{ex.code || '—'}</td>
                          <td>{ex.category || ex.description || '—'}</td>
                        </>
                      )}

                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => loadRecord(item, true)}
                                className="classic-erp-btn"
                                style={{ height: 22, padding: '0 6px' }}
                                title="Edit this record"
                              >
                                <Edit2 size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item._id)}
                                className="classic-erp-btn btn-red"
                                style={{ height: 22, padding: '0 6px' }}
                                title="Delete this record"
                              >
                                <Trash2 size={10} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={type === 'ItemTaxSlab' ? 9 : 6} className="text-center text-[var(--text-muted)] py-8">
                      No {title} records found. Click <strong>[ + New ]</strong> to register one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-[#f0f2f5] border-t border-[var(--border)] px-3 py-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>Total Records: <strong className="text-black">{filteredList.length}</strong></span>
          <span>Tip: Double-click row to Edit &bull; Auto-calcs SGST/CGST from IGST</span>
        </div>
      </div>
    </Modal>
  );
};

export default GenericMasterModal;
