import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, FormField } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const emptyForm = () => ({
  itemName: '',
  group: 'GREY',
  unit: 'MTRS',
  hsnCode: '',
  taxRate: '5',
  salesRate: '0',
  purRate: '0',
  opStock: '0'
});

const ItemMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null, readOnly = false }) => {
  const { addItem, updateItem, deleteItem, items, fetchItems } = useStore();
  const [activeTab, setActiveTab] = useState('Add');
  const [formData, setFormData] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    if (isOpen) fetchItems();
  }, [isOpen, fetchItems]);

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }));
      setEditId(initialData._id || initialData.id || null);
      setActiveTab('Add');
    } else if (isOpen && !editId) {
      setFormData(emptyForm());
    }
  }, [initialData, isOpen]);

  const loadForEdit = (item) => {
    setEditId(item._id);
    setFormData({
      itemName: item.itemName || item.name || '',
      group: item.group || 'GREY',
      unit: item.unit || 'MTRS',
      hsnCode: item.hsnCode || '',
      taxRate: String(item.taxRate ?? item.gstRate ?? '5'),
      salesRate: String(item.salesRate || 0),
      purRate: String(item.purRate || item.purchaseRate || 0),
      opStock: String(item.opStock || 0)
    });
    setActiveTab('Add');
  };

  const handleSave = async () => {
    if (!formData.itemName) return alert('Item name is required');
    try {
      const payload = {
        ...formData,
        taxRate: Number(formData.taxRate),
        salesRate: Number(formData.salesRate),
        purRate: Number(formData.purRate),
        opStock: Number(formData.opStock)
      };
      let response;
      if (editId) {
        response = await updateItem(editId, payload);
        alert('Item updated');
      } else {
        response = await addItem(payload);
        alert('Item saved');
      }
      if (onSuccess) {
        onSuccess({ ...response, id: response._id, _id: response._id });
      }
      setEditId(null);
      setFormData(emptyForm());
      fetchItems();
      setActiveTab('View');
    } catch (err) {
      alert('Failed to save item: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await deleteItem(id);
      if (editId === id) {
        setEditId(null);
        setFormData(emptyForm());
      }
      fetchItems();
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Item master (${items.length} saved)`}
      footer={activeTab === 'Add' && !readOnly && (
        <>
          <button type="button" className="erp-btn erp-btn-secondary" onClick={() => { setEditId(null); setFormData(emptyForm()); }}>Clear</button>
          <button type="button" className="erp-btn erp-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="erp-btn erp-btn-primary" onClick={handleSave}>
            {editId ? 'Update item' : 'Save item'}
          </button>
        </>
      )}
    >
      <div className="flex border-b border-[var(--border)] px-4 pt-2 gap-1 shrink-0">
        {['Add', 'View'].map(tab => (
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
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3">HSN</th>
                <th className="py-2 pr-3 text-right">Sale</th>
                <th className="py-2 pr-3 text-right">Pur</th>
                {!readOnly && <th className="py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {items.map(item => (
                <tr key={item._id} className="hover:bg-[var(--bg-base)]">
                  <td className="py-2 pr-3 font-semibold uppercase">{item.itemName || item.name}</td>
                  <td className="py-2 pr-3">{item.group}</td>
                  <td className="py-2 pr-3">{item.hsnCode || '—'}</td>
                  <td className="py-2 pr-3 text-right">₹{item.salesRate || 0}</td>
                  <td className="py-2 pr-3 text-right">₹{item.purRate || item.purchaseRate || 0}</td>
                  {!readOnly && (
                    <td className="py-2 text-right space-x-2">
                      <button type="button" className="text-[10px] font-semibold text-[var(--accent)]" onClick={() => loadForEdit(item)}>Edit</button>
                      <button type="button" className="text-[10px] font-semibold text-[var(--red)]" onClick={() => handleDelete(item._id)}>Del</button>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">No items yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="erp-modal-body">
        <div className="erp-grid erp-grid-2">
          <FormField label="Item name">
            <ERPInput value={formData.itemName} onChange={(e) => setFormData({ ...formData, itemName: e.target.value })} disabled={readOnly} />
          </FormField>
          <FormField label="Category">
            <ERPSelect
              value={formData.group}
              onChange={(e) => setFormData({ ...formData, group: e.target.value })}
              disabled={readOnly}
              options={[
                { value: 'GREY', label: 'Grey' },
                { value: 'FINISHED', label: 'Finished' },
                { value: 'YARN', label: 'Yarn' },
                { value: 'OTHERS', label: 'Others' }
              ]}
            />
          </FormField>
          <FormField label="Unit">
            <ERPSelect
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              disabled={readOnly}
              options={[{ value: 'MTRS', label: 'Meters' }, { value: 'PCS', label: 'Pieces' }]}
            />
          </FormField>
          <FormField label="HSN code">
            <ERPInput value={formData.hsnCode} onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })} disabled={readOnly} />
          </FormField>
          <FormField label="GST %">
            <ERPInput type="number" value={formData.taxRate} onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })} disabled={readOnly} />
          </FormField>
          <FormField label="Sales rate">
            <ERPInput type="number" value={formData.salesRate} onChange={(e) => setFormData({ ...formData, salesRate: e.target.value })} disabled={readOnly} />
          </FormField>
          <FormField label="Purchase rate">
            <ERPInput type="number" value={formData.purRate} onChange={(e) => setFormData({ ...formData, purRate: e.target.value })} disabled={readOnly} />
          </FormField>
        </div>
      </div>
      )}
    </Modal>
  );
};

export default ItemMasterModal;
