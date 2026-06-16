import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, FormField } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const ItemMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null, readOnly = false }) => {
  const { addItem, items, fetchItems } = useStore();
  const [activeTab, setActiveTab] = useState('Add');
  const [formData, setFormData] = useState({
    itemName: '',
    group: 'GREY',
    unit: 'MTRS',
    hsnCode: '',
    taxRate: '5',
    salesRate: '0',
    purRate: '0',
    opStock: '0'
  });

  useEffect(() => {
    if (isOpen) fetchItems();
  }, [isOpen, fetchItems]);

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }));
    } else if (isOpen) {
      setFormData({
        itemName: '',
        group: 'GREY',
        unit: 'MTRS',
        hsnCode: '',
        taxRate: '5',
        salesRate: '0',
        purRate: '0',
        opStock: '0'
      });
    }
  }, [initialData, isOpen]);

  const handleSave = async () => {
    if (!formData.itemName) return alert('Item name is required');
    try {
      const response = await addItem(formData);
      if (onSuccess) {
        onSuccess({ ...response, id: response._id, _id: response._id });
      }
      fetchItems();
      setActiveTab('View');
    } catch (err) {
      alert('Failed to save item: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Item master (${items.length} saved)`}
      footer={activeTab === 'Add' && !readOnly && (
        <>
          <button type="button" className="erp-btn erp-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="erp-btn erp-btn-primary" onClick={handleSave}>Save item</button>
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
            {tab === 'Add' ? 'Add Item' : `View List (${items.length})`}
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
                <th className="py-2 pr-3">Unit</th>
                <th className="py-2 pr-3">HSN</th>
                <th className="py-2 pr-3 text-right">Sale Rate</th>
                <th className="py-2 text-right">Pur Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {items.map(item => (
                <tr key={item._id} className="hover:bg-[var(--bg-base)]">
                  <td className="py-2 pr-3 font-semibold uppercase">{item.itemName || item.name}</td>
                  <td className="py-2 pr-3">{item.group}</td>
                  <td className="py-2 pr-3">{item.unit}</td>
                  <td className="py-2 pr-3">{item.hsnCode || '—'}</td>
                  <td className="py-2 pr-3 text-right">₹{item.salesRate || 0}</td>
                  <td className="py-2 text-right">₹{item.purRate || item.purchaseRate || 0}</td>
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
          <FormField label="Opening stock">
            <ERPInput type="number" value={formData.opStock} onChange={(e) => setFormData({ ...formData, opStock: e.target.value })} disabled={readOnly} />
          </FormField>
        </div>
      </div>
      )}
    </Modal>
  );
};

export default ItemMasterModal;
