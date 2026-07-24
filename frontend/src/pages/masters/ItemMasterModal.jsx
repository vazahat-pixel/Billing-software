import React, { useRef, useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, FormField } from '../../components/forms/FormElements';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';
import useStore from '../../store/useStore';

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
  ewayBillProductName: '',
  description: '',
  imageUrl: '',
});

const toForm = (item) => {
  const rate = Number(item.taxRate ?? item.gstRate ?? 5);
  const label =
    item.gstTaxLabel ||
    (rate === 0 ? 'GST FREE' : GST_OPTIONS.find((g) => g.rate === rate)?.value || `GST ${rate}%`);
  return {
    itemName: item.itemName || item.name || '',
    itemCode: item.itemCode || '',
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
    ewayBillProductName: item.ewayBillProductName || '',
    description: item.description || '',
    imageUrl: item.imageUrl || '',
  };
};

const ItemMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null, readOnly = false }) => {
  const { addItem, updateItem, deleteItem, items, fetchItems } = useStore();
  const [activeTab, setActiveTab] = useState('Add');
  const [formData, setFormData] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

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

  const handleSave = async () => {
    if (saving) return;
    if (!formData.itemName?.trim()) return notifyWarning('Item name is required');
    setSaving(true);
    try {
      const payload = {
        itemName: formData.itemName.trim(),
        name: formData.itemName.trim(),
        itemCode: formData.itemCode,
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
      }
      setEditId(null);
      setFormData(emptyForm());
      fetchItems();
      setActiveTab('View');
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Item Master (${items.length})`}
      className="max-w-4xl"
      footer={activeTab === 'Add' && !readOnly && (
        <>
          <button type="button" className="erp-btn erp-btn-secondary" disabled={saving} onClick={() => { setEditId(null); setFormData(emptyForm()); }}>Clear</button>
          <button type="button" className="erp-btn erp-btn-secondary" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="button" className="erp-btn erp-btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : (editId ? 'Update item' : 'Save item')}
          </button>
        </>
      )}
    >
      <div className="flex border-b border-[var(--border)] px-4 pt-2 gap-1 shrink-0">
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

      {activeTab === 'View' ? (
        <div className="erp-modal-body max-h-[60vh] overflow-y-auto">
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
              {items.map((item) => (
                <tr key={item._id} className="hover:bg-[var(--bg-base)]">
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
              ))}
              {items.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">No items yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="erp-modal-body max-h-[70vh] overflow-y-auto space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {formData.imageUrl ? (
                <img src={formData.imageUrl} alt="Item" className="h-16 w-16 rounded object-cover border border-[var(--border)]" />
              ) : (
                <div className="h-16 w-16 rounded border border-dashed border-[var(--border)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">
                  No image
                </div>
              )}
              {!readOnly && (
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onBrowseImage} />
                  <button type="button" className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]" onClick={() => fileRef.current?.click()}>
                    Browse Image
                  </button>
                  <button
                    type="button"
                    className="erp-btn erp-btn-secondary h-8 px-3 text-[11px]"
                    onClick={() => setField('imageUrl', '')}
                    disabled={!formData.imageUrl}
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>
            <FormField label="ItemCode" className="w-40">
              <ERPInput value={formData.itemCode} onChange={(e) => setField('itemCode', e.target.value)} disabled={readOnly} />
            </FormField>
          </div>

          <FormField label="Item Name">
            <ERPInput value={formData.itemName} onChange={(e) => setField('itemName', e.target.value)} disabled={readOnly} />
          </FormField>

          <div className="erp-grid erp-grid-2">
            <FormField label="HSN Digits">
              <ERPInput type="number" value={formData.hsnDigits} onChange={(e) => setField('hsnDigits', e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="Hsn Code">
              <ERPInput value={formData.hsnCode} onChange={(e) => setField('hsnCode', e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="Category">
              <ERPSelect
                value={formData.group}
                onChange={(e) => setField('group', e.target.value)}
                disabled={readOnly}
                options={CATEGORY_OPTIONS}
              />
            </FormField>
            <FormField label="Unit">
              <ERPSelect
                value={formData.unit}
                onChange={(e) => setField('unit', e.target.value)}
                disabled={readOnly}
                options={UNIT_OPTIONS}
              />
            </FormField>
          </div>

          <div className="erp-grid erp-grid-3">
            <FormField label="Op.Pcs">
              <ERPInput type="number" value={formData.opPcs} onChange={(e) => setField('opPcs', e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="Cut">
              <ERPInput type="number" step="0.01" value={formData.cut} onChange={(e) => setField('cut', e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="Op.Qty">
              <ERPInput type="number" step="0.01" value={formData.opQty} onChange={(e) => setField('opQty', e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="Op.Rate">
              <ERPInput type="number" step="0.00001" value={formData.opRate} onChange={(e) => setField('opRate', e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="Op.Value">
              <ERPInput type="number" step="0.01" value={formData.opValue} onChange={(e) => setField('opValue', e.target.value)} disabled={readOnly} />
            </FormField>
          </div>

          <div className="erp-grid erp-grid-3">
            <FormField label="Pu.Rate">
              <ERPInput type="number" step="0.00001" value={formData.purRate} onChange={(e) => setField('purRate', e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="Sl.Rate">
              <ERPInput type="number" step="0.00001" value={formData.salesRate} onChange={(e) => setField('salesRate', e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="MRP">
              <ERPInput type="number" step="0.00001" value={formData.mrp} onChange={(e) => setField('mrp', e.target.value)} disabled={readOnly} />
            </FormField>
          </div>

          <FormField label="Eway Bill Prod.Name">
            <ERPInput value={formData.ewayBillProductName} onChange={(e) => setField('ewayBillProductName', e.target.value)} disabled={readOnly} />
          </FormField>

          <FormField label="Description">
            <ERPInput value={formData.description} onChange={(e) => setField('description', e.target.value)} disabled={readOnly} />
          </FormField>

          <FormField label="GST TAX RATE">
            <ERPSelect
              value={formData.gstTaxLabel}
              onChange={(e) => setField('gstTaxLabel', e.target.value)}
              disabled={readOnly}
              options={GST_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
            />
          </FormField>
        </div>
      )}
    </Modal>
  );
};

export default ItemMasterModal;
