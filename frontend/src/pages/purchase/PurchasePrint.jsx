import React from 'react';
import useStore from '../../store/useStore';

const PurchasePrint = ({ invoiceId, onClose }) => {
  const { purchases, parties } = useStore();
  const invoice = purchases.find(p => p.id === invoiceId || p._id === invoiceId);
  const supplierRef = invoice?.supplierId;
  const supplierId =
    typeof supplierRef === 'object' ? supplierRef?._id || supplierRef?.id : supplierRef;
  const party =
    parties.find(p => p.id === supplierId || p._id === supplierId) ||
    (typeof supplierRef === 'object' ? supplierRef : null);
  
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center p-4 pt-10 pb-10 print:p-0 print:bg-white overflow-y-auto overflow-x-auto">
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-[101]">
        <button onClick={handlePrint} className="px-4 py-2 bg-black text-white font-bold text-sm uppercase tracking-wider rounded shadow-lg hover:bg-slate-800">
          Print
        </button>
        <button onClick={onClose} className="px-4 py-2 bg-white text-black font-bold text-sm uppercase tracking-wider rounded shadow-lg hover:bg-slate-100">
          Close
        </button>
      </div>

      <div className="bg-white w-[210mm] print:min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:h-auto print:min-h-0 mx-auto relative flex flex-col text-black font-sans box-border shrink-0" style={{ padding: '10mm' }}>
        
        <div className="text-center border-b-2 border-black pb-2 mb-4">
          <h1 className="text-xl font-black uppercase tracking-widest">Purchase Voucher</h1>
        </div>

        <div className="flex border-2 border-black mb-4 h-32">
          <div className="w-1/2 border-r-2 border-black p-2">
             <div className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Purchased From</div>
             <h2 className="text-lg font-black uppercase tracking-wide">{party?.name || 'VENDOR'}</h2>
             <p className="text-xs mt-1">{party?.address || ''}</p>
             <p className="text-xs">{party?.city || party?.station || ''}</p>
             <p className="text-xs font-bold mt-2">GSTIN: {party?.gstin || ''}</p>
          </div>
          <div className="w-1/2 flex flex-col">
             <div className="h-1/2 border-b-2 border-black p-2 flex">
                <div className="w-1/2 border-r border-slate-300">
                   <div className="text-[10px] font-bold text-slate-500 uppercase">Supplier Bill No</div>
                   <div className="font-bold text-sm">{invoice.supplierInvoiceNo || '-'}</div>
                </div>
                <div className="w-1/2 pl-2">
                   <div className="text-[10px] font-bold text-slate-500 uppercase">Date</div>
                   <div className="font-bold text-sm">{invoice.date || invoice.createdAt?.split('T')[0]}</div>
                </div>
             </div>
             <div className="h-1/2 p-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Internal Voucher No</div>
                <div className="font-bold text-sm">{invoice.invoiceNo || '-'}</div>
             </div>
          </div>
        </div>

        <div className="flex-1 border-2 border-black flex flex-col mb-4">
           <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                 <tr className="border-b-2 border-black font-bold uppercase">
                    <th className="p-1.5 border-r-2 border-black w-8 text-center">No</th>
                    <th className="p-1.5 border-r-2 border-black">Item</th>
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
                       <td className="p-1.5 border-r-2 border-black text-center">{item.pcs || 0}</td>
                       <td className="p-1.5 border-r-2 border-black text-center">{item.mts || 0}</td>
                       <td className="p-1.5 border-r-2 border-black text-right">{item.rate?.toFixed(2)}</td>
                       <td className="p-1.5 text-right font-mono font-bold">{(item.amount || 0).toFixed(2)}</td>
                    </tr>
                 ))}
               </tbody>
            </table>
            <div className="flex-1 flex w-full">
               <div className="w-8 border-r-2 border-black shrink-0"></div>
               <div className="flex-1 border-r-2 border-black"></div>
               <div className="w-12 border-r-2 border-black shrink-0"></div>
               <div className="w-16 border-r-2 border-black shrink-0"></div>
               <div className="w-16 border-r-2 border-black shrink-0"></div>
               <div className="w-24 shrink-0"></div>
            </div>
        </div>

        <div className="flex justify-end border-2 border-black">
           <div className="w-1/3 flex flex-col text-[11px]">
              <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                 <span>Gross Subtotal</span>
                 <span className="font-mono">{((invoice.taxableAmount || invoice.totals?.subtotal || 0) 
                   - (invoice.discountSign === '+' ? 1 : -1) * (invoice.discountAmt || 0)
                   - (invoice.lessSign === '+' ? 1 : -1) * (invoice.lessAmt || 0)
                   - (invoice.addSign === '+' ? 1 : -1) * (invoice.addAmt || 0)
                   - (invoice.octroiSign === '+' ? 1 : -1) * (invoice.octroi || 0)).toFixed(2)}</span>
              </div>
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
              {invoice.octroi > 0 && (
                <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                   <span>Octroi ({invoice.octroiSign})</span>
                   <span className="font-mono">{invoice.octroi.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between p-1.5 border-b border-slate-200 font-bold bg-slate-50">
                 <span>Taxable Base</span>
                 <span className="font-mono">{(invoice.taxableAmount || invoice.totals?.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-1.5 border-b border-slate-200">
                 <span>GST Total</span>
                 <span className="font-mono">{(invoice.gstAmount || 0).toFixed(2)}</span>
              </div>
              {invoice.rcmCharge > 0 && (
                <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                   <span>RCM ({invoice.rcmChargeSign})</span>
                   <span className="font-mono">{invoice.rcmCharge.toFixed(2)}</span>
                </div>
              )}
              {invoice.roundOff > 0 && (
                <div className="flex justify-between p-1.5 border-b border-slate-200 text-slate-600">
                   <span>Round Off</span>
                   <span className="font-mono">{invoice.roundOff.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between p-2 font-black text-sm bg-slate-100">
                 <span>Net Total</span>
                 <span className="font-mono">₹ {(invoice.netAmount || invoice.totals?.total || 0).toFixed(2)}</span>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default PurchasePrint;
