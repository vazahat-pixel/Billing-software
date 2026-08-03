import React, { useState, useEffect, useMemo } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { ErpBusyOverlay } from '../../components/ui/loaders';
import LotDetails from './LotDetails';

/** LotNo Entry — type any Lot No and jump straight to its full traceability/movement history. */
const LotNoEntryModal = ({ isOpen, onClose }) => {
  const { inventoryLots, fetchInventory } = useStore();
  const [query, setQuery] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedLotId('');
    setQuery('');
    setLoading(true);
    fetchInventory().finally(() => setLoading(false));
  }, [isOpen, fetchInventory]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (inventoryLots || [])
      .filter((l) => String(l.lotId || '').toLowerCase().includes(q))
      .slice(0, 30);
  }, [inventoryLots, query]);

  if (!isOpen) return null;

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title="LotNo Entry" windowId="lotNoEntry" bare>
      {({ WindowControls }) => (
        <div className="classic-erp-window erp-density flex flex-col h-full min-h-0 !max-h-none">
          <ErpBusyOverlay show={loading} message="Loading lots…" />
          <div className="classic-erp-header shrink-0">
            <span className="erp-window-title truncate">LotNo Entry</span>
            <WindowControls />
          </div>

          <div className="classic-erp-body flex-1 overflow-y-auto min-h-0 p-2">
            {!selectedLotId ? (
              <div className="classic-erp-frame flex flex-col gap-2">
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Lot No:</span>
                  <input
                    type="text"
                    autoFocus
                    className="classic-erp-input flex-1"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && matches[0]) setSelectedLotId(matches[0].lotId);
                    }}
                    placeholder="Type Lot No — e.g. LOT-1785..."
                  />
                </div>
                <div className="text-[11px] max-h-96 overflow-auto border border-slate-300 rounded">
                  {query && matches.length === 0 && (
                    <div className="p-4 text-center text-slate-400">No matching lot</div>
                  )}
                  {matches.map((l) => (
                    <div
                      key={l._id || l.id}
                      className="px-2 py-1.5 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex justify-between"
                      onClick={() => setSelectedLotId(l.lotId)}
                    >
                      <span className="font-bold">{l.lotId}</span>
                      <span className="text-slate-500">{l.itemName || l.itemId?.name} — {Number(l.remainingMtrs || 0).toFixed(2)}m / {l.remainingPcs || 0}pcs — {l.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <LotDetails lotId={selectedLotId} onBack={() => setSelectedLotId('')} />
            )}
          </div>

          <div className="classic-erp-form-footer flex-wrap">
            <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

export default LotNoEntryModal;
