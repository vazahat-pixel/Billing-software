import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ERPSelect } from '../../components/forms/FormElements';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifySuccess, notifyError, notifyWarning, notifyInfo } from '../../utils/notify';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import { Trash2, Plus, Search } from 'lucide-react';
import PuBillLookupModal from './PuBillLookupModal';
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

// chlnNo/cno are derived per row position (see calc.linesWithAmt) — never stored here.
const blankLine = () => ({
  id: Math.random().toString(),
  itemId: '',
  lotId: '',
  lotNo: '',
  itemName: '',
  pcs: '',
  cut: '',
  qty: '',
  rate: '',
  fabRate: '',
  narration: '',
  jobId: '',
});

const GST_TYPE_OPTIONS = [
  { value: 'INVOICE IN STATE', label: 'INVOICE IN STATE' },
  { value: 'OUT OF STATE', label: 'OUT OF STATE' },
  { value: 'EXEMPT', label: 'EXEMPT' },
];

export default function UpdateModal({ isOpen, onClose, selectedBook = null }) {
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

  const [mode, setMode] = useState('Add'); // Add | Edit | View
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);

  // Form Header State
  const [header, setHeader] = useState({
    challanNo: '1',
    challanNoSuffix: '',
    date: today(),
    reFinish: '',
    gstType: 'INVOICE IN STATE',
    gstin: '',
    partyId: '',
    broker: '',
    hsnCd: '5407',
    book: selectedBook || 'JOBWORK BOOK',
  });

  // Form Lines State
  const [lines, setLines] = useState([blankLine()]);

  // Form Footer State
  const [footer, setFooter] = useState({
    remark: '',
    note: '',
    transport: '',
    lrNo: '',
    baleNo: '',
    taxRate: '0',
  });

  const [selectedJobId, setSelectedJobId] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [lotLookupOpen, setLotLookupOpen] = useState(false);
  const [lotLookupTargetIdx, setLotLookupTargetIdx] = useState(null);
  // Last item touched in the grid — drives the live "Current Stock" strip, same as the
  // reference software: pick the item first, stock shows immediately, no purchase lookup needed.
  const [activeItemId, setActiveItemId] = useState('');

  const locked = mode === 'View';

  const partyOptions = useMemo(
    () =>
      (parties || [])
        .filter((p) => ['Job Worker', 'Both', 'Supplier'].includes(p.type) || (p.group || '').toUpperCase().includes('JOB'))
        .map((p) => ({
          value: p._id || p.id,
          label: p.name,
          gstin: p.gstin || '',
        })),
    [parties]
  );

  /** Address block shown under Job Party, matching the classic two-line party box. */
  const partyAddress = useMemo(() => {
    const p = (parties || []).find((x) => String(x._id || x.id) === String(header.partyId));
    if (!p) return '';
    return [p.address, p.city, p.state].filter(Boolean).join(', ');
  }, [parties, header.partyId]);

  const jobOptions = useMemo(() => {
    const list = [...(jobWorkEntries || [])];
    list.sort((a, b) => {
      const da = new Date(a.issueDate || a.createdAt || 0).getTime();
      const db = new Date(b.issueDate || b.createdAt || 0).getTime();
      return db - da;
    });
    return list.map((j) => ({
      value: j._id || j.id,
      label: `${j.jobCardNo || j.challanNo || '-'} · ${j.workerId?.name || 'Mill'} · ${Number(j.issueQty || 0).toFixed(2)} mts`,
    }));
  }, [jobWorkEntries]);

  // One Challan No can carry several item lines to the same Job Party in a single save —
  // each line becomes its own trackable Job Card (Job Receive matches against it later),
  // but they all stay visibly grouped under the same parent number: 125, 125/1, 125/2 …
  const baseChallan = header.challanNo === 'AUTO' || !header.challanNo
    ? 'AUTO'
    : `${header.challanNo}${header.challanNoSuffix ? '-' + header.challanNoSuffix : ''}`;

  // Derived Grid and Tax Calculations
  const calc = useMemo(() => {
    const linesWithAmt = lines.map((l, idx) => {
      const qty = Number(l.qty) || 0;
      // Amount is always Qty × Fab.Rt (fabric rate) — the Rate column is not used for billing.
      const rateVal = Number(l.fabRate) || 0;
      const jobAmt = Number((qty * rateVal).toFixed(2));
      const cno = baseChallan === 'AUTO' ? '' : idx === 0 ? '' : `/${idx}`;
      const chlnNo = baseChallan === 'AUTO' ? 'AUTO' : `${baseChallan}${cno}`;
      return { ...l, jobAmt, cno, chlnNo };
    });

    const gross = linesWithAmt.reduce((sum, l) => sum + l.jobAmt, 0);
    const taxRate = Number(footer.taxRate || 0);

    let cgstPct = 0;
    let sgstPct = 0;
    let igstPct = 0;

    if (header.gstType === 'INVOICE IN STATE') {
      cgstPct = taxRate / 2;
      sgstPct = taxRate / 2;
    } else if (header.gstType === 'OUT OF STATE') {
      igstPct = taxRate;
    }

    const cgstAmt = Number(((gross * cgstPct) / 100).toFixed(2));
    const sgstAmt = Number(((gross * sgstPct) / 100).toFixed(2));
    const igstAmt = Number(((gross * igstPct) / 100).toFixed(2));
    const totalGst = cgstAmt + sgstAmt + igstAmt;
    const net = Number((gross + totalGst).toFixed(2));

    const totalPcs = linesWithAmt.reduce((s, l) => s + (Number(l.pcs) || 0), 0);
    const totalQty = linesWithAmt.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const totalKgs = linesWithAmt.reduce((s, l) => s + (Number(l.kgs) || 0), 0);

    return {
      linesWithAmt,
      gross,
      cgstPct,
      cgstAmt,
      sgstPct,
      sgstAmt,
      igstPct,
      igstAmt,
      totalGst,
      net,
      totalPcs,
      totalQty,
      totalKgs,
    };
  }, [lines, footer.taxRate, header.gstType, baseChallan]);

  /** Total available stock for an item across ALL its open lots — not just what's in the grid. */
  const itemStockTotals = useCallback(
    (itemId) => {
      if (!itemId) return { pcs: 0, qty: 0, kgs: 0 };
      return (inventoryLots || []).reduce(
        (acc, lot) => {
          if (String(lot.itemId?._id || lot.itemId || '') !== String(itemId)) return acc;
          if (lot.status === 'Closed') return acc;
          if (lot.holdStatus && lot.holdStatus !== 'None') return acc;
          return {
            pcs: acc.pcs + (Number(lot.remainingPcs) || 0),
            qty: acc.qty + (Number(lot.remainingMtrs) || 0),
            kgs: acc.kgs + (Number(lot.remainingKgs ?? lot.totalKgs) || 0),
          };
        },
        { pcs: 0, qty: 0, kgs: 0 }
      );
    },
    [inventoryLots]
  );

  /** Item picker options — stock badge shown right on each row so a no-stock item is
   *  obvious before it's picked, not after. In-stock items sort to the top. */
  const itemOptions = useMemo(() => {
    const withStock = (items || []).map((it) => {
      const id = it._id || it.id;
      const stock = itemStockTotals(id);
      const hasStock = stock.pcs > 0 || stock.qty > 0;
      return {
        value: id,
        label: it.name || it.itemName || 'Item',
        _hasStock: hasStock,
        badge: hasStock
          ? { text: `${stock.qty > 0 ? stock.qty.toFixed(2) + ' qty' : stock.pcs + ' pcs'}`, tone: 'ok' }
          : { text: 'No Stock', tone: 'warn' },
      };
    });
    return withStock.sort((a, b) => {
      if (a._hasStock !== b._hasStock) return a._hasStock ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [items, itemStockTotals]);

  /** Earliest open lot for an item (FIFO) — auto-picked behind the scenes on Item Name select. */
  const resolveLotForItem = useCallback(
    (itemId, excludeLotIds = new Set()) => {
      const candidates = (inventoryLots || []).filter((lot) => {
        if (excludeLotIds.has(String(lot._id || lot.id))) return false;
        if (String(lot.itemId?._id || lot.itemId || '') !== String(itemId)) return false;
        if (lot.status === 'Closed') return false;
        if (lot.holdStatus && lot.holdStatus !== 'None') return false;
        return Number(lot.remainingMtrs || 0) > 0 || Number(lot.remainingPcs || 0) > 0;
      });
      candidates.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      return candidates[0] || null;
    },
    [inventoryLots]
  );

  /** Live balance for the item currently being worked on — the classic "Current Stock" strip. */
  const currentStock = useMemo(() => itemStockTotals(activeItemId), [itemStockTotals, activeItemId]);

  /** Recent challans for the active item — the compact history panel below the grid. */
  const recentChallans = useMemo(() => {
    if (!activeItemId) return [];
    return (jobWorkEntries || [])
      .filter((j) => String(j.lotId?.itemId?._id || j.lotId?.itemId || '') === String(activeItemId))
      .sort((a, b) => new Date(b.issueDate || b.createdAt || 0) - new Date(a.issueDate || a.createdAt || 0))
      .slice(0, 15)
      .map((j) => {
        const pcs = Number(j.issuePcs || 0);
        const qty = Number(j.issueQty || 0);
        return {
          id: j._id || j.id,
          chlnNo: j.jobCardNo || j.challanNo || '',
          chlnDate: j.issueDate || j.createdAt || '',
          pcs,
          cut: pcs > 0 ? Number((qty / pcs).toFixed(3)) : 0,
          qty,
          jRate: j.jobRate ?? j.processCharges ?? 0,
          narration: j.remark || j.remarks || '',
        };
      });
  }, [jobWorkEntries, activeItemId]);

  useEffect(() => {
    if (!isOpen) return;
    setBootLoading(true);
    setMode('Add');
    handleNew();
    Promise.all([fetchParties(), fetchItems(), fetchPurchases(), fetchInventory(), fetchJobs()])
      .catch(() => {})
      .finally(() => setBootLoading(false));
  }, [isOpen, selectedBook]);

  const handlePartyChange = (partyId) => {
    const party = partyOptions.find((p) => String(p.value) === String(partyId));
    setHeader((h) => ({
      ...h,
      partyId: partyId || '',
      gstin: party?.gstin || '',
    }));
  };

  const setLine = useCallback((idx, patch) => {
    setLines((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };

      const pcs = Number(merged.pcs) || 0;
      let qty = Number(merged.qty) || 0;
      let cut = Number(merged.cut) || 0;

      if (patch.hasOwnProperty('pcs') || patch.hasOwnProperty('cut')) {
        qty = pcs * cut;
        merged.qty = qty > 0 ? String(qty) : merged.qty;
      } else if (patch.hasOwnProperty('qty')) {
        if (pcs > 0) {
          cut = Number((qty / pcs).toFixed(3));
          merged.cut = cut > 0 ? String(cut) : merged.cut;
        }
      }

      next[idx] = merged;
      return next;
    });
  }, []);

  /** Item Name picked directly on a grid row — FIFO-resolves the lot behind the scenes,
   *  no purchase-bill lookup required. Also drives the live Current Stock strip. */
  const handleLineItemChange = (idx, itemId) => {
    setActiveItemId(itemId || '');
    if (!itemId) {
      setLines((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], itemId: '', itemName: '', lotId: '', lotNo: '', fabRate: '' };
        return next;
      });
      return;
    }
    const item = (items || []).find((it) => String(it._id || it.id) === String(itemId));
    const itemName = item?.name || item?.itemName || '';
    const usedLotIds = new Set(
      lines
        .filter((_, i) => i !== idx)
        .map((l) => String(l.lotId))
        .filter(Boolean)
    );
    const lot = resolveLotForItem(itemId, usedLotIds);
    setLines((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        itemId,
        itemName,
        lotId: lot ? String(lot._id || lot.id) : '',
        lotNo: lot ? lot.lotId || '' : '',
        fabRate: lot ? String(lot.rate || lot.purchaseRate || '') : next[idx].fabRate,
      };
      return next;
    });
    if (!lot) {
      notifyWarning(`No available stock for "${itemName}" — check inventory`);
    }
  };

  const addLine = () => {
    setLines((prev) => [...prev, blankLine()]);
  };

  const removeLine = (idx) => {
    setLines((prev) => (prev.length <= 1 ? [blankLine()] : prev.filter((_, i) => i !== idx)));
  };

  const openLotLookup = (idx) => {
    if (locked) return;
    setLotLookupTargetIdx(idx);
    setLotLookupOpen(true);
  };

  const handleLotSelect = (row) => {
    const matchedLot = (inventoryLots || []).find((l) => String(l._id || l.id) === String(row.lotId));
    const itemId = matchedLot?.itemId?._id || matchedLot?.itemId || '';
    if (itemId) setActiveItemId(String(itemId));

    setLines((prev) => {
      const next = [...prev];
      const targetIdx = lotLookupTargetIdx != null ? lotLookupTargetIdx : prev.findIndex((l) => !l.lotId);

      const pcs = row.balPcs || 0;
      const qty = row.balMts || 0;
      const cut = pcs > 0 ? Number((qty / pcs).toFixed(3)) : 0;

      const lineData = {
        id: next[targetIdx]?.id || Math.random().toString(),
        itemId: itemId ? String(itemId) : '',
        lotId: row.lotId || '',
        lotNo: row.lotCode || '',
        itemName: row.itemName || '',
        pcs: pcs > 0 ? String(pcs) : '',
        cut: cut > 0 ? String(cut) : '',
        qty: qty > 0 ? String(qty) : '',
        rate: '',
        fabRate: row.puRate > 0 ? String(row.puRate) : '',
        narration: '',
        jobId: '',
      };

      if (targetIdx === -1) {
        return [...prev, lineData];
      } else {
        next[targetIdx] = lineData;
        return next;
      }
    });
  };

  const handleNew = () => {
    setMode('Add');
    setSelectedJobId('');
    setFindOpen(false);
    setActiveItemId('');
    setHeader({
      challanNo: '1',
      challanNoSuffix: '',
      date: today(),
      reFinish: '',
      gstType: 'INVOICE IN STATE',
      gstin: '',
      partyId: '',
      broker: '',
      hsnCd: '5407',
      book: selectedBook || 'JOBWORK BOOK',
    });
    setFooter({
      remark: '',
      note: '',
      transport: '',
      lrNo: '',
      baleNo: '',
      taxRate: '0',
    });
    setLines([blankLine()]);
  };

  const handleEdit = () => {
    if (!selectedJobId) return notifyWarning('Find a challan first');
    setMode('Edit');
  };

  const handleCancel = () => {
    if (selectedJobId) {
      loadJob(selectedJobId);
      setMode('View');
    } else {
      handleNew();
    }
  };

  const loadJob = (id) => {
    setSelectedJobId(id);
    if (!id) return;
    const job = jobWorkEntries.find((j) => String(j._id || j.id) === String(id));
    if (!job) return;

    setMode('View');
    setFindOpen(true);
    const remarks = String(job.remark || job.remarks || '');
    setHeader({
      challanNo: job.challanNo || job.jobCardNo || '',
      challanNoSuffix: '',
      date: job.issueDate ? String(job.issueDate).slice(0, 10) : today(),
      reFinish: job.reFinish || '',
      gstType: job.gstType || 'INVOICE IN STATE',
      gstin: job.workerId?.gstin || '',
      partyId: job.workerId?._id || job.workerId || '',
      broker: job.broker || '',
      hsnCd: job.hsnCd || '5407',
      book: job.book || 'JOBWORK BOOK',
    });

    const lineItemId = job.lotId?.itemId?._id || job.lotId?.itemId || '';
    const itemLine = {
      id: Math.random().toString(),
      itemId: lineItemId ? String(lineItemId) : '',
      lotId: job.lotId?._id || job.lotId || '',
      lotNo: job.lotId?.lotId || '',
      chlnNo: job.purchaseBillNo || '',
      itemName: job.lotId?.itemName || job.lotId?.itemId?.name || '',
      pcs: String(job.issuePcs || 0),
      cut: job.issuePcs > 0 ? String((job.issueQty / job.issuePcs).toFixed(3)) : '',
      qty: String(job.issueQty || 0),
      rate: String(job.jobRate || 0),
      fabRate: String(job.purchaseRate || 0),
      narration: remarks,
      jobId: job._id,
    };
    setLines([itemLine]);
    setActiveItemId(lineItemId ? String(lineItemId) : '');

    setFooter({
      remark: remarks,
      note: job.note || '',
      transport: job.transport || '',
      lrNo: job.lrNo || '',
      baleNo: job.baleNo || '',
      taxRate: job.taxRate != null ? String(job.taxRate) : '0',
    });
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (locked) {
      notifyWarning('Click Edit or New before saving');
      return;
    }
    if (!header.partyId) {
      notifyWarning('Select Job Party');
      return;
    }

    const activeLines = calc.linesWithAmt.filter((l) => l.lotId && Number(l.qty) > 0);
    if (activeLines.length === 0) {
      notifyWarning('Add at least one line — pick an Item and enter quantity');
      return;
    }

    // Two lines can legally draw from the SAME lot (e.g. same item split across rows) —
    // check the combined draw per lot against its real remaining stock, not line-by-line.
    const qtyByLot = new Map();
    activeLines.forEach((l) => {
      const key = String(l.lotId);
      qtyByLot.set(key, (qtyByLot.get(key) || 0) + Number(l.qty || 0));
    });
    const overIssued = [...qtyByLot.entries()].find(([lotId, totalQty]) => {
      const lot = (inventoryLots || []).find((iv) => String(iv._id || iv.id) === lotId);
      return lot && totalQty > Number(lot.remainingMtrs || 0) + 0.0001;
    });
    if (overIssued) {
      const [lotId, totalQty] = overIssued;
      const lot = (inventoryLots || []).find((iv) => String(iv._id || iv.id) === lotId);
      notifyWarning(`Lot ${lot?.lotId || lotId} — combined Qty ${totalQty.toFixed(2)} exceeds available stock (${Number(lot?.remainingMtrs || 0).toFixed(2)})`);
      return;
    }

    setSaving(true);
    let ok = 0;
    try {
      // Each line saves as its own Job Card — jobCardNo already carries the per-line
      // suffix computed in `calc` (125, 125/1, 125/2 …), so a multi-item challan no
      // longer collides on a duplicate number the way a single shared value would.
      for (const line of activeLines) {
        // Same source as the on-screen Taxable/NetAmt calc — Fab.Rt only, not Rate.
        // Keeping these in sync means what you saved always matches what you saw before saving.
        const effectiveRate = Number(line.fabRate) || 0;

        await issueToMill({
          jobCardNo: line.chlnNo,
          issueDate: header.date,
          date: header.date,
          lotId: line.lotId,
          workerId: header.partyId,
          processType: 'Process Charge',
          issueQty: Number(line.qty) || 0,
          issuePcs: Number(line.pcs) || 0,
          weaver: '',
          purchaseBillNo: line.chlnNo || '',
          purchaseRate: Number(line.fabRate) || 0,
          jobRate: effectiveRate,
          processCharges: effectiveRate,
          chargesRate: effectiveRate,
          remark: footer.remark || '',
          remarks: footer.remark || '',
          transport: footer.transport || '',
          note: footer.note || '',
          lrNo: footer.lrNo || '',
          baleNo: footer.baleNo || '',
          gstType: header.gstType,
          taxRate: Number(footer.taxRate),
          reFinish: header.reFinish,
          broker: header.broker,
          hsnCd: header.hsnCd,
        });
        ok += 1;
      }
      notifySuccess(`Job Issue saved — ${ok} challan(s) issued`);
      handleNew();
      setMode('View');
      await Promise.all([fetchJobs(), fetchInventory()]);
    } catch (err) {
      notifyError(err, ok > 0 ? `Partial save: ${ok} issued, then failed` : 'Failed to save job issue');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Print payload built from the live header + calc.linesWithAmt the grid is already
   * showing, so the challan sheet always matches the form exactly.
   */
  const printData = useMemo(() => {
    const party = partyOptions.find((p) => String(p.value) === String(header.partyId));
    const rows = (calc.linesWithAmt || []).filter(
      (l) => l.itemName || Number(l.pcs) || Number(l.qty)
    );
    return {
      book: selectedBook || header.book || 'JOBWORK BOOK',
      partyName: party?.label || '',
      partyPhone: header.partyPhone || '',
      gstin: header.gstin,
      stateCode: header.stateCode || (header.gstin ? String(header.gstin).slice(0, 2) : ''),
      broker: header.broker,
      challanNo: [header.challanNo, header.challanNoSuffix].filter(Boolean).join('-'),
      date: header.date,
      lines: rows.map((l) => ({ ...l, hsnCd: l.hsnCd || header.hsnCd })),
    };
  }, [calc, header, partyOptions, selectedBook]);

  const handlePrint = () => {
    if (!printData.lines.length) return notifyWarning('Nothing to print — add at least one line');
    setPrintOpen(true);
  };

  const titleBook = selectedBook || header.book || 'JOBWORK BOOK';

  const gridCols = [
    { key: 'cno', label: 'CNo', w: 'w-14', readOnly: true },
    { key: 'chlnNo', label: 'ChlnNo', w: 'w-24', readOnly: true },
    { key: 'itemName', label: 'Item Name', w: 'flex-1', itemPicker: true },
    { key: 'pcs', label: 'Pcs', w: 'w-16', align: 'right' },
    { key: 'cut', label: 'Cut', w: 'w-16', align: 'right' },
    { key: 'qty', label: 'Qty', w: 'w-20', align: 'right' },
    { key: 'rate', label: 'Rate', w: 'w-20', align: 'right' },
    { key: 'fabRate', label: 'Fab.Rt', w: 'w-20', align: 'right' },
    { key: 'narration', label: 'Narration 1', w: 'w-36' },
  ];

  return (
    <>
      <ErpWindowedModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Additional Job Issue [ ${titleBook} ]`}
        windowId="jobIssue"
        bare
      >
        {({ WindowControls }) => (
          <div className="classic-erp-window erp-density erp-job-issue-window flex flex-col h-full min-h-0 !max-h-none">
            <ErpBusyOverlay show={bootLoading} message="Loading job issue registry…" />
            <ErpBusyOverlay show={!bootLoading && saving} message="Saving job issue entries…" />

            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">
                Additional Job Issue [ {titleBook} ]
              </span>
              <WindowControls />
            </div>

            <form
              onSubmit={handleSave}
              className="classic-erp-body erp-job-issue-body flex-1 overflow-hidden min-h-0 flex flex-col justify-between"
            >
              {findOpen && (
                <div className="classic-erp-frame erp-job-issue-find shrink-0">
                  <div className="classic-erp-field classic-erp-field--lg">
                    <span className="classic-erp-label blue-label">Find</span>
                    <ERPSelect
                      className="classic-erp-select"
                      value={selectedJobId}
                      onChange={(e) => loadJob(e.target.value)}
                      options={jobOptions}
                      placeholder="- Select Job Issue Challan -"
                      recentKey="job-issue-find"
                    />
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="classic-erp-frame erp-job-issue-header shrink-0">
                <div className="erp-job-issue-header-grid">
                  <div className="classic-erp-stack">
                    <div className="classic-erp-field classic-erp-field--lg">
                      <span className="classic-erp-label red-label">Challan No</span>
                      <div className="flex gap-1 items-center">
                        <input
                          type="text"
                          className="classic-erp-input text-center font-bold"
                          style={{ width: 110, flex: '0 0 110px' }}
                          value={header.challanNo}
                          onChange={(e) => setHeader({ ...header, challanNo: e.target.value })}
                          disabled={locked}
                        />
                        <input
                          type="text"
                          className="classic-erp-input text-center"
                          style={{ width: 52, flex: '0 0 52px' }}
                          value={header.challanNoSuffix}
                          onChange={(e) => setHeader({ ...header, challanNoSuffix: e.target.value })}
                          disabled={locked}
                        />
                        <span className="text-slate-400 font-bold ml-1">-</span>
                      </div>
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg mt-1">
                      <span className="classic-erp-label red-label">Date</span>
                      <div className="flex gap-2 items-center">
                        <input
                          type="date"
                          className="classic-erp-input erp-job-issue-date"
                          value={header.date}
                          onChange={(e) => setHeader({ ...header, date: e.target.value })}
                          disabled={locked}
                          required
                        />
                        <span className="erp-job-issue-weekday">{weekday(header.date)}</span>
                        <span className="classic-erp-label !w-auto ml-3">ReFinish</span>
                        <input
                          type="text"
                          className="classic-erp-input text-center font-bold"
                          style={{ width: 72, flex: '0 0 72px' }}
                          value={header.reFinish}
                          onChange={(e) => setHeader({ ...header, reFinish: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg mt-1.5">
                      <span className="classic-erp-label red-label">Job Party</span>
                      <ERPCombobox
                        value={header.partyId}
                        onChange={handlePartyChange}
                        disabled={locked}
                        options={partyOptions}
                        placeholder="Search job worker / mill…"
                        recentKey="job-issue-party"
                        allowClear
                      />
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg">
                      <span className="classic-erp-label" />
                      <div className="erp-job-issue-party-address">{partyAddress || ','}</div>
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg mt-1">
                      <span className="classic-erp-label">Broker</span>
                      <input
                        type="text"
                        className="classic-erp-input font-bold"
                        value={header.broker}
                        onChange={(e) => setHeader({ ...header, broker: e.target.value })}
                        disabled={locked}
                        placeholder="Search Broker…"
                      />
                    </div>

                    <div className="classic-erp-meta-grid erp-job-issue-meta-row mt-1">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">HSN CODE</span>
                        <input
                          type="text"
                          className="classic-erp-input text-center font-mono"
                          value={header.hsnCd}
                          onChange={(e) => setHeader({ ...header, hsnCd: e.target.value })}
                          disabled={locked}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="erp-job-issue-f4hint">F4 To Qty Detail Entry</span>
                      <span className="erp-job-issue-stockstrip">
                        Current Stock : Pcs: {currentStock.pcs} &nbsp; Qty: {currentStock.qty.toFixed(2)} &nbsp; Kgs: {currentStock.kgs.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* GST Panel — flat, compact column matching the classic reference layout */}
                  <div className="classic-erp-stack erp-job-issue-tax-col">
                    <div className="erp-job-issue-tax-head">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">GstType</span>
                        <ERPSelect
                          className="classic-erp-select"
                          value={header.gstType}
                          onChange={(e) => setHeader({ ...header, gstType: e.target.value })}
                          options={GST_TYPE_OPTIONS}
                          disabled={locked}
                        />
                      </div>
                      <span className="erp-job-issue-gstin-badge">GSTIN:-{header.gstin || '—'}</span>
                    </div>

                    <div className="erp-job-issue-taxbox mt-2">
                      <div className="erp-job-issue-sumrow mt-1.5">
                        <span>Total Amount</span>
                        <input type="text" className="classic-erp-input font-mono" value={calc.gross.toFixed(2)} readOnly />
                      </div>
                      <div className="erp-job-issue-sumrow mt-2 border-t pt-1.5">
                        <span className="!text-[12px] !text-blue-900 font-bold">NetAmt</span>
                        <input
                          type="text"
                          className="classic-erp-input font-mono !text-blue-900 !text-[12px] font-bold"
                          value={calc.gross.toFixed(2)}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {!locked && (
                  <div className="erp-job-issue-toolbar">
                    <button type="button" className="classic-erp-btn" onClick={addLine}>
                      <Plus size={12} className="inline mr-0.5" /> Add Line
                    </button>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      Grid Row Count: {lines.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Grid */}
              <div className="classic-erp-frame erp-job-issue-grid-wrap flex-1 min-h-[220px] flex flex-col">
                <div className="classic-erp-table-container erp-job-issue-grid flex-1 overflow-auto">
                  <table className="classic-erp-table erp-job-issue-table w-full">
                    <thead>
                      <tr>
                        <th className="w-8">Sno</th>
                        {gridCols.map((c) => (
                          <th key={c.key} className={`${c.w} ${c.align === 'right' ? 'text-right' : ''}`}>
                            {c.label}
                          </th>
                        ))}
                        {!locked && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {calc.linesWithAmt.map((line, idx) => (
                        <tr key={line.id}>
                          <td className="text-center text-slate-500 font-bold">{idx + 1}</td>
                          {gridCols.map((c) => {
                            if (c.key === 'itemName') {
                              return (
                                <td key={c.key} className={c.w}>
                                  <div className="flex items-center gap-0.5" title={line.lotNo ? `Auto-picked lot: ${line.lotNo}` : ''}>
                                    <div className="flex-1 min-w-0">
                                      <ERPCombobox
                                        value={line.itemId}
                                        onChange={(val) => handleLineItemChange(idx, val)}
                                        disabled={locked}
                                        options={itemOptions}
                                        placeholder="Select Item Name…"
                                        recentKey="job-issue-item"
                                        allowClear
                                      />
                                    </div>
                                    {!locked && (
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-blue-600 shrink-0 px-0.5"
                                        onClick={() => openLotLookup(idx)}
                                        title="Advanced: pick a specific lot manually"
                                      >
                                        <Search size={11} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            return (
                              <td key={c.key} className={c.w}>
                                <input
                                  type={c.align === 'right' ? 'number' : 'text'}
                                  step={c.key === 'cut' ? '0.001' : c.key === 'qty' ? '0.01' : undefined}
                                  className={`classic-erp-input w-full ${c.align === 'right' ? 'text-right font-mono' : ''} ${c.readOnly ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                  value={line[c.key] || ''}
                                  onChange={(e) => setLine(idx, { [c.key]: e.target.value })}
                                  readOnly={c.readOnly || locked}
                                  disabled={c.readOnly || locked}
                                />
                              </td>
                            );
                          })}
                          {!locked && (
                            <td className="text-center">
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-800 disabled:opacity-30"
                                onClick={() => removeLine(idx)}
                                disabled={locked}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="erp-job-issue-totalbar">
                  <span>TOTAL Pcs : {calc.totalPcs}</span>
                  <span>/</span>
                  <span>Qty : {calc.totalQty.toFixed(2)}</span>
                  <span>/</span>
                  <span>Kgs : {calc.totalKgs.toFixed(2)}</span>
                </div>
              </div>

              {/* Recent Challans — history for the item currently being issued */}
              {activeItemId && (
                <div className="erp-job-issue-history shrink-0">
                  <div className="erp-job-issue-history-head">
                    <span>
                      Recent Challans — {itemOptions.find((o) => String(o.value) === String(activeItemId))?.label || 'Item'}
                    </span>
                    <button
                      type="button"
                      className="erp-job-issue-history-refresh"
                      onClick={async () => {
                        await fetchJobs();
                        notifySuccess('Refreshed');
                      }}
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="erp-job-issue-history-body">
                    <table className="erp-job-issue-history-table">
                      <thead>
                        <tr>
                          <th>ChlnNo</th>
                          <th>ChlnDate</th>
                          <th className="text-right">Pcs</th>
                          <th className="text-right">Cut</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">J.Rate</th>
                          <th>Narration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentChallans.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center text-slate-400 py-2">
                              No previous challans for this item
                            </td>
                          </tr>
                        ) : (
                          recentChallans.map((r) => (
                            <tr key={r.id}>
                              <td className="font-bold">{r.chlnNo}</td>
                              <td>{r.chlnDate ? new Date(r.chlnDate).toLocaleDateString('en-IN') : ''}</td>
                              <td className="text-right font-mono">{r.pcs}</td>
                              <td className="text-right font-mono">{r.cut.toFixed(2)}</td>
                              <td className="text-right font-mono">{r.qty.toFixed(3)}</td>
                              <td className="text-right font-mono">{Number(r.jRate).toFixed(2)}</td>
                              <td className="truncate">{r.narration}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="classic-erp-frame erp-job-issue-footer-grid shrink-0">
                <div className="classic-erp-stack">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Remark</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.remark}
                      onChange={(e) => setFooter({ ...footer, remark: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="classic-erp-field mt-1">
                    <span className="classic-erp-label">Transport</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.transport}
                      onChange={(e) => setFooter({ ...footer, transport: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>

                <div className="classic-erp-stack">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Note</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.note}
                      onChange={(e) => setFooter({ ...footer, note: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="classic-erp-field mt-1">
                    <span className="classic-erp-label">LrNo</span>
                    <input
                      type="text"
                      className="classic-erp-input"
                      value={footer.lrNo}
                      onChange={(e) => setFooter({ ...footer, lrNo: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>

                <div className="classic-erp-stack justify-end">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">BaleNo</span>
                    <input
                      type="text"
                      className="classic-erp-input text-center font-bold"
                      value={footer.baleNo}
                      onChange={(e) => setFooter({ ...footer, baleNo: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
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
                <button type="button" className="classic-erp-btn btn-red" disabled={saving || locked || !selectedJobId}>
                  Delete
                </button>
                <button type="button" className="classic-erp-btn" onClick={onClose}>
                  Exit
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => notifyInfo('JobCard Reports — coming soon')}
                >
                  JobCard Reports
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => notifyInfo('Open Mill Receive for receipt detail')}
                >
                  ReceiptDetail
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  disabled={saving}
                  onClick={async () => {
                    await Promise.all([fetchJobs(), fetchInventory(), fetchPurchases()]);
                    notifySuccess('Refreshed');
                  }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => notifyInfo('Last year lot — use CNo lookup')}
                >
                  LastYear
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
                  Sp.FInd
                </button>
                {/* Prints whatever the form currently shows, so an unsaved challan can be
                    previewed too — handlePrint guards against an empty grid. */}
                <button type="button" className="classic-erp-btn" onClick={handlePrint}>
                  Print
                </button>
              </div>
            </form>
          </div>
        )}
      </ErpWindowedModal>

      <PuBillLookupModal
        isOpen={lotLookupOpen}
        onClose={() => setLotLookupOpen(false)}
        weaver=""
        inventoryLots={inventoryLots}
        purchases={purchases}
        items={items}
        onSelect={handleLotSelect}
      />

      {printOpen && (
        <JobWorkPrint variant="jobIssue" data={printData} onClose={() => setPrintOpen(false)} />
      )}
    </>
  );
}
