import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import MasterFindOverlay from '../../components/erp/MasterFindOverlay';
import useStore from '../../store/useStore';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirmDelete } from '../../utils/confirm';
import { Search } from 'lucide-react';

const GROUP_TYPES = [
  'EXPENCES',
  'INCOME',
  'ASSETS',
  'LIABILITIES',
  'TRADING EXP',
  'TRADING INC',
  'CAPITAL ACCOUNT',
  'LOANS & ADVANCES'
];

const DEFAULT_FORM = {
  groupHead: '',
  graccd: '',
  primary: 'N',
  mainGroup: '',
  groupType: 'EXPENCES',
  indexCd: '0',
  active: true,
  // Optional Fields
  broker: false,
  transport: false,
  optMainGroup: false,
  dueDays: false,
  interestCommi: false,
  adat: false,
  cstTinNo: false,
  gstTinNo: false,
  panNo: false,
  maxLimit: false,
  minLimit: false,
  tdsPer: false,
  eduPer: false,
  drCr: 'DR',
};

const AccountGroupMasterModal = ({ isOpen, onClose, readOnly = false }) => {
  const { subMasters, fetchSubMasters, addSubMaster, updateSubMaster, deleteSubMaster } = useStore();

  const [mode, setMode] = useState('VIEW'); // 'VIEW' | 'ADD' | 'EDIT'
  const [selectedId, setSelectedId] = useState(null);
  const [findOpen, setFindOpen] = useState(false); // F3 list
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);

  const groupHeadRef = useRef(null);
  const primaryRef = useRef(null);
  const searchInputRef = useRef(null);
  const saveBtnRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchSubMasters('AccountGroup');
      setSearchQuery('');
    }
  }, [isOpen]);

  const groupList = useMemo(() => {
    return subMasters
      .filter((sm) => sm.type === 'AccountGroup')
      .map((sm) => {
        const ex = sm.extraFields || {};
        return {
          id: sm._id,
          name: sm.name || '',
          graccd: ex.graccd || sm.name.replace(/\D/g, '').slice(-3) || '101',
          primary: ex.primary || 'N',
          mainGroup: ex.mainGroup || '',
          groupType: ex.groupType || 'EXPENCES',
          indexCd: ex.indexCd ?? '0',
          active: ex.active !== false,
          optionalFields: ex.optionalFields || {},
          raw: sm,
        };
      });
  }, [subMasters]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupList;
    return groupList.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        String(g.graccd).toLowerCase().includes(q) ||
        g.groupType.toLowerCase().includes(q) ||
        g.mainGroup.toLowerCase().includes(q)
    );
  }, [groupList, searchQuery]);

  const mainGroupOptions = useMemo(() => {
    const set = new Set(['EXPENCES', 'INCOME', 'ASSETS', 'LIABILITIES', 'SUNDRY DEBTORS', 'SUNDRY CREDITORS']);
    groupList.forEach((g) => {
      if (g.name) set.add(g.name);
    });
    return Array.from(set);
  }, [groupList]);

  const loadGroup = (group, editMode = false) => {
    setSelectedId(group.id);
    const opts = group.optionalFields || {};
    setFormData({
      groupHead: group.name,
      graccd: group.graccd,
      primary: group.primary,
      mainGroup: group.mainGroup,
      groupType: group.groupType,
      indexCd: String(group.indexCd ?? '0'),
      active: group.active,
      broker: !!opts.broker,
      transport: !!opts.transport,
      optMainGroup: !!opts.mainGroup,
      dueDays: !!opts.dueDays,
      interestCommi: !!opts.interestCommi,
      adat: !!opts.adat,
      cstTinNo: !!opts.cstTinNo,
      gstTinNo: !!opts.gstTinNo,
      panNo: !!opts.panNo,
      maxLimit: !!opts.maxLimit,
      minLimit: !!opts.minLimit,
      tdsPer: !!opts.tdsPer,
      eduPer: !!opts.eduPer,
      drCr: opts.drCr || 'DR',
    });
    setMode(editMode && !readOnly ? 'EDIT' : 'VIEW');
  };

  useEffect(() => {
    if (!isOpen) return;
    if (groupList.length > 0) {
      if (!selectedId || !groupList.some(g => g.id === selectedId)) {
        const recent = groupList[groupList.length - 1];
        loadGroup(recent, false);
      }
    } else {
      setMode(readOnly ? 'VIEW' : 'ADD');
      setFormData({ ...DEFAULT_FORM, graccd: String(Date.now()).slice(-3) });
      setSelectedId(null);
    }
  }, [isOpen, groupList, readOnly]);

  const currentIndex = useMemo(() => {
    if (!selectedId || !filteredGroups.length) return -1;
    return filteredGroups.findIndex((g) => g.id === selectedId);
  }, [selectedId, filteredGroups]);

  const navigateTo = (index) => {
    if (!filteredGroups.length) return;
    const bounded = Math.max(0, Math.min(index, filteredGroups.length - 1));
    const target = filteredGroups[bounded];
    if (target) {
      loadGroup(target, false);
      setFocusedRowIndex(bounded);
    }
  };

  const handleFirst = () => navigateTo(0);
  const handlePrev = () => navigateTo(currentIndex <= 0 ? 0 : currentIndex - 1);
  const handleNext = () => navigateTo(currentIndex >= filteredGroups.length - 1 ? filteredGroups.length - 1 : (currentIndex < 0 ? 0 : currentIndex + 1));
  const handleLast = () => navigateTo(filteredGroups.length - 1);

  const handleNew = () => {
    if (readOnly) return;
    const nextCode = groupList.length ? Math.max(...groupList.map((g) => Number(g.graccd) || 100)) + 1 : 101;
    setFormData({ ...DEFAULT_FORM, graccd: String(nextCode) });
    setSelectedId(null);
    setMode('ADD');
    setTimeout(() => {
      groupHeadRef.current?.focus();
      try { groupHeadRef.current?.select(); } catch {}
    }, 50);
  };

  const handleEdit = () => {
    if (readOnly) return;
    if (!selectedId) {
      if (filteredGroups.length > 0) {
        loadGroup(filteredGroups[0], true);
      } else {
        notifyWarning('Please select an Account Group to edit');
        return;
      }
    } else {
      setMode('EDIT');
    }
    setTimeout(() => groupHeadRef.current?.focus(), 50);
  };

  const handleCancel = () => {
    if (selectedId) {
      const g = groupList.find((x) => x.id === selectedId);
      if (g) loadGroup(g, false);
      else setMode('VIEW');
    } else {
      handleNew();
      setMode('VIEW');
    }
  };

  const handleFind = () => setFindOpen(true);

  const handleDelete = async () => {
    if (readOnly || !selectedId) {
      notifyWarning('Please select a group to delete');
      return;
    }
    if (!(await erpConfirmDelete(`Account Group "${formData.groupHead}"`))) return;
    try {
      await deleteSubMaster(selectedId);
      notifySuccess('Account Group deleted');
      handleNew();
      fetchSubMasters('AccountGroup');
    } catch (err) {
      notifyError(err, 'Failed to delete Account Group');
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (readOnly) return;
    if (!formData.groupHead?.trim()) {
      notifyWarning('Group Head name is required');
      groupHeadRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        type: 'AccountGroup',
        name: formData.groupHead.trim(),
        extraFields: {
          graccd: formData.graccd || '101',
          primary: formData.primary.toUpperCase() === 'Y' ? 'Y' : 'N',
          mainGroup: formData.mainGroup,
          groupType: formData.groupType,
          indexCd: formData.indexCd,
          active: formData.active,
          optionalFields: {
            broker: formData.broker,
            transport: formData.transport,
            mainGroup: formData.optMainGroup,
            dueDays: formData.dueDays,
            interestCommi: formData.interestCommi,
            adat: formData.adat,
            cstTinNo: formData.cstTinNo,
            gstTinNo: formData.gstTinNo,
            panNo: formData.panNo,
            maxLimit: formData.maxLimit,
            minLimit: formData.minLimit,
            tdsPer: formData.tdsPer,
            eduPer: formData.eduPer,
            drCr: formData.drCr,
          },
        },
      };

      if (mode === 'EDIT' && selectedId) {
        await updateSubMaster(selectedId, payload);
        notifySuccess('Account Group updated successfully');
      } else {
        await addSubMaster(payload);
        notifySuccess('Account Group saved successfully');
      }

      await fetchSubMasters('AccountGroup');
      setMode('VIEW');
    } catch (err) {
      notifyError(err, 'Failed to save Account Group');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation on list (ArrowUp, ArrowDown, Enter)
  const handleTableKeyDown = (e) => {
    if (filteredGroups.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(focusedRowIndex + 1, filteredGroups.length - 1);
      setFocusedRowIndex(next);
      loadGroup(filteredGroups[next], false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(focusedRowIndex - 1, 0);
      setFocusedRowIndex(prev);
      loadGroup(filteredGroups[prev], false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredGroups[focusedRowIndex]) {
        loadGroup(filteredGroups[focusedRowIndex], true);
        setTimeout(() => groupHeadRef.current?.focus(), 50);
      }
    }
  };

  const isLocked = readOnly || mode === 'VIEW';

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-5xl">
      <div
        className="classic-erp-window select-none text-slate-800"
        data-form-enter-nav="true"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'F3') {
            e.preventDefault();
            handleFind();
          } else if (e.key === 'F2') {
            e.preventDefault();
            if (mode === 'VIEW' && selectedId) {
              handleEdit();
            } else if (mode === 'VIEW') {
              handleNew();
            }
          } else if (e.key === 'Enter') {
            if (mode === 'VIEW' && !e.target.closest('button, input, select, textarea')) {
              e.preventDefault();
              handleNew();
            }
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            if (mode === 'VIEW' && !e.target.closest('button, input, select, textarea')) {
              e.preventDefault();
              handlePrev();
            }
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            if (mode === 'VIEW' && !e.target.closest('button, input, select, textarea')) {
              e.preventDefault();
              handleNext();
            }
          } else if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.altKey && e.key.toLowerCase() === 's')) {
            e.preventDefault();
            if (mode === 'ADD' || mode === 'EDIT') {
              handleSave();
            }
          }
        }}
      >
        {/* Title Bar (matching JSM header) */}
        <div className="classic-erp-header flex items-center justify-between bg-[#0a246a] text-white px-2.5 py-1 text-xs font-bold shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 bg-yellow-400 rounded-sm"></span>
            <span>Account Group Master</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] bg-blue-900/80 px-2 py-0.5 rounded font-mono font-normal">
              Mode: <strong className={mode === 'ADD' ? 'text-yellow-300' : mode === 'EDIT' ? 'text-emerald-300' : 'text-gray-200'}>{mode}</strong>
            </span>
            <button
              type="button"
              className="w-5 h-5 flex items-center justify-center bg-[#d9534f] hover:bg-[#c9302c] text-white font-bold rounded-sm text-xs cursor-pointer ml-1"
              onClick={onClose}
              title="Close (Alt+X / Esc)"
              data-action="exit"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Content: Left Form & Right Grid */}
        <div className="grid grid-cols-12 gap-2 p-2 bg-[#f4f6fa] border-b border-[#b0b8c8]">
          {/* LEFT FORM PANEL (cols 1-7) */}
          <div className="col-span-7 bg-[#ebedf2] p-2.5 rounded border border-[#c2c8d6] shadow-inner space-y-2">
            {/* Row 1: Group Head & Graccd */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-gray-700 w-24 shrink-0">Group Head</label>
              <input
                ref={groupHeadRef}
                type="text"
                disabled={isLocked}
                value={formData.groupHead}
                onChange={(e) => setFormData({ ...formData, groupHead: e.target.value.toUpperCase() })}
                placeholder="e.g. SUNDRY CREDITORS / EXPENCES"
                className="flex-1 bg-white border border-[#9aa4b8] px-2 py-1 text-xs font-bold text-slate-900 focus:bg-amber-50 focus:border-blue-600 outline-none rounded-none disabled:bg-gray-100 disabled:text-gray-600"
              />
              <span className="text-[11px] font-mono text-gray-600 shrink-0 font-semibold">
                Graccd: <strong className="text-blue-800">{formData.graccd || '101'}</strong>
              </span>
            </div>

            {/* Row 2: Primary & Main Group */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-gray-700 w-24 shrink-0">Primary</label>
              <input
                ref={primaryRef}
                type="text"
                maxLength={1}
                disabled={isLocked}
                value={formData.primary}
                onChange={(e) => setFormData({ ...formData, primary: (e.target.value || 'N').toUpperCase() })}
                className="w-12 text-center bg-white border border-[#9aa4b8] px-1 py-1 text-xs font-bold text-slate-900 focus:bg-amber-50 focus:border-blue-600 outline-none rounded-none disabled:bg-gray-100"
              />
              <label className="text-[11px] font-bold text-gray-700 shrink-0 ml-2">Main Group</label>
              <select
                disabled={isLocked}
                value={formData.mainGroup}
                onChange={(e) => setFormData({ ...formData, mainGroup: e.target.value })}
                className="flex-1 bg-white border border-[#9aa4b8] px-2 py-1 text-xs text-slate-900 focus:bg-amber-50 focus:border-blue-600 outline-none rounded-none disabled:bg-gray-100"
              >
                <option value="">- Select Main Group -</option>
                {mainGroupOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Row 3: Group Type */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-gray-700 w-24 shrink-0">Group Type</label>
              <select
                disabled={isLocked}
                value={formData.groupType}
                onChange={(e) => setFormData({ ...formData, groupType: e.target.value })}
                className="w-56 bg-white border border-[#9aa4b8] px-2 py-1 text-xs font-bold text-slate-900 focus:bg-amber-50 focus:border-blue-600 outline-none rounded-none disabled:bg-gray-100"
              >
                {GROUP_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Row 4: Index Cd & Active */}
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-bold text-gray-700 w-24 shrink-0">Index Cd</label>
              <input
                type="number"
                disabled={isLocked}
                value={formData.indexCd}
                onChange={(e) => setFormData({ ...formData, indexCd: e.target.value })}
                className="w-20 bg-white border border-[#9aa4b8] px-2 py-1 text-xs font-mono text-slate-900 focus:bg-amber-50 focus:border-blue-600 outline-none rounded-none disabled:bg-gray-100"
              />
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none bg-[#0a246a] text-white text-[11px] font-bold px-2.5 py-1 rounded-sm shadow-sm">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="accent-blue-400 w-3.5 h-3.5 cursor-pointer"
                />
                Active
              </label>
            </div>

            {/* Fieldset: Optional Fields */}
            <fieldset className="border border-[#a5b0c4] rounded-sm p-2 pt-1.5 bg-[#f0f2f7]">
              <legend className="text-[10px] font-bold text-blue-900 uppercase tracking-wider px-1">
                Optional Fields
              </legend>

              <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] pt-1">
                {/* Column 1 */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.broker}
                      onChange={(e) => setFormData({ ...formData, broker: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Broker</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.transport}
                      onChange={(e) => setFormData({ ...formData, transport: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Transport</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.optMainGroup}
                      onChange={(e) => setFormData({ ...formData, optMainGroup: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Main Group</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.dueDays}
                      onChange={(e) => setFormData({ ...formData, dueDays: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Due Days</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.interestCommi}
                      onChange={(e) => setFormData({ ...formData, interestCommi: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Interest & Commi%</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.adat}
                      onChange={(e) => setFormData({ ...formData, adat: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Adat %</span>
                  </label>
                </div>

                {/* Column 2 */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.cstTinNo}
                      onChange={(e) => setFormData({ ...formData, cstTinNo: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Cst Tin No</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.gstTinNo}
                      onChange={(e) => setFormData({ ...formData, gstTinNo: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Gst Tin No</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.panNo}
                      onChange={(e) => setFormData({ ...formData, panNo: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Pan No</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.maxLimit}
                      onChange={(e) => setFormData({ ...formData, maxLimit: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Max Limit</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.minLimit}
                      onChange={(e) => setFormData({ ...formData, minLimit: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Min Limit</span>
                  </label>
                </div>

                {/* Column 3 */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.tdsPer}
                      onChange={(e) => setFormData({ ...formData, tdsPer: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Tds %</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={formData.eduPer}
                      onChange={(e) => setFormData({ ...formData, eduPer: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700">Edu %</span>
                  </label>

                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-[11px] font-bold text-gray-700">Dr/Cr</span>
                    <select
                      disabled={isLocked}
                      value={formData.drCr}
                      onChange={(e) => setFormData({ ...formData, drCr: e.target.value })}
                      className="w-16 bg-white border border-[#9aa4b8] px-1 py-0.5 text-xs font-bold focus:bg-amber-50 outline-none rounded-none"
                    >
                      <option value="DR">DR</option>
                      <option value="CR">CR</option>
                    </select>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          {/* RIGHT LIST / GRID PANEL (cols 8-12) */}
          <div className="col-span-5 flex flex-col bg-[#808080] p-1.5 rounded border border-[#606060] text-slate-900 shadow-inner">
            {/* Search Input for F3 Find */}
            <div className="relative mb-1">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                data-master-find="true"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleTableKeyDown}
                placeholder="Find (F3) — Type to search groups..."
                className="w-full pl-7 pr-2 py-0.5 text-[11px] bg-white border border-gray-400 focus:bg-yellow-50 focus:border-blue-700 outline-none rounded-none font-sans"
              />
            </div>

            {/* List Table with Keyboard Arrow Navigation */}
            <div
              ref={tableRef}
              tabIndex={0}
              onKeyDown={handleTableKeyDown}
              className="flex-1 overflow-y-auto bg-[#c0c0c0] border border-[#404040] min-h-[260px] max-h-[290px] outline-none select-none"
            >
              <table className="w-full text-[11px] border-collapse bg-white">
                <thead className="sticky top-0 bg-[#d4d0c8] text-slate-800 border-b border-[#808080] text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-1.5 py-1 text-left border-r border-[#a0a0a0] w-14">Graccd</th>
                    <th className="px-1.5 py-1 text-left border-r border-[#a0a0a0]">Group Head</th>
                    <th className="px-1.5 py-1 text-left border-r border-[#a0a0a0] w-12">Pri</th>
                    <th className="px-1.5 py-1 text-left border-r border-[#a0a0a0]">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((grp, index) => {
                    const isSelected = selectedId === grp.id || (!selectedId && index === focusedRowIndex);
                    return (
                      <tr
                        key={grp.id}
                        onClick={() => {
                          setFocusedRowIndex(index);
                          loadGroup(grp, false);
                        }}
                        onDoubleClick={() => {
                          setFocusedRowIndex(index);
                          loadGroup(grp, true);
                          setTimeout(() => groupHeadRef.current?.focus(), 50);
                        }}
                        className={`cursor-pointer transition-colors border-b border-gray-100 ${
                          isSelected
                            ? 'bg-[#000080] text-white font-bold'
                            : index % 2 === 0
                            ? 'bg-white hover:bg-blue-50 text-slate-900'
                            : 'bg-[#f7f8fa] hover:bg-blue-50 text-slate-900'
                        }`}
                      >
                        <td className="px-1.5 py-0.5 border-r border-gray-200 font-mono text-center">
                          {grp.graccd}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-gray-200 truncate max-w-[120px]">
                          {grp.name}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-gray-200 text-center">
                          {grp.primary}
                        </td>
                        <td className="px-1.5 py-0.5 truncate max-w-[100px] text-[10px]">
                          {grp.groupType}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-500 italic bg-white">
                        No groups found. Press New to create.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION TOOLBAR (Identical to JSM Screenshot 2) */}
        <div className="bg-[#d4d0c8] p-1.5 border-t border-[#808080] flex items-center justify-between gap-1 flex-wrap select-none">
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-action="first"
              onClick={handleFirst}
              disabled={!filteredGroups.length}
              className="px-2.5 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800 shadow-sm cursor-pointer disabled:opacity-50"
              title="First Record (<)"
            >
              &lt;
            </button>
            <button
              type="button"
              data-action="prev"
              onClick={handlePrev}
              disabled={!filteredGroups.length}
              className="px-2.5 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800 shadow-sm cursor-pointer disabled:opacity-50"
              title="Previous Record (<<)"
            >
              &lt;&lt;
            </button>
            <button
              type="button"
              data-action="next"
              onClick={handleNext}
              disabled={!filteredGroups.length}
              className="px-2.5 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800 shadow-sm cursor-pointer disabled:opacity-50"
              title="Next Record (>>)"
            >
              &gt;&gt;
            </button>
            <button
              type="button"
              data-action="last"
              onClick={handleLast}
              disabled={!filteredGroups.length}
              className="px-2.5 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800 shadow-sm cursor-pointer disabled:opacity-50"
              title="Last Record (>)"
            >
              &gt;
            </button>
            {currentIndex >= 0 && (
              <span className="text-[11px] font-mono text-gray-600 px-1">
                {currentIndex + 1} / {filteredGroups.length}
              </span>
            )}
            <button
              type="button"
              data-action="new"
              onClick={handleNew}
              disabled={readOnly}
              className={`px-3 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] active:bg-[#a0a0a0] shadow-sm cursor-pointer ${
                mode === 'ADD' ? 'bg-[#0000d0] text-white border-blue-900 ring-2 ring-blue-400' : 'text-slate-800'
              }`}
              title="Add New Group (Alt+N / F2)"
            >
              New
            </button>

            <button
              type="button"
              data-action="edit"
              onClick={handleEdit}
              disabled={readOnly}
              className={`px-3 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] active:bg-[#a0a0a0] shadow-sm cursor-pointer ${
                mode === 'EDIT' ? 'bg-[#0000d0] text-white border-blue-900 ring-2 ring-blue-400' : 'text-slate-800'
              }`}
              title="Edit Group (Alt+E)"
            >
              Edit
            </button>

            <button
              ref={saveBtnRef}
              type="button"
              data-action="save"
              data-enter-save="true"
              onClick={handleSave}
              disabled={readOnly || mode === 'VIEW' || isSubmitting}
              className="px-3 py-1 text-xs font-bold border border-[#2b542c] bg-[#28a745] hover:bg-[#218838] active:bg-[#1e7e34] text-white shadow-sm cursor-pointer disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-400"
              title="Save Record (Alt+S / Enter on Save)"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>

            <button
              type="button"
              data-action="cancel"
              onClick={handleCancel}
              className="px-3 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800 shadow-sm cursor-pointer"
              title="Cancel (Alt+C)"
            >
              Cancel
            </button>

            <button
              type="button"
              data-action="find"
              data-master-find="true"
              onClick={handleFind}
              className="px-3 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800 shadow-sm cursor-pointer"
              title="Find / Search (F3)"
            >
              Find
            </button>

            <button
              type="button"
              data-action="delete"
              onClick={handleDelete}
              disabled={readOnly || !selectedId}
              className="px-3 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#d9534f] hover:text-white text-slate-800 shadow-sm cursor-pointer disabled:opacity-50"
              title="Delete Selected Group (Alt+D)"
            >
              Delete
            </button>

            <button
              type="button"
              data-action="exit"
              onClick={onClose}
              className="px-3 py-1 text-xs font-bold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800 shadow-sm cursor-pointer"
              title="Exit (Alt+X / Esc)"
            >
              Exit
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleFind}
              className="px-2.5 py-1 text-[11px] font-semibold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800"
            >
              Sp.Find
            </button>
            <button
              type="button"
              onClick={() => notifySuccess('Default Index reset')}
              className="px-2.5 py-1 text-[11px] font-semibold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800"
            >
              Default Idx
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={readOnly || mode === 'VIEW'}
              className="px-2.5 py-1 text-[11px] font-semibold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => notifySuccess('Index Set applied')}
              className="px-2.5 py-1 text-[11px] font-semibold border border-[#808080] bg-[#e0dfd8] hover:bg-[#c0c0c0] text-slate-800"
            >
              Index Set
            </button>
          </div>
        </div>
      </div>
      <MasterFindOverlay
        open={findOpen}
        title="FIND ACCOUNT GROUP"
        rows={groupList.map((g) => ({ id: g.id, no: g.graccd, name: g.name, meta: [g.groupType, g.mainGroup].filter(Boolean).join(' · ') }))}
        onPick={(id) => { setFindOpen(false); const g = groupList.find((x) => x.id === id); if (g) loadGroup(g, false); }}
        onClose={() => setFindOpen(false)}
      />
    </Modal>
  );
};

export default AccountGroupMasterModal;
