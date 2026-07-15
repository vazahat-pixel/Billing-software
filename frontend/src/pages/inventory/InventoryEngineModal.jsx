import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { inventoryEngineApi, warehousesApi } from '../../api';
import { toast } from '../../store/useToastStore';

const TABS = ['Availability', 'Reserve', 'Transfer', 'Adjust', 'Ledger'];

/**
 * Sprint 2.3 — Inventory lifecycle workspace (modal shell, no UI redesign).
 * Availability · Reservation · Transfer · Adjustment · Stock ledger
 */
const InventoryEngineModal = ({ isOpen, onClose }) => {
  const { inventoryLots, items, fetchInventory, fetchItems } = useStore();
  const [tab, setTab] = useState('Availability');
  const [pipeline, setPipeline] = useState(null);
  const [busy, setBusy] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [ledger, setLedger] = useState([]);

  const lotOpts = useMemo(
    () =>
      (inventoryLots || [])
        .filter((l) => (l.remainingMtrs || 0) > 0)
        .map((l) => ({
          value: l._id || l.id,
          label: `${l.lotId || l.lotCode || 'LOT'} — ${l.itemId?.name || l.itemName || 'Item'} (${(l.remainingMtrs || 0).toFixed(2)} m)`,
        })),
    [inventoryLots]
  );

  const itemOpts = useMemo(
    () => items.map((i) => ({ value: i._id || i.id, label: i.name || i.itemName })),
    [items]
  );

  const whOpts = useMemo(
    () => warehouses.map((w) => ({ value: w._id || w.id, label: w.name || w.code })),
    [warehouses]
  );

  const [filterItemId, setFilterItemId] = useState('');
  const [reserveLotId, setReserveLotId] = useState('');
  const [reserveMts, setReserveMts] = useState('');
  const [transferLotId, setTransferLotId] = useState('');
  const [transferWhId, setTransferWhId] = useState('');
  const [transferMts, setTransferMts] = useState('');
  const [adjustLotId, setAdjustLotId] = useState('');
  const [physicalMts, setPhysicalMts] = useState('');
  const [ledgerItemId, setLedgerItemId] = useState('');

  const refreshPipeline = async () => {
    try {
      setPipeline(await inventoryEngineApi.pipeline());
    } catch {
      setPipeline(null);
    }
  };

  const loadAvailability = async () => {
    try {
      setAvailability(await inventoryEngineApi.availability(filterItemId ? { itemId: filterItemId } : {}));
    } catch (e) {
      toast.error(e.message || 'Failed to load availability');
    }
  };

  const loadLists = async () => {
    const [rsv, trf] = await Promise.all([
      inventoryEngineApi.listReservations(),
      inventoryEngineApi.listTransfers(),
    ]);
    setReservations(rsv || []);
    setTransfers(trf || []);
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchInventory();
    fetchItems();
    warehousesApi.list().then(setWarehouses).catch(() => setWarehouses([]));
    setTab('Availability');
    refreshPipeline();
    loadLists();
  }, [isOpen, fetchInventory, fetchItems]);

  useEffect(() => {
    if (isOpen && tab === 'Availability') loadAvailability();
  }, [isOpen, tab, filterItemId]);

  const handleReserve = async () => {
    if (!reserveLotId || !reserveMts) return toast.error('Lot and quantity required');
    setBusy(true);
    try {
      await inventoryEngineApi.reserveStock({ lotId: reserveLotId, reservedMts: Number(reserveMts) });
      toast.success('Stock reserved');
      setReserveMts('');
      await fetchInventory();
      await loadLists();
      await refreshPipeline();
    } catch (e) {
      toast.error(e.message || 'Reserve failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRelease = async (id) => {
    setBusy(true);
    try {
      await inventoryEngineApi.releaseReservation(id, { consume: false });
      toast.success('Reservation released');
      await fetchInventory();
      await loadLists();
    } catch (e) {
      toast.error(e.message || 'Release failed');
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferLotId || !transferWhId || !transferMts) return toast.error('Lot, warehouse and qty required');
    setBusy(true);
    try {
      await inventoryEngineApi.transferStock({
        fromLotId: transferLotId,
        toWarehouseId: transferWhId,
        qtyMts: Number(transferMts),
      });
      toast.success('Transfer completed');
      setTransferMts('');
      await fetchInventory();
      await loadLists();
      await refreshPipeline();
    } catch (e) {
      toast.error(e.message || 'Transfer failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustLotId || physicalMts === '') return toast.error('Lot and physical qty required');
    const lot = inventoryLots.find((l) => (l._id || l.id) === adjustLotId);
    if (!lot) return toast.error('Lot not found');
    setBusy(true);
    try {
      const adj = await inventoryEngineApi.createAdjustment({
        reason: 'Physical verification',
        lines: [
          {
            lotId: adjustLotId,
            itemId: lot.itemId?._id || lot.itemId,
            systemMts: lot.remainingMtrs || 0,
            physicalMts: Number(physicalMts),
          },
        ],
      });
      await inventoryEngineApi.postAdjustment(adj._id || adj.id);
      toast.success('Adjustment posted');
      setPhysicalMts('');
      await fetchInventory();
      await refreshPipeline();
    } catch (e) {
      toast.error(e.message || 'Adjustment failed');
    } finally {
      setBusy(false);
    }
  };

  const loadLedger = async () => {
    setBusy(true);
    try {
      setLedger(await inventoryEngineApi.stockLedger(ledgerItemId ? { itemId: ledgerItemId } : {}));
    } catch (e) {
      toast.error(e.message || 'Ledger load failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inventory Engine" className="max-w-[92vw]">
      <div className="space-y-4 p-2">
        {pipeline && (
          <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Active lots: {pipeline.activeLots}</span>
            <span>Reservations: {pipeline.activeReservations}</span>
            <span>Transfers: {pipeline.transfersCompleted}</span>
            <span>Low stock: {pipeline.lowStockCount}</span>
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

        {tab === 'Availability' && (
          <div className="space-y-3">
            <ERPSearchableSelect
              label="Filter by item"
              options={[{ value: '', label: 'All items' }, ...itemOpts]}
              value={filterItemId}
              onChange={setFilterItemId}
            />
            <div className="max-h-64 overflow-auto border border-slate-100 rounded">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Lot</th>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-right">Physical</th>
                    <th className="p-2 text-right">Reserved</th>
                    <th className="p-2 text-right">Available</th>
                    <th className="p-2 text-left">Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {(availability?.rows || []).map((r) => (
                    <tr key={r.lotId} className="border-t border-slate-50">
                      <td className="p-2">{r.lotCode}</td>
                      <td className="p-2">{r.itemName}</td>
                      <td className="p-2 text-right">{r.physicalMtrs?.toFixed?.(2)}</td>
                      <td className="p-2 text-right">{r.reservedMtrs?.toFixed?.(2)}</td>
                      <td className="p-2 text-right font-semibold">{r.availableMtrs?.toFixed?.(2)}</td>
                      <td className="p-2">{r.holdStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {availability?.totals && (
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Total available: {availability.totals.availableMtrs?.toFixed?.(2)} mtrs
              </p>
            )}
          </div>
        )}

        {tab === 'Reserve' && (
          <div className="space-y-3">
            <ERPSearchableSelect label="Lot" options={lotOpts} value={reserveLotId} onChange={setReserveLotId} />
            <ERPInput label="Reserve mtrs" type="number" value={reserveMts} onChange={(e) => setReserveMts(e.target.value)} />
            <button type="button" disabled={busy} onClick={handleReserve} className="erp-btn-primary">
              Reserve stock
            </button>
            <div className="max-h-48 overflow-auto border border-slate-100 rounded text-xs">
              {(reservations || []).map((r) => (
                <div key={r._id || r.id} className="flex justify-between items-center p-2 border-b border-slate-50">
                  <span>
                    {r.reservationNo} — {r.reservedMts} m ({r.status})
                  </span>
                  {r.status === 'Active' && (
                    <button type="button" className="text-red-600 text-[10px] font-bold" onClick={() => handleRelease(r._id || r.id)}>
                      Release
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Transfer' && (
          <div className="space-y-3">
            <ERPSearchableSelect label="From lot" options={lotOpts} value={transferLotId} onChange={setTransferLotId} />
            <ERPSearchableSelect label="To warehouse" options={whOpts} value={transferWhId} onChange={setTransferWhId} />
            <ERPInput label="Qty mtrs" type="number" value={transferMts} onChange={(e) => setTransferMts(e.target.value)} />
            <button type="button" disabled={busy} onClick={handleTransfer} className="erp-btn-primary">
              Transfer
            </button>
            <div className="max-h-40 overflow-auto text-xs border border-slate-100 rounded">
              {(transfers || []).slice(0, 20).map((t) => (
                <div key={t._id || t.id} className="p-2 border-b border-slate-50">
                  {t.transferNo} — {t.qtyMts} m
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Adjust' && (
          <div className="space-y-3">
            <ERPSearchableSelect label="Lot" options={lotOpts} value={adjustLotId} onChange={setAdjustLotId} />
            <ERPInput label="Physical count (mtrs)" type="number" value={physicalMts} onChange={(e) => setPhysicalMts(e.target.value)} />
            <button type="button" disabled={busy} onClick={handleAdjust} className="erp-btn-primary">
              Post adjustment
            </button>
          </div>
        )}

        {tab === 'Ledger' && (
          <div className="space-y-3">
            <ERPSearchableSelect label="Item filter" options={[{ value: '', label: 'All' }, ...itemOpts]} value={ledgerItemId} onChange={setLedgerItemId} />
            <button type="button" disabled={busy} onClick={loadLedger} className="erp-btn-primary">
              Load ledger
            </button>
            <div className="max-h-64 overflow-auto border border-slate-100 rounded text-xs">
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Qty m</th>
                    <th className="p-2 text-right">Balance</th>
                    <th className="p-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(ledger || []).map((m) => (
                    <tr key={m._id || m.id} className="border-t border-slate-50">
                      <td className="p-2">{m.type}</td>
                      <td className="p-2 text-right">{m.qtyMtrs}</td>
                      <td className="p-2 text-right">{m.balanceMtrs}</td>
                      <td className="p-2">{m.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InventoryEngineModal;
