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
import ErpWindowControls from '../../components/erp/ErpWindowControls';
import useErpWindow from '../../hooks/useErpWindow';
import { erpConfirm } from '../../utils/confirm';
import { resolveParty, buildWhatsAppMessage, openWhatsAppShare } from '../../utils/invoiceHelpers';
import { getFocusableElements } from '../../utils/formEnterNavigation';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import useConfigStore from '../../store/useConfigStore';
import { resolveInvoiceSupplyType } from '../../utils/gstStateCodes';
import { money, lineTaxable } from '../../utils/salesBillCalc';
import PcsBreakdownModal from '../sales/PcsBreakdownModal';

const today = () => new Date().toISOString().split('T')[0];
const DEFAULT_UNITS = ['PCS', 'KGS', 'NETQTY', 'QTY'];

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
  foldDeductionAmt: 0,
  foldLessAmt: 0,
  foldAddAmt: 0,
  dis1Per: 0,
  dis1Amt: 0,
  dis2Per: 0,
  dis2Amt: 0,
  addAmt: 0,
  gstPer: 0,
  gstAmt: 0,
});

const PurchaseModal = ({
  isOpen,
  onClose,
  selectedBook = null,
  readOnly = false,
  onOpenSales,
  onOpenJobIssue,
  onOpenMillIssue
}) => {
  const { parties, items, purchases, addPurchase, updatePurchase, deletePurchase, fetchParties, fetchItems, fetchPurchases, plan, user } = useStore();
  const { bundle } = useConfig();
  const companySettings = useConfigStore((s) => s.companySettings);
  const { showBroker } = resolvePurchaseFieldVisibility(bundle, user, plan);
  const [mode, setMode] = useState('View');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const locked = readOnly || mode === 'View';
  const [error, setError] = useState('');
  const [saveNextActions, setSaveNextActions] = useState(null);
  const [printInvoiceId, setPrintInvoiceId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const openedOnceRef = useRef(false);
  const modalContainerRef = useRef(null);
  const suppBillRef = useRef(null);
  const lastEnterRef = useRef({ time: 0, idx: -1 });

  const [pcsBreakdown, setPcsBreakdown] = useState({ open: false, lineIdx: -1, calcType: 'Mts' });

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

  const win = useErpWindow(isOpen, {
    id: 'purchase',
    title: `Purchase Invoice [ ${header.book || selectedBook || 'PURCHASE BOOK'} ]`,
    onClose,
  });

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', desc: '', fold: 0, cut: 0, pcs: 0, mts: 0, rate: 0, unit: 'MTRS', amount: 0, foldDeductionAmt: 0, foldLessAmt: 0, foldAddAmt: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, addAmt: 0, gstPer: 0, gstAmt: 0 }
  ]);
  const [extraUnits, setExtraUnits] = useState([]);

  const sumPcsDetails = (details) => {
    const rows = Array.isArray(details) ? details : [];
    const pcs = rows.reduce((s, r) => s + (Number(r.pcs ?? r.qty) || 0), 0);
    const netQty = rows.reduce((s, r) => {
      const rowPcs = Number(r.pcs ?? r.qty) || 0;
      const qtyBndl = Number(r.qtyBndl ?? r.qtyPerBndl) || 0;
      if (rowPcs > 0 && qtyBndl > 0) return s + rowPcs * qtyBndl;
      return s + (Number(r.netQty ?? r.kgs) || 0);
    }, 0);
    return { pcs, netQty: Number(netQty.toFixed(3)), kgs: Number(netQty.toFixed(3)), qty: pcs };
  };

  const openPcsBreakdown = (idx) => {
    const unit = String(gridItems[idx]?.unit || '').toUpperCase();
    let ct = 'Mts';
    if (['PCS', 'PC', 'NOS', 'NO'].includes(unit)) ct = 'Pcs';
    else if (unit === 'KGS' || unit === 'KG') ct = 'Kgs';
    else if (unit === 'MTRS' || unit === 'MTS' || unit === 'NETQTY' || unit === 'QTY') ct = 'Mts';
    ct = gridItems[idx]?._calcType || ct;
    setPcsBreakdown({ open: true, lineIdx: idx, calcType: ct });
  };

  const handlePcsBreakdownSave = (details, calcType = 'Mts') => {
    const idx = pcsBreakdown.lineIdx;
    if (idx < 0) return;
    const { pcs, netQty } = sumPcsDetails(details);

    let newUnit = gridItems[idx]?.unit || 'MTRS';
    let newMts = gridItems[idx]?.mts || 0;
    let newPcs = pcs > 0 ? pcs : (gridItems[idx]?.pcs || 0);

    if (calcType === 'Pcs') {
      newUnit = 'PCS';
      newPcs = netQty > 0 ? netQty : pcs;
      newMts = 0;
    } else if (calcType === 'Kgs') {
      newUnit = 'KGS';
      newPcs = pcs > 0 ? pcs : (gridItems[idx]?.pcs || 0);
      newMts = netQty > 0 ? netQty : (gridItems[idx]?.mts || 0);
    } else {
      newUnit = 'MTRS';
      newPcs = pcs > 0 ? pcs : (gridItems[idx]?.pcs || 0);
      newMts = netQty > 0 ? netQty : (gridItems[idx]?.mts || 0);
    }

    patchLine(idx, {
      pcsDetails: details,
      pcs: newPcs,
      mts: newMts,
      unit: newUnit,
      _calcType: calcType,
      _mtsManual: true,
      _amountManual: false,
    }, 'pcsDetails');
    setPcsBreakdown({ open: false, lineIdx: -1, calcType: 'Mts' });
  };

  const lineQty = (row) => {
    const unit = String(row?.unit || 'MTRS').toUpperCase();
    if (['PCS', 'PC', 'NOS', 'NO'].includes(unit)) {
      return Number(row?.pcs || 0);
    }
    if (['KGS', 'KG'].includes(unit)) {
      return Number(row?.mts || row?.kgs || row?.netQty || row?.pcs || 0);
    }
    return Number(row?.mts || 0);
  };

  const computeLine = (row, fieldChanged = '') => {
    let cut = Number(row.cut) || 0;
    let pcs = Number(row.pcs) || 0;
    let mts = Number(row.mts) || 0;

    if (fieldChanged === 'cut' || fieldChanged === 'pcs' || fieldChanged === 'itemId') {
      if (cut > 0 && pcs > 0) {
        mts = Number((cut * pcs).toFixed(3));
      }
    } else if (fieldChanged !== 'mts' && !row._mtsManual) {
      if (cut > 0 && pcs > 0) {
        mts = Number((cut * pcs).toFixed(3));
      }
    }

    const rate = Number(row.rate) || 0;
    const qty = lineQty({ ...row, pcs, mts });
    const unit = String(row.unit || 'MTRS').toUpperCase();
    const isNetQty = unit === 'NETQTY';
    const isQty = unit === 'QTY';

    // Step 1: Gross amount from qty × rate
    const grossAmt = qty > 0 && rate > 0 ? Number((qty * rate).toFixed(2)) : Number(row.amount || 0);

    // Step 2 (NETQTY only): Apply fold % reduction BEFORE discounts.
    let foldDeductionAmt = 0;
    let foldLessAmt = 0;
    let foldAddAmt = 0;
    let baseAmt = grossAmt;
    if (isNetQty && !row._amountManual) {
      const fold = Number(row.fold || 0);
      foldDeductionAmt = Number(((grossAmt * (100 - fold)) / 100).toFixed(2));
      baseAmt = Number((grossAmt - foldDeductionAmt).toFixed(2));
    }

    // Step 2b (QTY unit only): Fold Less / Fold Add
    if (isQty && !row._amountManual) {
      const fold = Number(row.fold ?? 100);
      if (fold < 100) {
        foldLessAmt = Number(((grossAmt * (100 - fold)) / 100).toFixed(2));
        baseAmt = Number((grossAmt - foldLessAmt).toFixed(2));
      } else if (fold > 100) {
        foldAddAmt = Number(((grossAmt * (fold - 100)) / 100).toFixed(2));
        baseAmt = Number((grossAmt + foldAddAmt).toFixed(2));
      }
    }

    // Step 3: amount stored on row
    //   QTY unit  → always GROSS (Meter × Rate)
    //   NETQTY unit → net (foldDeductionAmt already subtracted)
    const amount = row._amountManual
      ? Number(row.amount || 0)
      : isQty
        ? grossAmt
        : baseAmt;

    // Step 4: Discounts applied on fold-adjusted baseAmt (QTY) or amount (others)
    const discountBase = isQty ? baseAmt : amount;
    const dis1Per = Number(row.dis1Per) || 0;
    const dis1Amt = dis1Per > 0 && !row._dis1Manual
      ? Number(((discountBase * dis1Per) / 100).toFixed(2))
      : Number(row.dis1Amt) || 0;

    const dis2Per = Number(row.dis2Per) || 0;
    const dis2Amt = dis2Per > 0 && !row._dis2Manual
      ? Number((((discountBase - dis1Amt) * dis2Per) / 100).toFixed(2))
      : Number(row.dis2Amt) || 0;

    const addAmt = Number(row.addAmt) || 0;
    const taxable = Number((discountBase - dis1Amt - dis2Amt + addAmt).toFixed(2));

    const gstPer = Number(row.gstPer) || 0;
    const gstAmt = gstPer > 0
      ? Number(((taxable * gstPer) / 100).toFixed(2))
      : Number(row.gstAmt) || 0;

    return {
      ...row,
      cut,
      pcs,
      mts,
      amount,
      foldDeductionAmt,
      foldLessAmt,
      foldAddAmt,
      dis1Per,
      dis1Amt,
      dis2Per,
      dis2Amt,
      addAmt,
      gstPer,
      gstAmt,
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
      .catch(() => { })
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
        try { suppBillRef.current.select(); } catch { }
      } else if (modalContainerRef.current) {
        const focusables = getFocusableElements(modalContainerRef.current);
        if (focusables.length > 0) {
          focusables[0].focus();
          if (typeof focusables[0].select === 'function') {
            try { focusables[0].select(); } catch { }
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
    const purId = pur._id || pur.id || '';
    if (purId) setSelectedPurchaseId(purId);
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
      type: pur.invoiceType || (pur.gstType === 'IGST' ? 'INVOICE OUT OF STATE' : 'INVOICE IN STATE'),
      gstType: pur.gstType || 'CGST+SGST',
      reverseCharge: pur.reverseCharge || 'No',
      warehouseId: pur.warehouseId?._id || pur.warehouseId || ''
    });

    setGridItems(pur.items.map((item, idx) => ({
      id: idx + 1,
      itemId: item.itemId?._id || item.itemId || '',
      itemName: item.itemId?.itemName || item.itemName || '',
      desc: item.desc || '',
      fold: item.fold || 0,
      cut: item.cut || 0,
      pcs: item.pcs || 0,
      mts: item.mts || 0,
      rate: item.rate || 0,
      unit: item.unit || item.itemId?.unit || 'MTRS',
      amount: item.amount || 0,
      foldDeductionAmt: item.foldDeductionAmt || 0,
      foldLessAmt: item.foldLessAmt || 0,
      foldAddAmt: item.foldAddAmt || 0,
      dis1Per: item.dis1Per || 0,
      dis1Amt: item.dis1Amt || 0,
      dis2Per: item.dis2Per || 0,
      dis2Amt: item.dis2Amt || 0,
      addAmt: item.addAmt || 0,
      gstPer: item.gstPer || 0,
      gstAmt: item.gstAmt || 0,
      pcsDetails: Array.isArray(item.pcsDetails) ? item.pcsDetails : [],
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
      rdAmt: pur.rdAmt || 0,
      tcsRate: pur.tcsRate || 0,
      tcsAmt: pur.tcsAmt || 0,
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

  /** Real running total — sum of this party's past purchases (already loaded in the store), excludes cancelled/this same open bill. */
  const partyTotalPurchase = useMemo(() => {
    if (!header.party) return 0;
    return (purchases || [])
      .filter((p) => {
        const pid = p.supplierId?._id || p.supplierId;
        if (String(pid) !== String(header.party)) return false;
        if (p.status === 'cancelled') return false;
        if (selectedPurchaseId && String(p._id || p.id) === String(selectedPurchaseId)) return false;
        return true;
      })
      .reduce((sum, p) => sum + (Number(p.netAmount) || 0), 0);
  }, [purchases, header.party, selectedPurchaseId]);

  const calculations = useMemo(() => {
    let gross = 0;
    let linesTaxable = 0;
    let linesGst = 0;
    let linesGstBase = 0;

    gridItems.forEach((item) => {
      gross = money(gross + money(item.amount));
      linesTaxable = money(linesTaxable + lineTaxable(item));
      linesGst = money(linesGst + money(item.gstAmt));

      const unit = String(item.unit || 'MTRS').toUpperCase();
      const isQty = unit === 'QTY';
      let rowBase = money(item.amount);
      if (isQty) {
        rowBase = money(rowBase - money(item.foldLessAmt) + money(item.foldAddAmt));
      }
      const dis1 = money(item.dis1Amt);
      const dis2 = money(item.dis2Amt);
      const add = money(item.addAmt);
      linesGstBase = money(linesGstBase + money(rowBase - dis1 - dis2 + add));
    });

    let totalAdd = 0;
    let totalLess = 0;
    const adjust = (val, sign) => {
      const parsed = money(val);
      if (sign === '+') {
        totalAdd = money(totalAdd + parsed);
        return parsed;
      }
      totalLess = money(totalLess + parsed);
      return money(-parsed);
    };

    let taxable = linesTaxable;
    taxable = money(taxable + adjust(footer.discountAmt, footer.discountSign));
    taxable = money(taxable + adjust(footer.lessAmt, footer.lessSign));
    taxable = money(taxable + adjust(footer.addAmt, footer.addSign));
    taxable = money(taxable + adjust(footer.octroi, footer.octroiSign));
    totalLess = money(totalLess + money(footer.rdAmt));
    taxable = money(taxable - money(footer.rdAmt));
    if (taxable < 0) taxable = 0;

    const isUnregistered = /UNREGISTERED/i.test(header.type || '');
    const isOutOfState = (header.type || '').includes('OUT OF STATE');

    // Footer adjustments (Discount/Less/Add/Octroi/RD Amt) change the Taxable Amount, so GST
    // must scale with it too — otherwise Octroi only affects the displayed total, not the tax,
    // and the on-screen preview won't match what the server actually saves.
    const gstAmt = isUnregistered
      ? 0
      : linesGstBase > 0
        ? money(linesGst * (taxable / linesGstBase))
        : linesGst;
    const cgst = isOutOfState ? 0 : money(gstAmt / 2);
    const sgst = isOutOfState ? 0 : money(gstAmt / 2);
    const igst = isOutOfState ? gstAmt : 0;

    const rcmVal = money(footer.rcmCharge);
    const rcmDelta = footer.rcmChargeSign === '+' ? rcmVal : money(-rcmVal);
    if (rcmVal) {
      if (footer.rcmChargeSign === '+') totalAdd = money(totalAdd + rcmVal);
      else totalLess = money(totalLess + rcmVal);
    }

    const tcsAmt = footer.tcsRate > 0 ? money((taxable * footer.tcsRate) / 100) : money(footer.tcsAmt);

    const net = money(taxable + gstAmt + money(footer.roundOff) + rcmDelta + tcsAmt);

    return { gross, taxable, gstAmt, cgst, sgst, igst, net, totalAdd, totalLess, tcsAmt, rcmDelta, isUnregistered, isOutOfState };
  }, [gridItems, footer, header.type]);

  // Auto round-off Net Amount to the nearest rupee (Indian invoicing convention),
  // unless the user has typed a manual override in the Round Off field.
  useEffect(() => {
    if (locked || footer.roundOffManual) return;
    const preRound = Number(
      (calculations.taxable + calculations.gstAmt + calculations.rcmDelta + calculations.tcsAmt).toFixed(2)
    );
    const auto = Number((Math.round(preRound) - preRound).toFixed(2));
    if (Number(footer.roundOff || 0) !== auto) {
      setFooter(prev => ({ ...prev, roundOff: auto }));
    }
  }, [calculations.taxable, calculations.gstAmt, calculations.rcmDelta, calculations.tcsAmt, footer.roundOff, footer.roundOffManual, locked]);

  useEffect(() => {
    if (!isOpen || readOnly || mode === 'View') return;
    if (!warehouses.length || header.warehouseId) return;
    const first = warehouses[0]?._id || warehouses[0]?.id;
    if (first) setHeader((h) => ({ ...h, warehouseId: first }));
  }, [isOpen, readOnly, mode, warehouses, header.warehouseId]);

  // Auto-sync footer fold less/add values based on line items (only when in edit/add mode)
  useEffect(() => {
    if (locked) return;
    let totalFoldLess = 0;
    let totalFoldAdd = 0;
    
    gridItems.forEach(item => {
      const u = String(item.unit || '').toUpperCase();
      if (u === 'QTY') {
        totalFoldLess += Number(item.foldLessAmt || 0);
        totalFoldAdd += Number(item.foldAddAmt || 0);
      }
    });

    setFooter(prev => {
      const updates = {};
      
      // Update LESS
      if (totalFoldLess > 0) {
        updates.lessAmt = Number(totalFoldLess.toFixed(2));
        updates.lessSign = '-';
      } else {
        updates.lessAmt = 0;
      }

      // Update ADD
      if (totalFoldAdd > 0) {
        updates.addAmt = Number(totalFoldAdd.toFixed(2));
        updates.addSign = '+';
      } else {
        updates.addAmt = 0;
      }

      // Avoid infinite loop / redundant state updates
      if (prev.lessAmt !== updates.lessAmt || 
          prev.lessSign !== updates.lessSign || 
          prev.addAmt !== updates.addAmt || 
          prev.addSign !== updates.addSign) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [gridItems, locked]);

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
    if (inlineModal.rowIndex == null) return;
    patchLine(inlineModal.rowIndex, {
      itemId: newItem._id || newItem.id,
      itemName: newItem.itemName || newItem.name || '',
      rate: newItem.purRate || newItem.purchaseRate || 0,
      unit: String(newItem.unit || 'MTRS').toUpperCase(),
      gstPer: Number(newItem.gstRate || 0),
    });
  };

  const handleNew = () => {
    setSelectedPurchaseId('');
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
    setGridItems([blankLine()]);
    setFooter({
      discountAmt: 0,
      discountSign: '-',
      lessAmt: 0,
      lessSign: '-',
      addAmt: 0,
      addSign: '+',
      octroi: 0,
      octroiSign: '+',
      rdAmt: 0,
      tcsRate: 0,
      tcsAmt: 0,
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
        invoiceType: header.type,
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
        rdAmt: footer.rdAmt,
        tcsRate: footer.tcsRate,
        tcsAmt: calculations.tcsAmt,
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
          unit: i.unit || 'MTRS',
          foldDeductionAmt: Number(i.foldDeductionAmt || 0),
          foldLessAmt: Number(i.foldLessAmt || 0),
          foldAddAmt: Number(i.foldAddAmt || 0),
          dis1Per: Number(i.dis1Per || 0),
          dis1Amt: Number(i.dis1Amt || 0),
          dis2Per: Number(i.dis2Per || 0),
          dis2Amt: Number(i.dis2Amt || 0),
          addAmt: Number(i.addAmt || 0),
          gstPer: Number(i.gstPer || 0),
          gstAmt: Number(i.gstAmt || 0),
          pcsDetails: Array.isArray(i.pcsDetails) ? i.pcsDetails : [],
        })),
        taxableAmount: calculations.taxable,
        gstAmount: calculations.gstAmt,
        netAmount: calculations.net,
        gstType: (header.type || '').includes('OUT OF STATE') ? 'IGST' : 'CGST+SGST',
        cgst: calculations.cgst,
        sgst: calculations.sgst,
        igst: calculations.igst,
      };

      let targetId = selectedPurchaseId;
      if (!targetId && header.billNo && header.billNo !== 'AUTO') {
        const existingBill = (purchases || []).find((s) => String(s.supplierInvoiceNo || s.invoiceNo || '').trim() === String(header.billNo || '').trim());
        if (existingBill) {
          targetId = existingBill._id || existingBill.id;
        }
      }
      const isUpdating = !!targetId || mode === 'Edit';

      const saved = isUpdating && targetId
        ? await updatePurchase(targetId, payload)
        : await addPurchase(payload);
      const savedId = saved?._id || saved?.id || targetId;
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

  const unitOptions = useMemo(() => {
    const fromItems = items.map((i) => String(i.unit || '').trim().toUpperCase()).filter(Boolean);
    const fromLines = gridItems.map((r) => String(r.unit || '').trim().toUpperCase()).filter(Boolean);
    const all = [...DEFAULT_UNITS, ...fromItems, ...fromLines, ...extraUnits.map((u) => String(u).toUpperCase())];
    return [...new Set(all)]
      .filter((u) => u !== 'MTRS' && u !== 'ROLL')
      .map((u) => ({ value: u, label: u }));
  }, [items, gridItems, extraUnits]);

  const handleCreateUnit = (name, idx) => {
    const u = String(name || '').trim().toUpperCase();
    if (!u) return;
    setExtraUnits((prev) => (prev.includes(u) ? prev : [...prev, u]));
    patchLine(idx, { unit: u });
    toast.success(`Unit "${u}" added`);
  };

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
    patchLine(idx, {
      itemId: val,
      itemName: item?.itemName || item?.name || '',
      cut: Number(item?.cut || gridItems[idx].cut || 0),
      rate: item?.purRate || item?.purchaseRate || 0,
      unit: String(item?.unit || 'MTRS').toUpperCase(),
      gstPer: Number(item?.gstRate || 0),
    }, 'itemId');
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
        const ctx = {
          purchaseId: saveNextActions?.id,
          invoiceNo: saveNextActions?.invoiceNo || saveNextActions?.invoice?.invoiceNo,
          lotCodes: (saveNextActions?.invoice?.items || [])
            .map((i) => i.lotId)
            .filter(Boolean),
        };
        setSaveNextActions(null);
        onOpenMillIssue(ctx);
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
            <ErpBusyOverlay show={bootLoading} message="Loading purchase bill…" />
            <ErpBusyOverlay show={!bootLoading && saving} message="Saving purchase…" />
            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">Purchase Invoice [ {header.book} ]</span>
              <ErpWindowControls
                isMaximized={win.isMaximized}
                onMinimize={win.minimize}
                onToggleMax={win.toggleMax}
                onClose={onClose}
              />
            </div>

            <div ref={modalContainerRef} className="classic-erp-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden erp-bill-layout">
              {mode === 'View' && (
                <div className="classic-erp-frame flex gap-2 items-center shrink-0">
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
                <div className="shrink-0 erp-autofill-bar">
                  <BillAutoFill
                    parties={parties}
                    items={items}
                    disabled={locked}
                    onApply={handleBillAutoApply}
                    onMastersChanged={async () => {
                      await Promise.all([fetchParties(), fetchItems()]);
                    }}
                  />
                </div>
              )}

              {/* Vendor left | Bill + Challan right (same as sales) */}
              <div className="classic-erp-frame classic-erp-header-split erp-sales-top shrink-0">
                <div className="classic-erp-stack classic-erp-header-bill">
                  <div className="classic-erp-meta-grid erp-sales-bill-meta">
                    <div className="classic-erp-field">
                      <span className="classic-erp-label red-label">Supp. Bill *:</span>
                      <input ref={suppBillRef} type="text" className="classic-erp-input" value={header.billNo} placeholder="Supp Bill No…" onChange={e => setHeader({ ...header, billNo: e.target.value })} disabled={locked} />
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Date *:</span>
                      <input type="date" className="classic-erp-input" value={header.billDate} onChange={e => setHeader({ ...header, billDate: e.target.value })} disabled={locked} />
                    </div>
                  </div>
                  <div className="classic-erp-meta-grid erp-sales-ref-meta">
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Voucher:</span>
                      <input type="text" className="classic-erp-input" value={header.vNo} readOnly />
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

                <div className="classic-erp-stack classic-erp-header-party">
                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label red-label">Vendor *:</span>
                    <div className="classic-erp-control" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ERPCombobox
                        value={header.party}
                        onChange={onVendorSelect}
                        options={vendorOptions}
                        placeholder="Search vendor / supplier…"
                        disabled={locked}
                        recentKey="purchase-vendor"
                        onCreateNew={!locked ? (q) => handleCreateAccount(q) : undefined}
                        createLabel="Vendor"
                        inputClassName="border-0 flex-1"
                      />
                      {!locked && (
                        <button type="button" title="Add new vendor" onClick={() => handleCreateAccount('')}
                          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: '#fff', background: '#16a34a', border: 'none', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <Plus size={10} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="classic-erp-meta-grid erp-sales-party-meta">
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Gstin:</span>
                      <input type="text" className="classic-erp-input" value={header.gstin} readOnly />
                    </div>
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">City:</span>
                      <input type="text" className="classic-erp-input" value={header.city} readOnly />
                    </div>
                  </div>
                  <div className="classic-erp-meta-grid--3 erp-sales-broker-row">
                    {showBroker ? (
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">Broker:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
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
                              style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: '#fff', background: '#16a34a', border: 'none', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <Plus size={10} /> Add
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
                      <span className="classic-erp-label">Type *:</span>
                      <select className="classic-erp-select" value={header.type} onChange={e => setHeader({ ...header, type: e.target.value })} disabled={locked}>
                        <option value="INVOICE IN STATE">INVOICE IN STATE</option>
                        <option value="INVOICE OUT OF STATE">INVOICE OUT OF STATE</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="classic-erp-table-container erp-grid-panel erp-sales-grid min-h-0">
                <table className="classic-erp-table">
                  <thead>
                    <tr>
                      <th className="col-sr text-center">Sr</th>
                      <th className="col-item">Item Name *</th>
                      <th className="col-desc">Desc</th>
                      <th className="col-num text-center">Fold</th>
                      <th className="col-num text-center">Cut</th>
                      <th className="col-num text-center">Pcs</th>
                      <th className="col-qty text-center">Qty</th>
                      <th className="col-qty text-right">Rate</th>
                      <th className="col-unit text-center">Per/Unit</th>
                      <th className="col-amt text-right">Amount</th>
                      <th className="col-pct text-center">DIS1%</th>
                      <th className="col-amt text-right">DISAMT</th>
                      <th className="col-pct text-center">DIS2%</th>
                      <th className="col-amt text-right">DISAMT.</th>
                      <th className="col-amt text-right">AddAmt</th>
                      <th className="col-pct text-center">GST%</th>
                      <th className="col-amt text-right">GSTAmt</th>
                      <th className="col-del"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridItems.map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td className="col-sr text-center font-bold">{idx + 1}</td>
                        <td className="col-item" style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
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
                                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: '2px 5px', fontSize: 10, fontWeight: 700, color: '#16a34a', background: 'transparent', border: '1px solid #16a34a', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <Plus size={10} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="col-desc">
                          <input type="text" className="classic-erp-input w-full border-0" value={row.desc || ''} onChange={e => patchLine(idx, { desc: e.target.value })} disabled={locked} />
                        </td>
                        <td className="col-num">
                          <input type="number" className="classic-erp-input w-full text-center border-0" value={row.fold || ''} onChange={e => patchLine(idx, { fold: Number(e.target.value) })} disabled={locked} />
                          {String(row.unit || '').toUpperCase() === 'QTY' && (row.foldLessAmt || 0) > 0 && (
                            <span
                              className="block text-center font-mono leading-none"
                              style={{ fontSize: 9, color: '#c2410c', paddingTop: 1 }}
                              title={`Fold Less: ${(row.foldLessAmt || 0).toFixed(2)} deducted from Taxable`}
                            >
                              less {(row.foldLessAmt || 0).toFixed(2)}
                            </span>
                          )}
                          {String(row.unit || '').toUpperCase() === 'QTY' && (row.foldAddAmt || 0) > 0 && (
                            <span
                              className="block text-center font-mono leading-none"
                              style={{ fontSize: 9, color: '#16a34a', paddingTop: 1 }}
                              title={`Fold Add: ${(row.foldAddAmt || 0).toFixed(2)} added to Taxable`}
                            >
                              add {(row.foldAddAmt || 0).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="col-num">
                          <input type="number" className="classic-erp-input w-full text-center border-0" value={row.cut || ''} onChange={e => patchLine(idx, { cut: Number(e.target.value) || 0, _mtsManual: false }, 'cut')} disabled={locked} placeholder="0" />
                        </td>
                        <td className="col-num">
                          <div className="flex items-center w-full relative">
                            <input
                              type="number"
                              className="classic-erp-input w-full text-center border-0 font-bold"
                              value={row.pcs > 0 ? row.pcs : ''}
                              onChange={e => patchLine(idx, { pcs: Number(e.target.value) || 0, _mtsManual: false }, 'pcs')}
                              onKeyDown={(e) => {
                                if (e.key === '#') {
                                  e.preventDefault();
                                  openPcsBreakdown(idx);
                                } else if (e.key === 'Enter') {
                                  const now = Date.now();
                                  if (lastEnterRef.current.idx === idx && now - lastEnterRef.current.time < 500) {
                                    e.preventDefault();
                                    lastEnterRef.current = { time: 0, idx: -1 };
                                    openPcsBreakdown(idx);
                                  } else {
                                    lastEnterRef.current = { time: now, idx };
                                  }
                                }
                              }}
                              onDoubleClick={() => !locked && openPcsBreakdown(idx)}
                              disabled={locked}
                              min="0"
                              step="1"
                              placeholder="0"
                              title="Double Enter or Double Click on Pcs to open breakdown (or press #)"
                            />
                            {!locked && (
                              <button
                                type="button"
                                onClick={() => openPcsBreakdown(idx)}
                                title="Open detailed Kgs/Pcs breakdown"
                                className="px-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold shrink-0 border-l border-slate-200"
                              >
                                #
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="col-qty">
                          <input type="number" className="classic-erp-input w-full text-center border-0" value={row.mts > 0 ? row.mts : ''} onChange={e => patchLine(idx, { mts: Number(e.target.value) || 0, _mtsManual: true, _amountManual: false }, 'mts')} disabled={locked} min="0" step="0.001" placeholder="0.000" title="Auto = Cut × Pcs. Type to override." />
                        </td>
                        <td className="col-qty">
                          <input type="number" className="classic-erp-input w-full text-right border-0" value={row.rate || ''} onChange={e => patchLine(idx, { rate: Number(e.target.value) })} disabled={locked} />
                        </td>
                        <td className="col-unit">
                          <ERPCombobox
                            value={row.unit || 'MTRS'}
                            onChange={(val) => patchLine(idx, { unit: String(val || 'MTRS').toUpperCase() })}
                            options={unitOptions}
                            placeholder="Unit…"
                            disabled={locked}
                            recentKey="purchase-unit"
                            openOnEnter
                            onCreateNew={!locked ? (q) => handleCreateUnit(q, idx) : undefined}
                            createLabel="Unit"
                            emptyMessage="No unit — type & Create"
                            inputClassName="border-0 text-center"
                          />
                        </td>
                        <td className="col-amt">
                          <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0 font-mono font-bold" value={row.amount || ''} onChange={e => patchLine(idx, { amount: Number(e.target.value) })} disabled={locked} />
                          {String(row.unit || '').toUpperCase() === 'NETQTY' && row.foldDeductionAmt > 0 && (
                            <span
                              className="block text-right font-mono leading-none"
                              style={{ fontSize: 9, color: '#c2410c', paddingRight: 2 }}
                              title={`Fold deduction: Gross ${(row.amount + row.foldDeductionAmt).toFixed(2)} × ${100 - (row.fold || 0)}% = −${row.foldDeductionAmt.toFixed(2)}`}
                            >
                              fold −{row.foldDeductionAmt.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="col-pct">
                          <input type="number" step="0.01" className="classic-erp-input w-full text-center border-0" value={row.dis1Per || ''} onChange={e => patchLine(idx, { dis1Per: Number(e.target.value) })} disabled={locked} />
                        </td>
                        <td className="col-amt">
                          <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0 font-mono text-red-700 font-bold" value={row.dis1Amt || ''} onChange={e => patchLine(idx, { dis1Amt: Number(e.target.value) })} disabled={locked} />
                        </td>
                        <td className="col-pct">
                          <input type="number" step="0.01" className="classic-erp-input w-full text-center border-0" value={row.dis2Per || ''} onChange={e => patchLine(idx, { dis2Per: Number(e.target.value) })} disabled={locked} />
                        </td>
                        <td className="col-amt">
                          <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0 font-mono text-red-700 font-bold" value={row.dis2Amt || ''} onChange={e => patchLine(idx, { dis2Amt: Number(e.target.value) })} disabled={locked} />
                        </td>
                        <td className="col-amt">
                          <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0" value={row.addAmt || ''} onChange={e => patchLine(idx, { addAmt: Number(e.target.value) })} disabled={locked} />
                        </td>
                        <td className="col-pct">
                          <input type="number" step="0.01" className="classic-erp-input w-full text-center border-0" value={row.gstPer || ''} onChange={e => patchLine(idx, { gstPer: Number(e.target.value) })} disabled={locked} />
                        </td>
                        <td className="col-amt">
                          <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0 font-mono font-bold text-blue-800" value={row.gstAmt || ''} onChange={e => patchLine(idx, { gstAmt: Number(e.target.value) })} disabled={locked} />
                        </td>
                        <td className="col-del text-center">
                          <button type="button" onClick={() => {
                            const updated = gridItems.filter((_, i) => i !== idx);
                            setGridItems(updated.length ? updated : [blankLine()]);
                          }} className="text-red-700 hover:text-red-950 p-1" disabled={locked}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center bg-[var(--bg-subtle)] p-1 border border-[var(--border)] rounded-md shrink-0 erp-sales-stockbar">
                <button type="button" onClick={() => setGridItems([...gridItems, blankLine()])} className="classic-erp-btn" disabled={locked}>
                  <Plus size={12} strokeWidth={3} /> Add Line Item
                </button>
                <div className="text-xs font-bold text-black font-mono">
                  TOTAL Pcs: <span className="text-blue-800">{gridItems.reduce((a, b) => a + (Number(b.pcs) || 0), 0)}</span>
                  {' / '}Qty: <span className="text-blue-800">{gridItems.reduce((a, b) => a + (Number(b.mts) || 0), 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-1.5 erp-sales-footer shrink-0">
                <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
                  {[
                    { label: 'DISCOUNT', key: 'discountAmt', signKey: 'discountSign' },
                    { label: 'LESS', key: 'lessAmt', signKey: 'lessSign' },
                    { label: 'ADD', key: 'addAmt', signKey: 'addSign' },
                    { label: 'OCTROI', key: 'octroi', signKey: 'octroiSign' }
                  ].map(adj => (
                    <div key={adj.key} className="classic-erp-adj-row">
                      <span className="classic-erp-label">{adj.label}:</span>
                      <select className="classic-erp-select text-center font-bold" value={footer[adj.signKey]} onChange={e => setFooter({ ...footer, [adj.signKey]: e.target.value })} disabled={locked}>
                        <option value="-">-</option>
                        <option value="+">+</option>
                      </select>
                      <input type="number" className="classic-erp-input text-right" value={footer[adj.key] || ''} onChange={e => setFooter({ ...footer, [adj.key]: Number(e.target.value) })} disabled={locked} />
                    </div>
                  ))}
                  <div className="classic-erp-field classic-erp-field--lg pt-1 border-t border-[var(--border)]">
                    <span className="classic-erp-label">ITC:</span>
                    <select className="classic-erp-select" value={footer.itcEligibility} onChange={e => setFooter({ ...footer, itcEligibility: e.target.value })} disabled={locked}>
                      <option value="Inputs">Inputs</option>
                      <option value="Capital Goods">Capital Goods</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                </div>

                <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
                  <span className="classic-erp-frame-title">Remarks</span>
                  <textarea className="classic-erp-textarea w-full resize-none text-[11px]" rows={4} value={footer.remarks} onChange={e => setFooter({ ...footer, remarks: e.target.value })} disabled={locked} placeholder="Optional remarks…" />
                </div>

                <div className="col-span-4 classic-erp-frame classic-erp-stack p-2 bg-[var(--accent-light)] pb-3">
                  <div className="classic-erp-total-row font-bold">
                    <span className="classic-erp-label text-slate-800">Gross Amt:</span>
                    <span className="font-mono text-black">₹{calculations.gross.toFixed(2)}</span>
                  </div>
                  {Number(footer.foldLess || 0) > 0 && (
                    <div className="classic-erp-total-row font-bold">
                      <span className="classic-erp-label text-orange-700">Fold Less:</span>
                      <span className="font-mono text-orange-700">
                        {footer.foldLessSign === '+' ? '+' : '-'}₹{Number(footer.foldLess).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="classic-erp-total-row font-bold border-t border-[var(--border)] pt-1">
                    <span className="classic-erp-label text-slate-800">Taxable Amt:</span>
                    <span className="font-mono text-black shrink-0">₹{calculations.taxable.toFixed(2)}</span>
                  </div>
                  {header.type === 'INVOICE IN STATE' ? (
                    <>
                      <div className="classic-erp-total-row font-bold">
                        <span className="classic-erp-label text-slate-800">CGST:</span>
                        <span className="font-mono text-black">₹{calculations.cgst.toFixed(2)}</span>
                      </div>
                      <div className="classic-erp-total-row font-bold">
                        <span className="classic-erp-label text-slate-800">SGST:</span>
                        <span className="font-mono text-black">₹{calculations.sgst.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="classic-erp-total-row font-bold">
                      <span className="classic-erp-label text-slate-800">IGST:</span>
                      <span className="font-mono text-black">₹{calculations.igst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="classic-erp-adj-row font-bold">
                    <span className="classic-erp-label text-slate-800">RCM:</span>
                    <select className="classic-erp-select text-center font-bold" value={footer.rcmChargeSign} onChange={e => setFooter({ ...footer, rcmChargeSign: e.target.value })} disabled={locked}>
                      <option value="-">-</option>
                      <option value="+">+</option>
                    </select>
                    <input type="number" className="classic-erp-input text-right font-mono" value={footer.rcmCharge || ''} onChange={e => setFooter({ ...footer, rcmCharge: Number(e.target.value) })} disabled={locked} />
                  </div>
                  <div className="classic-erp-total-row font-bold border-t border-[var(--border)] pt-1">
                    <span className="classic-erp-label text-slate-800">Round Off:</span>
                    <input
                      type="number"
                      step="0.01"
                      className="classic-erp-input w-24 text-right font-mono"
                      value={footer.roundOff}
                      onChange={e => setFooter({ ...footer, roundOff: Number(e.target.value), roundOffManual: true })}
                      disabled={locked}
                      title="Auto-rounded to the nearest rupee. Type to override."
                    />
                  </div>
                  <div className="classic-erp-total-row font-bold pt-2 border-t-2 border-[#000] mt-1">
                    <span className="classic-erp-label text-blue-900 text-sm">NET AMOUNT:</span>
                    <span className="font-mono text-blue-900 text-lg shrink-0">₹{calculations.net.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action bar — outside scroll/window so New/Save never clip */}
          <div className="erp-bill-action-bar shrink-0 flex flex-wrap items-center justify-end gap-1.5 px-2 py-1.5 border-t border-[var(--border)] bg-[var(--bg-base,#f8fafc)]">
            <span className="text-[10px] text-[var(--text-muted)] mr-auto hidden sm:inline">
              Enter → next · Esc close
            </span>
            <button className="classic-erp-btn" type="button" onClick={handleNew} disabled={readOnly || mode !== 'View' || saving}>New</button>
            <button className="classic-erp-btn btn-blue" type="button" data-enter-save onClick={handleSave} disabled={locked || saving || bootLoading}>
              <SaveButtonLabel saving={saving} />
            </button>
            <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked || saving}>Cancel</button>
            <button className="classic-erp-btn" type="button" onClick={() => setMode('View')} disabled={readOnly || mode === 'View' || saving}>Find</button>
            <button className="classic-erp-btn" type="button" onClick={() => setMode('Edit')} disabled={readOnly || mode !== 'View' || !selectedPurchaseId || saving}>Edit</button>
            <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || locked || saving || !selectedPurchaseId}>Delete</button>
            <button className="classic-erp-btn btn-blue" type="button" onClick={() => selectedPurchaseId && setPrintInvoiceId(selectedPurchaseId)} disabled={!selectedPurchaseId}>PDF / Print</button>
            <button className="classic-erp-btn" type="button" onClick={onClose}>Exit</button>
          </div>
        </div>
        {win.mode === 'normal' && (
          <div
            className="erp-window-resize-handle"
            onPointerDown={win.onResizePointerDown}
            title="Drag to resize"
          />
        )}

        <PcsBreakdownModal
          isOpen={pcsBreakdown.open}
          onClose={() => setPcsBreakdown({ open: false, lineIdx: -1, calcType: 'Mts' })}
          rows={pcsBreakdown.lineIdx >= 0 ? gridItems[pcsBreakdown.lineIdx]?.pcsDetails || [] : []}
          initialCalcType={pcsBreakdown.calcType}
          onSave={handlePcsBreakdownSave}
          locked={locked}
        />

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
