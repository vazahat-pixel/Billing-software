import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal';

/**
 * Party 360° Profile - Shows complete party information
 * Displays: Financial overview, material movements (for mills/job workers),
 * outstanding balance, and all related transactions
 */
const Party360Modal = ({ isOpen, onClose, party, ledgerData = {}, materialData = {} }) => {
  const [activeTab, setActiveTab] = useState('financial');
  const [loading, setLoading] = useState(false);

  if (!party) return null;

  const isJobWorkerOrMill = ['Job Worker', 'Transport'].includes(party.type);

  const financial = ledgerData || {};
  const material = materialData || {};

  const outstandingAmount = party.outstandingPayable || party.outstandingReceivable || 0;
  const isPayable = party.type === 'Supplier' || party.type === 'Both';
  const isReceivable = party.type === 'Customer' || party.type === 'Both';

  const tabs = [
    { id: 'financial', label: 'Financial', icon: '💰' },
    ...(isJobWorkerOrMill ? [{ id: 'material', label: 'Material', icon: '📦' }] : []),
    { id: 'outstanding', label: 'Outstanding', icon: '⏳' },
    { id: 'documents', label: 'Documents', icon: '📄' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${party.name} - Party Profile`}>
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-white">
        {/* Tab Navigation */}
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'financial' && (
              <motion.div
                key="financial"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Party Details Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 text-lg">Party Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-tight font-semibold">Type</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">{party.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-tight font-semibold">Status</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">{party.status}</p>
                    </div>
                    {party.gstin && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-tight font-semibold">GSTIN</p>
                        <p className="text-sm font-mono text-slate-700 mt-1">{party.gstin}</p>
                      </div>
                    )}
                    {party.city && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-tight font-semibold">City</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{party.city}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Purchase & Payment Summary (if supplier) */}
                {(party.type === 'Supplier' || party.type === 'Both') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 shadow-sm">
                      <p className="text-xs text-blue-600 uppercase tracking-tight font-semibold mb-2">Total Purchases</p>
                      <p className="text-2xl font-black text-blue-900">₹{(financial.totalPurchase || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5 shadow-sm">
                      <p className="text-xs text-emerald-600 uppercase tracking-tight font-semibold mb-2">Total Paid</p>
                      <p className="text-2xl font-black text-emerald-900">₹{(financial.totalPayment || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                )}

                {/* Sales & Receipt Summary (if customer) */}
                {(party.type === 'Customer' || party.type === 'Both') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-purple-50 rounded-xl border border-purple-200 p-5 shadow-sm">
                      <p className="text-xs text-purple-600 uppercase tracking-tight font-semibold mb-2">Total Sales</p>
                      <p className="text-2xl font-black text-purple-900">₹{(financial.totalSales || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-cyan-50 rounded-xl border border-cyan-200 p-5 shadow-sm">
                      <p className="text-xs text-cyan-600 uppercase tracking-tight font-semibold mb-2">Total Received</p>
                      <p className="text-2xl font-black text-cyan-900">₹{(financial.totalReceipt || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                )}

                {/* Recent Transactions */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 text-lg">Recent Transactions</h3>
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {financial.recentTransactions && financial.recentTransactions.length > 0 ? (
                      financial.recentTransactions.map((txn, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900">{txn.type}</p>
                            <p className="text-xs text-slate-500">{new Date(txn.date).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${txn.amount > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                              ₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 py-4 text-center">No transactions yet</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'material' && isJobWorkerOrMill && (
              <motion.div
                key="material"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 text-lg">Material Movements</h3>

                  {/* Material Sent */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="text-orange-600" size={20} />
                      <h4 className="font-semibold text-slate-900">Material Sent (Issues)</h4>
                    </div>
                    <div className="space-y-2 pl-8">
                      {material.issues && material.issues.length > 0 ? (
                        material.issues.map((issue, idx) => (
                          <div key={idx} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{issue.itemName}</p>
                              <p className="text-xs text-slate-500">{new Date(issue.date).toLocaleDateString()}</p>
                            </div>
                            <p className="font-bold text-slate-900">{(issue.quantity || 0).toLocaleString()}m</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 py-2">No issues yet</p>
                      )}
                      {material.totalIssued && (
                        <div className="flex justify-between pt-3 border-t-2 border-orange-200 font-bold">
                          <span className="text-slate-900">Total Sent:</span>
                          <span className="text-orange-600">{material.totalIssued.toLocaleString()}m</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Material Received */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="text-emerald-600" size={20} />
                      <h4 className="font-semibold text-slate-900">Material Received (Receipts)</h4>
                    </div>
                    <div className="space-y-2 pl-8">
                      {material.receives && material.receives.length > 0 ? (
                        material.receives.map((receipt, idx) => (
                          <div key={idx} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{receipt.itemName}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(receipt.date).toLocaleDateString()} • Wastage: {receipt.wastage || 0}m
                              </p>
                            </div>
                            <p className="font-bold text-slate-900">{(receipt.quantity || 0).toLocaleString()}m</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 py-2">No receipts yet</p>
                      )}
                      {material.totalReceived && (
                        <div className="flex justify-between pt-3 border-t-2 border-emerald-200 font-bold">
                          <span className="text-slate-900">Total Received:</span>
                          <span className="text-emerald-600">{material.totalReceived.toLocaleString()}m</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pending Material */}
                  {material.totalPending > 0 && (
                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-amber-600" size={18} />
                        <p className="font-semibold text-amber-900">Pending Material</p>
                      </div>
                      <p className="text-sm text-amber-800">
                        {material.totalPending.toLocaleString()} meters currently with this party
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'outstanding' && (
              <motion.div
                key="outstanding"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-6 text-lg">Outstanding Balance</h3>

                  {/* Outstanding Amount Card */}
                  <div className={`rounded-xl border-2 p-6 mb-6 ${outstandingAmount > 0 ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300'}`}>
                    <p className={`text-xs uppercase tracking-tight font-semibold mb-2 ${outstandingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      Outstanding {isPayable ? 'Payable' : isReceivable ? 'Receivable' : 'Amount'}
                    </p>
                    <p className={`text-3xl font-black ${outstandingAmount > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
                      ₹{Math.abs(outstandingAmount).toLocaleString('en-IN')}
                    </p>
                  </div>

                  {/* Credit Limit */}
                  {party.creditLimit > 0 && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-600 uppercase tracking-tight font-semibold mb-2">Credit Limit</p>
                      <div className="flex justify-between items-end gap-4">
                        <div>
                          <p className="text-2xl font-black text-blue-900">₹{party.creditLimit.toLocaleString('en-IN')}</p>
                          <p className="text-xs text-blue-600 mt-1">Available: ₹{Math.max(0, party.creditLimit - outstandingAmount).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="w-32 h-2 bg-blue-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${Math.min(100, (outstandingAmount / party.creditLimit) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Opening Balance */}
                  {party.openingBalance !== 0 && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-xs text-slate-600 uppercase tracking-tight font-semibold mb-2">Opening Balance</p>
                      <p className={`text-lg font-bold ${party.openingBalance > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                        ₹{party.openingBalance.toLocaleString('en-IN')} ({party.openingBalanceType})
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'documents' && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 text-lg">Related Documents</h3>
                  <div className="space-y-3">
                    {financial.documents && financial.documents.length > 0 ? (
                      financial.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">📄</span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{doc.type}</p>
                              <p className="text-xs text-slate-500">{doc.number}</p>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-slate-600">{new Date(doc.date).toLocaleDateString()}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 py-4 text-center">No documents yet</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
};

export default Party360Modal;
