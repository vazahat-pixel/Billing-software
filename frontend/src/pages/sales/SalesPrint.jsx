import React from 'react';
import useStore from '../../store/useStore';

const SalesPrint = ({ invoiceId, onClose }) => {
  const { sales, parties, items } = useStore();
  const invoice = sales.find(s => s.id === invoiceId || s._id === invoiceId);
  const party = parties.find(p => p.id === invoice?.customerId || p._id === invoice?.customerId);
  
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center p-4 pt-10 pb-10 print:p-0 print:bg-white overflow-y-auto overflow-x-auto">
      {/* Non-printable overlay controls */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-[101]">
        <button onClick={handlePrint} className="px-4 py-2 bg-black text-white font-bold text-sm uppercase tracking-wider rounded shadow-lg hover:bg-slate-800">
          Print
        </button>
        <button onClick={onClose} className="px-4 py-2 bg-white text-black font-bold text-sm uppercase tracking-wider rounded shadow-lg hover:bg-slate-100">
          Close
        </button>
      </div>

      {/* A4 Paper Container */}
      <div className="bg-white w-[210mm] print:min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:h-auto print:min-h-0 mx-auto relative flex flex-col text-black font-sans box-border shrink-0" style={{ padding: '10mm' }}>
        
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-2 mb-4">
          <h1 className="text-xl font-black uppercase tracking-widest">Tax Invoice</h1>
        </div>

        {/* Company & Party Details */}
        <div className="flex border-2 border-black mb-4 h-32">
          {/* Company Side (Left) */}
          <div className="w-1/2 border-r-2 border-black p-2">
             <div className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Billed By</div>
             <h2 className="text-lg font-black uppercase tracking-wide">Your Company Name</h2>
             <p className="text-xs mt-1">123 Business Street, Industrial Area</p>
             <p className="text-xs">City, State, 123456</p>
             <p className="text-xs font-bold mt-2">GSTIN: 24XXXXX1234X1Z5</p>
          </div>
          {/* Party Side (Right) */}
          <div className="w-1/2 flex flex-col">
             <div className="h-1/2 border-b-2 border-black p-2 flex">
                <div className="w-1/2">
                   <div className="text-[10px] font-bold text-slate-500 uppercase">Invoice No</div>
                   <div className="font-bold text-sm">{invoice.invoiceNo}</div>
                </div>
                <div className="w-1/2">
                   <div className="text-[10px] font-bold text-slate-500 uppercase">Date</div>
                   <div className="font-bold text-sm">{invoice.date || invoice.createdAt?.split('T')[0]}</div>
                </div>
             </div>
             <div className="h-1/2 p-2">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Billed To</div>
                <div className="font-bold text-sm">{party?.name || 'CASH'}</div>
                <div className="text-[10px] truncate">{party?.address || ''}</div>
                {party?.gstin && <div className="text-[10px] font-bold mt-1">GSTIN: {party.gstin}</div>}
             </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 border-2 border-black flex flex-col mb-4">
           <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                 <tr className="border-b-2 border-black font-bold uppercase">
                    <th className="p-1.5 border-r-2 border-black w-8 text-center">No</th>
                    <th className="p-1.5 border-r-2 border-black">Description of Goods</th>
                    <th className="p-1.5 border-r-2 border-black w-12 text-center">Fold</th>
                    <th className="p-1.5 border-r-2 border-black w-12 text-center">Cut</th>
                    <th className="p-1.5 border-r-2 border-black w-12 text-center">Pcs</th>
                    <th className="p-1.5 border-r-2 border-black w-16 text-center">Mtrs</th>
                    <th className="p-1.5 border-r-2 border-black w-16 text-right">Rate</th>
                    <th className="p-1.5 w-24 text-right">Amount</th>
                 </tr>
              </thead>
              <tbody>
                 {invoice.items?.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200 last:border-b-0">
                       <td className="p-1.5 border-r-2 border-black text-center">{idx + 1}</td>
                       <td className="p-1.5 border-r-2 border-black font-semibold">{item.itemId?.name || item.itemId?.itemName || item.item || 'Unknown Item'}</td>
                       <td className="p-1.5 border-r-2 border-black text-center">{item.fold || 0}</td>
                       <td className="p-1.5 border-r-2 border-black text-center">{item.cut || 0}</td>
                       <td className="p-1.5 border-r-2 border-black text-center">{item.pcs || 0}</td>
                       <td className="p-1.5 border-r-2 border-black text-center">{item.mts || 0}</td>
                       <td className="p-1.5 border-r-2 border-black text-right">{item.rate?.toFixed(2)}</td>
                       <td className="p-1.5 text-right font-mono font-bold">{(item.amount || 0).toFixed(2)}</td>
                    </tr>
                 ))}
               </tbody>
            </table>
            {/* Empty space filler for vertical lines (stretches to fill page height during print) */}
            <div className="flex-1 flex w-full">
               <div className="w-8 border-r-2 border-black shrink-0"></div>
               <div className="flex-1 border-r-2 border-black"></div>
               <div className="w-12 border-r-2 border-black shrink-0"></div>
               <div className="w-12 border-r-2 border-black shrink-0"></div>
               <div className="w-12 border-r-2 border-black shrink-0"></div>
               <div className="w-16 border-r-2 border-black shrink-0"></div>
               <div className="w-16 border-r-2 border-black shrink-0"></div>
               <div className="w-24 shrink-0"></div>
            </div>
        </div>

        {/* Footer Totals */}
        <div className="flex border-2 border-black">
           {/* Summary Left */}
           <div className="w-2/3 border-r-2 border-black p-2 flex flex-col justify-between">
              <div>
                 <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Amount Chargeable (in words)</div>
                 <div className="text-xs font-bold italic border-b border-dashed border-slate-300 pb-2">
                   Indian Rupees {Math.round(invoice.netAmount || 0)} Only
                 </div>
              </div>
              <div className="text-[9px] mt-2">
                 <div className="font-bold underline mb-1">Declaration</div>
                 <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
              </div>
           </div>
            {/* Totals Right */}
            <div className="w-1/3 flex flex-col text-[11px]">
               <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                  <span>Gross Subtotal</span>
                  <span className="font-mono">{((invoice.taxableAmount || 0) 
                    - (invoice.foldLessSign === '+' ? 1 : -1) * (invoice.foldLess || 0)
                    - (invoice.rdAmtSign === '+' ? 1 : -1) * (invoice.rdAmt || 0)
                    - (invoice.discountSign === '+' ? 1 : -1) * (invoice.discountAmt || 0)
                    - (invoice.lessSign === '+' ? 1 : -1) * (invoice.lessAmt || 0)
                    - (invoice.addSign === '+' ? 1 : -1) * (invoice.addAmt || 0)).toFixed(2)}</span>
               </div>
               {invoice.foldLess > 0 && (
                 <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                    <span>Fold Less ({invoice.foldLessSign})</span>
                    <span className="font-mono">{invoice.foldLess.toFixed(2)}</span>
                 </div>
               )}
               {invoice.rdAmt > 0 && (
                 <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                    <span>RD Amount ({invoice.rdAmtSign})</span>
                    <span className="font-mono">{invoice.rdAmt.toFixed(2)}</span>
                 </div>
               )}
               {invoice.discountAmt > 0 && (
                 <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                    <span>Discount ({invoice.discountSign})</span>
                    <span className="font-mono">{invoice.discountAmt.toFixed(2)}</span>
                 </div>
               )}
               {invoice.lessAmt > 0 && (
                 <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                    <span>Less ({invoice.lessSign})</span>
                    <span className="font-mono">{invoice.lessAmt.toFixed(2)}</span>
                 </div>
               )}
               {invoice.addAmt > 0 && (
                 <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                    <span>Add ({invoice.addSign})</span>
                    <span className="font-mono">{invoice.addAmt.toFixed(2)}</span>
                 </div>
               )}
               <div className="flex justify-between p-1.5 border-b border-slate-200 font-bold bg-slate-50">
                  <span>Taxable Amount</span>
                  <span className="font-mono">{(invoice.taxableAmount || 0).toFixed(2)}</span>
               </div>
               {invoice.gstType !== 'IGST' ? (
                 <>
                   <div className="flex justify-between p-1.5 border-b border-slate-200">
                      <span>CGST</span>
                      <span className="font-mono">{(invoice.cgst || (invoice.gstAmount/2) || 0).toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between p-1.5 border-b border-slate-200">
                      <span>SGST</span>
                      <span className="font-mono">{(invoice.sgst || (invoice.gstAmount/2) || 0).toFixed(2)}</span>
                   </div>
                 </>
               ) : (
                 <div className="flex justify-between p-1.5 border-b border-slate-200">
                    <span>IGST</span>
                    <span className="font-mono">{(invoice.igst || invoice.gstAmount || 0).toFixed(2)}</span>
                 </div>
               )}
               {invoice.tcsAmount > 0 && (
                 <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                    <span>TCS ({invoice.tcsPer || 0}%)</span>
                    <span className="font-mono">{invoice.tcsAmount.toFixed(2)}</span>
                 </div>
               )}
               <div className="flex justify-between p-1.5 border-b-2 border-black">
                  <span>Round Off</span>
                  <span className="font-mono">{(invoice.roundOff || 0).toFixed(2)}</span>
               </div>
               <div className="flex justify-between p-2 font-black text-sm bg-slate-100">
                  <span>Total</span>
                  <span className="font-mono">₹ {(invoice.netAmount || 0).toFixed(2)}</span>
               </div>
            </div>
        </div>
        
        {/* Signatures */}
        <div className="flex justify-end mt-12 mb-4">
           <div className="text-center w-64 border-t-2 border-black pt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest block">Authorised Signatory</span>
           </div>
        </div>

      </div>
    </div>
  );
};

export default SalesPrint;
