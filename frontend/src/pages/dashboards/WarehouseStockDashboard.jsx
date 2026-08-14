import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, MapPin, AlertCircle, TrendingUp } from 'lucide-react';
import Modal from '../../components/ui/Modal';

/**
 * Warehouse Stock Location Dashboard
 * Shows where material is currently located across:
 * - Warehouses
 * - With Mills/Job Workers
 * - Sold/Shipped
 */
const WarehouseStockDashboard = ({ isOpen, onClose, warehouseData = {}, inventory = [] }) => {
  const [expandedWarehouse, setExpandedWarehouse] = useState(null);
  const [sortBy, setSortBy] = useState('quantity');

  // Group inventory by warehouse/location
  const groupedInventory = (inventory || []).reduce((acc, lot) => {
    const location = lot.warehouseId ? 'warehouse' : lot.sourceJobId ? 'job' : 'warehouse';
    const key = lot.warehouseId || lot.sourceJobId || 'main';

    if (!acc[key]) {
      acc[key] = {
        type: location,
        name: lot.warehouseName || lot.jobWorkerName || 'Main Warehouse',
        items: [],
        totalMtrs: 0,
        totalPcs: 0,
      };
    }

    acc[key].items.push(lot);
    acc[key].totalMtrs += lot.remainingMtrs || 0;
    acc[key].totalPcs += lot.remainingPcs || 0;

    return acc;
  }, {});

  const locations = Object.values(groupedInventory).sort((a, b) => {
    if (sortBy === 'quantity') return b.totalMtrs - a.totalMtrs;
    return a.name.localeCompare(b.name);
  });

  const totalStockMtrs = locations.reduce((sum, loc) => sum + loc.totalMtrs, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Warehouse Stock Location Dashboard">
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-white">
        {/* Header Stats */}
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
              <p className="text-xs text-indigo-600 uppercase tracking-tight font-semibold mb-1">Total Stock</p>
              <p className="text-2xl font-black text-indigo-900">{totalStockMtrs.toLocaleString()}m</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
              <p className="text-xs text-emerald-600 uppercase tracking-tight font-semibold mb-1">Locations</p>
              <p className="text-2xl font-black text-emerald-900">{locations.length}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <p className="text-xs text-amber-600 uppercase tracking-tight font-semibold mb-1">Stock Items</p>
              <p className="text-2xl font-black text-amber-900">{inventory.length}</p>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('quantity')}
              className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                sortBy === 'quantity'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Sort by Quantity
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                sortBy === 'name'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Sort by Name
            </button>
          </div>
        </div>

        {/* Locations */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {locations.map((location, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Location Header */}
                <button
                  onClick={() => setExpandedWarehouse(expandedWarehouse === idx ? null : idx)}
                  className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      {location.type === 'warehouse' ? (
                        <Package className="text-indigo-600" size={20} />
                      ) : (
                        <MapPin className="text-orange-600" size={20} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{location.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{location.items.length} different items</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-slate-900">{location.totalMtrs.toLocaleString()}m</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {((location.totalMtrs / totalStockMtrs) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </button>

                {/* Location Details (Expandable) */}
                {expandedWarehouse === idx && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {location.items.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          className="bg-white rounded-lg p-4 border border-slate-200 hover:border-indigo-300 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-slate-900">{item.itemName}</h4>
                              <p className="text-xs text-slate-500 mt-1">Lot: {item.lotId}</p>
                            </div>
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                              {item.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-200">
                            <div>
                              <p className="text-xs text-slate-500 font-medium mb-1">Quantity</p>
                              <p className="font-bold text-slate-900">{(item.remainingMtrs || 0).toLocaleString()}m</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium mb-1">Rate</p>
                              <p className="font-bold text-slate-900">₹{(item.rate || 0).toLocaleString()}/m</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium mb-1">Value</p>
                              <p className="font-bold text-slate-900">₹{((item.remainingMtrs || 0) * (item.rate || 0)).toLocaleString()}</p>
                            </div>
                          </div>

                          {item.holdStatus && item.holdStatus !== 'None' && (
                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded flex items-center gap-2">
                              <AlertCircle className="text-amber-600" size={14} />
                              <p className="text-xs text-amber-700 font-medium">Hold Status: {item.holdStatus}</p>
                            </div>
                          )}

                          {item.source === 'job_receive' && item.parentLotId && (
                            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2">
                              <TrendingUp className="text-blue-600" size={14} />
                              <p className="text-xs text-blue-700 font-medium">Finished from: {item.parentLotId}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Location Summary */}
                    <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200 font-semibold text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-700">Subtotal:</span>
                        <span className="text-slate-900">{location.totalMtrs.toLocaleString()}m @ ₹{(location.items.reduce((sum, i) => sum + (i.rate || 0), 0) / location.items.length || 0).toFixed(2)}/m avg</span>
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                        <span className="text-slate-700">Inventory Value:</span>
                        <span className="text-slate-900 font-black">₹{location.items.reduce((sum, i) => sum + ((i.remainingMtrs || 0) * (i.rate || 0)), 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}

            {locations.length === 0 && (
              <div className="text-center py-12">
                <Package className="text-slate-300 mx-auto mb-4" size={48} />
                <p className="text-slate-500 font-medium">No stock currently in inventory</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default WarehouseStockDashboard;
