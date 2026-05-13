import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect, ERPButton, ERPSection } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { User, Phone, MapPin, CreditCard, Landmark, Mail, ShieldCheck } from 'lucide-react';

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

  // Pre-fill if initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    } else {
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
      alert("Party Name is mandatory");
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Account Master" : "New Account Master (Ref: #9)"} className="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="grid grid-cols-3 gap-4">
           <div className="col-span-2">
              <FormField label="Account Name" icon={User}>
                <ERPInput value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Laxmi Fashion" />
              </FormField>
           </div>
           <FormField label="Account Group">
              <ERPSelect 
                value={formData.group} 
                onChange={(e) => setFormData({...formData, group: e.target.value})}
                options={[{value: 'Sundry Debtors', label: 'Sundry Debtors'}, {value: 'Sundry Creditors', label: 'Sundry Creditors'}, {value: 'Bank Accounts', label: 'Bank Accounts'}]}
              />
           </FormField>
        </div>

        <div className="grid grid-cols-2 gap-6">
           <ERPSection title="Address & Contact" icon={MapPin} className="space-y-3">
              <ERPInput placeholder="Address Line 1" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              <ERPInput placeholder="Address Line 2" value={formData.address2} onChange={(e) => setFormData({...formData, address2: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                 <ERPInput placeholder="City" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                 <ERPInput placeholder="Pincode" value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} />
              </div>
              <ERPSelect 
                 value={formData.state}
                 onChange={(e) => setFormData({...formData, state: e.target.value})}
                 options={[{value: 'Gujarat', label: 'Gujarat (24)'}, {value: 'Maharashtra', label: 'Maharashtra (27)'}, {value: 'Delhi', label: 'Delhi (07)'}]}
              />
              <div className="grid grid-cols-2 gap-2 pt-2">
                 <div className="relative">
                    <ERPInput placeholder="Mobile" value={formData.mobile} onChange={(e) => setFormData({...formData, mobile: e.target.value})} />
                    <Phone className="absolute right-3 top-2 text-slate-300" size={14} />
                 </div>
                 <div className="relative">
                    <ERPInput placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                    <Mail className="absolute right-3 top-2 text-slate-300" size={14} />
                 </div>
              </div>
           </ERPSection>

           <div className="space-y-4">
              <ERPSection title="Taxation & Compliance" icon={ShieldCheck} className="space-y-3">
                 <FormField label="GST No">
                    <ERPInput value={formData.gstin} onChange={(e) => setFormData({...formData, gstin: e.target.value})} placeholder="24AAAAA0000A1Z5" />
                 </FormField>
                 <FormField label="PAN No">
                    <ERPInput value={formData.pan} onChange={(e) => setFormData({...formData, pan: e.target.value})} placeholder="ABCDE1234F" />
                 </FormField>
                 <FormField label="Linked Broker">
                    <ERPSelect 
                       value={formData.brokerId}
                       onChange={(e) => setFormData({...formData, brokerId: e.target.value})}
                       options={parties.filter(p => p.type === 'Broker').map(p => ({ value: p.id, label: p.name }))}
                    />
                 </FormField>
              </ERPSection>

              <ERPSection title="Financial Limits" icon={Landmark} className="grid grid-cols-2 gap-3">
                 <FormField label="Opening Bal">
                    <ERPInput type="number" value={formData.openingBalance} onChange={(e) => setFormData({...formData, openingBalance: e.target.value})} />
                 </FormField>
                 <FormField label="Credit Limit">
                    <ERPInput type="number" value={formData.creditLimit} onChange={(e) => setFormData({...formData, creditLimit: e.target.value})} />
                 </FormField>
              </ERPSection>
           </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-slate-100">
           <ERPButton variant="secondary" className="px-8" onClick={onClose}>Discard</ERPButton>
           <ERPButton type="submit" className="flex-1 bg-slate-900 hover:bg-black">Save Master Record (F10)</ERPButton>
        </div>
      </form>
    </Modal>
  );
};

export default PartyModal;
