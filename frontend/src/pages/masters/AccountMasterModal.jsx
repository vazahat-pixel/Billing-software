import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, FormField } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const AccountMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null, readOnly = false }) => {
  const { addParty, parties, fetchParties } = useStore();
  const [activeTab, setActiveTab] = useState('Add');
  const [formData, setFormData] = useState({
    name: '',
    group: 'SUNDRY DEBTORS',
    station: '',
    gstin: '',
    mobile: '',
    email: '',
    creditLimit: '0',
    address: ''
  });

  useEffect(() => {
    if (isOpen) fetchParties();
  }, [isOpen, fetchParties]);

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }));
    } else if (isOpen) {
      setFormData({
        name: '',
        group: 'SUNDRY DEBTORS',
        station: '',
        gstin: '',
        mobile: '',
        email: '',
        creditLimit: '0',
        address: ''
      });
    }
  }, [initialData, isOpen]);

  const handleSave = async () => {
    if (!formData.name) return alert('Name is required');
    try {
      let type = 'Customer';
      const g = (formData.group || '').toUpperCase();
      if (g.includes('CREDITOR')) type = 'Supplier';
      else if (g.includes('BROKER')) type = 'Broker';
      else if (g.includes('JOB') || g.includes('WORKER')) type = 'Job Worker';
      const response = await addParty({ ...formData, type });
      if (onSuccess) {
        onSuccess({ ...response, id: response._id, _id: response._id });
      }
      fetchParties();
      setActiveTab('View');
    } catch (err) {
      alert('Failed to save account: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Account master (${parties.length} saved)`}
      footer={activeTab === 'Add' && !readOnly && (
        <>
          <button type="button" className="erp-btn erp-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="erp-btn erp-btn-primary" onClick={handleSave}>Save account</button>
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
            {tab === 'Add' ? 'Add Account' : `View List (${parties.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'View' ? (
        <div className="erp-modal-body max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3">City</th>
                <th className="py-2">Mobile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {parties.map(p => (
                <tr key={p._id} className="hover:bg-[var(--bg-base)]">
                  <td className="py-2 pr-3 font-semibold">{p.name}</td>
                  <td className="py-2 pr-3">{p.type}</td>
                  <td className="py-2 pr-3">{p.group}</td>
                  <td className="py-2 pr-3">{p.station || p.city || '—'}</td>
                  <td className="py-2">{p.mobile || '—'}</td>
                </tr>
              ))}
              {parties.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">No accounts yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="erp-modal-body">
        <div className="erp-grid erp-grid-2">
          <FormField label="Entity name">
            <ERPInput value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={readOnly} placeholder="Legal name" />
          </FormField>
          <FormField label="Account group">
            <ERPSelect
              value={formData.group}
              onChange={(e) => setFormData({ ...formData, group: e.target.value })}
              disabled={readOnly}
              options={[
                { value: 'SUNDRY DEBTORS', label: 'Sundry debtors (Customer)' },
                { value: 'SUNDRY CREDITORS', label: 'Sundry creditors (Supplier)' },
                { value: 'BROKER', label: 'Broker' },
                { value: 'JOB WORKER', label: 'Job worker' }
              ]}
            />
          </FormField>
          <FormField label="City / station">
            <ERPInput value={formData.station} onChange={(e) => setFormData({ ...formData, station: e.target.value })} disabled={readOnly} />
          </FormField>
          <FormField label="GSTIN">
            <ERPInput value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} disabled={readOnly} maxLength={15} />
          </FormField>
          <FormField label="Mobile">
            <ERPInput value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} disabled={readOnly} />
          </FormField>
          <FormField label="Credit limit">
            <ERPInput type="number" value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })} disabled={readOnly} />
          </FormField>
        </div>
        <FormField label="Billing address">
          <textarea
            className="erp-input min-h-[72px] py-2 h-auto resize-none"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            disabled={readOnly}
            rows={3}
          />
        </FormField>
      </div>
      )}
    </Modal>
  );
};

export default AccountMasterModal;
