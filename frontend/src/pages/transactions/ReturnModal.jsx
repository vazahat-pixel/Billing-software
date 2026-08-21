import React, { useState, useMemo, useEffect, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { ERPCombobox } from '../../components/erp';
import ErpWindowControls from '../../components/erp/ErpWindowControls';
import useErpWindow from '../../hooks/useErpWindow';
import { toast } from '../../store/useToastStore';
import { notifyError, notifySuccess } from '../../utils/notify';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import useConfigStore from '../../store/useConfigStore';
import { money } from '../../utils/salesBillCalc';
import { Trash2, Plus } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

const blankLine = () => ({
  id: Date.now(),
  itemId: '',
  itemName: '',
  desc: '',
  fold: 0,
  cut: 0,
  pcs: 0,
  mts: 0,
  rate: 0,
  unit: 'MTRS',
  amount: 0,
  dis1Per: 0,
  dis1Amt: 0,
  addAmt: 0,
  gstPer: 5,
  gstAmt: 0,
  lotId: '',
  lotLabel: ''
});

const ReturnModal = ({
  isOpen,
  onClose,
  initialType = 'Sales',
  readOnly = false
}) => {
  const {
    parties,
    items,
    returns,
    inventoryLots,
    addReturn,
    fetchParties,
    fetchItems,
    fetchReturns,
    fetchInventory,
    fetchOriginalBills
  } = useStore();

  const companySettings = useConfigStore((s) => s.companySettings);

  const [returnType, setReturnType] = useState(initialType);
  const [mode, setMode] = useState('Add');
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const locked = readOnly || mode === 'View';
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const modalContainerRef = useRef(null);

  // Original Bills for Party
  const [originalBills, setOriginalBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedOriginalBillId, setSelectedOriginalBillId] = useState('');

  // Header State
  const [header, setHeader] = useState({
    party: '',
    add: '',
    broker: '',
    book: initialType === 'Sales' ? 'SALES RETURN BOOK' : 'PURCHASE RETURN ACCOUNT',
    gstin: '',
    city: '',
    haste: '',
    billNo: 'AUTO',
    billDate: today(),
    entryDate: today(),
    refBillNo: '',
    type: 'INVOICE IN STATE',
    gstType: 'CGST+SGST'
  });

  const isSales = returnType === 'Sales';
  const windowTitle = `${returnType} Return [ ${header.book} ]`;

  const win = useErpWindow(isOpen, {
    id: `return-${returnType}`,
    title: windowTitle,
    onClose,
  });

  // Items Grid
  const [gridItems, setGridItems] = useState([blankLine()]);

  // Footer / Adjustments State
  const [footer, setFooter] = useState({
    transport: '',
    city: '',
    lrNo: '',
    lrDate: today(),
    freight: 0,
    weight: 0,
    remarks: '',
    discountAmt: 0,
    discountSign: '-',
    octroi: 0,
    octroiSign: '+',
    addAmt: 0,
    addSign: '+',
    tcsRate: 0,
    tcsAmt: 0,
    roundOff: 0
  });

  // GST rates state
  const [gstRates, setGstRates] = useState({
    cgstRate: 2.5,
    sgstRate: 2.5,
    igstRate: 5.0
  });

  // Line item calculation logic matching SalesModal
  const computeLine = (row, fieldChanged = '') => {
    let cut = Number(row.cut) || 0;
    let pcs = Number(row.pcs) || 0;
    let mts = Number(row.mts) || 0;

    if (fieldChanged === 'cut' || fieldChanged === 'pcs' || fieldChanged === 'itemId') {
      if (cut > 0 && pcs > 0) {
        mts = Number((cut * pcs).toFixed(3));
      }
    }

    const rate = Number(row.rate) || 0;
    const unit = String(row.unit || 'MTRS').toUpperCase();
    const qty = ['PCS', 'PC', 'NOS', 'NO'].includes(unit) ? pcs : mts;

    const grossAmt = qty > 0 && rate > 0 ? Number((qty * rate).toFixed(2)) : Number(row.amount || 0);

    const dis1Per = Number(row.dis1Per) || 0;
    const dis1Amt = dis1Per > 0
      ? Number(((grossAmt * dis1Per) / 100).toFixed(2))
      : Number(row.dis1Amt) || 0;

    const addAmt = Number(row.addAmt) || 0;
    const taxable = Number((grossAmt - dis1Amt + addAmt).toFixed(2));

    const gstPer = Number(row.gstPer) || 0;
    const gstAmt = gstPer > 0 ? Number(((taxable * gstPer) / 100).toFixed(2)) : 0;

    return {
      ...row,
      cut,
      pcs,
      mts,
      amount: grossAmt,
      dis1Per,
      dis1Amt,
      addAmt,
      gstPer,
      gstAmt
    };
  };

  const patchLine = (idx, patch, fieldChanged = '') => {
    setGridItems((prev) => {
      const updated = [...prev];
      const merged = { ...updated[idx], ...patch };
      updated[idx] = computeLine(merged, fieldChanged);
      return updated;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    setReturnType(initialType);
    setHeader(h => ({
      ...h,
      book: initialType === 'Sales' ? 'SALES RETURN BOOK' : 'PURCHASE RETURN ACCOUNT'
    }));

    setBootLoading(true);
    Promise.all([
      fetchParties(),
      fetchItems(),
      fetchReturns?.(),
      fetchInventory?.()
    ])
      .catch(() => {})
      .finally(() => setBootLoading(false));

    if (readOnly) {
      setMode('View');
    } else {
      handleNew(initialType);
    }
  }, [isOpen, initialType, readOnly]);

  // Fetch past bills when party changes
  useEffect(() => {
    if (header.party && returnType) {
      setLoadingBills(true);
      fetchOriginalBills(header.party, returnType)
        .then((bills) => setOriginalBills(bills || []))
        .catch(() => setOriginalBills([]))
        .finally(() => setLoadingBills(false));
    } else {
      setOriginalBills([]);
    }
  }, [header.party, returnType]);

  // Party Options filtered for Customer (Sales Return) vs Supplier (Purchase Return)
  const partyOptions = useMemo(() => {
    const wantType = isSales ? ['Customer', 'Both'] : ['Supplier', 'Both', 'Job Worker'];
    return (parties || [])
      .filter((p) => wantType.includes(p.type) || !p.type)
      .map((p) => ({
        value: String(p._id || p.id),
        label: p.name,
        meta: [p.gstin, p.station || p.city].filter(Boolean).join(' · ')
      }));
  }, [parties, isSales]);

  const brokerOptions = useMemo(() => {
    return (parties || [])
      .filter(p => p.type === 'Broker')
      .map(p => ({
        value: String(p._id || p.id),
        label: p.name,
        meta: p.mobile || p.phone || ''
      }));
  }, [parties]);

  const itemOptions = useMemo(() => {
    return (items || []).map(i => ({
      value: String(i._id || i.id),
      label: i.itemName || i.name,
      meta: i.hsnCode ? `HSN ${i.hsnCode}` : ''
    }));
  }, [items]);

  const onPartySelect = (val) => {
    if (!val) {
      setHeader(h => ({ ...h, party: '', add: '', gstin: '', city: '' }));
      return;
    }
    const p = parties.find(x => String(x._id || x.id) === String(val));
    const isInterState = p?.state && p.state.toLowerCase() !== 'gujarat' && !p.state.toLowerCase().includes('gu');
    setHeader(h => ({
      ...h,
      party: val,
      add: p?.address || '',
      gstin: p?.gstin || '',
      city: p?.station || p?.city || '',
      type: isInterState ? 'INVOICE OUT OF STATE' : 'INVOICE IN STATE',
      gstType: isInterState ? 'IGST' : 'CGST+SGST'
    }));
  };

  // Handle selecting an original bill to auto-populate items
  const handleSelectOriginalBill = (billId) => {
    setSelectedOriginalBillId(billId);
    if (!billId) return;

    const b = originalBills.find(x => String(x._id || x.id) === String(billId));
    if (!b) return;

    setHeader(prev => ({
      ...prev,
      refBillNo: b.invoiceNo || b.supplierInvoiceNo || '',
      broker: b.brokerId?._id || b.brokerId || prev.broker,
      city: b.station || b.city || prev.city,
      type: b.gstType === 'IGST' ? 'INVOICE OUT OF STATE' : 'INVOICE IN STATE',
      gstType: b.gstType || 'CGST+SGST'
    }));

    if (b.items && b.items.length > 0) {
      const populatedGrid = b.items.map((line, idx) => {
        const itemObj = typeof line.itemId === 'object' ? line.itemId : items.find(i => String(i._id || i.id) === String(line.itemId));
        const lotObj = typeof line.lotId === 'object' ? line.lotId : inventoryLots.find(l => String(l._id || l.id) === String(line.lotId));
        return computeLine({
          id: idx + 1,
          itemId: itemObj?._id || line.itemId,
          itemName: itemObj?.name || itemObj?.itemName || '',
          desc: line.desc || '',
          fold: line.fold || 0,
          cut: line.cut || 0,
          pcs: line.pcs || 0,
          mts: line.mts || line.qty || 0,
          rate: line.rate || (isSales ? itemObj?.salesRate : itemObj?.purchaseRate) || 0,
          unit: line.unit || itemObj?.unit || 'MTRS',
          amount: line.amount || 0,
          dis1Per: line.dis1Per || line.discount || 0,
          dis1Amt: line.dis1Amt || 0,
          addAmt: line.addAmt || 0,
          gstPer: line.gstPer || line.gstRate || itemObj?.gstRate || 5,
          gstAmt: line.gstAmt || 0,
          lotId: lotObj?._id || line.lotId || null,
          lotLabel: lotObj?.lotId || ''
        });
      });
      setGridItems(populatedGrid);
    }
  };

  const onGridItemSelect = (val, idx) => {
    if (!val) return;
    const item = items.find(i => String(i._id || i.id) === String(val));
    patchLine(idx, {
      itemId: val,
      itemName: item?.name || item?.itemName || '',
      rate: (isSales ? item?.salesRate : item?.purchaseRate) || 0,
      gstPer: Number(item?.gstRate || 5),
      unit: String(item?.unit || 'MTRS').toUpperCase()
    }, 'itemId');
  };

  const addGridRow = () => {
    setGridItems(prev => [...prev, blankLine()]);
  };

  const removeGridRow = (idx) => {
    if (gridItems.length <= 1) {
      setGridItems([blankLine()]);
      return;
    }
    setGridItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Aggregate Calculations matching Sales/Purchase Bill Calc
  const calculations = useMemo(() => {
    let totalPcs = 0;
    let totalMts = 0;
    let gross = 0;
    let linesTaxable = 0;
    let linesGst = 0;

    gridItems.forEach(line => {
      totalPcs += Number(line.pcs || 0);
      totalMts += Number(line.mts || 0);
      const amt = Number(line.amount || 0);
      gross += amt;
      const dis1 = Number(line.dis1Amt || 0);
      const add = Number(line.addAmt || 0);
      const lineTaxable = amt - dis1 + add;
      linesTaxable += lineTaxable;
      linesGst += Number(line.gstAmt || 0);
    });

    const isIgst = header.type === 'INVOICE OUT OF STATE' || header.gstType === 'IGST';
    const discountVal = Number(footer.discountAmt || 0);
    const octroiVal = Number(footer.octroi || 0);
    const addVal = Number(footer.addAmt || 0);

    const taxable = Math.max(0, linesTaxable - discountVal + octroiVal + addVal);
    const gstAmt = linesTaxable > 0 ? (linesGst * (taxable / linesTaxable)) : linesGst;
    const cgst = isIgst ? 0 : gstAmt / 2;
    const sgst = isIgst ? 0 : gstAmt / 2;
    const igst = isIgst ? gstAmt : 0;

    const tcsAmt = footer.tcsRate > 0 ? (taxable * footer.tcsRate / 100) : Number(footer.tcsAmt || 0);
    const rawNet = taxable + gstAmt + tcsAmt;
    const roundOff = Math.round(rawNet) - rawNet;
    const net = Math.round(rawNet);

    return {
      totalPcs,
      totalMts: Number(totalMts.toFixed(3)),
      gross,
      taxable,
      gstAmt,
      cgst,
      sgst,
      igst,
      tcsAmt,
      roundOff,
      net
    };
  }, [gridItems, footer, header.type, header.gstType]);

  const handleNew = (tType = returnType) => {
    setSelectedReturnId('');
    setSelectedOriginalBillId('');
    setOriginalBills([]);
    setHeader({
      party: '',
      add: '',
      broker: '',
      book: tType === 'Sales' ? 'SALES RETURN BOOK' : 'PURCHASE RETURN ACCOUNT',
      gstin: '',
      city: '',
      haste: '',
      billNo: 'AUTO',
      billDate: today(),
      entryDate: today(),
      refBillNo: '',
      type: 'INVOICE IN STATE',
      gstType: 'CGST+SGST'
    });
    setGridItems([blankLine()]);
    setFooter({
      transport: '',
      city: '',
      lrNo: '',
      lrDate: today(),
      freight: 0,
      weight: 0,
      remarks: '',
      discountAmt: 0,
      discountSign: '-',
      octroi: 0,
      octroiSign: '+',
      addAmt: 0,
      addSign: '+',
      tcsRate: 0,
      tcsAmt: 0,
      roundOff: 0
    });
    setMode('Add');
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;
    if (!header.party) return toast.error(`Please select a ${isSales ? 'Customer' : 'Supplier'} first`);

    const validLines = gridItems.filter(i => i.itemId && (Number(i.mts || i.pcs || 0) > 0 || Number(i.rate || 0) > 0));
    if (validLines.length === 0) return toast.error('Please add at least one line item');

    if (!isSales && validLines.some(i => !i.lotId)) {
      return toast.error('Purchase Return requires a Stock Lot selection on every line item');
    }

    setSaving(true);
    try {
      const payload = {
        returnType,
        invoiceNo: header.billNo === 'AUTO' ? undefined : header.billNo,
        originalInvoiceNo: header.refBillNo,
        originalSaleId: isSales ? selectedOriginalBillId : undefined,
        originalPurchaseId: !isSales ? selectedOriginalBillId : undefined,
        partyId: header.party,
        brokerId: header.broker || undefined,
        date: header.billDate,
        items: validLines.map(i => ({
          itemId: i.itemId,
          lotId: i.lotId || null,
          pcs: Number(i.pcs || 0),
          mts: Number(i.mts || 0),
          rate: Number(i.rate || 0),
          unit: i.unit || 'MTRS',
          fold: Number(i.fold || 0),
          cut: Number(i.cut || 0),
          dis1Per: Number(i.dis1Per || 0),
          dis1Amt: Number(i.dis1Amt || 0),
          addAmt: Number(i.addAmt || 0),
          gstPer: Number(i.gstPer || 5),
          gstAmt: Number(i.gstAmt || 0),
          amount: Number(i.amount || 0)
        })),
        taxableAmount: calculations.taxable,
        gstAmount: calculations.gstAmt,
        netAmount: calculations.net,
        gstType: header.gstType,
        cgst: calculations.cgst,
        sgst: calculations.sgst,
        igst: calculations.igst,
        transport: footer.transport,
        city: footer.city || header.city,
        lrNo: footer.lrNo,
        lrDate: footer.lrDate,
        freight: Number(footer.freight || 0),
        weight: Number(footer.weight || 0),
        remarks: footer.remarks,
        tcs: calculations.tcsAmt,
        roundOff: calculations.roundOff
      };

      await addReturn(payload);
      toast.success(`${returnType} Return committed successfully!`);
      fetchReturns?.();
      handleNew(returnType);
    } catch (err) {
      notifyError(err, `Failed to save ${returnType} Return`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen && !win.isMinimized}
      onClose={onClose}
      bare
      style={win.modalStyle}
      className={win.modalClassName}
      inertBackdrop={win.inertBackdrop}
    >
      <div
        className="flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg-card)] erp-bill-window-shell relative"
        onPointerDown={win.onShellPointerDown}
      >
        <div className="classic-erp-window erp-density erp-sales-bill-compact flex flex-col flex-1 min-h-0 overflow-hidden !max-h-none !h-auto">
          <ErpBusyOverlay show={bootLoading} message={`Loading ${returnType} Return…`} />
          <ErpBusyOverlay show={!bootLoading && saving} message={`Committing ${returnType} Return…`} />

          {/* Classic ERP Title Bar */}
          <div className="classic-erp-header shrink-0">
            <span className="erp-window-title truncate">{windowTitle}</span>
            <span className="text-xs font-mono opacity-90 hidden md:inline erp-window-meta">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long' })}
            </span>
            <ErpWindowControls
              isMaximized={win.isMaximized}
              onMinimize={win.minimize}
              onToggleMax={win.toggleMax}
              onClose={onClose}
            />
          </div>

          {/* Form Body Container matching Sales/Purchase Bill Layout */}
          <div ref={modalContainerRef} className="classic-erp-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden erp-bill-layout p-2 flex flex-col gap-2">
            
            {/* Header Split: Left (Party & Broker) | Right (Return No & Ref Bill) */}
            <div className="classic-erp-frame classic-erp-header-split erp-sales-top shrink-0">
              
              {/* Left Column: Party, Broker, GSTIN, City */}
              <div className="classic-erp-stack classic-erp-header-party">
                
                {/* Party Combobox */}
                <div className="classic-erp-field classic-erp-field--lg">
                  <span className="classic-erp-label blue-label font-bold">Party:</span>
                  <div className="classic-erp-control flex-1">
                    <ERPCombobox
                      value={header.party}
                      onChange={onPartySelect}
                      options={partyOptions}
                      placeholder={`Select ${isSales ? 'Customer' : 'Supplier'}…`}
                      disabled={locked}
                    />
                  </div>
                </div>

                {/* Broker Combobox */}
                <div className="classic-erp-field classic-erp-field--lg">
                  <span className="classic-erp-label">Broker:</span>
                  <div className="classic-erp-control flex-1">
                    <ERPCombobox
                      value={header.broker}
                      onChange={(val) => setHeader({ ...header, broker: val })}
                      options={brokerOptions}
                      placeholder="Direct / Broker…"
                      disabled={locked}
                      allowClear
                    />
                  </div>
                </div>

                {/* GSTIN & City Grid */}
                <div className="classic-erp-meta-grid erp-sales-party-meta">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">GSTIN:</span>
                    <input type="text" className="classic-erp-input font-mono" value={header.gstin} readOnly placeholder="—" />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">City:</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={header.city}
                      onChange={(e) => setHeader({ ...header, city: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>

              </div>

              {/* Right Column: Return No, Dates, Ref Bill Auto-Fill */}
              <div className="classic-erp-stack classic-erp-header-bill">
                
                {/* Return No & Bill Date */}
                <div className="classic-erp-meta-grid erp-sales-bill-meta">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label red-label font-bold">Return No:</span>
                    <input
                      type="text"
                      className="classic-erp-input uppercase font-bold"
                      value={header.billNo}
                      onChange={(e) => setHeader({ ...header, billNo: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Bill Date:</span>
                    <input
                      type="date"
                      className="classic-erp-input"
                      value={header.billDate}
                      onChange={(e) => setHeader({ ...header, billDate: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>

                {/* Ref Bill Selection & Manual Input */}
                <div className="classic-erp-meta-grid erp-sales-ref-meta">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label font-bold text-amber-800">Ref. Bill No:</span>
                    <select
                      className="classic-erp-select font-bold text-amber-900 bg-amber-50"
                      value={selectedOriginalBillId}
                      onChange={(e) => handleSelectOriginalBill(e.target.value)}
                      disabled={locked}
                    >
                      <option value="">-- {originalBills.length > 0 ? 'Select Past Bill to Auto-Fill' : 'Enter Manually'} --</option>
                      {originalBills.map(b => (
                        <option key={b._id || b.id} value={b._id || b.id}>
                          {b.invoiceNo || b.supplierInvoiceNo} ({new Date(b.date).toLocaleDateString('en-IN')}) — ₹{b.netAmount}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Manual No:</span>
                    <input
                      type="text"
                      className="classic-erp-input uppercase"
                      placeholder="INV-0001"
                      value={header.refBillNo}
                      onChange={(e) => setHeader({ ...header, refBillNo: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>

                {/* Supply Type */}
                <div className="classic-erp-meta-grid">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Type:</span>
                    <select
                      className="classic-erp-select font-bold"
                      value={header.type}
                      onChange={(e) => setHeader({ ...header, type: e.target.value, gstType: e.target.value === 'INVOICE OUT OF STATE' ? 'IGST' : 'CGST+SGST' })}
                      disabled={locked}
                    >
                      <option value="INVOICE IN STATE">INVOICE IN STATE</option>
                      <option value="INVOICE OUT OF STATE">INVOICE OUT OF STATE</option>
                      <option value="UNREGISTERED INVOICE">UNREGISTERED INVOICE</option>
                    </select>
                  </div>
                </div>

              </div>

            </div>

            {/* Grid Table Container matching Sales/Purchase Bill Layout */}
            <div className="classic-erp-table-container erp-grid-panel erp-sales-grid min-h-[180px] flex-1 flex flex-col">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="classic-erp-table w-full">
                  <thead>
                    <tr>
                      <th className="col-sr text-center">Sr</th>
                      <th className="col-item">Item Name *</th>
                      <th className="col-num text-center">Lot No</th>
                      <th className="col-num text-center">Fold</th>
                      <th className="col-num text-center">Pcs *</th>
                      <th className="col-qty text-center">Mts *</th>
                      <th className="col-qty text-right">Rate *</th>
                      <th className="col-unit text-center">Per/Unit</th>
                      <th className="col-amt text-right">Amount</th>
                      <th className="col-pct text-center">DIS1%</th>
                      <th className="col-amt text-right">DISAMT</th>
                      <th className="col-amt text-right">AddAmt</th>
                      <th className="col-pct text-center">GST%</th>
                      <th className="col-amt text-right">GSTAmt</th>
                      <th className="col-del text-center">✕</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridItems.map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td className="col-sr text-center font-bold">{idx + 1}</td>
                        <td className="col-item">
                          <ERPCombobox
                            value={row.itemId}
                            onChange={(val) => onGridItemSelect(val, idx)}
                            options={itemOptions}
                            placeholder="Select item…"
                            disabled={locked}
                          />
                        </td>
                        <td className="col-num">
                          <input
                            type="text"
                            className="classic-erp-input font-mono text-center"
                            value={row.lotLabel || ''}
                            placeholder={!isSales ? 'Lot *' : 'Lot'}
                            onChange={(e) => patchLine(idx, { lotLabel: e.target.value })}
                            disabled={locked}
                          />
                        </td>
                        <td className="col-num">
                          <input
                            type="number"
                            className="classic-erp-input text-center"
                            value={row.fold || ''}
                            onChange={(e) => patchLine(idx, { fold: Number(e.target.value) }, 'fold')}
                            disabled={locked}
                          />
                        </td>
                        <td className="col-num">
                          <input
                            type="number"
                            className="classic-erp-input text-center font-bold"
                            value={row.pcs || ''}
                            onChange={(e) => patchLine(idx, { pcs: Number(e.target.value) }, 'pcs')}
                            disabled={locked}
                          />
                        </td>
                        <td className="col-qty">
                          <input
                            type="number"
                            className="classic-erp-input text-center font-bold text-blue-800"
                            value={row.mts || ''}
                            onChange={(e) => patchLine(idx, { mts: Number(e.target.value) }, 'mts')}
                            disabled={locked}
                          />
                        </td>
                        <td className="col-qty">
                          <input
                            type="number"
                            className="classic-erp-input text-right font-bold"
                            value={row.rate || ''}
                            onChange={(e) => patchLine(idx, { rate: Number(e.target.value) }, 'rate')}
                            disabled={locked}
                          />
                        </td>
                        <td className="col-unit text-center font-semibold text-xs">
                          {row.unit || 'MTRS'}
                        </td>
                        <td className="col-amt font-bold text-right">
                          ₹{money(row.amount)}
                        </td>
                        <td className="col-pct">
                          <input
                            type="number"
                            className="classic-erp-input text-center"
                            value={row.dis1Per || ''}
                            onChange={(e) => patchLine(idx, { dis1Per: Number(e.target.value) }, 'dis1Per')}
                            disabled={locked}
                          />
                        </td>
                        <td className="col-amt text-right font-mono text-red-700 font-bold">
                          ₹{money(row.dis1Amt)}
                        </td>
                        <td className="col-amt">
                          <input
                            type="number"
                            className="classic-erp-input text-right"
                            value={row.addAmt || ''}
                            onChange={(e) => patchLine(idx, { addAmt: Number(e.target.value) }, 'addAmt')}
                            disabled={locked}
                          />
                        </td>
                        <td className="col-pct text-center font-semibold">
                          {row.gstPer || 5}%
                        </td>
                        <td className="col-amt text-right font-semibold text-blue-800">
                          ₹{money(row.gstAmt)}
                        </td>
                        <td className="col-del text-center">
                          {!locked && (
                            <button
                              type="button"
                              onClick={() => removeGridRow(idx)}
                              className="text-red-600 hover:text-red-800 font-bold text-xs"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Grid Summary Footer Bar */}
              <div className="classic-erp-table-summary flex justify-between items-center px-3 py-1.5 bg-slate-200 border-t border-slate-300 text-xs font-bold shrink-0">
                {!locked && (
                  <button
                    type="button"
                    onClick={addGridRow}
                    className="classic-erp-btn btn-blue text-[11px] h-6 px-2.5 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Row
                  </button>
                )}
                <div className="flex gap-4 ml-auto font-mono text-slate-800">
                  <span>TOTAL PCS: <strong className="text-blue-900">{calculations.totalPcs}</strong></span>
                  <span>TOTAL MTS: <strong className="text-blue-900">{calculations.totalMts}</strong></span>
                </div>
              </div>
            </div>

            {/* Bottom Footer Calculations & Adjustments Block (3 Clean Columns) */}
            <div className="grid grid-cols-12 gap-2 erp-sales-footer shrink-0">
              
              {/* Left Column: Transport Details */}
              <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
                <span className="classic-erp-frame-title font-bold text-xs border-b pb-1 mb-1 block">Transport Details</span>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Transport:</span>
                  <input
                    type="text"
                    className="classic-erp-input"
                    value={footer.transport}
                    onChange={(e) => setFooter({ ...footer, transport: e.target.value })}
                    disabled={locked}
                  />
                </div>
                <div className="classic-erp-meta-grid">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">LR No:</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.lrNo}
                      onChange={(e) => setFooter({ ...footer, lrNo: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">LR Date:</span>
                    <input
                      type="date"
                      className="classic-erp-input"
                      value={footer.lrDate}
                      onChange={(e) => setFooter({ ...footer, lrDate: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Remark:</span>
                  <input
                    type="text"
                    className="classic-erp-input"
                    value={footer.remarks}
                    onChange={(e) => setFooter({ ...footer, remarks: e.target.value })}
                    disabled={locked}
                  />
                </div>
              </div>

              {/* Middle Column: Adjustments (Discount, Octroi, Round Off) */}
              <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
                <span className="classic-erp-frame-title font-bold text-xs border-b pb-1 mb-1 block">Bill Adjustments</span>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Discount (-):</span>
                  <input
                    type="number"
                    className="classic-erp-input text-right font-bold"
                    value={footer.discountAmt || ''}
                    onChange={(e) => setFooter({ ...footer, discountAmt: Number(e.target.value) })}
                    disabled={locked}
                  />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Octroi (+):</span>
                  <input
                    type="number"
                    className="classic-erp-input text-right font-bold"
                    value={footer.octroi || ''}
                    onChange={(e) => setFooter({ ...footer, octroi: Number(e.target.value) })}
                    disabled={locked}
                  />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Round Off:</span>
                  <input
                    type="number"
                    className="classic-erp-input text-right font-mono font-bold"
                    value={calculations.roundOff}
                    readOnly
                  />
                </div>
              </div>

              {/* Right Column: Final Totals & GST Summary */}
              <div className="col-span-4 classic-erp-frame classic-erp-stack p-2 bg-amber-50/70 border-amber-200">
                <span className="classic-erp-frame-title font-bold text-xs border-b border-amber-200 pb-1 mb-1 block text-amber-900">Summary Totals</span>
                <div className="classic-erp-total-row font-bold text-xs flex justify-between">
                  <span className="classic-erp-label">Gross Amount:</span>
                  <span className="font-mono">₹{money(calculations.gross)}</span>
                </div>
                <div className="classic-erp-total-row font-bold text-xs flex justify-between border-t border-amber-200 pt-1">
                  <span className="classic-erp-label text-blue-900 font-extrabold">Taxable Amount:</span>
                  <span className="font-mono font-bold text-blue-900">₹{money(calculations.taxable)}</span>
                </div>
                <div className="classic-erp-total-row font-bold text-xs flex justify-between">
                  <span className="classic-erp-label">GST Total ({header.gstType}):</span>
                  <span className="font-mono">₹{money(calculations.gstAmt)}</span>
                </div>
                <div className="classic-erp-total-row font-black text-sm flex justify-between bg-blue-900 text-white p-2 rounded mt-1 shadow-sm">
                  <span>Net Amount:</span>
                  <span className="font-mono">₹{money(calculations.net)}</span>
                </div>
              </div>

            </div>

          </div>

          {/* Form Action Footer Bar matching Sales/Purchase Bill Layout */}
          <div className="classic-erp-form-footer flex-wrap shrink-0">
            <button className="classic-erp-btn" type="button" onClick={() => handleNew(returnType)} disabled={readOnly}>
              New
            </button>
            <button className="classic-erp-btn btn-blue font-bold" type="button" onClick={handleSave} disabled={locked || saving || bootLoading}>
              <SaveButtonLabel saving={saving} label={`Commit ${returnType} Return`} />
            </button>
            <button className="classic-erp-btn" type="button" onClick={() => handleNew(returnType)} disabled={locked}>
              Cancel
            </button>
            <button className="classic-erp-btn" type="button" onClick={onClose}>
              Exit
            </button>
          </div>

        </div>
      </div>
    </Modal>
  );
};

export default ReturnModal;
