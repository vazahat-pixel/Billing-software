import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { useConfig } from '../../context/ConfigContext';
import { resolvePurchaseFieldVisibility } from '../../utils/configHelpers';
import { toast } from '../../store/useToastStore';
import { notifyError } from '../../utils/notify';
import { Trash2, Plus } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';
import BillSaveNextActions from '../../components/BillSaveNextActions';
import BillAutoFill from '../../components/BillAutoFill';
import PurchasePrint from './PurchasePrint';
import { warehousesApi } from '../../api';
import { ERPCombobox } from '../../components/erp';
import { erpConfirm } from '../../utils/confirm';
import { resolveParty, buildWhatsAppMessage, openWhatsAppShare } from '../../utils/invoiceHelpers';
import { getFocusableElements } from '../../utils/formEnterNavigation';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import useConfigStore from '../../store/useConfigStore';
import { resolveInvoiceSupplyType } from '../../utils/gstStateCodes';

const today = () => new Date().toISOString().split('T')[0];

const PurchaseModal = ({
  isOpen,
  onClose,
  selectedBook = null,
  readOnly = false,
  onOpenSales,
  onOpenJobIssue,
  onOpenMillIssue
}) => {
  const { parties, items, purchases, addPurchase, deletePurchase, fetchParties, fetchItems, fetchPurchases, plan, user } = useStore();
  const { bundle } = useConfig();
  const companySettings = useConfigStore((s) => s.companySettings);
  const { showBroker, showDiscount2 } = resolvePurchaseFieldVisibility(bundle, user, plan);
  const [mode, setMode] = useState('View');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [error, setError] = useState('');
  const [saveNextActions, setSaveNextActions] = useState(null);
  const [printInvoiceId, setPrintInvoiceId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const openedOnceRef = useRef(false);
  const modalContainerRef = useRef(null);
  const suppBillRef = useRef(null);

  const [warehouses, setWarehouses] = useState([]);
  const [billAttachment, setBillAttachment] = useState(null);

  const [header, setHeader] = useState({
    party: '',
    add: '',
    broker: '',
    book: 'PURCHASE BOOK',
    gstin: '',
    city: '',
    vNo: 'AUTO',
    billNo: '',
    billDate: today(),
    challanNo: '',
    chDate: today(),
    type: 'INVOICE IN STATE',
    gstType: 'CGST+SGST',
    reverseCharge: 'No',
    warehouseId: ''
  });

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', desc: '', fold: 0, cut: 0, pcs: 0, mts: 0, rate: 0, amount: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, gstPer: 5, gstAmt: 0 }
  ]);

  const [footer, setFooter] = useState({
    discountAmt: 0,
    discountSign: '-',
    lessAmt: 0,
    lessSign: '-',
    addAmt: 0,
    addSign: '+',
    octroi: 0,
    octroiSign: '+',
    itcEligibility: 'Inputs',
    roundOff: 0,
    rcmCharge: 0,
    rcmChargeSign: '+',
    remarks: ''
  });

  useEffect(() => {
    if (!isOpen) {
      openedOnceRef.current = false;
      setSaveNextActions(null);
      setPrintInvoiceId(null);
      setBootLoading(false);
      return;
    }

    let cancelled = false;
    setBootLoading(true);
    Promise.all([
      fetchParties(),
      fetchItems(),
      fetchPurchases(),
      warehousesApi.list().then((list) => setWarehouses(Array.isArray(list) ? list : [])).catch(() => setWarehouses([])),
    ])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });

    if (!openedOnceRef.current) {
      openedOnceRef.current = true;
      setSaveNextActions(null);
      setPrintInvoiceId(null);
      setBillAttachment(null);
      if (readOnly) {
        setMode('View');
      } else {
        setSelectedPurchaseId('');
        handleNew();
      }
    }

    const t = setTimeout(() => {
      if (suppBillRef.current && !locked) {
        suppBillRef.current.focus();
        try { suppBillRef.current.select(); } catch {}
      } else if (modalContainerRef.current) {
        const focusables = getFocusableElements(modalContainerRef.current);
        if (focusables.length > 0) {
          focusables[0].focus();
          if (typeof focusables[0].select === 'function') {
            try { focusables[0].select(); } catch {}
          }
        }
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isOpen, readOnly, selectedBook, fetchParties, fetchItems, fetchPurchases]);

  const loadPurchaseData = (pur) => {
    setBillAttachment(pur.billAttachment || null);
    setHeader({
      party: pur.supplierId?._id || pur.supplierId || '',
      add: pur.narration || '',
      broker: pur.brokerId || '',
      book: pur.bookId || 'PURCHASE BOOK',
      gstin: pur.supplierId?.gstin || '',
      city: pur.station || '',
      vNo: pur.invoiceNo || '',
      billNo: pur.supplierInvoiceNo || '',
      billDate: pur.date ? pur.date.split('T')[0] : today(),
      challanNo: pur.challanNo || '',
      chDate: pur.challanDate ? pur.challanDate.split('T')[0] : today(),
      type: pur.gstType === 'IGST' ? 'INVOICE OUT OF STATE' : 'INVOICE IN STATE',
      gstType: pur.gstType || 'CGST+SGST',
      reverseCharge: pur.reverseCharge || 'No',
      warehouseId: pur.warehouseId?._id || pur.warehouseId || ''
    });

    setGridItems(pur.items.map((item, idx) => ({
      id: idx + 1,
      itemId: item.itemId?._id || item.itemId || '',
      itemName: item.itemId?.itemName || '',
      desc: item.desc || '',
      fold: item.fold || 0,
      cut: item.cut || 0,
      pcs: item.pcs || 0,
      mts: item.mts || 0,
      rate: item.rate || 0,
      amount: item.amount || 0,
      dis1Per: item.dis1Per || 0,
      dis1Amt: item.dis1Amt || 0,
      dis2Per: item.dis2Per || 0,
      dis2Amt: item.dis2Amt || 0,
      gstPer: item.gstPer || 5,
      gstAmt: item.gstAmt || 0
    })));

    setFooter({
      discountAmt: pur.discountAmt || 0,
      discountSign: pur.discountSign || '-',
      lessAmt: pur.lessAmt || 0,
      lessSign: pur.lessSign || '-',
      addAmt: pur.addAmt || 0,
      addSign: pur.addSign || '+',
      octroi: pur.octroi || 0,
      octroiSign: pur.octroiSign || '+',
      itcEligibility: pur.itcEligibility || 'Inputs',
      roundOff: pur.roundOff || 0,
      rcmCharge: pur.rcmCharge || 0,
      rcmChargeSign: pur.rcmChargeSign || '+',
      remarks: pur.narration || ''
    });
  };

  const handleSelectPurchase = (e) => {
    const id = e.target.value;
    setSelectedPurchaseId(id);
    if (id) {
      const pur = purchases.find(p => p._id === id || p.id === id);
      if (pur) {
        loadPurchaseData(pur);
        setMode('View');
      }
    }
  };

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
    taxable += adjust(footer.discountAmt, footer.discountSign);
    taxable += adjust(footer.lessAmt, footer.lessSign);
    taxable += adjust(footer.addAmt, footer.addSign);
    taxable += adjust(footer.octroi, footer.octroiSign);

    const gstAmt = totalGstFromItems > 0 ? totalGstFromItems : (header.type === 'INVOICE OUT OF STATE' ? (taxable * 0.05) : (taxable * 0.05));
    
    let net = taxable + gstAmt + parseFloat(footer.roundOff || 0) + adjust(footer.rcmCharge, footer.rcmChargeSign);
    return { gross, taxable, gstAmt, net, totalAdd, totalLess };
  }, [gridItems, footer, header.type]);

  useEffect(() => {
    if (!isOpen || readOnly || mode === 'View') return;
    if (!warehouses.length || header.warehouseId) return;
    const first = warehouses[0]?._id || warehouses[0]?.id;
    if (first) setHeader((h) => ({ ...h, warehouseId: first }));
  }, [isOpen, readOnly, mode, warehouses, header.warehouseId]);

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

  const handleNew = () => {
    setBillAttachment(null);
    setHeader({
      party: '',
      add: '',
      broker: '',
      book: selectedBook || 'PURCHASE BOOK',
      gstin: '',
      city: '',
      vNo: 'AUTO',
      billNo: '',
      billDate: today(),
      challanNo: '',
      chDate: today(),
      type: 'INVOICE IN STATE',
      gstType: 'CGST+SGST',
      reverseCharge: 'No',
      warehouseId: warehouses[0]?._id || warehouses[0]?.id || ''
    });
    setGridItems([
      { id: 1, itemId: '', itemName: '', desc: '', fold: 0, cut: 0, pcs: 0, mts: 0, rate: 0, amount: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, gstPer: 5, gstAmt: 0 }
    ]);
    setFooter({
      discountAmt: 0,
      discountSign: '-',
      lessAmt: 0,
      lessSign: '-',
      addAmt: 0,
      addSign: '+',
      octroi: 0,
      octroiSign: '+',
      itcEligibility: 'Inputs',
      roundOff: 0,
      rcmCharge: 0,
      rcmChargeSign: '+',
      remarks: ''
    });
    setMode('Add');
  };

  const handleBillAutoApply = ({ header: h, gridItems: rows, attachment, footer: f }) => {
    setHeader((prev) => {
      // Prefer party from draft; when party set, also pull gstin/city from masters if draft incomplete
      let party = h.party || prev.party;
      let gstin = h.gstin || prev.gstin;
      let city = h.city || prev.city;
      let add = h.add || prev.add;
      if (party) {
        const p = parties.find((x) => x._id === party || x.id === party);
        if (p) {
          gstin = gstin || p.gstin || '';
          city = city || p.station || p.city || '';
          add = add || p.address || '';
        }
      }
      return {
        ...prev,
        party,
        gstin,
        city,
        add,
        billNo: h.billNo != null && h.billNo !== '' ? h.billNo : prev.billNo,
        billDate: h.billDate || prev.billDate,
        type: h.type || prev.type,
        gstType: h.gstType || prev.gstType,
      };
    });
    if (rows?.length) {
      // Collapse OCR duplicate rows (same item + qty + rate)
      const seen = new Map();
      for (const r of rows) {
        const key = `${r.itemId || r.itemName || ''}|${Number(r.mts || 0)}|${Number(r.rate || 0)}`;
        if (!seen.has(key)) seen.set(key, r);
      }
      const unique = [...seen.values()];
      setGridItems(
        unique.map((r, idx) => ({
          ...r,
          id: idx + 1,
          // ensure numbers so calc / save work
          pcs: Number(r.pcs || 0),
          mts: Number(r.mts || 0),
          rate: Number(r.rate || 0),
          amount: Number(r.amount || 0),
          gstPer: Number(r.gstPer || 5),
          gstAmt: Number(r.gstAmt || 0),
        }))
      );
    }
    if (f && (f.roundOff != null || f.roundOff === 0)) {
      setFooter((prev) => ({ ...prev, roundOff: Number(f.roundOff) || 0 }));
    }
    if (attachment) {
      setBillAttachment({
        fileName: attachment.fileName || '',
        mimeType: attachment.mimeType || '',
        extractedAt: attachment.extractedAt || new Date().toISOString(),
      });
    }
    if (mode === 'View') setMode('Add');
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;
    if (!header.party) return toast.error('Please select a Supplier/Party first');
    const validLines = gridItems.filter(i => (i.itemId || i.desc) && (Number(i.mts || i.pcs || 0) > 0 || Number(i.rate || 0) > 0));
    if (validLines.length === 0) return toast.error('Please add at least one line item with Quantity and Rate');
    setSaving(true);
    try {
      const payload = {
        supplierId: header.party,
        supplierName: parties.find(p => p._id === header.party || p.id === header.party)?.name || '',
        invoiceNo: header.vNo === 'AUTO' ? undefined : header.vNo,
        supplierInvoiceNo: header.billNo,
        date: header.billDate,
        challanNo: header.challanNo,
        challanDate: header.chDate,
        bookId: header.book,
        brokerId: header.broker || undefined,
        type: header.type,
        reverseCharge: header.reverseCharge,
        warehouseId: header.warehouseId || null,
        billAttachment: billAttachment
          ? {
              fileName: billAttachment.fileName || '',
              mimeType: billAttachment.mimeType || '',
              extractedAt: billAttachment.extractedAt || null,
            }
          : undefined,
        narration: footer.remarks,
        discountAmt: footer.discountAmt,
        discountSign: footer.discountSign,
        lessAmt: footer.lessAmt,
        lessSign: footer.lessSign,
        addAmt: footer.addAmt,
        addSign: footer.addSign,
        octroi: footer.octroi,
        octroiSign: footer.octroiSign,
        itcEligibility: footer.itcEligibility,
        roundOff: footer.roundOff,
        rcmCharge: footer.rcmCharge,
        rcmChargeSign: footer.rcmChargeSign,
        items: validLines.map(i => ({
          itemId: i.itemId,
          desc: i.desc,
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
      };

      const saved =
        mode === 'Edit' && selectedPurchaseId
          ? (() => {
              throw new Error(
                'Posted purchase bills cannot be edited. Cancel this bill (Delete) then create a new one — Edit would break stock and ledger.'
              );
            })()
          : await addPurchase(payload);
      const savedId = saved?._id || saved?.id;
      if (savedId) {
        setSelectedPurchaseId(savedId);
      }
      toast.success('Purchase saved — stock increased in warehouse');
      setSaveNextActions({
        id: savedId,
        invoiceNo: saved?.invoiceNo || header.vNo,
        offlinePending: !!saved?.offlinePending,
        invoice: saved
      });
      setMode('View');
      fetchPurchases();
    } catch (err) {
      const status = err.response?.status || err.status;
      const code = err.response?.data?.errorCode;
      notifyError(err, 'Failed to save purchase bill');
      // Duplicate voucher — reset to AUTO so next Save gets a fresh number
      if (status === 409 || code === 'CONFLICT') {
        setHeader((h) => ({ ...h, vNo: 'AUTO' }));
        if (mode !== 'Edit') setMode('Add');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const id = selectedPurchaseId;
    if (!id) return toast.error('Select a purchase bill first');
    if (!(await erpConfirm({
      title: 'Cancel Purchase',
      message: 'Are you sure you want to cancel/delete this purchase bill?',
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
      try {
        await deletePurchase(id);
        toast.success('Purchase bill cancelled!');
        handleNew();
        fetchPurchases();
      } catch (err) {
        toast.error(err, { fallback: 'Failed to delete purchase bill' });
      }
  };

  const handleCancel = () => {
    if (selectedPurchaseId) {
      const pur = purchases.find(p => p._id === selectedPurchaseId || p.id === selectedPurchaseId);
      if (pur) loadPurchaseData(pur);
    }
    setMode('View');
  };

  const locked = readOnly || mode === 'View';

  const vendorOptions = useMemo(
    () =>
      parties
        .filter((p) => p.type !== 'Broker')
        .map((p) => ({
          value: p._id || p.id,
          label: p.name,
          meta: [p.gstin, p.station || p.city].filter(Boolean).join(' · '),
        })),
    [parties]
  );

  const brokerOptions = useMemo(
    () =>
      parties
        .filter((p) => p.type === 'Broker')
        .map((p) => ({ value: p._id || p.id, label: p.name })),
    [parties]
  );

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w._id || w.id,
        label: w.name,
        meta: w.code || '',
      })),
    [warehouses]
  );

  const itemOptions = useMemo(
    () =>
      items.map((i) => ({
        value: i._id || i.id,
        label: i.itemName || i.name,
        meta: i.hsnCode ? `HSN ${i.hsnCode}` : '',
      })),
    [items]
  );

  const onVendorSelect = (val) => {
    if (!val) {
      setHeader({ ...header, party: '', add: '', gstin: '', city: '' });
      return;
    }
    const p = parties.find((x) => (x._id || x.id) === val);
    const autoType = resolveInvoiceSupplyType({
      partyGstin: p?.gstin,
      partyStateCode: p?.stateCode || p?.state,
      companyGstin: companySettings?.gstin || companySettings?.GSTIN,
      companyStateCode: companySettings?.stateCode || companySettings?.state,
    });
    setHeader({
      ...header,
      party: val,
      add: p?.address || '',
      gstin: p?.gstin || '',
      city: p?.station || p?.city || '',
      ...(autoType ? { type: autoType } : {}),
    });
  };

  const onPurchaseItemSelect = (val, idx) => {
    if (!val) return;
    const item = items.find((i) => (i._id || i.id) === val);
    const updated = [...gridItems];
    updated[idx] = {
      ...updated[idx],
      itemId: val,
      itemName: item?.itemName || '',
      rate: item?.purRate || item?.purchaseRate || 0,
      gstPer: item?.gstRate || 5,
    };
    setGridItems(updated);
  };

  const nextStepActions = [
    onOpenSales && {
      key: 'sales',
      label: '1. Open Sales Bill',
      onClick: () => {
        setSaveNextActions(null);
        onOpenSales();
      }
    },
    onOpenMillIssue && {
      key: 'millIssue',
      label: '2. Mill Issue (from purchased stock)',
      onClick: () => {
        setSaveNextActions(null);
        onOpenMillIssue();
      }
    },
    onOpenJobIssue && {
      key: 'jobIssue',
      label: '3. Job Issue (from purchased stock)',
      onClick: () => {
        setSaveNextActions(null);
        onOpenJobIssue();
      }
    }
  ].filter(Boolean);

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-7xl">
      <div className="classic-erp-window erp-density flex flex-col h-full">
        <ErpBusyOverlay show={bootLoading} message="Loading purchase bill…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Saving purchase…" />
        {/* Title Bar */}
        <div className="classic-erp-header">
          <span>Purchase Invoice [ PURCHASE BOOK ]</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        {/* Form Body */}
        <div ref={modalContainerRef} className="classic-erp-body flex-1 overflow-y-auto space-y-3 erp-bill-layout">
          
          {mode === 'View' && (
            <div className="classic-erp-frame flex gap-3 items-center">
              <span className="classic-erp-label blue-label font-bold">Find Purchase:</span>
              <select className="classic-erp-input flex-1" value={selectedPurchaseId} onChange={handleSelectPurchase}>
                <option value="">- Select Purchase to View/Edit -</option>
                {purchases.map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>Voucher #{p.invoiceNo} - {p.supplierId?.name} (₹{p.netAmount?.toFixed(2)})</option>
                ))}
              </select>
            </div>
          )}

          {!locked && (
            <BillAutoFill
              parties={parties}
              items={items}
              disabled={locked}
              onApply={handleBillAutoApply}
              onMastersChanged={async () => {
                await Promise.all([fetchParties(), fetchItems()]);
              }}
            />
          )}

          {/* Header Block — Sequence: Supp. Bill -> Date -> Vendor -> Gstin/City -> Godown */}
          <div className="classic-erp-frame classic-erp-header-split">
            <div className="classic-erp-stack classic-erp-header-bill">
              <div className="classic-erp-meta-grid">
                <div className="classic-erp-field">
                  <span className="classic-erp-label red-label">Supp. Bill:</span>
                  <input ref={suppBillRef} type="text" className="classic-erp-input" value={header.billNo} placeholder="Supp Bill No…" onChange={e => setHeader({ ...header, billNo: e.target.value })} disabled={locked} />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Date:</span>
                  <input type="date" className="classic-erp-input" value={header.billDate} onChange={e => setHeader({ ...header, billDate: e.target.value })} disabled={locked} />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Voucher:</span>
                  <input type="text" className="classic-erp-input" value={header.vNo} readOnly />
                </div>
              </div>
            </div>

            <div className="classic-erp-stack classic-erp-header-party">
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label red-label">Vendor:</span>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <ERPCombobox
                    value={header.party}
                    onChange={onVendorSelect}
                    options={vendorOptions}
                    placeholder="Search vendor / supplier…"
                    disabled={locked}
                    recentKey="purchase-vendor"
                    onCreateNew={!locked ? (q) => handleCreateAccount(q) : undefined}
                    createLabel="Vendor"
                  />
                  {!locked && (
                    <button type="button" title="Add new vendor" onClick={() => handleCreateAccount('')}
                      style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',fontSize:11,fontWeight:700,color:'#fff',background:'#16a34a',border:'none',borderRadius:4,cursor:'pointer',whiteSpace:'nowrap'}}>
                      <Plus size={11}/> Add
                    </button>
                  )}
                </div>
              </div>

              <div className="classic-erp-meta-grid">
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Gstin:</span>
                  <input type="text" className="classic-erp-input" value={header.gstin} readOnly />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">City:</span>
                  <input type="text" className="classic-erp-input" value={header.city} readOnly />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Challan:</span>
                  <input type="text" className="classic-erp-input" value={header.challanNo} onChange={e => setHeader({ ...header, challanNo: e.target.value })} disabled={locked} />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Ch Date:</span>
                  <input type="date" className="classic-erp-input" value={header.chDate} onChange={e => setHeader({ ...header, chDate: e.target.value })} disabled={locked} />
                </div>
              </div>
            </div>
          </div>

          {/* Broker / RCM / Type */}
          <div className="classic-erp-frame classic-erp-meta-grid--3">
            {showBroker ? (
              <div className="classic-erp-field">
                <span className="classic-erp-label">Broker:</span>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <ERPCombobox
                    value={header.broker}
                    onChange={(val) => setHeader({ ...header, broker: val })}
                    options={brokerOptions}
                    placeholder="Search broker…"
                    disabled={locked}
                    recentKey="purchase-broker"
                    onCreateNew={!locked ? (q) => handleCreateBroker(q) : undefined}
                    createLabel="Broker"
                  />
                  {!locked && (
                    <button type="button" title="Add new broker" onClick={() => handleCreateBroker('')}
                      style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',fontSize:11,fontWeight:700,color:'#fff',background:'#16a34a',border:'none',borderRadius:4,cursor:'pointer',whiteSpace:'nowrap'}}>
                      <Plus size={11}/> Add
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div />
            )}
            <div className="classic-erp-field">
              <span className="classic-erp-label">RCM:</span>
              <select className="classic-erp-select" value={header.reverseCharge} onChange={e => setHeader({ ...header, reverseCharge: e.target.value })} disabled={locked}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="classic-erp-field">
              <span className="classic-erp-label">Type:</span>
              <select className="classic-erp-select" value={header.type} onChange={e => setHeader({ ...header, type: e.target.value })} disabled={locked}>
                <option value="INVOICE IN STATE">INVOICE IN STATE</option>
                <option value="INVOICE OUT OF STATE">INVOICE OUT OF STATE</option>
              </select>
            </div>
          </div>

          {/* Item Grid Table */}
          <div className="classic-erp-table-container erp-grid-panel">
            <table className="classic-erp-table">
              <thead>
                <tr>
                  <th className="w-8 text-center">SrNo</th>
                  <th className="col-item">Item Name</th>
                  <th className="col-desc">Desc</th>
                  <th className="w-16 text-center">Fold</th>
                  <th className="w-16 text-center">Cut</th>
                  <th className="w-16 text-center">Pcs</th>
                  <th className="w-20 text-center">Mts</th>
                  <th className="w-20 text-right">Rate</th>
                  <th className="w-24 text-right">Amount</th>
                  <th className="w-16 text-center">Dis1%</th>
                  <th className="w-20 text-right">Dis1Amt</th>
                  {showDiscount2 && <th className="w-16 text-center">Dis2%</th>}
                  {showDiscount2 && <th className="w-20 text-right">Dis2Amt</th>}
                  <th className="w-16 text-center">GST%</th>
                  <th className="w-20 text-right">GSTAmt</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {gridItems.map((row, idx) => {
                  const updateRow = (field, val) => {
                    const updated = [...gridItems];
                    updated[idx][field] = val;
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
                    <tr key={row.id || idx}>
                      <td className="text-center font-bold">{idx + 1}</td>
                      <td className="col-item" style={{position:'relative'}}>
                        <div style={{display:'flex',alignItems:'center',gap:2}}>
                          <ERPCombobox
                            value={row.itemId}
                            onChange={(val) => onPurchaseItemSelect(val, idx)}
                            options={itemOptions}
                            placeholder="Search item…"
                            disabled={locked}
                            recentKey="purchase-item"
                            onCreateNew={!locked ? (q) => handleCreateItem(q, idx) : undefined}
                            createLabel="Item"
                            inputClassName="border-0"
                          />
                          {!locked && (
                            <button type="button" title="Add new item" onClick={() => handleCreateItem('', idx)}
                              style={{flexShrink:0,display:'inline-flex',alignItems:'center',padding:'2px 5px',fontSize:10,fontWeight:700,color:'#16a34a',background:'transparent',border:'1px solid #16a34a',borderRadius:4,cursor:'pointer',whiteSpace:'nowrap'}}>
                              <Plus size={10}/>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="col-desc">
                        <input type="text" className="classic-erp-input w-full border-0" value={row.desc || ''} onChange={e => updateRow('desc', e.target.value)} disabled={locked} />
                      </td>
                      <td>
                        <input type="number" className="classic-erp-input w-full text-center border-0" value={row.fold || ''} onChange={e => updateRow('fold', Number(e.target.value))} disabled={locked} />
                      </td>
                      <td>
                        <input type="number" className="classic-erp-input w-full text-center border-0" value={row.cut || ''} onChange={e => updateRow('cut', Number(e.target.value))} disabled={locked} />
                      </td>
                      <td>
                        <input type="number" className="classic-erp-input w-full text-center border-0" value={row.pcs || ''} onChange={e => updateRow('pcs', Number(e.target.value))} disabled={locked} />
                      </td>
                      <td>
                        <input type="number" className="classic-erp-input w-full text-center border-0" value={row.mts || ''} onChange={e => updateRow('mts', Number(e.target.value))} disabled={locked} />
                      </td>
                      <td>
                        <input type="number" className="classic-erp-input w-full text-right border-0" value={row.rate || ''} onChange={e => updateRow('rate', Number(e.target.value))} disabled={locked} />
                      </td>
                      <td className="text-right pr-2 font-bold font-mono">{parseFloat(row.amount || 0).toFixed(2)}</td>
                      <td>
                        <input type="number" className="classic-erp-input w-full text-center border-0" value={row.dis1Per || ''} onChange={e => updateRow('dis1Per', Number(e.target.value))} disabled={locked} />
                      </td>
                      <td className="text-right pr-2 text-red-700 font-mono">{parseFloat(row.dis1Amt || 0).toFixed(2)}</td>
                      {showDiscount2 && (
                        <td>
                          <input type="number" className="classic-erp-input w-full text-center border-0" value={row.dis2Per || ''} onChange={e => updateRow('dis2Per', Number(e.target.value))} disabled={locked} />
                        </td>
                      )}
                      {showDiscount2 && (
                        <td className="text-right pr-2 text-red-700 font-mono">{parseFloat(row.dis2Amt || 0).toFixed(2)}</td>
                      )}
                      <td>
                        <input type="number" className="classic-erp-input w-full text-center border-0" value={row.gstPer || ''} onChange={e => updateRow('gstPer', Number(e.target.value))} disabled={locked} />
                      </td>
                      <td className="text-right pr-2 text-blue-900 font-mono">{parseFloat(row.gstAmt || 0).toFixed(2)}</td>
                      <td className="text-center">
                        <button type="button" onClick={() => {
                          const updated = gridItems.filter((_, i) => i !== idx);
                          setGridItems(updated.length ? updated : [{ id: Date.now(), itemId: '', itemName: '', desc: '', fold: 0, cut: 0, pcs: 0, mts: 0, rate: 0, amount: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, gstPer: 5, gstAmt: 0 }]);
                        }} className="text-red-700 hover:text-red-950 p-1" disabled={locked}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center bg-[var(--bg-subtle)] p-1.5 border border-[var(--border)] rounded-md">
            <button
              type="button"
              onClick={() => setGridItems([...gridItems, { id: Date.now(), itemId: '', itemName: '', desc: '', fold: 0, cut: 0, pcs: 0, mts: 0, rate: 0, amount: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, gstPer: 5, gstAmt: 0 }])}
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
            
            <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
              {[
                { label: 'DISCOUNT', key: 'discountAmt', signKey: 'discountSign' },
                { label: 'LESS', key: 'lessAmt', signKey: 'lessSign' },
                { label: 'ADD', key: 'addAmt', signKey: 'addSign' },
                { label: 'OCTROI', key: 'octroi', signKey: 'octroiSign' }
              ].map(adj => (
                <div key={adj.key} className="classic-erp-adj-row">
                  <span className="classic-erp-label">{adj.label}:</span>
                  <select
                    className="classic-erp-select text-center font-bold"
                    value={footer[adj.signKey]}
                    onChange={e => setFooter({ ...footer, [adj.signKey]: e.target.value })}
                    disabled={locked}
                  >
                    <option value="-">-</option>
                    <option value="+">+</option>
                  </select>
                  <input
                    type="number"
                    className="classic-erp-input text-right"
                    value={footer[adj.key] || ''}
                    onChange={e => setFooter({ ...footer, [adj.key]: Number(e.target.value) })}
                    disabled={locked}
                  />
                </div>
              ))}
              
              <div className="classic-erp-field classic-erp-field--lg pt-2 border-t border-[var(--border)]">
                <span className="classic-erp-label">ITC:</span>
                <select className="classic-erp-select" value={footer.itcEligibility} onChange={e => setFooter({ ...footer, itcEligibility: e.target.value })} disabled={locked}>
                  <option value="Inputs">Inputs</option>
                  <option value="Capital Goods">Capital Goods</option>
                  <option value="None">None</option>
                </select>
              </div>
            </div>

            <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
              <span className="classic-erp-frame-title">Remarks / Narration</span>
              <textarea 
                className="classic-erp-textarea w-full resize-none text-[12px]" 
                rows={5}
                value={footer.remarks} 
                onChange={e => setFooter({ ...footer, remarks: e.target.value })} 
                disabled={locked}
                placeholder="Optional purchase details or remarks..."
              />
            </div>

            <div className="col-span-4 classic-erp-frame classic-erp-stack p-2 bg-[var(--accent-light)] pb-3">
              <div className="classic-erp-total-row font-bold">
                <span className="classic-erp-label text-slate-800">Taxable Amt:</span>
                <span className="font-mono text-black">₹{calculations.taxable.toFixed(2)}</span>
              </div>

              {header.type === 'INVOICE IN STATE' ? (
                <>
                  <div className="classic-erp-total-row font-bold">
                    <span className="classic-erp-label text-slate-800">CGST (2.5%):</span>
                    <span className="font-mono text-black">₹{(calculations.gstAmt / 2).toFixed(2)}</span>
                  </div>
                  <div className="classic-erp-total-row font-bold">
                    <span className="classic-erp-label text-slate-800">SGST (2.5%):</span>
                    <span className="font-mono text-black">₹{(calculations.gstAmt / 2).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="classic-erp-total-row font-bold">
                  <span className="classic-erp-label text-slate-800">IGST (5%):</span>
                  <span className="font-mono text-black">₹{calculations.gstAmt.toFixed(2)}</span>
                </div>
              )}

              <div className="classic-erp-adj-row font-bold">
                <span className="classic-erp-label text-slate-800">RCM:</span>
                <select
                  className="classic-erp-select text-center font-bold"
                  value={footer.rcmChargeSign}
                  onChange={e => setFooter({ ...footer, rcmChargeSign: e.target.value })}
                  disabled={locked}
                >
                  <option value="-">-</option>
                  <option value="+">+</option>
                </select>
                <input
                  type="number"
                  className="classic-erp-input text-right font-mono"
                  value={footer.rcmCharge}
                  onChange={e => setFooter({ ...footer, rcmCharge: Number(e.target.value) })}
                  disabled={locked}
                />
              </div>

              <div className="classic-erp-total-row font-bold border-t border-[var(--border)] pt-1">
                <span className="classic-erp-label text-slate-800">Gross Amt:</span>
                <span className="font-mono text-black">₹{calculations.gross.toFixed(2)}</span>
              </div>

              <div className="classic-erp-total-row font-bold">
                <span className="classic-erp-label text-slate-800">Total Add:</span>
                <span className="font-mono text-green-700">₹{calculations.totalAdd.toFixed(2)}</span>
              </div>

              <div className="classic-erp-total-row font-bold">
                <span className="classic-erp-label text-slate-800">Total Less:</span>
                <span className="font-mono text-red-700">₹{calculations.totalLess.toFixed(2)}</span>
              </div>

              <div className="classic-erp-total-row font-bold">
                <span className="classic-erp-label text-slate-800">Round Off:</span>
                <input
                  type="number"
                  className="classic-erp-input w-24 text-right font-mono"
                  value={footer.roundOff}
                  onChange={e => setFooter({ ...footer, roundOff: Number(e.target.value) })}
                  disabled={locked}
                />
              </div>

              <div className="classic-erp-total-row font-bold pt-2 border-t-2 border-[#000] mt-1">
                <span className="classic-erp-label text-blue-900 text-sm">NET AMOUNT:</span>
                <span className="font-mono text-blue-900 text-lg shrink-0">₹{calculations.net.toFixed(2)}</span>
              </div>
            </div>

          </div>

        </div>

        {/* Form Footer Action Toolbar */}
        <div className="classic-erp-form-footer">
          <button className="classic-erp-btn" type="button" onClick={handleNew} disabled={readOnly || mode !== 'View' || saving}>New</button>
          <button className="classic-erp-btn btn-blue" type="button" data-enter-save onClick={handleSave} disabled={locked || saving || bootLoading}>
            <SaveButtonLabel saving={saving} />
          </button>
          <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked || saving}>Cancel</button>
          <button className="classic-erp-btn" type="button" onClick={() => setMode('View')} disabled={readOnly || mode === 'View' || saving}>Find</button>
          <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || locked || saving || !selectedPurchaseId}>Delete</button>
          <button
            className="classic-erp-btn btn-blue"
            type="button"
            onClick={() => selectedPurchaseId && setPrintInvoiceId(selectedPurchaseId)}
            disabled={!selectedPurchaseId}
          >
            PDF / Print
          </button>
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

    {typeof document !== 'undefined' && saveNextActions && createPortal(
      <BillSaveNextActions
        open
        title="Purchase Saved"
        invoiceNo={saveNextActions.invoiceNo}
        offlinePending={saveNextActions.offlinePending}
        actions={nextStepActions}
        onPdf={() => {
          if (saveNextActions.id) setPrintInvoiceId(saveNextActions.id);
        }}
        onPrint={() => {
          if (saveNextActions.id) setPrintInvoiceId(saveNextActions.id);
        }}
        onWhatsApp={() => {
          const inv = saveNextActions.invoice || purchases.find((p) => p._id === saveNextActions.id || p.id === saveNextActions.id);
          if (!inv) return;
          const party = resolveParty(inv.supplierId, parties);
          openWhatsAppShare(buildWhatsAppMessage({ type: 'purchase', invoice: inv, party }), party?.phone || party?.mobile);
        }}
        onNew={() => {
          setSaveNextActions(null);
          handleNew();
        }}
        onClose={() => setSaveNextActions(null)}
      />,
      document.body
    )}

    {typeof document !== 'undefined' && printInvoiceId && createPortal(
      <PurchasePrint invoiceId={printInvoiceId} onClose={() => setPrintInvoiceId(null)} />,
      document.body
    )}
    </>
  );
};

export default PurchaseModal;
