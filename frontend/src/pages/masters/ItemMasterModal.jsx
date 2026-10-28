import React, { useRef, useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, FormField } from '../../components/forms/FormElements';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import useStore from '../../store/useStore';
import DataImportModal from '../../components/import/DataImportModal';
import { handleFormEnterKeyDown } from '../../utils/formEnterNavigation';

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
  { value: 'GREY', label: 'GREY' },
  { value: 'FINISH STOCK', label: 'FINISH STOCK' },
  { value: 'FINISHED', label: 'FINISHED' },
  { value: 'YARN', label: 'YARN' },
  { value: 'OTHERS', label: 'OTHERS' },
];

const UNIT_OPTIONS = [
  { value: 'MTRS', label: 'MTRS' },
  { value: 'PCS', label: 'PCS' },
  { value: 'NETQTY', label: 'NETQTY' },
  { value: 'KGS', label: 'KGS' },
  { value: 'BOX', label: 'BOX' },
];

const emptyForm = () => ({
  itemName: '',
  itemCode: '',
  group: 'FINISH STOCK',
  unit: 'NETQTY',
  hsnDigits: '0',
  hsnCode: '',
  gstTaxLabel: 'GST 5%',
  taxRate: '5',
  salesRate: '0',
  purRate: '0',
  mrp: '0',
  opPcs: '0',
  cut: '0',
  opQty: '0',
  opRate: '0',
  opValue: '0',
  fold: '0',
  reed: '',
  pick: '',
  warpCount: '',
  weftCount: '',
  denier: '',
  quality: '',
  widthPanna: '',
  reorderLevel: '0',
  ewayBillProductName: '',
  description: '',
  imageUrl: '',
  // JSM Item Master fields
  itemChrCode: '',
  vatRate1: '0',
  vatRate2: '0',
  delCharge: '0',
  cessRate: '0',
  lfrRate: '0',
  partyGroup: '',
  bundle: '0',
  salesProfitPer: '0',
  jobRate: '0',
  maxLevel: '0',
  minLevel: '0',
  showIn: 'All',
  ewayProductDesc2: '',
  gstTaxLabel2: '',
  negativeStockMessage: false,
  hindiName: '',
  brand: '',
});

const toForm = (item) => {
  const rate = Number(item.taxRate ?? item.gstRate ?? 5);
  const label =
    item.gstTaxLabel ||
    (rate === 0 ? 'GST FREE' : GST_OPTIONS.find((g) => g.rate === rate)?.value || `GST ${rate}%`);
  return {
    itemName: item.itemName || item.name || '',
    itemCode: item.itemCode || '',
    brand: item.brand || '',
    group: item.categoryLabel || item.group || item.category || 'FINISH STOCK',
    unit: item.unit || 'NETQTY',
    hsnDigits: String(item.hsnDigits ?? 0),
    hsnCode: item.hsnCode || '',
    gstTaxLabel: label,
    taxRate: String(rate),
    salesRate: String(item.salesRate ?? 0),
    purRate: String(item.purRate ?? item.purchaseRate ?? 0),
    mrp: String(item.mrp ?? 0),
    opPcs: String(item.openingPcs ?? item.opPcs ?? 0),
    cut: String(item.cut ?? 0),
    opQty: String(item.openingQty ?? item.opQty ?? item.openingStock ?? item.opStock ?? 0),
    opRate: String(item.openingRate ?? item.opRate ?? 0),
    opValue: String(item.openingValue ?? item.opValue ?? 0),
    fold: String(item.fold ?? 0),
    reed: item.reed || '',
    pick: item.pick || '',
    warpCount: item.warpCount || item.warp || '',
    weftCount: item.weftCount || item.weft || '',
    denier: item.denier || '',
    quality: item.quality || '',
    widthPanna: item.widthPanna || '',
    reorderLevel: String(item.reorderLevel ?? 0),
    ewayBillProductName: item.ewayBillProductName || '',
    description: item.description || '',
    imageUrl: item.imageUrl || '',
    itemChrCode: item.itemChrCode || '',
    vatRate1: String(item.vatRate1 ?? 0),
    vatRate2: String(item.vatRate2 ?? 0),
    delCharge: String(item.delCharge ?? 0),
    cessRate: String(item.cessRate ?? 0),
    lfrRate: String(item.lfrRate ?? 0),
    partyGroup: item.partyGroup || '',
    bundle: String(item.bundle ?? 0),
    salesProfitPer: String(item.salesProfitPer ?? 0),
    jobRate: String(item.jobRate ?? 0),
    maxLevel: String(item.maxLevel ?? 0),
    minLevel: String(item.minLevel ?? 0),
    showIn: item.showIn || 'All',
    ewayProductDesc2: item.ewayProductDesc2 || '',
    gstTaxLabel2: item.gstTaxLabel2 || '',
    negativeStockMessage: !!item.negativeStockMessage,
    hindiName: item.hindiName || '',
  };
};

const ItemMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null, readOnly = false }) => {
  const { addItem, updateItem, deleteItem, items, fetchItems } = useStore();
  const [activeTab, setActiveTab] = useState('Add');
  const [formData, setFormData] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef(null);
  const itemCodeRef = useRef(null);
  const itemNameRef = useRef(null);
  const searchInputRef = useRef(null);
  const [itemSearch, setItemSearch] = useState('');
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);

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

  const handleItemListKeyDown = (e) => {
    if (!filteredItems.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedItemIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedItemIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[focusedItemIndex]) {
        loadForEdit(filteredItems[focusedItemIndex]);
      }
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'Add') {
      const t = setTimeout(() => {
        // JSM Mst_Item_Mast: the cursor starts in Item Name (tab 0)
        itemNameRef.current?.focus();
        try { itemNameRef.current?.select(); } catch {}
      }, 70);
      return () => clearTimeout(t);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isOpen) fetchItems();
  }, [isOpen, fetchItems]);

  useEffect(() => {
    if (initialData) {
      setFormData(toForm(initialData));
      setEditId(initialData._id || initialData.id || null);
      setActiveTab('Add');
    } else if (isOpen && !editId) {
      setFormData(emptyForm());
    }
  }, [initialData, isOpen]);

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

  const loadForEdit = (item) => {
    setEditId(item._id);
    setFormData(toForm(item));
    setActiveTab('Add');
  };

  const handleCopy = (item) => {
    setEditId(null);
    setFormData({
      ...toForm(item),
      itemName: `Copy of ${item.itemName || item.name || ''}`,
      itemCode: '',
    });
    setActiveTab('Add');
  };

  const onBrowseImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      notifyWarning('Image should be under 1.5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setField('imageUrl', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const currentIndex = useMemo(() => {
    if (!editId || !items.length) return -1;
    return items.findIndex((it) => (it._id || it.id) === editId);
  }, [editId, items]);

  const navigateTo = (index) => {
    if (!items.length) return;
    const bounded = Math.max(0, Math.min(index, items.length - 1));
    const target = items[bounded];
    if (target) {
      loadForEdit(target);
    }
  };

  const handleFirst = () => navigateTo(0);
  const handlePrev = () => navigateTo(currentIndex <= 0 ? 0 : currentIndex - 1);
  const handleNext = () => navigateTo(currentIndex >= items.length - 1 ? items.length - 1 : (currentIndex < 0 ? 0 : currentIndex + 1));
  const handleLast = () => navigateTo(items.length - 1);

  const handleSave = async () => {
    if (saving) return;
    if (!formData.itemName?.trim()) return notifyWarning('Item name is required');
    setSaving(true);
    try {
      const payload = {
        itemName: formData.itemName.trim(),
        name: formData.itemName.trim(),
        itemCode: formData.itemCode,
        brand: formData.brand || '',
        group: formData.group,
        categoryLabel: formData.group,
        unit: formData.unit,
        hsnDigits: Number(formData.hsnDigits || 0),
        hsnCode: formData.hsnCode,
        gstTaxLabel: formData.gstTaxLabel,
        taxRate: Number(formData.taxRate),
        gstRate: Number(formData.taxRate),
        salesRate: Number(formData.salesRate),
        purRate: Number(formData.purRate),
        purchaseRate: Number(formData.purRate),
        mrp: Number(formData.mrp),
        opPcs: Number(formData.opPcs),
        openingPcs: Number(formData.opPcs),
        cut: Number(formData.cut),
        fold: Number(formData.fold || 0),
        reed: formData.reed || '',
        pick: formData.pick || '',
        warpCount: formData.warpCount || '',
        weftCount: formData.weftCount || '',
        denier: formData.denier || '',
        quality: formData.quality || '',
        widthPanna: formData.widthPanna || '',
        reorderLevel: Number(formData.reorderLevel || 0),
        opQty: Number(formData.opQty),
        openingQty: Number(formData.opQty),
        opStock: Number(formData.opQty),
        opRate: Number(formData.opRate),
        openingRate: Number(formData.opRate),
        opValue: Number(formData.opValue),
        openingValue: Number(formData.opValue),
        ewayBillProductName: formData.ewayBillProductName,
        description: formData.description,
        imageUrl: formData.imageUrl,
        itemChrCode: formData.itemChrCode,
        vatRate1: Number(formData.vatRate1 || 0),
        vatRate2: Number(formData.vatRate2 || 0),
        delCharge: Number(formData.delCharge || 0),
        cessRate: Number(formData.cessRate || 0),
        lfrRate: Number(formData.lfrRate || 0),
        partyGroup: formData.partyGroup,
        bundle: Number(formData.bundle || 0),
        salesProfitPer: Number(formData.salesProfitPer || 0),
        jobRate: Number(formData.jobRate || 0),
        maxLevel: Number(formData.maxLevel || 0),
        minLevel: Number(formData.minLevel || 0),
        showIn: formData.showIn,
        ewayProductDesc2: formData.ewayProductDesc2,
        gstTaxLabel2: formData.gstTaxLabel2,
        negativeStockMessage: !!formData.negativeStockMessage,
        hindiName: formData.hindiName,
      };
      let response;
      if (editId) {
        response = await updateItem(editId, payload);
        notifySuccess('Item updated');
      } else {
        response = await addItem(payload);
        notifySuccess('Item saved');
      }
      if (onSuccess) {
        onSuccess({ ...response, id: response?._id, _id: response?._id });
        onClose?.();
      } else {
        setEditId(null);
        setFormData(emptyForm());
        fetchItems();
        setActiveTab('View');
      }
    } catch (err) {
      notifyError(err, 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await erpConfirm({ title: 'Delete Item', message: 'Delete this item?', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteItem(id);
      if (editId === id) {
        setEditId(null);
        setFormData(emptyForm());
      }
      fetchItems();
    } catch (err) {
      notifyError(err, 'Failed to delete item');
    }
  };

  // JSM pixel layout: absolute position/size taken from the decompiled Mst_Item_Mast form.
  const at = (left, top, width, height = 22) => ({ position: 'absolute', left, top, width, height });
  const L = (left, top, text, red = false) => (
    <span key={`${left}-${top}`} style={{ position: 'absolute', left, top }} className={`jsm-am-lbl${red ? ' red-label' : ''}`}>{text}</span>
  );
  const T = (left, top, width, key, props = {}) => (
    <input style={at(left, top, width)} className="classic-erp-input" value={formData[key] ?? ''} onChange={(e) => setField(key, e.target.value)} disabled={readOnly} {...props} />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Item Master (${items.length})`}
      className="max-w-[1010px]"
      footer={
        <div className="w-full flex items-center justify-between select-none">
          <div className="flex items-center gap-1">
            <button className="classic-erp-btn" type="button" onClick={handleFirst} disabled={saving || !items.length} title="First Record (<)">&lt;</button>
            <button className="classic-erp-btn" type="button" onClick={handlePrev} disabled={saving || !items.length} title="Previous Record (<<)">&lt;&lt;</button>
            <button className="classic-erp-btn" type="button" onClick={handleNext} disabled={saving || !items.length} title="Next Record (>>)">	&gt;&gt;</button>
            <button className="classic-erp-btn" type="button" onClick={handleLast} disabled={saving || !items.length} title="Last Record (>)">&gt;</button>
            {currentIndex >= 0 && (
              <span className="text-[11px] font-mono text-gray-600 px-1">
                {currentIndex + 1} / {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeTab === 'Add' && !readOnly && (
              <>
                <button type="button" className="classic-erp-btn" data-action="new" disabled={saving} onClick={() => { setEditId(null); setFormData(emptyForm()); }}>New / Clear</button>
                <button type="button" className="classic-erp-btn btn-blue font-bold" data-action="save" disabled={saving} data-enter-save="true" onClick={handleSave}>
                  {saving ? 'Saving…' : (editId ? 'Update' : 'Save')}
                </button>
                {editId && (
                  <button type="button" className="classic-erp-btn btn-red" data-action="delete" disabled={saving} onClick={() => handleDelete(editId)}>
                    Delete
                  </button>
                )}
              </>
            )}
            <button type="button" className="classic-erp-btn" data-action="cancel" disabled={saving} onClick={onClose}>Exit</button>
          </div>
        </div>
      }
    >
      <div
        data-form-enter-nav="true"
        onKeyDown={(e) => {
          if (e.key === 'F3') {
            e.preventDefault();
            setActiveTab('View');
            setTimeout(() => {
              searchInputRef.current?.focus();
              try { searchInputRef.current?.select(); } catch {}
            }, 60);
          }
        }}
      >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 pt-2 gap-1 shrink-0">
        <div className="flex gap-1">
          {['Add', 'View'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab ? 'bg-[var(--blue-bg)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-base)]'
              }`}
            >
              {tab === 'Add' ? (editId ? 'Edit Item' : 'Add Item') : `View List (${items.length})`}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition shadow-sm"
        >
          📥 Import Items (Excel)
        </button>
      </div>

      {activeTab === 'View' ? (
        <div className="erp-modal-body max-h-[60vh] overflow-y-auto" tabIndex={0} onKeyDown={handleItemListKeyDown}>
          <div className="relative mb-2">
            <input
              ref={searchInputRef}
              type="text"
              data-master-find="true"
              value={itemSearch}
              onChange={(e) => {
                setItemSearch(e.target.value);
                setFocusedItemIndex(0);
              }}
              onKeyDown={handleItemListKeyDown}
              placeholder="Find (F3) — Type item name, code, category, HSN..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-[var(--border)] rounded-md focus:border-blue-600 outline-none"
            />
          </div>
          <table className="w-full text-xs text-left">
            <thead className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
              <tr>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">HSN</th>
                <th className="py-2 pr-3">GST</th>
                <th className="py-2 pr-3 text-right">Sale</th>
                <th className="py-2 pr-3 text-right">Pur</th>
                {!readOnly && <th className="py-2 text-right">Actions</th>}
                <th className="py-2 text-right">Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredItems.map((item, index) => {
                const isSelected = index === focusedItemIndex;
                return (
                <tr
                  key={item._id}
                  onClick={() => setFocusedItemIndex(index)}
                  onDoubleClick={() => loadForEdit(item)}
                  className={isSelected ? 'bg-blue-100 font-semibold cursor-pointer' : 'hover:bg-[var(--bg-base)] cursor-pointer'}
                >
                  <td className="py-2 pr-3">{item.itemCode || '—'}</td>
                  <td className="py-2 pr-3 font-semibold uppercase">{item.itemName || item.name}</td>
                  <td className="py-2 pr-3">{item.categoryLabel || item.group || item.category}</td>
                  <td className="py-2 pr-3">{item.hsnCode || '—'}</td>
                  <td className="py-2 pr-3">{item.gstTaxLabel || `${item.gstRate ?? item.taxRate ?? 5}%`}</td>
                  <td className="py-2 pr-3 text-right">₹{item.salesRate || 0}</td>
                  <td className="py-2 pr-3 text-right">₹{item.purRate || item.purchaseRate || 0}</td>
                  {!readOnly && (
                    <td className="py-2 text-right space-x-2">
                      <button type="button" className="text-[10px] font-semibold text-[var(--accent)]" onClick={() => loadForEdit(item)}>Edit</button>
                      <button type="button" className="text-[10px] font-semibold text-[var(--red)]" onClick={() => handleDelete(item._id)}>Del</button>
                    </td>
                  )}
                  <td className="py-2 text-right">
                    <button type="button" className="text-[10px] font-semibold text-[var(--accent)] hover:underline" onClick={() => handleCopy(item)}>
                      Copy
                    </button>
                  </td>
                </tr>
              )})}
              {filteredItems.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="erp-modal-body max-h-[72vh] overflow-y-auto space-y-3" onKeyDown={handleFormEnterKeyDown}>
          {/* Same positions, sizes and captions as JSM Mst_Item_Mast (GroupBox1); image box on the right. */}
          <div className="jsm-am-scroll">
            <div className="jsm-am-box" style={{ width: 930, height: 478 }}>
              {L(13, 26, 'Item Name', true)}
              <input ref={itemNameRef} style={at(96, 23, 340)} className="classic-erp-input font-bold uppercase" value={formData.itemName} onChange={(e) => setField('itemName', e.target.value)} disabled={readOnly} />
              {L(14, 48, 'Item ID')}
              {T(96, 46, 88, 'itemChrCode')}
              {L(266, 50, 'Hsn Code')}
              {T(340, 46, 96, 'hsnCode', { className: 'classic-erp-input font-mono' })}
              {L(514, 24, 'Tax Rate')}
              {T(583, 22, 64, 'vatRate1', { type: 'number', className: 'classic-erp-input text-right' })}
              {T(651, 22, 64, 'vatRate2', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(515, 55, 'Del.Chrg')}
              {T(583, 51, 64, 'delCharge', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(541, 81, 'Cess')}
              {T(583, 76, 64, 'cessRate', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(553, 106, 'Lfr')}
              {T(583, 100, 64, 'lfrRate', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(13, 78, 'Category')}
              <select style={at(96, 75, 340)} className="classic-erp-select" value={formData.group} onChange={(e) => setField('group', e.target.value)} disabled={readOnly}>
                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {L(14, 105, 'Unit')}
              <select style={at(96, 103, 168)} className="classic-erp-select" value={formData.unit} onChange={(e) => setField('unit', e.target.value)} disabled={readOnly}>
                {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {L(277, 106, 'PartyGroup')}
              {T(360, 102, 140, 'partyGroup', { className: 'classic-erp-input uppercase' })}
              {L(510, 106, 'Brand')}
              {T(556, 102, 110, 'brand', { className: 'classic-erp-input uppercase', placeholder: 'Brand' })}
              {L(14, 138, 'Op.Pcs')}
              {T(96, 134, 74, 'opPcs', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(181, 138, 'Cut')}
              {T(212, 135, 74, 'cut', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(291, 138, 'Fold')}
              {T(330, 135, 63, 'fold', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(406, 138, 'Bundle')}
              {T(461, 135, 74, 'bundle', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(14, 166, 'Op.Qty')}
              {T(96, 163, 96, 'opQty', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(206, 168, 'Op.Rate')}
              {T(270, 165, 103, 'opRate', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(391, 169, 'Op.Value')}
              {T(461, 166, 114, 'opValue', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(10, 201, 'Pu.Rate')}
              {T(96, 198, 114, 'purRate', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(10, 224, 'Sl.Rate')}
              {T(96, 222, 114, 'salesRate', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(226, 221, 'Sales%')}
              {T(297, 218, 78, 'salesProfitPer', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(387, 219, 'Max. Level')}
              {T(468, 217, 96, 'maxLevel', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(10, 248, 'Job.Rate')}
              {T(96, 246, 114, 'jobRate', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(226, 245, 'MRP')}
              {T(282, 242, 94, 'mrp', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(388, 243, 'Min. Level')}
              {T(468, 241, 96, 'minLevel', { type: 'number', className: 'classic-erp-input text-right' })}
              {L(10, 286, 'Eway Bill Prod.Name')}
              {T(154, 283, 239, 'ewayBillProductName')}
              {L(431, 283, 'Show Status')}
              <select style={at(526, 278, 99, 24)} className="classic-erp-select" value={formData.showIn} onChange={(e) => setField('showIn', e.target.value)} disabled={readOnly}>
                {['All', 'Sales', 'Purchase'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {L(73, 309, 'Description')}
              {T(154, 306, 239, 'description')}
              {L(404, 308, '(2)')}
              {T(429, 305, 223, 'ewayProductDesc2')}
              {L(11, 340, 'GST TAX RATE')}
              <select style={at(132, 335, 278, 24)} className="classic-erp-select font-bold" value={formData.gstTaxLabel} onChange={(e) => setField('gstTaxLabel', e.target.value)} disabled={readOnly}>
                {GST_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              <label style={at(444, 337, 174, 20)} className="jsm-am-chk">
                <input type="checkbox" checked={!!formData.negativeStockMessage} onChange={(e) => setField('negativeStockMessage', e.target.checked)} disabled={readOnly} />
                Nagetive Message [Y/N]
              </label>
              {L(11, 368, 'GST TAX RATE (2)')}
              <select style={at(132, 365, 278, 24)} className="classic-erp-select" value={formData.gstTaxLabel2} onChange={(e) => setField('gstTaxLabel2', e.target.value)} disabled={readOnly}>
                <option value="">—</option>
                {GST_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              {L(463, 404, 'ItemCode')}
              <input ref={itemCodeRef} style={at(543, 401, 67)} className="classic-erp-input font-mono" value={formData.itemCode} onChange={(e) => setField('itemCode', e.target.value)} disabled={readOnly} />
              {T(43, 444, 367, 'hindiName', { placeholder: 'Hindi name / हिंदी नाम' })}

              {/* Image (JSM PictureBox1 + Brows / Remove Image) */}
              <div style={at(690, 46, 230, 230)} className="border border-[var(--border)] rounded flex items-center justify-center overflow-hidden bg-[var(--bg-base)]">
                {formData.imageUrl
                  ? <img src={formData.imageUrl} alt="Item" className="max-w-full max-h-full object-contain" />
                  : <span className="text-[11px] text-[var(--text-muted)]">No image</span>}
              </div>
              {!readOnly && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1} data-enter-skip="true" onChange={onBrowseImage} />
                  <button type="button" tabIndex={-1} style={at(690, 11, 110, 26)} className="erp-btn erp-btn-secondary text-[11px]" onClick={() => fileRef.current?.click()}>Brows Image</button>
                  <button type="button" tabIndex={-1} style={at(810, 11, 110, 26)} className="erp-btn erp-btn-secondary text-[11px]" disabled={!formData.imageUrl} onClick={() => setField('imageUrl', '')}>Remove Image</button>
                </>
              )}
            </div>
          </div>

          {/* MERN-only details kept from before (not on the JSM form). */}
          <div className="rounded border border-[var(--border)] p-2.5 bg-[var(--bg-card)] space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              Other Detail — HSN digits & textile specifications
            </div>
            <div className="erp-grid erp-grid-3">
              <FormField label="HSN Digits">
                <ERPInput type="number" value={formData.hsnDigits} onChange={(e) => setField('hsnDigits', e.target.value)} disabled={readOnly} />
              </FormField>
              <FormField label="Reed">
                <ERPInput value={formData.reed} onChange={(e) => setField('reed', e.target.value)} disabled={readOnly} placeholder="e.g. 64" />
              </FormField>
              <FormField label="Pick">
                <ERPInput value={formData.pick} onChange={(e) => setField('pick', e.target.value)} disabled={readOnly} placeholder="e.g. 56" />
              </FormField>
              <FormField label="Warp Count">
                <ERPInput value={formData.warpCount} onChange={(e) => setField('warpCount', e.target.value)} disabled={readOnly} placeholder="e.g. 40s" />
              </FormField>
              <FormField label="Weft Count">
                <ERPInput value={formData.weftCount} onChange={(e) => setField('weftCount', e.target.value)} disabled={readOnly} placeholder="e.g. 40s" />
              </FormField>
              <FormField label="Denier">
                <ERPInput value={formData.denier} onChange={(e) => setField('denier', e.target.value)} disabled={readOnly} placeholder="e.g. 80D" />
              </FormField>
              <FormField label="Fabric Quality">
                <ERPInput value={formData.quality} onChange={(e) => setField('quality', e.target.value)} disabled={readOnly} placeholder="e.g. 60x60 Cambric" />
              </FormField>
              <FormField label="Width / Panna (Inches)">
                <ERPInput value={formData.widthPanna} onChange={(e) => setField('widthPanna', e.target.value)} disabled={readOnly} placeholder="e.g. 44 / 58" />
              </FormField>
              <FormField label="Reorder Level">
                <ERPInput type="number" step="0.01" value={formData.reorderLevel} onChange={(e) => setField('reorderLevel', e.target.value)} disabled={readOnly} placeholder="0.00" />
              </FormField>
            </div>
          </div>
        </div>
      )}
      </div>
      <DataImportModal
        isOpen={showImport}
        onClose={() => {
          setShowImport(false);
          fetchItems?.();
        }}
        initialEntity="item"
      />
    </Modal>
  );
};

export default ItemMasterModal;
