import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect, ERPButton, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { Trash2, Plus } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';

const today = () => new Date().toISOString().split('T')[0];

const PurchaseModal = ({ isOpen, onClose, selectedBook = null, readOnly = false }) => {
  const { parties, items, addPurchase, fetchParties, fetchItems } = useStore();
  
  const [header, setHeader] = useState({
    party: '', add: '', broker: '', book: 'FINISH PURCHASE', gstin: '', city: '',
    vNo: 'AUTO', billNo: '', billDate: today(), challanNo: '', chDate: today(),
    type: 'INVOICE IN STATE', gstType: 'CGST+SGST', reverseCharge: 'No'
  });

  useEffect(() => {
    if (isOpen) {
      fetchParties();
      fetchItems();
      setHeader(prev => ({
        ...prev, vNo: 'AUTO', billDate: today(), chDate: today(), book: selectedBook || prev.book
      }));
    }
  }, [isOpen, selectedBook, fetchParties, fetchItems]);

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', hsnCode: '', fold: 0, cut: 0, pcs: 0, mts: 0, rate: 0, amount: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, gstPer: 0, gstAmt: 0 }
  ]);

  const [footer, setFooter] = useState({
    discountAmt: 0, lessAmt: 0, addAmt: 0, octroi: 0,
    itcEligibility: 'Inputs', roundOff: 0, rcmCharge: 0, remarks: ''
  });

  const [inlineModal, setInlineModal] = useState({
    type: null, target: 'party', initialData: null, rowIndex: null
  });

  const calculations = useMemo(() => {
    let gross = 0;
    let totalGstFromItems = 0;

    gridItems.forEach(item => {
      let itemAmt = (parseFloat(item.mts || 0) * parseFloat(item.rate || 0)) - parseFloat(item.dis1Amt || 0) - parseFloat(item.dis2Amt || 0);
      gross += itemAmt;
      totalGstFromItems += parseFloat(item.gstAmt || 0);
    });

    let taxable = gross 
      - parseFloat(footer.discountAmt || 0) 
      - parseFloat(footer.lessAmt || 0) 
      + parseFloat(footer.addAmt || 0)
      + parseFloat(footer.octroi || 0);

    // Use item-level GST total if any, otherwise default 5%
    const gstAmt = totalGstFromItems > 0 ? totalGstFromItems : (header.type === 'INVOICE OUT OF STATE' ? (taxable * 0.05) : (taxable * 0.05));
    
    let net = taxable + gstAmt + parseFloat(footer.roundOff || 0) + parseFloat(footer.rcmCharge || 0);
    return { gross, taxable, gstAmt, net };
  }, [gridItems, footer, header.type]);

  const handleCreateAccount = (search) => setInlineModal({ type: 'account', target: 'party', initialData: { name: search, group: 'SUNDRY CREDITORS' } });
  const handleCreateBroker = (search) => setInlineModal({ type: 'account', target: 'broker', initialData: { name: search, group: 'BROKER' } });
  const handleCreateItem = (search, index) => setInlineModal({ type: 'item', initialData: { itemName: search }, rowIndex: index });

  const handleAccountSuccess = (newAccount) => {
    fetchParties();
    const id = newAccount._id || newAccount.id;
    if (inlineModal.target === 'broker') {
      setHeader(prev => ({ ...prev, broker: id }));
      return;
    }
    setHeader(prev => ({ 
      ...prev, party: id, add: newAccount.address || '', gstin: newAccount.gstin || '', city: newAccount.station || newAccount.city || ''
    }));
  };

  const handleItemSuccess = (newItem) => {
    fetchItems();
    const updatedGrid = [...gridItems];
    updatedGrid[inlineModal.rowIndex] = { 
      ...updatedGrid[inlineModal.rowIndex], itemId: newItem._id || newItem.id, itemName: newItem.itemName, rate: newItem.purRate, gstPer: newItem.gstRate || 5
    };
    setGridItems(updatedGrid);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!header.party) return alert('Please select a party');
    setSaving(true);
    try {
      await addPurchase({
        supplierId: header.party,
        supplierInvoiceNo: header.billNo,
        invoiceNo: 'AUTO',
        date: header.billDate,
        bookId: header.book,
        challanNo: header.challanNo,
        challanDate: header.chDate,
        brokerId: header.broker,
        type: header.type,
        reverseCharge: header.reverseCharge,
        narration: footer.remarks,
        discountAmt: footer.discountAmt,
        lessAmt: footer.lessAmt,
        addAmt: footer.addAmt,
        octroi: footer.octroi,
        itcEligibility: footer.itcEligibility,
        roundOff: footer.roundOff,
        rcmCharge: footer.rcmCharge,
        items: gridItems.filter(i => i.itemId).map(i => ({
          itemId: i.itemId,
          fold: Number(i.fold || 0),
          cut: Number(i.cut || 0),
          pcs: Number(i.pcs || 0),
          mts: Number(i.mts || 0),
          rate: Number(i.rate || 0),
          amount: Number(i.amount || 0),
          dis1Per: Number(i.dis1Per || 0),
          dis1Amt: Number(i.dis1Amt || 0),
          dis2Per: Number(i.dis2Per || 0),
          dis2Amt: Number(i.dis2Amt || 0),
          gstPer: Number(i.gstPer || 0),
          gstAmt: Number(i.gstAmt || 0)
        })),
        taxableAmount: calculations.taxable,
        gstAmount: calculations.gstAmt,
        netAmount: calculations.net,
        gstType: header.type === 'INVOICE OUT OF STATE' ? 'IGST' : 'CGST+SGST',
        cgst: header.type === 'INVOICE OUT OF STATE' ? 0 : calculations.gstAmt / 2,
        sgst: header.type === 'INVOICE OUT OF STATE' ? 0 : calculations.gstAmt / 2,
        igst: header.type === 'INVOICE OUT OF STATE' ? calculations.gstAmt : 0,
      });
      alert('Purchase saved successfully!');
      onClose();
    } catch (err) {
      alert('Failed to save purchase: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Purchase invoice" className="max-w-6xl">
      <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1 bg-[var(--bg-base)]">
        <div className="flex-1 overflow-y-auto no-scrollbar p-3">
          
          {/* Top Header Section */}
          <div className="erp-card p-3 mb-3 border-l-4 border-l-[var(--blue)]">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8 erp-field">
                  <label className="erp-label">Vendor / Supplier</label>
                  <ERPSearchableSelect 
                    className="w-full" value={header.party}
                    onChange={(val) => {
                      const p = parties.find(x => x._id === val || x.id === val);
                      setHeader({...header, party: val, add: p?.address || '', gstin: p?.gstin || '', city: p?.station || p?.city || ''});
                    }}
                    onCreateNew={handleCreateAccount}
                    options={parties.filter(p => p.type !== 'Broker').map(p => ({value: p._id || p.id, label: p.name}))} 
                    label="Party" createLabel="Supplier"
                  />
                  {header.gstin && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">GSTIN: <span className="font-semibold text-[var(--text-primary)]">{header.gstin}</span></p>}
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Bill Date</label>
                  <input type="date" className="erp-input w-full font-mono text-[12px]" value={header.billDate} onChange={e => setHeader({...header, billDate: e.target.value})} />
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Voucher No</label>
                  <ERPInput className="w-full bg-[var(--bg-base)] font-bold text-[var(--blue)]" value={header.vNo} readOnly />
              </div>

              <div className="col-span-2 erp-field">
                  <label className="erp-label">Supp. Bill No</label>
                  <ERPInput className="w-full text-[12px]" value={header.billNo} onChange={e => setHeader({...header, billNo: e.target.value})} />
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Ch.No.</label>
                  <ERPInput className="w-full text-[12px]" value={header.challanNo} onChange={e => setHeader({...header, challanNo: e.target.value})} />
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Ch.Date</label>
                  <input type="date" className="erp-input w-full font-mono text-[12px]" value={header.chDate} onChange={e => setHeader({...header, chDate: e.target.value})} />
              </div>
              <div className="col-span-4 erp-field">
                  <label className="erp-label">Broker</label>
                  <ERPSearchableSelect className="w-full" value={header.broker} onChange={(val) => setHeader({...header, broker: val})} onCreateNew={handleCreateBroker} options={parties.filter(p => p.type === 'Broker' || p.group === 'BROKER').map(p => ({value: p._id || p.id, label: p.name}))} label="Broker" createLabel="Broker" />
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Reverse Charge</label>
                  <ERPSelect className="w-full" value={header.reverseCharge} onChange={e => setHeader({...header, reverseCharge: e.target.value})} options={[{value: 'No', label: 'No'}, {value: 'Yes', label: 'Yes'}]} />
              </div>

              <div className="col-span-6 erp-field">
                  <label className="erp-label">Type</label>
                  <ERPSelect className="w-full font-semibold" value={header.type} onChange={e => setHeader({...header, type: e.target.value})} options={[{value: 'INVOICE IN STATE', label: 'INVOICE IN STATE'}, {value: 'INVOICE OUT OF STATE', label: 'INVOICE OUT OF STATE'}]} />
              </div>
              <div className="col-span-6 erp-field">
                  <label className="erp-label">Book</label>
                  <ERPSelect className="w-full" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: 'FINISH PURCHASE', label: 'FINISH PURCHASE'}]} />
              </div>
            </div>
          </div>

          {/* Grid Section */}
          <div className="border border-[var(--border-strong)] rounded-lg overflow-hidden bg-white shadow-sm mb-3">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-[var(--bg-base)] border-b border-[var(--border-strong)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        <th className="p-2 border-r border-[var(--border-subtle)] text-center w-8">#</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] min-w-[150px]">Item Name</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Fold</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Cut</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Pcs</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-16 text-center">Mts</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-16 text-right">Rate</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-20 text-right">Amount</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Dis1%</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-16 text-right">Dis1Amt</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Dis2%</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-16 text-right">Dis2Amt</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">GST%</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-16 text-right">GSTAmt</th>
                        <th className="p-2 w-8 text-center"></th>
                     </tr>
                  </thead>
                  <tbody>
                     {gridItems.map((row, idx) => {
                       const updateRow = (field, val) => {
                         const updated = [...gridItems];
                         updated[idx][field] = val;
                         // Calculations
                         updated[idx].mts = (updated[idx].cut || updated[idx].fold || 1) * updated[idx].pcs;
                         updated[idx].amount = updated[idx].mts * updated[idx].rate;
                         updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                         const afterDis1 = updated[idx].amount - updated[idx].dis1Amt;
                         updated[idx].dis2Amt = (afterDis1 * updated[idx].dis2Per) / 100;
                         const taxable = afterDis1 - updated[idx].dis2Amt;
                         updated[idx].gstAmt = (taxable * updated[idx].gstPer) / 100;
                         setGridItems(updated);
                       };

                       return (
                        <tr key={row.id || idx} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-base)] transition-colors group">
                           <td className="p-1 border-r border-[var(--border-subtle)] text-center text-[10px] font-medium text-[var(--text-muted)]">{idx + 1}</td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <ERPSearchableSelect 
                                className="w-full border-transparent hover:border-[var(--border)] focus-within:border-[var(--accent)]" 
                                value={row.itemId}
                                onChange={(val) => {
                                  const item = items.find(i => i._id === val || i.id === val);
                                  const updated = [...gridItems];
                                  updated[idx] = { ...updated[idx], itemId: val, itemName: item?.itemName || '', rate: item?.purRate || 0, gstPer: item?.gstRate || 5 };
                                  setGridItems(updated);
                                }}
                                onCreateNew={(search) => handleCreateItem(search, idx)}
                                options={items.map(i => ({value: i._id || i.id, label: i.itemName || i.name}))} 
                                label="Item" createLabel="Item"
                              />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.fold || ''} onChange={e => updateRow('fold', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.cut || ''} onChange={e => updateRow('cut', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] font-semibold focus:border-[var(--accent)] focus:outline-none" value={row.pcs || ''} onChange={e => updateRow('pcs', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] font-semibold text-[var(--accent)] focus:border-[var(--accent)] focus:outline-none" value={row.mts || ''} onChange={e => updateRow('mts', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-right text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.rate || ''} onChange={e => updateRow('rate', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)] text-right px-2 text-[11px] font-mono">
                              {parseFloat(row.amount || 0).toFixed(2)}
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.dis1Per || ''} onChange={e => updateRow('dis1Per', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-right text-[11px] focus:border-[var(--accent)] focus:outline-none text-[var(--red)]" value={row.dis1Amt || ''} onChange={e => updateRow('dis1Amt', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.dis2Per || ''} onChange={e => updateRow('dis2Per', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-right text-[11px] focus:border-[var(--accent)] focus:outline-none text-[var(--red)]" value={row.dis2Amt || ''} onChange={e => updateRow('dis2Amt', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.gstPer || ''} onChange={e => updateRow('gstPer', Number(e.target.value))} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-right text-[11px] focus:border-[var(--accent)] focus:outline-none text-[var(--text-secondary)]" value={row.gstAmt || ''} onChange={e => updateRow('gstAmt', Number(e.target.value))} />
                           </td>
                           <td className="p-1 text-center">
                              <button type="button" onClick={() => {
                                    const updated = gridItems.filter((_, i) => i !== idx);
                                    setGridItems(updated.length ? updated : [{ id: Date.now(), itemId: '', itemName: '', hsnCode: '', fold: 0, cut: 0, pcs: 0, mts: 0, rate: 0, amount: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, gstPer: 0, gstAmt: 0 }]);
                                 }} className="text-[var(--text-muted)] hover:text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                 <Trash2 size={13} />
                              </button>
                           </td>
                        </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
            <div className="p-1.5 bg-[var(--bg-base)] border-t border-[var(--border-strong)] flex justify-between items-center">
               <button type="button" onClick={() => setGridItems([...gridItems, { id: Date.now(), itemId: '', itemName: '', hsnCode: '', fold: 0, cut: 0, pcs: 0, mts: 0, rate: 0, amount: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, gstPer: 0, gstAmt: 0 }])} className="text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
                  <Plus size={12} strokeWidth={3} /> Add Line Item
               </button>
               <div className="text-[11px] font-bold text-[var(--text-secondary)] px-4">
                 Total Pcs: <span className="text-[var(--text-primary)] mr-4">{gridItems.reduce((a,b)=>a+(Number(b.pcs)||0),0)}</span>
                 Total Mts: <span className="text-[var(--text-primary)]">{gridItems.reduce((a,b)=>a+(Number(b.mts)||0),0).toFixed(2)}</span>
               </div>
            </div>
          </div>

          {/* Footer & Calculations */}
          <div className="grid grid-cols-12 gap-3">
             
             {/* Bottom Left: Additional Calculations */}
             <div className="col-span-3 erp-card p-3 flex flex-col gap-2 border border-[var(--border-strong)]">
                <div className="flex items-center justify-between erp-field mb-0">
                   <label className="text-[10px] font-bold text-[var(--text-secondary)]">DISCOUNT</label>
                   <input type="number" className="erp-input h-7 w-24 text-right text-[11px]" value={footer.discountAmt || ''} onChange={e => setFooter({...footer, discountAmt: Number(e.target.value)})} />
                </div>
                <div className="flex items-center justify-between erp-field mb-0">
                   <label className="text-[10px] font-bold text-[var(--text-secondary)]">LESS</label>
                   <input type="number" className="erp-input h-7 w-24 text-right text-[11px] text-[var(--red)]" value={footer.lessAmt || ''} onChange={e => setFooter({...footer, lessAmt: Number(e.target.value)})} />
                </div>
                <div className="flex items-center justify-between erp-field mb-0">
                   <label className="text-[10px] font-bold text-[var(--text-secondary)]">ADD</label>
                   <input type="number" className="erp-input h-7 w-24 text-right text-[11px] text-[var(--green)]" value={footer.addAmt || ''} onChange={e => setFooter({...footer, addAmt: Number(e.target.value)})} />
                </div>
                <div className="flex items-center justify-between erp-field mb-0">
                   <label className="text-[10px] font-bold text-[var(--text-secondary)]">OCTROI</label>
                   <input type="number" className="erp-input h-7 w-24 text-right text-[11px]" value={footer.octroi || ''} onChange={e => setFooter({...footer, octroi: Number(e.target.value)})} />
                </div>
                <div className="flex items-center justify-between erp-field mb-0 mt-2 border-t border-[var(--border-subtle)] pt-2">
                   <label className="text-[10px] font-bold text-[var(--text-secondary)]">ITC Elig.</label>
                   <select className="erp-input h-7 w-24 text-[10px] px-1" value={footer.itcEligibility} onChange={e => setFooter({...footer, itcEligibility: e.target.value})}>
                      <option value="Inputs">Inputs</option>
                      <option value="Capital Goods">Capital Goods</option>
                      <option value="None">None</option>
                   </select>
                </div>
             </div>

             {/* Bottom Center: Narration */}
             <div className="col-span-5 erp-card p-3 border border-[var(--border-strong)]">
                <div className="erp-field mb-0 h-full flex flex-col">
                   <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Remarks / Narration</label>
                   <textarea className="erp-input flex-1 p-2 resize-none text-[12px]" value={footer.remarks} onChange={e => setFooter({ ...footer, remarks: e.target.value })} placeholder="Optional narration or internal notes" />
                </div>
             </div>

             {/* Bottom Right: Final Summary */}
             <div className="col-span-4 erp-card p-4 bg-gradient-to-br from-white to-[var(--bg-base)] border border-[var(--border-strong)] shadow-md flex flex-col justify-end">
                <div className="space-y-1.5 text-[12px]">
                   <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                      <span>TAXABLE AMOUNT</span>
                      <span className="font-bold text-[var(--text-primary)] font-mono text-[13px]">₹{calculations.taxable.toFixed(2)}</span>
                   </div>
                   {header.type === 'INVOICE OUT OF STATE' ? (
                      <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                         <span>IGST</span>
                         <span className="font-semibold text-[var(--text-primary)] font-mono">₹{calculations.gstAmt.toFixed(2)}</span>
                      </div>
                   ) : (
                      <>
                         <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                            <span>CGST</span>
                            <span className="font-semibold text-[var(--text-primary)] font-mono">₹{(calculations.gstAmt / 2).toFixed(2)}</span>
                         </div>
                         <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                            <span>SGST</span>
                            <span className="font-semibold text-[var(--text-primary)] font-mono">₹{(calculations.gstAmt / 2).toFixed(2)}</span>
                         </div>
                      </>
                   )}
                   <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                      <span>ROUND OFF</span>
                      <input type="number" className="erp-input h-6 w-20 text-right text-[11px] font-mono border-transparent bg-[var(--bg-base)] focus:border-[var(--accent)]" value={footer.roundOff || ''} onChange={e => setFooter({...footer, roundOff: Number(e.target.value)})} />
                   </div>
                   <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                      <span>RCM CHARGE</span>
                      <input type="number" className="erp-input h-6 w-20 text-right text-[11px] font-mono border-transparent bg-[var(--bg-base)] focus:border-[var(--accent)]" value={footer.rcmCharge || ''} onChange={e => setFooter({...footer, rcmCharge: Number(e.target.value)})} />
                   </div>
                   
                   <div className="flex justify-between items-center pt-3 border-t border-[var(--border-strong)] mt-2">
                      <span className="font-extrabold text-[15px] text-[var(--text-primary)] uppercase tracking-wide">NET AMOUNT</span>
                      <span className="font-extrabold text-[18px] text-[var(--blue)] font-mono">₹{calculations.net.toFixed(2)}</span>
                   </div>
                </div>
             </div>
          </div>
          
        </div>
        <div className="erp-modal-footer bg-white border-t border-[var(--border)] p-4 shrink-0 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           <button type="button" className="erp-btn erp-btn-secondary px-6" onClick={onClose}>Cancel</button>
           {!readOnly && (
           <button type="submit" disabled={saving} className="erp-btn erp-btn-primary px-8" style={{ background: 'var(--blue)', borderColor: 'var(--blue)' }}>
              {saving ? 'Saving...' : 'Save Purchase'}
           </button>
           )}
        </div>
      </form>

      {/* Inline Creation Modals */}
      <AccountMasterModal 
        isOpen={inlineModal.type === 'account'} 
        onClose={() => setInlineModal({ type: null, target: 'party', initialData: null, rowIndex: null })}
        initialData={inlineModal.initialData}
        onSuccess={handleAccountSuccess}
      />
      <ItemMasterModal 
        isOpen={inlineModal.type === 'item'} 
        onClose={() => setInlineModal({ type: null, target: 'party', initialData: null, rowIndex: null })}
        initialData={inlineModal.initialData}
        onSuccess={handleItemSuccess}
      />
    </Modal>
  );
};

export default PurchaseModal;
