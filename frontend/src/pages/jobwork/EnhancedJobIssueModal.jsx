import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Package, Check, ChevronRight } from 'lucide-react';
import Modal from '../../components/ui/Modal';

/**
 * Enhanced Job Issue Modal - Clarity on warehouse stock consumption
 * Addresses the confusion about whether job issue is creating items or consuming warehouse stock
 *
 * Shows:
 * 1. Available warehouse stock
 * 2. Selection of material to issue
 * 3. Before/after warehouse snapshot
 * 4. Clear confirmation
 */
const EnhancedJobIssueModal = ({
  isOpen,
  onClose,
  onSubmit,
  availableInventory = [],
  parties = [],
  items = [],
  loading = false,
}) => {
  const [step, setStep] = useState(1);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [issueQuantity, setIssueQuantity] = useState('');
  const [jobWorker, setJobWorker] = useState('');
  const [processType, setProcessType] = useState('Dyeing');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [charges, setCharges] = useState('');
  const [notes, setNotes] = useState('');

  const selectedLot = useMemo(
    () => availableInventory.find((lot) => lot._id === selectedLotId),
    [selectedLotId, availableInventory]
  );

  const remainingAfterIssue = useMemo(() => {
    if (!selectedLot) return 0;
    const toIssue = parseFloat(issueQuantity) || 0;
    return Math.max(0, (selectedLot.remainingMtrs || 0) - toIssue);
  }, [selectedLot, issueQuantity]);

  const isValid = selectedLotId && issueQuantity && jobWorker && processType;

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      lotId: selectedLotId,
      jobWorkerId: jobWorker,
      issueQuantity: parseFloat(issueQuantity),
      processType,
      expectedOutputItem: expectedOutput,
      charges: parseFloat(charges) || 0,
      notes,
    });
    handleReset();
  };

  const handleReset = () => {
    setStep(1);
    setSelectedLotId(null);
    setIssueQuantity('');
    setJobWorker('');
    setProcessType('Dyeing');
    setExpectedOutput('');
    setCharges('');
    setNotes('');
  };

  const PROCESS_TYPES = ['Dyeing', 'Printing', 'Finishing', 'Bleaching', 'Stitching', 'Other'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Job Issue">
      <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-white">
        {/* Step Indicator */}
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full font-bold flex items-center justify-center transition-all ${
                    step >= s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {s}
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {s === 1 ? 'Select Material' : s === 2 ? 'Job Details' : 'Review'}
                </span>
                {s < 3 && <ChevronRight className="text-slate-300" size={16} />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* STEP 1: SELECT MATERIAL */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                  <div className="flex gap-3">
                    <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h3 className="font-bold text-blue-900 mb-1">Important</h3>
                      <p className="text-sm text-blue-800">
                        Job Issue will consume material from your warehouse stock. Select the warehouse lot below.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 mb-4 text-lg">Available Warehouse Stock</h3>

                  {availableInventory.length > 0 ? (
                    <div className="space-y-3">
                      {availableInventory.map((lot) => (
                        <motion.button
                          key={lot._id}
                          onClick={() => setSelectedLotId(lot._id)}
                          whileHover={{ scale: 1.02 }}
                          className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                            selectedLotId === lot._id
                              ? 'border-indigo-500 bg-indigo-50 shadow-md'
                              : 'border-slate-200 bg-white hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-slate-900">{lot.itemName}</h4>
                              <p className="text-xs text-slate-500 mt-1">Lot ID: {lot.lotId}</p>
                            </div>
                            {selectedLotId === lot._id && (
                              <div className="bg-indigo-600 text-white rounded-full p-1">
                                <Check size={16} />
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs text-slate-600 font-medium mb-1">Available</p>
                              <p className="font-bold text-slate-900">{(lot.remainingMtrs || 0).toLocaleString()}m</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 font-medium mb-1">Rate</p>
                              <p className="font-bold text-slate-900">₹{(lot.rate || 0).toLocaleString()}/m</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 font-medium mb-1">Warehouse</p>
                              <p className="font-bold text-slate-900">{lot.warehouseName || 'Main'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 font-medium mb-1">Status</p>
                              <p className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                {lot.status}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-100 rounded-xl">
                      <Package className="text-slate-400 mx-auto mb-4" size={48} />
                      <p className="text-slate-600 font-medium">No available stock in warehouse</p>
                      <p className="text-sm text-slate-500 mt-2">Create a purchase first to add inventory</p>
                    </div>
                  )}

                  {selectedLot && (
                    <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-sm text-indigo-900">
                        <span className="font-bold">Selected: </span>
                        {selectedLot.itemName} — {selectedLot.remainingMtrs} meters available
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2: JOB DETAILS */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Material Being Issued</h3>
                  <div className="p-4 bg-slate-50 rounded-lg mb-4">
                    <p className="text-sm text-slate-600 mb-2">
                      <span className="font-semibold">Item:</span> {selectedLot?.itemName}
                    </p>
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">Available:</span> {(selectedLot?.remainingMtrs || 0).toLocaleString()}m
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Quantity to Issue (meters)
                      </label>
                      <input
                        type="number"
                        value={issueQuantity}
                        onChange={(e) => setIssueQuantity(e.target.value)}
                        placeholder="Enter quantity"
                        max={selectedLot?.remainingMtrs || 0}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                      {issueQuantity && (
                        <p className="text-xs text-slate-600 mt-2">
                          Warehouse remaining: {remainingAfterIssue.toLocaleString()}m after issue
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Job Worker/Party
                      </label>
                      <select
                        value={jobWorker}
                        onChange={(e) => setJobWorker(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      >
                        <option value="">Select Job Worker...</option>
                        {parties
                          .filter((p) => p.type === 'Job Worker' || p.type === 'Transport')
                          .map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Process Type
                      </label>
                      <select
                        value={processType}
                        onChange={(e) => setProcessType(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      >
                        {PROCESS_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Process Details (Optional)</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Expected Output Item
                      </label>
                      <select
                        value={expectedOutput}
                        onChange={(e) => setExpectedOutput(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      >
                        <option value="">Same as input</option>
                        {items.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-2">
                        Leave empty if output item is same. This tracks material transformation.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Process Charges (₹/meter)
                      </label>
                      <input
                        type="number"
                        value={charges}
                        onChange={(e) => setCharges(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Notes/Remarks
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any additional notes..."
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: REVIEW */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5">
                  <h3 className="font-bold text-emerald-900 mb-2">Review Job Issue</h3>
                  <p className="text-sm text-emerald-800">
                    Confirm the details below. This will move material from warehouse to job worker.
                  </p>
                </div>

                {/* Before/After */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                    <h4 className="font-bold text-red-900 mb-4">Before Issue</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-red-600 font-semibold mb-1">Warehouse Stock</p>
                        <p className="text-2xl font-black text-red-900">
                          {(selectedLot?.remainingMtrs || 0).toLocaleString()}m
                        </p>
                      </div>
                      <div className="pt-3 border-t border-red-300">
                        <p className="text-xs text-red-600 font-semibold mb-1">Item</p>
                        <p className="text-sm text-red-900">{selectedLot?.itemName}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
                    <h4 className="font-bold text-emerald-900 mb-4">After Issue</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-emerald-600 font-semibold mb-1">Warehouse Stock</p>
                        <p className="text-2xl font-black text-emerald-900">
                          {remainingAfterIssue.toLocaleString()}m
                        </p>
                      </div>
                      <div className="pt-3 border-t border-emerald-300">
                        <p className="text-xs text-emerald-600 font-semibold mb-1">Issued to Job Worker</p>
                        <p className="text-sm text-emerald-900">{(parseFloat(issueQuantity) || 0).toLocaleString()}m</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Material</span>
                      <span className="font-bold text-slate-900">{selectedLot?.itemName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Quantity Issued</span>
                      <span className="font-bold text-slate-900">{(parseFloat(issueQuantity) || 0).toLocaleString()}m</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Destination</span>
                      <span className="font-bold text-slate-900">
                        {parties.find((p) => p._id === jobWorker)?.name || 'Selected Worker'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Process</span>
                      <span className="font-bold text-slate-900">{processType}</span>
                    </div>
                    {charges && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Charges</span>
                        <span className="font-bold text-slate-900">₹{(parseFloat(charges) || 0).toLocaleString()}/m</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-slate-200 bg-white px-6 py-4 flex gap-3 justify-between">
          <button
            onClick={() => {
              if (step > 1) setStep(step - 1);
              else onClose();
            }}
            className="px-4 py-2 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={() => {
              if (step < 3 && isValid) setStep(step + 1);
              else if (step === 3) handleSubmit();
            }}
            disabled={!isValid || loading}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${
              isValid
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Saving...' : step === 3 ? 'Confirm & Create Issue' : 'Next'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EnhancedJobIssueModal;
