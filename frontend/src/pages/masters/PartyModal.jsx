import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const PartyModal = ({ isOpen, onClose, initialData = null, onSuccess }) => {
  const { addParty, updateParty, parties } = useStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    group: 'Sundry Debtors',
    type: 'Customer',
    address: '',
    address2: '',
    city: '',
    pincode: '',
    state: 'Gujarat',
    mobile: '',
    phone: '',
    email: '',
    gstin: '',
    pan: '',
    brokerId: '',
    openingBalance: 0,
    creditLimit: 0,
    bankName: '',
    accountNo: '',
    ifsc: ''
  });

  React.useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    } else if (isOpen) {
      setFormData({
        name: '',
        group: 'Sundry Debtors',
        type: 'Customer',
        address: '',
        address2: '',
        city: '',
        pincode: '',
        state: 'Gujarat',
        mobile: '',
        phone: '',
        email: '',
        gstin: '',
        pan: '',
        brokerId: '',
        openingBalance: 0,
        creditLimit: 0,
        bankName: '',
        accountNo: '',
        ifsc: ''
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Party name is required');
      return;
    }
    setLoading(true);
    try {
      let result;
      if (initialData && initialData._id) {
        result = await updateParty(initialData._id, formData);
      } else {
        result = await addParty(formData);
      }
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      alert(err.message || 'Error saving party');
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit party' : 'New party'}
      footer={
        <>
          <button type="button" className="erp-btn erp-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="party-form" disabled={loading} className="erp-btn erp-btn-primary">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="party-form" onSubmit={handleSubmit} className="erp-modal-body space-y-4">
        <p className="erp-section-title">Basic details</p>
        <div className="erp-grid erp-grid-3">
          <div className="col-span-2">
            <FormField label="Account name">
              <ERPInput value={formData.name} onChange={set('name')} placeholder="e.g. Laxmi Fashion" />
            </FormField>
          </div>
          <FormField label="Account group">
            <ERPSelect
              value={formData.group}
              onChange={set('group')}
              options={[
                { value: 'Sundry Debtors', label: 'Sundry Debtors' },
                { value: 'Sundry Creditors', label: 'Sundry Creditors' },
                { value: 'Bank Accounts', label: 'Bank Accounts' }
              ]}
            />
          </FormField>
        </div>

        <p className="erp-section-title">Address & contact</p>
        <div className="erp-grid erp-grid-2">
          <FormField label="Address line 1">
            <ERPInput value={formData.address} onChange={set('address')} />
          </FormField>
          <FormField label="Address line 2">
            <ERPInput value={formData.address2} onChange={set('address2')} />
          </FormField>
          <FormField label="City">
            <ERPInput value={formData.city} onChange={set('city')} />
          </FormField>
          <FormField label="Pincode">
            <ERPInput value={formData.pincode} onChange={set('pincode')} />
          </FormField>
          <FormField label="State">
            <ERPSelect
              value={formData.state}
              onChange={set('state')}
              options={[
                { value: 'Gujarat', label: 'Gujarat (24)' },
                { value: 'Maharashtra', label: 'Maharashtra (27)' },
                { value: 'Delhi', label: 'Delhi (07)' }
              ]}
            />
          </FormField>
          <FormField label="Mobile">
            <ERPInput value={formData.mobile} onChange={set('mobile')} />
          </FormField>
          <FormField label="Email">
            <ERPInput value={formData.email} onChange={set('email')} />
          </FormField>
        </div>

        <p className="erp-section-title">Tax & limits</p>
        <div className="erp-grid erp-grid-3">
          <FormField label="GST no">
            <ERPInput value={formData.gstin} onChange={set('gstin')} placeholder="24AAAAA0000A1Z5" />
          </FormField>
          <FormField label="PAN no">
            <ERPInput value={formData.pan} onChange={set('pan')} placeholder="ABCDE1234F" />
          </FormField>
          <FormField label="Linked broker">
            <ERPSelect
              value={formData.brokerId}
              onChange={set('brokerId')}
              options={parties.filter(p => p.type === 'Broker').map(p => ({ value: p.id, label: p.name }))}
            />
          </FormField>
          <FormField label="Opening balance">
            <ERPInput type="number" value={formData.openingBalance} onChange={set('openingBalance')} />
          </FormField>
          <FormField label="Credit limit">
            <ERPInput type="number" value={formData.creditLimit} onChange={set('creditLimit')} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
};

export default PartyModal;
