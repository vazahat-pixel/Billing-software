import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const ItemMasterModal = ({ isOpen, onClose, initialData = null, onSuccess = null }) => {
  const { addItem } = useStore();
  const [formData, setFormData] = useState({
    itemName: '',
    group: 'GREY',
    unit: 'MTRS',
    hsnCode: '',
    taxRate: '5',
    salesRate: '0.00',
    purRate: '0.00',
    opStock: '0.00'
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    } else {
      setFormData({
        itemName: '',
        group: 'GREY',
        unit: 'MTRS',
        hsnCode: '',
        taxRate: '5',
        salesRate: '0.00',
        purRate: '0.00',
        opStock: '0.00'
      });
    }
  }, [initialData, isOpen]);

  const handleSave = async () => {
    if (!formData.itemName) return alert('Item Name is required');
    try {
      const response = await addItem(formData);
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
      alert('Failed to save item: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Item Master" className="max-w-4xl bg-[#f8fafc]">
      <div className="p-6">
        <div className="grid grid-cols-2 gap-8">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Item Name :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm bg-blue-50/50 focus:bg-white" 
                   value={formData.itemName}
                   onChange={(e) => setFormData({...formData, itemName: e.target.value})}
                   placeholder="Enter Fabric Name..." 
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Group :</label>
                 <ERPSelect 
                   className="flex-1 h-8 text-sm" 
                   value={formData.group}
                   onChange={(e) => setFormData({...formData, group: e.target.value})}
                   options={[{value: 'GREY', label: 'GREY'}, {value: 'FINISHED', label: 'FINISHED'}]} 
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Unit :</label>
                 <ERPSelect 
                   className="flex-1 h-8 text-sm" 
                   value={formData.unit}
                   onChange={(e) => setFormData({...formData, unit: e.target.value})}
                   options={[{value: 'MTRS', label: 'MTRS'}, {value: 'PCS', label: 'PCS'}]} 
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">HSN Code :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm" 
                   value={formData.hsnCode}
                   onChange={(e) => setFormData({...formData, hsnCode: e.target.value})}
                 />
              </div>
           </div>
           
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Tax Rate :</label>
                 <ERPSelect 
                   className="flex-1 h-8 text-sm" 
                   value={formData.taxRate}
                   onChange={(e) => setFormData({...formData, taxRate: e.target.value})}
                   options={[{value: '5', label: '5%'}, {value: '12', label: '12%'}, {value: '18', label: '18%'}]} 
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Sales Rate :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm text-right" 
                   value={formData.salesRate}
                   onChange={(e) => setFormData({...formData, salesRate: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Pur. Rate :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm text-right" 
                   value={formData.purRate}
                   onChange={(e) => setFormData({...formData, purRate: e.target.value})}
                 />
              </div>
              <div className="flex items-center gap-3">
                 <label className="w-24 text-right text-[11px] font-bold uppercase text-slate-500">Op. Stock :</label>
                 <ERPInput 
                   className="flex-1 h-8 text-sm text-right bg-amber-50" 
                   value={formData.opStock}
                   onChange={(e) => setFormData({...formData, opStock: e.target.value})}
                 />
              </div>
           </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-4 flex justify-between bg-slate-900 -mx-6 -mb-6 p-3">
           <div className="flex gap-1">
              {['F2 Add', 'F3 Edit', 'F4 Delete', 'Stock'].map(btn => (
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

export default ItemMasterModal;
