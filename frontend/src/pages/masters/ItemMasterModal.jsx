import React, { useRef, useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import useStore from '../../store/useStore';
import DataImportModal from '../../components/import/DataImportModal';
import { handleFormEnterKeyDown } from '../../utils/formEnterNavigation';
import { 
  Package, Search, Upload
} from 'lucide-react';

const GST_OPTIONS = [
  { value: 'GST 5%', label: 'GST 5%', rate: 5 },
  { value: 'GST 12%', label: 'GST 12%', rate: 12 },
  { value: 'GST 18%', label: 'GST 18%', rate: 18 },
  { value: 'GST 28%', label: 'GST 28%', rate: 28 },
  { value: 'GST FREE', label: 'GST FREE', rate: 0 },
  { value: 'GST JOBWORK', label: 'GST JOBWORK', rate: 5 },
  { value: 'GST MILL', label: 'GST MILL', rate: 5 },
];

const CATEGORY_OPTIONS = [
  { value: 'FINISH STOCK', label: 'FINISH STOCK' },
  { value: 'GREY', label: 'GREY' },
  { value: 'FINISHED', label: 'FINISHED' },
  { value: 'YARN', label: 'YARN' },
  { value: 'OTHERS', label: 'OTHERS' },
];

const UNIT_OPTIONS = [
  { value: 'PCS', label: 'PCS' },
  { value: 'MTRS', label: 'MTRS' },
  { value: 'NETQTY', label: 'NETQTY' },
  { value: 'KGS', label: 'KGS' },
  { value: 'BOX', label: 'BOX' },
];

const emptyForm = () => ({
  itemName: '',
  itemCode: '',
  hsnCode: '',
  group: 'FINISH STOCK',
  unit: 'PCS',
  opPcs: '0',
  cut: '0',
  opQty: '0',
  opRate: '0',
  opValue: '0',
  purRate: '0',
  salesRate: '0',
  mrp: '0',
  ewayBillProductName: '',
  description: '',
  gstTaxLabel: 'GST 5%',
  taxRate: '5',
  hindiName: '',
  imageUrl: '',
});

const toForm = (item) => {
  const rate = Number(item.taxRate ?? item.gstRate ?? 5);
  const label =
    item.gstTaxLabel ||
    (rate === 0 ? 'GST FREE' : GST_OPTIONS.find((g) => g.rate === rate)?.value || `GST ${rate}%`);
  return {
    itemName: item.itemName || item.name || '',
    itemCode: item.itemCode != null ? String(item.itemCode) : '',
    hsnCode: item.hsnCode || '',
    group: item.categoryLabel || item.group || item.category || 'FINISH STOCK',
    unit: item.unit || 'PCS',
    opPcs: String(item.openingPcs ?? item.opPcs ?? 0),
    cut: String(item.cut ?? 0),
    opQty: String(item.openingQty ?? item.opQty ?? item.openingStock ?? item.opStock ?? 0),
    opRate: String(item.openingRate ?? item.opRate ?? 0),
    opValue: String(item.openingValue ?? item.opValue ?? 0),
    purRate: String(item.purRate ?? item.purchaseRate ?? 0),
    salesRate: String(item.salesRate ?? 0),
    mrp: String(item.mrp ?? 0),
    ewayBillProductName: item.ewayBillProductName || '',
    description: item.description || '',
    gstTaxLabel: label,
    taxRate: String(rate),
    hindiName: item.hindiName || '',
    imageUrl: item.imageUrl || '',
  };
};

const ItemMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null, readOnly = false }) => {
  const { addItem, updateItem, deleteItem, items, fetchItems } = useStore();
  const [activeTab, setActiveTab] = useState('Form'); // 'Form' | 'List'
  const [mode, setMode] = useState('VIEW'); // 'VIEW' | 'ADD' | 'EDIT'
  const [formData, setFormData] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef(null);
  const itemNameRef = useRef(null);
  const searchInputRef = useRef(null);
  const [itemSearch, setItemSearch] = useState('');
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);

  // Filtered list for Find / Search
  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.itemName || it.name || '').toLowerCase().includes(q) ||
        (it.itemCode || '').toLowerCase().includes(q) ||
        (it.categoryLabel || it.group || it.category || '').toLowerCase().includes(q) ||
        (it.hsnCode || '').toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  const currentIndex = useMemo(() => {
    if (!editId || !items.length) return -1;
    return items.findIndex((it) => (it._id || it.id) === editId);
  }, [editId, items]);

  // Load record for edit or viewing
  const loadItem = (item, isEditMode = false) => {
    setEditId(item._id || item.id);
    setFormData(toForm(item));
    setMode(isEditMode && !readOnly ? 'EDIT' : 'VIEW');
    setActiveTab('Form');
    if (isEditMode) {
      setTimeout(() => {
        itemNameRef.current?.focus();
        try { itemNameRef.current?.select(); } catch {}
      }, 50);
    }
  };

  // On Modal Open: fetch items and load the MOST RECENT item in VIEW mode
  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, fetchItems]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      loadItem(initialData, !readOnly);
    } else if (items && items.length > 0) {
      // If we don't already have an item loaded, load the most recent one in VIEW mode
      if (!editId || !items.some(it => (it._id || it.id) === editId)) {
        const recent = items[items.length - 1];
        loadItem(recent, false);
      }
    } else {
      setEditId(null);
      setFormData(emptyForm());
      setMode('ADD');
      setActiveTab('Form');
    }
  }, [isOpen, initialData, items]);

  const setField = (key, value) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'opQty' || key === 'opRate') {
        const qty = Number(key === 'opQty' ? value : next.opQty) || 0;
        const rate = Number(key === 'opRate' ? value : next.opRate) || 0;
        next.opValue = String(Number((qty * rate).toFixed(2)));
      }
      if (key === 'gstTaxLabel') {
        const opt = GST_OPTIONS.find((g) => g.value === value);
        if (opt) next.taxRate = String(opt.rate);
      }
      return next;
    });
  };

  const navigateTo = (index) => {
    if (!items.length) return;
    const bounded = Math.max(0, Math.min(index, items.length - 1));
    const target = items[bounded];
    if (target) {
      loadItem(target, false);
    }
  };

  const handleFirst = () => navigateTo(0);
  const handlePrev = () => navigateTo(currentIndex <= 0 ? 0 : currentIndex - 1);
  const handleNext = () => navigateTo(currentIndex >= items.length - 1 ? items.length - 1 : (currentIndex < 0 ? 0 : currentIndex + 1));
  const handleLast = () => navigateTo(items.length - 1);

  const handleNew = () => {
    if (readOnly) return;
    setEditId(null);
    setFormData(emptyForm());
    setMode('ADD');
    setActiveTab('Form');
    setTimeout(() => {
      itemNameRef.current?.focus();
      try { itemNameRef.current?.select(); } catch {}
    }, 60);
  };

  const handleEdit = () => {
    if (readOnly) return;
    if (!editId) {
      notifyWarning('Please select an item first');
      return;
    }
    setMode('EDIT');
    setActiveTab('Form');
    setTimeout(() => {
      itemNameRef.current?.focus();
      try { itemNameRef.current?.select(); } catch {}
    }, 60);
  };

  const handleCancel = () => {
    if (editId) {
      const it = items.find(i => (i._id || i.id) === editId);
      if (it) loadItem(it, false);
      else setMode('VIEW');
    } else if (items.length > 0) {
      loadItem(items[items.length - 1], false);
    } else {
      setMode('VIEW');
    }
    setActiveTab('Form');
  };

  const handleFind = () => {
    setActiveTab('List');
    setTimeout(() => {
      searchInputRef.current?.focus();
      try { searchInputRef.current?.select(); } catch {}
    }, 60);
  };

  const handleSave = async () => {
    if (saving || readOnly) return;
    if (!formData.itemName?.trim()) {
      notifyWarning('Item name is required');
      itemNameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const opt = GST_OPTIONS.find((g) => g.value === formData.gstTaxLabel);
      const effectiveTaxRate = opt ? opt.rate : Number(formData.taxRate || 5);
      const qtyNum = Number(formData.opQty || 0);
      const rateNum = Number(formData.opRate || 0);
      const valNum = Number((qtyNum * rateNum).toFixed(2));

      const payload = {
        itemName: formData.itemName.trim(),
        name: formData.itemName.trim(),
        itemCode: formData.itemCode ? String(formData.itemCode).trim() : '',
        hsnCode: formData.hsnCode ? String(formData.hsnCode).trim() : '',
        group: formData.group || 'FINISH STOCK',
        category: formData.group === 'GREY' ? 'Grey' : formData.group === 'YARN' ? 'Yarn' : 'Finished',
        categoryLabel: formData.group || 'FINISH STOCK',
        unit: formData.unit || 'PCS',
        opPcs: Number(formData.opPcs || 0),
        openingPcs: Number(formData.opPcs || 0),
        cut: Number(formData.cut || 0),
        opQty: qtyNum,
        openingQty: qtyNum,
        openingStock: qtyNum,
        opStock: qtyNum,
        opRate: rateNum,
        openingRate: rateNum,
        opValue: valNum,
        openingValue: valNum,
        purRate: Number(formData.purRate || 0),
        purchaseRate: Number(formData.purRate || 0),
        salesRate: Number(formData.salesRate || 0),
        mrp: Number(formData.mrp || 0),
        ewayBillProductName: formData.ewayBillProductName ? String(formData.ewayBillProductName).trim() : '',
        description: formData.description ? String(formData.description).trim() : '',
        gstTaxLabel: formData.gstTaxLabel || 'GST 5%',
        taxRate: effectiveTaxRate,
        gstRate: effectiveTaxRate,
        hindiName: formData.hindiName ? String(formData.hindiName).trim() : '',
        imageUrl: formData.imageUrl || '',
      };

      let savedItem;
      if (mode === 'EDIT' && editId) {
        savedItem = await updateItem(editId, payload);
        notifySuccess('Item updated successfully');
      } else {
        savedItem = await addItem(payload);
        notifySuccess('Item saved successfully');
      }

      await fetchItems();
      const resultItem = savedItem || payload;

      // If invoked from an item picker (Sales, Purchase, Mill Issue, etc.), return item and close to advance forward!
      if (onSuccess) {
        onSuccess({ ...resultItem, id: resultItem?._id || resultItem?.id, _id: resultItem?._id || resultItem?.id });
        onClose?.();
        return;
      }

      // Otherwise stay on saved item in VIEW mode
      loadItem(resultItem, false);
    } catch (err) {
      notifyError(err, 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (readOnly) return;
    const targetId = id || editId;
    if (!targetId) return;
    if (!(await erpConfirm({ title: 'Delete Item', message: `Delete item "${formData.itemName}"?`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteItem(targetId);
      notifySuccess('Item deleted');
      await fetchItems();
      setEditId(null);
      setFormData(emptyForm());
      setMode('VIEW');
    } catch (err) {
      notifyError(err, 'Failed to delete item');
    }
  };

  const onBrowseImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notifyWarning('Image should be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setField('imageUrl', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  // Keyboard Navigation on Master Window
  const handleWindowKeyDown = (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      handleFind();
    } else if (e.key === 'F2') {
      e.preventDefault();
      if (mode === 'VIEW' && editId) {
        handleEdit();
      } else if (mode === 'VIEW') {
        handleNew();
      }
    } else if (e.key === 'Enter') {
      if (mode === 'VIEW' && activeTab === 'Form' && !e.target.closest('button')) {
        e.preventDefault();
        handleNew();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      if (mode === 'VIEW' && activeTab === 'Form' && !e.target.closest('button, select')) {
        e.preventDefault();
        handlePrev();
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      if (mode === 'VIEW' && activeTab === 'Form' && !e.target.closest('button, select')) {
        e.preventDefault();
        handleNext();
      }
    } else if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.altKey && e.key.toLowerCase() === 's')) {
      e.preventDefault();
      if (mode === 'ADD' || mode === 'EDIT') {
        handleSave();
      }
    }
  };

  const isFormLocked = readOnly || mode === 'VIEW';

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-[820px]">
      <div 
        className="classic-erp-window flex flex-col max-h-[92vh] bg-[#f8fafc] select-none text-slate-800 border-2 border-slate-700 shadow-2xl rounded-sm"
        tabIndex={0}
        onKeyDown={handleWindowKeyDown}
      >
        {/* Title Header Bar */}
        <div className="classic-erp-header flex items-center justify-between px-3 py-1.5 bg-[#1e293b] text-white">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-sky-400" />
            <span className="font-bold text-xs uppercase tracking-wider">Item Master ({items.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider ${
              mode === 'ADD' ? 'bg-emerald-600 text-white' : 
              mode === 'EDIT' ? 'bg-blue-600 text-white' : 
              'bg-slate-700 text-slate-200'
            }`}>
              {mode === 'ADD' ? '★ NEW ENTRY' : mode === 'EDIT' ? '✎ EDITING' : '👁 VIEW RECORD'}
            </span>
            <button
              type="button"
              className="text-white hover:bg-red-600 px-2 rounded text-sm font-bold"
              onClick={onClose}
              title="Close (Esc)"
            >
              ×
            </button>
          </div>
        </div>

        {/* Sub-bar Tabs */}
        <div className="flex items-center justify-between border-b border-slate-300 bg-[#e2e8f0] px-3 py-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('Form');
                if (mode === 'VIEW') handleNew();
              }}
              className={`px-3 py-1 text-xs font-bold rounded-sm border transition-all ${
                activeTab === 'Form' && mode === 'ADD'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : activeTab === 'Form'
                  ? 'bg-white text-slate-800 border-slate-300 shadow-xs'
                  : 'bg-slate-200 text-slate-700 border-transparent hover:bg-slate-300'
              }`}
            >
              Add Item
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('List')}
              className={`px-3 py-1 text-xs font-bold rounded-sm border transition-all ${
                activeTab === 'List'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-slate-200 text-slate-700 border-transparent hover:bg-slate-300'
              }`}
            >
              View List ({items.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="h-6 px-2.5 text-[11px] font-bold text-sky-800 bg-white hover:bg-sky-50 rounded-sm border border-slate-300 flex items-center gap-1 shadow-xs transition"
            >
              <Upload size={12} /> Import Items (Excel)
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-3 overflow-y-auto max-h-[calc(92vh-100px)] bg-slate-50">
          {activeTab === 'List' ? (
            /* ================= VIEW / FIND TABLE ================= */
            <div className="bg-white border border-slate-300 rounded shadow-xs p-3">
              <div className="flex items-center gap-2 mb-3">
                <Search size={16} className="text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setFocusedItemIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setFocusedItemIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setFocusedItemIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredItems[focusedItemIndex]) {
                        loadItem(filteredItems[focusedItemIndex], false);
                      }
                    }
                  }}
                  placeholder="Type to search by Item Name, Code, Category, HSN... (Arrow Keys + Enter to Select)"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:border-blue-600 focus:bg-white outline-none font-medium"
                />
              </div>

              <div className="overflow-x-auto max-h-[55vh]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-300 sticky top-0">
                    <tr>
                      <th className="p-2 border-r border-slate-200 w-24">Code</th>
                      <th className="p-2 border-r border-slate-200">Item Name</th>
                      <th className="p-2 border-r border-slate-200 w-32">Category</th>
                      <th className="p-2 border-r border-slate-200 w-20">Unit</th>
                      <th className="p-2 border-r border-slate-200 w-24">HSN</th>
                      <th className="p-2 border-r border-slate-200 w-24">Tax</th>
                      <th className="p-2 border-r border-slate-200 text-right w-24">Sale Rate</th>
                      <th className="p-2 border-r border-slate-200 text-right w-24">Pur Rate</th>
                      <th className="p-2 border-r border-slate-200 text-right w-24">Stock Qty</th>
                      <th className="p-2 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredItems.map((it, idx) => {
                      const isSelected = idx === focusedItemIndex;
                      return (
                        <tr
                          key={it._id || it.id || idx}
                          onClick={() => setFocusedItemIndex(idx)}
                          onDoubleClick={() => loadItem(it, false)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-blue-50 text-slate-800'
                          }`}
                        >
                          <td className="p-2 border-r border-slate-200 font-mono text-[11px]">{it.itemCode || '—'}</td>
                          <td className="p-2 border-r border-slate-200 font-bold uppercase">{it.itemName || it.name}</td>
                          <td className="p-2 border-r border-slate-200">{it.categoryLabel || it.group || it.category}</td>
                          <td className="p-2 border-r border-slate-200 font-mono">{it.unit || 'PCS'}</td>
                          <td className="p-2 border-r border-slate-200 font-mono">{it.hsnCode || '—'}</td>
                          <td className="p-2 border-r border-slate-200">{it.gstTaxLabel || `${it.taxRate || 5}%`}</td>
                          <td className="p-2 border-r border-slate-200 text-right font-mono">₹{it.salesRate || 0}</td>
                          <td className="p-2 border-r border-slate-200 text-right font-mono">₹{it.purRate || it.purchaseRate || 0}</td>
                          <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                            {it.openingQty ?? it.opQty ?? it.openingStock ?? 0}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadItem(it, false);
                              }}
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                isSelected ? 'bg-white text-blue-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-slate-400 italic">
                          No items match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ================= COMPACT & CLEAN FORM ================= */
            <div 
              className="flex gap-4 p-3 bg-white border border-slate-300 rounded shadow-xs" 
              onKeyDown={handleFormEnterKeyDown}
              data-form-enter-nav
            >
              {/* LEFT COLUMN: Exactly user's selected fields, compactly arranged */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {/* Row 1: Item Name */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">Item Name</span>
                  <input
                    ref={itemNameRef}
                    data-enter-order="1"
                    type="text"
                    value={formData.itemName}
                    onChange={(e) => setField('itemName', e.target.value)}
                    disabled={isFormLocked}
                    placeholder="ENTER ITEM NAME"
                    className="flex-1 h-7 border border-slate-400 bg-white px-2 text-xs font-bold uppercase rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                </div>

                {/* Row 2: ItemCode & Hsn Code */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">ItemCode</span>
                  <input
                    data-enter-order="2"
                    type="text"
                    value={formData.itemCode}
                    onChange={(e) => setField('itemCode', e.target.value)}
                    disabled={isFormLocked}
                    placeholder="0"
                    className="w-28 h-7 border border-slate-400 bg-white px-2 text-xs font-mono font-bold uppercase rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                  <span className="w-20 text-[11px] font-semibold text-slate-800 text-right pr-2 shrink-0">Hsn Code</span>
                  <input
                    data-enter-order="3"
                    type="text"
                    value={formData.hsnCode}
                    onChange={(e) => setField('hsnCode', e.target.value)}
                    disabled={isFormLocked}
                    placeholder="e.g. 5407"
                    className="w-32 h-7 border border-slate-400 bg-white px-2 text-xs font-mono font-bold uppercase rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                </div>

                {/* Row 3: Category & Unit */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">Category</span>
                  <select
                    data-enter-order="4"
                    value={formData.group}
                    onChange={(e) => setField('group', e.target.value)}
                    disabled={isFormLocked}
                    className="w-44 h-7 border border-slate-400 bg-white px-2 text-xs font-semibold uppercase rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="w-16 text-[11px] font-semibold text-slate-800 text-right pr-2 shrink-0">Unit</span>
                  <select
                    data-enter-order="5"
                    value={formData.unit}
                    onChange={(e) => setField('unit', e.target.value)}
                    disabled={isFormLocked}
                    className="w-24 h-7 border border-slate-400 bg-white px-2 text-xs font-semibold uppercase rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  >
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Row 4: Op.Pcs & Cut */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">Op.Pcs</span>
                  <input
                    data-enter-order="6"
                    type="number"
                    value={formData.opPcs}
                    onChange={(e) => setField('opPcs', e.target.value)}
                    disabled={isFormLocked}
                    className="w-24 h-7 border border-slate-400 bg-white px-2 text-xs font-mono text-right rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                  <span className="w-16 text-[11px] font-semibold text-slate-800 text-right pr-2 shrink-0">Cut</span>
                  <input
                    data-enter-order="7"
                    type="number"
                    step="0.01"
                    value={formData.cut}
                    onChange={(e) => setField('cut', e.target.value)}
                    disabled={isFormLocked}
                    className="w-24 h-7 border border-slate-400 bg-white px-2 text-xs font-mono text-right rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                </div>

                {/* Row 5: Op.Qty, Op.Rate, Op.Value */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">Op.Qty</span>
                  <input
                    data-enter-order="8"
                    type="number"
                    step="0.01"
                    value={formData.opQty}
                    onChange={(e) => setField('opQty', e.target.value)}
                    disabled={isFormLocked}
                    className="w-24 h-7 border border-slate-400 bg-white px-2 text-xs font-mono font-bold text-right rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100 text-blue-900"
                  />
                  <span className="w-16 text-[11px] font-semibold text-slate-800 text-right pr-2 shrink-0">Op.Rate</span>
                  <input
                    data-enter-order="9"
                    type="number"
                    step="0.01"
                    value={formData.opRate}
                    onChange={(e) => setField('opRate', e.target.value)}
                    disabled={isFormLocked}
                    className="w-24 h-7 border border-slate-400 bg-white px-2 text-xs font-mono text-right rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                  <span className="w-16 text-[11px] font-semibold text-slate-800 text-right pr-2 shrink-0">Op.Value</span>
                  <input
                    tabIndex={-1}
                    data-enter-skip="true"
                    type="number"
                    disabled
                    value={formData.opValue}
                    className="w-28 h-7 border border-slate-300 bg-slate-100 px-2 text-xs font-mono font-bold text-right rounded-none text-emerald-800"
                  />
                </div>

                {/* Row 6: Pu.Rate, Sl.Rate, MRP */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">Pu.Rate</span>
                  <input
                    data-enter-order="10"
                    type="number"
                    step="0.01"
                    value={formData.purRate}
                    onChange={(e) => setField('purRate', e.target.value)}
                    disabled={isFormLocked}
                    className="w-24 h-7 border border-slate-400 bg-white px-2 text-xs font-mono font-bold text-right rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                  <span className="w-16 text-[11px] font-semibold text-slate-800 text-right pr-2 shrink-0">Sl.Rate</span>
                  <input
                    data-enter-order="11"
                    type="number"
                    step="0.01"
                    value={formData.salesRate}
                    onChange={(e) => setField('salesRate', e.target.value)}
                    disabled={isFormLocked}
                    className="w-24 h-7 border border-slate-400 bg-white px-2 text-xs font-mono font-bold text-right text-blue-900 rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                  <span className="w-14 text-[11px] font-semibold text-slate-800 text-right pr-2 shrink-0">MRP</span>
                  <input
                    data-enter-order="12"
                    type="number"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => setField('mrp', e.target.value)}
                    disabled={isFormLocked}
                    className="w-24 h-7 border border-slate-400 bg-white px-2 text-xs font-mono text-right rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                </div>

                {/* Row 7: Eway Bill Prod.Name */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">Eway Bill Prod.Name</span>
                  <input
                    data-enter-order="13"
                    type="text"
                    value={formData.ewayBillProductName}
                    onChange={(e) => setField('ewayBillProductName', e.target.value)}
                    disabled={isFormLocked}
                    className="flex-1 h-7 border border-slate-400 bg-white px-2 text-xs rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                </div>

                {/* Row 8: Description */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">Description</span>
                  <input
                    data-enter-order="14"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setField('description', e.target.value)}
                    disabled={isFormLocked}
                    className="flex-1 h-7 border border-slate-400 bg-white px-2 text-xs rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                </div>

                {/* Row 9: GST TAX RATE */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-bold text-slate-800 shrink-0">GST TAX RATE</span>
                  <select
                    data-enter-order="15"
                    value={formData.gstTaxLabel}
                    onChange={(e) => setField('gstTaxLabel', e.target.value)}
                    disabled={isFormLocked}
                    className="w-56 h-7 border border-slate-400 bg-white px-2 text-xs font-bold text-blue-900 rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  >
                    {GST_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>

                {/* Row 10: Hindi Name */}
                <div className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-800 shrink-0">Hindi Name</span>
                  <input
                    data-enter-order="16"
                    type="text"
                    value={formData.hindiName}
                    onChange={(e) => setField('hindiName', e.target.value)}
                    disabled={isFormLocked}
                    placeholder="Hindi name / हिंदी नाम"
                    className="flex-1 h-7 border border-slate-400 bg-white px-2 text-xs rounded-none focus:border-blue-600 focus:bg-amber-50/40 outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Clean Image box with Browse & Remove Image */}
              <div className="w-48 flex flex-col gap-2 shrink-0 border-l border-slate-200 pl-3">
                <div className="flex gap-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    tabIndex={-1}
                    data-enter-skip="true"
                    onChange={onBrowseImage}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    data-enter-skip="true"
                    disabled={isFormLocked}
                    onClick={() => fileRef.current?.click()}
                    className="flex-1 h-7 border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded-none disabled:opacity-40"
                  >
                    Brows Image
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-enter-skip="true"
                    disabled={isFormLocked || !formData.imageUrl}
                    onClick={() => setField('imageUrl', '')}
                    className="flex-1 h-7 border border-slate-400 bg-slate-100 hover:bg-rose-50 text-slate-800 text-[11px] font-semibold rounded-none disabled:opacity-40"
                  >
                    Remove Image
                  </button>
                </div>

                <div className="w-full h-44 border border-slate-400 bg-white flex items-center justify-center overflow-hidden rounded-none shadow-inner">
                  {formData.imageUrl ? (
                    <img
                      src={formData.imageUrl}
                      alt="Item Preview"
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">No image</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop ERP Footer: Navigation & Action Buttons */}
        <div className="bg-[#e2e8f0] border-t border-slate-300 px-3 py-2 flex items-center justify-between gap-2 shadow-xs">
          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button 
              type="button" 
              className="h-8 px-2.5 border border-slate-400 bg-white hover:bg-slate-100 text-xs font-bold rounded-none disabled:opacity-40" 
              onClick={handleFirst} 
              disabled={!items.length} 
              title="First Record"
            >
              &lt;
            </button>
            <button 
              type="button" 
              className="h-8 px-2.5 border border-slate-400 bg-white hover:bg-slate-100 text-xs font-bold rounded-none disabled:opacity-40" 
              onClick={handlePrev} 
              disabled={!items.length} 
              title="Previous Record"
            >
              &lt;&lt;
            </button>
            <button 
              type="button" 
              className="h-8 px-2.5 border border-slate-400 bg-white hover:bg-slate-100 text-xs font-bold rounded-none disabled:opacity-40" 
              onClick={handleNext} 
              disabled={!items.length} 
              title="Next Record"
            >
              &gt;&gt;
            </button>
            <button 
              type="button" 
              className="h-8 px-2.5 border border-slate-400 bg-white hover:bg-slate-100 text-xs font-bold rounded-none disabled:opacity-40" 
              onClick={handleLast} 
              disabled={!items.length} 
              title="Last Record"
            >
              &gt;
            </button>
            
            {currentIndex >= 0 && (
              <span className="text-xs font-mono font-bold text-slate-700 px-2.5 py-1 bg-white border border-slate-300 rounded-none ml-1">
                Record: {currentIndex + 1} / {items.length}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNew}
              disabled={readOnly}
              className="h-8 px-4 border border-slate-400 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 rounded-none shadow-xs"
              title="New Item (Enter in View mode)"
            >
              New / Clear
            </button>

            {mode === 'VIEW' && editId && !readOnly && (
              <button
                type="button"
                onClick={handleEdit}
                className="h-8 px-4 border border-blue-500 bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 rounded-none shadow-xs"
                title="Edit Item (F2)"
              >
                Edit (F2)
              </button>
            )}

            <button
              type="button"
              data-enter-save="true"
              onClick={handleSave}
              disabled={readOnly || (mode !== 'ADD' && mode !== 'EDIT') || saving}
              className="h-8 px-6 border border-blue-700 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-none shadow-sm disabled:opacity-50"
              title="Save Item (Enter on last field / Alt+S / Ctrl+Enter)"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            {(mode === 'ADD' || mode === 'EDIT') && (
              <button
                type="button"
                onClick={handleCancel}
                className="h-8 px-4 border border-slate-400 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-none shadow-xs"
                title="Cancel (Esc)"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 border border-slate-400 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 rounded-none shadow-xs"
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      {showImport && (
        <DataImportModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          defaultEntity="items"
          onImportComplete={fetchItems}
        />
      )}
    </Modal>
  );
};

export default ItemMasterModal;
