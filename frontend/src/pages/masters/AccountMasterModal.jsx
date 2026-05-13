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
    <Modal isOpen={isOpen} onClose={onClose} title="Account Master" className="max-w-4xl bg-white p-0">
      <div className="p-0">
        <div className="p-8 grid grid-cols-2 gap-10">
           <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <label className="w-28 text-right text-[10px] font-black uppercase text-black tracking-widest">Party Name :</label>
                 <ERPInput 
                   className="flex-1 h-9 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all" 
                   value={formData.name}
                   onChange={(e) => setFormData({...formData, name: e.target.value})}
                   placeholder="ENTER ACCOUNT NAME" 
                 />
              </div>
              <div className="flex items-center gap-4">
                 <label className="w-28 text-right text-[10px] font-black uppercase text-black tracking-widest">Group :</label>
                 <ERPSelect 
                   className="flex-1 h-9 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all" 
                   value={formData.group}
                   onChange={(e) => setFormData({...formData, group: e.target.value})}
                   options={[{value: 'SUNDRY DEBTORS', label: 'SUNDRY DEBTORS'}, {value: 'SUNDRY CREDITORS', label: 'SUNDRY CREDITORS'}]} 
                 />
              </div>
              <div className="flex items-center gap-4">
                 <label className="w-28 text-right text-[10px] font-black uppercase text-black tracking-widest">Station :</label>
                 <ERPInput 
                   className="flex-1 h-9 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all" 
                   value={formData.station}
                   onChange={(e) => setFormData({...formData, station: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-4">
                 <label className="w-28 text-right text-[10px] font-black uppercase text-black tracking-widest">GST No :</label>
                 <ERPInput 
                   className="flex-1 h-9 text-sm uppercase font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all" 
                   value={formData.gstin}
                   onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                   maxLength={15} 
                 />
              </div>
           </div>
           
           <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <label className="w-28 text-right text-[10px] font-black uppercase text-black tracking-widest">Mobile No :</label>
                 <ERPInput 
                   className="flex-1 h-9 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all" 
                   value={formData.mobile}
                   onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-4">
                 <label className="w-28 text-right text-[10px] font-black uppercase text-black tracking-widest">Email :</label>
                 <ERPInput 
                   className="flex-1 h-9 text-sm font-bold border-2 border-slate-100 focus:border-black rounded-none transition-all" 
                   value={formData.email}
                   onChange={(e) => setFormData({...formData, email: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-4">
                 <label className="w-28 text-right text-[10px] font-black uppercase text-black tracking-widest">Limit :</label>
                 <ERPInput 
                   className="flex-1 h-9 text-sm text-right font-black border-2 border-slate-100 focus:border-black rounded-none transition-all" 
                   value={formData.creditLimit}
                   onChange={(e) => setFormData({...formData, creditLimit: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-4">
                 <label className="w-28 text-right text-[10px] font-black uppercase text-black tracking-widest">Address :</label>
                 <textarea 
                   className="flex-1 min-h-[60px] text-sm p-3 border-2 border-slate-100 focus:border-black rounded-none outline-none transition-all font-bold" 
                   value={formData.address}
                   onChange={(e) => setFormData({...formData, address: e.target.value})}
                 />
              </div>
           </div>
        </div>

        <div className="flex justify-between bg-black p-6">
           <div className="flex gap-2">
              {['F2 Add', 'F3 Edit', 'F4 Delete', 'Find'].map(btn => (
                <button key={btn} className="px-6 py-2 bg-transparent text-white text-[11px] font-black uppercase tracking-widest border border-white/20 hover:bg-white/10 transition-all">
                  {btn}
                </button>
              ))}
           </div>
           <div className="flex gap-3">
              <button onClick={onClose} className="px-8 py-2 bg-transparent text-white text-[11px] font-black uppercase tracking-widest border border-white/20 hover:bg-white/10 transition-all">Cancel (Esc)</button>
              <button 
                onClick={handleSave}
                className="px-10 py-2 bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Save Master (F12)
              </button>
           </div>
        </div>
      </div>
    </Modal>
  );
};

export default AccountMasterModal;
