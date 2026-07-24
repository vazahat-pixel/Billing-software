import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { purchaseEngineApi } from '../../api';
import { toast } from '../../store/useToastStore';

const TABS = ['Indent', 'Quotation', 'PO', 'GRN', 'QC', 'Invoice'];

const blankLine = () => ({ itemId: '', mts: '', pcs: '0', rate: '' });

/**
 * Sprint 2.2 — Purchase lifecycle workspace (modal shell, no UI redesign).
 * Indent → Quote → PO → GRN → QC → Invoice (kernel via purchaseService).
 */
const PurchaseEngineModal = ({ isOpen, onClose }) => {
  const { parties, items, fetchParties, fetchItems, fetchPurchases } = useStore();
  const [tab, setTab] = useState('Indent');
  const [pipeline, setPipeline] = useState(null);
  const [busy, setBusy] = useState(false);

  const suppliers = useMemo(
    () => parties.filter((p) => ['Supplier', 'Both'].includes(p.type) || !p.type),
    [parties]
  );
  const itemOpts = useMemo(
    () => items.map((i) => ({ value: i._id || i.id, label: i.name || i.itemName })),
    [items]
  );
  const supplierOpts = useMemo(
    () => suppliers.map((p) => ({ value: p._id || p.id, label: p.name })),
    [suppliers]
  );

  // Indent form
  const [indentLines, setIndentLines] = useState([blankLine()]);
  const [indents, setIndents] = useState([]);
  const [selectedIndentId, setSelectedIndentId] = useState('');

  // Quote
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quoteLines, setQuoteLines] = useState([blankLine()]);
  const [quotes, setQuotes] = useState([]);
  const [compare, setCompare] = useState(null);

  // PO
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poLines, setPoLines] = useState([blankLine()]);
  const [orders, setOrders] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState('');

  // GRN / QC
  const [grns, setGrns] = useState([]);
  const [selectedGrnId, setSelectedGrnId] = useState('');
  const [grnReceive, setGrnReceive] = useState([]);

  const refreshPipeline = async () => {
    try {
      setPipeline(await purchaseEngineApi.pipeline());
    } catch {
      setPipeline(null);
    }
  };

  const loadLists = async () => {
    const [inds, ords, gs] = await Promise.all([
      purchaseEngineApi.listIndents(),
      purchaseEngineApi.listOrders(),
      purchaseEngineApi.listGrns(),
    ]);
    setIndents(inds || []);
    setOrders(ords || []);
    setGrns(gs || []);
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchParties();
    fetchItems();
    setTab('Indent');
    refreshPipeline();
    loadLists().catch((e) => toast.error(e.message));
  }, [isOpen, fetchParties, fetchItems]);

  const mapLines = (lines) =>
    lines
      .filter((l) => l.itemId)
      .map((l) => ({
        itemId: l.itemId,
        mts: Number(l.mts || 0),
        pcs: Number(l.pcs || 0),
        rate: Number(l.rate || 0),
        amount: Number(l.mts || 0) * Number(l.rate || 0),
      }));

  const LineEditor = ({ lines, setLines, showRate = true }) => (
    <div className="space-y-2">
      {lines.map((line, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-5">
            <ERPSearchableSelect
              className="w-full"
              value={line.itemId}
              onChange={(v) => {
                const next = [...lines];
                next[idx] = { ...next[idx], itemId: v };
                setLines(next);
              }}
              options={itemOpts}
              placeholder="Item"
            />
          </div>
          <div className="col-span-2">
            <ERPInput
              type="number"
              className="w-full"
              placeholder="Mts"
              value={line.mts}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...next[idx], mts: e.target.value };
                setLines(next);
              }}
            />
          </div>
          <div className="col-span-2">
            <ERPInput
              type="number"
              className="w-full"
              placeholder="Pcs"
              value={line.pcs}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...next[idx], pcs: e.target.value };
                setLines(next);
              }}
            />
          </div>
          {showRate && (
            <div className="col-span-2">
              <ERPInput
                type="number"
                className="w-full"
                placeholder="Rate"
                value={line.rate}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], rate: e.target.value };
                  setLines(next);
                }}
              />
            </div>
          )}
          <button
            type="button"
            className="col-span-1 text-xs text-red-500"
            onClick={() => setLines(lines.filter((_, i) => i !== idx))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="text-[10px] font-black uppercase" onClick={() => setLines([...lines, blankLine()])}>
        + Line
      </button>
    </div>
  );

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await refreshPipeline();
      await loadLists();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Purchase Engine" className="max-w-4xl">
      <div className="p-4 space-y-4">
        {pipeline && (
          <div className="grid grid-cols-4 gap-2 text-[10px] font-black uppercase tracking-wider">
            <div className="bg-slate-50 border p-2">Indents {pipeline.pendingIndents}</div>
            <div className="bg-slate-50 border p-2">Quotes {pipeline.openQuotes}</div>
            <div className="bg-slate-50 border p-2">Open POs {pipeline.openPOs}</div>
            <div className="bg-slate-50 border p-2">GRNs {pipeline.pendingGrns}</div>
          </div>
        )}

        <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-[10px] font-black uppercase ${tab === t ? 'bg-black text-white' : 'bg-slate-100'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Indent' && (
          <div className="space-y-3">
            <LineEditor lines={indentLines} setLines={setIndentLines} showRate={false} />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                className="flex-1 py-2 bg-slate-800 text-white text-[10px] font-black uppercase"
                onClick={() =>
                  run(async () => {
                    await purchaseEngineApi.createIndent({ items: mapLines(indentLines), submit: false });
                    setIndentLines([blankLine()]);
                  }, 'Indent draft saved')
                }
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                className="flex-1 py-2 bg-black text-white text-[10px] font-black uppercase"
                onClick={() =>
                  run(async () => {
                    const ind = await purchaseEngineApi.createIndent({ items: mapLines(indentLines), submit: true });
                    setSelectedIndentId(ind._id);
                    setIndentLines([blankLine()]);
                  }, 'Indent submitted')
                }
              >
                Submit for approval
              </button>
            </div>
            <div className="border max-h-40 overflow-auto text-xs">
              {(indents || []).map((i) => (
                <div key={i._id} className="flex justify-between border-b p-2">
                  <button type="button" className="text-left" onClick={() => setSelectedIndentId(i._id)}>
                    {i.indentNo} · {i.status}
                  </button>
                  {i.status === 'Submitted' && (
                    <button
                      type="button"
                      className="text-emerald-700 font-bold"
                      onClick={() => run(() => purchaseEngineApi.approveIndent(i._id, true), 'Approved')}
                    >
                      Approve
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Quotation' && (
          <div className="space-y-3">
            <ERPSearchableSelect
              className="w-full"
              value={quoteSupplierId}
              onChange={setQuoteSupplierId}
              options={supplierOpts}
              placeholder="Supplier"
            />
            <LineEditor lines={quoteLines} setLines={setQuoteLines} />
            <button
              type="button"
              disabled={busy}
              className="w-full py-2 bg-black text-white text-[10px] font-black uppercase"
              onClick={() =>
                run(async () => {
                  await purchaseEngineApi.createQuotation({
                    supplierId: quoteSupplierId,
                    indentId: selectedIndentId || undefined,
                    items: mapLines(quoteLines),
                  });
                  if (selectedIndentId) {
                    setCompare(await purchaseEngineApi.compareQuotations(selectedIndentId));
                    setQuotes(await purchaseEngineApi.listQuotations({ indentId: selectedIndentId }));
                  }
                  setQuoteLines([blankLine()]);
                }, 'Quotation saved')
              }
            >
              Save quotation
            </button>
            {selectedIndentId && (
              <button
                type="button"
                className="w-full py-2 bg-slate-700 text-white text-[10px] font-black uppercase"
                onClick={() =>
                  run(async () => {
                    setCompare(await purchaseEngineApi.compareQuotations(selectedIndentId));
                    setQuotes(await purchaseEngineApi.listQuotations({ indentId: selectedIndentId }));
                  })
                }
              >
                Compare quotes for indent
              </button>
            )}
            {compare && (
              <pre className="text-[10px] bg-slate-50 p-2 max-h-40 overflow-auto">{JSON.stringify(compare.comparison, null, 2)}</pre>
            )}
            <div className="border max-h-32 overflow-auto text-xs">
              {(quotes || []).map((q) => (
                <div key={q._id} className="flex justify-between p-2 border-b">
                  <span>
                    {q.quoteNo} · {q.supplierId?.name || ''} · ₹{q.totalAmount} · {q.status}
                  </span>
                  {q.status === 'Received' && (
                    <button
                      type="button"
                      className="text-emerald-700 font-bold"
                      onClick={() => run(() => purchaseEngineApi.selectQuotation(q._id), 'Selected')}
                    >
                      Select
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'PO' && (
          <div className="space-y-3">
            <ERPSearchableSelect
              className="w-full"
              value={poSupplierId}
              onChange={setPoSupplierId}
              options={supplierOpts}
              placeholder="Supplier"
            />
            <LineEditor lines={poLines} setLines={setPoLines} />
            <button
              type="button"
              disabled={busy}
              className="w-full py-2 bg-black text-white text-[10px] font-black uppercase"
              onClick={() =>
                run(async () => {
                  const po = await purchaseEngineApi.createOrder({
                    supplierId: poSupplierId,
                    partyId: poSupplierId,
                    indentId: selectedIndentId || undefined,
                    items: mapLines(poLines),
                    requireApproval: true,
                  });
                  setSelectedPoId(po._id);
                  setPoLines([blankLine()]);
                }, 'PO created (pending approval)')
              }
            >
              Create PO
            </button>
            <div className="border max-h-40 overflow-auto text-xs">
              {(orders || []).map((o) => (
                <div key={o._id} className="flex justify-between border-b p-2">
                  <button type="button" onClick={() => setSelectedPoId(o._id)}>
                    {o.orderNo} · {o.partyId?.name || ''} · {o.status}
                  </button>
                  {o.status === 'PendingApproval' && (
                    <button
                      type="button"
                      className="text-emerald-700 font-bold"
                      onClick={() => run(() => purchaseEngineApi.approveOrder(o._id, true), 'PO approved')}
                    >
                      Approve
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'GRN' && (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-500 uppercase font-bold">
              Selected PO: {selectedPoId || '— (pick from PO tab)'}
            </p>
            <button
              type="button"
              disabled={busy || !selectedPoId}
              className="w-full py-2 bg-black text-white text-[10px] font-black uppercase disabled:opacity-40"
              onClick={() =>
                run(async () => {
                  const po = orders.find((o) => o._id === selectedPoId);
                  const items = (po?.items || []).map((l, orderItemIndex) => ({
                    itemId: l.itemId?._id || l.itemId,
                    orderItemIndex,
                    receivedMts: Math.max(0, (l.mts || 0) - (l.receivedMts || 0)),
                    receivedPcs: Math.max(0, (l.pcs || 0) - (l.receivedPcs || 0)),
                    rate: l.rate || 0,
                  }));
                  const grn = await purchaseEngineApi.createGrn({
                    purchaseOrderId: selectedPoId,
                    items,
                  });
                  setSelectedGrnId(grn._id);
                  setTab('QC');
                }, 'GRN created — proceed to QC')
              }
            >
              Receive full remaining qty as GRN
            </button>
            <div className="border max-h-40 overflow-auto text-xs">
              {(grns || []).map((g) => (
                <button
                  key={g._id}
                  type="button"
                  className="w-full text-left border-b p-2"
                  onClick={() => {
                    setSelectedGrnId(g._id);
                    setGrnReceive(g.items || []);
                  }}
                >
                  {g.grnNo} · {g.status} · PO {g.purchaseOrderId?.orderNo || ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'QC' && (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-500 uppercase font-bold">GRN: {selectedGrnId || '—'}</p>
            <button
              type="button"
              disabled={busy || !selectedGrnId}
              className="w-full py-2 bg-emerald-700 text-white text-[10px] font-black uppercase disabled:opacity-40"
              onClick={() =>
                run(async () => {
                  const grn = grns.find((g) => g._id === selectedGrnId) || (await purchaseEngineApi.listGrns()).find((g) => g._id === selectedGrnId);
                  const items = (grn?.items || grnReceive || []).map((l, orderItemIndex) => ({
                    orderItemIndex,
                    itemId: l.itemId?._id || l.itemId,
                    acceptedMts: l.receivedMts,
                    acceptedPcs: l.receivedPcs,
                  }));
                  await purchaseEngineApi.performQc(selectedGrnId, { items });
                  setTab('Invoice');
                }, 'QC passed (accepted = received)')
              }
            >
              Pass QC (accept all received)
            </button>
          </div>
        )}

        {tab === 'Invoice' && (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-500 uppercase font-bold">
              Convert QC-passed GRN → Purchase Invoice (stock + accounting)
            </p>
            <button
              type="button"
              disabled={busy || !selectedGrnId}
              className="w-full py-2 bg-black text-white text-[10px] font-black uppercase disabled:opacity-40"
              onClick={() =>
                run(async () => {
                  await purchaseEngineApi.convertToInvoice(selectedGrnId, { gstPer: 5 });
                  await fetchPurchases();
                }, 'Invoice posted from GRN')
              }
            >
              Create purchase invoice
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PurchaseEngineModal;

