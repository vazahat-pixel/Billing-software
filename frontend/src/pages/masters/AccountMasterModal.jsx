import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, FormField } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { ShieldCheck, User, MapPin, Phone, Mail, CreditCard, Save, X } from 'lucide-react';

const AccountMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null }) => {
  const { addParty } = useStore();
  const [formData, setFormData] = useState({
    name: '',
    group: 'SUNDRY DEBTORS',
    station: '',
    gstin: '',
    mobile: '',
    email: '',
    creditLimit: '0.00',
    address: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    } else {
      setFormData({
        name: '',
        group: 'SUNDRY DEBTORS',
        station: '',
        gstin: '',
        mobile: '',
        email: '',
        creditLimit: '0.00',
        address: ''
      });
    }
  }, [initialData, isOpen]);

  const handleSave = async () => {
    if (!formData.name) return alert('Name is required');
    try {
      const type = formData.group === 'SUNDRY CREDITORS' ? 'Supplier' : 'Customer';
      const response = await addParty({ ...formData, type });
      if (onSuccess) {
        onSuccess({
          ...response,
          id: response._id,
          _id: response._id,
          data: response
        });
      }
      onClose();
    } catch (err) {
      alert('Failed to save account: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Registry Master" className="max-w-4xl p-0 overflow-hidden">
      <div className="bg-white h-full flex flex-col">
        <div className="p-10 flex-1 overflow-y-auto space-y-10 no-scrollbar">
           
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                 <User size={20} />
              </div>
              <div>
                 <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-black">Primary Information</h4>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Basic entity identification details</p>
              </div>
              <div className="h-[1px] flex-1 bg-slate-100 ml-4" />
           </div>

           <div className="grid grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Entity Name</label>
                    <ERPInput 
                      className="w-full" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="ENTER LEGAL NAME..." 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Account Group</label>
                    <ERPSelect 
                      className="w-full" 
                      value={formData.group}
                      onChange={(e) => setFormData({...formData, group: e.target.value})}
                      options={[{value: 'SUNDRY DEBTORS', label: 'SUNDRY DEBTORS'}, {value: 'SUNDRY CREDITORS', label: 'SUNDRY CREDITORS'}]} 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Station / City</label>
                    <ERPInput 
                      className="w-full" 
                      value={formData.station}
                      onChange={(e) => setFormData({...formData, station: e.target.value})}
                      placeholder="CITY NAME..."
                    />
                 </div>
              </div>
              
              <div className="space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">GSTIN Number</label>
                    <ERPInput 
                      className="w-full" 
                      value={formData.gstin}
                      onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                      maxLength={15}
                      placeholder="24XXXXX0000X1Z5" 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Mobile Contact</label>
                    <ERPInput 
                      className="w-full" 
                      value={formData.mobile}
                      onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                      placeholder="+91 00000 00000"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Credit Limit</label>
                    <ERPInput 
                      className="w-full text-right font-black" 
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({...formData, creditLimit: e.target.value})}
                      placeholder="0.00"
                    />
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-4 pt-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                 <MapPin size={20} />
              </div>
              <div>
                 <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-black">Location Details</h4>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Physical address and communication</p>
              </div>
              <div className="h-[1px] flex-1 bg-slate-100 ml-4" />
           </div>

           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Full Billing Address</label>
              <textarea 
                className="w-full min-h-[100px] text-xs p-5 border border-slate-200 focus:border-black rounded-3xl outline-none transition-all font-bold bg-white text-black placeholder:text-slate-300 uppercase tracking-widest" 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="ENTER FULL POSTAL ADDRESS..."
              />
           </div>
        </div>

        <div className="p-8 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0">
           <button 
             onClick={onClose} 
             className="px-8 py-3 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all rounded-2xl flex items-center gap-3"
           >
             <X size={14} /> Discard Master
           </button>
           <button 
             onClick={handleSave}
             className="px-14 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-2xl shadow-xl flex items-center gap-3"
           >
             <Save size={14} /> Commit Entry (F12)
           </button>
        </div>
      </div>
    </Modal>
  );
};

export default AccountMasterModal;
