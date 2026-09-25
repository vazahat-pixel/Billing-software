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
import { peekBillNo } from '../../utils/nextBillNo';

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

  const [showFindModal, setShowFindModal] = useState(false);
  const [findSearch, setFindSearch] = useState('');
  const [findActiveIdx, setFindActiveIdx] = useState(0);
  const findInputRef = useRef(null);

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
    billNo: '',
    billDate: today(),
    entryDate: today(),
    refBillNo: '',
    type: 'INVOICE IN STATE',
    gstType: 'CGST+SGST'
  });

  const sortedReturns = useMemo(() => {
    const list = (returns || []).filter(r => r.returnType === returnType);
    return list.sort((a, b) => {
      const numA = parseInt(String(a.invoiceNo || a.returnNo || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.invoiceNo || b.returnNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0);
    });
  }, [returns, returnType]);

  const filteredReturns = useMemo(() => {
    const q = findSearch.trim().toLowerCase();
    if (!q) return sortedReturns;
    return sortedReturns.filter(r => {
      const invNo = String(r.invoiceNo || r.returnNo || '').toLowerCase();
      const numOnly = invNo.replace(/\D/g, '');
      const party = String(r.partyId?.name || r.partyName || '').toLowerCase();
      return invNo.includes(q) || numOnly.includes(q) || party.includes(q);
    });
  }, [sortedReturns, findSearch]);

  const loadReturnData = (ret, targetMode = 'Edit') => {
    if (!ret) return;
    setSelectedReturnId(ret._id || ret.id || '');
    setReturnType(ret.returnType || 'Sales');
    setMode(targetMode);
    setHeader({
      party: ret.partyId?._id || ret.partyId || '',
      add: ret.narration || '',
      broker: ret.brokerId || '',
      book: ret.bookId || (ret.returnType === 'Sales' ? 'SALES RETURN BOOK' : 'PURCHASE RETURN ACCOUNT'),
      gstin: ret.partyId?.gstin || '',
      city: ret.station || '',
      haste: ret.haste || '',
      billNo: ret.invoiceNo || ret.returnNo || 'AUTO',
      billDate: ret.date ? String(ret.date).split('T')[0] : today(),
      entryDate: ret.entryDate ? String(ret.entryDate).split('T')[0] : today(),
      refBillNo: ret.originalInvoiceNo || '',
      type: ret.gstType === 'IGST' ? 'INVOICE OUT OF STATE' : 'INVOICE IN STATE',
      gstType: ret.gstType || 'CGST+SGST',
    });

    if (ret.items && ret.items.length) {
      setGridItems(ret.items.map((line, idx) => computeLine({
        id: idx + 1,
        itemId: line.itemId?._id || line.itemId || '',
        itemName: line.itemName || line.itemId?.itemName || line.itemId?.name || '',
        desc: line.desc || '',
        fold: line.fold || 0,
        cut: line.cut || 0,
        pcs: line.pcs || 0,
        mts: line.mts || line.qty || 0,
        rate: line.rate || 0,
        unit: line.unit || 'MTRS',
        amount: line.amount || 0,
        dis1Per: line.dis1Per || 0,
        dis1Amt: line.dis1Amt || 0,
        addAmt: line.addAmt || 0,
        gstPer: line.gstPer || 5,
        gstAmt: line.gstAmt || 0,
        lotId: line.lotId || null,
        lotLabel: line.lotNo || '',
      })));
    }

    setFooter({
      transport: ret.transport || '',
      city: ret.station || '',
      lrNo: ret.lrNo || '',
      lrDate: ret.lrDate ? String(ret.lrDate).split('T')[0] : today(),
      freight: ret.freight || 0,
      weight: ret.weight || 0,
      remarks: ret.remarks || '',
      discountAmt: ret.discountAmt || 0,
      discountSign: ret.discountSign || '-',
      octroi: ret.octroi || 0,
      octroiSign: ret.octroiSign || '+',
      addAmt: ret.addAmt || 0,
      addSign: ret.addSign || '+',
      tcsRate: ret.tcsRate || 0,
      tcsAmt: ret.tcsAmt || 0,
      roundOff: ret.roundOff || 0,
    });
  };

  const handleOpenFindModal = () => {
    setFindSearch('');
    const currentIdx = sortedReturns.findIndex(r => String(r._id || r.id) === String(selectedReturnId));
    setFindActiveIdx(currentIdx >= 0 ? currentIdx : Math.max(0, sortedReturns.length - 1));
    setShowFindModal(true);
    setTimeout(() => {
      findInputRef.current?.focus();
      try { findInputRef.current?.select(); } catch {}
    }, 50);
  };

  const handleFindKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowFindModal(false);
      return;
    }

    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.min(prev + 1, filteredReturns.length - 1));
      return;
    }

    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.min(prev + 1, filteredReturns.length - 1));
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const ret = filteredReturns[findActiveIdx];
      if (ret) {
        loadReturnData(ret, 'Edit');
        setShowFindModal(false);
        toast.success(`Return #${ret.invoiceNo || ret.returnNo} loaded in Edit mode`);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'F3' || (e.altKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        e.stopPropagation();
        handleOpenFindModal();
        return;
      }

      const prevKey = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus';
      const nextKey = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal';
      if ((prevKey || nextKey) && !e.ctrlKey && !e.altKey && mode === 'View' && !readOnly && !showFindModal) {
        e.preventDefault();
        e.stopPropagation();
        const list = sortedReturns || [];
        if (!list.length) return;
        const currentIdx = list.findIndex((r) => (r._id || r.id) === selectedReturnId);
        let nextIdx = currentIdx + (prevKey ? -1 : 1);
        if (currentIdx === -1) nextIdx = prevKey ? list.length - 1 : 0;
        if (nextIdx >= 0 && nextIdx < list.length) {
          loadReturnData(list[nextIdx], 'View');
          toast.info(`Return #${list[nextIdx].invoiceNo || list[nextIdx].returnNo} (${nextIdx + 1}/${list.length})`);
        }
        return;
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && !showFindModal) {
        if (e.target?.closest?.('[data-book-selection-modal], [data-command-palette], [data-find-modal]')) return;
        if (mode === 'View' && !readOnly) {
          e.preventDefault();
          e.stopPropagation();
          handleNew(returnType);
          return;
        }
      }

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNew(returnType);
        return;
      }

      if ((e.altKey && e.key.toLowerCase() === 'e') || e.key === 'F2') {
        if (selectedReturnId && mode === 'View') {
          e.preventDefault();
          setMode('Edit');
          toast.info('Switched to Edit mode');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, selectedReturnId, mode, showFindModal, sortedReturns, returnType]);

  const isSales = returnType === 'Sales';
  const windowTitle = `${returnType} Return [ ${header.book} ]`;

  const win = useErpWindow(isOpen, {
    id: `return-${returnType}`,
    title: windowTitle,
    onClose,
  });

  /** Stock lots available for Purchase Return (must pick lot to reverse stock). */
  const getLotOptionsForItem = (itemId) => {
    return (inventoryLots || [])
      .filter((l) => {
        if (l.status === 'Closed') return false;
        const lotItemId = l.itemId?._id || l.itemId || l.item?._id || l.item;
        if (itemId && String(lotItemId) !== String(itemId)) return false;
        return Number(l.remainingMtrs || 0) > 0 || Number(l.remainingPcs || 0) > 0;
      })
      .map((l) => {
        const code = l.lotId || l.lotNo || l.lotCode || String(l._id || l.id).slice(-6);
        const mts = Number(l.remainingMtrs || 0).toFixed(2);
        const pcs = Number(l.remainingPcs || 0);
        return {
          value: String(l._id || l.id),
          label: code,
          meta: `${pcs} pcs · ${mts} m`
        };
      });
  };

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
      unit: String(item?.unit || 'MTRS').toUpperCase(),
      // Purchase return lot must match the newly selected item
      ...(!isSales ? { lotId: '', lotLabel: '' } : {})
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
    const signed = (val, sign, defaultSign) => {
      const n = Number(val || 0);
      const s = sign || defaultSign;
      return s === '-' ? -n : n;
    };
    const discountAdj = signed(footer.discountAmt, footer.discountSign, '-');
    const octroiAdj = signed(footer.octroi, footer.octroiSign, '+');
    const addVal = Number(footer.addAmt || 0);

    const taxable = Math.max(0, linesTaxable + discountAdj + octroiAdj + addVal);
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

  const handleNew = async (tType = returnType) => {
    const billNo = await peekBillNo(tType === 'Sales' ? 'salesReturn' : 'purchaseReturn');
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
      billNo,
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
    <>
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

          {/* Form Body — same shell rules as Sales Invoice */}
          <div ref={modalContainerRef} className="classic-erp-body flex-1 min-h-0 overflow-x-hidden erp-bill-layout">

            {/* Header: Bill meta (DOM first for tab) | Party left visually */}
            <div className="classic-erp-frame classic-erp-header-split erp-sales-top shrink-0">
              <div className="classic-erp-stack classic-erp-header-bill">
                <div className="classic-erp-meta-grid erp-sales-bill-meta">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label red-label">Return No:</span>
                    <input
                      type="text"
                      className="classic-erp-input uppercase font-bold"
                      value={header.billNo}
                      onChange={(e) => setHeader({ ...header, billNo: e.target.value })}
                      disabled={locked}
                      autoFocus={!locked}
                    />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Date:</span>
                    <input
                      type="date"
                      className="classic-erp-input"
                      value={header.billDate}
                      onChange={(e) => setHeader({ ...header, billDate: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>

                <div className="classic-erp-field classic-erp-field--lg">
                  <span className="classic-erp-label text-amber-800 font-bold">
                    {isSales ? 'Ref. Bill:' : 'Ref. Pur.:'}
                  </span>
                  <div className="classic-erp-control">
                    <select
                      className="classic-erp-select font-bold text-amber-900 bg-amber-50"
                      value={selectedOriginalBillId}
                      onChange={(e) => handleSelectOriginalBill(e.target.value)}
                      disabled={locked || loadingBills}
                      title={isSales ? 'Select a past sales invoice to auto-fill' : 'Select a past purchase bill to auto-fill'}
                    >
                      <option value="">
                        {loadingBills
                          ? 'Loading bills…'
                          : originalBills.length > 0
                            ? (isSales ? 'Select past bill to auto-fill' : 'Select past purchase to auto-fill')
                            : 'No past bills — enter Manual No'}
                      </option>
                      {originalBills.map((b) => (
                        <option key={b._id || b.id} value={b._id || b.id}>
                          {b.invoiceNo || b.supplierInvoiceNo} ({b.date ? new Date(b.date).toLocaleDateString('en-IN') : '—'}) — ₹{Number(b.netAmount || 0).toFixed(0)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="classic-erp-meta-grid erp-sales-ref-meta">
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
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Type:</span>
                    <select
                      className="classic-erp-select font-bold"
                      value={header.type}
                      onChange={(e) => setHeader({
                        ...header,
                        type: e.target.value,
                        gstType: e.target.value === 'INVOICE OUT OF STATE' ? 'IGST' : 'CGST+SGST'
                      })}
                      disabled={locked}
                    >
                      <option value="INVOICE IN STATE">INVOICE IN STATE</option>
                      <option value="INVOICE OUT OF STATE">INVOICE OUT OF STATE</option>
                      <option value="UNREGISTERED INVOICE">UNREGISTERED INVOICE</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="classic-erp-stack classic-erp-header-party">
                <div className="classic-erp-field classic-erp-field--lg">
                  <span className={`classic-erp-label font-bold ${isSales ? 'blue-label' : 'red-label'}`}>
                    {isSales ? 'Party:' : 'Vendor *:'}
                  </span>
                  <div className="classic-erp-control">
                    <ERPCombobox
                      value={header.party}
                      onChange={onPartySelect}
                      options={partyOptions}
                      placeholder={`Select ${isSales ? 'Customer' : 'Supplier'}…`}
                      disabled={locked}
                      recentKey={isSales ? 'return-party' : 'return-vendor'}
                    />
                  </div>
                </div>

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

                <div className="classic-erp-meta-grid--3 erp-sales-broker-row">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Broker:</span>
                    <ERPCombobox
                      value={header.broker}
                      onChange={(val) => setHeader({ ...header, broker: val })}
                      options={brokerOptions}
                      placeholder="Direct / Broker…"
                      disabled={locked}
                      allowClear
                      recentKey="return-broker"
                    />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Haste:</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={header.haste}
                      onChange={(e) => setHeader({ ...header, haste: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Book:</span>
                    <input type="text" className="classic-erp-input font-semibold" value={header.book} readOnly />
                  </div>
                </div>
              </div>
            </div>

            {/* Item grid — same container/table rules as Sales (no nested scroll wrapper) */}
            <div className="classic-erp-table-container erp-grid-panel erp-sales-grid min-h-0">
              <table className="classic-erp-table erp-return-grid-table">
                <thead>
                  <tr>
                    <th className="col-sr text-center">Sr</th>
                    <th className="col-item">Item Name *</th>
                    <th className={`${!isSales ? 'col-desc' : 'col-num'} text-center`}>
                      {!isSales ? 'Lot No *' : 'Lot No'}
                    </th>
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
                    <th className="col-del text-center" />
                  </tr>
                </thead>
                <tbody>
                  {gridItems.map((row, idx) => (
                    <tr key={row.id || idx}>
                      <td className="col-sr text-center font-bold">{idx + 1}</td>
                      <td className="col-item" style={{ position: 'relative' }}>
                        <ERPCombobox
                          value={row.itemId}
                          onChange={(val) => onGridItemSelect(val, idx)}
                          options={itemOptions}
                          placeholder="Search item…"
                          disabled={locked}
                          recentKey={isSales ? 'return-item' : 'purchase-return-item'}
                          inputClassName="border-0"
                        />
                      </td>
                      <td className={!isSales ? 'col-desc' : 'col-num'}>
                        {!isSales ? (
                          <ERPCombobox
                            value={row.lotId || ''}
                            onChange={(val) => {
                              const lot = (inventoryLots || []).find(
                                (l) => String(l._id || l.id) === String(val)
                              );
                              patchLine(idx, {
                                lotId: val || '',
                                lotLabel: lot?.lotId || lot?.lotNo || lot?.lotCode || ''
                              });
                            }}
                            options={getLotOptionsForItem(row.itemId)}
                            placeholder={row.itemId ? 'Select lot…' : 'Pick item first'}
                            disabled={locked || !row.itemId}
                            allowClear
                            inputClassName="border-0"
                          />
                        ) : (
                          <input
                            type="text"
                            className="classic-erp-input w-full text-center border-0 font-mono"
                            value={row.lotLabel || ''}
                            placeholder="Lot"
                            onChange={(e) => patchLine(idx, { lotLabel: e.target.value })}
                            disabled={locked}
                          />
                        )}
                      </td>
                      <td className="col-num">
                        <input
                          type="number"
                          className="classic-erp-input w-full text-center border-0"
                          value={row.fold || ''}
                          onChange={(e) => patchLine(idx, { fold: Number(e.target.value) }, 'fold')}
                          disabled={locked}
                        />
                      </td>
                      <td className="col-num">
                        <input
                          type="number"
                          className="classic-erp-input w-full text-center border-0 font-bold"
                          value={row.pcs || ''}
                          onChange={(e) => patchLine(idx, { pcs: Number(e.target.value) }, 'pcs')}
                          disabled={locked}
                          min="0"
                        />
                      </td>
                      <td className="col-qty">
                        <input
                          type="number"
                          className="classic-erp-input w-full text-center border-0 font-bold text-blue-800"
                          value={row.mts || ''}
                          onChange={(e) => patchLine(idx, { mts: Number(e.target.value) }, 'mts')}
                          disabled={locked}
                          min="0"
                          step="0.001"
                        />
                      </td>
                      <td className="col-qty">
                        <input
                          type="number"
                          className="classic-erp-input w-full text-right border-0 font-bold"
                          value={row.rate || ''}
                          onChange={(e) => patchLine(idx, { rate: Number(e.target.value) }, 'rate')}
                          disabled={locked}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="col-unit text-center font-semibold text-[11px] text-slate-700">
                        {row.unit || 'MTRS'}
                      </td>
                      <td className="col-amt text-right font-mono font-bold">
                        {Number(money(row.amount)).toFixed(2)}
                      </td>
                      <td className="col-pct">
                        <input
                          type="number"
                          step="0.01"
                          className="classic-erp-input w-full text-center border-0"
                          value={row.dis1Per || ''}
                          onChange={(e) => patchLine(idx, { dis1Per: Number(e.target.value) }, 'dis1Per')}
                          disabled={locked}
                          placeholder="%"
                        />
                      </td>
                      <td className="col-amt text-right font-mono font-bold text-red-700">
                        {Number(money(row.dis1Amt)).toFixed(2)}
                      </td>
                      <td className="col-amt">
                        <input
                          type="number"
                          step="0.01"
                          className="classic-erp-input w-full text-right border-0"
                          value={row.addAmt || ''}
                          onChange={(e) => patchLine(idx, { addAmt: Number(e.target.value) }, 'addAmt')}
                          disabled={locked}
                        />
                      </td>
                      <td className="col-pct">
                        <input
                          type="number"
                          step="0.01"
                          className="classic-erp-input w-full text-center border-0"
                          value={row.gstPer || ''}
                          onChange={(e) => patchLine(idx, { gstPer: Number(e.target.value) }, 'gstPer')}
                          disabled={locked}
                        />
                      </td>
                      <td className="col-amt text-right font-mono font-bold text-blue-800">
                        {Number(money(row.gstAmt)).toFixed(2)}
                      </td>
                      <td className="col-del text-center">
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => removeGridRow(idx)}
                            className="text-red-700 hover:text-red-950 p-1"
                            title="Remove row"
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

            <div className="flex justify-between items-center bg-[var(--bg-subtle)] p-1.5 border border-[var(--border)] rounded-md shrink-0">
              <button
                type="button"
                onClick={addGridRow}
                className="classic-erp-btn"
                disabled={locked}
              >
                <Plus size={12} strokeWidth={3} /> Add Line Item
              </button>
              <div className="text-xs font-bold text-black font-mono flex gap-3 flex-wrap items-center">
                <span>TOTAL Pcs: <span className="text-blue-800">{calculations.totalPcs}</span></span>
                <span>/ Mts: <span className="text-blue-800">{Number(calculations.totalMts || 0).toFixed(2)}</span></span>
              </div>
            </div>

            {/* Footer: Adjustments | Transport | Totals */}
            <div className="grid grid-cols-12 gap-1.5 erp-sales-footer shrink-0">
              <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
                <span className="classic-erp-frame-title">Bill Adjustments</span>
                <div className="classic-erp-adj-row">
                  <span className="classic-erp-label">DISCOUNT:</span>
                  <select
                    className="classic-erp-select text-center font-bold"
                    value={footer.discountSign || '-'}
                    onChange={(e) => setFooter({ ...footer, discountSign: e.target.value })}
                    disabled={locked}
                  >
                    <option value="-">-</option>
                    <option value="+">+</option>
                  </select>
                  <input
                    type="number"
                    className="classic-erp-input text-right"
                    value={footer.discountAmt || ''}
                    onChange={(e) => setFooter({ ...footer, discountAmt: Number(e.target.value) })}
                    disabled={locked}
                  />
                </div>
                <div className="classic-erp-adj-row">
                  <span className="classic-erp-label">OCTROI:</span>
                  <select
                    className="classic-erp-select text-center font-bold"
                    value={footer.octroiSign || '+'}
                    onChange={(e) => setFooter({ ...footer, octroiSign: e.target.value })}
                    disabled={locked}
                  >
                    <option value="-">-</option>
                    <option value="+">+</option>
                  </select>
                  <input
                    type="number"
                    className="classic-erp-input text-right"
                    value={footer.octroi || ''}
                    onChange={(e) => setFooter({ ...footer, octroi: Number(e.target.value) })}
                    disabled={locked}
                  />
                </div>
                <div className="classic-erp-adj-row">
                  <span className="classic-erp-label">ROUND OFF:</span>
                  <span className="text-center text-[11px] font-bold text-slate-500">±</span>
                  <input
                    type="number"
                    className="classic-erp-input text-right font-mono"
                    value={calculations.roundOff}
                    readOnly
                  />
                </div>
              </div>

              <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
                <span className="classic-erp-frame-title">Transport Details</span>
                <div className="classic-erp-field classic-erp-field--lg">
                  <span className="classic-erp-label">Transport:</span>
                  <input
                    type="text"
                    className="classic-erp-input"
                    value={footer.transport}
                    onChange={(e) => setFooter({ ...footer, transport: e.target.value })}
                    disabled={locked}
                  />
                </div>
                <div className="classic-erp-field classic-erp-field--lg">
                  <span className="classic-erp-label">Remark:</span>
                  <input
                    type="text"
                    className="classic-erp-input"
                    value={footer.remarks}
                    onChange={(e) => setFooter({ ...footer, remarks: e.target.value })}
                    disabled={locked}
                  />
                </div>
                <div className="classic-erp-meta-grid">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Lr No:</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.lrNo}
                      onChange={(e) => setFooter({ ...footer, lrNo: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Lr Dt:</span>
                    <input
                      type="date"
                      className="classic-erp-input"
                      value={footer.lrDate}
                      onChange={(e) => setFooter({ ...footer, lrDate: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-4 classic-erp-frame classic-erp-stack p-2 bg-[var(--accent-light)] pb-3">
                <div className="classic-erp-total-row font-bold">
                  <span className="classic-erp-label text-slate-800">Gross Amt:</span>
                  <span className="font-mono text-black">₹{Number(money(calculations.gross)).toFixed(2)}</span>
                </div>
                <div className="classic-erp-total-row font-bold border-t border-[var(--border)] pt-1">
                  <span className="classic-erp-label text-slate-800">Taxable Amt:</span>
                  <span className="font-mono text-black shrink-0">₹{Number(money(calculations.taxable)).toFixed(2)}</span>
                </div>
                <div className="classic-erp-total-row font-bold">
                  <span className="classic-erp-label text-slate-800">
                    {header.gstType === 'IGST' ? 'IGST' : 'CGST+SGST'}:
                  </span>
                  <span className="font-mono text-black">₹{Number(money(calculations.gstAmt)).toFixed(2)}</span>
                </div>
                <div className="classic-erp-total-row font-bold border-t-2 border-slate-800 pt-1 mt-1">
                  <span className="classic-erp-label text-slate-900 font-black">Net Amount:</span>
                  <span className="font-mono text-blue-900 font-black text-sm">₹{Number(money(calculations.net)).toFixed(2)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Form Action Footer Bar matching Sales/Purchase Bill Layout */}
          <div className="classic-erp-form-footer flex-wrap shrink-0">
            <button className="classic-erp-btn" type="button" onClick={() => handleNew(returnType)} disabled={readOnly} title="New Return (Alt+N)">
              New
            </button>
            <button className="classic-erp-btn btn-blue font-bold" type="button" onClick={handleSave} disabled={locked || saving || bootLoading}>
              <SaveButtonLabel saving={saving} label={`Commit ${returnType} Return`} />
            </button>
            <button className="classic-erp-btn" type="button" onClick={() => handleNew(returnType)} disabled={locked}>
              Cancel
            </button>
            <button
              className="classic-erp-btn font-bold bg-amber-100 border-amber-400 text-amber-900"
              type="button"
              onClick={handleOpenFindModal}
              disabled={saving}
              title="Quick Find Return (F3 / Alt+F)"
            >
              Find (F3)
            </button>
            <button
              className="classic-erp-btn"
              type="button"
              onClick={() => setMode('Edit')}
              disabled={readOnly || mode !== 'View' || !selectedReturnId || saving}
              title="Edit Return (F2 / Alt+E)"
            >
              Edit
            </button>
            <button className="classic-erp-btn" type="button" onClick={onClose}>
              Exit
            </button>
          </div>

        </div>
      </div>
    </Modal>

    {/* Quick Return Number Find Modal with + / - and Enter -> Edit */}
    {showFindModal && (
      <div
        className="fixed inset-0 bg-black/60 z-[10070] flex items-center justify-center p-4"
        onClick={() => setShowFindModal(false)}
      >
        <div
          className="bg-white rounded-lg shadow-2xl border-2 border-slate-700 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: '82vh' }}
        >
          {/* Header */}
          <div className="bg-[#1a3353] text-white px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-900 font-black px-1.5 py-0.5 rounded text-[11px]">FIND RETURN</span>
              <h3 className="font-bold text-xs uppercase tracking-wider">Quick {returnType} Return Selector</h3>
            </div>
            <span className="text-[10px] text-slate-300">
              <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">+</kbd> / <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">-</kbd> change · <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">Enter</kbd> Edit
            </span>
          </div>

          {/* Search / Quick Number Input */}
          <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 shrink-0">Return No:</span>
            <input
              ref={findInputRef}
              type="text"
              autoFocus
              value={findSearch}
              onChange={(e) => {
                setFindSearch(e.target.value);
                setFindActiveIdx(0);
              }}
              onKeyDown={handleFindKeyDown}
              placeholder="Type number (1, 2, 3...) or press + / - to change..."
              className="flex-1 px-3 py-1.5 border-2 border-blue-600 rounded text-sm font-bold bg-[#fffde6] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono shadow-inner"
            />
            <span className="text-[11px] font-bold text-slate-600 shrink-0">{filteredReturns.length} Records</span>
          </div>

          {/* Return Numbers List */}
          <div className="overflow-y-auto p-2 flex-1 space-y-1 max-h-72 bg-slate-50">
            {filteredReturns.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 font-medium">
                No returns found matching &quot;{findSearch}&quot;
              </div>
            ) : (
              filteredReturns.map((r, idx) => {
                const isSelected = idx === findActiveIdx;
                const cleanNo = String(r.invoiceNo || r.returnNo || idx + 1);
                return (
                  <div
                    key={r._id || r.id || idx}
                    onClick={() => {
                      loadReturnData(r, 'Edit');
                      setShowFindModal(false);
                      toast.success(`Return #${cleanNo} loaded in Edit mode`);
                    }}
                    className={`px-3 py-2 rounded flex items-center justify-between cursor-pointer text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-300'
                        : 'hover:bg-slate-200 text-slate-800 bg-white border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black font-mono px-2 py-0.5 rounded ${isSelected ? 'bg-amber-400 text-slate-900 shadow-sm' : 'bg-slate-200 text-slate-900'}`}>
                        #{cleanNo}
                      </span>
                      <div>
                        <div className={`font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {r.partyId?.name || r.partyName || 'Party'}
                        </div>
                        <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                          {r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—'} · {r.items?.length || 0} items
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold">
                      <div>₹{Number(r.netAmount || r.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      {isSelected && (
                        <span className="text-[9px] bg-white/25 px-1.5 py-0.5 rounded text-white font-semibold uppercase tracking-wider">
                          ↵ Enter → Edit
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Navigation Bar */}
          <div className="bg-slate-200 px-3 py-2 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-700">
            <span className="flex items-center gap-1 font-medium">
              <kbd className="bg-white border px-1 rounded font-bold font-mono">+</kbd> Next · <kbd className="bg-white border px-1 rounded font-bold font-mono">-</kbd> Prev · <kbd className="bg-white border px-1 rounded font-bold font-mono">↑↓</kbd> Select
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFindModal(false)}
                className="px-3 py-1 bg-white border border-slate-400 rounded text-xs hover:bg-slate-100 font-semibold"
              >
                Cancel (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  const ret = filteredReturns[findActiveIdx];
                  if (ret) {
                    loadReturnData(ret, 'Edit');
                    setShowFindModal(false);
                    toast.success(`Return #${ret.invoiceNo || ret.returnNo} loaded in Edit mode`);
                  }
                }}
                disabled={!filteredReturns.length}
                className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-xs hover:bg-blue-700 shadow-sm"
              >
                Open in Edit (Enter)
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ReturnModal;
