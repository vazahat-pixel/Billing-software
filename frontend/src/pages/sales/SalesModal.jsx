import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { useConfig } from '../../context/ConfigContext';
import { resolveSalesFieldVisibility } from '../../utils/configHelpers';
import api from '../../utils/api';
import { Trash2, Plus } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';

const today = () => new Date().toISOString().split('T')[0];

const SalesModal = ({ isOpen, onClose, initialData = null, selectedBook = null, readOnly = false }) => {
  const { parties, items, addSale, updateSale, deleteSale, sales, fetchParties, fetchItems, fetchSales, plan, user } = useStore();
  const { bundle } = useConfig();
  const { showBroker, showChallan } = resolveSalesFieldVisibility(bundle, user, plan);
  const [rowLots, setRowLots] = useState({});
  const [mode, setMode] = useState('View');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  const [header, setHeader] = useState({
    party: '',
    add: '',
    broker: '',
    book: 'SALES BOOK',
    gstin: '',
    city: '',
    haste: '',
    billNo: 'AUTO',
    billDate: today(),
    challanNo: '',
    chDate: today(),
    orderNo: '',
    orderDate: today(),
    type: 'INVOICE IN STATE',
    gstType: 'CGST+SGST'
  });

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', desc: '', lotId: '', fold: 0, cut: 0, pcs: 0, mts: 0, saleRate: 0, amount: 0, dis1Per: 0, dis1Amt: 0 }
  ]);

  const [footer, setFooter] = useState({
    transport: '',
    station: '',
    lrNo: '',
    lrDate: today(),
    baleNo: '',
    freight: 0,
    weight: 0,
    eway: '',
    remarks: '',
    foldLess: 0,
    foldLessSign: '-',
    rdAmt: 0,
    rdAmtSign: '-',
    discountAmt: 0,
    discountSign: '-',
    lessAmt: 0,
    lessSign: '-',
    addAmt: 0,
    addSign: '+',
    dueDays: 0,
    dueDate: today(),
    tcsRate: 0.0,
    roundOff: 0
  });

  // Rates for GST
  const [gstRates, setGstRates] = useState({
    cgstRate: 2.5,
    sgstRate: 2.5,
    igstRate: 5.0
  });

  useEffect(() => {
    if (!isOpen) return;
    fetchParties();
    fetchItems();
    fetchSales();
    if (initialData) {
      loadInvoiceData(initialData);
      setSelectedInvoiceId(initialData._id || initialData.id || '');
      setMode(readOnly ? 'View' : 'Edit');
    } else if (readOnly) {
      setMode('View');
    } else {
      setSelectedInvoiceId('');
      handleNew();
    }
  }, [isOpen, initialData, readOnly, selectedBook, fetchParties, fetchItems, fetchSales]);

  const loadInvoiceData = (inv) => {
    setHeader({
      party: inv.customerId?._id || inv.customerId || '',
      add: inv.remarks || '',
      broker: inv.brokerId || '',
      book: inv.bookId || 'SALES BOOK',
      gstin: inv.customerId?.gstin || '',
      city: inv.station || '',
      haste: inv.haste || '',
      billNo: inv.invoiceNo || '',
      billDate: inv.date ? inv.date.split('T')[0] : today(),
      challanNo: inv.challanNo || '',
      chDate: inv.chDate ? inv.chDate.split('T')[0] : today(),
      orderNo: inv.orderNo || '',
      orderDate: inv.orderDate ? inv.orderDate.split('T')[0] : today(),
      type: inv.gstType === 'IGST' ? 'INVOICE OUT OF STATE' : 'INVOICE IN STATE',
      gstType: inv.gstType || 'CGST+SGST'
    });

    setGridItems(inv.items.map((item, idx) => ({
      id: idx + 1,
      itemId: item.itemId?._id || item.itemId || '',
      itemName: item.itemName || item.itemId?.itemName || item.itemId?.name || '',
      desc: item.desc || '',
      lotId: item.lotId || '',
      fold: item.fold || 0,
      cut: item.cut || 0,
      pcs: item.pcs || 0,
      mts: item.mts || 0,
      saleRate: item.rate || 0,
      amount: item.amount || 0,
      dis1Per: item.dis1Per || 0,
      dis1Amt: item.dis1Amt || 0
    })));

    setFooter({
      transport: inv.transport || '',
      station: inv.station || '',
      lrNo: inv.lrNo || '',
      lrDate: inv.lrDate ? inv.lrDate.split('T')[0] : today(),
      baleNo: inv.baleNo || '',
      freight: inv.freight || 0,
      weight: inv.weight || 0,
      eway: inv.eway || '',
      remarks: inv.remarks || '',
      foldLess: inv.foldLess || 0,
      foldLessSign: inv.foldLessSign || '-',
      rdAmt: inv.rdAmt || 0,
      rdAmtSign: inv.rdAmtSign || '-',
      discountAmt: inv.discountAmt || 0,
      discountSign: inv.discountSign || '-',
      lessAmt: inv.lessAmt || 0,
      lessSign: inv.lessSign || '-',
      addAmt: inv.addAmt || 0,
      addSign: inv.addSign || '+',
      dueDays: inv.dueDays || 0,
      dueDate: inv.dueDate ? inv.dueDate.split('T')[0] : today(),
      tcsRate: inv.tcsPer || 0.0,
      roundOff: inv.roundOff || 0
    });

    setGstRates({
      cgstRate: inv.cgst && inv.taxableAmount ? Number(((inv.cgst / inv.taxableAmount) * 100).toFixed(1)) : 2.5,
      sgstRate: inv.sgst && inv.taxableAmount ? Number(((inv.sgst / inv.taxableAmount) * 100).toFixed(1)) : 2.5,
      igstRate: inv.igst && inv.taxableAmount ? Number(((inv.igst / inv.taxableAmount) * 100).toFixed(1)) : 5.0
    });
  };

  const handleSelectInvoice = (e) => {
    const id = e.target.value;
    setSelectedInvoiceId(id);
    if (id) {
      const inv = sales.find(s => s._id === id || s.id === id);
      if (inv) {
        loadInvoiceData(inv);
        setMode('View');
      }
    }
  };

  const [inlineModal, setInlineModal] = useState({
    type: null, target: 'party', initialData: null, rowIndex: null
  });

  // Due date auto calculation
  useEffect(() => {
    if (header.billDate) {
      const date = new Date(header.billDate);
      const days = parseInt(footer.dueDays || 0);
      if (!isNaN(days)) {
        date.setDate(date.getDate() + days);
        setFooter(prev => ({ ...prev, dueDate: date.toISOString().split('T')[0] }));
      }
    }
  }, [header.billDate, footer.dueDays]);

  const calculations = useMemo(() => {
    let gross = 0;
    gridItems.forEach(item => {
      let itemAmt = (parseFloat(item.mts || 0) * parseFloat(item.saleRate || 0)) - parseFloat(item.dis1Amt || 0);
      gross += itemAmt;
    });

    let totalAdd = 0;
    let totalLess = 0;

    const adjust = (val, sign) => {
      const parsed = parseFloat(val || 0);
      if (sign === '+') {
        totalAdd += parsed;
        return parsed;
      } else {
        totalLess += parsed;
        return -parsed;
      }
    };

    let taxable = gross;
    taxable += adjust(footer.foldLess, footer.foldLessSign);
    taxable += adjust(footer.rdAmt, footer.rdAmtSign);
    taxable += adjust(footer.discountAmt, footer.discountSign);
    taxable += adjust(footer.lessAmt, footer.lessSign);
    taxable += adjust(footer.addAmt, footer.addSign);

    const isInState = header.type === 'INVOICE IN STATE';
    const cgst = isInState ? taxable * (gstRates.cgstRate / 100) : 0;
    const sgst = isInState ? taxable * (gstRates.sgstRate / 100) : 0;
    const igst = !isInState ? taxable * (gstRates.igstRate / 100) : 0;
    const gstAmt = cgst + sgst + igst;

    const tcsAmt = taxable * (footer.tcsRate / 100);
    const roundOff = footer.roundOff || 0;

    const subTotal = taxable + gstAmt + tcsAmt;
    const net = subTotal + parseFloat(roundOff);

    return { gross, taxable, cgst, sgst, igst, gstAmt, tcsAmt, totalAdd, totalLess, net };
  }, [gridItems, footer, header.type, gstRates]);

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
      ...updatedGrid[inlineModal.rowIndex], itemId: itemId, itemName: newItem.itemName, saleRate: newItem.salesRate
    };
    setGridItems(updatedGrid);
  };

  const handleNew = () => {
    setHeader({
      party: '',
      add: '',
      broker: '',
      book: selectedBook || 'SALES BOOK',
      gstin: '',
      city: '',
      haste: '',
      billNo: 'AUTO',
      billDate: today(),
      challanNo: '',
      chDate: today(),
      orderNo: '',
      orderDate: today(),
      type: 'INVOICE IN STATE',
      gstType: 'CGST+SGST'
    });
    setGridItems([
      { id: 1, itemId: '', itemName: '', desc: '', lotId: '', fold: 0, cut: 0, pcs: 0, mts: 0, saleRate: 0, amount: 0, dis1Per: 0, dis1Amt: 0 }
    ]);
    setFooter({
      transport: '',
      station: '',
      lrNo: '',
      lrDate: today(),
      baleNo: '',
      freight: 0,
      weight: 0,
      eway: '',
      remarks: '',
      foldLess: 0,
      foldLessSign: '-',
      rdAmt: 0,
      rdAmtSign: '-',
      discountAmt: 0,
      discountSign: '-',
      lessAmt: 0,
      lessSign: '-',
      addAmt: 0,
      addSign: '+',
      dueDays: 0,
      dueDate: today(),
      tcsRate: 0.0,
      roundOff: 0
    });
    setMode('Add');
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!header.party) return alert('Please select a customer');

    try {
      const payload = {
        customerId: header.party,
        invoiceNo: header.billNo,
        date: header.billDate,
        bookId: header.book,
        orderNo: header.orderNo,
        orderDate: header.orderDate,
        challanNo: header.challanNo,
        chDate: header.chDate,
        brokerId: header.broker || null,
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
        foldLessSign: footer.foldLessSign,
        rdAmt: footer.rdAmt,
        rdAmtSign: footer.rdAmtSign,
        discountAmt: footer.discountAmt,
        discountSign: footer.discountSign,
        lessAmt: footer.lessAmt,
        lessSign: footer.lessSign,
        addAmt: footer.addAmt,
        addSign: footer.addSign,
        dueDays: footer.dueDays,
        dueDate: footer.dueDate,
        tcs: calculations.tcsAmt,
        tcsPer: footer.tcsRate,
        roundOff: footer.roundOff,
        totalAdd: calculations.totalAdd,
        totalLess: calculations.totalLess,
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
        cgst: calculations.cgst,
        sgst: calculations.sgst,
        igst: calculations.igst
      };

      const saved =
        mode === 'Edit' && selectedInvoiceId
          ? await updateSale(selectedInvoiceId, payload)
          : await addSale(payload);
      alert(saved?.offlinePending
        ? (mode === 'Edit' && !String(selectedInvoiceId).startsWith('local-')
          ? 'Invoice updated offline on this device. Sync when online for server bills.'
          : 'Invoice saved offline. It will sync when you are back online.')
        : 'Sales Invoice saved successfully!');
      setMode('View');
      fetchSales();
    } catch (err) {
      alert('Failed to save sales: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async () => {
    const id = initialData?._id || selectedInvoiceId;
    if (!id) return alert('Select an invoice to delete');
    if (window.confirm('Are you sure you want to delete/cancel this invoice?')) {
      try {
        await deleteSale(id);
        alert('Invoice deleted/cancelled!');
        handleNew();
        fetchSales();
      } catch (err) {
        alert('Failed to delete: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCancel = () => {
    const id = selectedInvoiceId || initialData?._id || initialData?.id;
    if (id) {
      const inv = sales.find(s => s._id === id || s.id === id) || initialData;
      if (inv) loadInvoiceData(inv);
    }
    setMode('View');
  };

  const locked = readOnly || mode === 'View';

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-7xl">
      <div className="classic-erp-window flex flex-col h-full">
        {/* Title Bar */}
        <div className="classic-erp-header">
          <span>Sales Invoice [ SALES BOOK ]</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        {/* Form Body */}
        <div className="classic-erp-body flex-1 overflow-y-auto space-y-3">
          
          {mode === 'View' && (
            <div className="classic-erp-frame flex gap-3 items-center">
              <span className="classic-erp-label blue-label font-bold">Find Invoice:</span>
              <select className="classic-erp-input flex-1" value={selectedInvoiceId} onChange={handleSelectInvoice}>
                <option value="">- Select Invoice to View/Edit -</option>
                {sales.map(s => (
                  <option key={s._id || s.id} value={s._id || s.id}>Invoice #{s.invoiceNo} - {s.customerId?.name} (₹{s.netAmount?.toFixed(2)})</option>
                ))}
              </select>
            </div>
          )}

          {/* Header Block */}
          <div className="classic-erp-frame grid grid-cols-12 gap-3">
            <div className="col-span-8 flex flex-col gap-2">
              <div className="flex gap-2">
                <span className="classic-erp-label red-label w-16">Party:</span>
                <div className="flex-1 flex gap-1 items-center">
                  <select 
                    className="classic-erp-select flex-1" 
                    value={header.party} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'NEW_PARTY') {
                        handleCreateAccount('');
                        return;
                      }
                      const p = parties.find(x => x._id === val || x.id === val);
                      setHeader({ ...header, party: val, add: p?.address || '', gstin: p?.gstin || '', city: p?.station || p?.city || '' });
                    }}
                    disabled={locked}
                  >
                    <option value="">- Select Party / Customer -</option>
                    {!locked && (
                      <option value="NEW_PARTY" className="text-blue-600 font-bold bg-blue-50">+ Add New Party / Customer...</option>
                    )}
                    {parties.filter(p => p.type !== 'Broker').map(p => (
                      <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
                    ))}
                  </select>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => handleCreateAccount('')}
                      className="classic-erp-btn p-0 w-8 flex items-center justify-center shrink-0"
                      style={{ height: '30px', minHeight: '30px' }}
                      title="Add New Party / Customer"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-2">
                  <span className="classic-erp-label w-16">Gstin:</span>
                  <input type="text" className="classic-erp-input flex-1" value={header.gstin} readOnly />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-12">City:</span>
                  <input type="text" className="classic-erp-input flex-1" value={header.city} readOnly />
                </div>
              </div>
            </div>

            <div className="col-span-4 space-y-1">
              <div className="flex gap-2 items-center justify-between">
                <span className="classic-erp-label red-label">Bill No:</span>
                <input type="text" className="classic-erp-input w-28" value={header.billNo} readOnly />
                <span className="classic-erp-label">Date:</span>
                <input type="date" className="classic-erp-input w-32" value={header.billDate} onChange={e => setHeader({ ...header, billDate: e.target.value })} disabled={locked} />
              </div>
              {showChallan ? (
                <div className="flex gap-2 items-center justify-between">
                  <span className="classic-erp-label">ChNo:</span>
                  <input type="text" className="classic-erp-input w-28" value={header.challanNo} onChange={e => setHeader({ ...header, challanNo: e.target.value })} disabled={locked} />
                  <span className="classic-erp-label">Date:</span>
                  <input type="date" className="classic-erp-input w-32" value={header.chDate} onChange={e => setHeader({ ...header, chDate: e.target.value })} disabled={locked} />
                </div>
              ) : (
                <div className="h-6" />
              )}
              <div className="flex gap-2 items-center justify-between">
                <span className="classic-erp-label">Orde No:</span>
                <input type="text" className="classic-erp-input w-28" value={header.orderNo} onChange={e => setHeader({ ...header, orderNo: e.target.value })} disabled={locked} />
                <span className="classic-erp-label">Date:</span>
                <input type="date" className="classic-erp-input w-32" value={header.orderDate} onChange={e => setHeader({ ...header, orderDate: e.target.value })} disabled={locked} />
              </div>
            </div>
          </div>

          {/* Broker/Haste Toolbar Frame */}
          <div className="classic-erp-frame grid grid-cols-3 gap-3">
            {showBroker ? (
              <div className="flex gap-2 items-center">
                <span className="classic-erp-label w-16">Broker:</span>
                <div className="flex-1 flex gap-1 items-center">
                  <select 
                    className="classic-erp-select flex-1" 
                    value={header.broker} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'NEW_BROKER') {
                        handleCreateBroker('');
                        return;
                      }
                      setHeader({ ...header, broker: val });
                    }} 
                    disabled={locked}
                  >
                    <option value="">- Select Broker -</option>
                    {!locked && (
                      <option value="NEW_BROKER" className="text-blue-600 font-bold bg-blue-50">+ Add New Broker...</option>
                    )}
                    {parties.filter(p => p.type === 'Broker').map(p => (
                      <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
                    ))}
                  </select>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => handleCreateBroker('')}
                      className="classic-erp-btn p-0 w-8 flex items-center justify-center shrink-0"
                      style={{ height: '30px', minHeight: '30px' }}
                      title="Add New Broker"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <span className="classic-erp-label w-16">Haste:</span>
              <input type="text" className="classic-erp-input flex-1" value={header.haste} onChange={e => setHeader({ ...header, haste: e.target.value })} disabled={locked} />
            </div>
            <div className="flex gap-2">
              <span className="classic-erp-label w-16">Type:</span>
              <select className="classic-erp-select flex-1" value={header.type} onChange={e => setHeader({ ...header, type: e.target.value })} disabled={locked}>
                <option value="INVOICE IN STATE">INVOICE IN STATE</option>
                <option value="INVOICE OUT OF STATE">INVOICE OUT OF STATE</option>
              </select>
            </div>
          </div>

          {/* Item Grid Table */}
          <div className="classic-erp-table-container max-h-64">
            <table className="classic-erp-table">
              <thead>
                <tr>
                  <th className="w-8 text-center">SrNo</th>
                  <th>Item Name</th>
                  <th className="w-24">Desc</th>
                  <th className="w-16 text-center">Fold</th>
                  <th className="w-16 text-center">Cut</th>
                  <th className="w-16 text-center">Pcs</th>
                  <th className="w-20 text-center">Mts</th>
                  <th className="w-20 text-right">Rate</th>
                  <th className="w-16 text-center">Per/Unit</th>
                  <th className="w-24 text-right">Amount</th>
                  <th className="w-16 text-center">DIS1%</th>
                  <th className="w-20 text-right">DISAM</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {gridItems.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td className="text-center font-bold">{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-1 w-full px-1">
                        <select
                          className="classic-erp-select flex-1 border-0"
                          style={{ height: '30px' }}
                          value={row.itemId}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === 'NEW_ITEM') {
                              handleCreateItem('', idx);
                              return;
                            }
                            const item = items.find(i => i._id === val || i.id === val);
                            const updated = [...gridItems];
                            updated[idx] = { ...updated[idx], itemId: val, itemName: item?.itemName || '', saleRate: item?.salesRate || 0 };
                            setGridItems(updated);
                          }}
                          disabled={locked}
                        >
                          <option value="">- Select Item -</option>
                          {!locked && (
                            <option value="NEW_ITEM" className="text-blue-600 font-bold bg-blue-50">+ Add New Item...</option>
                          )}
                          {items.map(i => (
                            <option key={i._id || i.id} value={i._id || i.id}>{i.itemName}</option>
                          ))}
                        </select>
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => handleCreateItem('', idx)}
                            className="text-blue-600 hover:text-blue-800 p-1 flex items-center justify-center shrink-0"
                            title="Add New Item"
                          >
                            <Plus size={14} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <input type="text" className="classic-erp-input w-full border-0" value={row.desc} onChange={e => {
                        const updated = [...gridItems]; updated[idx].desc = e.target.value; setGridItems(updated);
                      }} disabled={locked} />
                    </td>
                    <td>
                      <input type="number" className="classic-erp-input w-full text-center border-0" value={row.fold || ''} onChange={e => {
                        const updated = [...gridItems]; updated[idx].fold = Number(e.target.value);
                        updated[idx].mts = (updated[idx].cut || updated[idx].fold || 1) * updated[idx].pcs;
                        updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                        updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                        setGridItems(updated);
                      }} disabled={locked} />
                    </td>
                    <td>
                      <input type="number" className="classic-erp-input w-full text-center border-0" value={row.cut || ''} onChange={e => {
                        const updated = [...gridItems]; updated[idx].cut = Number(e.target.value);
                        updated[idx].mts = (updated[idx].cut || updated[idx].fold || 1) * updated[idx].pcs;
                        updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                        updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                        setGridItems(updated);
                      }} disabled={locked} />
                    </td>
                    <td>
                      <input type="number" className="classic-erp-input w-full text-center border-0" value={row.pcs || ''} onChange={e => {
                        const updated = [...gridItems]; updated[idx].pcs = Number(e.target.value);
                        updated[idx].mts = (updated[idx].cut || updated[idx].fold || 1) * updated[idx].pcs;
                        updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                        updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                        setGridItems(updated);
                      }} disabled={locked} />
                    </td>
                    <td>
                      <input type="number" className="classic-erp-input w-full text-center border-0" value={row.mts || ''} onChange={e => {
                        const updated = [...gridItems]; updated[idx].mts = Number(e.target.value);
                        updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                        updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                        setGridItems(updated);
                      }} disabled={locked} />
                    </td>
                    <td>
                      <input type="number" className="classic-erp-input w-full text-right border-0" value={row.saleRate || ''} onChange={e => {
                        const updated = [...gridItems]; updated[idx].saleRate = Number(e.target.value);
                        updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                        updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                        setGridItems(updated);
                      }} disabled={locked} />
                    </td>
                    <td className="text-center font-bold">Mts</td>
                    <td className="text-right pr-2 font-bold font-mono">{parseFloat(row.amount || 0).toFixed(2)}</td>
                    <td>
                      <input type="number" className="classic-erp-input w-full text-center border-0" value={row.dis1Per || ''} onChange={e => {
                        const updated = [...gridItems]; updated[idx].dis1Per = Number(e.target.value);
                        updated[idx].dis1Amt = (updated[idx].amount * updated[idx].dis1Per) / 100;
                        setGridItems(updated);
                      }} disabled={locked} />
                    </td>
                    <td className="text-right pr-2 text-red-700 font-bold font-mono">{parseFloat(row.dis1Amt || 0).toFixed(2)}</td>
                    <td className="text-center">
                      <button type="button" onClick={() => {
                        const updated = gridItems.filter((_, i) => i !== idx);
                        setGridItems(updated.length ? updated : [{ id: Date.now(), itemId: '', itemName: '', desc: '', lotId: '', fold: 0, cut: 0, pcs: 0, mts: 0, saleRate: 0, amount: 0, dis1Per: 0, dis1Amt: 0 }]);
                      }} className="text-red-700 hover:text-red-950 p-1" disabled={locked}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center bg-[var(--bg-subtle)] p-1.5 border border-[var(--border)] rounded-md">
            <button
              type="button"
              onClick={() => setGridItems([...gridItems, { id: Date.now(), itemId: '', itemName: '', desc: '', lotId: '', fold: 0, cut: 0, pcs: 0, mts: 0, saleRate: 0, amount: 0, dis1Per: 0, dis1Amt: 0 }])}
              className="classic-erp-btn"
              disabled={locked}
            >
              <Plus size={12} strokeWidth={3} /> Add Line Item
            </button>
            <div className="text-xs font-bold text-black font-mono">
              Total Pcs: <span className="mr-4 text-blue-800">{gridItems.reduce((a, b) => a + (Number(b.pcs) || 0), 0)}</span>
              Total Mts: <span className="text-blue-800">{gridItems.reduce((a, b) => a + (Number(b.mts) || 0), 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Footer Grid / Calculations */}
          <div className="grid grid-cols-12 gap-3">
            
            {/* Left Adjustments Column */}
            <div className="col-span-4 classic-erp-frame space-y-1.5 p-2">
              {[
                { label: 'FOLD LESS', key: 'foldLess', signKey: 'foldLessSign' },
                { label: 'RD AMT', key: 'rdAmt', signKey: 'rdAmtSign' },
                { label: 'DISCOUNT', key: 'discountAmt', signKey: 'discountSign' },
                { label: 'LESS', key: 'lessAmt', signKey: 'lessSign' },
                { label: 'ADD', key: 'addAmt', signKey: 'addSign' }
              ].map(adj => (
                <div key={adj.key} className="flex items-center justify-between gap-2">
                  <span className="classic-erp-label w-24">{adj.label}:</span>
                  <div className="flex gap-1 items-center flex-1">
                    <select
                      className="classic-erp-select w-10 text-center font-bold"
                      value={footer[adj.signKey]}
                      onChange={e => setFooter({ ...footer, [adj.signKey]: e.target.value })}
                      disabled={locked}
                    >
                      <option value="-">-</option>
                      <option value="+">+</option>
                    </select>
                    <input
                      type="number"
                      className="classic-erp-input flex-1 text-right"
                      value={footer[adj.key] || ''}
                      onChange={e => setFooter({ ...footer, [adj.key]: Number(e.target.value) })}
                      disabled={locked}
                    />
                  </div>
                </div>
              ))}
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]">
                <div className="flex gap-1 items-center">
                  <span className="classic-erp-label text-[10px]">DueDays:</span>
                  <input type="number" className="classic-erp-input w-16 text-center" value={footer.dueDays} onChange={e => setFooter({ ...footer, dueDays: Number(e.target.value) })} disabled={locked} />
                </div>
                <div className="flex gap-1 items-center">
                  <span className="classic-erp-label text-[10px]">DueDate:</span>
                  <input type="date" className="classic-erp-input flex-1" value={footer.dueDate} readOnly />
                </div>
              </div>
            </div>

            {/* Middle Transport Details Column */}
            <div className="col-span-4 classic-erp-frame space-y-1 p-2">
              <span className="classic-erp-frame-title">Transport Details</span>
              
              <div className="flex gap-2">
                <span className="classic-erp-label w-20">Transport:</span>
                <input type="text" className="classic-erp-input flex-1" value={footer.transport} onChange={e => setFooter({ ...footer, transport: e.target.value })} disabled={locked} />
              </div>
              <div className="flex gap-2">
                <span className="classic-erp-label w-20">City:</span>
                <input type="text" className="classic-erp-input flex-1" value={footer.station} onChange={e => setFooter({ ...footer, station: e.target.value })} disabled={locked} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-2">
                  <span className="classic-erp-label w-12">LrNo:</span>
                  <input type="text" className="classic-erp-input flex-1" value={footer.lrNo} onChange={e => setFooter({ ...footer, lrNo: e.target.value })} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-12">LrDt:</span>
                  <input type="date" className="classic-erp-input flex-1" value={footer.lrDate} onChange={e => setFooter({ ...footer, lrDate: e.target.value })} disabled={locked} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-2">
                  <span className="classic-erp-label w-12">Bale:</span>
                  <input type="text" className="classic-erp-input flex-1" value={footer.baleNo} onChange={e => setFooter({ ...footer, baleNo: e.target.value })} disabled={locked} />
                </div>
                <div className="flex gap-2">
                  <span className="classic-erp-label w-12">Weight:</span>
                  <input type="number" className="classic-erp-input flex-1" value={footer.weight || ''} onChange={e => setFooter({ ...footer, weight: Number(e.target.value) })} disabled={locked} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-2">
                  <span className="classic-erp-label w-12">Freight:</span>
                  <input type="number" className="classic-erp-input flex-1" value={footer.freight || ''} onChange={e => setFooter({ ...footer, freight: Number(e.target.value) })} disabled={locked} />
                </div>
                <button className="classic-erp-btn btn-red w-full" type="button" disabled>E-Way Bill</button>
              </div>
            </div>

            {/* Right Totals & GST Summary Column */}
            <div className="col-span-4 classic-erp-frame space-y-1 p-2 bg-[var(--accent-light)]">
              <div className="flex justify-between items-center font-bold">
                <span className="classic-erp-label text-slate-800">TaxableAmt:</span>
                <span className="font-mono text-black">₹{calculations.taxable.toFixed(2)}</span>
              </div>

              {header.type === 'INVOICE IN STATE' ? (
                <>
                  <div className="flex justify-between items-center font-bold">
                    <div className="flex items-center gap-1">
                      <span className="classic-erp-label text-slate-800">CGST</span>
                      <input type="number" className="classic-erp-input w-12 text-center" value={gstRates.cgstRate} onChange={e => setGstRates({ ...gstRates, cgstRate: Number(e.target.value) })} disabled={locked} />
                      <span className="text-[10px]">%</span>
                    </div>
                    <span className="font-mono text-black">₹{calculations.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <div className="flex items-center gap-1">
                      <span className="classic-erp-label text-slate-800">SGST</span>
                      <input type="number" className="classic-erp-input w-12 text-center" value={gstRates.sgstRate} onChange={e => setGstRates({ ...gstRates, sgstRate: Number(e.target.value) })} disabled={locked} />
                      <span className="text-[10px]">%</span>
                    </div>
                    <span className="font-mono text-black">₹{calculations.sgst.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center font-bold">
                  <div className="flex items-center gap-1">
                    <span className="classic-erp-label text-slate-800">IGST</span>
                    <input type="number" className="classic-erp-input w-12 text-center" value={gstRates.igstRate} onChange={e => setGstRates({ ...gstRates, igstRate: Number(e.target.value) })} disabled={locked} />
                    <span className="text-[10px]">%</span>
                  </div>
                  <span className="font-mono text-black">₹{calculations.igst.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center font-bold">
                <div className="flex items-center gap-1">
                  <span className="classic-erp-label text-slate-800">TCS</span>
                  <input type="number" className="classic-erp-input w-12 text-center" value={footer.tcsRate} onChange={e => setFooter({ ...footer, tcsRate: Number(e.target.value) })} disabled={locked} />
                  <span className="text-[10px]">%</span>
                </div>
                <span className="font-mono text-black">₹{calculations.tcsAmt.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center font-bold border-t border-[var(--border)] pt-1">
                <span className="classic-erp-label text-slate-800">Gross Amt:</span>
                <span className="font-mono text-black">₹{calculations.gross.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center font-bold">
                <span className="classic-erp-label text-slate-800">Total Add:</span>
                <span className="font-mono text-green-700">₹{calculations.totalAdd.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center font-bold">
                <span className="classic-erp-label text-slate-800">Total Less:</span>
                <span className="font-mono text-red-700">₹{calculations.totalLess.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center font-bold">
                <span className="classic-erp-label text-slate-800">Round Off:</span>
                <input
                  type="number"
                  className="classic-erp-input w-20 text-right font-mono"
                  value={footer.roundOff}
                  onChange={e => setFooter({ ...footer, roundOff: Number(e.target.value) })}
                  disabled={locked}
                />
              </div>

              <div className="flex justify-between items-center font-bold pt-2 border-t-2 border-[#000] mt-1">
                <span className="classic-erp-label text-blue-900 text-sm">NET AMOUNT:</span>
                <span className="font-mono text-blue-900 text-lg">₹{calculations.net.toFixed(2)}</span>
              </div>
            </div>

          </div>

        </div>

        {/* Form Footer Action Toolbar */}
        <div className="classic-erp-form-footer">
          <button className="classic-erp-btn" type="button" onClick={handleNew} disabled={readOnly || mode !== 'View'}>New</button>
          <button className="classic-erp-btn btn-blue" type="button" onClick={handleSave} disabled={locked}>Save</button>
          <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked}>Cancel</button>
          <button className="classic-erp-btn" type="button" onClick={() => setMode('View')} disabled={readOnly || mode === 'View'}>Find</button>
          <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || locked || !selectedInvoiceId}>Delete</button>
          <button className="classic-erp-btn btn-blue" type="button" onClick={handlePrint}>Print</button>
          <button className="classic-erp-btn" type="button" onClick={onClose}>Exit</button>
        </div>

      </div>

      {/* Inline Sub Modals */}
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
