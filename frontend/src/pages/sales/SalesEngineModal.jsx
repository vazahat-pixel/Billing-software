import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { salesEngineApi } from '../../api';
import { toast } from '../../store/useToastStore';

const TABS = ['Quote', 'Order', 'Pack', 'Challan', 'Invoice', 'Return'];

const blankLine = () => ({ itemId: '', lotId: '', mts: '', pcs: '0', rate: '' });

/**
 * Sprint 2.5 — Sales lifecycle workspace (modal shell).
 * Quote → SO (reserve) → Pack → Challan (stock once) → Invoice (no double issue) → Return
 */
const SalesEngineModal = ({ isOpen, onClose }) => {
  const { parties, items, inventoryLots, fetchParties, fetchItems, fetchInventory, fetchSales } = useStore();
  const [tab, setTab] = useState('Quote');
  const [pipeline, setPipeline] = useState(null);
  const [busy, setBusy] = useState(false);

  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [challans, setChallans] = useState([]);

  const customers = useMemo(
    () => parties.filter((p) => ['Customer', 'Both'].includes(p.type) || !p.type),
    [parties]
  );
  const customerOpts = useMemo(
    () => customers.map((p) => ({ value: p._id || p.id, label: p.name })),
    [customers]
  );
  const itemOpts = useMemo(
    () => items.map((i) => ({ value: i._id || i.id, label: i.name || i.itemName })),
    [items]
  );
  const lotOpts = useMemo(
    () =>
      (inventoryLots || [])
        .filter((l) => (l.remainingMtrs || 0) > 0)
        .map((l) => ({
          value: l._id || l.id,
          label: `${l.lotId} — ${l.itemId?.name || 'Item'} (${(l.remainingMtrs || 0).toFixed(2)} m)`,
          itemId: l.itemId?._id || l.itemId,
        })),
    [inventoryLots]
  );

  const [customerId, setCustomerId] = useState('');
  const [quoteLines, setQuoteLines] = useState([blankLine()]);
  const [orderLines, setOrderLines] = useState([blankLine()]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedChallanId, setSelectedChallanId] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [eway, setEway] = useState('');
  const [returnLotId, setReturnLotId] = useState('');
  const [returnMts, setReturnMts] = useState('');
  const [returnRate, setReturnRate] = useState('');

  const refresh = async () => {
    try {
      const [p, q, o, c] = await Promise.all([
        salesEngineApi.pipeline(),
        salesEngineApi.listQuotations(),
        salesEngineApi.listOrders(),
        salesEngineApi.listChallans(),
      ]);
      setPipeline(p);
      setQuotes(q || []);
      setOrders(o || []);
      setChallans(c || []);
    } catch {
      /* partial */
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchParties();
    fetchItems();
    fetchInventory();
    setTab('Quote');
    refresh();
  }, [isOpen, fetchParties, fetchItems, fetchInventory]);

  const openOrders = useMemo(
    () => orders.filter((o) => ['Approved', 'Open', 'Partial', 'PendingApproval'].includes(o.status)),
    [orders]
  );
  const dispatchedChallans = useMemo(
    () => challans.filter((c) => c.status === 'Dispatched'),
    [challans]
  );

  const handleCreateQuote = async () => {
    if (!customerId) return toast.error('Customer required');
    const itemsPayload = quoteLines
      .filter((l) => l.itemId && l.mts)
      .map((l) => ({
        itemId: l.itemId,
        lotId: l.lotId || undefined,
        mts: Number(l.mts),
        pcs: Number(l.pcs || 0),
        rate: Number(l.rate || 0),
      }));
    if (!itemsPayload.length) return toast.error('Add at least one line');
    setBusy(true);
    try {
      await salesEngineApi.createQuotation({ customerId, items: itemsPayload, send: true });
      toast.success('Quotation created');
      setQuoteLines([blankLine()]);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Quote failed');
    } finally {
      setBusy(false);
    }
  };

  const handleConvertQuote = async () => {
    if (!selectedQuoteId) return toast.error('Select quotation');
    setBusy(true);
    try {
      await salesEngineApi.convertQuotation(selectedQuoteId, { approve: true });
      toast.success('Converted to SO (stock reserved)');
      await fetchInventory();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Convert failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!customerId) return toast.error('Customer required');
    const itemsPayload = orderLines
      .filter((l) => l.itemId && l.lotId && l.mts)
      .map((l) => ({
        itemId: l.itemId,
        lotId: l.lotId,
        mts: Number(l.mts),
        pcs: Number(l.pcs || 0),
        rate: Number(l.rate || 0),
      }));
    if (!itemsPayload.length) return toast.error('Lines need item, lot and mts');
    setBusy(true);
    try {
      await salesEngineApi.createOrder({ partyId: customerId, items: itemsPayload, approve: true });
      toast.success('SO created & reserved');
      setOrderLines([blankLine()]);
      await fetchInventory();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (id) => {
    setBusy(true);
    try {
      await salesEngineApi.approveOrder(id, true);
      toast.success('Order approved');
      await fetchInventory();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePack = async (status) => {
    if (!selectedOrderId) return toast.error('Select order');
    setBusy(true);
    try {
      await salesEngineApi.updatePacking(selectedOrderId, status);
      toast.success(`Packing: ${status}`);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Packing failed');
    } finally {
      setBusy(false);
    }
  };

  const handleChallan = async () => {
    if (!selectedOrderId) return toast.error('Select order');
    setBusy(true);
    try {
      await salesEngineApi.createChallan({
        orderId: selectedOrderId,
        lrNo,
        eway,
      });
      toast.success('Challan dispatched (stock deducted)');
      setLrNo('');
      setEway('');
      await fetchInventory();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Challan failed');
    } finally {
      setBusy(false);
    }
  };

  const handleInvoice = async () => {
    if (!selectedChallanId) return toast.error('Select challan');
    setBusy(true);
    try {
      await salesEngineApi.convertChallanToInvoice(selectedChallanId, { invoiceType: 'Tax' });
      toast.success('Invoice created (no double stock)');
      await fetchSales?.();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Invoice failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async () => {
    if (!customerId || !returnLotId || !returnMts) return toast.error('Customer, lot and qty required');
    const lot = inventoryLots.find((l) => (l._id || l.id) === returnLotId);
    setBusy(true);
    try {
      await salesEngineApi.createSalesReturn({
        partyId: customerId,
        restoreMode: 'restore_lot',
        items: [
          {
            itemId: lot?.itemId?._id || lot?.itemId,
            lotId: returnLotId,
            mts: Number(returnMts),
            rate: Number(returnRate || 0),
            amount: Number(returnMts) * Number(returnRate || 0),
          },
        ],
      });
      toast.success('Sales return restored to lot');
      setReturnMts('');
      await fetchInventory();
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Return failed');
    } finally {
      setBusy(false);
    }
  };

  const updateLine = (setter, lines, idx, key, val) => {
    const next = [...lines];
    next[idx] = { ...next[idx], [key]: val };
    if (key === 'lotId') {
      const lot = lotOpts.find((l) => l.value === val);
      if (lot?.itemId) next[idx].itemId = lot.itemId;
    }
    setter(next);
  };

  const LineEditor = ({ lines, setLines }) => (
    <div className="space-y-2">
      {lines.map((line, idx) => (
        <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <ERPSearchableSelect
            label="Lot"
            options={lotOpts}
            value={line.lotId}
            onChange={(v) => updateLine(setLines, lines, idx, 'lotId', v)}
          />
          <ERPSearchableSelect
            label="Item"
            options={itemOpts}
            value={line.itemId}
            onChange={(v) => updateLine(setLines, lines, idx, 'itemId', v)}
          />
          <ERPInput label="Mts" type="number" value={line.mts} onChange={(e) => updateLine(setLines, lines, idx, 'mts', e.target.value)} />
          <ERPInput label="Rate" type="number" value={line.rate} onChange={(e) => updateLine(setLines, lines, idx, 'rate', e.target.value)} />
          <ERPInput label="Pcs" type="number" value={line.pcs} onChange={(e) => updateLine(setLines, lines, idx, 'pcs', e.target.value)} />
        </div>
      ))}
      <button type="button" className="text-[10px] font-bold uppercase" onClick={() => setLines([...lines, blankLine()])}>
        + Line
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sales Engine" className="max-w-[92vw]">
      <div className="space-y-4 p-2">
        {pipeline && (
          <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Quotes: {pipeline.openQuotes}</span>
            <span>Orders: {pipeline.openOrders}</span>
            <span>Challans: {pipeline.pendingChallans}</span>
            <span>Invoices: {pipeline.openInvoices}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded ${
                tab === t ? 'bg-black text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Quote' && (
          <div className="space-y-3">
            <ERPSearchableSelect label="Customer" options={customerOpts} value={customerId} onChange={setCustomerId} />
            <LineEditor lines={quoteLines} setLines={setQuoteLines} />
            <button type="button" disabled={busy} onClick={handleCreateQuote} className="erp-btn-primary">
              Create quotation
            </button>
            <ERPSearchableSelect
              label="Accept / convert"
              options={quotes.map((q) => ({
                value: q._id || q.id,
                label: `${q.quoteNo} — ${q.customerId?.name || ''} (${q.status})`,
              }))}
              value={selectedQuoteId}
              onChange={setSelectedQuoteId}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  try {
                    await salesEngineApi.acceptQuotation(selectedQuoteId, true);
                    toast.success('Accepted');
                    await refresh();
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
                className="erp-btn-secondary"
              >
                Accept
              </button>
              <button type="button" disabled={busy} onClick={handleConvertQuote} className="erp-btn-primary">
                Convert → SO
              </button>
            </div>
          </div>
        )}

        {tab === 'Order' && (
          <div className="space-y-3">
            <ERPSearchableSelect label="Customer" options={customerOpts} value={customerId} onChange={setCustomerId} />
            <LineEditor lines={orderLines} setLines={setOrderLines} />
            <button type="button" disabled={busy} onClick={handleCreateOrder} className="erp-btn-primary">
              Create SO (reserve stock)
            </button>
            <div className="max-h-40 overflow-auto text-xs border border-slate-100 rounded">
              {openOrders.map((o) => (
                <div key={o._id || o.id} className="flex justify-between p-2 border-b border-slate-50">
                  <span>
                    {o.orderNo} — {o.status} / {o.packingStatus}
                  </span>
                  {o.status === 'PendingApproval' && (
                    <button type="button" className="text-[10px] font-bold text-green-700" onClick={() => handleApprove(o._id || o.id)}>
                      Approve
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Pack' && (
          <div className="space-y-3">
            <ERPSearchableSelect
              label="Order"
              options={openOrders.map((o) => ({
                value: o._id || o.id,
                label: `${o.orderNo} — ${o.packingStatus}`,
              }))}
              value={selectedOrderId}
              onChange={setSelectedOrderId}
            />
            <div className="flex flex-wrap gap-2">
              {['Picking', 'Packed'].map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => handlePack(s)} className="erp-btn-secondary">
                  Mark {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'Challan' && (
          <div className="space-y-3">
            <ERPSearchableSelect
              label="Approved / partial order"
              options={orders
                .filter((o) => ['Approved', 'Partial', 'Open'].includes(o.status))
                .map((o) => ({ value: o._id || o.id, label: `${o.orderNo} (${o.status})` }))}
              value={selectedOrderId}
              onChange={setSelectedOrderId}
            />
            <ERPInput label="LR No" value={lrNo} onChange={(e) => setLrNo(e.target.value)} />
            <ERPInput label="E-way" value={eway} onChange={(e) => setEway(e.target.value)} />
            <button type="button" disabled={busy} onClick={handleChallan} className="erp-btn-primary">
              Dispatch challan (deduct stock)
            </button>
            <div className="max-h-32 overflow-auto text-xs border border-slate-100 rounded">
              {challans.slice(0, 15).map((c) => (
                <div key={c._id || c.id} className="p-2 border-b border-slate-50">
                  {c.challanNo} — {c.status} {c.stockDeducted ? '(stock posted)' : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Invoice' && (
          <div className="space-y-3">
            <ERPSearchableSelect
              label="Dispatched challan"
              options={dispatchedChallans.map((c) => ({
                value: c._id || c.id,
                label: `${c.challanNo} — ${c.customerId?.name || ''}`,
              }))}
              value={selectedChallanId}
              onChange={setSelectedChallanId}
            />
            <p className="text-[10px] text-slate-500 uppercase font-bold">
              Invoice uses server totals · stock already deducted at challan
            </p>
            <button type="button" disabled={busy} onClick={handleInvoice} className="erp-btn-primary">
              Create tax invoice
            </button>
          </div>
        )}

        {tab === 'Return' && (
          <div className="space-y-3">
            <ERPSearchableSelect label="Customer" options={customerOpts} value={customerId} onChange={setCustomerId} />
            <ERPSearchableSelect label="Restore to lot" options={lotOpts} value={returnLotId} onChange={setReturnLotId} />
            <ERPInput label="Return mtrs" type="number" value={returnMts} onChange={(e) => setReturnMts(e.target.value)} />
            <ERPInput label="Rate" type="number" value={returnRate} onChange={(e) => setReturnRate(e.target.value)} />
            <button type="button" disabled={busy} onClick={handleReturn} className="erp-btn-primary">
              Post return (restore lot)
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SalesEngineModal;
