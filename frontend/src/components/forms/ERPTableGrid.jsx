import React from 'react';
import '../../styles/erp-forms.css';

/**
 * Premium ERP Table Grid
 * Features:
 * - Dynamic Row Addition
 * - Keyboard Navigation (Enter/Tab)
 * - Auto-calculations for Textiles
 * - Inline Editing
 */
const ERPTableGrid = ({ columns, data, onDataChange, type = 'purchase' }) => {
  
  const updateRow = (idx, field, value) => {
    const newData = [...data];
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
    const newRow = columns.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultValue || '' }), {});
    onDataChange([...data, newRow]);
  };

  const removeRow = (idx) => {
    if (data.length > 1) {
      const newData = data.filter((_, i) => i !== idx);
      onDataChange(newData);
    } else {
       // Reset first row if only one left
       onDataChange([columns.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultValue || '' }), {})]);
    }
  };

  const handleKeyDown = (e, idx, colIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move to next cell or next row
      const inputs = document.querySelectorAll('.grid-input');
      const currentIndex = (idx * columns.length) + colIdx;
      
      if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      } else {
        // Last cell of last row -> Add new row
        addRow();
        setTimeout(() => {
          const newInputs = document.querySelectorAll('.grid-input');
          newInputs[currentIndex + 1]?.focus();
        }, 10);
      }
    }
  };

  return (
    <div className="erp-grid-container">
      <div className="erp-grid-scroll">
        <table className="erp-grid-table">
          <thead>
            <tr>
              <th width="40">#</th>
              {columns.map(col => (
                <th key={col.key} style={{ width: col.width }}>{col.label}</th>
              ))}
              <th width="40"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="animate-fadeIn">
                <td className="text-center text-[10px] font-bold text-slate-400">{idx + 1}</td>
                {columns.map((col, colIdx) => (
                  <td key={col.key}>
                    <input
                      type={col.type || 'text'}
                      className={`grid-input ${col.readOnly ? 'read-only' : ''}`}
                      value={row[col.key] || ''}
                      placeholder={col.placeholder}
                      readOnly={col.readOnly}
                      tabIndex={col.readOnly ? -1 : 0}
                      onChange={(e) => updateRow(idx, col.key, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, colIdx)}
                    />
                  </td>
                ))}
                <td className="text-center">
                  <button 
                    onClick={() => removeRow(idx)}
                    className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    title="Remove Row"
                    tabIndex={-1}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-4">
        <button 
          onClick={addRow}
          className="flex items-center gap-2 text-[11px] font-black text-indigo-600 hover:text-indigo-700 transition-all uppercase tracking-widest px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-100 hover:border-indigo-200"
        >
          + Add New Line Item (Enter)
        </button>
        <span className="text-[10px] text-slate-400 font-medium italic">
          Tip: Press Enter in the last cell to add a new row automatically.
        </span>
      </div>
    </div>
  );
};

export default ERPTableGrid;
