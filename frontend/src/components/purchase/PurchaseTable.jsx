import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PurchaseTable = ({ items, onDataChange, storeItems }) => {
  
  const updateRow = (idx, field, value) => {
    const newData = [...items];
    const row = { ...newData[idx], [field]: value };

    // Numerical conversions
    const mtrs = parseFloat(row.mtrs || 0);
    const rate = parseFloat(row.rate || 0);
    const fold = parseFloat(row.fold || 0);
    const cut = parseFloat(row.cut || 0);

    // USER LOGIC: Net = MTRS - Fold - Cut
    const netMtrs = mtrs - fold - cut;
    row.net_mtrs = netMtrs.toFixed(2);

    // USER LOGIC: Amount = MTRS * Rate
    const amount = mtrs * rate;
    row.amount = amount.toFixed(2);

    newData[idx] = row;
    onDataChange(newData);
  };

  const addRow = () => {
    onDataChange([...items, { lot_no: '', item: '', itemId: '', design: '', color: '', size: '', pcs: '', mtrs: '', rate: '', fold: '0.00', cut: '0.00', amount: '0', net_mtrs: '0' }]);
  };

  const removeRow = (idx) => {
    if (items.length > 1) {
      onDataChange(items.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="erp-grid-container bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="erp-grid-table w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Item</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Design</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">PCS</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">MTRS</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Fold</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Cut</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Net MTRS</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Rate</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Amount</th>
              <th className="px-2"></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {items.map((row, idx) => (
                <motion.tr 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <td className="p-1">
                     <select 
                        className="grid-input"
                        value={row.itemId}
                        onChange={(e) => {
                          const itm = storeItems.find(i => i.id === e.target.value);
                          updateRow(idx, 'itemId', e.target.value);
                          if (itm) {
                            updateRow(idx, 'item', itm.itemName);
                            updateRow(idx, 'design', itm.design);
                          }
                        }}
                     >
                       <option value="">Select Item</option>
                       {storeItems.map(i => <option key={i.id} value={i.id}>{i.itemName}</option>)}
                     </select>
                  </td>
                  <td className="p-1"><input className="grid-input read-only" value={row.design} readOnly /></td>
                  <td className="p-1"><input className="grid-input" type="number" value={row.pcs} onChange={(e) => updateRow(idx, 'pcs', e.target.value)} /></td>
                  <td className="p-1"><input className="grid-input font-bold" type="number" value={row.mtrs} onChange={(e) => updateRow(idx, 'mtrs', e.target.value)} /></td>
                  <td className="p-1"><input className="grid-input text-slate-400" type="number" value={row.fold} onChange={(e) => updateRow(idx, 'fold', e.target.value)} /></td>
                  <td className="p-1"><input className="grid-input text-slate-400" type="number" value={row.cut} onChange={(e) => updateRow(idx, 'cut', e.target.value)} /></td>
                  <td className="p-1"><input className="grid-input read-only font-black" value={row.net_mtrs} readOnly /></td>
                  <td className="p-1"><input className="grid-input" type="number" value={row.rate} onChange={(e) => updateRow(idx, 'rate', e.target.value)} /></td>
                  <td className="p-1"><input className="grid-input read-only font-black text-indigo-600" value={row.amount} readOnly /></td>
                  <td className="p-1">
                    <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-1 opacity-0 group-hover:opacity-100">×</button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-100">
        <button 
          onClick={addRow}
          className="flex items-center gap-2 text-[11px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest px-4 py-2 bg-white rounded-lg border border-indigo-100 hover:border-indigo-200 shadow-sm active:scale-95 transition-all"
        >
          + Add New Line Item
        </button>
      </div>
    </div>
  );
};

export default PurchaseTable;
