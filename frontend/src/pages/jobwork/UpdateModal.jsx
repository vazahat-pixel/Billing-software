import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ErpTopLayer from '../../components/erp/ErpTopLayer';
import { ERPSelect } from '../../components/forms/FormElements';
import { ERPCombobox } from '../../components/erp';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifySuccess, notifyError, notifyWarning, notifyInfo } from '../../utils/notify';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';
import { Trash2, Plus, Search } from 'lucide-react';
import PuBillLookupModal from './PuBillLookupModal';
import { buildPuBillRows } from './puBillLookupUtils';
import JobWorkPrint from '../../components/print/JobWorkPrint';
import AccountMasterModal from '../masters/AccountMasterModal';

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

export default function UpdateModal({ isOpen, onClose, selectedBook = null, initialData = null }) {
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
  const [findSearch, setFindSearch] = useState('');
  const [findActiveIdx, setFindActiveIdx] = useState(0);
  const findInputRef = useRef(null);
  const kbRef = useRef({});
  const [printOpen, setPrintOpen] = useState(false);
  const [lotLookupOpen, setLotLookupOpen] = useState(false);
  const [lotLookupTargetIdx, setLotLookupTargetIdx] = useState(null);
  const [activeItemId, setActiveItemId] = useState('');
  const [accountModal, setAccountModal] = useState(null);

  const locked = mode === 'View';

  const bookJobs = useMemo(() => {
    const list = [...(jobWorkEntries || [])].sort((a, b) => {
      const numA = parseInt(String(a.challanNo || a.jobCardNo || '').replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.challanNo || b.jobCardNo || '').replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
      return new Date(a.issueDate || a.createdAt || 0) - new Date(b.issueDate || b.createdAt || 0);
    });
    const seen = new Set();
    const unique = [];
    for (const job of list) {
      const key = String(job.challanNo || job.jobCardNo || job._id || job.id || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(job);
    }
    return unique;
  }, [jobWorkEntries]);

  const filteredChallans = useMemo(() => {
    const q = findSearch.trim().toLowerCase();
    if (!q) return bookJobs;
    return bookJobs.filter((j) => {
      const chNo = String(j.challanNo || j.jobCardNo || '').toLowerCase();
      const numOnly = chNo.replace(/\D/g, '');
      const mill = String(j.workerId?.name || '').toLowerCase();
      const item = String(j.lotId?.itemName || '').toLowerCase();
      return chNo.includes(q) || numOnly.includes(q) || mill.includes(q) || item.includes(q);
    });
  }, [bookJobs, findSearch]);

  const handleOpenFindModal = () => {
    setFindSearch('');
    const currentIdx = bookJobs.findIndex((j) =>
      String(j._id || j.id) === String(selectedJobId) ||
      String(j.challanNo || j.jobCardNo || '').trim() === String(header.challanNo || '').trim()
    );
    setFindActiveIdx(currentIdx >= 0 ? currentIdx : Math.max(0, bookJobs.length - 1));
    setFindOpen(true);
    setTimeout(() => {
      findInputRef.current?.focus();
      try { findInputRef.current?.select(); } catch {}
    }, 50);
  };

  const handleFindKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setFindOpen(false);
      return;
    }

    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.min(prev + 1, filteredChallans.length - 1));
      return;
    }

    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.min(prev + 1, filteredChallans.length - 1));
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      setFindActiveIdx((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const job = filteredChallans[findActiveIdx];
      if (job) {
        loadJob(job._id || job.id, 'View');
        setFindOpen(false);
        notifySuccess(`Challan #${job.challanNo || job.jobCardNo} loaded (View mode)`);
        focusChallanNo();
      }
    }
  };

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
  const selectedParty = useMemo(() => {
    return (parties || []).find((x) => String(x._id || x.id) === String(header.partyId));
  }, [parties, header.partyId]);

  const partyAddress = useMemo(() => {
    if (!selectedParty) return '';
    return [selectedParty.address, selectedParty.city, selectedParty.state].filter(Boolean).join(', ');
  }, [selectedParty]);

  const partyBalance = useMemo(() => {
    if (!selectedParty) return null;
    return Number(selectedParty.closingBalance ?? selectedParty.balance ?? 0);
  }, [selectedParty]);

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
    const totalGoodsValue = linesWithAmt.reduce((sum, l) => sum + ((Number(l.qty) || 0) * (Number(l.rate) || 0)), 0);
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
      totalGoodsValue,
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

  const focusChallanNo = () => {
    setTimeout(() => {
      const el = document.querySelector('[data-erp-start="challan"]');
      if (el) {
        el.focus();
        try { el.select(); } catch {}
      }
    }, 40);
  };

  const focusJobDate = () => {
    setTimeout(() => {
      const el = document.querySelector('.erp-job-issue-date');
      if (el && !el.disabled) {
        el.focus();
      }
    }, 40);
  };

  const focusJobParty = () => {
    setTimeout(() => {
      const el = document.querySelector('.erp-job-issue-header [data-erp-combobox-input]');
      if (el && !el.disabled) {
        el.focus();
        try { el.select(); } catch {}
      }
    }, 40);
  };

  const focusJobBroker = () => {
    setTimeout(() => {
      const el = document.querySelector('.erp-job-issue-header input[placeholder*="Broker"]');
      if (el && !el.disabled) {
        el.focus();
        try { el.select(); } catch {}
      }
    }, 40);
  };

  const focusFirstItem = () => {
    setTimeout(() => {
      const el = document.querySelector('.erp-job-issue-table [data-erp-combobox-input]');
      if (el && !el.disabled) {
        el.focus();
        try { el.select(); } catch {}
      }
    }, 50);
  };

  const focusHsnCode = () => {
    setTimeout(() => {
      const el = document.getElementById('job-issue-hsn');
      if (el && !el.disabled) {
        el.focus();
        try { el.select(); } catch {}
      } else {
        focusFirstItem();
      }
    }, 40);
  };

  const openNewParty = (search = '') => {
    setAccountModal({ name: search || '', group: 'JOB WORKER' });
  };

  const handleAccountSuccess = (newAccount) => {
    const id = newAccount?._id || newAccount?.id || '';
    if (id) {
      setHeader((h) => ({
        ...h,
        partyId: id,
        gstin: newAccount?.gstin || '',
      }));
    }
    setAccountModal(null);
    fetchParties?.();
    setTimeout(() => {
      focusJobBroker();
    }, 120);
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setBootLoading(true);
    Promise.all([fetchParties(), fetchItems(), fetchPurchases(), fetchInventory(), fetchJobs()])
      .then(() => {
        if (cancelled) return;
        if (initialData) {
          handleNew();
          // The purchase supplier is not the broker; Broker stays for the user to fill.
          if (initialData.purchaseId) {
            const purchaseLines = linesFromPurchase(initialData.purchaseId);
            if (purchaseLines.length) {
              setLines(purchaseLines);
              const firstItem = purchaseLines.find((l) => l.itemId)?.itemId;
              if (firstItem) setActiveItemId(String(firstItem));
              notifySuccess(`Loaded ${purchaseLines.length} line(s) from Purchase ${initialData.invoiceNo || ''}`.trim());
              const noQty = purchaseLines.filter((l) => !(Number(l.qty) > 0)).length;
              if (noQty) notifyWarning(`${noQty} line(s) have Pcs but no meters in the purchase — enter Qty or Cut before saving`);
            } else {
              notifyWarning(`Purchase ${initialData.invoiceNo || ''} has no balance stock to issue`.trim());
            }
          }
          if (initialData.partyName) {
            const match = (useStore.getState().parties || []).find(
              (p) => String(p.name || '').trim().toLowerCase() === String(initialData.partyName || '').trim().toLowerCase()
            );
            if (match) {
              setHeader((h) => ({ ...h, partyId: match._id || match.id, gstin: match.gstin || '' }));
            }
          }
          setTimeout(() => {
            const el = document.querySelector('[data-erp-start="challan"]');
            if (el && !el.disabled) {
              el.focus();
              try { el.select(); } catch {}
            }
          }, 100);
          return;
        }
        const list = [...(useStore.getState().jobWorkEntries || [])].sort((a, b) => {
          const numA = parseInt(String(a.challanNo || a.jobCardNo || '').replace(/\D/g, ''), 10);
          const numB = parseInt(String(b.challanNo || b.jobCardNo || '').replace(/\D/g, ''), 10);
          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
          return new Date(a.issueDate || a.createdAt || 0) - new Date(b.issueDate || b.createdAt || 0);
        });
        const latest = list[list.length - 1];
        if (latest) loadJob(latest._id || latest.id, 'View');
        else handleNew();
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBootLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, selectedBook, initialData]);

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

  /** Grid lines for every purchase line that still has stock, same shape as picking each from Pu.BillNo. */
  const linesFromPurchase = (purchaseId) => {
    const st = useStore.getState();
    return buildPuBillRows({ inventoryLots: st.inventoryLots, purchases: st.purchases, items: st.items })
      .filter((r) => String(r.purchaseId) === String(purchaseId) && (Number(r.balPcs) > 0 || Number(r.balMts) > 0))
      .map((r) => {
        const pcs = Number(r.balPcs || 0);
        const qty = Number(r.balMts || 0);
        const cut = pcs > 0 ? Number((qty / pcs).toFixed(3)) : 0;
        return {
          ...blankLine(),
          itemId: r.itemId ? String(r.itemId) : '',
          lotId: r.lotId ? String(r.lotId) : '',
          lotNo: r.lotCode || r.billNo || '',
          itemName: r.itemName || '',
          pcs: pcs > 0 ? String(pcs) : '',
          cut: cut > 0 ? String(cut) : '',
          qty: qty > 0 ? String(qty) : '',
          fabRate: r.puRate > 0 ? String(r.puRate) : '',
          narration: r.billNo ? `From Pur Bill: ${r.billNo}` : '',
        };
      });
  };

  const handleLotSelect = (row) => {
    if (!row) return;

    // 1. Try finding lot by lotId
    let matchedLot = (inventoryLots || []).find((l) => String(l._id || l.id) === String(row.lotId));

    // 2. If not found by lotId, find by itemId or item name
    if (!matchedLot && row.itemId) {
      matchedLot = (inventoryLots || []).find((l) => String(l.itemId?._id || l.itemId || '') === String(row.itemId));
    }
    if (!matchedLot && row.itemName) {
      const targetName = row.itemName.trim().toLowerCase();
      matchedLot = (inventoryLots || []).find((l) => {
        const name = (l.itemName || l.itemId?.name || l.itemId?.itemName || '').trim().toLowerCase();
        return name === targetName;
      });
    }

    const resolvedLotId = matchedLot?._id || matchedLot?.id || row.lotId || '';
    const itemId =
      matchedLot?.itemId?._id ||
      matchedLot?.itemId ||
      row.itemId ||
      (items || []).find((i) => (i.name || i.itemName || '').trim().toLowerCase() === (row.itemName || '').trim().toLowerCase())?._id ||
      '';

    if (itemId) setActiveItemId(String(itemId));

    setLines((prev) => {
      const next = [...prev];
      const targetIdx = lotLookupTargetIdx != null ? lotLookupTargetIdx : prev.findIndex((l) => !l.lotId);

      const pcs = row.balPcs || row.pcs || 0;
      const qty = row.balMts || row.mts || 0;
      const cut = pcs > 0 ? Number((qty / pcs).toFixed(3)) : 0;

      const lineData = {
        id: next[targetIdx]?.id || Math.random().toString(),
        itemId: itemId ? String(itemId) : '',
        lotId: resolvedLotId,
        lotNo: row.lotCode || (matchedLot ? matchedLot.lotId : row.billNo),
        itemName: row.itemName || (matchedLot ? matchedLot.itemName || matchedLot.itemId?.name : ''),
        pcs: pcs > 0 ? String(pcs) : '',
        cut: cut > 0 ? String(cut) : '',
        qty: qty > 0 ? String(qty) : '',
        rate: '',
        fabRate: row.puRate > 0 ? String(row.puRate) : (matchedLot ? String(matchedLot.rate || matchedLot.purchaseRate || '') : ''),
        narration: row.billNo ? `From Pur Bill: ${row.billNo}` : '',
        jobId: '',
      };

      if (targetIdx === -1) {
        return [...prev, lineData];
      } else {
        next[targetIdx] = lineData;
        return next;
      }
    });

    notifySuccess(`Loaded from Purchase ${row.billNo} · ${row.itemName}`);
  };

  const handleNew = (override = {}) => {
    setMode('Add');
    setSelectedJobId('');
    setFindOpen(false);
    setActiveItemId('');
    const maxChallan = (useStore.getState().jobWorkEntries || []).reduce((max, j) => {
      const num = parseInt(String(j.challanNo || j.jobCardNo || '').replace(/\D/g, ''), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const nextChallan = maxChallan > 0 ? String(maxChallan + 1) : '1';
    setHeader({
      challanNo: nextChallan,
      challanNoSuffix: '',
      date: today(),
      reFinish: '',
      gstType: 'INVOICE IN STATE',
      gstin: '',
      partyId: '',
      broker: '',
      hsnCd: '5407',
      book: selectedBook || 'JOBWORK BOOK',
      ...override,
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
    setTimeout(() => {
      const el = document.querySelector('[data-erp-start="challan"]');
      if (!el || el.disabled) return;
      el.focus();
      try { el.select(); } catch { /* ignore */ }
    }, 80);
  };

  const handleEdit = () => {
    if (!selectedJobId) return notifyWarning('Find a challan first');
    setMode('Edit');
  };

  const handleCancel = () => {
    if (selectedJobId) {
      loadJob(selectedJobId, 'View');
      setMode('View');
    } else {
      handleNew();
    }
  };

  const loadJob = (id, targetMode = 'View') => {
    setSelectedJobId(id);
    if (!id) return;
    const job = (jobWorkEntries || []).find((j) => String(j._id || j.id) === String(id));
    if (!job) return;

    setMode(targetMode);
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

    const baseCh = String(job.challanNo || '').trim();
    const siblingJobs = baseCh
      ? (jobWorkEntries || []).filter(
          (j) =>
            String(j.challanNo || '').trim() === baseCh &&
            String(j.workerId?._id || j.workerId || '') === String(job.workerId?._id || job.workerId || '')
        )
      : [job];
    const jobsToLoad = siblingJobs.length > 0 ? siblingJobs : [job];

    const loadedLines = jobsToLoad.map((j) => {
      const lineItemId = j.lotId?.itemId?._id || j.lotId?.itemId || j.itemId || '';
      return {
        id: `line-${j._id || Math.random().toString(36).slice(2, 7)}`,
        itemId: lineItemId ? String(lineItemId) : '',
        lotId: j.lotId?._id || j.lotId || '',
        lotNo: j.lotId?.lotId || '',
        chlnNo: j.purchaseBillNo || '',
        itemName: j.lotId?.itemName || j.lotId?.itemId?.name || j.itemName || '',
        pcs: String(j.issuePcs || 0),
        cut: j.issuePcs > 0 ? String((j.issueQty / j.issuePcs).toFixed(3)) : '',
        qty: String(j.issueQty || 0),
        rate: String(j.jobRate || 0),
        fabRate: String(j.purchaseRate || 0),
        narration: String(j.remark || j.remarks || ''),
        jobId: j._id,
      };
    });

    setLines(loadedLines.length > 0 ? loadedLines : [blankLine()]);
    const firstLineItemId = loadedLines[0]?.itemId || '';
    setActiveItemId(firstLineItemId ? String(firstLineItemId) : '');

    setFooter({
      remark: remarks,
      note: job.note || '',
      transport: job.transport || '',
      lrNo: job.lrNo || '',
      baleNo: job.baleNo || '',
      taxRate: job.taxRate != null ? String(job.taxRate) : '0',
    });
  };

  const navigateChallan = (dir) => {
    const list = bookJobs;
    if (!list.length) {
      notifyWarning('No saved challans to browse');
      return;
    }
    if (dir === 'first') {
      loadJob(list[0]._id || list[0].id, 'View');
      focusChallanNo();
      return;
    }
    if (dir === 'last') {
      loadJob(list[list.length - 1]._id || list[list.length - 1].id, 'View');
      focusChallanNo();
      return;
    }
    const currentIdx = list.findIndex(
      (j) =>
        String(j._id || j.id) === String(selectedJobId) ||
        String(j.challanNo || j.jobCardNo || '').trim() === String(header.challanNo || '').trim()
    );
    let nextIdx = currentIdx + dir;
    if (currentIdx === -1) nextIdx = dir > 0 ? 0 : list.length - 1;
    if (nextIdx >= 0 && nextIdx < list.length && nextIdx !== currentIdx) {
      loadJob(list[nextIdx]._id || list[nextIdx].id, 'View');
      focusChallanNo();
    } else if (nextIdx >= list.length && dir > 0) {
      notifyInfo('Reached latest challan. Press Enter for New Entry.');
      focusChallanNo();
    } else if (nextIdx < 0 && dir < 0) {
      notifyWarning('Already at the first challan');
      focusChallanNo();
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      const kb = kbRef.current;
      if (kb.findOpen) return;
      if (e.target instanceof Element && e.target.closest('[data-account-modal], .erp-confirm-dialog')) return;

      if (e.key === 'F3' || (e.altKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        e.stopPropagation();
        kb.handleOpenFindModal?.();
        return;
      }

      if ((e.altKey && e.key.toLowerCase() === 'e') || e.key === 'F2') {
        if (kb.selectedJobId && kb.mode === 'View') {
          e.preventDefault();
          e.stopPropagation();
          kb.handleEdit?.();
          return;
        }
      }

      const isMinus = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus' || e.key === 'PageUp';
      const isPlus = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal' || e.key === 'PageDown';
      if ((isMinus || isPlus) && !e.ctrlKey && !e.altKey) {
        const el = e.target;
        const isChallanInput = el && el.getAttribute?.('data-erp-start') === 'challan';
        const inTextEdit = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !isChallanInput && kb.mode !== 'View';

        if (isChallanInput || kb.mode === 'View' || !inTextEdit) {
          e.preventDefault();
          e.stopPropagation();
          kb.navigateChallan?.(isMinus ? -1 : 1);
          return;
        }
      }

      // Enter in View mode starts new entry
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const el = e.target;
        const inCombobox = el?.closest?.('[data-erp-combobox]');
        const inGrid = el?.closest?.('.erp-job-issue-table');
        if (kb.mode === 'View' && !inCombobox && !inGrid) {
          e.preventDefault();
          e.stopPropagation();
          kb.handleNew?.();
          return;
        }
      }

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        e.stopPropagation();
        kb.handleNew?.();
        return;
      }

      if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.altKey && e.key.toLowerCase() === 's')) {
        if (!kb.locked && !kb.saving) {
          e.preventDefault();
          e.stopPropagation();
          kb.handleSave?.();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

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
      // Say exactly what the filled line is missing instead of a generic "add a line".
      const idx = calc.linesWithAmt.findIndex((l) => l.itemId || l.lotId || Number(l.pcs) > 0);
      const line = idx >= 0 ? calc.linesWithAmt[idx] : null;
      if (line && !line.lotId) {
        notifyWarning(`Line ${idx + 1}: no stock lot for "${line.itemName || 'item'}" — use Fetch From Purchase Bill`);
      } else if (line) {
        notifyWarning(`Line ${idx + 1}: enter Qty (or Cut) — this purchase has Pcs ${line.pcs || 0} but no meters`);
        const cell = document.querySelectorAll('.erp-job-issue-table tbody tr')[idx]?.querySelector('[data-col="cut"]')
          || document.querySelectorAll('.erp-job-issue-table tbody tr')[idx]?.querySelector('[data-col="qty"]');
        cell?.focus();
      } else {
        notifyWarning('Add at least one line — pick an Item and enter quantity');
      }
      return;
    }

    // Two lines can legally draw from the SAME lot (e.g. same item split across rows) —
    // check the combined draw per lot against its real remaining stock, not line-by-line.
    const qtyByLot = new Map();
    const pcsByLot = new Map();
    activeLines.forEach((l) => {
      const key = String(l.lotId);
      qtyByLot.set(key, (qtyByLot.get(key) || 0) + Number(l.qty || 0));
      pcsByLot.set(key, (pcsByLot.get(key) || 0) + Number(l.pcs || 0));
    });
    const overIssued = [...qtyByLot.entries()].find(([lotId, totalQty]) => {
      const lot = (inventoryLots || []).find((iv) => String(iv._id || iv.id) === lotId);
      return lot && Number(lot.remainingMtrs || 0) > 0 && totalQty > Number(lot.remainingMtrs || 0) + 0.0001;
    });
    if (overIssued) {
      const [lotId, totalQty] = overIssued;
      const lot = (inventoryLots || []).find((iv) => String(iv._id || iv.id) === lotId);
      notifyWarning(`Lot ${lot?.lotId || lotId} — combined Qty ${totalQty.toFixed(2)} exceeds available stock (${Number(lot?.remainingMtrs || 0).toFixed(2)})`);
      return;
    }
    const overIssuedPcs = [...pcsByLot.entries()].find(([lotId, totalPcs]) => {
      const lot = (inventoryLots || []).find((iv) => String(iv._id || iv.id) === lotId);
      return lot && Number(lot.remainingPcs || 0) > 0 && totalPcs > Number(lot.remainingPcs || 0) + 0.0001;
    });
    if (overIssuedPcs) {
      const [lotId, totalPcs] = overIssuedPcs;
      const lot = (inventoryLots || []).find((iv) => String(iv._id || iv.id) === lotId);
      notifyWarning(`Lot ${lot?.lotId || lotId} — combined Pcs ${totalPcs} exceeds available stock (${Number(lot?.remainingPcs || 0)})`);
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
      await Promise.all([fetchJobs(), fetchInventory()]);
      const savedChallanNo = header.challanNo;
      const freshList = (useStore.getState().jobWorkEntries || []).sort((a, b) => {
        const numA = parseInt(String(a.challanNo || a.jobCardNo || '').replace(/\D/g, ''), 10);
        const numB = parseInt(String(b.challanNo || b.jobCardNo || '').replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return new Date(a.issueDate || a.createdAt || 0) - new Date(b.issueDate || b.createdAt || 0);
      });
      const matched = freshList.slice().reverse().find((j) =>
        savedChallanNo && String(j.challanNo || j.jobCardNo || '').trim() === String(savedChallanNo).trim()
      ) || freshList[freshList.length - 1];

      if (matched) {
        loadJob(matched._id || matched.id, 'View');
      } else {
        setMode('View');
      }
      focusChallanNo();
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

  kbRef.current = {
    mode,
    saving,
    locked,
    selectedJobId,
    findOpen,
    handleOpenFindModal,
    handleNew,
    handleEdit,
    handleSave,
    navigateChallan,
  };

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
        className="job-book-window job-issue-fit-window"
        bare
      >
        {({ WindowControls }) => (
          <div className="classic-erp-window erp-density erp-job-issue-window flex flex-col h-full min-h-0 !max-h-none" data-enter-skip={mode === 'View' ? 'true' : undefined}>
            <ErpBusyOverlay show={bootLoading} message="Loading job issue registry…" />
            <ErpBusyOverlay show={!bootLoading && saving} message="Saving job issue entries…" />

            <div className="classic-erp-header shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="erp-window-title truncate">
                  Additional Job Issue [ {titleBook} ]
                </span>
                {mode === 'View' && (
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-500 font-extrabold px-2 py-0.5 rounded text-[10px] tracking-wide">
                    RECENT CHALLAN #{header.challanNo} (VIEW) · Press Enter for New Entry · +/- to browse
                  </span>
                )}
                {mode === 'Edit' && (
                  <span className="bg-amber-300 text-amber-950 px-2 py-0.5 rounded text-[10px] font-extrabold border border-amber-600 animate-pulse">
                    EDITING CHALLAN #{header.challanNo}
                  </span>
                )}
                {mode === 'Add' && (
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-extrabold">
                    NEW CHALLAN #{header.challanNo}
                  </span>
                )}
              </div>
              <WindowControls />
            </div>

            <form
              onSubmit={handleSave}
              className="classic-erp-body erp-job-issue-body flex-1 overflow-hidden min-h-0 flex flex-col justify-between"
            >
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
                          data-erp-start="challan"
                          data-enter-order="1"
                          onChange={(e) => setHeader({ ...header, challanNo: e.target.value })}
                          readOnly={mode === 'View'}
                          title={mode === 'View' ? "Press Enter for New Entry · Press + / - to browse challans" : "Challan No — Enter goes to Date · + / - browse challans"}
                          onKeyDown={(e) => {
                            const isMinus = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus' || e.key === 'PageUp';
                            const isPlus = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal' || e.key === 'PageDown';
                            if ((isMinus || isPlus) && !e.ctrlKey && !e.altKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              navigateChallan(isMinus ? -1 : 1);
                              return;
                            }
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              if (mode === 'View') {
                                handleNew();
                                return;
                              }
                              focusJobDate();
                            }
                          }}
                        />
                        <input
                          type="text"
                          className="classic-erp-input text-center"
                          style={{ width: 52, flex: '0 0 52px' }}
                          value={header.challanNoSuffix}
                          onChange={(e) => setHeader({ ...header, challanNoSuffix: e.target.value })}
                          disabled={locked}
                          tabIndex={-1}
                          data-enter-skip="true"
                        />
                        <span className="text-slate-400 font-bold ml-1">-</span>
                      </div>
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg">
                      <span className="classic-erp-label red-label">Date</span>
                      <div className="flex gap-2 items-center">
                        <input
                          type="date"
                          className="classic-erp-input erp-job-issue-date"
                          value={header.date}
                          data-enter-order="2"
                          onChange={(e) => setHeader({ ...header, date: e.target.value })}
                          disabled={locked}
                          required
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              focusJobParty();
                            }
                          }}
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
                          tabIndex={-1}
                          data-enter-skip="true"
                        />
                      </div>
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg">
                      <span className="classic-erp-label red-label">Job Party</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                        <ERPCombobox
                          value={header.partyId}
                          data-enter-order="3"
                          onChange={(val) => {
                            handlePartyChange(val);
                            focusJobBroker();
                          }}
                          disabled={locked}
                          options={partyOptions}
                          placeholder="Search job worker / mill…"
                          recentKey="job-issue-party"
                          allowClear
                          onCreateNew={(q) => openNewParty(q)}
                          createLabel="Party"
                        />
                        <button
                          type="button"
                          title="Add new job party"
                          onClick={() => openNewParty('')}
                          style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            height: 20,
                            padding: '0 6px',
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#fff',
                            background: '#16a34a',
                            border: 'none',
                            borderRadius: 2,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Plus size={10} /> Add
                        </button>
                      </div>
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg">
                      <span className="classic-erp-label" />
                      <div className="erp-job-issue-party-address flex justify-between items-center">
                        <span className="truncate">{partyAddress || ','}</span>
                        {partyBalance !== null && !isNaN(partyBalance) && (
                          <span
                            className="font-mono text-emerald-800 font-bold text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 ml-2"
                            title="Job Worker Closing Balance (_lbl_total)"
                          >
                            Bal: ₹{partyBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="classic-erp-field classic-erp-field--lg">
                      <span className="classic-erp-label">Broker</span>
                      <input
                        type="text"
                        className="classic-erp-input font-bold"
                        value={header.broker}
                        data-enter-order="4"
                        onChange={(e) => setHeader({ ...header, broker: e.target.value })}
                        disabled={locked}
                        placeholder="Search Broker…"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            focusHsnCode();
                          }
                        }}
                      />
                    </div>

                    <div className="classic-erp-meta-grid erp-job-issue-meta-row">
                      <div className="classic-erp-field">
                        <span className="classic-erp-label">HSN CODE</span>
                        <input
                          id="job-issue-hsn"
                          type="text"
                          className="classic-erp-input text-center font-mono"
                          value={header.hsnCd}
                          onChange={(e) => setHeader({ ...header, hsnCd: e.target.value })}
                          disabled={locked}
                          data-enter-order="5"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              focusFirstItem();
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                          tabIndex={-1}
                          data-enter-skip="true"
                          autoFocusNext={false}
                        />
                      </div>
                      <span className="erp-job-issue-gstin-badge">GSTIN:-{header.gstin || '—'}</span>
                    </div>

                    <div className="erp-job-issue-taxbox">
                      <div className="erp-job-issue-sumrow">
                        <span>Total Amount</span>
                        <input type="text" className="classic-erp-input font-mono" value={calc.gross.toFixed(2)} readOnly />
                      </div>
                      <div className="erp-job-issue-sumrow">
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
                  <div className="erp-job-issue-toolbar flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button type="button" className="classic-erp-btn" data-add-line onClick={addLine}>
                        <Plus size={12} className="inline mr-0.5" /> Add Line
                      </button>
                      <button
                        type="button"
                        className="classic-erp-btn bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center gap-1 shadow-sm"
                        onClick={() => {
                          setLotLookupTargetIdx(null);
                          setLotLookupOpen(true);
                        }}
                        title="Fetch item / lot directly from Purchase Bills"
                      >
                        <Search size={11} /> Fetch From Purchase Bill
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      Grid Row Count: {lines.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Grid */}
              <div className="classic-erp-frame erp-job-issue-grid-wrap flex-1 min-h-0 flex flex-col">
                <div className="classic-erp-table-container erp-job-issue-grid flex-1 overflow-auto">
                  <table className="classic-erp-table erp-job-issue-table w-full" data-line-grid>
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
                          <td className="text-center text-slate-500 font-bold" tabIndex={0} data-line-start>{idx + 1}</td>
                          {gridCols.map((c) => {
                            if (c.key === 'itemName') {
                              return (
                                <td key={c.key} className={c.w}>
                                  <div className="flex items-center gap-0.5" title={line.lotNo ? `Auto-picked lot: ${line.lotNo}` : ''}>
                                    <div className="flex-1 min-w-0">
                                      <ERPCombobox
                                        value={line.itemId}
                                        autoFocusNext={false}
                                        onChange={(val) => {
                                          handleLineItemChange(idx, val);
                                          requestAnimationFrame(() => {
                                            const trs = document.querySelectorAll('.erp-job-issue-table tbody tr');
                                            const pcsInput = trs[idx]?.querySelector('input[data-col="pcs"]');
                                            if (pcsInput) {
                                              pcsInput.focus();
                                              try { pcsInput.select(); } catch {}
                                            }
                                          });
                                        }}
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
                                        tabIndex={-1}
                                        data-enter-skip="true"
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
                                  data-col={c.key}
                                  type={c.align === 'right' ? 'number' : 'text'}
                                  step={c.key === 'cut' ? '0.001' : c.key === 'qty' ? '0.01' : undefined}
                                  className={`classic-erp-input w-full ${c.align === 'right' ? 'text-right font-mono' : ''} ${c.readOnly ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                  value={line[c.key] || ''}
                                  onChange={(e) => setLine(idx, { [c.key]: e.target.value })}
                                  readOnly={c.readOnly || locked}
                                  disabled={c.readOnly || locked}
                                  tabIndex={c.readOnly ? -1 : undefined}
                                  data-enter-skip={c.readOnly ? "true" : undefined}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && !locked) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const fieldKeys = ['pcs', 'cut', 'qty', 'rate', 'fabRate', 'narration'];
                                      if (c.key !== 'narration') {
                                        const nextKeyIdx = fieldKeys.indexOf(c.key) + 1;
                                        if (nextKeyIdx < fieldKeys.length) {
                                          const nextKey = fieldKeys[nextKeyIdx];
                                          const trs = document.querySelectorAll('.erp-job-issue-table tbody tr');
                                          const nextIn = trs[idx]?.querySelector(`[data-col="${nextKey}"]`);
                                          if (nextIn) {
                                            nextIn.focus();
                                            try { nextIn.select(); } catch {}
                                          }
                                        }
                                      } else {
                                        if (idx < calc.linesWithAmt.length - 1) {
                                          setTimeout(() => {
                                            const trs = document.querySelectorAll('.erp-job-issue-table tbody tr');
                                            const nextItem = trs[idx + 1]?.querySelector('[data-erp-combobox-input]');
                                            if (nextItem) nextItem.focus();
                                          }, 40);
                                        } else {
                                          if (line.itemId || Number(line.qty) > 0) {
                                            addLine();
                                            setTimeout(() => {
                                              const trs = document.querySelectorAll('.erp-job-issue-table tbody tr');
                                              const nextItem = trs[trs.length - 1]?.querySelector('[data-erp-combobox-input]');
                                              if (nextItem) nextItem.focus();
                                            }, 50);
                                          } else {
                                            document.getElementById('job-issue-remark')?.focus();
                                          }
                                        }
                                      }
                                    }
                                  }}
                                />
                              </td>
                            );
                          })}
                          {!locked && (
                            <td className="text-center">
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-800 disabled:opacity-30"
                                data-delete-line
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
                  <span>/</span>
                  <span className="text-amber-200" title="Total Fabric / Goods Value (_txt_p_Amt)">
                    Goods Val : ₹{calc.totalGoodsValue.toFixed(2)}
                  </span>
                  <span>/</span>
                  <span className="text-emerald-200" title="Total Job Work Charges (_lbl_job_amt)">
                    Job Chgs : ₹{calc.gross.toFixed(2)}
                  </span>
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
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Remark</span>
                  <input
                    id="job-issue-remark"
                    type="text"
                    className="classic-erp-input"
                    value={footer.remark}
                    onChange={(e) => setFooter({ ...footer, remark: e.target.value })}
                    disabled={locked}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('job-issue-note')?.focus();
                      }
                    }}
                  />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Note</span>
                  <input
                    id="job-issue-note"
                    type="text"
                    className="classic-erp-input"
                    value={footer.note}
                    onChange={(e) => setFooter({ ...footer, note: e.target.value })}
                    disabled={locked}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('job-issue-transport')?.focus();
                      }
                    }}
                  />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Transport</span>
                  <input
                    id="job-issue-transport"
                    type="text"
                    className="classic-erp-input"
                    value={footer.transport}
                    onChange={(e) => setFooter({ ...footer, transport: e.target.value })}
                    disabled={locked}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('job-issue-lrno')?.focus();
                      }
                    }}
                  />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">LrNo</span>
                  <input
                    id="job-issue-lrno"
                    type="text"
                    className="classic-erp-input"
                    value={footer.lrNo}
                    onChange={(e) => setFooter({ ...footer, lrNo: e.target.value })}
                    disabled={locked}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('job-issue-baleno')?.focus();
                      }
                    }}
                  />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Bale/Marka No</span>
                  <input
                    id="job-issue-baleno"
                    type="text"
                    placeholder="Bale or Marka No"
                    className="classic-erp-input text-center font-bold"
                    value={footer.baleNo}
                    onChange={(e) => setFooter({ ...footer, baleNo: e.target.value })}
                    disabled={locked}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('job-issue-save-btn')?.focus();
                      }
                    }}
                  />
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
                <button id="job-issue-save-btn" type="submit" className="classic-erp-btn btn-blue" disabled={saving || locked} data-enter-save="true">
                  <SaveButtonLabel saving={saving} label="Save" />
                </button>
                <button type="button" className="classic-erp-btn" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="classic-erp-btn font-bold bg-amber-100 border-amber-400 text-amber-900"
                  onClick={handleOpenFindModal}
                  disabled={saving}
                  title="Quick Find Challan (F3 / Alt+F)"
                >
                  Find (F3)
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => navigateChallan('first')}
                  disabled={saving}
                  title="Go to First Challan"
                >
                  First
                </button>
                <button
                  type="button"
                  className="classic-erp-btn font-bold"
                  onClick={() => navigateChallan(-1)}
                  disabled={saving}
                  title="Previous Challan (-)"
                >
                  Prev (-)
                </button>
                <button
                  type="button"
                  className="classic-erp-btn font-bold"
                  onClick={() => navigateChallan(1)}
                  disabled={saving}
                  title="Next Challan (+)"
                >
                  Next (+)
                </button>
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => navigateChallan('last')}
                  disabled={saving}
                  title="Go to Last Challan"
                >
                  Last
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
                  onClick={handleOpenFindModal}
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

      {/* Quick Challan Number Find Modal with + / - and Enter -> Edit */}
      {findOpen && (
        <ErpTopLayer>
        <div
          className="fixed inset-0 bg-black/60 z-[10070] flex items-center justify-center p-4"
          onClick={() => setFindOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl border-2 border-slate-700 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '82vh' }}
          >
            {/* Header */}
            <div className="bg-[#1a3353] text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-slate-900 font-black px-1.5 py-0.5 rounded text-[11px]">FIND CHALLAN (F3)</span>
                <h3 className="font-bold text-xs uppercase tracking-wider">Quick Challan Selector</h3>
              </div>
              <span className="text-[10px] text-slate-300">
                <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">+</kbd> / <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">-</kbd> change · <kbd className="bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">Enter</kbd> View
              </span>
            </div>

            {/* Search / Quick Number Input */}
            <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 shrink-0">Challan No:</span>
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
              <span className="text-[11px] font-bold text-slate-600 shrink-0">{filteredChallans.length} Records</span>
            </div>

            {/* Challan Numbers List */}
            <div className="overflow-y-auto p-2 flex-1 space-y-1 max-h-72 bg-slate-50">
              {filteredChallans.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 font-medium">
                  No challans found matching &quot;{findSearch}&quot;
                </div>
              ) : (
                filteredChallans.map((j, idx) => {
                  const isSelected = idx === findActiveIdx;
                  const cleanNo = String(j.challanNo || j.jobCardNo || idx + 1);
                  return (
                    <div
                      key={j._id || j.id || idx}
                      onClick={() => {
                        loadJob(j._id || j.id, 'View');
                        setFindOpen(false);
                        notifySuccess(`Challan #${cleanNo} loaded (View mode)`);
                        focusChallanNo();
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
                            {j.workerId?.name || 'Mill / Job Worker'}
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                            {j.issueDate ? new Date(j.issueDate).toLocaleDateString('en-IN') : '—'} · {j.lotId?.itemName || 'Item'} · {Number(j.issueQty || 0).toFixed(2)} mts
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold">
                        <div>{Number(j.issuePcs || 0)} pcs</div>
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
                  onClick={() => setFindOpen(false)}
                  className="px-3 py-1 bg-white border border-slate-400 rounded text-xs hover:bg-slate-100 font-semibold"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const job = filteredChallans[findActiveIdx];
                    if (job) {
                      loadJob(job._id || job.id, 'Edit');
                      setFindOpen(false);
                      notifySuccess(`Challan #${job.challanNo || job.jobCardNo} loaded in Edit mode`);
                    }
                  }}
                  disabled={!filteredChallans.length}
                  className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-xs hover:bg-blue-700 shadow-sm"
                >
                  Open in Edit (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
        </ErpTopLayer>
      )}

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

      <AccountMasterModal
        isOpen={!!accountModal}
        onClose={() => setAccountModal(null)}
        initialData={accountModal}
        onSuccess={handleAccountSuccess}
      />
    </>
  );
}
