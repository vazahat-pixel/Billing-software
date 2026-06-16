import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect, ERPButton, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { Trash2, Plus } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';

const today = () => new Date().toISOString().split('T')[0];

const SalesModal = ({ isOpen, onClose, initialData = null, selectedBook = null, readOnly = false }) => {
  const { parties, items, addSale, fetchParties, fetchItems } = useStore();
  const [rowLots, setRowLots] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchParties();
      fetchItems();
      setHeader(prev => ({
        ...prev,
        billNo: 'AUTO',
        billDate: today(),
        chDate: today(),
        orderDate: today(),
        book: selectedBook || prev.book
      }));
    }
  }, [isOpen, selectedBook, fetchParties, fetchItems]);

  const [header, setHeader] = useState({
    party: '', add: '', broker: '', book: 'FINISH SALES', gstin: '', city: '',
    haste: '', billNo: 'AUTO', billDate: today(), challanNo: '', chDate: today(),
    orderNo: '', orderDate: today(), type: 'INVOICE IN STATE', gstType: 'CGST+SGST'
  });

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', desc: '', lotId: '', fold: 0, cut: 0, pcs: 0, mts: 0, saleRate: 0, amount: 0, dis1Per: 0, dis1Amt: 0 }
  ]);

  const [footer, setFooter] = useState({
    transport: '', station: '', lrNo: '', lrDate: today(),
    baleNo: '', freight: 0, weight: 0, eway: '', remarks: '',
    foldLess: 0, rdAmt: 0, discountAmt: 0, lessAmt: 0, addAmt: 0, tcs: 0, roundOff: 0
  });

  const [inlineModal, setInlineModal] = useState({
    type: null, target: 'party', initialData: null, rowIndex: null
  });

  const calculations = useMemo(() => {
    let gross = 0;
    gridItems.forEach(item => {
      let itemAmt = (parseFloat(item.mts || 0) * parseFloat(item.saleRate || 0)) - parseFloat(item.dis1Amt || 0);
      gross += itemAmt;
    });
    
    let taxable = gross 
      - parseFloat(footer.foldLess || 0) 
      - parseFloat(footer.rdAmt || 0) 
      - parseFloat(footer.discountAmt || 0) 
      - parseFloat(footer.lessAmt || 0) 
      + parseFloat(footer.addAmt || 0);

    const gstAmt = header.type === 'INVOICE OUT OF STATE' ? (taxable * 0.05) : (taxable * 0.05); // IGST vs CGST/SGST handled in save
    
    let net = taxable + gstAmt + parseFloat(footer.tcs || 0) + parseFloat(footer.roundOff || 0);
    return { gross, taxable, gstAmt, net };
  }, [gridItems, footer, header.type]);

  const handleCreateAccount = (search) => setInlineModal({ type: 'account', target: 'party', initialData: { name: search } });
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

  const handleItemSuccess = async (newItem) => {
    fetchItems();
    const itemId = newItem._id || newItem.id;
    const updatedGrid = [...gridItems];
    updatedGrid[inlineModal.rowIndex] = { 
      ...updatedGrid[inlineModal.rowIndex], itemId: itemId, itemName: newItem.itemName, unit: newItem.unit, saleRate: newItem.salesRate
    };
    setGridItems(updatedGrid);

    if (itemId) {
      try {
        const res = await api.get(`/inventory/lots?itemId=${itemId}`);
        setRowLots(prev => ({ ...prev, [itemId]: res.data.data || res.data }));
      } catch (err) { console.error(err); }
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!header.party) return alert('Please select a customer');
    
    setSaving(true);
    try {
      await addSale({
        customerId: header.party,
        invoiceNo: header.billNo,
        date: header.billDate,
        bookId: header.book,
        orderNo: header.orderNo,
        orderDate: header.orderDate,
        challanNo: header.challanNo,
        chDate: header.chDate,
        brokerId: header.broker,
        haste: header.haste,
        type: header.type,
        transport: footer.transport,
        station: footer.station,
        lrNo: footer.lrNo,
        lrDate: footer.lrDate,
        baleNo: footer.baleNo,
        freight: footer.freight,
        weight: footer.weight,
        eway: footer.eway,
        remarks: footer.remarks,
        foldLess: footer.foldLess,
        rdAmt: footer.rdAmt,
        discountAmt: footer.discountAmt,
        lessAmt: footer.lessAmt,
        addAmt: footer.addAmt,
        tcs: footer.tcs,
        roundOff: footer.roundOff,
        items: gridItems.filter(i => i.itemId).map(i => ({
          lotId: i.lotId || null,
          itemId: i.itemId,
          desc: i.desc,
          fold: Number(i.fold || 0),
          cut: Number(i.cut || 0),
          pcs: Number(i.pcs || 0),
          mts: Number(i.mts || 0),
          rate: Number(i.saleRate || 0),
          amount: Number(i.amount || 0),
          dis1Per: Number(i.dis1Per || 0),
          dis1Amt: Number(i.dis1Amt || 0)
        })),
        taxableAmount: calculations.taxable,
        gstAmount: calculations.gstAmt,
        netAmount: calculations.net,
        gstType: header.type === 'INVOICE OUT OF STATE' ? 'IGST' : 'CGST+SGST',
        cgst: header.type === 'INVOICE OUT OF STATE' ? 0 : calculations.gstAmt / 2,
        sgst: header.type === 'INVOICE OUT OF STATE' ? 0 : calculations.gstAmt / 2,
        igst: header.type === 'INVOICE OUT OF STATE' ? calculations.gstAmt : 0,
      });
      alert('Sales Invoice saved successfully!');
      onClose();
    } catch (err) {
      alert('Failed to save sales: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sales invoice" className="max-w-6xl">
      <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1 bg-[var(--bg-base)]">
        <div className="flex-1 overflow-y-auto no-scrollbar p-3">
          
          {/* Top Header Section */}
          <div className="erp-card p-3 mb-3 border-l-4 border-l-[var(--accent)]">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8 erp-field">
                  <label className="erp-label">Party / Customer</label>
                  <ERPSearchableSelect 
                    className="w-full" value={header.party}
                    onChange={(val) => {
                      const p = parties.find(x => x._id === val || x.id === val);
                      setHeader({...header, party: val, add: p?.address || '', gstin: p?.gstin || '', city: p?.station || p?.city || ''});
                    }}
                    onCreateNew={handleCreateAccount}
                    options={parties.filter(p => p.type !== 'Broker').map(p => ({value: p._id || p.id, label: p.name}))} 
                    label="Party" createLabel="Party"
                  />
                  {header.gstin && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">GSTIN: <span className="font-semibold text-[var(--text-primary)]">{header.gstin}</span></p>}
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Bill Date</label>
                  <input type="date" className="erp-input w-full font-mono text-[12px]" value={header.billDate} onChange={e => setHeader({...header, billDate: e.target.value})} />
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Bill No</label>
                  <ERPInput className="w-full bg-[var(--bg-base)] font-bold text-[var(--accent)]" value={header.billNo} readOnly />
              </div>

              <div className="col-span-2 erp-field">
                  <label className="erp-label">Order No.</label>
                  <ERPInput className="w-full text-[12px]" value={header.orderNo} onChange={e => setHeader({...header, orderNo: e.target.value})} />
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Ord.Date</label>
                  <input type="date" className="erp-input w-full font-mono text-[12px]" value={header.orderDate} onChange={e => setHeader({...header, orderDate: e.target.value})} />
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Ch.No.</label>
                  <ERPInput className="w-full text-[12px]" value={header.challanNo} onChange={e => setHeader({...header, challanNo: e.target.value})} />
              </div>
              <div className="col-span-2 erp-field">
                  <label className="erp-label">Ch.Date</label>
                  <input type="date" className="erp-input w-full font-mono text-[12px]" value={header.chDate} onChange={e => setHeader({...header, chDate: e.target.value})} />
              </div>
              <div className="col-span-4 erp-field flex gap-2">
                  <div className="flex-1">
                     <label className="erp-label">Broker</label>
                     <ERPSearchableSelect className="w-full" value={header.broker} onChange={(val) => setHeader({...header, broker: val})} onCreateNew={handleCreateBroker} options={parties.filter(p => p.type === 'Broker' || p.group === 'BROKER').map(p => ({value: p._id || p.id, label: p.name}))} label="Broker" createLabel="Broker" />
                  </div>
                  <div className="w-24">
                     <label className="erp-label">Haste</label>
                     <ERPInput className="w-full text-[12px]" value={header.haste} onChange={e => setHeader({...header, haste: e.target.value})} />
                  </div>
              </div>

              <div className="col-span-4 erp-field">
                  <label className="erp-label">Type</label>
                  <ERPSelect className="w-full font-semibold" value={header.type} onChange={e => setHeader({...header, type: e.target.value})} options={[{value: 'INVOICE IN STATE', label: 'INVOICE IN STATE'}, {value: 'INVOICE OUT OF STATE', label: 'INVOICE OUT OF STATE'}]} />
              </div>
              <div className="col-span-4 erp-field">
                  <label className="erp-label">Book</label>
                  <ERPSelect className="w-full" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: 'FINISH SALES', label: 'FINISH SALES'}]} />
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
                        <th className="p-2 border-r border-[var(--border-subtle)] w-28">Lot</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-24">Desc</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Fold</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Cut</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Pcs</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-16 text-center">Mts</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-16 text-right">Rate</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-20 text-right">Amount</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-14 text-center">Dis%</th>
                        <th className="p-2 border-r border-[var(--border-subtle)] w-16 text-right">DisAmt</th>
                        <th className="p-2 w-8 text-center"></th>
                     </tr>
                  </thead>
                  <tbody>
                     {gridItems.map((row, idx) => (
                        <tr key={row.id || idx} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-base)] transition-colors group">
                           <td className="p-1 border-r border-[var(--border-subtle)] text-center text-[10px] font-medium text-[var(--text-muted)]">{idx + 1}</td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <ERPSearchableSelect 
                                className="w-full border-transparent hover:border-[var(--border)] focus-within:border-[var(--accent)]" 
                                value={row.itemId}
                                onChange={(val) => {
                                  const item = items.find(i => i._id === val || i.id === val);
                                  const updated = [...gridItems];
                                  updated[idx] = { ...updated[idx], itemId: val, itemName: item?.itemName || '', saleRate: item?.salesRate || 0 };
                                  setGridItems(updated);
                                  if (val) {
                                    api.get(`/inventory/lots?itemId=${val}`).then(res => setRowLots(prev => ({ ...prev, [val]: res.data.data || res.data }))).catch(console.error);
                                  }
                                }}
                                onCreateNew={(search) => handleCreateItem(search, idx)}
                                options={items.map(i => ({value: i._id || i.id, label: i.itemName || i.name}))} 
                                label="Item" createLabel="Item"
                              />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <select className="w-full bg-transparent border border-transparent rounded px-1 h-7 text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.lotId || ''} onChange={(e) => {
                                 const updated = [...gridItems]; updated[idx].lotId = e.target.value; setGridItems(updated);
                              }}>
                                 <option value="">-Lot-</option>
                                 {(rowLots[row.itemId] || []).map(lot => <option key={lot._id} value={lot._id}>{lot.lotId} ({lot.remainingMtrs}m)</option>)}
                              </select>
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="text" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.desc || ''} onChange={e => { const updated = [...gridItems]; updated[idx].desc = e.target.value; setGridItems(updated); }} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.fold || ''} onChange={e => {
                                 const updated = [...gridItems]; updated[idx].fold = Number(e.target.value);
                                 updated[idx].mts = (updated[idx].cut || updated[idx].fold || 1) * updated[idx].pcs;
                                 updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                                 updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                                 setGridItems(updated);
                              }} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.cut || ''} onChange={e => {
                                 const updated = [...gridItems]; updated[idx].cut = Number(e.target.value);
                                 updated[idx].mts = (updated[idx].cut || updated[idx].fold || 1) * updated[idx].pcs;
                                 updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                                 updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                                 setGridItems(updated);
                              }} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] font-semibold focus:border-[var(--accent)] focus:outline-none" value={row.pcs || ''} onChange={e => {
                                 const updated = [...gridItems]; updated[idx].pcs = Number(e.target.value);
                                 updated[idx].mts = (updated[idx].cut || updated[idx].fold || 1) * updated[idx].pcs;
                                 updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                                 updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                                 setGridItems(updated);
                              }} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] font-semibold text-[var(--accent)] focus:border-[var(--accent)] focus:outline-none" value={row.mts || ''} onChange={e => {
                                 const updated = [...gridItems]; updated[idx].mts = Number(e.target.value);
                                 updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                                 updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                                 setGridItems(updated);
                              }} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-right text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.saleRate || ''} onChange={e => {
                                 const updated = [...gridItems]; updated[idx].saleRate = Number(e.target.value);
                                 updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                                 updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                                 setGridItems(updated);
                              }} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)] text-right px-2 text-[11px] font-mono">
                              {parseFloat(row.amount || 0).toFixed(2)}
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-center text-[11px] focus:border-[var(--accent)] focus:outline-none" value={row.dis1Per || ''} onChange={e => {
                                 const updated = [...gridItems]; updated[idx].dis1Per = Number(e.target.value);
                                 updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                                 setGridItems(updated);
                              }} />
                           </td>
                           <td className="p-1 border-r border-[var(--border-subtle)]">
                              <input type="number" className="w-full bg-transparent border-transparent rounded px-1 h-7 text-right text-[11px] focus:border-[var(--accent)] focus:outline-none text-[var(--red)]" value={row.dis1Amt || ''} onChange={e => {
                                 const updated = [...gridItems]; updated[idx].dis1Amt = Number(e.target.value);
                                 setGridItems(updated);
                              }} />
                           </td>
                           <td className="p-1 text-center">
                              <button type="button" onClick={() => {
                                    const updated = gridItems.filter((_, i) => i !== idx);
                                    setGridItems(updated.length ? updated : [{ id: Date.now(), itemId: '', itemName: '', desc: '', lotId: '', fold: 0, cut: 0, pcs: 0, mts: 0, saleRate: 0, amount: 0, dis1Per: 0, dis1Amt: 0 }]);
                                 }} className="text-[var(--text-muted)] hover:text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                 <Trash2 size={13} />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
            <div className="p-1.5 bg-[var(--bg-base)] border-t border-[var(--border-strong)] flex justify-between items-center">
               <button type="button" onClick={() => setGridItems([...gridItems, { id: Date.now(), itemId: '', itemName: '', desc: '', lotId: '', fold: 0, cut: 0, pcs: 0, mts: 0, saleRate: 0, amount: 0, dis1Per: 0, dis1Amt: 0 }])} className="text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
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
                   <label className="text-[10px] font-bold text-[var(--text-secondary)]">FOLD LESS</label>
                   <input type="number" className="erp-input h-7 w-24 text-right text-[11px]" value={footer.foldLess || ''} onChange={e => setFooter({...footer, foldLess: Number(e.target.value)})} />
                </div>
                <div className="flex items-center justify-between erp-field mb-0">
                   <label className="text-[10px] font-bold text-[var(--text-secondary)]">RD AMT</label>
                   <input type="number" className="erp-input h-7 w-24 text-right text-[11px]" value={footer.rdAmt || ''} onChange={e => setFooter({...footer, rdAmt: Number(e.target.value)})} />
                </div>
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
             </div>

             {/* Bottom Center: Transport & Dispatch */}
             <div className="col-span-5 erp-card p-3 border border-[var(--border-strong)]">
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 border-b border-[var(--border-subtle)] pb-1">Dispatch Details</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                   <div className="erp-field mb-0">
                      <label className="text-[10px]">Transport</label>
                      <input type="text" className="erp-input h-7 text-[11px] w-full" value={footer.transport} onChange={e => setFooter({...footer, transport: e.target.value})} />
                   </div>
                   <div className="erp-field mb-0">
                      <label className="text-[10px]">City</label>
                      <input type="text" className="erp-input h-7 text-[11px] w-full" value={footer.station} onChange={e => setFooter({...footer, station: e.target.value})} />
                   </div>
                   <div className="erp-field mb-0">
                      <label className="text-[10px]">LR No</label>
                      <input type="text" className="erp-input h-7 text-[11px] w-full" value={footer.lrNo} onChange={e => setFooter({...footer, lrNo: e.target.value})} />
                   </div>
                   <div className="erp-field mb-0">
                      <label className="text-[10px]">LR Date</label>
                      <input type="date" className="erp-input h-7 text-[11px] w-full" value={footer.lrDate} onChange={e => setFooter({...footer, lrDate: e.target.value})} />
                   </div>
                   <div className="erp-field mb-0 flex gap-2">
                      <div className="flex-1">
                         <label className="text-[10px]">BaleNo / Vehicle</label>
                         <input type="text" className="erp-input h-7 text-[11px] w-full" value={footer.baleNo} onChange={e => setFooter({...footer, baleNo: e.target.value})} />
                      </div>
                      <div className="w-16">
                         <label className="text-[10px]">Weight</label>
                         <input type="number" className="erp-input h-7 text-[11px] w-full" value={footer.weight || ''} onChange={e => setFooter({...footer, weight: Number(e.target.value)})} />
                      </div>
                   </div>
                   <div className="erp-field mb-0 flex gap-2">
                      <div className="w-16">
                         <label className="text-[10px]">Freight</label>
                         <input type="number" className="erp-input h-7 text-[11px] w-full" value={footer.freight || ''} onChange={e => setFooter({...footer, freight: Number(e.target.value)})} />
                      </div>
                      <div className="flex-1">
                         <label className="text-[10px]">E-WAY Details</label>
                         <input type="text" className="erp-input h-7 text-[11px] w-full" value={footer.eway} onChange={e => setFooter({...footer, eway: e.target.value})} />
                      </div>
                   </div>
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
                         <span>IGST (5%)</span>
                         <span className="font-semibold text-[var(--text-primary)] font-mono">₹{calculations.gstAmt.toFixed(2)}</span>
                      </div>
                   ) : (
                      <>
                         <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                            <span>CGST (2.5%)</span>
                            <span className="font-semibold text-[var(--text-primary)] font-mono">₹{(calculations.gstAmt / 2).toFixed(2)}</span>
                         </div>
                         <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                            <span>SGST (2.5%)</span>
                            <span className="font-semibold text-[var(--text-primary)] font-mono">₹{(calculations.gstAmt / 2).toFixed(2)}</span>
                         </div>
                      </>
                   )}
                   <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                      <span>ROUND OFF</span>
                      <input type="number" className="erp-input h-6 w-20 text-right text-[11px] font-mono border-transparent bg-[var(--bg-base)] focus:border-[var(--accent)]" value={footer.roundOff || ''} onChange={e => setFooter({...footer, roundOff: Number(e.target.value)})} />
                   </div>
                   <div className="flex justify-between items-center text-[var(--text-secondary)] font-medium">
                      <span>TCS</span>
                      <input type="number" className="erp-input h-6 w-20 text-right text-[11px] font-mono border-transparent bg-[var(--bg-base)] focus:border-[var(--accent)]" value={footer.tcs || ''} onChange={e => setFooter({...footer, tcs: Number(e.target.value)})} />
                   </div>
                   
                   <div className="flex justify-between items-center pt-3 border-t border-[var(--border-strong)] mt-2">
                      <span className="font-extrabold text-[15px] text-[var(--text-primary)] uppercase tracking-wide">NET AMOUNT</span>
                      <span className="font-extrabold text-[18px] text-[var(--accent)] font-mono">₹{calculations.net.toFixed(2)}</span>
                   </div>
                </div>
             </div>
          </div>
          
        </div>
        <div className="erp-modal-footer bg-white border-t border-[var(--border)] p-4 shrink-0 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           <button type="button" className="erp-btn erp-btn-secondary px-6" onClick={onClose}>Cancel</button>
           {!readOnly && (
           <button type="submit" disabled={saving} className="erp-btn erp-btn-primary px-8">
              {saving ? 'Saving...' : 'Save Invoice'}
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

export default SalesModal;
