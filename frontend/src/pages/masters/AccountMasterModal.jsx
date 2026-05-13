import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

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
      // Determine the type based on group
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
    <Modal isOpen={isOpen} onClose={onClose} title="Account Master" className="max-w-4xl bg-[#f8fafc]">
      <div className="p-6">
        <div className="grid grid-cols-2 gap-8">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Party Name :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm bg-blue-50/50 focus:bg-white" 
                   value={formData.name}
                   onChange={(e) => setFormData({...formData, name: e.target.value})}
                   placeholder="Enter Account Name..." 
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Group :</label>
                 <ERPSelect 
                   className="flex-1 h-8 text-sm" 
                   value={formData.group}
                   onChange={(e) => setFormData({...formData, group: e.target.value})}
                   options={[{value: 'SUNDRY DEBTORS', label: 'SUNDRY DEBTORS'}, {value: 'SUNDRY CREDITORS', label: 'SUNDRY CREDITORS'}]} 
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Station :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm" 
                   value={formData.station}
                   onChange={(e) => setFormData({...formData, station: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">GST No :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm uppercase" 
                   value={formData.gstin}
                   onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                   maxLength={15} 
                 />
              </div>
           </div>
           
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Mobile No :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm" 
                   value={formData.mobile}
                   onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Email :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm" 
                   value={formData.email}
                   onChange={(e) => setFormData({...formData, email: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Credit Limit :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm text-right" 
                   value={formData.creditLimit}
                   onChange={(e) => setFormData({...formData, creditLimit: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Address :</label>
                 <textarea 
                   className="flex-1 min-h-[32px] text-sm p-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none" 
                   value={formData.address}
                   onChange={(e) => setFormData({...formData, address: e.target.value})}
                 />
              </div>
           </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-4 flex justify-between bg-slate-900 -mx-6 -mb-6 p-3">
           <div className="flex gap-1">
              {['F2 Add', 'F3 Edit', 'F4 Delete', 'Find'].map(btn => (
                <button key={btn} className="px-4 py-1.5 bg-slate-200 hover:bg-white text-[11px] font-black uppercase tracking-tighter border border-slate-400 transition-all shadow-sm">
                  {btn}
                </button>
              ))}
           </div>
           <div className="flex gap-1">
              <button 
                onClick={handleSave}
                className="px-6 py-1.5 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-tighter border border-emerald-700 hover:bg-emerald-500 transition-all"
              >
                Save (F12)
              </button>
              <button onClick={onClose} className="px-6 py-1.5 bg-rose-600 text-white text-[11px] font-black uppercase tracking-tighter border border-rose-700 hover:bg-rose-500 transition-all">Cancel (Esc)</button>
           </div>
        </div>
      </div>
    </Modal>
  );
};

export default AccountMasterModal;
