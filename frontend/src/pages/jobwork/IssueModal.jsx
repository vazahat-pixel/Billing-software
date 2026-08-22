import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ERPSelect } from '../../components/forms/FormElements';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { Plus, Search } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import PuBillLookupModal from './PuBillLookupModal';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import JobWorkPrint from '../../components/print/JobWorkPrint';

const today = () => new Date().toISOString().split('T')[0];

const weekday = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return '';
  }
};

const PROCESS_TYPES = [
  'Process Charge',
  'Dyeing',
  'Printing',
  'Finishing',
  'Bleaching',
  'Sizing',
  'Mercerizing',
  'Stentering',
  'Other',
];

const FINISH_OPTIONS = [
  { value: '', label: '- Select Finish -' },
  { value: 'Soft', label: 'Soft' },
  { value: 'Hard', label: 'Hard' },
  { value: 'Peach', label: 'Peach' },
  { value: 'Brush', label: 'Brush' },
  { value: 'Water Proof', label: 'Water Proof' },
  { value: 'Other', label: 'Other' },
];

const emptyForm = (book) => ({
  challanNo: '',
  date: today(),
  millId: '',
  weaver: '',
  puBillNo: '',
  itemName: '',
  issPcs: '',
  issQty: '',
  puRate: '',
  jobRate: '',
  lotId: '',
  remark1: '',
  remark2: '',
  procType: 'Process Charge',
  finish: '',
  book: book || 'PROCESS ISSUE BOOK',
});

/** Lots linked to a purchase bill (for Purchase → Mill Issue flow). */
const findLotsFromPurchase = (lots, data) => {
  if (!data) return [];
  const purchaseId = data.purchaseId != null ? String(data.purchaseId) : '';
  const codes = new Set((data.lotCodes || []).map((c) => String(c)).filter(Boolean));
  return (lots || []).filter((lot) => {
    if (Number(lot.remainingMtrs || 0) <= 0 && Number(lot.remainingPcs || 0) <= 0) return false;
    if (lot.status === 'Closed') return false;
    if (lot.holdStatus && lot.holdStatus !== 'None') return false;
    const pid = lot.purchaseId?._id || lot.purchaseId;
    if (purchaseId && pid && String(pid) === purchaseId) return true;
    if (codes.size && codes.has(String(lot.lotId || ''))) return true;
    return false;
  });
};

/**
 * Mill Issue — grey stock lot se mill / job worker ko material bhejna.
 * Classic ERP layout: Challan, MillName, Weaver, Pu.BillNo, Item, Iss Pcs/Qty, rates, Lot No.
 */
const IssueModal = ({ isOpen, onClose, selectedBook = null, initialData = null }) => {
  const {
    parties,
    items,
    purchases,
    inventoryLots,
    jobWorkEntries,
    fetchParties,
    fetchItems,
    fetchPurchases,
    fetchInventory,
    fetchJobs,
    issueToMill,
  } = useStore();

  const [mode, setMode] = useState('Add');
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [form, setForm] = useState(emptyForm(selectedBook));
  const [selectedJobId, setSelectedJobId] = useState('');
  const [lotSort, setLotSort] = useState('asc');
  const [accountModal, setAccountModal] = useState({ open: false, initialData: null });
  const [findOpen, setFindOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [fromPurchase, setFromPurchase] = useState(null);
  const [puBillLookupOpen, setPuBillLookupOpen] = useState(false);

  const locked = mode === 'View';
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const mills = useMemo(
    () =>
      parties.filter((p) => {
        const type = String(p.type || '');
        const group = String(p.group || '').toUpperCase();
        return (
          type === 'Job Worker' ||
          type === 'Both' ||
          group.includes('JOB') ||
          group.includes('WORKER') ||
          group.includes('MILL')
        );
      }),
    [parties]
  );

  const millOptions = useMemo(
    () => mills.map((m) => ({ value: m._id || m.id, label: m.name })),
    [mills]
  );

  const weaverOptions = useMemo(() => {
    const weaverNames = new Set();

    // 1. Add all parties from the master Parties list
    (parties || []).forEach((p) => {
      if (p.name) weaverNames.add(p.name.trim());
    });

    // 2. Add any associated suppliers/weavers from inventory lots and purchases
    const purchaseById = new Map((purchases || []).map((p) => [String(p._id || p.id), p]));
    (purchases || []).forEach((p) => {
      const sName = p.supplierId?.name || p.supplierName || p.partyName || '';
      if (sName) weaverNames.add(sName.trim());
    });
    (inventoryLots || []).forEach((lot) => {
      const pid = String(lot.purchaseId?._id || lot.purchaseId || '');
      const purchase = pid ? purchaseById.get(pid) : null;
      const supplierName =
        purchase?.supplierId?.name ||
        purchase?.supplierName ||
        purchase?.partyName ||
        '';

      if (supplierName) weaverNames.add(supplierName.trim());
      if (lot.weaver) weaverNames.add(lot.weaver.trim());
    });

    return Array.from(weaverNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [parties, inventoryLots, purchases]);

  const purchaseLots = useMemo(
    () => findLotsFromPurchase(inventoryLots, fromPurchase),
    [inventoryLots, fromPurchase]
  );

  const availableLots = useMemo(() => {
    const issuedLotIds = new Set(
      (jobWorkEntries || [])
        .filter((j) => j.status === 'Issued')
        .map((j) => String(j.lotId?._id || j.lotId || ''))
        .filter(Boolean)
    );

    const open = (inventoryLots || []).filter(
      (lot) =>
        (Number(lot.remainingMtrs || 0) > 0 || Number(lot.remainingPcs || 0) > 0) &&
        lot.status !== 'Closed' &&
        (lot.holdStatus === 'None' || !lot.holdStatus) &&
        !issuedLotIds.has(String(lot._id || lot.id))
    );
    let list = open;
    if (fromPurchase && purchaseLots.length) {
      const activePurchaseLots = purchaseLots.filter(
        (lot) => !issuedLotIds.has(String(lot._id || lot.id))
      );
      const purchaseIds = new Set(activePurchaseLots.map((l) => String(l._id || l.id)));
      const rest = open.filter((l) => !purchaseIds.has(String(l._id || l.id)));
      list = [...activePurchaseLots, ...rest];
    }
    return [...list].sort((a, b) => {
      const la = String(a.lotId || '');
      const lb = String(b.lotId || '');
      return lotSort === 'asc' ? la.localeCompare(lb) : lb.localeCompare(la);
    });
  }, [inventoryLots, fromPurchase, purchaseLots, lotSort, jobWorkEntries]);

  const lotOptions = useMemo(() => {
    return availableLots.map((lot) => {
      const id = lot._id || lot.id;
      const name = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || 'Item';
      const fromPur =
        fromPurchase && purchaseLots.some((p) => String(p._id || p.id) === String(id));
      const qtyLabel =
        Number(lot.totalMtrs || 0) > 0
          ? `${Number(lot.remainingMtrs || 0).toFixed(2)} mts`
          : `${Number(lot.remainingPcs || 0)} pcs`;
      return {
        value: id,
        label: `${fromPur ? '★ ' : ''}${lot.lotId || id.slice(-6)} · ${name} · ${qtyLabel}`,
      };
    });
  }, [availableLots, fromPurchase, purchaseLots]);

  const itemOptions = useMemo(() => {
    const names = new Set();
    (availableLots || []).forEach((lot) => {
      const name = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || '';
      if (name) names.add(name.trim());
    });
    return Array.from(names).sort().map((name) => ({ value: name, label: name }));
  }, [availableLots]);

  const processOptions = useMemo(
    () => PROCESS_TYPES.map((p) => ({ value: p, label: p })),
    []
  );

  const selectedLot = useMemo(
    () => availableLots.find((l) => String(l._id || l.id) === String(form.lotId)) || null,
    [availableLots, form.lotId]
  );

  const jobOptions = useMemo(() => {
    const list = [...(jobWorkEntries || [])];
    list.sort((a, b) => {
      const da = new Date(a.issueDate || a.createdAt || 0).getTime();
      const db = new Date(b.issueDate || b.createdAt || 0).getTime();
      return lotSort === 'asc' ? da - db : db - da;
    });
    return list.map((j) => ({
      value: j._id || j.id,
      label: `${j.challanNo || j.jobCardNo || '-'} · ${j.workerId?.name || 'Mill'} · ${Number(j.issueQty || 0).toFixed(2)} mts`,
    }));
  }, [jobWorkEntries, lotSort]);

  const resetForm = useCallback(() => {
    setForm(emptyForm(selectedBook));
    setSelectedJobId('');
    setFindOpen(false);
  }, [selectedBook]);

  const applyPurchasePrefill = useCallback((data, lots, purchasesList, partiesList) => {
    if (!data?.purchaseId && !(data?.lotCodes || []).length) {
      setFromPurchase(null);
      return;
    }
    setFromPurchase({
      purchaseId: data.purchaseId,
      invoiceNo: data.invoiceNo,
      lotCodes: data.lotCodes || [],
    });
    const matched = findLotsFromPurchase(lots, data);

    const purchaseById = new Map((purchasesList || []).map((p) => [String(p._id || p.id), p]));
    const pid = String(data.purchaseId || (matched[0]?.purchaseId?._id || matched[0]?.purchaseId) || '');
    const purchase = pid ? purchaseById.get(pid) : null;

    let supplierName =
      data.supplierName ||
      data.partyName ||
      data.weaver ||
      purchase?.supplierId?.name ||
      purchase?.supplierName ||
      purchase?.partyName ||
      (matched[0]?.weaver) ||
      '';

    if (!supplierName && purchase?.supplierId) {
      const pIdStr = String(purchase.supplierId._id || purchase.supplierId);
      const partyObj = (partiesList || []).find((p) => String(p._id || p.id) === pIdStr);
      if (partyObj) supplierName = partyObj.name;
    }

    if (matched.length) {
      const lot = matched[0];
      const lotId = lot._id || lot.id;
      const itemName = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || '';
      const puRate = lot.rate ?? lot.purchaseRate ?? lot.avgRate ?? '';
      setForm((f) => ({
        ...f,
        lotId,
        itemName,
        issPcs: String(lot.remainingPcs ?? ''),
        issQty: String(lot.remainingMtrs ?? ''),
        puRate: puRate !== '' && puRate != null ? String(puRate) : f.puRate,
        puBillNo: data.invoiceNo || f.puBillNo,
        weaver: supplierName || f.weaver || '',
      }));
      toast.success(
        matched.length === 1
          ? `Lot loaded from Purchase ${data.invoiceNo || ''}`.trim()
          : `${matched.length} lots from Purchase ${data.invoiceNo || ''} — first lot selected`
      );
    } else {
      setForm((f) => ({
        ...f,
        puBillNo: data.invoiceNo || f.puBillNo,
        weaver: supplierName || f.weaver || '',
      }));
      toast.info('Purchase stock not in inventory yet — pick lot manually');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setBootLoading(false);
      setFromPurchase(null);
      return undefined;
    }
    let cancelled = false;
    setBootLoading(true);
    setMode('Add');
    resetForm();
    Promise.all([fetchParties(), fetchItems(), fetchPurchases(), fetchInventory(), fetchJobs()])
      .then((results) => {
        if (cancelled) return;
        const partyList = results[0] || [];
        const purchaseList = results[2] || [];
        const lots = results[3] || [];
        if (initialData) applyPurchasePrefill(initialData, lots, purchaseList, partyList);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedBook, initialData, applyPurchasePrefill, fetchParties, fetchItems, fetchPurchases, fetchInventory, fetchJobs, resetForm]);

  const applyPuBillRow = (row) => {
    if (!row) return;
    const finalPcs = Number(row.balPcs) > 0 ? row.balPcs : (row.pcs || '');
    const finalMts = Number(row.balMts) > 0 ? row.balMts : (row.mts || '');

    // Resolve matching inventory lot if row.lotId is empty
    let resolvedLotId = row.lotId || '';
    if (!resolvedLotId) {
      const match = (inventoryLots || []).find((l) => {
        if (row.itemId && String(l.itemId?._id || l.itemId || '') === String(row.itemId)) return true;
        const nameA = (l.itemName || l.itemId?.name || '').trim().toLowerCase();
        const nameB = (row.itemName || '').trim().toLowerCase();
        return nameA && nameB && nameA === nameB;
      });
      if (match) {
        resolvedLotId = match._id || match.id;
      }
    }

    setForm((f) => ({
      ...f,
      puBillNo: row.billNo || f.puBillNo,
      weaver: row.weaver || row.supplierName || row.partyName || f.weaver,
      itemName: row.itemName || f.itemName,
      lotId: resolvedLotId || f.lotId,
      issPcs: finalPcs != null ? String(finalPcs) : f.issPcs,
      issQty: finalMts != null ? String(finalMts) : f.issQty,
      puRate: row.puRate != null ? String(row.puRate) : f.puRate,
    }));
    toast.success(`Loaded from Purchase ${row.billNo} · ${row.itemName}`);
  };

  const handleWeaverChange = (val) => {
    setForm((f) => ({
      ...f,
      weaver: val || '',
      puBillNo: '',
      itemName: '',
      lotId: '',
      issPcs: '',
      issQty: '',
      puRate: '',
    }));
  };

  const handleItemChange = (val) => {
    if (!val) {
      setForm((f) => ({
        ...f,
        itemName: '',
        lotId: '',
        issPcs: '',
        issQty: '',
        puRate: '',
      }));
      return;
    }
    const lot = availableLots.find((l) => {
      const name = l.itemName || l.itemId?.name || l.itemId?.itemName || '';
      return name.trim().toLowerCase() === val.trim().toLowerCase();
    });
    if (lot) {
      applyLot(lot._id || lot.id);
    } else {
      setField('itemName', val);
    }
  };

  const applyLot = (lotId) => {
    const lot = availableLots.find((l) => String(l._id || l.id) === String(lotId));
    if (!lot) {
      setForm((f) => ({ ...f, lotId: '', itemName: '', issPcs: '', issQty: '', puRate: '', weaver: '', puBillNo: '' }));
      return;
    }
    const itemName = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || '';
    const puRate =
      lot.rate ?? lot.purchaseRate ?? lot.avgRate ?? lot.itemId?.purchaseRate ?? '';

    // Look up supplier name (weaver) from purchases associated with this lot
    const purchaseById = new Map((purchases || []).map((p) => [String(p._id || p.id), p]));
    const pid = String(lot.purchaseId?._id || lot.purchaseId || '');
    const purchase = pid ? purchaseById.get(pid) : null;
    let supplierName =
      purchase?.supplierId?.name ||
      purchase?.supplierName ||
      purchase?.partyName ||
      lot.weaver ||
      '';

    if (!supplierName && purchase?.supplierId) {
      const pIdStr = String(purchase.supplierId._id || purchase.supplierId);
      const partyObj = (parties || []).find((p) => String(p._id || p.id) === pIdStr);
      if (partyObj) supplierName = partyObj.name;
    }

    setForm((f) => ({
      ...f,
      lotId,
      itemName,
      issPcs: String(lot.remainingPcs ?? ''),
      issQty: String(lot.remainingMtrs ?? ''),
      puRate: puRate !== '' && puRate != null ? String(puRate) : f.puRate,
      puBillNo: f.puBillNo || lot.invoiceNo || lot.purchaseInvoiceNo || '',
      weaver: supplierName || f.weaver || '',
    }));
  };

  const handleMillChange = (id) => setField('millId', id);

  const handleCreateMill = (search = '') => {
    setAccountModal({ open: true, initialData: { name: search || '', group: 'JOB WORKER' } });
  };

  const handleMillSuccess = (party) => {
    fetchParties();
    setField('millId', party._id || party.id);
    setAccountModal({ open: false, initialData: null });
    toast.success(`Mill "${party.name}" added`);
  };

  const handleNew = () => {
    setMode('Add');
    setFromPurchase(null);
    resetForm();
  };

  const handleEdit = () => {
    if (!selectedJobId) return toast.warning('Find a challan first');
    setMode('Edit');
  };

  const handleCancel = () => {
    if (mode === 'Add') {
      resetForm();
      return;
    }
    setMode('View');
    if (selectedJobId) loadJob(selectedJobId);
  };

  const loadJob = (id) => {
    setSelectedJobId(id);
    if (!id) return;
    const job = jobWorkEntries.find((j) => String(j._id || j.id) === String(id));
    if (!job) return;
    setMode('View');
    setFindOpen(true);
    const remarks = String(job.remark || job.remarks || '');
    const [r1, ...rest] = remarks.split(/\n/);
    setForm({
      challanNo: job.challanNo || job.jobCardNo || '',
      date: job.issueDate ? String(job.issueDate).slice(0, 10) : today(),
      millId: job.workerId?._id || job.workerId || '',
      weaver: job.weaver || '',
      puBillNo: job.purchaseBillNo || '',
      itemName: job.lotId?.itemName || job.lotId?.itemId?.name || '',
      issPcs: String(job.issuePcs ?? ''),
      issQty: String(job.issueQty ?? ''),
      puRate: job.purchaseRate != null ? String(job.purchaseRate) : '',
      jobRate: job.jobRate != null ? String(job.jobRate) : String(job.processCharges || ''),
      lotId: job.lotId?._id || job.lotId || '',
      remark1: r1 || '',
      remark2: rest.join(' ') || '',
      procType: job.processType || 'Process Charge',
      finish: job.finish || '',
      book: selectedBook || 'PROCESS ISSUE BOOK',
    });
  };

  const handleJobCard = () => {
    if (locked) return;
    setField('challanNo', `JC-${Math.floor(100000 + Math.random() * 900000)}`);
    toast.info('Job Card No. assigned');
  };

  const handleSave = async (e, { keepOpen = false } = {}) => {
    if (e) e.preventDefault();
    if (locked) {
      toast.warning('Click Edit or New before saving');
      return false;
    }
    if (mode === 'Edit') {
      toast.warning('Issued challans cannot be edited — create New');
      return false;
    }
    if (!form.millId) {
      toast.error('Select Mill Name');
      return false;
    }
    if (!form.lotId) {
      toast.error('Select Lot No.');
      return false;
    }
    if (!form.puBillNo || String(form.puBillNo).trim() === '') {
      toast.error('Enter Purchase Bill No.');
      return false;
    }
    const typedPuBill = String(form.puBillNo).trim().toLowerCase();
    const isPuBillOccupied = jobWorkEntries.some(j => 
      j.status === 'Issued' && 
      String(j.purchaseBillNo || '').trim().toLowerCase() === typedPuBill
    );
    if (isPuBillOccupied) {
      toast.error(`Purchase Bill No. "${form.puBillNo}" is already occupied (currently in process).`);
      return false;
    }
    const qty = Number(form.issQty || 0);
    const pcs = Number(form.issPcs || 0);
    // Pcs-only lots (item purchased/tracked by piece count, no running meters) always
    // have totalMtrs === 0 — validate against pcs instead, or the check below would
    // always fail since remainingMtrs never has anything to give.
    const lotTracksMtrs = selectedLot ? Number(selectedLot.totalMtrs || 0) > 0 : true;
    if (lotTracksMtrs) {
      if (!qty || qty <= 0) {
        toast.error('Enter Iss Qty');
        return false;
      }
      if (selectedLot && qty > Number(selectedLot.remainingMtrs || 0) + 0.0001) {
        toast.error(`Iss Qty exceeds stock (${Number(selectedLot.remainingMtrs || 0).toFixed(2)})`);
        return false;
      }
    } else {
      if (!pcs || pcs <= 0) {
        toast.error('Enter Iss Pcs');
        return false;
      }
      if (selectedLot && pcs > Number(selectedLot.remainingPcs || 0) + 0.0001) {
        toast.error(`Iss Pcs exceeds stock (${Number(selectedLot.remainingPcs || 0)})`);
        return false;
      }
    }

    if (!form.challanNo || String(form.challanNo).trim() === '') {
      toast.error('Enter Challan No.');
      return false;
    }
    if (String(form.challanNo).trim().toUpperCase() === 'AUTO') {
      toast.error('Challan No. cannot be "AUTO". Please enter a valid challan number.');
      return false;
    }

    setSaving(true);
    try {
      const remark = [form.remark1, form.remark2].filter(Boolean).join('\n');
      const { millId, procType, finish, jobRate } = form;
      await issueToMill({
        jobCardNo: form.challanNo,
        challanNo: form.challanNo,
        issueDate: form.date,
        date: form.date,
        lotId: form.lotId,
        workerId: form.millId,
        processType: form.procType || 'Process Charge',
        finish: form.finish || '',
        issueQty: qty,
        issuePcs: pcs,
        weaver: form.weaver || '',
        purchaseBillNo: form.puBillNo || '',
        purchaseRate: Number(form.puRate) || 0,
        jobRate: Number(form.jobRate) || 0,
        processCharges: Number(form.jobRate) || 0,
        chargesRate: Number(form.jobRate) || 0,
        remark,
        remarks: remark,
      });
      toast.success('Mill Issue saved — stock reduced from lot');
      const [, lots] = await Promise.all([fetchJobs(), fetchInventory()]);
      const remaining = fromPurchase ? findLotsFromPurchase(lots || [], fromPurchase) : [];

      if (keepOpen) {
        const base = { ...emptyForm(selectedBook), millId, procType, finish, jobRate };
        setMode('Add');
        setSelectedJobId('');
        if (remaining.length) {
          const lot = remaining[0];
          const lotId = lot._id || lot.id;
          const itemName = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || '';
          const puRate = lot.rate ?? lot.purchaseRate ?? lot.avgRate ?? '';
          setForm({
            ...base,
            lotId,
            itemName,
            issPcs: String(lot.remainingPcs ?? ''),
            issQty: String(lot.remainingMtrs ?? ''),
            puRate: puRate !== '' && puRate != null ? String(puRate) : '',
            puBillNo: fromPurchase?.invoiceNo || base.puBillNo,
          });
          toast.info(`Ready for next challan (${remaining.length} lot(s) left)`);
        } else {
          setForm(base);
          toast.info('Ready for next challan (same mill)');
        }
      } else if (remaining.length) {
        const lot = remaining[0];
        const lotId = lot._id || lot.id;
        const itemName = lot.itemName || lot.itemId?.name || lot.itemId?.itemName || '';
        const puRate = lot.rate ?? lot.purchaseRate ?? lot.avgRate ?? '';
        setMode('Add');
        setForm({
          ...emptyForm(selectedBook),
          millId,
          procType,
          finish,
          jobRate,
          lotId,
          itemName,
          issPcs: String(lot.remainingPcs ?? ''),
          issQty: String(lot.remainingMtrs ?? ''),
          puRate: puRate !== '' && puRate != null ? String(puRate) : '',
          puBillNo: fromPurchase?.invoiceNo || '',
        });
        setSelectedJobId('');
        toast.success(`Next lot from purchase ready (${remaining.length} left)`);
      } else {
        if (fromPurchase) setFromPurchase(null);
        handleNew();
        setMode('View');
        setFindOpen(true);
      }
      return true;
    } catch (err) {
      toast.error(err, { fallback: 'Failed to save mill issue' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => toast.warning('Delete issued challan from Mill Receive / Cancel flow');
  /**
   * Mill Challan sheet from the live form. The reference challan lists takas individually
   * in its A/B/C/D grid; this form captures the issue as totals only (Iss Pcs / Iss Qty),
   * so the grid is left blank rather than inventing per-taka meters, and the Total Taka /
   * Total Mts. figures printed are exactly the ones typed on screen.
   */
  const printData = useMemo(() => {
    const mill = mills.find((m) => String(m._id || m.id) === String(form.millId));
    const effectiveRate = Number(form.puRate || form.jobRate || 0);
    const effectiveMts = Number(form.issQty || 0);
    const taxableAmt = Number((effectiveMts * effectiveRate).toFixed(2));
    return {
      millName: mill?.name || '',
      millGstin: mill?.gstin || '',
      millStateCode: mill?.stateCode || (mill?.gstin ? String(mill.gstin).slice(0, 2) : ''),
      challanNo: form.challanNo,
      date: form.date,
      puBillNo: form.puBillNo,
      itemName: form.itemName,
      hsnCd: form.hsnCd || '',
      weaver: form.weaver,
      procType: form.procType || 'Process',
      takas: Array.isArray(form.pcsDetails) && form.pcsDetails.length > 0 ? form.pcsDetails : [],
      totalTaka: form.issPcs,
      totalMts: form.issQty,
      taxableAmt: taxableAmt,
      rate: effectiveRate,
      remark: [form.remark1, form.remark2].filter(Boolean).join(' '),
    };
  }, [form, mills]);

  const handlePrint = () => {
    if (!form.millId && !form.itemName) {
      return toast.warning('Nothing to print — select a mill / item first');
    }
    setPrintOpen(true);
  };

  const titleBook = selectedBook || 'PROCESS ISSUE BOOK';

  return (
    <>
      <ErpWindowedModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Mill Issue [ ${titleBook} ]`}
        windowId="millIssue"
        bare
      >
        {({ WindowControls }) => (
          <div className="classic-erp-window erp-density erp-job-issue-window erp-mill-issue-window flex flex-col h-full min-h-0 !max-h-none">
            <ErpBusyOverlay show={bootLoading} message="Loading mill issue…" />
            <ErpBusyOverlay show={!bootLoading && saving} message="Saving mill issue…" />

            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">Mill Issue [ {titleBook} ]</span>
              <WindowControls />
            </div>

            <form
              onSubmit={(e) => handleSave(e)}
              className="classic-erp-body erp-job-issue-body flex-1 overflow-hidden min-h-0 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/90 border-b border-blue-200 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Material Source:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                    Warehouse Stock
                  </span>
                  <span className="text-slate-400 font-bold">OR</span>
                  <button
                    type="button"
                    onClick={() => setPuBillLookupOpen(true)}
                    disabled={locked}
                    className="px-2.5 py-0.5 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-sm flex items-center gap-1 transition-all"
                    title="Fetch items directly from Purchase Bills"
                  >
                    <Search size={11} /> Fetch From Purchase Bill
                  </button>
                </div>
                {fromPurchase && (
                  <div className="font-bold text-blue-900">
                    From Purchase: {fromPurchase.invoiceNo}
                  </div>
                )}
              </div>

              {fromPurchase && (
                <div className="erp-mill-issue-purchase-bar shrink-0">
                  From Purchase {fromPurchase.invoiceNo || ''}
                  {purchaseLots.length
                    ? ` — ${purchaseLots.length} lot(s) available (★ in Lot No.)`
                    : ' — matching stock not found; pick lot manually.'}
                </div>
              )}

              <div className="classic-erp-frame erp-job-issue-split">
                <div className="classic-erp-stack erp-job-issue-main min-w-0">
                  {findOpen && (
                    <div className="classic-erp-field classic-erp-field--lg">
                      <span className="classic-erp-label blue-label">Find</span>
                      <ERPSelect
                        className="classic-erp-select"
                        value={selectedJobId}
                        onChange={(e) => loadJob(e.target.value)}
                        options={jobOptions}
                        placeholder="- Select Mill Issue Challan -"
                        recentKey="mill-issue-find"
                      />
                    </div>
                  )}

                  <div className="classic-erp-field">
                    <span className="classic-erp-label red-label">Challan No</span>
                    <input
                      type="text"
                      className="classic-erp-input font-bold"
                      value={form.challanNo}
                      onChange={(e) => setField('challanNo', e.target.value)}
                      disabled={locked}
                    />
                  </div>

                  <div className="classic-erp-field">
                    <span className="classic-erp-label red-label">Date</span>
                    <div className="classic-erp-control">
                      <input
                        type="date"
                        className="classic-erp-input erp-job-issue-date"
                        value={form.date}
                        onChange={(e) => setField('date', e.target.value)}
                        disabled={locked}
                        required
                      />
                      <span className="erp-job-issue-weekday">{weekday(form.date)}</span>
                    </div>
                  </div>

                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label red-label">MillName</span>
                    <div className="classic-erp-control">
                      <ERPCombobox
                        value={form.millId}
                        onChange={handleMillChange}
                        disabled={locked}
                        options={millOptions}
                        placeholder="Search Mill / Job Worker…"
                        recentKey="mill-issue-mill"
                        onCreateNew={!locked ? handleCreateMill : undefined}
                        createLabel="Mill"
                        allowClear
                      />
                      {!locked && (
                        <button
                          type="button"
                          title="Add Mill"
                          onClick={() => handleCreateMill('')}
                          className="erp-job-issue-add-btn"
                        >
                          <Plus size={11} /> Add
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label">Weaver</span>
                    <div className="classic-erp-control">
                      <ERPCombobox
                        value={form.weaver}
                        onChange={handleWeaverChange}
                        disabled={locked}
                        options={weaverOptions}
                        placeholder="Search Weaver…"
                        recentKey="mill-issue-weaver"
                        allowClear
                      />
                    </div>
                  </div>

                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label red-label">Pu.BillNo</span>
                    <div className="classic-erp-control">
                      <input
                        type="text"
                        className="classic-erp-input font-bold uppercase"
                        value={form.puBillNo}
                        onChange={(e) => setField('puBillNo', e.target.value)}
                        onClick={() => {
                          if (!locked && !form.puBillNo) {
                            fetchPurchases();
                            fetchInventory();
                            setPuBillLookupOpen(true);
                          }
                        }}
                        disabled={locked}
                        placeholder="Enter or click 🔍 to select Purchase Bill…"
                      />
                      {!locked && (
                        <button
                          type="button"
                          title="Browse Purchase Bills"
                          onClick={() => {
                            fetchPurchases();
                            fetchInventory();
                            setPuBillLookupOpen(true);
                          }}
                          className="erp-job-issue-add-btn"
                        >
                          <Search size={11} /> Find
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label red-label">Item Name</span>
                    <div className="classic-erp-control">
                      <ERPCombobox
                        value={form.itemName}
                        onChange={handleItemChange}
                        disabled={locked}
                        options={itemOptions}
                        placeholder="Select Item Name…"
                        recentKey="mill-issue-item"
                        allowClear
                      />
                    </div>
                  </div>

                  <div className="erp-job-issue-metrics">
                    {/* Column 1: Iss Pcs & Iss Qty */}
                    <div className="flex flex-col gap-1">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">Iss Pcs</span>
                        <input
                          type="number"
                          className="classic-erp-input text-right font-bold"
                          value={form.issPcs}
                          onChange={(e) => setField('issPcs', e.target.value)}
                          disabled={locked}
                        />
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label red-label">Iss Qty</span>
                        <input
                          type="number"
                          step="0.001"
                          className="classic-erp-input text-right font-bold"
                          value={form.issQty}
                          onChange={(e) => setField('issQty', e.target.value)}
                          disabled={locked}
                          required
                        />
                      </div>
                    </div>

                    {/* Column 2: Pu.Rate & JobRate */}
                    <div className="flex flex-col gap-1">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">Pu.Rate</span>
                        <input
                          type="number"
                          step="0.01"
                          className="classic-erp-input text-right"
                          value={form.puRate}
                          onChange={(e) => setField('puRate', e.target.value)}
                          disabled={locked}
                        />
                      </div>
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">JobRate</span>
                        <input
                          type="number"
                          step="0.01"
                          className="classic-erp-input text-right font-bold"
                          value={form.jobRate}
                          onChange={(e) => setField('jobRate', e.target.value)}
                          disabled={locked}
                        />
                      </div>
                    </div>

                    {/* Column 3: Lot No. */}
                    <div className="flex flex-col gap-1">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label red-label">Lot No.</span>
                        <ERPCombobox
                          value={form.lotId}
                          onChange={(val) => applyLot(val)}
                          disabled={locked}
                          options={lotOptions}
                          placeholder="Select lot…"
                          recentKey="mill-issue-lot"
                          allowClear
                        />
                      </div>
                    </div>
                  </div>

                  <div className="classic-erp-field classic-erp-field--lg mt-4">
                    <span className="classic-erp-label">Remark</span>
                    <div className="classic-erp-control classic-erp-control--stack">
                      <input
                        type="text"
                        className="classic-erp-input"
                        value={form.remark1}
                        onChange={(e) => setField('remark1', e.target.value)}
                        disabled={locked}
                      />
                      <input
                        type="text"
                        className="classic-erp-input"
                        value={form.remark2}
                        onChange={(e) => setField('remark2', e.target.value)}
                        disabled={locked}
                      />
                    </div>
                  </div>

                  {selectedLot && (
                    <div className="erp-job-issue-stock">
                      Stock: {Number(selectedLot.remainingPcs || 0)} pcs ·{' '}
                      {Number(selectedLot.remainingMtrs || 0).toFixed(2)} mts
                    </div>
                  )}
                </div>

                <aside className="erp-job-issue-side">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">ProcType</span>
                    <ERPSelect
                      className="classic-erp-select"
                      value={form.procType}
                      onChange={(e) => setField('procType', e.target.value)}
                      options={processOptions}
                      disabled={locked}
                    />
                  </div>



                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Finish</span>
                    <ERPSelect
                      className="classic-erp-select"
                      value={form.finish}
                      onChange={(e) => setField('finish', e.target.value)}
                      options={FINISH_OPTIONS}
                      disabled={locked}
                    />
                  </div>

                  <div className="erp-job-issue-sort">
                    <button
                      type="button"
                      className={`classic-erp-btn ${lotSort === 'asc' ? 'btn-blue' : ''}`}
                      onClick={() => setLotSort('asc')}
                    >
                      Asc
                    </button>
                    <button
                      type="button"
                      className={`classic-erp-btn ${lotSort === 'desc' ? 'btn-blue' : ''}`}
                      onClick={() => setLotSort('desc')}
                    >
                      Desc
                    </button>
                  </div>

                  <button
                    type="button"
                    className="classic-erp-btn"
                    disabled={locked || saving}
                    onClick={() => handleSave(null, { keepOpen: true })}
                  >
                    Create Multi Challan
                  </button>

                  <p className="erp-job-issue-hint">F1 &gt; SelectAll / F2 &gt; UnSelectAll</p>
                </aside>
              </div>

              <div className="classic-erp-form-footer erp-job-issue-footer shrink-0">
                <button type="button" className="classic-erp-btn" onClick={handleNew} disabled={saving}>
                  New
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={handleEdit}
                  disabled={saving || mode !== 'View' || !selectedJobId}
                >
                  Edit
                </button>
                <button type="submit" className="classic-erp-btn btn-blue" disabled={saving || locked}>
                  <SaveButtonLabel saving={saving} label="Save" />
                </button>
                <button type="button" className="classic-erp-btn" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => {
                    setFindOpen(true);
                    setMode('View');
                  }}
                  disabled={saving}
                >
                  Find
                </button>
                <button type="button" className="classic-erp-btn" onClick={handleDelete} disabled={saving}>
                  Delete
                </button>
                <button type="button" className="classic-erp-btn" onClick={onClose} disabled={saving}>
                  Exit
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => toast.info('Open Mill Receive for receipt detail')}
                >
                  ReceiptDetail
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => toast.info('Last year lot — use Lot No. search')}
                >
                  LastYearLot
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => {
                    setFindOpen(true);
                    setMode('View');
                  }}
                >
                  Sp.Find
                </button>
                <button type="button" className="classic-erp-btn" onClick={handlePrint}>
                  Print
                </button>
              </div>
            </form>
          </div>
        )}
      </ErpWindowedModal>

      <AccountMasterModal
        isOpen={accountModal.open}
        onClose={() => setAccountModal({ open: false, initialData: null })}
        initialData={accountModal.initialData}
        onSuccess={handleMillSuccess}
      />

      <PuBillLookupModal
        isOpen={puBillLookupOpen}
        onClose={() => setPuBillLookupOpen(false)}
        weaver={form.weaver}
        inventoryLots={inventoryLots}
        purchases={purchases}
        items={items}
        onSelect={applyPuBillRow}
      />

      {printOpen && (
        <JobWorkPrint variant="millIssue" data={printData} onClose={() => setPrintOpen(false)} />
      )}
    </>
  );
};

export default IssueModal;
