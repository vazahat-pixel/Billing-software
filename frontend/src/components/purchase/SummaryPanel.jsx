import React from 'react';
import { ERPButton } from '../forms/FormElements';

const SummaryPanel = ({ totals, discount, onDiscountChange, onSave }) => {
  return (
    <div className="bill-summary-card sticky top-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="font-black text-slate-800 mb-6 flex items-center justify-between">
        Purchase Summary
        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full uppercase tracking-tighter">Draft</span>
      </h3>
      
      <div className="space-y-4">
        <div className="summary-row">
          <span className="text-slate-500 font-medium">Subtotal</span>
          <span className="font-bold text-slate-900">₹{totals.subtotal}</span>
        </div>
        
        <div className="summary-row items-center">
          <span className="text-slate-500 font-medium">Discount (₹)</span>
          <input 
            type="number" 
            className="w-24 text-right border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all" 
            value={discount}
            onChange={(e) => onDiscountChange(parseFloat(e.target.value || 0))}
          />
        </div>
        
        <div className="summary-row font-bold pt-4 border-t border-dashed border-slate-200">
          <span className="text-slate-800">Taxable Value</span>
          <span className="text-slate-900">₹{totals.taxableValue}</span>
        </div>
        
        <div className="space-y-2 py-2">
           <div className="summary-row text-xs text-slate-500">
             <span>CGST (2.5%)</span>
             <span>₹{totals.cgst}</span>
           </div>
           <div className="summary-row text-xs text-slate-500">
             <span>SGST (2.5%)</span>
             <span>₹{totals.sgst}</span>
           </div>
        </div>
        
        <div className="summary-row total bg-indigo-50 p-4 -mx-6 mb-6">
          <span className="text-indigo-900 font-black">Grand Total</span>
          <span className="text-indigo-600 font-black text-xl">₹{totals.total}</span>
        </div>
      </div>
      
      <div className="mt-6">
         <ERPButton 
           className="w-full justify-center py-4 rounded-xl text-lg font-black tracking-tight"
           onClick={onSave}
         >
           Save Purchase (F2)
         </ERPButton>
         <p className="text-center text-[10px] text-slate-400 mt-4 font-medium uppercase tracking-widest">
           * Inventory will be updated automatically
         </p>
      </div>
    </div>
  );
};

export default SummaryPanel;
