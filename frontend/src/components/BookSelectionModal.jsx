import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDefaultBooksForModule } from '../utils/defaultBooks';
import useStore from '../store/useStore';

/**
 * Classic ERP Book Selection Modal — matches reference software layout:
 * Header: Book Selection
 * Table: Book | Book Cd
 */
const BookSelectionModal = ({ isOpen, onClose, moduleName, onSelectBook, bookFilter = null }) => {
  const { fetchBooksByModule, books: storeBooks, ledgers } = useStore();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && moduleName) {
      setLoading(true);
      fetchBooksByModule(moduleName).finally(() => setLoading(false));
      setSelectedIdx(0);
    }
  }, [isOpen, moduleName]);

  const books = useMemo(() => {
    if (!moduleName) return [];
    let list = storeBooks.filter((b) => b.module === moduleName);
    if (!list.length) {
      list = getDefaultBooksForModule(moduleName);
    }

    // For cash/bank books, also include bank & cash ledgers if not already present as books
    const isCashOrBank = ['receipt', 'payment', 'cashBook', 'bankBook', 'cashPayment', 'cashReceipt'].includes(moduleName);
    if (isCashOrBank && Array.isArray(ledgers) && ledgers.length > 0) {
      const existingNames = new Set(list.map((b) => (b.name || '').trim().toLowerCase()));
      const bankLedgerBooks = ledgers
        .filter((l) => ['Bank', 'Cash'].includes(l.accountType) && l.isActive !== false)
        .filter((l) => !existingNames.has((l.name || '').trim().toLowerCase()))
        .map((l, i) => ({
          _id: `ledger_book_${l._id || l.id}`,
          name: l.name,
          code: l.code || String(100 + i + 1),
          module: moduleName,
          ledgerId: l._id || l.id,
          accountType: l.accountType,
        }));
      list = [...list, ...bankLedgerBooks];
    }

    if (bookFilter && typeof bookFilter === 'function') {
      const filtered = list.filter(bookFilter);
      if (filtered.length > 0) return filtered;
    }
    return list;
  }, [moduleName, storeBooks, ledgers, bookFilter]);

  useEffect(() => {
    if (!isOpen || books.length === 0) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % books.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + books.length) % books.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (books[selectedIdx]) onSelectBook(books[selectedIdx]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, books, selectedIdx, onSelectBook, onClose]);

  if (!isOpen) return null;

  const handleContinue = () => {
    if (books[selectedIdx]) onSelectBook(books[selectedIdx]);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" data-book-selection-modal>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50"
        />

        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          className="relative w-full max-w-md bg-[#ece9d8] overflow-hidden border-2 border-[#0055ea] shadow-2xl font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Classic WinForms Header */}
          <div className="bg-[#6b8299] px-3 py-1.5 flex items-center justify-between text-white border-b border-[#4a5f73]">
            <span className="text-[13px] font-bold text-[#ffff99] tracking-wide mx-auto">Book Selection</span>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:bg-red-600 px-2 py-0.5 text-xs font-bold leading-none"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>

          <div className="p-1 bg-white min-h-[160px] max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs text-gray-500 font-semibold">Loading books…</div>
            ) : books.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500 font-semibold">No books found</div>
            ) : (
              <table className="w-full text-left border-collapse select-none text-xs">
                <thead>
                  <tr className="bg-[#f0f0f0] border-b border-gray-300">
                    <th className="px-3 py-1 font-bold text-gray-800 border-r border-gray-300">Book</th>
                    <th className="px-3 py-1 font-bold text-gray-800 text-right w-24">Book Cd</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book, idx) => {
                    const isSelected = idx === selectedIdx;
                    return (
                      <tr
                        key={book._id || idx}
                        onClick={() => setSelectedIdx(idx)}
                        onDoubleClick={handleContinue}
                        className={`cursor-pointer ${
                          isSelected
                            ? 'bg-[#0078d7] text-white font-bold'
                            : 'hover:bg-blue-50 text-gray-900 even:bg-[#fafafa]'
                        }`}
                      >
                        <td className="px-3 py-1.5 border-r border-gray-200 uppercase tracking-wide">
                          {book.name}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold">{book.code}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-3 py-2 bg-[#d4d0c8] border-t border-[#999] flex items-center justify-between">
            <span className="text-[11px] text-gray-600 font-medium">Use ↑ / ↓ arrow keys, Enter to Select</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleContinue}
                disabled={books.length === 0}
                className="px-4 py-1 bg-[#0055ea] hover:bg-[#0044bb] text-white text-xs font-bold rounded shadow-sm disabled:opacity-50"
              >
                Select (Enter)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 bg-[#e0ded8] hover:bg-[#ccc] text-gray-800 text-xs font-semibold rounded border border-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BookSelectionModal;

