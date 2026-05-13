import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, FormField } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { Package, Hash, Layers, Ruler, DollarSign, Archive, Save, X } from 'lucide-react';

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
    <Modal isOpen={isOpen} onClose={onClose} title="Inventory SKU Master" className="max-w-4xl p-0 overflow-hidden">
      <div className="bg-white h-full flex flex-col">
        <div className="p-10 flex-1 overflow-y-auto space-y-10 no-scrollbar">
           
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                 <Package size={20} />
              </div>
              <div>
                 <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-black">Product Definition</h4>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Define core item specifications and units</p>
              </div>
              <div className="h-[1px] flex-1 bg-slate-100 ml-4" />
           </div>

           <div className="grid grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Product Name</label>
                    <ERPInput 
                      className="w-full" 
                      value={formData.itemName}
                      onChange={(e) => setFormData({...formData, itemName: e.target.value})}
                      placeholder="FABRIC NAME / TYPE..." 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Product Group</label>
                    <ERPSelect 
                      className="w-full" 
                      value={formData.group}
                      onChange={(e) => setFormData({...formData, group: e.target.value})}
                      options={[{value: 'GREY', label: 'GREY FABRIC'}, {value: 'FINISHED', label: 'FINISHED GOODS'}]} 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Measurement Unit</label>
                    <ERPSelect 
                      className="w-full" 
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      options={[{value: 'MTRS', label: 'METERS (MTRS)'}, {value: 'PCS', label: 'PIECES (PCS)'}]} 
                    />
                 </div>
              </div>
              
              <div className="space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">HSN / SAC Code</label>
                    <ERPInput 
                      className="w-full" 
                      value={formData.hsnCode}
                      onChange={(e) => setFormData({...formData, hsnCode: e.target.value})}
                      placeholder="ENTER HSN CODE..." 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Tax Slab (%)</label>
                    <ERPSelect 
                      className="w-full" 
                      value={formData.taxRate}
                      onChange={(e) => setFormData({...formData, taxRate: e.target.value})}
                      options={[{value: '5', label: '5% GST'}, {value: '12', label: '12% GST'}, {value: '18', label: '18% GST'}]} 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Opening Inventory</label>
                    <ERPInput 
                      className="w-full text-right font-black" 
                      value={formData.opStock}
                      onChange={(e) => setFormData({...formData, opStock: e.target.value})}
                      placeholder="0.00"
                    />
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-4 pt-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                 <DollarSign size={20} />
              </div>
              <div>
                 <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-black">Financial Metrics</h4>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Valuation and standard trading rates</p>
              </div>
              <div className="h-[1px] flex-1 bg-slate-100 ml-4" />
           </div>

           <div className="grid grid-cols-2 gap-10">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Standard Selling Rate</label>
                 <ERPInput 
                   className="w-full text-right font-black" 
                   value={formData.salesRate}
                   onChange={(e) => setFormData({...formData, salesRate: e.target.value})}
                   placeholder="0.00"
                 />
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Standard Purchase Cost</label>
                 <ERPInput 
                   className="w-full text-right font-black" 
                   value={formData.purRate}
                   onChange={(e) => setFormData({...formData, purRate: e.target.value})}
                   placeholder="0.00"
                 />
              </div>
           </div>
        </div>

        <div className="p-8 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0">
           <button 
             onClick={onClose} 
             className="px-8 py-3 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all rounded-2xl flex items-center gap-3"
           >
             <X size={14} /> Discard Item
           </button>
           <button 
             onClick={handleSave}
             className="px-14 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-2xl shadow-xl flex items-center gap-3"
           >
             <Save size={14} /> Commit Master (F12)
           </button>
        </div>
      </div>
    </Modal>
  );
};

export default ItemMasterModal;
