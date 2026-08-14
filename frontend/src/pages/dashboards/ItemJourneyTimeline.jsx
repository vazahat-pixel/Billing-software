import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Package, ShoppingCart, Zap, TrendingUp, Home } from 'lucide-react';
import Modal from '../../components/ui/Modal';

/**
 * Item Complete Journey Timeline
 * Shows the complete material journey from purchase through various processes to sale
 * Visualizes: Purchase → Warehouse → Mill → Job → Sale
 */
const ItemJourneyTimeline = ({ isOpen, onClose, itemName, journeyData = [] }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Sorted journey events by date
  const sortedJourney = (journeyData || []).sort((a, b) => new Date(a.date) - new Date(b.date));

  const getEventIcon = (type) => {
    const icons = {
      purchase: <ShoppingCart className="text-indigo-600" size={20} />,
      warehouse: <Home className="text-blue-600" size={20} />,
      mill_issue: <Truck className="text-orange-600" size={20} />,
      mill_receive: <Package className="text-emerald-600" size={20} />,
      job_issue: <Truck className="text-purple-600" size={20} />,
      job_receive: <Package className="text-cyan-600" size={20} />,
      sale: <ShoppingCart className="text-rose-600" size={20} />,
      adjustment: <Zap className="text-yellow-600" size={20} />,
    };
    return icons[type] || <Package className="text-slate-600" size={20} />;
  };

  const getEventColor = (type) => {
    const colors = {
      purchase: 'bg-indigo-50 border-indigo-200',
      warehouse: 'bg-blue-50 border-blue-200',
      mill_issue: 'bg-orange-50 border-orange-200',
      mill_receive: 'bg-emerald-50 border-emerald-200',
      job_issue: 'bg-purple-50 border-purple-200',
      job_receive: 'bg-cyan-50 border-cyan-200',
      sale: 'bg-rose-50 border-rose-200',
      adjustment: 'bg-yellow-50 border-yellow-200',
    };
    return colors[type] || 'bg-slate-50 border-slate-200';
  };

  const getEventTitle = (event) => {
    const titles = {
      purchase: '📋 Purchase',
      warehouse: '📦 Warehouse Stock',
      mill_issue: '📤 Sent to Mill',
      mill_receive: '✅ Received from Mill',
      job_issue: '📤 Sent to Job Worker',
      job_receive: '✅ Received from Job Worker',
      sale: '💰 Sale',
      adjustment: '⚙️ Adjustment',
    };
    return titles[event.type] || event.type;
  };

  // Calculate running balance
  let runningBalance = 0;
  const journeyWithBalance = sortedJourney.map((event, idx) => {
    if (event.type === 'purchase' || event.type === 'warehouse' || event.type === 'mill_receive' || event.type === 'job_receive' || event.type === 'adjustment') {
      runningBalance += event.quantity || 0;
    } else if (event.type === 'mill_issue' || event.type === 'job_issue' || event.type === 'sale') {
      runningBalance -= event.quantity || 0;
    }
    return { ...event, balance: Math.max(0, runningBalance) };
  });

  const totalPurchased = sortedJourney
    .filter((e) => e.type === 'purchase')
    .reduce((sum, e) => sum + (e.quantity || 0), 0);

  const totalSold = sortedJourney
    .filter((e) => e.type === 'sale')
    .reduce((sum, e) => sum + (e.quantity || 0), 0);

  const currentStock = journeyWithBalance.length > 0 ? journeyWithBalance[journeyWithBalance.length - 1].balance : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${itemName} - Complete Journey`}>
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-white">
        {/* Summary Stats */}
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
              <p className="text-xs text-indigo-600 uppercase tracking-tight font-semibold mb-1">Purchased</p>
              <p className="text-xl font-black text-indigo-900">{totalPurchased.toLocaleString()}m</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
              <p className="text-xs text-rose-600 uppercase tracking-tight font-semibold mb-1">Sold</p>
              <p className="text-xl font-black text-rose-900">{totalSold.toLocaleString()}m</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
              <p className="text-xs text-emerald-600 uppercase tracking-tight font-semibold mb-1">Current Stock</p>
              <p className="text-xl font-black text-emerald-900">{currentStock.toLocaleString()}m</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-amber-600 uppercase tracking-tight font-semibold mb-1">Total Events</p>
              <p className="text-xl font-black text-amber-900">{sortedJourney.length}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {journeyWithBalance.length > 0 ? (
            <div className="space-y-4">
              {journeyWithBalance.map((event, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => setSelectedEvent(selectedEvent === idx ? null : idx)}
                  className="cursor-pointer"
                >
                  {/* Timeline Connector */}
                  {idx < journeyWithBalance.length - 1 && (
                    <div className="ml-6 h-6 border-l-2 border-slate-300"></div>
                  )}

                  {/* Event Card */}
                  <div className={`border-2 rounded-xl p-5 transition-all hover:shadow-md ${getEventColor(event.type)}`}>
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-full bg-white border-2 border-current flex items-center justify-center shrink-0">
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">{getEventTitle(event)}</h3>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(event.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-white border border-current">
                            {event.quantity?.toLocaleString()}m
                          </span>
                        </div>

                        {/* Details Row */}
                        <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-current border-opacity-20">
                          <div>
                            <p className="text-xs text-slate-600 font-medium mb-1">Quantity</p>
                            <p className="font-bold text-slate-900">{event.quantity?.toLocaleString()}m</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 font-medium mb-1">Reference</p>
                            <p className="font-mono text-sm text-slate-700 truncate">{event.reference || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 font-medium mb-1">Balance After</p>
                            <p className="font-bold text-slate-900">{event.balance?.toLocaleString()}m</p>
                          </div>
                        </div>

                        {/* Additional Details */}
                        {['mill_issue', 'mill_receive', 'job_issue', 'job_receive'].includes(event.type) && (
                          <div className="mt-3 p-3 bg-white/60 border border-current border-opacity-30 rounded-lg">
                            <p className="text-sm text-slate-700">
                              {event.type === 'mill_issue' && `Sent to: ${event.destination || 'Mill'}`}
                              {event.type === 'mill_receive' && `Received from: ${event.source || 'Mill'} • Wastage: ${event.wastage || 0}m`}
                              {event.type === 'job_issue' && `Sent to: ${event.destination || 'Job Worker'}`}
                              {event.type === 'job_receive' && `Received from: ${event.source || 'Job Worker'} • Wastage: ${event.wastage || 0}m`}
                            </p>
                          </div>
                        )}

                        {event.type === 'sale' && (
                          <div className="mt-3 p-3 bg-white/60 border border-current border-opacity-30 rounded-lg">
                            <p className="text-sm text-slate-700">
                              Sold to: {event.customer || 'Customer'} • Rate: ₹{event.rate || 0}/m
                            </p>
                          </div>
                        )}

                        {event.type === 'purchase' && (
                          <div className="mt-3 p-3 bg-white/60 border border-current border-opacity-30 rounded-lg">
                            <p className="text-sm text-slate-700">
                              From: {event.supplier || 'Supplier'} • Rate: ₹{event.rate || 0}/m • Invoice: {event.invoice || '—'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Final Status Card */}
              <div className="mt-6 p-5 bg-white rounded-xl border-2 border-emerald-300 shadow-sm">
                <h3 className="font-bold text-emerald-900 mb-4">Current Status Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-medium">Total Purchased:</span>
                    <span className="text-slate-900 font-bold">{totalPurchased.toLocaleString()}m</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-medium">Total Sold:</span>
                    <span className="text-slate-900 font-bold">{totalSold.toLocaleString()}m</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                    <span className="text-emerald-900 font-bold">Current Warehouse Stock:</span>
                    <span className="text-emerald-900 font-black text-lg">{currentStock.toLocaleString()}m</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Package className="text-slate-300 mb-4" size={48} />
              <p className="text-slate-500 font-medium">No journey events yet</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ItemJourneyTimeline;
