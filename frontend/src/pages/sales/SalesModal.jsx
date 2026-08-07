import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { useConfig } from '../../context/ConfigContext';
import { resolveSalesFieldVisibility, buildBillFieldVisibility } from '../../utils/configHelpers';
import { toast } from '../../store/useToastStore';
import { notifyError } from '../../utils/notify';
import { Trash2, Plus } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';
import BillSaveNextActions from '../../components/BillSaveNextActions';
import SalesPrint from './SalesPrint';
import { ERPCombobox } from '../../components/erp';
import ErpWindowControls from '../../components/erp/ErpWindowControls';
import useErpWindow from '../../hooks/useErpWindow';
import { erpConfirm } from '../../utils/confirm';
import { resolveParty, buildWhatsAppMessage, openWhatsAppShare } from '../../utils/invoiceHelpers';
import { getFocusableElements } from '../../utils/formEnterNavigation';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import useConfigStore from '../../store/useConfigStore';
import { calcSalesBillTotals } from '../../utils/salesBillCalc';
import { resolveInvoiceSupplyType } from '../../utils/gstStateCodes';
import PcsBreakdownModal from './PcsBreakdownModal';

const today = () => new Date().toISOString().split('T')[0];
const DEFAULT_UNITS = ['PCS', 'KGS', 'NETQTY', 'QTY'];

/** Per/Unit → which qty drives amount (Rate × qty).
 * For NETQTY: qty = full mts (gross). Fold reduction is applied at the AMOUNT level in computeLine.
 */
const lineQty = (row) => {
  const unit = String(row?.unit || 'MTRS').toUpperCase();
  if (['PCS', 'PC', 'NOS', 'NO'].includes(unit)) {
    return Number(row?.pcs || 0);
  }
  // NETQTY and QTY: use full mts as qty
  if (unit === 'NETQTY' || unit === 'QTY') {
    return Number(row?.mts || 0);
  }
  return Number(row?.mts || 0);
};

const sumPcsDetails = (details = []) => {
  const rows = Array.isArray(details) ? details : [];
  const pcs = rows.reduce((s, r) => s + (Number(r.pcs || r.qty) || 0), 0);
  const netQty = rows.reduce((s, r) => s + (Number(r.netQty || r.kgs) || 0), 0);
  return { pcs, netQty: Number(netQty.toFixed(3)), kgs: Number(netQty.toFixed(3)), qty: pcs };
};

const SalesModal = ({ isOpen, onClose, initialData = null, selectedBook = null, readOnly = false }) => {
  const {
    parties,
    items,
    addSale,
    updateSale,
    deleteSale,
    sales,
    inventoryLots,
    fetchParties,
    fetchItems,
    fetchSales,
    fetchInventory,
    plan,
    user,
  } = useStore();
  const companySettings = useConfigStore((s) => s.companySettings);
  const { bundle } = useConfig();
  const { showBroker, showChallan } = resolveSalesFieldVisibility(bundle, user, plan);
  const billFields = useMemo(() => buildBillFieldVisibility(bundle, 'sales'), [bundle]);
  const [activeItemId, setActiveItemId] = useState('');
  const [mode, setMode] = useState('View');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const locked = readOnly || mode === 'View';
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [saveNextActions, setSaveNextActions] = useState(null);
  const [printInvoiceId, setPrintInvoiceId] = useState(null);
  const openedOnceRef = useRef(false);
  const modalContainerRef = useRef(null);

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

  const win = useErpWindow(isOpen, {
    id: 'sales',
    title: `Sales Invoice [ ${header.book || selectedBook || 'SALES BOOK'} ]`,
    onClose,
  });

  /**
   * Auto-calc amount from mts × rate whenever either changes.
   * If user has manually typed an amount we DON'T override (amountManual flag).
   * dis1Per% → dis1Amt; dis2Per% → dis2Amt auto-fill when pct changes.
   */
  /**
   * Auto-calc Mts from Cut × Pcs, and amount from Mts (or Pcs) × rate whenever either changes.
   * If user has manually typed an amount or mts we DON'T override (amountManual / mtsManual flags).
   * dis1Per% → dis1Amt; dis2Per% → dis2Amt auto-fill when pct changes.
   */
  const computeLine = (row, fieldChanged = '') => {
    let cut = Number(row.cut) || 0;
    let pcs = Number(row.pcs) || 0;
    let mts = Number(row.mts) || 0;

    // Auto-calculate meters from cut * pcs if cut & pcs > 0
    if (fieldChanged === 'cut' || fieldChanged === 'pcs' || fieldChanged === 'itemId') {
      if (cut > 0 && pcs > 0) {
        mts = Number((cut * pcs).toFixed(3));
      }
    } else if (fieldChanged !== 'mts' && !row._mtsManual) {
      if (cut > 0 && pcs > 0) {
        mts = Number((cut * pcs).toFixed(3));
      }
    }

    const rate = Number(row.saleRate) || 0;
    const qty = lineQty({ ...row, pcs, mts });
    const unit = String(row.unit || 'MTRS').toUpperCase();
    const isNetQty = unit === 'NETQTY';
    const isQtyOrPcs = unit === 'QTY' || unit === 'PCS';

    // Step 1: Gross amount from qty × rate
    const grossAmt = qty > 0 && rate > 0 ? Number((qty * rate).toFixed(2)) : Number(row.amount || 0);

    // Step 2 (NETQTY only): Apply fold % reduction BEFORE discounts.
    //   formula: y = grossAmt × (100 - fold) / 100
    //            baseAmt = grossAmt - y
    //   e.g. fold=95, grossAmt=6000 → y=300 → baseAmt=5700
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
    //   Amount column always shows GROSS (Meter × Rate).
    //   baseAmt (used for discounts / GST / taxable) is adjusted by fold:
    //     fold = 100 → no adjustment
    //     fold < 100 → foldLessAmt = grossAmt × (100 − fold) / 100; baseAmt = grossAmt − foldLessAmt
    //     fold > 100 → foldAddAmt  = grossAmt × (fold − 100) / 100; baseAmt = grossAmt + foldAddAmt
    if (unit === 'QTY' && !row._amountManual) {
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
    //   QTY/PCS unit  → always GROSS (Meter/Pcs × Rate); fold adjustment shown in foldLessAmt / foldAddAmt
    //   All others → fold-reduced base (or manual override)
    const amount = row._amountManual
      ? Number(row.amount || 0)
      : isQtyOrPcs
        ? grossAmt
        : baseAmt;

    // Step 4: Discounts applied on fold-adjusted baseAmt (QTY/PCS) or amount (others)
    const discountBase = isQtyOrPcs ? baseAmt : amount;
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
      foldDeductionAmt,
      foldLessAmt,
      foldAddAmt,
      amount,
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

  const recalcLine = (row) => {
    const cut = Number(row.cut || 0);
    const pcs = Number(row.pcs || 0);
    const mts = Number(row.mts || 0);
    const isAutoMts = cut > 0 && pcs > 0 && Math.abs(mts - Number((cut * pcs).toFixed(3))) < 0.001;
    return computeLine({
      ...row,
      _amountManual: Number(row.amount || 0) > 0,
      _mtsManual: mts > 0 && !isAutoMts,
      amount: Number(row.amount || 0),
      dis1Per: Number(row.dis1Per || 0),
      dis1Amt: Number(row.dis1Amt || 0),
      dis2Per: Number(row.dis2Per || 0),
      dis2Amt: Number(row.dis2Amt || 0),
      addAmt: Number(row.addAmt || 0),
      gstPer: Number(row.gstPer || 0),
      gstAmt: Number(row.gstAmt || 0),
    });
  };

  const blankLine = () => ({
    id: Date.now(),
    itemId: '',
    itemName: '',
    desc: '',
    fold: 0,
    cut: 0,
    pcs: 0,
    mts: 0,
    saleRate: 0,
    unit: 'MTRS',
    mrp: 0,
    rdPer: 0,
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
    pcsDetails: [],
  });

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', desc: '', fold: 0, cut: 0, pcs: 0, mts: 0, saleRate: 0, unit: 'MTRS', mrp: 0, rdPer: 0, amount: 0, foldDeductionAmt: 0, foldLessAmt: 0, foldAddAmt: 0, dis1Per: 0, dis1Amt: 0, dis2Per: 0, dis2Amt: 0, addAmt: 0, gstPer: 0, gstAmt: 0, pcsDetails: [] }
  ]);
  const [extraUnits, setExtraUnits] = useState([]);
  const [pcsBreakdown, setPcsBreakdown] = useState({ open: false, lineIdx: -1 });

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
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0
  });

  useEffect(() => {
    const itemWithGst = gridItems.find(item => Number(item.gstPer) > 0);
    if (itemWithGst) {
      const totalGst = Number(itemWithGst.gstPer);
      setGstRates({
        cgstRate: Number((totalGst / 2).toFixed(2)),
        sgstRate: Number((totalGst / 2).toFixed(2)),
        igstRate: totalGst
      });
    } else {
      setGstRates({
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 0
      });
    }
  }, [gridItems]);

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
      fetchSales(),
      fetchInventory(),
    ])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });

    if (!openedOnceRef.current) {
      openedOnceRef.current = true;
      setSaveNextActions(null);
      setPrintInvoiceId(null);
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
    }

    const t = setTimeout(() => {
      if (modalContainerRef.current) {
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
  }, [isOpen, initialData, readOnly, selectedBook, fetchParties, fetchItems, fetchSales, fetchInventory]);

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

    setGridItems(inv.items.map((item, idx) => recalcLine({
      id: idx + 1,
      itemId: item.itemId?._id || item.itemId || '',
      itemName: item.itemName || item.itemId?.itemName || item.itemId?.name || '',
      desc: item.desc || '',
      fold: item.fold || 0,
      cut: item.cut || 0,
      pcs: item.pcs || 0,
      mts: item.mts || 0,
      saleRate: item.rate || 0,
      unit: item.unit || item.itemId?.unit || 'MTRS',
      mrp: item.mrp || 0,
      rdPer: item.rdPer || 0,
      amount: item.amount || 0,
      foldDeductionAmt: item.foldDeductionAmt || 0,
      foldLessAmt: item.foldLessAmt || 0,
      foldAddAmt: item.foldAddAmt || 0,
      dis1Per: item.dis1Per || 0,
      dis1Amt: item.dis1Amt || 0,
      dis2Per: item.dis2Per || 0,
      dis2Amt: item.dis2Amt || 0,
      addAmt: item.addAmt || 0,
      gstPer: item.gstPer ?? item.itemId?.gstRate ?? 0,
      gstAmt: item.gstAmt || 0,
      pcsDetails: Array.isArray(item.pcsDetails) ? item.pcsDetails : [],
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
      
      // Update FOLD LESS
      if (totalFoldLess > 0) {
        updates.foldLess = Number(totalFoldLess.toFixed(2));
        updates.foldLessSign = '-';
      } else {
        updates.foldLess = 0;
      }

      // Update ADD
      if (totalFoldAdd > 0) {
        updates.addAmt = Number(totalFoldAdd.toFixed(2));
        updates.addSign = '+';
      } else {
        updates.addAmt = 0;
      }

      // Avoid infinite loop / redundant state updates
      if (prev.foldLess !== updates.foldLess || 
          prev.foldLessSign !== updates.foldLessSign || 
          prev.addAmt !== updates.addAmt || 
          prev.addSign !== updates.addSign) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [gridItems, locked]);

  const calculations = useMemo(
    () => calcSalesBillTotals(gridItems, footer, header, gstRates),
    [gridItems, footer, header, gstRates]
  );

  // Auto round-off Net Amount to the nearest rupee (Indian invoicing convention),
  // unless the user has typed a manual override in the Round Off field.
  useEffect(() => {
    if (locked || footer.roundOffManual) return;
    const preRound = Number((calculations.taxable + calculations.gstAmt + calculations.tcsAmt).toFixed(2));
    const auto = Number((Math.round(preRound) - preRound).toFixed(2));
    if (Number(footer.roundOff || 0) !== auto) {
      setFooter(prev => ({ ...prev, roundOff: auto }));
    }
  }, [calculations.taxable, calculations.gstAmt, calculations.tcsAmt, footer.roundOff, footer.roundOffManual, locked]);

  const currentItemInfo = useMemo(() => {
    if (!activeItemId) return null;
    return items.find((i) => (i._id || i.id) === activeItemId) || null;
  }, [activeItemId, items]);

  /** Live stock from Inventory lots (Item Master stock fields stay 0 after purchase). */
  const currentItemStock = useMemo(() => {
    if (!activeItemId) {
      return { pcs: 0, mts: 0, lots: 0 };
    }
    const open = (inventoryLots || []).filter((lot) => {
      const lotItemId = lot.itemId?._id || lot.itemId || lot.item_id || '';
      if (String(lotItemId) !== String(activeItemId)) return false;
      const status = String(lot.status || 'Available').toLowerCase();
      if (status === 'closed' || status === 'exhausted' || status === 'reserved') return false;
      return (Number(lot.remainingMtrs ?? lot.mts ?? lot.qty ?? 0) > 0) ||
        (Number(lot.remainingPcs ?? lot.pcs ?? 0) > 0);
    });
    const pcs = open.reduce((s, l) => s + Number(l.remainingPcs ?? l.pcs ?? 0), 0);
    const mts = open.reduce((s, l) => s + Number(l.remainingMtrs ?? l.mts ?? l.qty ?? 0), 0);
    return { pcs, mts: Number(mts.toFixed(3)), lots: open.length };
  }, [activeItemId, inventoryLots]);

  const lotHistory = useMemo(() => {
    if (!activeItemId) return [];
    const rows = [];
    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const iId = item.itemId?._id || item.itemId || '';
        if (iId === activeItemId) {
          rows.push({
            billNo: sale.invoiceNo,
            billDt: sale.date,
            cut: item.cut || 0,
            pcs: item.pcs || 0,
            qty: item.mts || 0,
            rate: item.rate || 0,
            mrp: item.mrp || 0,
            amount: item.amount || 0,
            fold: item.fold || 0,
            rdPer: item.rdPer || 0,
            dis1Per: item.dis1Per || 0,
            dis2Per: item.dis2Per || 0,
            dis1Amt: item.dis1Amt || 0,
            dis2Amt: item.dis2Amt || 0,
            party: sale.customerId?.name || ''
          });
        }
      });
    });
    return rows;
  }, [activeItemId, sales]);

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
    setGridItems([blankLine()]);
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
    if (saving) return;
    if (!header.billNo) return toast.error('Bill No is required');
    if (!header.city) return toast.error('City is required');

    const validLines = gridItems.filter((i) => i.itemId || i.desc || Number(i.mts) || Number(i.pcs) || Number(i.saleRate));
    if (validLines.length === 0) {
      return toast.error('Please add at least one item line');
    }
    for (let i = 0; i < validLines.length; i += 1) {
      const line = validLines[i];
      const n = i + 1;
      if (!line.itemId) return toast.error(`Item Name is required on line ${n}`);
      if (!String(line.desc || '').trim()) return toast.error(`Desc is required on line ${n}`);
      if (!(Number(line.pcs) > 0)) return toast.error(`Pcs is required on line ${n}`);
      if (!(Number(line.mts) > 0)) return toast.error(`Mts is required on line ${n}`);
      if (!(Number(line.saleRate) > 0)) return toast.error(`Rate is required on line ${n}`);
    }
    setSaving(true);

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
        items: validLines.map(i => ({
          itemId: i.itemId,
          desc: i.desc,
          fold: Number(i.fold || 0),
          cut: Number(i.cut || 0),
          pcs: Number(i.pcs || 0),
          mts: Number(i.mts || 0),
          rate: Number(i.saleRate || i.rate || 0),
          unit: i.unit || 'MTRS',
          mrp: Number(i.mrp || 0),
          rdPer: Number(i.rdPer || 0),
          amount: Number(i.amount || 0),
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
        gstType: header.type === 'INVOICE OUT OF STATE' ? 'IGST' : 'CGST+SGST',
        cgst: calculations.cgst,
        sgst: calculations.sgst,
        igst: calculations.igst
      };

      const saved =
        mode === 'Edit' && selectedInvoiceId
          ? await updateSale(selectedInvoiceId, payload)
          : await addSale(payload);
      const savedId = saved?._id || saved?.id;
      if (savedId) setSelectedInvoiceId(savedId);
      setSaveNextActions({
        id: savedId,
        invoiceNo: saved?.invoiceNo || header.billNo,
        offlinePending: !!saved?.offlinePending,
        invoice: saved
      });
      setMode('View');
      fetchSales();
    } catch (err) {
      notifyError(err, 'Failed to save sale bill');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const id = initialData?._id || selectedInvoiceId;
    if (!id) return toast.error('Select an invoice to delete');
    if (!(await erpConfirm({
      title: 'Cancel Invoice',
      message: 'Are you sure you want to delete/cancel this invoice?',
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
      try {
        await deleteSale(id);
        toast.success('Invoice deleted/cancelled!');
        handleNew();
        fetchSales();
      } catch (err) {
        toast.error('Failed to delete: ' + (err.response?.data?.message || err.message));
      }
  };

  const handlePrint = () => {
    const id = selectedInvoiceId || initialData?._id || initialData?.id;
    if (!id) return toast.error('Select or save an invoice first');
    setPrintInvoiceId(id);
  };

  const openPdfForSaved = () => {
    if (saveNextActions?.id) setPrintInvoiceId(saveNextActions.id);
  };

  const shareSavedWhatsApp = () => {
    const inv = saveNextActions?.invoice || sales.find((s) => s._id === saveNextActions?.id || s.id === saveNextActions?.id);
    if (!inv) return;
    const party = resolveParty(inv.customerId, parties);
    openWhatsAppShare(buildWhatsAppMessage({ type: 'sale', invoice: inv, party }), party?.phone || party?.mobile);
  };

  const handleCancel = () => {
    const id = selectedInvoiceId || initialData?._id || initialData?.id;
    if (id) {
      const inv = sales.find(s => s._id === id || s.id === id) || initialData;
      if (inv) loadInvoiceData(inv);
    }
    setMode('View');
  };

  const partyOptions = useMemo(
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
        .map((p) => ({
          value: p._id || p.id,
          label: p.name,
          meta: p.mobile || p.phone || '',
        })),
    [parties]
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

  const onPartySelect = (val, opt) => {
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

  const openPcsBreakdown = (idx) => {
    setPcsBreakdown({ open: true, lineIdx: idx });
  };

  const handlePcsBreakdownSave = (details) => {
    const idx = pcsBreakdown.lineIdx;
    if (idx < 0) return;
    const { pcs, netQty } = sumPcsDetails(details);
    patchLine(idx, {
      pcsDetails: details,
      pcs: pcs > 0 ? pcs : gridItems[idx]?.pcs,
      mts: netQty > 0 ? netQty : gridItems[idx]?.mts,
      _mtsManual: true,
      _amountManual: false,
    }, 'pcsDetails');
    setPcsBreakdown({ open: false, lineIdx: -1 });
  };

  const onGridItemSelect = (val, idx) => {
    if (!val) return;
    const item = items.find((i) => (i._id || i.id) === val);
    const gstPer = Number(item?.gstRate ?? gridItems[idx].gstPer ?? 0);
    const unit = String(item?.unit || gridItems[idx].unit || 'MTRS').toUpperCase();
    const cut = Number(item?.cut ?? gridItems[idx].cut ?? 0);
    patchLine(idx, {
      itemId: val,
      itemName: item?.itemName || item?.name || '',
      saleRate: item?.salesRate || gridItems[idx].saleRate || 0,
      gstPer,
      unit,
      cut,
    }, 'itemId');
    setActiveItemId(val);
  };

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
        <ErpBusyOverlay show={bootLoading} message="Loading sales bill…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Saving invoice…" />
        {/* Title Bar */}
        <div className="classic-erp-header shrink-0">
          <span className="erp-window-title truncate">Sales Invoice [ {header.book} ]</span>
          <span className="text-xs font-mono opacity-90 hidden md:inline erp-window-meta">
            T.Sales: <strong>{sales.reduce((a, s) => a + (s.netAmount || 0), 0).toFixed(0)}</strong>
            &nbsp;&nbsp;|
            &nbsp;&nbsp;{new Date().toLocaleDateString('en-IN', { weekday: 'long' })}
          </span>
          <ErpWindowControls
            isMaximized={win.isMaximized}
            onMinimize={win.minimize}
            onToggleMax={win.toggleMax}
            onClose={onClose}
          />
        </div>

        {/* Form Body — scrolls inside; action bar stays fixed below */}
        <div ref={modalContainerRef} className="classic-erp-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden erp-bill-layout">
          
          {mode === 'View' && (
            <div className="classic-erp-frame flex gap-2 items-center shrink-0">
              <span className="classic-erp-label blue-label font-bold">Find Invoice:</span>
              <select className="classic-erp-input flex-1" value={selectedInvoiceId} onChange={handleSelectInvoice}>
                <option value="">- Select Invoice to View/Edit -</option>
                {sales.map(s => (
                  <option key={s._id || s.id} value={s._id || s.id}>Invoice #{s.invoiceNo} - {s.customerId?.name} (₹{s.netAmount?.toFixed(2)})</option>
                ))}
              </select>
            </div>
          )}

          {/* Header: Party (left, wider) | Bill+Challan/Order (right, compact) */}
          <div className="classic-erp-frame classic-erp-header-split erp-sales-top shrink-0">
            <div className="classic-erp-stack classic-erp-header-bill">
              <div className="classic-erp-meta-grid erp-sales-bill-meta">
                <div className="classic-erp-field">
                  <span className="classic-erp-label red-label">Bill No *:</span>
                  <input
                    type="text"
                    className="classic-erp-input"
                    value={header.billNo}
                    onChange={e => setHeader({ ...header, billNo: e.target.value })}
                    disabled={locked}
                    autoFocus={!locked}
                  />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Date *:</span>
                  <input type="date" className="classic-erp-input" value={header.billDate} onChange={e => setHeader({ ...header, billDate: e.target.value })} disabled={locked} />
                </div>
              </div>

              {(showChallan || billFields.header('orderNo') || billFields.header('orderDate')) ? (
                <div className="classic-erp-meta-grid erp-sales-ref-meta">
                  {showChallan ? (
                    <>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">Challan *:</span>
                        <input type="text" className="classic-erp-input" value={header.challanNo} onChange={e => setHeader({ ...header, challanNo: e.target.value })} disabled={locked} />
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">Ch Date *:</span>
                        <input type="date" className="classic-erp-input" value={header.chDate} onChange={e => setHeader({ ...header, chDate: e.target.value })} disabled={locked} />
                      </div>
                    </>
                  ) : null}
                  {billFields.header('orderNo') ? (
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Order No *:</span>
                      <input type="text" className="classic-erp-input" value={header.orderNo} onChange={e => setHeader({ ...header, orderNo: e.target.value })} disabled={locked} />
                    </div>
                  ) : null}
                  {billFields.header('orderDate') ? (
                    <div className="classic-erp-field">
                      <span className="classic-erp-label">Ord Date *:</span>
                      <input type="date" className="classic-erp-input" value={header.orderDate} onChange={e => setHeader({ ...header, orderDate: e.target.value })} disabled={locked} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="classic-erp-stack classic-erp-header-party">
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label red-label">Party *:</span>
                <div className="classic-erp-control" style={{display:'flex',alignItems:'center',gap:4}}>
                  <ERPCombobox
                    value={header.party}
                    onChange={onPartySelect}
                    options={partyOptions}
                    placeholder="Search party / customer…"
                    disabled={locked}
                    recentKey="sales-party"
                    onCreateNew={!locked ? (q) => handleCreateAccount(q) : undefined}
                    createLabel="Party"
                    inputClassName="border-0 flex-1"
                  />
                  {!locked && (
                    <button type="button" title="Add new party" onClick={() => handleCreateAccount('')}
                      style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:2,padding:'2px 6px',fontSize:10,fontWeight:700,color:'#fff',background:'#16a34a',border:'none',borderRadius:3,cursor:'pointer',whiteSpace:'nowrap'}}>
                      <Plus size={10}/> Add
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
                  <span className="classic-erp-label red-label">City *:</span>
                  <input type="text" className="classic-erp-input" value={header.city} onChange={e => setHeader({ ...header, city: e.target.value })} disabled={locked} />
                </div>
              </div>
              <div className="classic-erp-meta-grid--3 erp-sales-broker-row">
                {showBroker ? (
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Broker:</span>
                    <div style={{display:'flex',alignItems:'center',gap:4,minWidth:0}}>
                      <ERPCombobox
                        value={header.broker}
                        onChange={(val) => setHeader({ ...header, broker: val })}
                        options={brokerOptions}
                        placeholder="Search broker…"
                        disabled={locked}
                        recentKey="sales-broker"
                        onCreateNew={!locked ? (q) => handleCreateBroker(q) : undefined}
                        createLabel="Broker"
                      />
                      {!locked && (
                        <button type="button" title="Add new broker" onClick={() => handleCreateBroker('')}
                          style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:2,padding:'2px 6px',fontSize:10,fontWeight:700,color:'#fff',background:'#16a34a',border:'none',borderRadius:3,cursor:'pointer',whiteSpace:'nowrap'}}>
                          <Plus size={10}/> Add
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div />
                )}
                {billFields.header('haste') ? (
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Haste:</span>
                    <input type="text" className="classic-erp-input" value={header.haste} onChange={e => setHeader({ ...header, haste: e.target.value })} disabled={locked} />
                  </div>
                ) : (
                  <div />
                )}
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Type:</span>
                  <select className="classic-erp-select" value={header.type} onChange={e => setHeader({ ...header, type: e.target.value })} disabled={locked}>
                    <option value="INVOICE IN STATE">INVOICE IN STATE</option>
                    <option value="INVOICE OUT OF STATE">INVOICE OUT OF STATE</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Item Grid Table */}
          <div className="classic-erp-table-container erp-grid-panel erp-sales-grid min-h-0">
            <table className="classic-erp-table">
              <thead>
                <tr>
                  <th className="col-sr text-center">Sr</th>
                  <th className="col-item">Item Name *</th>
                  <th className="col-desc">Desc *</th>
                  <th className="col-num text-center">Fold</th>
                  <th className="col-num text-center">Cut</th>
                  <th className="col-num text-center">Pcs *</th>
                  <th className="col-qty text-center" title="Meters (Auto = Cut × Pcs or manual entry)">Mts *</th>
                  <th className="col-qty text-right">Rate *</th>
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
                    <td className="col-item" style={{position:'relative'}}>
                      <div style={{display:'flex',alignItems:'center',gap:2,minWidth:0}}>
                        <ERPCombobox
                          value={row.itemId}
                          onChange={(val) => onGridItemSelect(val, idx)}
                          options={itemOptions}
                          placeholder="Search item…"
                          disabled={locked}
                          recentKey="sales-item"
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
                      <input type="text" className="classic-erp-input w-full border-0" value={row.desc} onChange={e => {
                        patchLine(idx, { desc: e.target.value });
                      }} disabled={locked} />
                    </td>
                    <td className="col-num">
                      <input type="number" className="classic-erp-input w-full text-center border-0" value={row.fold || ''} onChange={e => {
                        patchLine(idx, { fold: Number(e.target.value) });
                      }} disabled={locked} />
                      {['QTY', 'PCS'].includes(String(row.unit || '').toUpperCase()) && (row.foldLessAmt || 0) > 0 && (
                        <span
                          className="block text-center font-mono leading-none"
                          style={{ fontSize: 9, color: '#c2410c', paddingTop: 1 }}
                          title={`Fold Less: ${(row.foldLessAmt || 0).toFixed(2)} deducted from Taxable`}
                        >
                          less {(row.foldLessAmt || 0).toFixed(2)}
                        </span>
                      )}
                      {['QTY', 'PCS'].includes(String(row.unit || '').toUpperCase()) && (row.foldAddAmt || 0) > 0 && (
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
                      <input
                        type="number"
                        className="classic-erp-input w-full text-center border-0"
                        value={row.cut || ''}
                        onChange={e => patchLine(idx, { cut: Number(e.target.value) || 0, _mtsManual: false }, 'cut')}
                        disabled={locked}
                        placeholder="0"
                      />
                    </td>
                    <td className="col-num">
                      <div className="flex items-center w-full relative">
                        <input
                          type="number"
                          className="classic-erp-input w-full text-center border-0 font-bold"
                          value={row.pcs > 0 ? row.pcs : ''}
                          onChange={e => patchLine(idx, { pcs: Number(e.target.value) || 0, _mtsManual: false }, 'pcs')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              openPcsBreakdown(idx);
                            }
                          }}
                          disabled={locked}
                          min="0"
                          step="1"
                          placeholder="0"
                          title="Press Enter on Pcs to open breakdown modal (or click #)"
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
                      <input
                        type="number"
                        className="classic-erp-input w-full text-center border-0"
                        value={row.mts > 0 ? row.mts : ''}
                        onChange={e => patchLine(idx, { mts: Number(e.target.value) || 0, _mtsManual: true, _amountManual: false }, 'mts')}
                        disabled={locked}
                        min="0"
                        step="0.001"
                        placeholder="0.000"
                        title="Auto = Cut × Pcs. Type to override."
                      />
                    </td>
                    <td className="col-qty">
                      <input
                        type="number"
                        className="classic-erp-input w-full text-right border-0"
                        value={row.saleRate > 0 ? row.saleRate : ''}
                        onChange={e => patchLine(idx, { saleRate: Number(e.target.value) || 0, _amountManual: false })}
                        disabled={locked}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="col-unit">
                      <ERPCombobox
                        value={row.unit || 'MTRS'}
                        onChange={(val) => patchLine(idx, { unit: String(val || 'MTRS').toUpperCase(), _amountManual: false })}
                        options={unitOptions}
                        placeholder="Unit…"
                        disabled={locked}
                        recentKey="sales-unit"
                        openOnEnter
                        onCreateNew={!locked ? (q) => handleCreateUnit(q, idx) : undefined}
                        createLabel="Unit"
                        emptyMessage="No unit — type & Create"
                        inputClassName="border-0 text-center"
                      />
                    </td>
                    <td className="col-amt">
                      <input
                        type="number"
                        step="0.01"
                        className="classic-erp-input w-full text-right border-0 font-mono font-bold bg-yellow-50"
                        value={row.amount > 0 ? row.amount : ''}
                        onChange={e => patchLine(idx, { amount: Number(e.target.value) || 0, _amountManual: true })}
                        disabled={locked}
                        placeholder="auto"
                        title={String(row.unit || '').toUpperCase() === 'NETQTY' && row.foldDeductionAmt > 0
                          ? `Gross: ${(row.amount + row.foldDeductionAmt).toFixed(2)} − Fold(${100 - (row.fold || 0)}%): ${row.foldDeductionAmt.toFixed(2)} = Net: ${row.amount.toFixed(2)}`
                          : 'Auto = Mts × Rate. Type to override.'}
                      />
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
                      <input type="number" step="0.01" className="classic-erp-input w-full text-center border-0" value={row.dis1Per || ''} onChange={e => patchLine(idx, { dis1Per: Number(e.target.value) || 0, _dis1Manual: false })} disabled={locked} placeholder="%" />
                    </td>
                    <td className="col-amt">
                      <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0 font-mono text-red-700 font-bold" value={row.dis1Amt || ''} onChange={e => patchLine(idx, { dis1Amt: Number(e.target.value) || 0, _dis1Manual: true })} disabled={locked} />
                    </td>
                    <td className="col-pct">
                      <input type="number" step="0.01" className="classic-erp-input w-full text-center border-0" value={row.dis2Per || ''} onChange={e => patchLine(idx, { dis2Per: Number(e.target.value) || 0, _dis2Manual: false })} disabled={locked} placeholder="%" />
                    </td>
                    <td className="col-amt">
                      <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0 font-mono text-red-700 font-bold" value={row.dis2Amt || ''} onChange={e => patchLine(idx, { dis2Amt: Number(e.target.value) || 0, _dis2Manual: true })} disabled={locked} />
                    </td>
                    <td className="col-amt">
                      <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0" value={row.addAmt || ''} onChange={e => patchLine(idx, { addAmt: Number(e.target.value) || 0 })} disabled={locked} />
                    </td>
                    <td className="col-pct">
                      <input type="number" step="0.01" className="classic-erp-input w-full text-center border-0" value={row.gstPer || ''} onChange={e => {
                        patchLine(idx, { gstPer: Number(e.target.value) });
                      }} disabled={locked} />
                    </td>
                    <td className="col-amt">
                      <input type="number" step="0.01" className="classic-erp-input w-full text-right border-0 font-mono font-bold text-blue-800" value={row.gstAmt || ''} onChange={e => {
                        patchLine(idx, { gstAmt: Number(e.target.value) });
                      }} disabled={locked} />
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

          <div className="flex justify-between items-center bg-[var(--bg-subtle)] p-1.5 border border-[var(--border)] rounded-md">
            <button
              type="button"
              onClick={() => setGridItems([...gridItems, blankLine()])}
              className="classic-erp-btn"
              disabled={locked}
            >
              <Plus size={12} strokeWidth={3} /> Add Line Item
            </button>
            <div className="text-xs font-bold text-black font-mono flex gap-3 flex-wrap items-center">
              {currentItemInfo?.hsn && (
                <span className="text-slate-600">HSN: <span className="text-blue-800">{currentItemInfo.hsn || currentItemInfo.hsnCode}</span></span>
              )}
              <span>TOTAL Pcs: <span className="text-blue-800">{gridItems.reduce((a, b) => a + (Number(b.pcs) || 0), 0)}</span></span>
              <span>/ Qty: <span className="text-blue-800">{gridItems.reduce((a, b) => a + (Number(b.mts) || 0), 0).toFixed(0)}</span></span>
              <span>/ NetQty: <span className="text-blue-800">{Math.max(0, gridItems.reduce((a, b) => a + (Number(b.mts) || 0), 0) - (footer.foldLess && Number(footer.foldLess) > 0 ? (Number(footer.foldLess) / (gridItems.find(i => i.saleRate > 0)?.saleRate || 60)) : 0)).toFixed(0)}</span></span>
              <span>/ Kgs: <span className="text-blue-800">{gridItems.reduce((a, b) => {
                const subKgs = Array.isArray(b.pcsDetails) ? b.pcsDetails.reduce((s, r) => s + (Number(r.netQty || r.kgs) || 0), 0) : 0;
                return a + (subKgs > 0 ? subKgs : (Number(b.mts) || 0));
              }, 0).toFixed(0)}/U:QTY</span></span>
            </div>
          </div>

          {/* Stock bar + Lot history — single panel, no gap line between them */}
          {(currentItemInfo || lotHistory.length > 0) && (
            <div className="classic-erp-table-container erp-sales-history-panel shrink-0">
              {currentItemInfo && (
                <div
                  className="erp-sales-stockbar flex gap-3 items-center text-[10px] font-bold px-2 py-0.5"
                  style={{ background: 'var(--accent-light, #fef3c7)' }}
                >
                  <span style={{ color: 'var(--accent, #b45309)' }}>Stock:</span>
                  <span>Pcs: <span className="text-blue-800">{currentItemStock.pcs}</span></span>
                  <span>Mts: <span className="text-blue-800">{currentItemStock.mts}</span></span>
                  <span>Lots: <span className="text-blue-800">{currentItemStock.lots}</span></span>
                  <span className="ml-auto">HSN: <span className="text-blue-800 font-mono">{currentItemInfo.hsn || currentItemInfo.hsnCode || '-'}</span></span>
                </div>
              )}
              {lotHistory.length > 0 && (
                <table className="classic-erp-table erp-sales-history-table">
                  <thead>
                    <tr>
                      <th>BillNo</th>
                      <th>BillDt</th>
                      <th className="w-12 text-center">Cut</th>
                      <th className="w-12 text-center">Pcs</th>
                      <th className="w-16 text-center">Qty</th>
                      <th className="w-16 text-right">Rate</th>
                      <th className="w-16 text-right">Mrp</th>
                      <th className="w-20 text-right">Amount</th>
                      <th className="w-12 text-center">Fold</th>
                      <th className="w-12 text-center">RD%</th>
                      <th className="w-14 text-center">Dis1%</th>
                      <th className="w-14 text-center">Dis2%</th>
                      <th className="w-18 text-right">Disc1</th>
                      <th className="w-18 text-right">Disc2</th>
                      <th>Party</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotHistory.map((row, i) => (
                      <tr key={i}>
                        <td className="font-bold">{row.billNo}</td>
                        <td>{row.billDt ? row.billDt.split('T')[0] : ''}</td>
                        <td className="text-center">{row.cut}</td>
                        <td className="text-center">{row.pcs}</td>
                        <td className="text-center">{parseFloat(row.qty || 0).toFixed(2)}</td>
                        <td className="text-right font-mono">{parseFloat(row.rate || 0).toFixed(2)}</td>
                        <td className="text-right font-mono">{parseFloat(row.mrp || 0).toFixed(2)}</td>
                        <td className="text-right font-mono">{parseFloat(row.amount || 0).toFixed(2)}</td>
                        <td className="text-center">{row.fold}</td>
                        <td className="text-center">{row.rdPer}</td>
                        <td className="text-center">{row.dis1Per}</td>
                        <td className="text-center">{row.dis2Per}</td>
                        <td className="text-right font-mono">{parseFloat(row.dis1Amt || 0).toFixed(2)}</td>
                        <td className="text-right font-mono">{parseFloat(row.dis2Amt || 0).toFixed(2)}</td>
                        <td>{row.party}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Footer Grid / Calculations */}
          <div className="grid grid-cols-12 gap-1.5 erp-sales-footer shrink-0">
            
            {/* Left Adjustments Column */}
            <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
              {[
                { label: 'FOLD LESS', key: 'foldLess', signKey: 'foldLessSign' },
                { label: 'RD AMT', key: 'rdAmt', signKey: 'rdAmtSign' },
                { label: 'DISCOUNT', key: 'discountAmt', signKey: 'discountSign' },
                { label: 'LESS', key: 'lessAmt', signKey: 'lessSign' },
                { label: 'ADD', key: 'addAmt', signKey: 'addSign' }
              ].filter((adj) => billFields.footer(adj.key)).map(adj => (
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
              
              <div className="classic-erp-meta-grid pt-2 border-t border-[var(--border)]">
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Due Days:</span>
                  <input type="number" className="classic-erp-input text-center" value={footer.dueDays} onChange={e => setFooter({ ...footer, dueDays: Number(e.target.value) })} disabled={locked} />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Due Date:</span>
                  <input type="date" className="classic-erp-input" value={footer.dueDate} readOnly />
                </div>
              </div>
            </div>

            {/* Middle Transport Details Column */}
            {(billFields.footer('transport') || billFields.footer('lrNo') || billFields.footer('bale')) && (
            <div className="col-span-4 classic-erp-frame classic-erp-stack p-2">
              <span className="classic-erp-frame-title">Transport Details</span>
              
              {billFields.footer('transport') && (
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label">Transport:</span>
                <input type="text" className="classic-erp-input" value={footer.transport} onChange={e => setFooter({ ...footer, transport: e.target.value })} disabled={locked} />
              </div>
              )}
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label">City:</span>
                <input type="text" className="classic-erp-input" value={footer.station} onChange={e => setFooter({ ...footer, station: e.target.value })} disabled={locked} />
              </div>
              <div className="classic-erp-field classic-erp-field--lg">
                <span className="classic-erp-label">Remark:</span>
                <input type="text" className="classic-erp-input" value={footer.remarks} onChange={e => setFooter({ ...footer, remarks: e.target.value })} disabled={locked} />
              </div>
              <div className="classic-erp-meta-grid">
                {billFields.footer('lrNo') && (
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Lr No:</span>
                  <input type="text" className="classic-erp-input" value={footer.lrNo} onChange={e => setFooter({ ...footer, lrNo: e.target.value })} disabled={locked} />
                </div>
                )}
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Lr Dt:</span>
                  <input type="date" className="classic-erp-input" value={footer.lrDate} onChange={e => setFooter({ ...footer, lrDate: e.target.value })} disabled={locked} />
                </div>
                {billFields.footer('bale') && (
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Bale:</span>
                  <input type="text" className="classic-erp-input" value={footer.baleNo} onChange={e => setFooter({ ...footer, baleNo: e.target.value })} disabled={locked} />
                </div>
                )}
                {billFields.footer('weight') && (
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Weight:</span>
                  <input type="number" className="classic-erp-input" value={footer.weight || ''} onChange={e => setFooter({ ...footer, weight: Number(e.target.value) })} disabled={locked} />
                </div>
                )}
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Freight:</span>
                  <input type="number" className="classic-erp-input" value={footer.freight || ''} onChange={e => setFooter({ ...footer, freight: Number(e.target.value) })} disabled={locked} />
                </div>
                <button className="classic-erp-btn btn-red w-full" type="button" disabled>E-Way Bill</button>
              </div>
            </div>
            )}

            {/* Right Totals & GST Summary Column */}
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
                    <div className="classic-erp-control">
                      <span className="classic-erp-label text-slate-800">CGST</span>
                      <input type="number" className="classic-erp-input w-14 text-center" value={gstRates.cgstRate} onChange={e => setGstRates({ ...gstRates, cgstRate: Number(e.target.value) })} disabled={locked} />
                      <span className="text-[10px]">%</span>
                    </div>
                    <span className="font-mono text-black">₹{calculations.cgst.toFixed(2)}</span>
                  </div>
                  <div className="classic-erp-total-row font-bold">
                    <div className="classic-erp-control">
                      <span className="classic-erp-label text-slate-800">SGST</span>
                      <input type="number" className="classic-erp-input w-14 text-center" value={gstRates.sgstRate} onChange={e => setGstRates({ ...gstRates, sgstRate: Number(e.target.value) })} disabled={locked} />
                      <span className="text-[10px]">%</span>
                    </div>
                    <span className="font-mono text-black">₹{calculations.sgst.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="classic-erp-total-row font-bold">
                  <div className="classic-erp-control">
                    <span className="classic-erp-label text-slate-800">IGST</span>
                    <input type="number" className="classic-erp-input w-14 text-center" value={gstRates.igstRate} onChange={e => setGstRates({ ...gstRates, igstRate: Number(e.target.value) })} disabled={locked} />
                    <span className="text-[10px]">%</span>
                  </div>
                  <span className="font-mono text-black">₹{calculations.igst.toFixed(2)}</span>
                </div>
              )}

              <div className="classic-erp-total-row font-bold">
                <div className="classic-erp-control">
                  <span className="classic-erp-label text-slate-800">TCS</span>
                  <input type="number" className="classic-erp-input w-14 text-center" value={footer.tcsRate} onChange={e => setFooter({ ...footer, tcsRate: Number(e.target.value) })} disabled={locked} />
                  <span className="text-[10px]">%</span>
                </div>
                <span className="font-mono text-black">₹{calculations.tcsAmt.toFixed(2)}</span>
              </div>

              <div className="classic-erp-total-row font-bold border-t border-[var(--border)] pt-1">
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

        {/* Action bar — outside window so New/Save never clip */}
        <div className="erp-bill-action-bar shrink-0 flex flex-wrap items-center justify-end gap-1.5 px-2 py-1.5 border-t border-[var(--border)] bg-[var(--bg-base,#f8fafc)]">
          <span className="text-[10px] text-[var(--text-muted)] mr-auto hidden sm:inline">
            Enter → next · Ctrl+Enter save · Esc close
          </span>
          <button className="classic-erp-btn" type="button" onClick={handleNew} disabled={readOnly || mode !== 'View' || saving}>New</button>
          <button className="classic-erp-btn btn-blue" type="button" data-enter-save onClick={handleSave} disabled={locked || saving || bootLoading}>
            <SaveButtonLabel saving={saving} />
          </button>
          <button className="classic-erp-btn" type="button" onClick={handleCancel} disabled={locked || saving}>Cancel</button>
          <button className="classic-erp-btn" type="button" onClick={() => setMode('View')} disabled={readOnly || mode === 'View' || saving}>Find</button>
          <button className="classic-erp-btn" type="button" onClick={() => setMode('Edit')} disabled={readOnly || mode !== 'View' || !selectedInvoiceId || saving}>Edit</button>
          <button className="classic-erp-btn btn-red" type="button" onClick={handleDelete} disabled={readOnly || locked || saving || !selectedInvoiceId}>Delete</button>
          <button className="classic-erp-btn btn-blue" type="button" onClick={handlePrint} disabled={!selectedInvoiceId && !initialData}>PDF / Print</button>
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
        title="Sales Invoice Saved"
        invoiceNo={saveNextActions.invoiceNo}
        offlinePending={saveNextActions.offlinePending}
        onPdf={() => {
          openPdfForSaved();
        }}
        onPrint={openPdfForSaved}
        onWhatsApp={shareSavedWhatsApp}
        onNew={() => {
          setSaveNextActions(null);
          handleNew();
        }}
        onClose={() => setSaveNextActions(null)}
      />,
      document.body
    )}

    {typeof document !== 'undefined' && printInvoiceId && createPortal(
      <SalesPrint invoiceId={printInvoiceId} onClose={() => setPrintInvoiceId(null)} />,
      document.body
    )}

    <PcsBreakdownModal
      isOpen={pcsBreakdown.open}
      onClose={() => setPcsBreakdown({ open: false, lineIdx: -1 })}
      rows={pcsBreakdown.lineIdx >= 0 ? gridItems[pcsBreakdown.lineIdx]?.pcsDetails : []}
      onSave={handlePcsBreakdownSave}
      locked={locked}
    />
    </>
  );
};

export default SalesModal;
